import { Component, getComponentEntityId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { parseUri } from "../util/uri";


const log = (...args) => console.log('[ProcUtils]', ...args);


export function applyMeta( e:Entity, data:any ):Entity {
    let meta = e.Meta?.meta ?? {};
    meta = {...meta, ...data};
    e.Meta = {meta};
    return e;
}





export async function insertDependency(es: EntitySet, src: EntityId, dst: EntityId, type:string) {
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



interface FindEntityOptions {
    siteRef?: EntityId;
    title?: string;
}

export async function findEntityByFileUri(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<EntityId> {
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



/**
 * 
 * 
 */
export async function findEntityByUrl(es: EntitySet, url:string, options: FindEntityOptions = {}): Promise<Entity> {

    // file:///file:///pages/main.mdx - ref to File component
    // e://component/file?uri=file:///pages/main.mdx - address an entity
    // https://news.bbc.co.uk/ - external

    if( url.startsWith('/') ){
        const eid = await findEntityByFileUri(es, url, options);
        return eid !== undefined ? await es.getEntity(eid) : undefined;
    }

    let { protocol, host, path, anchor: attr, queryKey } = parseUri(url);

    if( protocol === 'file' ){
        return await getEntityByFileUri( es, url, options );
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


/**
 *  e://component/file?uri=file:///pages/main.mdx - address an entity
 */
async function findEntityByEntityUrl(es:EntitySet, url:string){

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



export async function getEntityByFileUri(es: EntitySet, path: string, options: FindEntityOptions = {}): Promise<Entity> {
    const ref = options.siteRef ?? 0;

    const query = `
    [
        /component/site_ref#ref !ca $ref ==
        /component/file#uri !ca $path ==
        and
        @e
    ] select`;

    const stmt = es.prepare(query);
    const r = await stmt.getEntities({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}




