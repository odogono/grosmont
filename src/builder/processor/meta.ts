import Toml from 'toml';


import { Entity, EntityId, getEntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { getEntityAttribute } from "odgn-entity/src/util/entity";
import { printEntity, Site } from '../ecs';

import { parseUri } from "../../util/uri";
import {
    applyMeta,
    getDependencies,
    findEntityByFileUri,
    findEntityByUrl,
    insertDependency,
    removeDependency,
} from "../util";
import { Component, getComponentDefId } from 'odgn-entity/src/component';
import { ComponentDef, getDefId } from 'odgn-entity/src/component_def';
import { stringify } from 'odgn-entity/src/util/json';


const log = (...args) => console.log('[ProcMeta]', ...args);



/**
 * Takes /component/mdx and parses out meta data
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;

    return site;
}





export async function parse( site:Site, text:string, type:string = 'toml' ): Promise<Entity> {
    const {es} = site;

    let data;

    if( type == 'toml' || type == 'text/toml' ){
        try {
            data = Toml.parse( text );

        } catch( err ){
            log('[parse] error', err);
        }
    }

    // log('parsed', data);
    // let eid = 0;
    // let pk:string;
    let {id:eid, pk, ...other} = data;
    let coms:[ComponentDef,Component][] = [];
    let metaKeys = [];

    for( const [key,val] of Object.entries(other) ){
        
        const def = es.getByUri(key);
        if( def !== undefined ){
            // log('com', def.name, val);

            coms.push( [def, es.createComponent( def, val )] );

            // e[ def.name ] = com;
        } else {
            metaKeys.push(key);
        }
    }

    let e = es.createEntity(eid);
    // log('create e', e.id);
    for( const [def,com] of coms ){
        e[ def.name ] = com;
    }

    if( metaKeys.length > 0 ){
        let meta = {};
        for( const key of metaKeys ){
            meta[key] = other[key];
        }
        e.Meta = {meta};
    }

    // log('!! done', e.id);

    if( e.id === 0 && pk !== undefined ){
        // check the ES for an existing entity with this component

        // get the value of this entity
        let val = getEntityAttribute( es, e, pk );

        // log('pk', e.id, pk, val );

        let ex = await getEntityByUrl( es, pk, val );

        if( ex !== undefined ){
            e = copyEntity(es, e, undefined, ex.id );
        }
    }

    // printEntity(es, e);
    // log( e );

    return await site.update(e);
}


async function getEntityByUrl( es:EntitySet, url:string, val:string ){
    const q = `[ ${url} !ca ${stringify(val)} == @e ] select`;
    const stmt = es.prepare(q);
    const ents = await stmt.getEntities();
    return ents.length > 0 ? ents[0] : undefined;
}

function copyEntity( es:EntitySet, src:Entity, dst?:Entity, id?:EntityId ){
    let e = es.createEntity( id ?? src.id );
    for( const [did,com] of src.components ){
        // log('adding', getEntityId(e) );
        e.addComponentUnsafe( did, com );
    }
    return e;
}