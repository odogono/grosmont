import Fs from 'fs-extra';
import { Component, getComponentEntityId, setEntityId, toComponentId } from "odgn-entity/src/component";
import { getDefId } from "odgn-entity/src/component_def";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { slugify } from "../../util/string";

import { Site } from "../site";
import { ProcessOptions } from "../types";
import { createTimes, insertDependency, FindEntityOptions } from "../util";
import { getDstUrl } from './dst_url';

const log = (...args) => console.log('[ProcDstIndex]', ...args);


export interface DstIndexOptions extends ProcessOptions {
    loadData?: boolean;
}

/**
 * Builds an index of dst urls for each entity which has a /dst and a /text
 * component
 * 
 * 
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:DstIndexOptions = {}) {
    const es = site.es;

    const dstIndex = site.getIndex('/index/dstUrl', true);
    const eids = await select(es);

    for( const eid of eids ){
        const url = await getDstUrl(es, eid);
        dstIndex.index.set(url, [eid]);
    }

    // return await site.addQueryIndex('/index/srcUrl', query, { ref: siteEntity.id });

    return site;
}


export async function select(es: EntitySet): Promise<EntityId[]> {

    const q = `
        [ [ /component/dst /component/text ] !bf @eid] select
    `;

    const stmt = es.prepare(q);
    return await stmt.getResult();
}