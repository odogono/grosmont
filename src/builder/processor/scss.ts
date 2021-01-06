import Path from 'path';
import Fs from 'fs-extra';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';

import { Component } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { selectSiteTarget } from './read_dir_meta';
import { joinPaths, writeFile } from './file';
import { resolveTarget, selectDirTarget } from './clear_target';



/**
 * 
 * @param es 
 */
export async function process(es: EntitySet) {

    // select scss entities
    const ents = await selectScss(es);

    // log( ents );

    printAll(es, ents);

    for (const e of ents) {

        const path = await selectTargetPath(es, e.id);
        // const filename = await selectTargetFilename(es, e.id);

        log('targetPath', e.id, path);

        // const {css, srcPath, dstPath} = await renderScss( es, e );

        // if( dstPath !== undefined && css !== undefined ){
        //     await writeFile(dstPath, css);
        // }
    }

}



/**
 * loop
        select /target
            if exists
                if is absolute path, return and finish
                add to result
        select /dir
            if exists, add to result
        select parent using /dep
            if no parent exists, finish
 *  
 */
export async function selectTargetPath(es: EntitySet, eid: EntityId): Promise<string | undefined> {
    
    const stmt = es.prepare(`
    [] paths let

    // ( str -- str|false )
    [ ~r/^\/|file:\/\/\// eval ] selectAbsUri define

    [ false true rot ~r/^\/|file:\/\/\// eval iif ] isAbsPath define


    [ $paths + paths ! ] addToPaths define
    
    [
        size! 0 == [ drop false @! ] swap if
    ] returnFalseIfEmpty define


    // ( es eid -- es str )
    // gets the dir name from an entity
    [
        // move the es to the top and select /dir using
        // the eid argument
        swap 
        [ *^$1 @eid /component/dir !bf @c ] select
        
        // if no /dir component exists, return undefined
        // taking care to drop the empty result
        returnFalseIfEmpty

        // extract the uri
        /uri pluck

        // split the uri into path parts
        ~r/(?!\/\/)\/(?=.*\/)/ split
        
        pop! // pops the last item from an array
        @>
    ] selectDirName define

    

    // ( es eid -- es str|undefined )
    // returns the target uri from an entity
    [
        swap [ *^$1 @eid /component/target !bf @c ] select
        
        // if no /target component exists, return undefined
        // taking care to drop the empty result
        returnFalseIfEmpty

        /uri pluck

        @> // restart exec after returnFalseIfEmpty
    ] selectTarget define


    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )
    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select

        // if the size of the select result is 0, then return 0
        size! 0 == [ drop false @! ] swap if
        pop!
        /dst pluck
        @>
    ] selectParentDir define

    
    // es eid -- es eid true|false
    [
        // to order eid es eid
        dup rot rot
        selectTarget
        dup

        // if no target exists, return false
        [ drop swap false @! ] swap false == if
        dup isAbsPath
        // if abs path, add to result, return true
        [ addToPaths swap true @! ] swap if
        
        // not abs
        drop swap false
        @>
    ] handleTarget define

    [
        dup rot rot
        selectDirName

        dup [ drop swap false @! ] swap false == if
        
        addToPaths swap

        true
        @>
    ] handleDir define
    
    [
        selectParentDir

        // if no parent, stop execution
        dup [ drop @! ] swap false == if

    ] handleParentDir define

    $eid
    [
        handleTarget
        [ drop @! ] swap true == if
        
        handleDir
        drop // discard result of handleDir
        
        handleParentDir
        
        true // loop only continues while true
    ] loop

    // TODO - determine the filename
    // take from /file or from /target ?

    $paths "" join
    `);

    const dirCom = await stmt.getResult({ eid });
    return dirCom && dirCom.length > 0 ? dirCom : undefined;
}




interface RenderScssResult {
    css: string;
    srcPath: string;
    dstPath: string;
}


/**
 * Renders an entity with an Scss component
 * 
 * @param es 
 * @param e 
 */
export async function renderScss(es: EntitySet, e: Entity): Promise<RenderScssResult> {
    if (e.Scss === undefined) {
        return { css: undefined, srcPath: undefined, dstPath: undefined };
    }

    // const siteTargetUri = await selectSiteTarget(es, e.SiteRef.ref);

    const targetUri = await resolveTarget(es, e);

    // // determine target using dir deps
    // const targetCom = await selectDirTarget(es, e.id);

    const filename = selectFilename(e);

    // let dstPath = targetCom !== undefined ?
    //     joinPaths(siteTargetUri, targetCom?.uri) :
    //     siteTargetUri;

    let dstPath = joinPaths(targetUri, filename);

    // log('siteTargetUri', siteTargetUri);
    // log('dstPath', dstPath);

    const srcPath = '/';
    const scss = e.Scss.data;

    const css = await render(scss, srcPath, dstPath);

    return { css, srcPath, dstPath };
}


/**
 * 
 * @param e 
 */
function selectFilename(e: Entity) {
    if (e.File !== undefined) {
        const uri = e.File.uri;
        return Path.basename(uri);
    }

    return undefined;
}


async function render(data: string, srcPath: string, dstPath: string, minify: boolean = false) {
    const plugins = [
        PreCSS,
        GridKISS,
        minify ? CSSNano : undefined
    ].filter(Boolean);

    let args = { from: srcPath, to: dstPath };
    const { css: content } = await PostCSS(plugins).process(data, args);

    return content;
}


export async function selectScss(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/scss !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}


const log = (...args) => console.log('[ScssProc]', ...args);