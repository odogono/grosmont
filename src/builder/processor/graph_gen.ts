import Fs from 'fs-extra';
import { spawn } from 'child_process';
import Which from 'which';

import { isNumeric, isObject, stringify, truncate } from '@odgn/utils';
import { BitField, get as bfGet } from '@odgn/utils/bitfield';
import {
    Digraph,
    Edge,
    attribute,
    toDot,
    Node,
} from 'ts-graphviz';
import { getDependencies, getDependenciesOf } from '../query';



import {
    Component,
    Entity,
    EntityId,
    EntitySet,
    getComponentEntityId,
    isEntityId,
    setEntityId,
    toComponentId,
    ComponentDef,
    componentToObject,
    getDefId,
} from "../../es";

import { Site } from "../site";
import { ProcessOptions } from "../types";
import { debug, error, info, Reporter, setLocation } from '../reporter';


const Label = '/processor/graph_gen';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface GraphGenOptions extends ProcessOptions {
    type: 'svg' | 'png';
    path: string;
    showDeps?: boolean;
    srcOnly?: boolean;
    dstOnly?: boolean;
    include?: BitField;
    exclude?: BitField;
}

/**
 * 
 * @param site 
 * @param options 
 * @returns 
 */
export async function process(site: Site, options: GraphGenOptions) {
    const { es } = site;
    const { reporter, type, path } = options;
    setLocation(reporter, Label);

    let dot = await generateGraph(site, { showDeps: false, ...options });


    try {
        // dot -Tpng es.graph.dot -o es.graph.png
        await execute(path, type, dot, reporter);

    } catch( err ){
        error(reporter, 'error executing dot', err );
    }

    return site;
}


/**
 * Runs the graphviz dot executable
 * 
 * @param outputPath 
 * @param type 
 * @param dot 
 */
async function execute(outputPath: string, type: ('svg' | 'png'), dot: string, reporter: Reporter) {
    let parameters = [];
    let out = '';
    let err = '';

    parameters.push('-T' + type);

    parameters.push('-o' + outputPath);

    let outcallback = (data) => {
        out += data;
    };

    let cmdPath = Which.sync('dot', {});

    debug(reporter, `running ${cmdPath}`);

    return await new Promise((res, rej) => {
        let graphviz = spawn(cmdPath, parameters);
        graphviz.stdout.on('data', outcallback);
        graphviz.stderr.on('data', (data) => {
            err += data;
        });

        graphviz.on('exit', (code) => {
            if (code !== 0) {
                log('exit error', code, out, err);
                error(reporter, `code ${code}, ${err}`);
                // if (errback) {
                //     errback(code, out, err);
                // }
                return rej(err);
            } else {
                // if (typeof name_or_callback == 'function') name_or_callback(rendered);
                // else if (errback) errback(code, out, err)
                // log('ok good', code, out);
                info(reporter, `${cmdPath} ok ${code} ${out}`);
                return res(code);
            }
        });

        graphviz.stdin.write(dot);
        graphviz.stdin.end();
    });
}



export async function generateGraph(site: Site, options: GraphGenOptions) {
    const { es } = site;
    const g = new Digraph('G', {
        [attribute.rankdir]: 'LR'
    });

    g.attributes.node.apply({
        [attribute.shape]: 'plaintext'
    });

    let nodes = new Map<EntityId, EntityNode>();
    let edges = [];
    let count = 0;


    if (options.dstOnly) {
        let idx = site.getDstIndex();

        for (const [key, [eid]] of idx) {
            log(key, '->', eid);
            let node = new ComponentNode(eid, key);
            g.addNode(node);
            nodes.set(node.eid, node);

            let deps = await getDependencies(es, eid, undefined, false) as Entity[];

            for (const dep of deps) {
                [nodes, edges] = await addEntity(g, es, dep, nodes, edges, { ...options, srcOnly: true });
            }

            deps = await getDependenciesOf(es, eid, undefined, false) as Entity[];

            for (const dep of deps) {
                [nodes, edges] = await addEntity(g, es, dep, nodes, edges, { ...options, srcOnly: true });
            }

            // log( 'deps of', deps );
        }

        let missing = findMissingEntities(nodes, edges);

        for (const eid of missing) {
            [nodes, edges] = await addEntity(g, es, eid, nodes, edges, { ...options, srcOnly: true });
        }

        buildEdges(g, nodes, edges);

        return toDot(g);
    }

    for await (const e of es.getEntities(true)) {
        [nodes, edges] = await addEntity(g, es, e, nodes, edges, options);
    }

    buildEdges(g, nodes, edges);

    return toDot(g);
}


async function addEntity(g: Digraph, es: EntitySet, id: EntityId | Entity, nodes, edges, options: GraphGenOptions) {
    let eid: EntityId = isEntityId(id) ? id as EntityId : (id as Entity).id;
    let e: Entity = isEntityId(id) ? await es.getEntity(id as EntityId, true) : id as Entity;

    let { node, deps } = entityToNode(g, es, e, options);

    if (node) {
        g.addNode(node);
        nodes.set(node.eid, node);
    }

    if (deps) {
        edges = [...edges, ...deps];
    }

    return [nodes, edges];
}


