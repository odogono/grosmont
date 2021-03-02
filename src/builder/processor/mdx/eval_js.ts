import { Entity, EntityId } from 'odgn-entity/src/entity';
import { findEntityByUrl, getDependencies, getDepenendencyDst, insertDependency, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileResult } from '../../types';
import { jsToComponent, mdxToJs } from './transpile';
import { buildProps, parseEntityUrl, resolveImport } from './util';
import { parse as parseConfig } from '../../config';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { Component, setEntityId } from 'odgn-entity/src/component';

const Label = '/processor/mdx/eval_js';
const log = (...args) => console.log(`[${Label}]`, ...args);


/**
 * Evaluates the JS and extracts meta data
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    // let fileIndex = site.getIndex('/index/srcUrl');
    // let linkIndex = site.getIndex('/index/links', true);
    // let imgIndex = site.getIndex('/index/imgs', true);

    let ents = await selectJs(es, options);

    let updates = [];

    for (const e of ents) {

        try {
            let { e: upd } = await processEntity(site, e, options);
            updates.push(upd);

        } catch (err) {
            let ee = es.createComponent('/component/error', { message: err.message, from: Label });
            ee = setEntityId(ee, e.id);
            error(reporter, 'error', err, { eid: e.id });
        }
    }

    await es.add(updates.filter(Boolean));

    return site;
}


interface ProcessEntityResult {
    e: Entity;
    component: any;
}

async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<ProcessEntityResult> {

    const { es } = site;
    const siteRef = site.getRef();
    const { reporter } = options;
    const { url: base } = e.Src;

    // site.getEntityData(e);
    const { data } = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};

    debug(reporter, `process ${base}`, {eid:e.id});
    log(`process ${base} (${e.id})`);

    // log('imports', existingIds);
    const require = await buildImports( site, e, options );


    const resolveImportLocal = (path: string, mimes?: string[]) => undefined;

    // const require = (path: string, fullPath) => {
    //     const match = parseEntityUrl(path);
    //     log('[require]', match?.eid, path);
    //     let result = importComs.get(match?.eid);
    //     return result !== undefined ? result : false;
    // };

    const result = jsToComponent(data, { path }, { resolveImport: resolveImportLocal, require });

    const { pageProps, component } = result;

    meta = { ...meta, ...pageProps };

    await parseConfig(es, meta, undefined, { add: false, e, siteRef });

    return { ...result, e, component };
}


/**
 * 
 * @param site 
 * @param e 
 * @param options 
 */
export async function buildImports(site: Site, e: Entity, options:ProcessOptions) {
    const {es} = site;

    // retrieve import dependencies for this e and place them
    const importIds = await getDepenendencyDst(es, e.id, 'import');
    let importComs = new Map<EntityId, any>();

    for (const importEid of importIds) {
        const ie = await es.getEntity(importEid, true);
        if (ie) {
            let out = await processEntity(site, ie, options);
            // log('[buildImports]', e.id, ie.id, out);
            importComs.set(importEid, out.component);
        }
    }

    function require(path: string, fullPath:string){
        const match = parseEntityUrl(path);
        let result = importComs.get(match?.eid);
        // log('[require]', match?.eid, path, result);
        // log('[require]', 'but', result() )
        // result = { default:() => "BOOOO!"};
        // return undefined;
        return result !== undefined ? result : false;
    };

    return require;
}