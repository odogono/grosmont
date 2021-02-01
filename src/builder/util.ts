import Path from 'path';
import { Component, getComponentEntityId, toComponentId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { BitField, get as bfGet } from "odgn-entity/src/util/bitfield";
import { parseUri } from "../util/uri";
import Day from 'dayjs';
import { ProcessOptions } from './types';
import { isString } from '../util/is';

const log = (...args) => console.log('[ProcUtils]', ...args);


export function applyMeta( e:Entity, data:any ):Entity {
    let meta = e.Meta?.meta ?? {};
    // log('existing meta', meta, 'new', data);
    meta = mergeMeta( [meta, data] );
    // meta = {...meta, ...data};
    e.Meta = {meta};
    return e;
}


/**
 * Merges an array of meta into a single value
 * 
 * @param metaList 
 */
export function mergeMeta(metaList: any[]) {
    // merge the meta - ignore keys with undefined values
    return metaList.reduce((r, meta) => {
        for (const [key, val] of Object.entries(meta)) {
            if (val !== undefined) {
                if( key === 'tags' ){
                    let pre = Array.isArray(r[key]) ? r[key] : [];
                    if( isString(val) ){
                        r[key] = [ ...pre, val ];
                    } else if( Array.isArray(val) ){
                        r[key] = [ ...pre, ...val ];
                    }
                    
                } else {
                    r[key] = val;
                }
            }
        }
        return r;
    }, {});
}


/**
 * Returns all entities populated with components
 * @param ctx 
 */
export function selectAll(es: EntitySet): Entity[] {
    if( es instanceof EntitySetMem ){
        return es.getEntitiesByIdMem(true, { populate: true });
    }
    return [];
}

export function printAll(es: EntitySetMem, ents?: Entity[], dids?:string[]) {
    let result = ents || selectAll(es);
    for (const e of result) {
        printEntity(es, e, dids);
    }
}

// export async function printQuery(ctx: SiteContext, q: string) {
//     let result = await ctx.es.queryEntities(q);
//     for (const e of result) {
//         printEntity(ctx.es, e);
//     }
// }

export function printEntity(es: EntitySet, e: Entity, dids?:string[]) {
    let bf:BitField;
    if( es === undefined || e === undefined ){
        console.log('(undefined e)');
        return;
    }
    if( dids !== undefined ){
        bf = es.resolveComponentDefIds(dids);
    }
    console.log(`- e(${e.id})`);
    for (const [did, com] of e.components) {
        if( bf && bfGet(bf,did) === false ){
            continue;
        }
        const { '@e': eid, '@d': _did, ...rest } = com;
        const def = es.getByDefId(did);
        console.log(`   ${def.name}`, JSON.stringify(rest));
    }
}

export async function insertDependency(es: EntitySet, src: EntityId, dst: EntityId, type:string): Promise<EntityId> {
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

export async function removeDependency(es: EntitySet, eid: EntityId, type:string) {
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
 * Returns an array of the parent ids of this dependency
 * 
 * @param es EntitySet
 * @param eid EntityId
 * @param type string
 */
export async function getDependencyParents(es:EntitySet, eid:EntityId, type:string):Promise<EntityId[]> {
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
        /dst pluck
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
    return await stmt.getResult({eid, type});
}

/**
 * Returns an array of eids which are children of the specified eid by type.
 * 
 * @param es 
 * @param eid 
 * @param type 
 * @param depth 
 */
export async function getDependencyChildren(es:EntitySet, eid:EntityId, type:string, depth:number = 100):Promise<EntityId[]> {
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
        /src pluck
        
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

    return await stmt.getResult({eid, type, depth});
}

/**
 *  
 */
export async function getDependency(es: EntitySet, eid: EntityId, type:string): Promise<EntityId> {
    const depId = await getDependencies(es,eid,type);
    return depId.length > 0 ? depId[0] : undefined;
}

export async function getDependencies(es: EntitySet, eid: EntityId, type:string): Promise<EntityId[]> {
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

export async function getDependencyEntities(es: EntitySet, eid: EntityId, type:string): Promise<Entity[]> {
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

export async function getDependencyComponent(es: EntitySet, src: EntityId, dst:EntityId, type:string): Promise<Component> {
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


export async function getDependencyComponents(es: EntitySet, eid: EntityId, type:string): Promise<Component[]> {
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



export interface FindEntityOptions {
    siteRef?: EntityId;
    title?: string;
}

export async function findEntityBySrcUrl(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<EntityId> {
    const ref = options.siteRef ?? 0;

    const query = `
    // compose the RE
    ["^.*://"] $path + ".*" + "" join !r
    // make sure the ES is before the select
    swap
    [
        /component/site_ref#ref !ca $ref ==
        /component/src#url !ca *^$1 ==
        and
        @eid
    ] select`;

    const stmt = es.prepare(query);
    const r = await stmt.getResult({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}




export async function findEntitiesByTags(es:EntitySet, tags:string[], options:FindEntityOptions = {}): Promise<EntityId[]> {
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
    return await stmt.getResult({ref,tags});
}


/**
 * 
 * 
 */
export async function findEntityByUrl(es: EntitySet, url:string, options: FindEntityOptions = {}): Promise<Entity> {

    // file:///file:///pages/main.mdx - ref to File component
    // e://component/file?uri=file:///pages/main.mdx - address an entity
    // https://news.bbc.co.uk/ - external

    if( url.startsWith('/') ){
        const eid = await findEntityBySrcUrl(es, url, options);
        return eid !== undefined ? await es.getEntity(eid) : undefined;
    }

    let { protocol, host, path, anchor: attr, queryKey } = parseUri(url);

    if( protocol === 'file' ){
        return await getEntityBySrcUrl( es, url, options );
    }

    if( protocol === 'https' || protocol === 'http' ){
        // const cUrl = `${protocol}://${host}${path}`;
        let e = await getEntityByUrl(es, url);
        if( e === undefined ){
            e = es.createEntity();
            e.Url = {url};
            if( options.title ){
                e.Title = { title:options.title };
            }
            await es.add( e );
            let eid = es.getUpdatedEntities()[0];
            return await es.getEntity(eid,true);
        }
        return e;
    }

    log('[findEntityByUrl]', {protocol, host,path, queryKey});

    return undefined;
}


async function getEntityByUrl(es:EntitySet, url:string){
    const stmt = es.prepare(`
    [
        /component/url#url !ca $url ==
        @e
    ] select
    `);
    const r = await stmt.getEntities({ url });
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




export async function getTimestamps( e:Entity ){
    if( e === undefined || e.Times === undefined ){
        return undefined;
    }
    let {ctime,mtime} = e.Times;

    return {
        ctime: new Date(ctime),
        mtime: new Date(mtime)
    }
}

/**
 * Returns true if the dates match
 */
export function isTimeSame( dateA:string|Date, dateB:string|Date ):boolean {
    return Day(dateA).isSame( Day(dateB), 'second' );
}


export function getParentDirectory(uri: string) {
    const result = Path.dirname(uri);
    return result.endsWith(Path.sep) ? result : result + Path.sep;
}


export async function selectMetaDisabled( es:EntitySet ): Promise<EntityId[]> {
    const stmt = es.prepare(`[
        /component/enabled#is !ca false ==
        // /component/meta#/meta/isEnabled !ca false ==
        @eid
    ] select`);

    return await stmt.getResult();
}


export async function selectSiteTargetUri( es:EntitySet, e:Entity ){
    if( e.Site !== undefined ){
        return e.Target !== undefined ? e.Target.uri : undefined;
    }
    if( e.SiteRef !== undefined ){
        const eid = e.SiteRef.ref;
        const did = es.resolveComponentDefId('/component/target');
        const com = await es.getComponent( toComponentId(eid,did) );
        return com !== undefined ? com.uri : undefined;
    }
    return undefined;
}


// /**
//  * 
//  * @param es 
//  * @param e 
//  */
// export async function fileUriToAbsolute( es:EntitySet, e:Entity ){
//     const rootPath = await selectSitePath( es, e.SiteRef.ref );
//     return joinPaths(rootPath, e.File.uri);
// }


/**
 * Selects /component/src which have a file:// url
 * 
 * @param es 
 */
export async function selectFileSrc(es: EntitySet, options:ProcessOptions = {}): Promise<Component[]> {
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


export function uriToPath(uri: string) {
    if (uri === undefined) {
        return '';
    }
    return uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
}

export function pathToUri(path: string) {
    if (path === undefined) {
        return undefined;
    }
    return path.startsWith('file://') ? path : 'file://' + path;
}

export function createTimes() {
    let time = new Date().toISOString();
    return { ctime:time, mtime:time };
}