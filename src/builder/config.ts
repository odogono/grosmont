import Toml from 'toml';
import Yaml from 'yaml';
import Path from 'path';
import Jsonpointer from 'jsonpointer';

import { Entity, EntityId, getEntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem, isEntitySet } from "odgn-entity/src/entity_set";
import { getEntityAttribute } from "odgn-entity/src/util/entity";


import { Component, getComponentDefId } from 'odgn-entity/src/component';
import { ComponentDef, getDefId } from 'odgn-entity/src/component_def';
import { slugify, stringify } from '@odgn/utils';
import { Site } from './site';
import { findEntityBySrcUrl, FindEntityOptions, insertDependency, selectTagBySlug } from './query';
import { applyMeta, createTag, createTimes, resolveUrlPath } from './util';
import { isString } from '@odgn/utils';
import { BitField, toValues as bfToValues } from '@odgn/utils/bitfield';
import { printEntity } from 'odgn-entity/src/util/print';


const log = (...args) => console.log('[Config]', ...args);

export interface ParseOptions {
    add?: boolean;
    e?: Entity;
    es?: EntitySet;
    excludeList?: BitField;
    siteRef?: EntityId;
    // the url of the src
    srcUrl?: string;
}


/**
 * Parses a config and returns a populated Entity which is optionally added to the ES
 * 
 * @param es 
 * @param text 
 * @param type 
 * @param options 
 */
export async function parse(from: EntitySet|Site, input: string|object, type:ParseType = 'yaml', options:ParseOptions = {}): Promise<Entity> {
    const es:EntitySet = isEntitySet(from) ? from as EntitySet : (from as Site).es;
    const addToES = options.add ?? true;
    let {excludeList,siteRef,srcUrl} = options;
    if( !isEntitySet(from) ){
        siteRef = (from as Site).getRef();
    }
    const selectOptions = {siteRef, srcUrl};
    
    let data:any = isString(input) ?
        parseConfigString(input as string,type)
        : input;

    
    if( data === undefined || data === null ){
        return undefined;
    }

    // let eid = 0;
    // let pk:string;
    let { id: eid, pk, ...other } = data;
    let coms: [ComponentDef, Component][] = [];
    let metaKeys = [];

    for (const [key, val] of Object.entries(other)) {

        const def = es.getByUri(key);
        if (def !== undefined) {
            coms.push([def, es.createComponent(def, val)]);
        } else {
            metaKeys.push(key);
        }
    }


    let e = options.e ?? es.createEntity(eid);
    
    for (const [def, com] of coms) {
        e[def.name] = com;
    }

    if (metaKeys.length > 0) {
        let meta = {};
        for (const key of metaKeys) {
            const value = other[key];
            
            if( value === undefined ){
                continue;
            }

            if( key === 'title' ){
                applyToCom( e, 'Title', {title: value } );
            }
            else if( key === 'summary'){
                applyToCom( e, 'Title', {summary: value }, false );
            }
            else if( key === 'src'){
                applyUrlToCom( e, 'Src', value );
                // e.Src = {url: value };
            }
            else if( key === 'dst'){
                // applyUrlToCom( e, 'Dst', value );
                e.Dst = {url: value };
            }
            else if( key === 'data'){    
                e.Data = {data: value };
            }
            else if( key === 'date' ){
                e.Date = {date: new Date(value) };
            }
            else if( key === 'output'){
                e.Output = {data: value };
            }
            else if( key === 'mime'){
                // e.Mime = {type: value };
            }
            else if( key === 'tags' ){
                await applyTags( es, e, value, selectOptions );
            }
            else if( key === 'layout' ){
                await applyLayout( es, e, value, selectOptions );
            }
            else {
                meta[key] = value;
            }
        }
        if( Object.keys(meta).length > 0 ){
            // e.Meta = { meta };
            applyMeta( e, meta );
            // applyToCom( e, 'Meta', {meta}, false );
        }
    }

    // log('!! done', e.id);

    // if a primary key was specified, lookup the e to which it
    // refers
    if (e.id === 0 && pk !== undefined) {
        // check the ES for an existing entity with this component

        // get the value of this entity
        let val = getEntityAttribute(es, e, pk);

        // log('pk', e.id, pk, val );

        let ex = await getEntityByUrl(es, pk, val);

        if (ex !== undefined) {
            e = copyEntity(es, e, undefined, ex.id);
        }
    }

    // remove any excludeListed coms from the entity
    if( excludeList !== undefined ){
        const dids = bfToValues(excludeList);
        // console.log('excludeList dids', dids);
        let ce = es.createEntity(e.id);
        for( const [did,com] of e.components ){
            if( dids.indexOf(did) === -1 ){
                ce.addComponentUnsafe(com);
            }
        }
        e = ce;
    }

    if( addToES ){
        if( siteRef !== undefined ){
            e.SiteRef = { ref:siteRef};
        }

        // if we couldn't insert the layout earlier because the e had not
        // yet been created, then read it from meta
        const {layout, ...meta} = e.Meta?.meta ?? {};
        if( layout ){
            e.Meta = Object.keys(meta).length > 0 ? {meta} : undefined;
        }

        // log('adding', Array.from(e.components.values()));
        // apply, dont replace, to existing e
        await es.add( Array.from(e.components.values()) );
        
        // printEntity(es, e);
        // await es.add( e );
        eid = es.getUpdatedEntities()[0];

        // if we couldn't insert the layout earlier because the e had not
        // yet been created, then insert it now
        if( layout ){
            const layoutEid = await findEntityBySrcUrl(es, layout, selectOptions);
            if( layoutEid !== undefined ){
                // log('add layout', eid, layoutEid );
                await insertDependency(es, eid, layoutEid, 'layout');
            } else {
                // log('could not find layout', layout);
            }
        }

        // log('added', eid, await es.getEntity(eid));
        return es.getEntity(eid);
    }

    return e;
}

