import Path from 'path';
import Fs from 'fs-extra';
import Yaml from 'yaml';

import { BitField } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll, printEntity } from "../ecs";
import { parseUri } from '../../util/parse_uri';
import { getComponentEntityId, toComponentId } from 'odgn-entity/src/component';







/**
 * Takes meta.yaml files and applies them as Meta components
 * to the enclosing directory, also making sure the mtime is
 * copied across
 * 
 * @param es 
 */
export async function process( es:EntitySetMem ){
    // look for meta.yaml files
    let metaEntities:Entity[] = await selectMetaYaml( es );

    // printAll( es, metaEntities );

    let modified:Entity[] = [];
    
    for( const me of metaEntities ){
        // find the parent directory entity
        const parentUri = getParentDirectory(me.File.uri);
        const pe = await selectByDirUri(es, parentUri);

        if( pe === undefined ){
            log('[process]', 'could not find parent dir', parentUri);
            continue;
        }

        // select site root
        const rootPath = await selectSitePath( es, me.SiteRef.ref );
        const metaPath = joinPaths(rootPath, me.File.uri);
        
        // read the meta data
        let content = await Fs.readFile(metaPath, 'utf8');
        let meta = Yaml.parse(content);// as PageMeta;

        // apply the Meta entity to the parent directory
        pe.Meta = { meta };

        modified.push(pe);
    }

    await es.add(modified);

    // printAll( es, modified );


    return es;
}


export async function selectMetaDisabled( es:EntitySet ): Promise<EntityId[]> {
    const stmt = es.prepare(`[
        /component/meta#/meta/isEnabled !ca false ==
        @eid
    ] select`);

    return await stmt.getValue();
}


async function selectMetaYaml( es:EntitySet ): Promise<Entity[]> {
    const query = `[
        /component/file#uri !ca ~r/meta.yaml$/ ==
        @c
    ] select`;

    return await es.queryEntities(query);
}


async function selectByDirUri( es:EntitySet, uri:string ): Promise<Entity> {
    const query = `[
        /component/dir#uri !ca "${uri}" ==
        @c
    ] select`;
    // log('[selectByDirUri]', query);
    const ents = await es.queryEntities(query);
    return ents.length > 0 ? ents[0] : undefined;
}

async function selectSitePath( es:EntitySetMem, siteEid:EntityId ){
    const did = es.resolveComponentDefId('/component/dir');
    const com = await es.getComponent( toComponentId(siteEid,did) );
    return com.uri;
}


function getParentDirectory( uri:string ){
    return uri.substring(0, uri.lastIndexOf('/'));
}

function joinPaths( a:string, b:string ){
    if( a.startsWith('file://') ){
        a = a.substring( 'file://'.length );
    }
    if( b.startsWith('file://') ){
        b = b.substring( 'file://'.length );
    }
    return Path.join( a, b );
}

async function readDirMeta(path: string): Promise<any> {
    let metaPath = Path.join(path, 'meta.yaml');
    if (await Fs.pathExists(metaPath) === false) {
        return undefined; //createMeta({isRenderable:false});
    }
    let content = await Fs.readFile(metaPath, 'utf8');
    let meta = Yaml.parse(content);// as PageMeta;
    // console.log('meta was', meta);
    // yaml will return null rather than undefined
    return meta === null ? undefined : meta;
}




const log = (...args) => console.log('[ReadDirMetaProc]', ...args);