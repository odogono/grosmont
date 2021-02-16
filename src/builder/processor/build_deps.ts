import Path from 'path';

import { EntitySetMem } from "odgn-entity/src/entity_set";
import { Site } from "../site";
import { getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { insertDependency, selectFileSrc, selectSrcByUrl } from '../query';
import { setLocation, info } from '../reporter';



const log = (...args) => console.log('[ProcBuildDeps]', ...args);


export interface BuildDepsOptions extends ProcessOptions {
    debug?: true;
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
    const coms = await selectFileSrc(es, {...options, siteRef:site.e.id});

    // log('coms', coms);

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
        // await selectDependency(es, eid, pId, 'dir');

        info(reporter, `added dir dep to ${pid}`, {eid});

        // log('com', eid, '->', pid, '=', depId);
        // log('com', getComponentEntityId(com), 'parent', getComponentEntityId(parent) );

    }

    return es;
}