function findMissingEntities(nodes, edges) {
    let result: EntityId[] = [];
    for (const [srcEid, dstEid, type] of edges) {
        let src = nodes.get(srcEid);
        let dst = nodes.get(dstEid);

        if (src === undefined) {
            result.push(srcEid);
        }
        if (dst === undefined) {
            result.push(dstEid);
        }
    }
    return result;
}

function buildEdges(g: Digraph, nodes, edges) {
    for (const [srcEid, dstEid, type] of edges) {
        let src = nodes.get(srcEid);
        let dst = nodes.get(dstEid);

        if (src === undefined || dst === undefined) {
            continue;
        }

        let edge = new Edge([src, dst], {
            [attribute.label]: type
        })

        g.addEdge(edge);
    }
}

/**
 * Generates a GraphViz Node from an Entity, and returns any dependencies
 * 
 * @param g 
 * @param es 
 * @param e 
 * @param options 
 * @returns 
 */
function entityToNode(g: Digraph, es: EntitySet, e: Entity, options: GraphGenOptions) {

    const showDeps = options.showDeps ?? true;
    const includeBf = options.include;
    const excludeBf = options.exclude;
    const srcOnly = options.srcOnly ?? false;

    const isDep = e.Dep !== undefined;

    let label = e.Src?.url;

    let buffer = [];
    let deps = [];

    if (srcOnly) {
        if (e.Src === undefined && !isDep) {
            return { node: undefined, deps: undefined };
        }
    }

    buffer.push(`<<table border="0" cellborder="1" cellspacing="0" cellpadding="4">`);
    buffer.push(`<tr><td colspan="2">e${e.id}</td></tr>`);


    for (const [did, com] of e.components) {

        const def = es.getByDefId(did);
        // let attr = keyAttributeFromComponent(def, com);

        // attr = truncateStart(attr, 40, '...');
        // attr = attr.padEnd(40, ' ');

        let [attr, refs] = componentToTable(e, def, com);

        if (def.uri === '/component/dep') {
            if (showDeps) {
                deps.push([com.src, e.id, com.type]);
                deps.push([e.id, com.dst, com.type]);
            }
            else {
                deps.push([com.src, com.dst, `<${com.type}<br/>(${e.id})>`]);
                return { node: undefined, deps };
            }
        }

        if (includeBf && bfGet(includeBf, did) === false) {
            continue;
        }
        if (excludeBf && bfGet(excludeBf, did) === true) {
            continue;
        }


        buffer.push(`<tr><td align="left" valign="top">${def.name}</td><td align="left">${attr}</td></tr>`)
    }

    let node: EntityNode;

    if (!srcOnly || isDep) {
        buffer.push(`</table>>`);

        label = buffer.join('');

        node = new EntityNode(e.id, label);
    } else {
        node = new ComponentNode(e.id, e.Src?.url);
    }


    return { node, deps };
}


class EntityNode extends Node {
    eid: EntityId;
    constructor(id: number, label: string, attrs: any = {}) {
        super(`e${id}`, {
            [attribute.label]: label,
            // [attribute.shape]: `record`,
            ...attrs
        });
        this.eid = id;
    }
}

class ComponentNode extends EntityNode {
    constructor(id: number, label: string) {
        super(id, `<${label}<br/>(e${id})>`, {
            [attribute.shape]: 'component'
        })
    }
}


function componentToTable(e: Entity, def: ComponentDef, com: Component) {
    let entityRefs = [];
    let buffer = [];

    buffer.push('<table border="0" cellborder="0" cellspacing="0" cellpadding="2">')
    let { '@d': did, '@e': eid, ...attrs } = componentToObject(com);

    // log('com', attrs);

    for (let key of Object.keys(attrs)) {
        let val = attrs[key];
        let prop = def.properties.find(p => p.name === key);

        if (prop.type === 'entity') {
            entityRefs.push([key, val]);
        }

        if (isObject(val) || Array.isArray(val)) {
            val = stringify(val);
        }
        if (isNumeric(val)) {
            val = val + '';
        }
        val = truncateStart(val, 30, '...');
        val = escapeHtml(val);

        buffer.push(`<tr><td align="left" width="1">${key}</td><td align="left">${val}</td></tr>`);

    }

    if (Object.keys(attrs).length === 0) {
        buffer.push(`<tr><td></td></tr>`);
    }

    buffer.push(`</table>`);

    // log( buffer.join('')) ;

    return [buffer.join(''), entityRefs];
}

function keyAttributeFromComponent(def: ComponentDef, com: Component) {
    switch (def.uri) {
        case '/component/src':
        case '/component/dst':
            return com.url;
        case '/component/output':
            return com.mime;
        default:
            return '';
    }
}

function truncateStart(str: string, len = 10, ellipsis = '...'): string {
    if (!str.slice) {
        log('err', str);
    }
    return str === undefined ? '' :
        str.length <= len ?
            str
            : ellipsis + str.slice(str.length - len, str.length);
}

function escapeHtml(unsafe) {
    if (!unsafe.replace) {
        log('err', unsafe);
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}