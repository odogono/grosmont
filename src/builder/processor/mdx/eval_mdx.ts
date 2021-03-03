import { Entity, EntityId } from 'odgn-entity/src/entity';
import { findEntityByUrl, getDependencies, getEntityByUrl, getUrlComponent, insertDependency, selectEntitiesByMime } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { DependencyType, ProcessOptions, SiteIndex, TranspileResult } from '../../types';
import { mdxToJs } from './transpile';
import { buildProps, parseEntityUrl, resolveImport } from './util';
import { parse as parseConfig } from '../../config';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { Component, setEntityId } from 'odgn-entity/src/component';
import { resolveUrlPath } from '../../util';

const Label = '/processor/mdx/eval_mdx';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface EvalMdxOptions extends ProcessOptions {
    linkIndex?: SiteIndex;
}

/**
 * Compiles Mdx
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    options.fileIndex = site.getIndex('/index/srcUrl');
    options.srcIndex = site.getIndex('/index/srcUrl');
    options.linkIndex = site.getIndex('/index/links', true);
    options.imgIndex = site.getIndex('/index/imgs', true);

    // select mdx entities
    // let ents = await selectMdx(es, options);
    let ents = await selectEntitiesByMime(es, ['text/mdx'], options);

    let output: Component[] = [];

    // first pass at parsing the mdx - pulling out links, local meta etc
    for (const e of ents) {

        try {
            let coms = await processEntity(site, e, options);
            output = output.concat(coms);

            info(reporter, ``, { eid: e.id });

        } catch (err) {
            let ee = es.createComponent('/component/error', { message: err.message, from: Label });
            output.push( setEntityId(ee, e.id) );
            error(reporter, 'error', err, { eid: e.id });
            log('error', err);
        }

    }

    await es.add(output);


    return site;
}



async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<Component[]> {

    const { es } = site;
    const siteRef = site.getRef();
    const { srcIndex } = options;
    const { url: base } = e.Src;

    let imports = [];
    let links = [];

    // function passed into the mdx parser and called whenever
    // an import is found
    function resolveImportLocal(path: string, mimes?: string[]){
        let entry = resolveImport(site, path, base);
        if (entry !== undefined) {
            imports.push(entry);
            return entry[1];
        }
    }

    const require = (path: string, fullPath) => {
        log('[processEntity]', path);

        // const fullPath = Path.resolve(Path.dirname(path), path);
        // let url = getEntityImportUrlFromPath(fileIndex, path)
        // log('[require]', url);

        // log('[preProcessMdx]', fileIndex.index);
        return false;
    };

    const resolveLink = (url: string, text: string) => {
        // log('[resolveLink]', url);
        if (!isUrlInternal(url)) {
            links.push(['ext', undefined, url, text]);
            return url;
        }

        let entry = resolveImport(site, url, base);
        if (entry !== undefined) {
            links.push(['int', entry[0], url, text]);
            return entry[1];
        }


        return url;
    }


    let props = await buildProps(site, e);
    const { data } = props;
    let context = { site, e };

    // log('->', e.id, props);

    if( data === undefined ){
        return [];
    }

    const result = mdxToJs(data, props, { resolveLink, resolveImport: resolveImportLocal, require, context });

    const { js } = result;

    // log('result', result);

    const jsCom = setEntityId(es.createComponent('/component/js', { data: js }), e.id);

    // await parseConfig(es, meta, undefined, { add: false, e, siteRef });

    // creates css dependencies
    // e = await applyCSSLinks(es, e, result);

    // e = await applyImgLinks(es, e, result, options);

    // creates link dependencies and adds to the link
    // index for use at the point of rendering
    await applyLinks(site, e, links, options);

    await applyImports(site, e, imports, options);

    // log('[processEntity]', result);

    return [jsCom];
}

function isUrlInternal(url: string) {
    const re = new RegExp('^(http|https).*');
    return re.test(url) === false;
}


async function applyImports(site: Site, e: Entity, imports, options: EvalMdxOptions) {
    const { es } = site;
    const existingIds = new Set(await getDependencies(es, e.id, 'import'));
    const cssIds = await getDependencies(es, e.id, 'css');
    cssIds.forEach(existingIds.add, existingIds);

    // log('[applyImports]', 'existing', existingIds );

    for (let [importEid, url] of imports) {
        let type:DependencyType = 'import';
        // let additionalComs = [];
        const match = parseEntityUrl(url);
        // log('[applyImports]', match);
        if( match !== undefined ){
            const {eid, did} = match;
            if( did === '/component/scss' ){
                type = 'css';
            }
        }

        // log('[applyImports]', type, url );
        
        let urlCom = es.createComponent('/component/url', { url });
        let depId = await insertDependency(es, e.id, importEid, type, [urlCom] );

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // log('[applyImports]', 'remove', existingIds );

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}

async function applyLinks(site: Site, e: Entity, links, options: EvalMdxOptions) {
    const { es } = site;
    const existingIds = new Set(await getDependencies(es, e.id, 'link'));

    for (let [type, linkEid, url, text] of links) {
        if (type === 'ext') {
            linkEid = await getUrlEntityId(es, url, options);
        }

        let depId = await insertDependency(es, e.id, linkEid, 'link');

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}


async function getUrlEntityId(es: EntitySet, url: string, options: EvalMdxOptions) {
    let com = await getUrlComponent(es, url, options);

    if (com === undefined) {
        com = es.createComponent('/component/url', { url });
        await es.add(com);
        return es.getUpdatedEntities()[0];
    }
    return com;
}

