import Path from 'path';
import { getComponentEntityId } from "odgn-entity/src/component";
import { selectSrcByExt } from "../../query";
import { setLocation, info } from "../../reporter";
import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { parse, ParseType } from '../../config';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntitySetMem } from 'odgn-entity/src/entity_set';

let logActive = true;
const log = (...args) => logActive && console.log('[ProcReadE]', ...args);


/**
 * Reads any /component/src ending with e.yaml|toml into the entity
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    const {siteRef} = options;
    let { reporter } = options;
    setLocation(reporter, '/processor/read_e');

    // build a excludeList of defs that will be ignored in the loaded entity
    const excludeList = es.resolveComponentDefIds([ '/component/src', '/component/site_ref', '/component/upd', '/component/times'] );

    // await printAll(es);

    const coms = await selectSrcByExt( es, [ 'e.yaml', 'e.toml'] , options );

    // log('coms', coms);

    for( const com of coms ){
        const eid = getComponentEntityId(com);
        const e = await es.getEntity(eid, false);
        const ext = Path.extname(com.url).substring(1);
        let content = await site.readUrl( com.url );

        log('read from', com.url);
        await parse(es, content, ext as ParseType, { add: true, e, excludeList, es, siteRef, srcUrl:com.url });

        info(reporter, `read e from ${com.url} into ${e.id}`, {eid});
    }
    // log( Array.from( (es as EntitySetMem).components.values()) );
    
}