


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { PageLink, PageLinks, TranspileMeta, TranspileProps, TranspileResult } from './types';
import { Site, SiteIndex } from '../../ecs';

import { transpile } from './transpile';
import { html } from "js-beautify";
import { buildQueryString, buildUrl, parseUri } from "../../../util/uri";
import {
    applyMeta,
    getDependencies,
    getDependencyEntities,
    findEntityByFileUri,
    findEntityByUrl,
    insertDependency,
    removeDependency,
    selectDependencyMeta,
} from "../../util";
import { toInteger } from "odgn-entity/src/util/to";
import { selectTargetPath } from "../target_path";
import { toComponentId } from "odgn-entity/src/component";



const log = (...args) => console.log('[ProcMDX]', ...args);



/**
 * Compiles .mdx
 * 
 * @param es 
 */
export async function process(site: Site, es: EntitySet = undefined) {
    es = es ?? site.es;

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


    // second pass - resolving meta with dependencies
    ents = await selectMdx(es);
    output = [];

    for (const e of ents) {
        output.push(await resolveMeta(es, e));
    }
    await es.add(output);


    // resolve linkIndex
    const pageLinks = await buildPageLinks(es, linkIndex );
    

    // final pass - rendering the mdx into text
    ents = await selectMdx(es);
    output = [];

    for (const e of ents) {
        output.push(await renderMdx(es, e, undefined, { fileIndex, pageLinks }));
    }

    await es.add(output);


    return es; //await es.add( output );
}


async function buildPageLinks( es:EntitySet, linkIndex:SiteIndex ){
    let result:PageLinks = new Map<string,PageLink>();

    
    for( const [url, [eid,type,child]] of linkIndex.index ){
        if( type === 'external' ){
            result.set(url, {url});
        } else {
            let path = await selectTargetPath(es, eid);
            result.set(url, {url:path});
        }
    }
    // log('[buildPageLinks]', linkIndex.index);
    // log('[buildPageLinks]', result);

    return result;
}


function buildProps(e: Entity): TranspileProps {
    let data = e.Mdx.data;
    let eMeta = e.Meta?.meta ?? {};
    let path = e.File?.uri ?? '';
    let props: TranspileProps = { path, data, meta: eMeta };

    return props;
}


async function buildFileIndex(site: Site) {
    // let es = site.es;
    const siteEntity = site.getSite();

    // let files = await selectFiles(es, siteEntity.id);

    // select entities with /component/file AND /component/text (eg. have been rendered)
    const query = `[
        /component/site_ref#ref !ca $ref ==
        [/component/file /component/text /component/meta] !bf
        and
        @e
    ] select

    [ /component/file#uri /id /component/meta#/meta/mime ] pluck

    `;

    return await site.addQueryIndex('/index/fileUri', query, { ref: siteEntity.id });
}




interface ProcessOptions {
    fileIndex: SiteIndex;
    linkIndex?: SiteIndex;
    pageLinks?: PageLinks;
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

        e = applyTitle(es, e, meta);

        e = await applyLayout(es, e, meta);

        e = await applyCSSLinks(es, e, result);

