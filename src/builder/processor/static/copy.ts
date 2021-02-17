import { Site } from "../../site";
import { Component, getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../../types';
import { getDstUrl, selectStaticWithDst } from '../../query';
import { debug, error, info, setLocation } from "../../reporter";
import { printEntity } from "odgn-entity/src/util/print";

const log = (...args) => console.log('[ProcStaticCopy]', ...args);


/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    const dryRun = options.dryRun ?? false;
    setLocation(reporter, '/processor/static/copy');

    const srcComs = await selectStaticWithDst(es, options);

    // log('src', srcComs);
    
    for (const src of srcComs) {
        const eid = getComponentEntityId(src);
        try {
            
            const dst = await getDstUrl(es, eid);
            
            if( dst === undefined ){
                log('no dst found for', src);
                continue;
            }
            
            let path = site.getDstUrl(dst);
            
            // debug(reporter, `dst ${dst} path ${path}`, {eid});
            
            if( !dryRun ){
                await site.copyToUrl(path, src.url);
                info(reporter, `copied from ${src.url} to ${path}`, { eid });
            } else {
                // log('fuck', eid, dst, path);
                info(reporter, `[dryRun] copied from ${src.url} to ${path}`, { eid });
            }


        } catch (err) {
            error(reporter, err.message, err, {eid});
        }
    }

    return site;
}
