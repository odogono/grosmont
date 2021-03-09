import Jsonpointer from 'jsonpointer';

import { BitField, get as bfGet } from '@odgn/utils/bitfield';
import { Component, ComponentId, getComponentDefId, getComponentEntityId, isComponent } from 'odgn-entity/src/component';
import { getDefId } from 'odgn-entity/src/component_def';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { AddOptions, AddType, EntitySet, EntitySetOptions } from 'odgn-entity/src/entity_set';
import { ProxyEntitySet } from 'odgn-entity/src/entity_set_proxy';

import { Site, SiteOptions } from './site';
import { process as scanSrc } from './processor/file';
import { process as evalJsx } from './processor/jsx/eval_jsx';
import { process as evalJs } from './processor/mdx/eval_js';
import { process as renderJs } from './processor/mdx/render_js';
import { process as evalMdx } from './processor/mdx/eval_mdx';
import { process as resolveMeta } from './processor/mdx/resolve_meta';
import { process as mark } from './processor/mark';
import { process as applyTags } from './processor/apply_tags';
import { process as renderScss } from './processor/scss';
import { process as assignTitle } from './processor/assign_title';
import { process as write } from './processor/write';
import { process as copyStatic } from './processor/static/copy';
import { process as buildDstIndex } from './processor/dst_index';
import { EntityUpdate, ProcessOptions } from './types';
import { buildSrcIndex, clearUpdates } from './query';
import { warn } from './reporter';
import { isFunction, isObject, isString, parseUri } from '@odgn/utils';

const Label = '/build';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface BuildProcessOptions extends ProcessOptions {
    updates?: EntityUpdate[];
}


export type ProcessorEntry = [Function, number, any?];
export type RawProcessorEntry = [string | Function, number?, any?];

/**
 * 
 * @param site 
 */
export async function build(site: Site, options: BuildProcessOptions = {}) {

    let reporter = site.reporter;
    const siteRef = site.getRef();
    const updateOptions = { reporter, onlyUpdated: true, ...options, siteRef };

    let siteE = site.getEntity();
    let config = Jsonpointer.get(siteE, '/Meta/meta/processors');



    let processors: ProcessorEntry[] = [
        [clearUpdates, 1000],
        [scanSrc, 0],
        [mark, 0, { exts: ['html', 'jpeg', 'jpg', 'png', 'svg', 'txt'], comUrl: '/component/static' }],
        [mark, 0, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' }],
        [mark, 0, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' }],
        [mark, 0, { exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' }],
        [buildSrcIndex, 0],
        [renderScss, 0, { renderScss: true }],
        [evalJsx, 0],
        [evalMdx, 0],
        [applyTags, 0, { type: 'tag' }],
        [applyTags, 0, { type: 'layout' }],
        [evalJs, 0],
        [resolveMeta, 0],
        [buildDstIndex, 0, { url: '/processor/build_dst_index' }],
        [renderJs, 0],
        [buildDstIndex, -99],
        [write, -100],
        [copyStatic, -101],
    ];

    const loaded = await parseProcessorConfig(config);
    processors = processors.concat(loaded);

    // sort according to priority descending
    processors.sort(([a, ap], [b, bp]) => {
        if (ap < bp) { return 1; }
        if (ap > bp) { return -1; }
        return 0;
    });


    for (let [prc, priority, options] of processors) {
        options = options ?? {};
        await prc(site, { ...updateOptions, ...options });
    }

    return site;
}


/**
 * 
 * @param site 
 * @param spec 
 * @param options 
 */
export async function buildProcessors(site: Site, spec: RawProcessorEntry[], options: BuildProcessOptions = {}) {
    let reporter = site.reporter;
    const siteRef = site.getRef();
    const updateOptions = { reporter, onlyUpdated: false, ...options, siteRef };

    let result: ProcessorEntry[] = [];
    for (let [url, priority, options] of spec) {
        let p = await resolveProcessor(url);

        if (p === undefined) {
            warn(reporter, `processor ${url} not found`);
            continue;
        }

        result.push([p, priority ?? 0, options ?? {}]);
    }

    // sort according to priority descending
    result.sort(([a, ap], [b, bp]) => {
        if (ap < bp) { return 1; }
        if (ap > bp) { return -1; }
        return 0;
    });

    // log('[buildProcessors]', result);

    return async (site: Site, options: BuildProcessOptions = {}) => {
        for (let [prc, priority, pOptions] of result) {
            // log('[buildProcessors]', 'run', prc);
            await prc(site, { ...pOptions, ...updateOptions, ...options });
        }
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
    // ecoms: Map<EntityId, Component>;

    constructor(es: EntitySet, filterBf: BitField, options: EntitySetOptions = {}) {
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


