import Path from 'path';
import Fs from 'fs-extra';

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { Component } from 'odgn-entity/src/component';
import { joinPaths, pathToUri, uriToPath } from './file';
import { selectSiteTargetUri } from '../util';


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


export async function selectTarget(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/target !bf
        @e
    ] select`;

    const stmt = es.prepare(query);
    return await stmt.getEntities();
}


/**
 * Finds a target Component for the given entity.
 * If one doesn't belong to the entity, it uses Dir dependencies
 * to find a parent with one.
 * 
 * @param es 
 * @param eid 
 */
export async function selectDirTarget(es: EntitySet, eid: EntityId): Promise<Component | undefined> {
    const stmt = es.prepare(`
    [
        // ["💥 eid is" $eid] to_str! .
        [ $eid @eid /component/target !bf @c ] select

        
        // if we have a result, then exit
        dup [ @! ] rot size! 0 < if
        
        // remove the empty result
        // es now on top
        drop
        
        
        // select the parent of the target
        [
            /component/dep !bf
            /component/dep#src !ca $eid ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select

        // if there is no parent, then exit
        dup [ @! ] rot size! 0 == if

        // set eid to parent
        /dst pluck eid !

        // keeps the loop looping
        true
    ] loop
    `);

    const dirCom = await stmt.getResult({ eid });
    return dirCom.length > 0 ? dirCom[0] : undefined;
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