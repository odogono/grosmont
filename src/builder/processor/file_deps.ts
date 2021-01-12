import Path from 'path';
import Fs from 'fs-extra';
import Yaml from 'yaml';

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { Component, getComponentEntityId, toComponentId } from 'odgn-entity/src/component';
import { BitField, TYPE_OR } from 'odgn-entity/src/util/bitfield';
import { parseUri } from '../../util/parse_uri';
import { ComponentDefId } from 'odgn-entity/src/component_def';
import { printAll } from '../ecs';



/**
 * Creates dependency entities for files and dirs to their parent directories
 * 
 * @param es 
 */
export async function process(es: EntitySetMem) {
    let files: Entity[] = selectFilesAndDirs(es);

    let deps: Entity[] = [];

    // printAll(es, files);

    for (const file of files) {
        if (file.Site !== undefined) {
            // site will have no dir dependency
            continue;
        }
        const uri = file.File?.uri ?? file.Dir?.uri;
        // const { path:filePath } = parseUri(file.File.uri);
        const parentUri = getParentDirectory(uri);
        const pe = await selectByDirUri(es, parentUri);


        if (pe === undefined) {
            continue;
        }

        if (file.id === pe.id) {
            log('file', uri, 'dep', pe?.id, 'parent', parentUri);
            throw new Error('selected same uri');
        }

        // check for existing
        let existing = await selectDependency(es, file.id, pe.id, 'dir');

        // log('existing', existing);
        if (existing.length > 0) {
            continue;
        }

        let e = es.createEntity();
        e.Dep = { src: file.id, dst: pe.id, type: 'dir' };
        deps.push(e);
    }

    await es.add(deps);


    // const e = deps[0];
    // printAll(es,deps);
    // const {src,dst, type} = e.Dependency;
    // if( deps.length === 3 ){
    // let existing = await selectDependency(es, undefined, undefined, undefined );
    // }

    return es;
}

/**
 * Selects a dependency entity
 */
export async function selectDependency(es: EntitySetMem, src?: EntityId, dst?: EntityId, type?: string, asEntity: boolean = false) {
    // const did:ComponentDefId = es.resolveComponentDefId('/component/dep');

    let conds = [];
    if (src !== undefined) {
        conds.push(`/component/dep#src !ca ${src} ==`);
    }
    if (dst !== undefined) {
        conds.push(`/component/dep#dst !ca ${dst} ==`);
    }
    if (conds.length === 2) { conds.push('and'); }
    if (type !== undefined) {
        conds.push(`/component/dep#type !ca ${type} ==`);
    }
    if (conds.length >= 2) { conds.push('and'); }

    if (asEntity) {
        let query = `[
            /component/dep !bf
            ${conds.join('\n')}
            @c
        ] select`;
        let stack = await es.query(query);
        return stack.popValue() as unknown as Component[];
    }

    let query = `[
        /component/dep !bf
        ${conds.join('\n')}
        @c
    ] select`;

    let out = await es.queryEntities(query);

    return out;
}

/**
 * Removes dir entities and children specified by the eids
 * 
 * @param es 
 * @param eids 
 */
// export async function removeDirDependencies(es: EntitySetMem, eids:EntityId[] ){
//     const stmt = es.prepare(`$eids -`);
// }

export async function selectDirDependencies(es: EntitySet, dir: EntityId | EntityId[]): Promise<EntityId[]> {

    // log('[selectDirDependencies]', dir);

    const query = `
        [
            dstId let
            [
                /component/dep !bf
                /component/dep#dst !ca $dstId ==
                /component/dep#src !ca $dstId !=
                and
                /component/dep#type !ca dir ==
                and
                @c
            ] select
        ] selectDeps define

        [
            [] result let // result array
            [
                selectDeps
                /src pluck
                dup 
                $result concat result !
                size!
                
                // continue if the last results
                // came back non-empty
                true [$result] rot 0 == iif
            ] loop
            
            // lose the last result
            swap drop    
        ] selectDepsRecursive define

        $dirEid selectDepsRecursive
        
        `;

    const stmt = es.prepare(query);
    return stmt.getResult({ dirEid: dir });

    // return stack.popValue() as unknown as EntityId[];
    // let out = await es.queryEntities(query);

    // return out;
    // return selectDependency(es, undefined, dir, 'dir', true);
}

export async function selectDependencies(es: EntitySet, eids: EntityId[]) {
    const query = `
        [
            /component/dep#src !ca $eids ==
            /component/dep#dst !ca $eids ==
            or
            @eid
        ] select
    `;

    const stmt = es.prepare(query);
    return stmt.getResult({ eids });
}

function selectFilesAndDirs(es: EntitySetMem): Entity[] {
    const dids: BitField = es.resolveComponentDefIds(['/component/file', '/component/dir']);
    dids.type = TYPE_OR;
    return es.getEntitiesMem(dids, { populate: true });
}




export function getParentDirectory(uri: string) {
    const result = Path.dirname(uri);
    return result.endsWith(Path.sep) ? result : result + Path.sep;
}

async function selectByDirUri(es: EntitySetMem, uri: string): Promise<Entity> {
    const query = `[
        /component/dir#uri !ca $uri ==
        @c
    ] select`;
    // log('[selectByDirUri]', query, uri);
    const stmt = es.prepare(query);
    const ents = await stmt.getEntities({ uri });
    return ents.length > 0 ? ents[0] : undefined;
}


const log = (...args) => console.log('[ResolveFileDepProc]', ...args);