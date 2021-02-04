import Path from 'path';
import Fs from 'fs-extra';

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { Component } from 'odgn-entity/src/component';
import { joinPaths, pathToUri, uriToPath } from './file';
import { selectSiteTargetUri } from '../util';
import { selectDirTarget, selectTarget } from '../query';


/**
 * Deletes the directories pointed to by Target components
 * DANGER!
 * 
 * @param es 
 */
export async function process(es: EntitySet, e?: Entity) {

    const ents = e !== undefined ? [e] : await selectTarget(es);

    // log('targets');
    // printAll(es, ents);

    let targetPaths = await resolveTargets(es, ents);

    
    for( const path of targetPaths ){
        log('clearing', path);
        // await Fs.emptyDir( uriToPath(path) );
    }

    return es;
}


async function resolveTargets(es: EntitySet, ents: Entity[]) {
    let result = [];

    for (const e of ents) {
        result.push(await resolveTarget(es, e));
    }
    return Array.from(new Set(result));
}


/**
 * 
 * @param es 
 * @param e 
 */
export async function resolveTarget(es: EntitySet, e: Entity) {
    const siteTargetUri = await selectSiteTargetUri(es, e);

    if (e.Site !== undefined) {
        return siteTargetUri;
    }

    
    // determine target using dir deps
    const targetCom = await selectDirTarget(es, e.id);
    
    if (targetCom === undefined) {
        return undefined;
    }

    let dstPath = targetCom !== undefined ?
        joinPaths(siteTargetUri, targetCom?.uri) :
        siteTargetUri;

    dstPath = uriToPath(dstPath);
    let sitePath = uriToPath(siteTargetUri);

    // if the result is not the same as, or a subdir of the site path
    // then it is invalid and cannot be returned
    const isSub = sitePath == dstPath || isSubDir(sitePath, dstPath);

    return isSub ? pathToUri(dstPath) : undefined;
}





/**
 * https://stackoverflow.com/a/45242825/2377677
 * 
 * @param parent 
 * @param dir 
 */
function isSubDir(parent: string, dir: string): boolean {
    const relative = Path.relative(parent, dir);
    const isSub = relative && !relative.startsWith('..') && !Path.isAbsolute(relative);
    return !!isSub;
}



const log = (...args) => console.log('[ClearTargetProc]', ...args);