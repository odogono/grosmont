import Path from 'path';
import Process from 'process';
import { BitField, get as bfGet } from '@odgn/utils/bitfield';
import {
    Component,
    ComponentId,
    getComponentDefId,
    getComponentEntityId,
    isComponent,
    EntityId,
    AddOptions, AddType, EntitySet, EntitySetOptions,
    ProxyEntitySet,
    QueryableEntitySet,
} from '../es';



import { Site, SiteOptions } from './site';
import { process as scanSrc } from './processor/file';
import { process as evalJsx } from './processor/jsx/eval';
import { process as evalJs } from './processor/js/eval';
import { process as evalClientCode } from './processor/client_code';
import { process as renderJs } from './processor/js/render';
import { process as evalMdx } from './processor/mdx/eval';
import { process as parseMdx } from './processor/mdx/parse';
import { process as resolveMeta } from './processor/mdx/resolve_meta';
import { process as mark } from './processor/mark';
import { process as applyTags } from './processor/apply_tags';
import { process as renderScss } from './processor/scss';
import { process as assignTitle } from './processor/assign_title';
import { process as write } from './processor/write';
import { process as copyStatic } from './processor/static/copy';
import { process as remove } from './processor/remove';
import { process as buildDstIndex } from './processor/build_dst_index';
import { EntityUpdate, ProcessOptions, SiteProcessor } from './types';
import { buildSrcIndex, clearUpdates, clearErrors } from './query';
import { debug, info, setLocation, warn } from './reporter';
import { isFunction, isObject, isString, parseUri } from '@odgn/utils';
import { process as generateGraph } from './processor/graph_gen';

const Label = '/build';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface BuildProcessOptions extends ProcessOptions {
    updates?: EntityUpdate[];

    // whether the default processors should be included
    includeDefault?: boolean;

    // whether processors defined in config should be included
    includeConfig?: boolean;
}


export type ProcessorEntry = [Function, number? /*priority*/, any? /*options*/, string? /*url*/];
export type RawProcessorEntry = [string | Function, number?, any?];

/**
 * Creates a processor
 * 
 * @param site 
 */
export async function build(site: Site, label:string = '/build', options: BuildProcessOptions = {}): Promise<Site> {

    let reporter = site.reporter;
    setLocation(reporter, Label);
    const siteRef = site.getRef();
    const updateOptions = { reporter, onlyUpdated: true, ...options, siteRef };


    // const spec = getProcessorSpec(site, options);


    let process = await buildProcessors(site, label, undefined, { includeDefault:true, includeConfig:true, onlyUpdated: true });


    site = await process(site, { ...updateOptions, ...options });

    return site;
}


export function getProcessorSpec(site: Site, options: BuildProcessOptions = {}): RawProcessorEntry[] {
    const doGG = options['/processor/graph_gen'] !== undefined;

    // function printSrcIndex(site:Site, options:ProcessOptions){
    //     const srcIndex = site.getIndex('/index/srcUrl');
    //     for( const key of srcIndex.index.keys() ){
    //         log('srcidx', key);
    //     }
    // }
    // function printDstIndex(site:Site, options:ProcessOptions){
    //     const idx = site.getDstIndex();
    //     for( const key of idx.index.keys() ){
    //         log('dstidx', key);
    //     }
    // }

    const beautify = options.beautify ?? false;

    let config = site.getConfig('/processors');

    return [
        ['/query#clearUpdates', 1000],
        ['/query#clearErrors', 999],
        ['/processor/file'],

        ['/processor/mark#statics'],
        ['/processor/mark#jsx'],
        ['/processor/mark#mdx'],
        ['/processor/mark#scss'],

        ['/processor/build_src_index'],

        ['/processor/mdx/parse'],
        ['/processor/apply_tags', 0, { type: 'tag' }],
        ['/processor/apply_tags', 0, { type: 'layout' }],
        ['/processor/mdx/resolve_meta'],
        ['/processor/build_dst_index', 0, { onlyUpdated: false }],


        ['/processor/scss', 0, { renderScss: true }],
        ['/processor/jsx/eval'],
        ['/processor/mdx/eval'],

        ['/processor/js/eval'],

        ['/processor/client_code'],

        ['/processor/build_dst_index', 0, { onlyUpdated: false }],

        ['/processor/js/render', 0, { beautify: true }],
        
        
        ['/processor/build_dst_index', 0, { onlyUpdated: false }],

        ['/processor/write', -100],
        ['/processor/static/copy', -101],
        ['/processor/remove', -102],
        doGG && ['/processor/graph_gen', -200],
    ];
}

/**
 * 
 * @param site 
 * @param spec 
 * @param options 
 */
