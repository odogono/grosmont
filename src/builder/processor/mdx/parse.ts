


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { ProcessOptions, TranspileMeta, TranspileResult } from './types';
import { Site } from '../../ecs';

import { transpile } from './transpile';
import { parseUri } from "../../../util/uri";
import {
    applyMeta,
    getDependencies,
    findEntityByFileUri,
    findEntityByUrl,
    insertDependency,
    removeDependency,
} from "../../util";
import { toInteger } from "odgn-entity/src/util/to";
import { buildFileIndex, buildProps, getEntityImportUrlFromPath, selectMdx } from "./util";



const log = (...args) => console.log('[ProcMDXParse]', ...args);



/**
 * Takes /component/mdx and parses out meta data
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;

    // build an index of /file#uri
    let fileIndex = await buildFileIndex(site);
    let linkIndex = site.getIndex('/index/links', true);

    // select scss entities
    let ents = await selectMdx(es);
    let output: Entity[] = [];

    // first pass at parsing the mdx - pulling out links, local meta etc
    for (const e of ents) {
        output.push(await preProcessMdx(es, e, { fileIndex, linkIndex }));
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
async function preProcessMdx(es: EntitySet, e: Entity, options: ProcessOptions) {

    const { fileIndex } = options;
    const resolveImport = (path: string) => getEntityImportUrlFromPath(fileIndex, path);

    try {
        let props = buildProps(e);
        let result = await transpile(props, { render: false, resolveImport });

        const { meta } = result;
        // const { isEnabled } = meta;

        // log('[preProcessMdx]', props.path, meta, result);

        // if( isEnabled === false ){
        //     return e;
        // }

        // clear out empty/undefined values
        // Object.keys(meta).forEach((k) => meta[k] == null && delete meta[k]);

        e = applyMeta(e, { ...meta });

        // applies to /component/title
        e = applyTitle(es, e, meta);

        // adds a layout dependency if found
        e = await applyLayout(es, e, meta);

        // creates css dependencies
        e = await applyCSSLinks(es, e, result);

        // creates link dependencies and adds to the link
        // index for use at the point of rendering
        e = await applyLinks(es, e, result, options);

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


function applyTitle(es: EntitySet, e: Entity, result: TranspileMeta) {
    let { title, description, ...rest } = result;

    let com: any = {};
    if (title !== undefined) {
        com.title = title;
    }
    if (description !== undefined) {
        com.description = description;
    }
    if (Object.keys(com).length > 0) {
        e.Title = com;
    } else {
        e.Title = undefined;
    }

    return e;
}


async function applyLayout(es: EntitySet, e: Entity, result: TranspileMeta) {
    const { layout } = result;
    if (layout === undefined) {
        await removeDependency(es, e.id, 'layout');
        return e;
    }

    const siteRef = e.SiteRef?.ref;

    // log('[applyLayout]', e.File.uri, {layout} );

    // find the entity matching the layout
    const layoutEid = await findEntityByFileUri(es, layout, { siteRef });

    // log('[applyLayout]', 'found', layoutEid);

    // add a dependency from this entity to the layout entity
    if (layoutEid !== undefined) {
        await insertDependency(es, e.id, layoutEid, 'layout');
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
            // log('[applyCSSLinks]', eid, com, attr, queryKey, '=', path);

            // add a css dependency
            let depId = await insertDependency(es, e.id, eid, 'css');

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

    for (let [ linkUrl, { url, child }] of links) {

        const linkE = await findEntityByUrl(es, url, { siteRef, title:child });

        if (linkE === undefined) {
            continue;
        }

        // log('[applyLinks]', 'found', url, linkE.id );

        // add a link dependency
        let depId = await insertDependency(es, e.id, linkE.id, 'link');

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }

        const type = linkE.File !== undefined ? 'internal' : 'external';

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