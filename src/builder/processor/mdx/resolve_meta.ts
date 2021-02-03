import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { isString } from "../../../util/is";
import { selectMdx } from "../../query";
import { Site } from '../../site';
import { ProcessOptions } from "../../types";
import { mergeMeta } from "../../util";
import { selectDependencyMeta } from "../../query";


const log = (...args) => console.log('[ProcMDXResolveMeta]', ...args);


export interface ResolveMetaOptions extends ProcessOptions {
    e?: EntityId;
}


/**
 * Resolves /component/meta for an entity by using its
 * dir dependencies
 * 
 * @param es 
 */
export async function process(site: Site, options: ResolveMetaOptions = {}) {
    const es = site.es;
    const eid = options.e;


    // second pass - resolving meta with dependencies
    let ents = eid !== undefined ?
        [await es.getEntity(eid)]
        : await selectMdx(es);

    let output = [];

    for (const e of ents) {

        let metaList = await selectDependencyMeta(es, e.id);
        if( metaList.length === 0 ){
            continue;
        }
        // log('dirCom', metaList);

        let meta = mergeMeta(metaList);

        e.Meta = { meta };

        output.push(e);
    }
    await es.add(output);

    return site;
}



