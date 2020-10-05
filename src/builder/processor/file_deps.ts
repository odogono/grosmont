import Path from 'path';
import Fs from 'fs-extra';
import Yaml from 'yaml';

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { getComponentEntityId, toComponentId } from 'odgn-entity/src/component';
import { BitField } from 'odgn-entity/src/util/bitfield';
import { parseUri } from '../../util/parse_uri';



/**
 * Creates dependency entities for files to their parent directories
 * 
 * @param es 
 */
export async function process( es:EntitySetMem ){
    let files:Entity[] = selectFiles( es );

    let deps:Entity[] = [];

    for( const file of files ){
        const { path:filePath } = parseUri(file.File.uri);
        const parentUri = getParentDirectory(file.File.uri);
        const pe = await selectByDirUri(es, parentUri);

        log('file', filePath, 'dep', pe.id);

        let e = es.createEntity();
        e.Dependency = { src:file.id, dst:pe.id, type:'dir' };
        deps.push(e);
    }

    await es.add(deps);

    return es;
}



function selectFiles(es: EntitySetMem): Entity[] {
    const dids: BitField = es.resolveComponentDefIds(['/component/file']);
    return es.getEntitiesMem(dids, { populate: true });
}


function getParentDirectory( uri:string ){
    return uri.substring(0, uri.lastIndexOf('/'));
}

async function selectByDirUri( es:EntitySetMem, uri:string ): Promise<Entity> {
    const query = `[
        /component/dir#uri !ca "${uri}" ==
        @c
    ] select`;
    // log('[selectByDirUri]', query);
    const ents = await es.queryEntities(query);
    return ents.length > 0 ? ents[0] : undefined;
}


const log = (...args) => console.log('[ResolveFileDepProc]', ...args);