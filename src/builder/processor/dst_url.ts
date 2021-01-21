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
    const ents = await selectSrc(es as EntitySetMem);

    for (const e of ents) {

        const path = await getDstUrl(es, e.id);
        log('targetPath', e.id, path);

    }
}







async function selectSrc(es: EntitySet): Promise<Entity[]> {
    const stmt = es.prepare(`[ /component/src !bf @e ] select`);
    return await stmt.getEntities();
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
export async function getDstUrl(es: EntitySet, eid: EntityId): Promise<string | undefined> {
    
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
    

    // ( es eid -- es str|undefined )
    // returns the target uri from an entity
    [
        swap [ *^$1 @eid /component/dst#url @ca ] select pop?
        
        // swap [ *^$1 @eid /component/dst !bf @c ] select
        
        // if no /dst component exists, return undefined
        // taking care to drop the empty result
        dup [ drop false @! ] swap undefined == if

        @> // restart exec after @!
    ] selectDst define


    // selects the parent entity, or 0 if none is found
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
    ] selectParent define

    // if /component/dst exists, add to paths.
    // returns "abs" if the target uri is absolute, "rel" if
    // relative, and false if it doesn't exist
    // es eid -- es eid "abs"|"rel"|false
    [
        // to order eid es eid
        dup rot rot
        
        selectDst
        dup
        
        // if no /dst exists, return false
        [ drop swap false @! ] swap false == if
        
        
        selectFilenameAndPath
        

        // // if the filename exists then set it
        // selectFilename
        
        // // if its a filename, return false
        // dup [ filename ! swap false @! ] swap isFilename if

        

        dup [ drop swap false @! ] swap size 0 == if
        
        dup isAbsPath
        
        // if abs path, add to result, return true
        [ addToPaths swap "abs" @! ] swap if

        // relative path
        addToPaths swap "rel"
        @>

    ] handleDst define


    
    [
        
        selectParent

        // if no parent, stop execution
        dup [ drop @! ] swap false == if

    ] handleParent define

    [
        [ drop @!] $filename size 0 != if
        filename !
        @>
    ] setFilename define

    // takes a path, extracts the filename and sets it if exists
    // returns the path without filename
    [
        ~r/(.*\\/)?(.*)/ eval
        dup [ drop @! ] swap false == if
        
        pop // filename
        setFilename
        pop!
        
        dup [ drop "" @! ] swap undefined == if
        
        @>
        
    ] selectFilenameAndPath define
    

    // iterate up the dir dependency tree
    $eid
    [
        // examine /component/dst and add to the result
        // if it exists
        handleDst
        
         
        // if the dst exists and is absolute, then we have
        // finished
        dup [ drop drop @! ] swap "abs" == if
        
        
        drop // drop the false result
        
        
        // swap // so we have es eid
        
        // find the parent dir using deps
        handleParent

        true // loop only continues while true
    ] loop

    
    // if no filename is found, then quit
    [ undefined @! ] $filename size 0 == if


    $paths "" join 
    $filename swap +

    
    
    dup [ drop undefined @! ] swap size 0 == if
    ensureLeadingSlash
    @>
    
    `);

    const dirCom = await stmt.getResult({ eid });
    return dirCom && dirCom.length > 0 ? dirCom : undefined;
}

const log = (...args) => console.log('[ProcDstUrl]', ...args);