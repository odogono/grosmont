import Path from 'path';


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { ProcessOptions, TranspileMeta, TranspileResult } from '../../types';
import { Site } from '../../site';

import { transpile } from './transpile';
import {
    getDependencies,
    findEntityBySrcUrl,
    findEntityByUrl,
    insertDependency,
    removeDependency,
    buildSrcIndex,
    selectMdx,
    selectSrcByMime,
    selectEntitiesByMime,
} from "../../query";
import { parseUri, toInteger } from "@odgn/utils";
import { buildProps, getEntityImportUrlFromPath, resolveImport } from "./util";
import { parse as parseConfig } from '../../config';
import { isString } from "@odgn/utils";
import { error, info, setLocation } from "../../reporter";
import { getComponentEntityId, setEntityId } from 'odgn-entity/src/component';
import { resolveUrlPath } from '../../util';



const log = (...args) => console.log('[ProcMDXParse]', ...args);



/**
 * Takes /component/mdx and parses out meta data
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, '/processor/mdx/parse');

    // build an index of /src#url
    let fileIndex = await buildSrcIndex(site);
    let linkIndex = site.getIndex('/index/links', true);
    let imgIndex = site.getIndex('/index/imgs', true);

    // select mdx entities
    // let ents = await selectMdx(es, options);
    let ents = await selectEntitiesByMime(es, ['text/mdx'], options);


    let output: Entity[] = [];


    // first pass at parsing the mdx - pulling out links, local meta etc
    for (const e of ents) {

        try {

            output.push(await preProcessMdx(site, e, { fileIndex, imgIndex, linkIndex }));

            info(reporter, ``, { eid: e.id });

        } catch (err) {

            e.Error = { message: err.message, stack: err.stack };
            output.push(e);
            error(reporter, 'error', err, { eid: e.id });
        }

    }

    await es.add(output);


    return es;
}




/**
 * Pulls data from and prepares the mdx for rendering
 * 
 * @param es 
 * @param e 
 */
async function preProcessMdx(site: Site, e: Entity, options: ProcessOptions) {
    const { es } = site;
    const siteRef = site.getRef();
    const { fileIndex } = options;
    const { url:base } = e.Src;

    let imports = [];

    const resolveImportLocal = (path: string, mimes?: string[]) => {

        let entry = resolveImport(site, path, base );
        if( entry !== undefined ){
            imports.push( entry );
            return entry[1];
        }
        // return getEntityImportUrlFromPath(fileIndex, path, mimes);
    }
    
    const require = (path: string, fullPath) => {
        log('[preProcessMdx]', path);

        // const fullPath = Path.resolve(Path.dirname(path), path);
        // let url = getEntityImportUrlFromPath(fileIndex, path)
        // log('[require]', url);

        // log('[preProcessMdx]', fileIndex.index);
        return false;
    };


    try {
        let props = await buildProps(site, e);
        let context = { site, e };

        let result = await transpile(props, { render: false, resolveImport:resolveImportLocal, require, context });

        const { meta } = result;

        await parseConfig(es, meta, undefined, { add: false, e, siteRef });

        // creates css dependencies
        e = await applyCSSLinks(es, e, result);


        e = await applyImgLinks(es, e, result, options);

        // creates tag dependencies
        // NOTE - does not happen here, since tags from parents also need to be applied 
        // e = await applyTags( es, e, result );

        // creates link dependencies and adds to the link
        // index for use at the point of rendering
        e = await applyLinks(es, e, result, options);

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


/**
 * takes any cssLinks found on the entities transpile result and creates dependency
 * entities
 */
async function applyCSSLinks(es: EntitySet, e: Entity, result: TranspileResult) {

    const { cssLinks } = result;

    // get a list of existing css dependencies
    const existingIds = new Set(await getDependencies(es, e.id, 'css'));

    // log('[applyCSSLinks]', {existingIds} );

    if (cssLinks !== undefined && cssLinks.length > 0) {

        for (const link of cssLinks) {
            // let deets = parseUri(link)
            let { host, path: com, anchor: attr, queryKey } = parseUri(link);
            let eid = toInteger(host);

            // log('[applyCSSLinks]', deets );

            // const path = await selectTargetPath(es, eid);
            // log('[applyCSSLinks]', eid, com, attr, queryKey, '=', link);
            let comUrl = es.createComponent('/component/url', { url: link });
            // comUrl = setEntityId( comUrl, e.id );

            // add a css dependency
            let depId = await insertDependency(es, e.id, eid, 'css', [comUrl]);

            if (existingIds.has(depId)) {
                existingIds.delete(depId);
            }
            //newIds.add(depId);
        }
    }

    // log('[applyCSSLinks]', 'remove', existingIds );

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}

async function applyImgLinks(es: EntitySet, e: Entity, result: TranspileResult, options: ProcessOptions) {
    const { imgs } = result;
    const siteRef = e.SiteRef?.ref;
    const { imgIndex } = options;

    const existingIds = new Set(await getDependencies(es, e.id, 'img'));

    // log('[applyImgLinks]', imgs);

    for (let [imgId, { url, alt }] of imgs) {
        const srcE = await findEntityByUrl(es, url, { siteRef });

        // log('[applyImgLinks]', url, srcE);

        if (srcE === undefined) {
            continue;
        }

        let depId = await insertDependency(es, e.id, srcE.id, 'img');

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }

        const type = srcE.Src !== undefined ? 'internal' : 'external';
        imgIndex.index.set(url, [srcE.id, type]);
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));


    return e;
}


/**
 * takes any cssLinks found on the entities transpile result and creates dependency
 * entities
 */
async function applyTags(es: EntitySet, e: Entity, result: TranspileResult) {
    log('[applyTags]')
    return e;
}

/**
 * takes links found from the transpile result, rewrites the urls, 
 * and creates dependency entities
 */
async function applyLinks(es: EntitySet, e: Entity, result: TranspileResult, options: ProcessOptions) {

    const { links } = result;
    const { linkIndex } = options;
    const siteRef = e.SiteRef?.ref;

    const existingIds = new Set(await getDependencies(es, e.id, 'link'));

    // log('[applyLinks]', links );

    for (let [linkUrl, { url, child }] of links) {

        const linkE = await findEntityByUrl(es, url, { siteRef, title: child });

        if (linkE === undefined) {
            continue;
        }

        // log('[applyLinks]', 'found', url, linkE.id );

        // add a link dependency
        let depId = await insertDependency(es, e.id, linkE.id, 'link');

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }

        const type = linkE.Src !== undefined ? 'internal' : 'external';

        linkIndex.index.set(linkUrl, [linkE.id, type, child]);

        // find an entity
        // if( url.startsWith('file://') ){
        // file:///file:///pages/main.mdx - ref to File component
        // e://component/file?uri=file:///pages/main.mdx - address an entity
        // https://news.bbc.co.uk/ - external
        // }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));


    return e;
}
