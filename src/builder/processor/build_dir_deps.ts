import Path from 'path';

import { EntitySetMem } from "odgn-entity/src/entity_set";
import { Site } from "../site";
import { getComponentEntityId } from 'odgn-entity/src/component';
import { ProcessOptions } from '../types';
import { insertDependency, selectFileSrc, selectSrcByUrl } from '../query';
import { setLocation, info, warn } from '../reporter';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';


const Label = '/processor/build_deps';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface BuildDepsOptions extends ProcessOptions {
    debug?: boolean;
    readFS?: boolean;
    readFSResult?: EntitySetMem;
    createMissingParents?: boolean;
}


/**
 * Inserts 'dir' dependencies for all /component/src with a file:// url
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: BuildDepsOptions = {}) {
    const { reporter } = options;
    const createMissingParents = options.createMissingParents ?? true;
    let es = site.es;
    setLocation(reporter, Label);

    // normally, it won't be neccesary to do this since a file dir
    // scan will have taken place
    if (createMissingParents) {
        await addMissingSrcDirs(site);
    }

    // select /src entities with a file url
    const coms = await selectFileSrc(es, options);

    // log('coms', coms);


    for (const com of coms) {
        const { url } = com;
        const eid = getComponentEntityId(com);
        let parentEid: EntityId = 0;

        // find the parent
        const parentUrl = Path.dirname(url) + Path.sep;
        let parentCom = await selectSrcByUrl(es, parentUrl);

        parentEid = getComponentEntityId(parentCom);

        if (parentEid === 0) {
            continue;
        }

        // insert or update
        const depId = await insertDependency(es, eid, parentEid, 'dir');

        info(reporter, `added dir dep to from ${eid} to ${parentEid}`, { eid: depId });
    }

    return es;
}

/**
 * Adds intermediate dirs missing from /index/srcUrl
 * 
 * @param site 
 * @returns 
 */
async function addMissingSrcDirs(site: Site) {
    const { es } = site;
    const missing = getMissingPaths(site);
    let coms = [];

    for (const url of missing) {
        coms.push(es.createComponent('/component/src', { url }));
        coms.push(es.createComponent('/component/upd', { op: ChangeSetOp.Add }));
    }

    await es.add(coms);
    return site;
}


/**
 * Looks through /index/srcUrl and finds missing directory
 * paths
 * @param site 
 * @returns 
 */
function getMissingPaths(site: Site) {
    const srcIdx = site.getIndex('/index/srcUrl');
    if( srcIdx === undefined ){
        return [];
    }
    const srcs = Array.from(srcIdx.index.keys());

    let paths = new Set<string>(srcs);
    for (let src of srcs) {
        while (src !== './') {
            paths.add(src);
            src = Path.dirname(src) + Path.sep;
        }
    }

    return [...paths].filter(x => srcs.indexOf(x) === -1);

}