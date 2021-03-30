import { Site } from "../site";
import { ChangeSetOp, getComponentEntityId } from '../../es';
import { ProcessOptions } from '../types';
import { getDstUrl, selectOutputWithDst } from '../query';
import { debug, error, info, setLocation } from "../reporter";
import { toComponentId } from "odgn-entity/src/component";


const Label = '/processor/write';
const log = (...args) => console.log(`[${Label}]`, ...args);

/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter, onlyUpdated } = options;
    setLocation(reporter, Label);

    const idx = site.getDstIndex();
    const did = es.resolveComponentDefId('/component/output');

    for( const [path, [eid,op]] of idx ){

        // log('path', path, {op} );

        if( (op === undefined && onlyUpdated) || op === ChangeSetOp.Remove ){
            continue;
        }

        let com = await es.getComponent( toComponentId(eid,did) );

        if( com === undefined ){
            continue;
        }

        let fullPath = site.getDstUrl(path);

        await site.writeToUrl( fullPath, com.data );

        info(reporter, `wrote to ${path} : ${op}`, { eid });
    }

    // const coms = await selectOutputWithDst(es, options);
    
    // for (const com of coms) {
    //     const eid = getComponentEntityId(com);
    //     try {

    //         const dst = site.getEntityDstUrl(eid);

    //         if( dst === undefined ){
    //             // cant write something which doesnt have a /dst
    //             // log('undefined dst',);
    //             // const e = await es.getEntity(eid);
    //             // printEntity(es, e);
    //             continue;
    //         }

    //         let path = site.getDstUrl(dst);


    //         // debug(reporter, `dst ${dst} path ${path}`, {eid});

    //         await site.writeToUrl(path, com.data);

    //         info(reporter, `wrote to ${path}`, { eid });

    //     } catch (err) {
    //         error(reporter, err.message, err, {eid});
    //     }
    // }

    // info(reporter, `wrote ${coms.length}`);

    return site;
}
