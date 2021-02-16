import { Entity, EntityId } from "odgn-entity/src/entity";
import { selectMdx } from "../../query";
import { Site } from '../../site';
import { ProcessOptions } from "../../types";
import { mergeMeta } from "../../util";
import { selectDependencyMeta } from "../../query";
import { info, setLocation } from "../../reporter";


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
    const {e:eid, reporter} = options;
    setLocation(reporter,'/processor/mdx/resolve_meta');

    // second pass - resolving meta with dependencies
    let ents = eid !== undefined ?
        [await es.getEntity(eid)]
        : await selectMdx(es, {...options, siteRef: site.e.id});

    let output = [];

    for (const e of ents) {

        let metaList = await selectDependencyMeta(es, e.id);
        if( metaList.length === 0 ){
            continue;
        }
        // log('dirCom', metaList);

        let meta = mergeMeta(metaList);

        e.Meta = { meta };

        info(reporter, '', {eid:e.id});

        output.push(e);
    }
    await es.add(output);

    return site;
}



