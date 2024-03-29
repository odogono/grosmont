import Path from 'path';
import { getComponentEntityId, ComponentDefId, setEntityId } from "../../../es";
import { getDepdendencyComponentBySrc, selectSrcByFilename, selectSrcByUrl } from "../../query";
import { setLocation, info, debug, warn } from "../../reporter";
import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { toValues as bfToValues } from '@odgn/utils/bitfield';

let logActive = true;
const Label = '/processor/apply_dir_meta';
const log = (...args) => logActive && console.log(`[${Label}]`, ...args);


/**
 * Copies the components on any entity with a /component/src#url named dir.e* to its dir parent
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    let { reporter } = options;
    setLocation(reporter, Label);

    let coms = await site.getDirectoryMetaComponents(options);


    // build a excludeList of defs that will be ignored in the loaded entity
    const excludeList: ComponentDefId[] = bfToValues(es.resolveComponentDefIds(
        ['/component/src', '/component/site_ref', '/component/ftimes']));

    let addComs = [];

    for (const com of coms) {
        const eid = getComponentEntityId(com);
        const e = await es.getEntity(eid, true);

        // get the parent dir
        const parentUrl = Path.dirname(com.url) + Path.sep;
        let parentCom = await selectSrcByUrl(es, parentUrl);
        let parentEid = getComponentEntityId(parentCom);

        if (parentCom === undefined) {
            warn(reporter, `missing parent dir entity for ${com.url}: ${parentUrl}`, { eid });
            parentCom = es.createComponent('/component/src', { url: parentUrl });
            await es.add(parentCom);
            parentEid = es.getUpdatedEntities()[0];
        }

        // log('parents', eid, {parentUrl, parentEid});

        for (const [did, com] of e.components) {
            // log('moving', com, 'to', parentEid, excludeList.indexOf(did) );
            if (excludeList.indexOf(did) === -1) {
                addComs.push(setEntityId(com, parentEid));
            }
        }

        // next, move any dependencies to the parent
        const deps = await getDepdendencyComponentBySrc(es, eid);

        for (const dep of deps) {
            dep.src = parentEid;
            if( dep.src === dep.dst ){
                warn(reporter, `dep src matches dst ${parentEid}: ${parentUrl}`, { eid });
                continue;
            }
            addComs.push(dep);
        }

        debug(reporter, `moved ${com.url} coms to ${parentEid}`, { eid });
    }

    await es.add(addComs);

    info(reporter, `processed ${coms.length}`);
    // debug(reporter, `added ${addComs.length} coms to ${es.getUrl()}`);

    return site;
}