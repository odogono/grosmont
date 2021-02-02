import Toml from 'toml';
import Yaml from 'yaml';
import Path from 'path';

import { Entity, EntityId, getEntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { getEntityAttribute } from "odgn-entity/src/util/entity";


import { Component, getComponentDefId } from 'odgn-entity/src/component';
import { ComponentDef, getDefId } from 'odgn-entity/src/component_def';
import { stringify } from 'odgn-entity/src/util/json';
import { isString } from '../util/is';
import { Site } from './site';
import { fileURLToPath, pathToFileURL } from 'url';


const log = (...args) => console.log('[Config]', ...args);

export interface ParseOptions {
    add?: boolean;
}


/**
 * Parses a config and returns a populated Entity which is optionally added to the ES
 * 
 * @param es 
 * @param text 
 * @param type 
 * @param options 
 */
export async function parse(site: Site, input: string|object, type: string = 'yaml', options:ParseOptions = {}): Promise<Entity> {
    const {es, rootPath} = site;
    const addToES = options.add ?? true;

    let data:any = isString(input) ?
        parseString(input as string,type)
        : input;

    if( data === undefined || data === null ){
        log('no input', input);
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

    let e = es.createEntity(eid);
    // log('create e', e.id);
    for (const [def, com] of coms) {
        e[def.name] = com;
    }

    if (metaKeys.length > 0) {
        let meta = {};
        for (const key of metaKeys) {

            if( key === 'title' ){
                e.Title = { title: other[key] };
            }
            else if( key === 'src'){
                e.Src = {url: other[key] };
            }
            else if( key === 'dst'){
                e.Dst = {url: other[key] };
            }
            else if( key === 'text'){
                e.Text = {data: other[key] };
            }
            else {
                meta[key] = other[key];
            }

        }
        e.Meta = { meta };
    }

    // log('!! done', e.id);

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

    // printEntity(es, e);
    // log( e );

    if( addToES ){
        await es.add( e );
        eid = es.getUpdatedEntities()[0];
        return es.getEntity(eid);
    }

    return e;
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

function parseString( data:string, type:string = 'yaml' ){
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
        e.addComponentUnsafe(did, com);
    }
    return e;
}