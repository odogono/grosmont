import Path from 'path';
import { getComponentEntityId, setEntityId } from "odgn-entity/src/component";
import { getDepdendencyComponentBySrc, selectSrcByFilename, selectSrcByUrl } from "../../query";
import { setLocation, info, debug } from "../../reporter";
import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { toValues as bfToValues } from '@odgn/utils/bitfield';
import { ComponentDefId } from 'odgn-entity/src/component_def';

let logActive = true;
const log = (...args) => logActive && console.log('[ProcApplyDirMeta]', ...args);


/**
 * Copies the components on any entity with a /component/src#url named dir.e* to its dir parent
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    let { reporter } = options;
    setLocation(reporter, '/processor/apply_dir_meta');

    let coms = await selectSrcByFilename( es, ['dir.e'], {...options,ignoreExt:true} );

    // build a blacklist of defs that will be ignored in the loaded entity
    const blackList:ComponentDefId[] = bfToValues(es.resolveComponentDefIds([ '/component/src', '/component/site_ref'] ));
    
    let addComs = [];

    for( const com of coms ){
        const eid = getComponentEntityId(com);
        const e = await es.getEntity(eid, true);

        // get the parent dir
        const parentUrl = Path.dirname(com.url) + Path.sep;
        const parentCom = await selectSrcByUrl(es, parentUrl);
        const parentEid = getComponentEntityId(parentCom);

        for( const [did,com] of e.components ){
            if( blackList.indexOf(did) === -1 ){
                addComs.push( setEntityId(com, parentEid) );
            }
        }
        
        // next, move any dependencies to the parent
        const deps = await getDepdendencyComponentBySrc( es, eid);

        for( const dep of deps ){
            dep.src = parentEid;
            addComs.push(dep);
        }

        info(reporter, `moved ${com.url} coms to ${parentEid}`, {eid} );
    }

    await es.add( addComs );

    debug(reporter, `added ${addComs.length} coms to ${es.getUrl()}`);

    return site;
}