import Util from 'util';
import Path from 'path';
import {
    getComponentDefId, getComponentEntityId, toComponentId,
    Entity, EntityId, isEntityId,
    QueryableEntitySet,
    StatementArgs
} from "../../../es";
import { applyMeta, buildUrl, resolveUrlPath, resolveSiteUrl, uriToPath } from "../../util";
import { PageLink, 
    PageLinks, 
    SiteIndex, 
    TranspileProps, 
    ProcessOptions, 
    DependencyType, 
    EvalContext, 
    ImportDescr 
} from "../../types";
import { getDependencyEntities, 
    getDependencyEntityIds, 
    getDepenendencyDst, 
    getDstUrl, 
    insertDependency 
} from "../../query";
import { Site } from "../../site";
import { toInteger } from '@odgn/utils';
import { useServerEffect } from '../jsx/server_effect';
import { buildProcessors, OutputES } from '../..';
import { info } from '../../reporter';

const log = (...args) => console.log('[/processor/mdx/util]', ...args);

export async function buildProps(site: Site, e: Entity): Promise<TranspileProps> {

    let data = await site.getEntityData(e);

    let eMeta = e.Meta?.meta ?? {};
    let path = site.getSrcUrl(e);// e.Src.url; // e.Dst?.url ?? '';
    const url = e.Src?.url;
    let props: TranspileProps = { path, data, url, meta: eMeta };

    return props;
}

/**
 * 
 * @param site 
 * @param e 
 * @param options 
 * @returns 
 */
export function createRenderContext(site: Site, e: Entity, options: ProcessOptions = {}): EvalContext {
    const { url: base } = e.Src;
    const { reporter } = site;

    // const log = (...args) => info(reporter, Util.format(`[${base}]`, ...args));
    const log = (...args) => console.log(Util.format(`[${base}]`, ...args));

    const context = {
        e,
        page: e,
        es: site.es,
        site,
        log,
        useServerEffect,
        processEntity: processEntityOutput(site, e, options),
        runQuery: runQuery(site, e, options),
        processEntities: processEntities(site, e, options),
        resolveUrl: resolveUrl(site, e),
    };

    return context;
}


function resolveUrl( site: Site, e:Entity ){
    return ( q:EntityId|string ) => {
        if( isEntityId(q) ){
            return site.getEntityDstUrl( q as EntityId );
        }
        let entry = resolveSiteUrl(site, q as string, q as string );
            if( entry === undefined ){
                return '';
            }
            let [src, dst, eid, mime, bf] = entry;
            return dst;
    }
}


function runQuery(site: Site, e: Entity, options: ProcessOptions) {
    return async (q: string, args: StatementArgs) => {
        const { es } = site;
        let result = await es.prepare(q).getResult(args);
        // log('[runQuery]', q, result);
        return result;
    }
}

function processEntities(site: Site, e: Entity, options: ProcessOptions) {
    return async (eids: EntityId[], dids: string[], renderOptions: ProcessOptions = {}) => {
        const { es } = site;
        const srcId = e.id;
        const bf = es.resolveComponentDefIds(dids);
        let pes = new OutputES(es, bf);

        const process = await buildProcessors(site, [
            ['/processor/js/render', 0, renderOptions]
        ]);


        await process(site, { es: pes as any, eids });

        let result: Map<EntityId, Entity> = new Map<EntityId, Entity>();

        // add dependencies on the rendered entities
        for (const eid of eids) {
            await insertDependency(es, srcId, eid, 'import');
            let e = await es.getEntity(eid, bf);
            result.set(eid, e);
        }

        // apply the updated components from the output es to entities
        for (const com of pes.components) {
            const eid = getComponentEntityId(com);
            const e = result.get(eid);
            if (e !== undefined) {
                e.addComponentUnsafe(com);
            }
        }

        return Array.from(result.values());
    }
}

