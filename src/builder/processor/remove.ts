import { Site } from "../site";
import { ChangeSetOp, getComponentEntityId } from '../../es';
import { ProcessOptions } from '../types';
import { getDstUrl, selectStaticWithDst } from '../query';
import { debug, error, info, setLocation } from "../reporter";


const Label = '/processor/remove';
const log = (...args) => console.log(`[${Label}]`, ...args);


/**
 * Removes from dst filesystem
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    const dryRun = options.dryRun ?? false;
    setLocation(reporter, Label);

    // const srcComs = await selectStaticWithDst(es, options);
    const dstIndex = site.getDstIndex();

    // log('src', srcComs);
    let paths = [];

    for( const [path, [eid,op]] of dstIndex ){

        log('src', path, op);

        if( op !== ChangeSetOp.Remove ){
            continue;
        }

        paths.push( path );
        // let fullPath = site.getDstUrl(path);

        if( !dryRun ){
            await site.removeDstUrl( path );
            info(reporter, `removed ${path}`, {eid} );
        } else {
            info(reporter, `[dryRun] removed ${path}`, {eid} );
        }
    }

    dstIndex.remove( paths );

    // for (const src of srcComs) {
    //     const eid = getComponentEntityId(src);
    //     try {

    //         // const dst = await getDstUrl(es, eid);
    //         const [dst,op] = dstIndex.getByEid(eid, true);

    //         if (dst === undefined) {
    //             debug(reporter, 'no dst found', { eid });
    //             continue;
    //         }

    //         let path = site.getDstUrl(dst);

    //         log('copy', path)

    //         if (!dryRun) {
    //             await site.copyToUrl(path, src.url);
    //             info(reporter, `copied from ${src.url} to ${path}`, { eid });
    //         } else {
    //             info(reporter, `[dryRun] copied from ${src.url} to ${path}`, { eid });
    //         }


    //     } catch (err) {
    //         error(reporter, err.message, err, { eid });
    //     }
    // }

    return site;
}