export async function buildProcessors(site: Site, label:string, spec: RawProcessorEntry[] = [], options: BuildProcessOptions = {}): Promise<SiteProcessor> {
    let reporter = site.reporter;
    const siteRef = site.getRef();
    const updateOptions = { reporter, onlyUpdated: false, ...options, siteRef };
    const includeDefault = options.includeDefault ?? false;
    const includeConfig = options.includeConfig ?? true;

    if( includeDefault ){
        let def = getProcessorSpec(site,options);
        spec = [...def, ...spec];
    }

    if( includeDefault ){
        let config = site.getConfig('/processors', []);
        spec = [...spec, ...config];
    }

    spec = spec.filter(Boolean);

    let result: ProcessorEntry[] = [];
    for (let [url, priority, options] of spec) {
        let p = await resolveProcessor(url);

        if (p === undefined) {
            warn(reporter, `processor ${url} not found`);
            continue;
        }

        result.push([p, priority ?? 0, options ?? {}, isString(url) ? url as string : undefined]);
    }

    // sort according to priority descending
    result.sort(([a, ap], [b, bp]) => {
        if (ap < bp) { return 1; }
        if (ap > bp) { return -1; }
        return 0;
    });

    let removePriorities = [];

    // look for /processor/noop and clear with same priority
    for (let [prc, priority, pOptions, url] of result) {
        if( url === '/processor/noop' ){
            removePriorities.push( priority );
        }
    }

    result = result.filter( ([,priority]) => {
        return removePriorities.indexOf(priority) === -1;
    })
    
    // log('[buildProcessors]', result);
    // for (let [prc, priority, pOptions, url] of result) {
    // //     setLocation(reporter, Label);
    // //     info(reporter, `[buildProcessors] ${url}`);
    //     log('[buildProcessors]', priority, url );
    // }
    

    return async (site: Site, options: BuildProcessOptions = {}) => {
        
        for (let [prc, priority, pOptions, url] of result) {
            setLocation(reporter, Label);
            debug(reporter, `[buildProcessors][${label}] run ${url}`);
            await prc(site, { ...pOptions, ...updateOptions, ...options });
            debug(reporter, `[buildProcessors][${label}] end ${url}`);
        }
        return site;
    }
}




async function resolveProcessor(url: any): Promise<Function> {
    if (isFunction(url)) {
        return url;
    }

    if (!isString(url)) {
        return undefined;
    }

    let processFn = 'process';
    let process: Function = undefined;

    let [path, anchor] = readUrlAnchor(url);
    if (anchor) {
        processFn = anchor;
        url = path;
    }

    // go for straight import first
    let res = await safeImport(url);

    if (res === undefined) {
        res = require( './' + url);
    }

    if (res === undefined) {
        res = await safeImport('./' + url);
    }

    if (isObject(res) && res[processFn]) {
        return res[processFn];
    }

    return undefined;
}

async function safeImport(url: string) {
    try {
        
        return await import(url);
    } catch (err) {
        return undefined;
    }
}

function readUrlAnchor(url: string) {
    let parts = parseUri(url);
    if (parts === undefined) {
        return [];
    }
    const { protocol, host, path, anchor } = parts;
    return [path, anchor];

}

async function parseProcessorConfig(config: any[]) {
    let result: ProcessorEntry[] = [];

    if (config === undefined) {
        return result;
    }

    for (const entry of config) {
        for (const pUrl of Object.keys(entry)) {
            let { priority, ...options } = entry[pUrl];
            log('proc', pUrl, priority, options);

            try {
                const { process } = await import('./' + pUrl);

                result.push([process, priority, options]);

            } catch (err) {
                log('[parseProcessorConfig]', 'not found', pUrl);
            }

            // log(pUrl, module);
        }
    }

    return result;
}



export class OutputES extends ProxyEntitySet {
    components: Component[] = [];
    filterBf: BitField;

    constructor(es: QueryableEntitySet, filterBf: BitField, options: EntitySetOptions = {}) {
        super(es, options);
        this.filterBf = filterBf;
        // this.ecoms = new Map<EntityId, Component>();
    }

    async addComponents(incoming: Component[], options?: AddOptions): Promise<EntitySet> {
        let outgoing = [];

        for (let ii = 0; ii < incoming.length; ii++) {
            let com = incoming[ii];

            if (bfGet(this.filterBf, getComponentDefId(com))) {
                this.components.push(com);
                // this.ecoms.set( getComponentEntityId(com), com );
                continue;
            }

            outgoing.push(com);
        }

        return this.es.addComponents(outgoing, options);
    }
}


/**
 * Renders a single entity using given props and returns its output component
 * 
 * @param site 
 * @param process 
 * @param eid 
 * @param props 
 * @returns 
 */
export async function renderToOutput(site: Site, process: SiteProcessor, eid: EntityId, props: any = {}) {
    const { es } = site;
    const bf = es.resolveComponentDefIds('/component/output');
    const pes = new OutputES(es, bf);
    // log('[renderToOutput]', 'render output', pes.getUrl(), 'to', es.getUrl() );

    await process(site, { es: pes as any, eids: [eid], props });

    return pes.components.find(com => getComponentEntityId(com) === eid);
}