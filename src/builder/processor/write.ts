import Fs from 'fs-extra';
import Path from 'path';

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";

import { Site } from "../site";
import { Component, getComponentEntityId } from 'odgn-entity/src/component';
import { getDstUrl } from './dst_url';
import { fileURLToPath } from 'url';

const log = (...args) => console.log('[ProcWrite]', ...args);


/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;

    const coms = await select(es);
    // log('eids', eids);

    for( const com of coms ){
        const eid = getComponentEntityId(com);
        const dst = await getDstUrl(es, eid);
        
        let path = site.getDstUrl( dst );
        // log('com', com);

        await writeFile( path, com.data );
    }

    return site;
}

async function writeFile( path:string, data:string ){
    if (data === undefined) {
        throw new Error(`${path} data is undefined`);
    }
    // log('writing', path);
    if( path.startsWith('file://') ){
        path = fileURLToPath( path );
    }
    // log('writing', path);
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, data);
}

export async function select(es: EntitySet): Promise<Component[]> {

    const q = `
        [ [ /component/dst /component/text /component/upd ] !bf @eid] select
        swap [ *^$1 @eid /component/text !bf @c ] select
    `;

    const stmt = es.prepare(q);
    return await stmt.getResult();
}