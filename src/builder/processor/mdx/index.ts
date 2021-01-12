


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { PageLinks, TranspileMeta, TranspileProps, TranspileResult } from './types';
import { Site } from '../../ecs';

import { transpile } from './transpile';
import { html } from "js-beautify";



const log = (...args) => console.log('[ProcMDX]', ...args);



/**
 * Compiles .mdx to html
 * 
 * @param es 
 */
export async function process(site: Site, es: EntitySet = undefined) {
    es = es ?? site.es;
    const siteEntity = site.getSite();

    // select scss entities
    let ents = await selectMdx(es);
    let output: Entity[] = [];

    // first pass at parsing the mdx - pulling out links, local meta etc
    for (const e of ents) {
        output.push(await preProcessMdx(es, e));
    }
    await es.add(output);


    // second pass - resolving meta with dependencies
    ents = await selectMdx(es);
    output = [];
    
    for (const e of ents) {
        output.push(await resolveMeta(es, e));
    }
    await es.add(output);


    // final pass - rendering the mdx into text
    ents = await selectMdx(es);
    output = [];

    for (const e of ents) {
        output.push(await renderMdx(es, e));
    }

    await es.add(output);

    
    return es; //await es.add( output );
}


function buildProps( e:Entity ){
    let data = e.Mdx.data;
    let eMeta = e.Meta?.meta ?? {};
    let path = e.File?.uri ?? '';
    let props:TranspileProps = { path, data, meta:eMeta };

    return props;
}

/**
 * Pulls data from and prepares the mdx for rendering
 * 
 * @param es 
 * @param e 
 */
async function preProcessMdx(es: EntitySet, e: Entity) {

    try {
        let props = buildProps( e );
        let result = await transpile(props, { render: false });

        const { meta } = result;
        // const { isEnabled } = meta;

        // log('[preProcessMdx]', props.path, meta, props.meta);

        // if( isEnabled === false ){
        //     return e;
        // }

        // clear out empty/undefined values
        // Object.keys(meta).forEach((k) => meta[k] == null && delete meta[k]);

        let cMeta = e.Meta?.meta ?? {};
        e.Meta = { meta:{...cMeta, ...meta} };

        e = applyTitle(es, e, meta);
        e = await applyLayout(es, e, meta);

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


async function renderMdx(es: EntitySet, e: Entity, child?: TranspileResult): Promise<Entity> {


    try {
        let result = await renderEntity(es, e);

        const { html, meta } = result;
        const { isEnabled, isRenderable } = meta;

        if( isEnabled === false ){
            return e;
        }

        // log('[renderMdx]', e.File.uri, meta);

        // if( isRenderable !== false ){
            e.Text = { data: html };
        // }

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


async function renderEntity(es: EntitySet, src: Entity, child?: TranspileResult) {
    let props = buildProps( src );

    if (child !== undefined) {
        props.children = child.component;
    }

    
    let result = await transpile(props, { render: true });
    
    // log('[renderEntity]', src.File.uri, result.meta );

    result = await renderLayoutEntity(es, src, result);

    return result;
}

async function renderLayoutEntity(es: EntitySet, src: Entity, child: TranspileResult) {
    if (child === undefined || child.meta.layout === undefined) {
        return child;
    }

    const layoutE = await getLayoutFromDependency(es, src.id);

    // log('[renderLayoutEntity]', 'returned', layoutEid, 'for', src.id );

    // log('[renderLayoutEntity]', layoutE.File.uri );

    if (layoutE === undefined) {
        return child;
    }

    // log('[renderLayoutEntity]', layoutE);

    return await renderEntity(es, layoutE, child);
}


async function resolveMeta( es:EntitySet, e:Entity ){
    // log('[resolveMeta]', e.id);
    let meta = await selectDependencyMeta(es, e.id);

    e.Meta = { meta };
    
    return e;
}


async function selectDependencyMeta( es:EntitySet, eid:EntityId ){
    const stmt = es.prepare(`

    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )
    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select

        // if the size of the select result is 0, then return 0
        size! 0 == [ drop false @! ] swap if
        pop!
        /dst pluck
        @>
    ] selectParentDir define

    [ // es eid -- es eid [meta]
        swap [ *^%1 @eid /component/meta !bf @c ] select 
        /meta pluck
        rot swap // rearrange exit vars
    ] selectMeta define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        // select meta
        selectMeta

        // add to result
        $result + result !
        
        selectParentDir
        


        // if no parent, stop execution
        dup [ drop @! ] swap false == if

        true // true
    ] loop
    // prints

    `);
    await stmt.run({ eid });

    let metaList = stmt.getValue('result');

    // merge the meta - ignore keys with undefined values
    metaList = metaList.reduce( (r,meta) => {
        for( const [key,val] of Object.entries(meta) ){
            if( val !== undefined ){
                r[key] = val;
            }
        }
        return r; //{...r, ...meta};
    }, {} );

    // log('dirCom', metaList );
    return metaList;
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
        await removeLayoutDependency(es, e.id);
        return e;
    }

    const siteRef = e.SiteRef?.ref;

    // log('[applyLayout]', e.File.uri, {layout} );

    // find the entity matching the layout
    const layoutEid = await findEntityByFileUri(es, layout, { siteRef });

    // log('[applyLayout]', 'found', layoutEid);

    // add a dependency from this entity to the layout entity
    if (layoutEid !== undefined) {
        await insertLayoutDependency(es, e.id, layoutEid);
    }

    return e;
}



async function insertLayoutDependency(es: EntitySet, eid: EntityId, leid: EntityId) {
    const layoutEid = await getLayoutDependency(es, eid);
    if (layoutEid !== undefined) {
        return layoutEid;
    }

    let e = es.createEntity();
    e.Dep = { src: eid, dst: leid, type: 'layout' };
    await es.add(e);
    let reid = es.getUpdatedEntities()[0];
    return reid;
}

async function removeLayoutDependency(es: EntitySet, eid: EntityId) {
    const layoutEid = await getLayoutDependency(es, eid);
    if (layoutEid === undefined) {
        return false;
    }
    await es.removeEntity(layoutEid);
    return true;
}


/**
 *  
 */
async function getLayoutDependency(es: EntitySet, eid: EntityId): Promise<EntityId> {
    const stmt = es.prepare(`
    [
        /component/dep#type !ca "layout" ==
        /component/dep#src !ca ${eid} ==
        and
        @eid
    ] select
    `);
    const depId = await stmt.getResult({ eid });
    return depId.length > 0 ? depId[0] : undefined;
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


interface FindEntityOptions {
    siteRef?: EntityId;
}

async function findEntityByFileUri(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<EntityId> {
    const ref = options.siteRef ?? 0;

    const query = `
    // compose the RE
    ["^.*://"] $path + ".*" + "" join !r
    // make sure the ES is before the select
    swap
    [
        /component/site_ref#ref !ca $ref ==
        /component/file#uri !ca *^$1 ==
        and
        @eid
    ] select`;

    const stmt = es.prepare(query);
    const r = await stmt.getResult({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}


export async function selectMdx(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/mdx !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}