        e = await applyLinks(es, e, result, options);

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


async function renderMdx(es: EntitySet, e: Entity, child: TranspileResult, options: ProcessOptions): Promise<Entity> {


    try {
        let result = await renderEntity(es, e, undefined, options);

        const { html, meta } = result;
        const { isEnabled, isRenderable } = meta;

        if (isEnabled === false) {
            return e;
        }

        // log('[renderMdx]', e.File.uri, meta);

        // if( isRenderable !== false ){
        e.Text = { data: html, mime: 'text/html' };
        // }

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


async function renderEntity(es: EntitySet, src: Entity, child: TranspileResult, options: ProcessOptions) {
    const { fileIndex } = options;
    const resolveImport = (path: string) => getEntityImportUrlFromPath(fileIndex, path);

    let props = buildProps(src);

    if (child !== undefined) {
        props.children = child.component;
    }

    props.applyLinks = options.pageLinks;

    props = await applyCSSDependencies(es, src, child, props);

    // props = await applyLinkDependencies(es, src, child, props, options);

    // props.css = css;
    // props.cssLinks = cssLinks;


    let result = await transpile(props, { render: true, resolveImport });

    // log('[renderEntity]', src.File.uri, result );
    result.css = props.css;
    result.cssLinks = props.cssLinks;

    result = await renderLayoutEntity(es, src, result, options);

    return result;
}

async function renderLayoutEntity(es: EntitySet, src: Entity, child: TranspileResult, options: ProcessOptions) {
    if (child === undefined || child.meta.layout === undefined) {
        return child;
    }

    const layoutE = await getLayoutFromDependency(es, src.id);

    // log('[renderLayoutEntity]', 'returned', layoutEid, 'for', src.id );

    // log('[renderLayoutEntity]', layoutE.File.uri );

    if (layoutE === undefined) {
        return child;
    }

    // log('[renderLayoutEntity]', 'child', child);

    return await renderEntity(es, layoutE, child, options);
}


// async function applyLinkDependencies(es: EntitySet, e: Entity, child: TranspileResult, props: TranspileProps, options:ProcessOptions): Promise<TranspileProps> {

//     const {linkIndex} = options;

//     log('[applyLinkDependencies]', linkIndex);

//     for( const [ url, [eid]] of linkIndex.index ){

//     }

//     // in the first pass, links are collected and resolved to an entity
//     // an index is built from the original link url to a record of the entity and a type (file,external)
//     // applyLinks are built from the index and passed into the render
    

//     return props;
// }

async function applyCSSDependencies(es: EntitySet, e: Entity, child: TranspileResult, props: TranspileProps): Promise<TranspileProps> {
    // build css links and content from deps
    const cssEntries = await getEntityCSSDependencies(es, e);

    if (cssEntries === undefined) {
        return props;
    }


    // log('[renderEntity]', src.id, child );
    let css = cssEntries.map(ent => ent.text).join('\n');
    let cssLinks = cssEntries.map(ent => ent.path);
    if (child !== undefined) {
        css = css + ' ' + child.css;
        cssLinks = [...cssLinks, ...child.cssLinks];
    }
    return { ...props, css, cssLinks };
}


async function resolveMeta(es: EntitySet, e: Entity) {
    // log('[resolveMeta]', e.id);
    let meta = await selectDependencyMeta(es, e.id);

    e.Meta = { meta };

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


async function getLayoutFromDependency(es: EntitySet, eid: EntityId): Promise<Entity> {
    // eid = 0;
    const stmt = es.prepare(`
    [
        /component/dep#src !ca ${eid} ==
        /component/dep#type !ca "layout" ==
        and
        @c
    ] select
    /dst pluck

    // exit with undefined if nothing was found
    dup [ undefined @! ] swap [] == if

    // select the entity
    swap [ *^$1 @e ] select
    `);
    return await stmt.getResult({ eid });
}



export async function selectMdx(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/mdx !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}

/**
 * Returns a url pointing to the value to import from a file path
 * 
 * @param fileIndex 
 * @param path 
 */
function getEntityImportUrlFromPath(fileIndex: SiteIndex, path: string) {
    if (fileIndex === undefined || path == '') {
        return undefined;
    }
    const entry = fileIndex.index.get(path);
    if (entry === undefined) {
        return undefined;
    }
    const [eid, mime] = entry;
    return buildUrl(`e://${eid}/component/text`, { mime }) + '#text';
}



async function getEntityCSSDependencies(es: EntitySet, e: Entity) {
    const cssDeps = await getDependencyEntities(es, e.id, 'css');
    if (cssDeps === undefined || cssDeps.length === 0) {
        return undefined;
    }

    const did = es.resolveComponentDefId('/component/text');
    let result = [];

    for (const dep of cssDeps) {
        const { src, dst } = dep.Dep;
        let path = await selectTargetPath(es, dst);

        // log('[getEntityCSSDependencies]', dst, did);
        const com = await es.getComponent(toComponentId(dst, did));

        result.push({ path, text: com.data });
    }

    return result;
}