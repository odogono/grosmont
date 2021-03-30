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
    let removeEids = [];

    for( const [path, [eid,op]] of dstIndex ){

        if( op !== ChangeSetOp.Remove ){
            continue;
        }

        paths.push( path );
        removeEids.push( eid );
        // let fullPath = site.getDstUrl(path);

        if( !dryRun ){
            await site.removeDstUrl( path );
            info(reporter, `removed ${path}`, {eid} );
        } else {
            info(reporter, `[dryRun] removed ${path}`, {eid} );
        }
    }

    dstIndex.remove( paths );
    await es.removeEntity( removeEids );

    // TODO - remove dependencies

    return site;
}
