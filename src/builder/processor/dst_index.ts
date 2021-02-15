import { getDstUrl, selectDstTextIds } from '../query';

import { Site } from "../site";
import { ProcessOptions } from "../types";

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
    const eids = await selectDstTextIds(es);

    for( const eid of eids ){
        const url = await getDstUrl(es, eid);
        dstIndex.index.set(url, [eid]);
    }

    // return await site.addQueryIndex('/index/srcUrl', query, { ref: siteEntity.id });

    return site;
}

