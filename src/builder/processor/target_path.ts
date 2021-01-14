import Path from 'path';
import Fs from 'fs-extra';


import { Component } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { selectSiteTarget } from './read_dir_meta';
import { joinPaths, writeFile } from './file';
import { resolveTarget, selectDirTarget } from './clear_target';
import { BitField } from 'odgn-entity/src/util/bitfield';


/**
 * Sets a Target component on relevent entities
 * 
 */
export async function process(es: EntitySet) {

    // select file entities
    const ents = await selectFiles(es as EntitySetMem);

    for (const e of ents) {

        const path = await selectTargetPath(es, e.id);
        log('targetPath', e.id, path);

    }
}







function selectFiles(es: EntitySetMem): Entity[] {
    const dids: BitField = es.resolveComponentDefIds(['/component/file']);
    return es.getEntitiesMem(dids, { populate: true });
}


/**
 * Returns an absolute path for the given entity by looking at /component/file, 
 * /component/dir, and /component/target.
 * 
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
    
    // TODO - a complex statement which has many words which should be
    // predefined

    const stmt = es.prepare(`
    [] paths let
    "" filename let

    // ( str -- str|false )
    [ ~r/^\/|file:\/\/\// eval ] selectAbsUri define

    [ false true rot ~r/^\/|file:\/\/\// eval iif ] isAbsPath define

    [ false true rot ~r/^[^\/]*$/ eval iif ] isFilename define

    [ "" swap ~r/^\\/+/ replace ] removeLeadingSlash define

    [ "" swap ~r/\\/$/ replace ] removeTrailingSlash define

    [
        dup ~r/^\\// eval
        
        [["/" *^^$0] "" join ] swap false == if

    ] ensureLeadingSlash define

    [ $paths + paths ! ] addToPaths define
    
    [
        size! 0 == [ drop false @! ] swap if
    ] returnFalseIfEmpty define


    // ( es eid -- es str )
    // gets the dir name from an entity
    [
        // move the es to the top and select /dir using
        // the eid argument
        swap [ *^$1 @eid /component/dir#uri @ca ] select pop?

        // if no /dir component exists, return undefined
        // taking care to drop the empty result
        dup [ drop false @! ] swap undefined == if
        
        
        // split the uri into path parts
        ~r/(?!\/\/)\/(?=.*\/)/ split
        
        pop! // pops the last path part
        @>
    ] selectDirName define


    // ( es eid -- es str|undefined )
    // returns the target uri from an entity
    [
        swap [ *^$1 @eid /component/target#uri @ca ] select pop?
        
        // swap [ *^$1 @eid /component/target !bf @c ] select
        
        // if no /target component exists, return undefined
        // taking care to drop the empty result
        dup [ drop false @! ] swap undefined == if
        // returnFalseIfEmpty

        // /uri pluck

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

    // if /component/target exists, add to paths.
    // returns "abs" if the target uri is absolute, "rel" if
    // relative, and false if it doesn't exist
    // es eid -- es eid "abs"|"rel"|false
    [
        // to order eid es eid
        dup rot rot
        selectTarget
        dup
        
        // if no target exists, return false
        [ drop swap false @! ] swap false == if
        
        // if its a filename, return false
        dup [ filename ! swap false @! ] swap isFilename if
        
        dup isAbsPath
        // if abs path, add to result, return true
        [ addToPaths swap "abs" @! ] swap if

        
        // relative path
        addToPaths swap "rel"
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
        dup [ drop false ] swap false == iif

    ] hasParentDir define
    
    [
        selectParentDir

        // if no parent, stop execution
        dup [ drop @! ] swap false == if

    ] handleParentDir define

    // ( es eid -- es str|undefined )
    [
        swap [ *^$1 @eid /component/site_ref#ref @ca ] select pop?

        dup [ drop "" @! ] swap undefined == if

        swap [ *^$1 @eid /component/target#uri @ca ] select pop?
        
        @>
    ] selectSiteTarget define


    [
        swap [ *^$1 @eid /component/file#uri @ca ] select pop?

        dup [ drop "" @! ] swap undefined == if

        ~r/[^/\\\\&\\?#]+\\.\\w{3,4}(?=([\\?&#].*$|$))/ eval "" join

        @>
    ] selectFilename define
    
    [
        swap [ *^$1 @eid /component/file#uri @ca ] select pop?
    
        dup [ drop "" @! ] swap undefined == if
    
        ~r/^.*:\\/\\/([\\/\\w]+\\/)/ eval pop!

        @>
    ] selectFileDir define

    

    // iterate up the dir dependency tree
    $eid
    [
        // examine the /component/target and add to the result
        // if it exists
        handleTarget
        
        // if the target exists and is absolute, then we have
        // finished
        dup [ drop drop @! ] swap "abs" == if
        
        // if no target exists, then take the dir name from
        // /component/dir
        [ handleDir drop ] swap false == if
        
        // find the parent dir using deps
        handleParentDir
        
        true // loop only continues while true
    ] loop

    
    // if no paths have been found, then select the dir
    // from /component/file
    [ $eid selectFileDir addToPaths ] $paths size 0 == if
    
    // if a filename has not yet been set, use the incoming /file
    [ $eid selectFilename filename ! ] $filename size 0 == if
    
    // add the filename to the end of the paths
    // $eid selectFilename $paths swap + paths !

    
    // NOTE - full path disabled for now
    // add the site target last - this is the base url
    // $eid selectSiteTarget
    
    // $paths "" join removeLeadingSlash
    
    // join the site target and calculated path
    // join

    $paths "" join 
    $filename swap +

    ensureLeadingSlash
    
    `);

    const dirCom = await stmt.getResult({ eid });
    return dirCom && dirCom.length > 0 ? dirCom : undefined;
}

const log = (...args) => console.log('[ScssProc]', ...args);