function applyUrlToCom( e:Entity, name:string, url:string, overwrite:boolean = false ){
    let com = e[name] ?? {};
    if( /^.*:\/\//.exec(url) === null ){
        // url = pathToFileURL( url ).href;
        if( !url.startsWith(Path.sep) ){
            url = `${Path.sep}${url}`;
        }
        url = `file://${url}`;
    }
    com = overwrite ? {url} : {...com,url};
    e[name] = com;
    return e;
}

function applyToCom( e:Entity, name:string, attrs:any, overwrite:boolean = true ){
    let com = e[name] ?? {};
    com = overwrite ? {...attrs} : {...com,...attrs};
    e[name] = com;
    return e;
}


async function applyLayout( es:EntitySet, e:Entity, url:string, options:FindEntityOptions = {} ) {
    let { srcUrl } = options;
    srcUrl = srcUrl ?? e.Src?.url ?? '';

    url = resolveUrlPath( url, srcUrl );

    // find the entity matching the layout
    const layoutEid = await findEntityBySrcUrl(es, url, options);
    
    if( e.id === 0 ){
        // log('[applyLayout]', url, 'e not yet present', layoutEid);
        applyMeta( e, {layout:url});
        return e;
    }

    if (layoutEid !== undefined) {
        await insertDependency(es, e.id, layoutEid, 'layout');
    } else {
        log('[applyLayout]', 'could not find layout for', url);
        log('[applyLayout]', 'reading from', srcUrl );
        
        throw new Error('layout path not found');
    }
    return e;
}


async function applyTags( es:EntitySet, e:Entity, tags:string|string[], options:FindEntityOptions = {}){
    let names:string[] = isString(tags) ? [ tags as string ] : tags as string[];
    
    // get rid of duplicates
    names = Object.values( names.reduce( (r,tag) => {
        r[slugify(tag)] = tag;
        return r;
    }, {}) );

    for( const tag of names ){
        let etag = await selectTagBySlug(es, tag, options);
        if( etag === undefined ){
            etag = await createTag(es,tag, options);
        }

        await insertDependency(es, e.id, etag.id, 'tag');
    }

}





// function parseUrl( rootPath:string, url:string ){
//     if( url.startsWith('file://') ){
//         return url;
//     }
//     // log('[parseUrl]', url);
//     // if( !Path.isAbsolute(url) ){
//     //     url = Path.join(rootPath, url);
//     // }
//     return pathToFileURL( url ).href;
// }


export type ParseType = 'yaml'|'toml'|'text/yaml'|'text/toml';

/**
 * 
 * @param data 
 * @param type 
 */
export function parseConfigString( data:string, type:ParseType = 'yaml' ){
    if (type == 'toml' || type == 'text/toml') {
        try {
            return Toml.parse(data);
        } catch (err) {
            log('[parse] error', err);
            return undefined;
        }
    }
    else if (type === 'yaml' || type === 'text/yaml') {
        try {
            return Yaml.parse(data);
        }
        catch (err) {
            log('[parse] error', err);
            return undefined;
        }
    }
}

export function getPtr(data:any, path:string){
    return Jsonpointer.get(data, path);
}

async function getEntityByUrl(es: EntitySet, url: string, val: string) {
    const q = `[ ${url} !ca ${stringify(val)} == @e ] select`;
    const stmt = es.prepare(q);
    const ents = await stmt.getEntities();
    return ents.length > 0 ? ents[0] : undefined;
}

function copyEntity(es: EntitySet, src: Entity, dst?: Entity, id?: EntityId) {
    let e = es.createEntity(id ?? src.id);
    for (const [did, com] of src.components) {
        // log('adding', getEntityId(e) );
        e.addComponentUnsafe(com);
    }
    return e;
}