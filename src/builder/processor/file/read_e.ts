import Path from 'path';
import { getComponentEntityId } from "../../../es";
import { selectSrcByExt } from "../../query";
import { setLocation, info, debug } from "../../reporter";
import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { parseEntity, ParseType } from '../../config';

let logActive = true;
const log = (...args) => logActive && console.log('[/processor/file/read_e]', ...args);


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
    const excludeList = es.resolveComponentDefIds([ '/component/src', '/component/site_ref', '/component/upd', '/component/ftimes'] );

    // await printAll(es);

    const coms = await selectSrcByExt( es, [ 'e.yaml', 'e.toml'] , options );

    // log('coms', coms);

    for( const com of coms ){
        const eid = getComponentEntityId(com);
        const e = await es.getEntity(eid, false);
        const ext = Path.extname(com.url).substring(1);
        let content = await site.readUrl( com.url );

        // log('read from', com.url);
        await parseEntity(es, content, 
            { add: true, e, type:ext as ParseType, excludeList, es, siteRef, srcUrl:com.url });

        debug(reporter, `read e from ${com.url} into ${e.id}`, {eid});
    }

    info(reporter, `processed ${coms.length}`);
    // log( Array.from( (es as EntitySetMem).components.values()) );
    
    return site;
}