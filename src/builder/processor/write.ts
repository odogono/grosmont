import { Site } from "../site";
import { Component, getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { getDstUrl, selectTextWithDst } from '../query';
import { error, info, setLocation } from "../reporter";

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

    const coms = await selectTextWithDst(es, options);
    // log('eids', coms);

    for (const com of coms) {
        const eid = getComponentEntityId(com);
        try {


            const dst = await getDstUrl(es, eid);

            let path = site.getDstUrl(dst);


            await site.writeToUrl(path, com.data);

            info(reporter, `wrote to ${path}`, { eid });

        } catch (err) {
            error(reporter, err.message, err, {eid});
        }
    }

    return site;
}
