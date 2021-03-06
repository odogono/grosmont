import { Site } from "../site";
import { Component, getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { getDstUrl, selectOutputWithDst } from '../query';
import { debug, error, info, setLocation } from "../reporter";
import { printEntity } from "odgn-entity/src/util/print";

const log = (...args) => console.log('[ProcWrite]', ...args);


/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, '/processor/write');

    const coms = await selectOutputWithDst(es, options);
    // log('eids', coms);

    for (const com of coms) {
        const eid = getComponentEntityId(com);
        try {

            const dst = await getDstUrl(es, eid);

            if( dst === undefined ){
                // cant write something which doesnt have a /dst
                // log('undefined dst',);
                // const e = await es.getEntity(eid);
                // printEntity(es, e);
                continue;
            }

            let path = site.getDstUrl(dst);


            // debug(reporter, `dst ${dst} path ${path}`, {eid});

            await site.writeToUrl(path, com.data);

            info(reporter, `wrote to ${path}`, { eid });

        } catch (err) {
            error(reporter, err.message, err, {eid});
        }
    }

    return site;
}
