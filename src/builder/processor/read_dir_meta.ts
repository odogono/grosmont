import Path from 'path';
import Fs from 'fs-extra';
import Yaml from 'yaml';

import { BitField } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll, printEntity } from "../ecs";
import { parseUri } from '../../util/parse_uri';
import { getComponentEntityId, toComponentId } from 'odgn-entity/src/component';
import { joinPaths, pathToUri } from './file';







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
        const targetPath = await selectSiteTarget( es, me.SiteRef.ref );

        if( pe === undefined ){
            log('[process]', 'could not find parent dir', parentUri);
            continue;
        }

        // select site root
        // const rootPath = await selectSitePath( es, me.SiteRef.ref );
        // const metaPath = joinPaths(rootPath, me.File.uri);

        const metaPath = await fileUriToAbsolute( es, me );
        
        // read the meta data
        let content = await Fs.readFile(metaPath, 'utf8');
        let meta = Yaml.parse(content);// as PageMeta;

        let {isEnabled, dstPath} = meta;

        if( isEnabled !== undefined ){
            pe.Enabled = { is:isEnabled };
        }
        if( dstPath !== undefined ){
            pe.Target = { uri:pathToUri(dstPath) };
            // pe.Target = { uri:joinPaths(targetPath,dstPath) };
        }

        // apply the Meta entity to the parent directory
        pe.Meta = { meta };

        modified.push(pe);
    }

    await es.add(modified);

    // printAll( es, modified );


    return es;
}

/**
 * 
 * @param es 
 * @param e 
 */
export async function fileUriToAbsolute( es:EntitySet, e:Entity ){
    const rootPath = await selectSitePath( es, e.SiteRef.ref );
    return joinPaths(rootPath, e.File.uri);
}


export async function selectMetaDisabled( es:EntitySet ): Promise<EntityId[]> {
    const stmt = es.prepare(`[
        /component/enabled#is !ca false ==
        // /component/meta#/meta/isEnabled !ca false ==
        @eid
    ] select`);

    return await stmt.getResult();
}


async function selectMetaYaml( es:EntitySet ): Promise<Entity[]> {
    const stmt = es.prepare(`[
        /component/file#uri !ca ~r/meta.yaml$/ ==
        @c
    ] select`);

    return await stmt.getEntities();
}


async function selectByDirUri( es:EntitySet, uri:string ): Promise<Entity> {
    const stmt = es.prepare(`[
        /component/dir#uri !ca $uri ==
        @c
    ] select`);
    // log('[selectByDirUri]', query);
    const ents = await stmt.getEntities({uri});
    return ents.length > 0 ? ents[0] : undefined;
}

export async function selectSitePath( es:EntitySet, siteEid:EntityId ){
    const did = es.resolveComponentDefId('/component/dir');
    const com = await es.getComponent( toComponentId(siteEid,did) );
    return com.uri;
}
export async function selectSiteTarget( es:EntitySet, siteEid:EntityId ){
    const did = es.resolveComponentDefId('/component/target');
    const com = await es.getComponent( toComponentId(siteEid,did) );
    return com.uri;
}


export async function selectSiteTargetUri( es:EntitySet, e:Entity ){
    if( e.Site !== undefined ){
        return e.Target !== undefined ? e.Target.uri : undefined;
    }
    if( e.SiteRef !== undefined ){
        const eid = e.SiteRef.ref;
        const did = es.resolveComponentDefId('/component/target');
        const com = await es.getComponent( toComponentId(eid,did) );
        return com !== undefined ? com.uri : undefined;
    }
    return undefined;
}


function getParentDirectory( uri:string ){
    return uri.substring(0, uri.lastIndexOf('/'));
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