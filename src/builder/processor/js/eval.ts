import { Entity, EntityId, toComponentId } from '../../../es';
import { getDependencyEntities, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions } from '../../types';

import { createRenderContext, parseEntityUrl } from './util';
import { parseEntity } from '../../config';
import { createErrorComponent } from '../../util';
import { transformJS } from '../mdx/transform';

const Label = '/processor/js/eval';
const log = (...args) => console.log(`[${Label}]`, ...args);


/**
 * Evaluates the JS and extracts meta data
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    let ents = await selectJs(es, options);

    let updates = [];

    for (const e of ents) {

        try {
            let { e: upd } = await processEntity(site, e, options);
            updates.push(upd);

        } catch (err) {
            updates.push(createErrorComponent(es, e, err, { from: Label }));
            error(reporter, 'error', err, { eid: e.id });
        }
    }

    await es.add(updates.filter(Boolean));

    info(reporter, `processed ${ents.length}`);

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
    let config = {};

    const context = createRenderContext(site, e, options);

    debug(reporter, `process ${base}`, { eid: e.id });
    // log(`process ${base} (${e.id})`, data);

    // provides a require function to the component builder which fetches
    // the import data ahead of time to work with the synchronous import of evaluation
    const { require } = await buildImports(site, e.id, options);

    const resolveImportLocal = (path: string, mimes?: string[]) => undefined;
    function onConfig(incoming: any, override:boolean = true) {
        config = override ? { ...config, ...incoming } : {...incoming, ...config};
    }

    let result = transformJS(data, { path, url: base },
        { onConfig, context, resolveImport: resolveImportLocal, require });

    const { component, ...jsProps } = result;

    // apply any exports other than the component as meta
    meta = { ...meta, ...jsProps };

    // log(`process ${base} (${e.id})`, result);

    await parseEntity(es, meta, { add: false, e, siteRef });

    return { ...result, e, component };
}


/**
 * 
 * @param site 
 * @param e 
 * @param options 
 */
export async function buildImports(site: Site, eid: EntityId, options: ProcessOptions) {
    const { es } = site;

    // retrieve import dependencies for this e and place them
    let imports = await getDependencyEntities(es, eid, ['import', 'script']);
    const urls = imports.map(imp => imp.Url?.url).filter(Boolean);

    return buildImportsFromUrls(site, urls, options);
}

/**
 * 
 * @param site 
 * @param urls 
 * @param options 
 * @returns 
 */
export async function buildImportsFromUrls(site: Site, urls: string[], options: ProcessOptions) {
    const { es } = site;
    let importComs = new Map<EntityId, any>();

    for (const url of urls) {
        const match = parseEntityUrl(url);

        if (match === undefined) {
            continue;
        }

        const { eid, did } = match;

        if (did === '/component/scss') {
            console.warn('why no handle /component/scss??', { eid, did });
        }
        else if (did === '/component/jsx' || did === '/component/js' || did === '/component/mdx') {
            const ie = await es.getEntity(eid, true);
            let out = await processEntity(site, ie, options);
            importComs.set(ie.id, out.component);
        }
        else {
            console.warn('[buildImportsFromUrls]', 'default to return e', { eid, did });
            const ie = await es.getEntity(eid, true);
            importComs.set(ie.id, ie);
        }
    }

    function require(path: string, fullPath: string) {
        const match = parseEntityUrl(path);
        let result = importComs.get(match?.eid);
        // log('[require]', path);
        return result !== undefined ? result : undefined;
    };

    return { require, importComs };
}


export async function buildImportCodeFromUrls(site: Site, urls: string[], result?: Map<string, any>) {
    const { es } = site;
    result = result ?? new Map<string, any>();

    for (const url of urls) {
        const match = parseEntityUrl(url);

        if (match === undefined) {
            continue;
        }

        const { eid, did } = match;

        if (did === '/component/scss') {
            // console.warn('why no handle /component/scss??', { eid, did });
        }
        else if (did === '/component/jsx' || did === '/component/js') {
            // const ie = await es.getEntity(eid, true);

            await processEntityImport(site, eid, url, result);

            // let out = await processEntity(site, ie, options);
            // importComs.set(ie.id, out.component);
        }
        else {
            // const ie = await es.getEntity(eid, true);
            // importComs.set(ie.id, ie);
        }
    }

    // function require(path: string, fullPath: string) {
    //     const match = parseEntityUrl(path);
    //     let result = importComs.get(match?.eid);
    //     // log('[require]', path);
    //     return result !== undefined ? result : undefined;
    // };

    return result;
}


async function processEntityImport(site: Site, eid: EntityId, url: string, result: Map<string, any>) {
    const { es } = site;

    const did = es.resolveComponentDefId('/component/js');

    const com = await es.getComponent(toComponentId(eid, did));

    if (com === undefined) {
        return result;
    }

    const { data } = com;

    result.set(url, data);

    let imports = await getDependencyEntities(es, eid, ['import', 'script']);
    const urls = imports.map(imp => imp.Url?.url).filter(Boolean);

    await buildImportCodeFromUrls(site, urls, result);

    return result;
}