import { Component, getComponentEntityId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { log } from "util";


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
