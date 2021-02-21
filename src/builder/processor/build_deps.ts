import Path from 'path';

import { EntitySetMem } from "odgn-entity/src/entity_set";
import { Site } from "../site";
import { getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { insertDependency, selectFileSrc, selectSrcByUrl } from '../query';
import { setLocation, info } from '../reporter';
import { printAll, printEntity } from 'odgn-entity/src/util/print';



const log = (...args) => console.log('[ProcBuildDeps]', ...args);


export interface BuildDepsOptions extends ProcessOptions {
    debug?: boolean;
    readFS?: boolean;
    readFSResult?: EntitySetMem;
}


/**
 * Inserts 'dir' dependencies for all /component/src with a file:// url
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: BuildDepsOptions = {}) {
    const {reporter} = options;
    let es = site.es;
    setLocation(reporter, '/processor/build_deps');

    // select /src entities with a file url
    const coms = await selectFileSrc(es, options);

    // log('coms', coms);
    // if( coms.length === 0 && options.debug ){
    //     let e = await es.getEntity(16235993252063);
    //     await printEntity(es, e);
    // }

    for (const com of coms) {
        const { url } = com;

        // find the parent
        const parentUrl = Path.dirname(url) + Path.sep;
        const parent = await selectSrcByUrl(es, parentUrl);

        const eid = getComponentEntityId(com);
        const pid = getComponentEntityId(parent);

        if (pid === 0) {
            continue;
        }

        // insert or update
        const depId = await insertDependency(es, eid, pid, 'dir');
        
        info(reporter, `added dir dep to from ${eid} to ${pid}`, {eid:depId});
    }

    return es;
}