function processEntityOutput(site: Site, e: Entity, options: ProcessOptions) {

    return async (url: string, renderOptions: ProcessOptions = {}) => {
        const { es } = site;

        let pe = await site.getEntityBySrc(url);
        const bf = es.resolveComponentDefIds('/component/output');
        let pes = new OutputES(es, bf);

        const process = await buildProcessors(site, [
            ['/processor/js/render', 0, renderOptions]
        ]);
        const eids = [pe.id];

        // add a dependency - since this is an import, it gets
        // reset at the point of eval_mdx/jsx
        await insertDependency(es, e.id, pe.id, 'import');

        await process(site, { es: pes as any, eids });

        for (const com of pes.components) {
            if (getComponentEntityId(com) === pe.id) {
                e.addComponentUnsafe(com);
            }
        }

        return e;
    }
}



export async function buildPageLinks(es: QueryableEntitySet, linkIndex: SiteIndex) {
    let result: PageLinks = new Map<string, PageLink>();


    for (const [url, [eid, type, child]] of linkIndex.index) {
        if (type === 'external') {
            result.set(url, { url });
        } else {
            let path = await getDstUrl(es, eid);

            path = uriToPath(path);

            // log('[getDstUrl]', eid, path );
            result.set(url, { url: path });
        }
    }
    // log('[buildPageLinks]', linkIndex.index);
    // log('[buildPageLinks]', result);

    return result;
}



/**
 * Returns a url pointing to the value to import from a file path
 * 
 * @param fileIndex 
 * @param path 
 */
export function getEntityImportUrlFromPath(fileIndex: SiteIndex, path: string, mimes?: string[]) {
    // console.log('[getEntityImportUrlFromPath]', path);
    if (fileIndex === undefined || path == '') {
        return undefined;
    }
    let entry = fileIndex.index.get(path);
    if (entry === undefined) {
        // attempt to find without ext
        for (const [url, idxEntry] of fileIndex.index) {
            let ext = Path.extname(url);
            let wit = url.substring(0, url.length - ext.length);
            if (path === wit) {
                const [mime] = idxEntry;
                if (mimes !== undefined && mimes.indexOf(mime) === -1) {
                    continue;
                }
                // log('[gE]', url, idxEntry);
                entry = idxEntry;
                break;
            }
        }
        if (entry === undefined) {
            return undefined;
        }
    }
    // log('[gE]', 'found??', path, entry, fileIndex.index);
    const [eid, mime] = entry;
    return buildUrl(`e://${eid}/component/output`, { mime }) + '#text';
}


/**
 * 
 * @param es 
 * @param e 
 * @returns 
 */
export async function getEntityCSSDependencies(es: QueryableEntitySet, e: Entity) {
    const cssDeps = await getDependencyEntities(es, e.id, ['css']);
    if (cssDeps === undefined || cssDeps.length === 0) {
        return undefined;
    }

    const did = es.resolveComponentDefId('/component/output');
    let result = [];

    for (const dep of cssDeps) {
        const { src, dst } = dep.Dep;
        let path = await getDstUrl(es, dst);

        const com = await es.getComponent(toComponentId(dst, did));
        // log('[getEntityCSSDependencies]', dst, did, com);

        if (com) {
            result.push({ path, text: com.data });
        }
    }

    return result;
}




/**
 * Converts an array of ImportDescr (eid,url,mime) into dependencies
 * 
 * @param site 
 * @param e 
 * @param imports 
 * @param options 
 * @returns 
 */
export async function applyImports(site: Site, e: Entity, imports: ImportDescr[], options: ProcessOptions): Promise<Entity> {
    const { es } = site;

    // gather existing import and css dependencies
    const existingIds = new Set(await getDependencyEntityIds(es, e.id, ['import', 'css']));

    for (let [importEid, url, mime, specifiers] of imports) {
        let type: DependencyType = 'import';

        const match = parseEntityUrl(url);

        if (match !== undefined) {
            const { eid, did } = match;
            if (did === '/component/scss') {
                type = 'css';
            }
        }

        // log('[applyImports]', url, specifiers );

        let coms = [];
        coms.push(es.createComponent('/component/url', { url }));
        if (specifiers) {
            // for now stuff into meta
            coms.push(es.createComponent('/component/meta', { meta: { specifiers } }));
        }
        let depId = await insertDependency(es, e.id, importEid, type, coms);

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}


export function parseEntityUrl(url: string) {
    const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "i");
    let match = re.exec(url);
    if (match !== null) {
        const [url, eid, did] = match;
        return { eid: toInteger(eid), did, url };
    }
    return undefined;
}


