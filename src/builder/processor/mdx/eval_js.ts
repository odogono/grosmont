import { Entity, EntityId } from 'odgn-entity/src/entity';
import { getDependencyEntities, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions } from '../../types';
import { jsToComponent } from './transpile';
import { createRenderContext, parseEntityUrl, resolveImport } from './util';
import { parse as parseConfig } from '../../config';
import { Component, setEntityId } from 'odgn-entity/src/component';
import { useServerEffect } from '../jsx/server_effect';
import { EntitySetMem } from 'odgn-entity/src/entity_set';
import { buildProcessors } from '../..';
import { createErrorComponent } from '../../util';

const Label = '/processor/mdx/eval_js';
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
            updates.push( createErrorComponent(es, e, err, {from:Label}) );
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
    const context = createRenderContext(site, e, options);
    

    debug(reporter, `process ${base}`, {eid:e.id});
    // log(`process ${base} (${e.id})`);

    // provides a require function to the component builder which fetches
    // the import data ahead of time to work with the synchronous import of evaluation
    const require = await buildImports( site, e, options );

    const resolveImportLocal = (path: string, mimes?: string[]) => undefined;


    let result = jsToComponent(data, { path, url:base }, { context, resolveImport: resolveImportLocal, require });

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
    let imports = await getDependencyEntities(es, e.id, 'import');

    let importComs = new Map<EntityId, any>();

    for( const imp of imports ){
        const url = imp.Url?.url;
        const impEid = imp.Dep.dst;
        const match = parseEntityUrl(url);
        if( match !== undefined ){
            const {eid, did} = match;

            if( did === '/component/scss' ){

            }
            else if( did === '/component/jsx' || did === '/component/js' ){
                const ie = await es.getEntity(impEid, true);
                let out = await processEntity(site, ie, options);
                importComs.set(ie.id, out.component);
            }
            else {
                const ie = await es.getEntity(impEid, true);
                importComs.set(ie.id, ie);
            }
        }

        // log('import', imp.Dep.dst, match);

    }
    
    function require(path: string, fullPath:string){
        const match = parseEntityUrl(path);
        let result = importComs.get(match?.eid);
        // log('[require]', path);
        return result !== undefined ? result : undefined;
    };

    return require;
}

/*
async function buildImportData(site:Site, e:Entity, options:ProcessOptions){
    const {es} = site;
    let imports = await getDependencyEntities(es, e.id, 'import');

    let result = {};

    for( const imp of imports ){
        // const dst = imp.Dep.dst;
        const url = imp.Url?.url;

        // figure out what kind of data the url is asking for
        let {host, path:did} = parseUri( url );
        let eid = toInteger(host);

        let dstE = await es.getEntity(eid, true);

        // log('[buildImportData]', eid, url);
        // printEntity(es, dstE);

        if( did === '/component/jsx' ){
            const ren = await renderJsx( site, dstE, options );
            result[url] = ren.default;
        } else {
            result[url] = dstE;
        }
    }
    return result;
}//*/