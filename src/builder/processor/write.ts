import { Site } from "../site";
import { Component, getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { getDstUrl, selectTextWithDst } from '../query';

const log = (...args) => console.log('[ProcWrite]', ...args);


/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options:ProcessOptions = {}) {
    const es = site.es;

    const coms = await selectTextWithDst(es);
    // log('eids', eids);

    for( const com of coms ){
        const eid = getComponentEntityId(com);
        const dst = await getDstUrl(es, eid);
        
        let path = site.getDstUrl( dst );
        // log('com', com);

        await site.writeToUrl( path, com.data );
    }

    return site;
}
