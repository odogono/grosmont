import { Entity } from 'odgn-entity/src/entity';
import { findEntityByUrl, getDependencies, insertDependency, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileResult } from '../../types';
import { jsToComponent, mdxToJs } from './transpile';
import { buildProps, resolveImport } from './util';
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

    let fileIndex = site.getIndex('/index/srcUrl');
    let linkIndex = site.getIndex('/index/links', true);
    let imgIndex = site.getIndex('/index/imgs', true);

    let ents = await selectJs(es, options);

    let updates = [];

    for (const e of ents) {

        try {

            updates.push( await processEntity(site, e, options) );

        } catch (err) {
            let ee = es.createComponent('/component/error', { message: err.message, from: Label });
            ee = setEntityId(ee, e.id);
            error(reporter, 'error', err, { eid: e.id });
        }
    }

    await es.add( updates.filter(Boolean) );

    return site;
}


async function processEntity(site: Site, e: Entity, options: ProcessOptions):Promise<Entity> {

    const { es } = site;
    const siteRef = site.getRef();
    const { fileIndex } = options;
    const { url: base } = e.Src;

    const {data} = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};

    const resolveImportLocal = (path: string, mimes?: string[]) => undefined;

    const require = (path: string, fullPath) => {
        log('[require]', path);
        return false;
    };

    const result = jsToComponent(data, {path}, { resolveImport: resolveImportLocal, require });

    const { pageProps } = result;

    // log('result', result);

    meta = { ...meta, ...pageProps };

    await parseConfig(es, meta, undefined, { add: false, e, siteRef });

    return e;
}

