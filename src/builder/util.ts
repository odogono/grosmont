import { Entity } from "odgn-entity/src/entity";


export function applyMeta( e:Entity, data:any ):Entity {
    let meta = e.Meta?.meta ?? {};
    meta = {...meta, ...data};
    e.Meta = {meta};
    return e;
}