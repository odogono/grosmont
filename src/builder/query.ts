import Path from 'path';
import { Component, getComponentEntityId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { slugify } from "../util/string";
import { Site } from "./site";
import { uriToPath } from './util';
import { ProcessOptions } from './types';
import { parseUri } from '../util/uri';
import { BitField } from 'odgn-entity/src/util/bitfield';



export async function selectTagBySlug( site:Site, name:string ){
    const slug = slugify(name);
    const {es,e} = site;

    const stmt = es.prepare(`
    [
        /component/tag#slug !ca $slug ==
        /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select
    `);

    return await stmt.getEntity({ref:e.id, slug});
}



export async function findEntitiesByTags(es: EntitySet, tags: string[], options: FindEntityOptions = {}): Promise<EntityId[]> {
    const ref = options.siteRef ?? 0;

    const q = `
    [
        $es [
            /component/tag#slug !ca *^$1 ==
            /component/site_ref#ref !ca $ref ==
            and
            @eid 
        ] select swap drop
        [ drop false @! ] swap size 0 == rot swap if
        pop!
        @>
    ] selectTagBySlug define

    [
        
        $es [
            /component/dep#dst !ca *^$1 ==
            @eid /component/dep#src @ca
        ] select swap drop
        [ drop false @! ] swap size 0 == rot swap if
        pop!
        @>
    ] selectTagDepByDst define

    es let
    $tags *selectTagBySlug map
    [ false != ] filter

    *selectTagDepByDst map

    unique // get rid of dupes

    // prints
    // []
    `;

    const stmt = es.prepare(q);
    return await stmt.getResult({ ref, tags });
}



export async function selectMeta( site:Site ){
    const {es} = site;


    const stmt = es.prepare(`
    [
        /component/site_ref#ref !ca $ref ==
        /component/meta !bf
        // [/component/meta /component/upd] !bf
        // and
        @c
    ] select
    `);

    return await stmt.getResult({ref:site.e.id});
}


export async function selectMetaDisabled(es: EntitySet): Promise<EntityId[]> {
    const stmt = es.prepare(`[
        /component/enabled#is !ca false ==
        // /component/meta#/meta/isEnabled !ca false ==
        @eid
    ] select`);

    return await stmt.getResult();
}


export async function selectMdx(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/mdx !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}




export async function selectMdxSrc(es: EntitySet, options: FindEntityOptions = {}) {
    const ref = options.siteRef ?? 0;

    const stmt = es.prepare(`[
        /component/src#url !ca ~r/.mdx$/ ==
        /component/src !bf
        @c
    ] select`);

    return await stmt.getResult({ ref });
}

export async function selectDstTextIds(es: EntitySet): Promise<EntityId[]> {

    const q = `
        [ [ /component/dst /component/text ] !bf @eid] select
    `;

    const stmt = es.prepare(q);
    return await stmt.getResult();
}



export interface FindEntityOptions {
    siteRef?: EntityId;
    title?: string;
}

export async function findEntityBySrcUrl(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<EntityId> {
    const ref = options.siteRef ?? 0;

    // convert to an extension-less path
    path = uriToPath(path);
    const ext = Path.extname(path);
    path = path.substring(0, path.length - ext.length);
    // log('[findEntityBySrcUrl]', path,  );

    const query = `
    // compose the RE
    ["^.*://"] $path + ".*" + "" join !r

    // make sure the ES is before the select
    swap
    [
        /component/site_ref#ref !ca $ref ==
        /component/src#url !ca *^$1 ==
        // /component/src#url !ca $path ==
        and
        @eid
    ] select`;

    const stmt = es.prepare(query);
    const r = await stmt.getResult({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}


export async function getEntityBySrcUrl(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<Entity> {
    const ref = options.siteRef ?? 0;

    const query = `
    [
        /component/site_ref#ref !ca $ref ==
        /component/src#url !ca $path ==
        and
        @e
    ] select`;

    const stmt = es.prepare(query);
    const r = await stmt.getEntities({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}




/**
 * 
 * 
 */
export async function findEntityByUrl(es: EntitySet, url: string, options: FindEntityOptions = {}): Promise<Entity> {

    // file:///file:///pages/main.mdx - ref to File component
    // e://component/file?uri=file:///pages/main.mdx - address an entity
    // https://news.bbc.co.uk/ - external

    if (url.startsWith('/')) {
        const eid = await findEntityBySrcUrl(es, url, options);
        return eid !== undefined ? await es.getEntity(eid) : undefined;
    }

    let { protocol, host, path, anchor: attr, queryKey } = parseUri(url);

    if (protocol === 'file') {
        return await getEntityBySrcUrl(es, url, options);
    }

    if (protocol === 'https' || protocol === 'http') {
        // const cUrl = `${protocol}://${host}${path}`;
        let e = await getEntityByUrl(es, url);
        if (e === undefined) {
            e = es.createEntity();
            e.Url = { url };
            if (options.title) {
                e.Title = { title: options.title };
            }
            await es.add(e);
            let eid = es.getUpdatedEntities()[0];
            return await es.getEntity(eid, true);
        }
        return e;
    }

    // log('[findEntityByUrl]', { protocol, host, path, queryKey });

    return undefined;
}


export async function getEntityByUrl(es: EntitySet, url: string) {
    const stmt = es.prepare(`
    [
        /component/url#url !ca $url ==
        @e
    ] select
    `);
    const r = await stmt.getEntities({ url });
    return r.length > 0 ? r[0] : undefined;
}




export async function buildSrcIndex(site: Site) {
    // let es = site.es;
    const siteEntity = site.getSite();

    // select entities with /component/file AND /component/text (eg. have been rendered)
    const query = `

    [
        /component/site_ref#ref !ca $ref ==
        /component/src !bf
        and
        @e
    ] select
    [ /component/src#url /id /component/meta#/meta/mime ] pluck
    `;

    return await site.addQueryIndex('/index/srcUrl', query, { ref: siteEntity.id });
}


export async function buildSrcUrlIndex(es: EntitySet): Promise<[string, EntityId, string, BitField][]> {
    const query = `
    [ [/component/src /component/times] !bf @e ] select
    [ /component/src#/url /id /component/times#/mtime /bitField ] pluck!
    `
    const stmt = es.prepare(query);
    let result = await stmt.getResult();
    if (result.length === 0) {
        return result;
    }
    // make sure we have an array of array
    return Array.isArray(result[0]) ? result : [result];
}


/**
 * Selects /component/src which have a file:// url
 * 
 * @param es 
 */
export async function selectFileSrc(es: EntitySet, options: ProcessOptions = {}): Promise<Component[]> {
    const onlyUpdated = options.onlyUpdated ?? false;

    const q = onlyUpdated ? `[
        /component/upd#op !ca 2 ==
        /component/upd#op !ca 1 ==
        or
        /component/src#url !ca ~r/^file\:\/\// ==
        and
        /component/src !bf
        @c
    ] select`
        : `[
            /component/src#url !ca ~r/^file\:\/\// ==
            /component/src !bf
            @c
        ] select
        `;

    const stmt = es.prepare(q);

    return await stmt.getResult();
}


export async function selectComponentByUrl(es: EntitySet, url: string): Promise<Component> {
    const stmt = es.prepare(`[
        /component/src#url !ca $url ==
        /component/src !bf
        @c
    ] select`);

    let res = await stmt.getResult({ url });
    return res.length > 0 ? res[0] : undefined;
}


/**
 * Inserts a Dependency Entity if one does not already exist
 * @param es 
 * @param src 
 * @param dst 
 * @param type 
 */
export async function insertDependency(es: EntitySet, src: EntityId, dst: EntityId, type: string): Promise<EntityId> {
    if( src === 0 || dst === 0 ){
        return 0;
    }
    
    let depCom = await getDependencyComponent(es, src, dst, type);

    // const layoutEid = await getDependency(es, src, type);
    if (depCom !== undefined) {
        return getComponentEntityId(depCom);
    }

    let e = es.createEntity();
    e.Dep = { src, dst, type };
    await es.add(e);
    let reid = es.getUpdatedEntities()[0];
    return reid;
}

/**
 * Removes a dependency entity
 * 
 * @param es 
 * @param eid 
 * @param type 
 */
export async function removeDependency(es: EntitySet, eid: EntityId, type: string) {
    const dstEid = await getDependency(es, eid, type);
    if (dstEid === undefined) {
        return false;
    }
    await es.removeEntity(dstEid);
    return true;
}




/**
 * Selects a dependency entity
 */
export async function selectDependency(es: EntitySet, src?: EntityId, dst?: EntityId, type?: string, asEntity: boolean = false) {
    // const did:ComponentDefId = es.resolveComponentDefId('/component/dep');

    let conds = [];
    if (src !== undefined) {
        conds.push(`/component/dep#src !ca ${src} ==`);
    }
    if (dst !== undefined) {
        conds.push(`/component/dep#dst !ca ${dst} ==`);
    }
    if (conds.length === 2) { conds.push('and'); }
    if (type !== undefined) {
        conds.push(`/component/dep#type !ca ${type} ==`);
    }
    if (conds.length >= 2) { conds.push('and'); }

    if (asEntity) {
        let query = `[
            /component/dep !bf
            ${conds.join('\n')}
            @c
        ] select`;
        let stack = await es.query(query);
        return stack.popValue() as unknown as Component[];
    }

    let query = `[
        /component/dep !bf
        ${conds.join('\n')}
        @c
    ] select`;

    let out = await es.queryEntities(query);

    return out;
}



/**
 *  
 */
export async function getDependency(es: EntitySet, eid: EntityId, type: string): Promise<EntityId> {
    const depId = await getDependencies(es, eid, type);
    return depId.length > 0 ? depId[0] : undefined;
}



/**
 * - select entity ids that are marked as updated
 * - for each eid, select /deps which have matching dst
 * - take the src eids, add upd coms with same op
 * - take the src eids add to update list
 * @param site 
 */
export async function applyUpdatesToDependencies(site:Site){
    const stmt = site.es.prepare(`

        [
            $es [ /component/upd !bf @c ] select
            [ /@e /op ] pluck!
        ] selectUpdates define

        // selects /dep which match the eid and returns the src
        // es eid -- es [ eid ]
        [
            swap [ 
                /component/dep#dst !ca *^$1 ==
                /component/dep#src @ca 
            ] select
        ] selectDepSrc define

        // adds the op to each of the eids
        // eids op -- [ eid, op ]
        [
            swap [ [] + *^%0 + ] map
            swap drop
        ] applyOp define

        // adds a /upd to the e
        // [eid,op] -- 
        [
            spread
            [ op *^$0 @e *^$0 ] eval to_map
            [] /component/upd + swap + $es swap !c + drop
        ] addUpdCom define


        // set the es as a word - makes easier to reference
        es let

        selectUpdates
        
        [ @! ] swap size 0 == rot swap if
        
        [
            pop?
            spread swap // op eid
            *$3 swap // pull the es to the top
            
            selectDepSrc
            rot applyOp
            
            // add upd coms to each e
            dup
            **addUpdCom map drop
            
            // add the result to the list
            rot swap +
            // continue to loop while there are still eids
            size 0 !=
        ] loop
    `);

    await stmt.run();

    return site;
}


/**
 * Returns an array of Meta starting at the eid and working up the dir dependencies
 */
export async function selectDependencyMeta(es: EntitySet, eid: EntityId) {
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
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck!
        @>
    ] selectParent define

    [ // es eid -- es eid [meta]
        swap [ *^%1 @eid /component/meta !bf @c ] select 
        /meta pluck!
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
        
        selectParent
        
        // if no parent, stop execution
        dup [ drop @! ] swap false == if

        true // true
    ] loop
    // prints

    `);
    await stmt.run({ eid });

    let metaList = stmt.getValue('result');

    return metaList;
}

/**
 * Returns an array of the parent ids of this dependency
 * 
 * @param es EntitySet
 * @param eid EntityId
 * @param type string
 */
export async function getDependencyParents(es: EntitySet, eid: EntityId, type: string): Promise<EntityId[]> {
    const stmt = es.prepare(`
    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )
    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca $type ==
            and
            @c
        ] select

        // if the size of the select result is 0, then return false
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck!
        @>
    ] selectParent define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        selectParent

        
        // if no parent, stop execution
        dup [ drop @! ] swap false == if
        
        // add to result
        dup $result + result !
        // prints
        
        true // loop
    ] loop
    $result
    `);
    return await stmt.getResult({ eid, type });
}

/**
 * Returns an array of eids which are children of the specified eid by type.
 * 
 * @param es 
 * @param eid 
 * @param type 
 * @param depth 
 */
export async function getDependencyChildren(es: EntitySet, eid: EntityId, type: string, depth: number = 100): Promise<EntityId[]> {
    const stmt = es.prepare(`

    // selects child ids of the e, or false if none found
    [
        $es [
            /component/dep !bf
            /component/dep#dst !ca *^$1 ==
            /component/dep#type !ca $type ==
            and
            @c
        ] select
        
        // if the size of the select result is 0, then return false
        size 0 == [ drop false @! ] swap if
        /src pluck!
        
        @>
        swap drop // drop the es
    ] selectChildren define
    
    es let
    [] result let
    [] $eid +
    [
        [] [ swap *selectChildren + ] reduce
        [ false != ] filter
        
        // if no children, stop
        dup [ drop @! ] swap size! 0 == if

        // add to result
        dup $result swap + result !
        
        1 $depth - depth !
        
        0 $depth > // loop
    ] loop
    $result
    `);

    return await stmt.getResult({ eid, type, depth });
}


export async function getDependencies(es: EntitySet, eid: EntityId, type: string): Promise<EntityId[]> {
    const stmt = es.prepare(`
    [
        /component/dep#type !ca ${type} ==
        /component/dep#src !ca ${eid} ==
        and
        @eid
    ] select
    `);
    return await stmt.getResult({ eid, type });
}

export async function getDependencyEntities(es: EntitySet, eid: EntityId, type: string): Promise<Entity[]> {
    const stmt = es.prepare(`
    [
        /component/dep#type !ca ${type} ==
        /component/dep#src !ca ${eid} ==
        and
        @e
    ] select
    `);
    return await stmt.getResult({ eid, type });
}

export async function getDependencyComponent(es: EntitySet, src: EntityId, dst: EntityId, type: string): Promise<Component> {
    const stmt = es.prepare(`
    [
        /component/dep#src !ca ${src} ==
        /component/dep#dst !ca ${dst} ==
        and
        /component/dep#type !ca ${type} ==
        and
        /component/dep !bf
        @c
    ] select
    `);
    const result = await stmt.getResult({ src, dst, type });
    return result.length > 0 ? result[0] : undefined;
}


export async function getDependencyComponents(es: EntitySet, eid: EntityId, type: string): Promise<Component[]> {
    const stmt = es.prepare(`
    [
        /component/dep#type !ca ${type} ==
        /component/dep#src !ca ${eid} ==
        and
        @c
    ] select
    `);
    return await stmt.getResult({ eid, type });
}