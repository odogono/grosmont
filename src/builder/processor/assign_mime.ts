import Path from 'path';
import Mime from 'mime-types';


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { Component } from 'odgn-entity/src/component';
import { Site } from '../ecs';
import { selectTargetPath } from "./target_path";
import { applyMeta } from '../util';

const log = (...args) => console.log('[ProcAssignMime]', ...args);


/**
 * Examines /component/file#uri and assigns a mime type based on
 * the extension
 * 
 * @param es 
 */
export async function process(site: Site, es: EntitySet = undefined) {
    es = es ?? site.es;
    const siteEntity = site.getSite();

    const files = await selectFiles(es);
    let updates:Entity[] = [];

    for( const e of files ){
        const uri = e.File.uri;
        const ext = Path.extname(uri);

        let mime = Mime.lookup( ext );

        

        if( mime === false ){
            continue;
        }

        // convert from src type to dest type
        mime = mapToTargetMime(mime);

        let eu = applyMeta( e, {mime} );

        // log('lookup', uri, mime, eu.Meta );

        updates.push(eu);

        // const dst = await selectTargetPath( es, id );

        // log('index', id, src, `(${mime}) -> ${dst}`);
    }

    await es.add(updates);
    return es;
}




async function selectFiles(es: EntitySet): Promise<Entity[]> {
    const stmt = es.prepare(`[ /component/file !bf @e ] select`);
    return await stmt.getEntities();
}


function mapToTargetMime( mime:string ){
    switch( mime ){
        case 'text/x-scss':
            return 'text/css';
        case 'text/mdx':
            return 'text/html';
        default:
            return mime;
    }
}