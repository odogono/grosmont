/**
 * Site processor starts with a Root entity and walks the specified file path
 * to build a list of entities with file and dir components
 */


import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Through2 from 'through2';
import Globrex from 'globrex';
import Globalyzer from 'globalyzer';
import Micromatch from 'micromatch';

import { BitField } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { parseUri } from '../../util/parse_uri';
import { getComponentEntityId } from 'odgn-entity/src/component';




/**
 * Matches /site + /dir component and scans the directory for
 * files
 * 
 * @param es 
 */
export async function process(es: EntitySetMem) {
    // select site + dir components
    const sites = selectSites(es);

    // start the crawl of each site
    for (const site of sites) {
        await gather(es, site);
    }

    return es;
}



/**
 * 
 * @param es 
 * @param site 
 */
async function gather(es: EntitySetMem, site: Entity) {
    const { path: rootPath } = parseUri(site.Dir.path);
    let include = [];
    let exclude = [];

    if (site.Patterns !== undefined) {
        const { include: inc, exclude: exc } = site.Patterns;
        if (inc !== undefined) { include = [...include, ...inc]; }
        if (exc !== undefined) { exclude = [...exclude, ...exc]; }
    }


    
    include = include.map( p => {
        return Globalyzer(p).isGlob ? Globrex(p) : {pattern:p};
    });
    exclude = exclude.map( p => {
        return Globalyzer(p).isGlob ? Globrex(p) : {pattern:p};
    });

    // log('[crawlSite]', rootPath, { include, exclude });

    if (!await Fs.pathExists(rootPath)) {
        log('[crawlSite]', 'not exist', rootPath);
        return es;
    }

    let stats = await Fs.stat(rootPath);

    let files: Entity[] = [];

    if (stats.isFile()) {

    }
    else if (stats.isDirectory()) {

        

        const globFilter = Through2.obj(function (item, enc, next) {

            const relativePath = Path.relative(rootPath, item.path);
            for( const {regex,pattern} of include ){
                if( regex && regex.test(relativePath) === false ){
                    log('nope regex', regex, relativePath);
                    return next();
                } else if( pattern !== undefined && pattern != Path.basename(relativePath) ){
                    log('nope pattern', relativePath);
                    return next();
                }
            }

            for( const {regex,pattern} of exclude ){
                if( regex && regex.test(item.path) ){
                    // log('glob exclude', item.path);
                    return next();
                } else if( pattern == Path.basename(item.path) ){
                    // log('um,', Path.basename(item.path));
                    return next();
                }
            }
            this.push(item);
            next();
        })

        const matches:any[] = await new Promise((res, rej) => {
            let items = [];
            Klaw(rootPath)
                .pipe(globFilter)
                .on('data', item => items.push(item))
                .on('end', () => {
                    res(items);
                })
        });

        // log('klaw push', files);

        for ( const file of matches ){
        // for await (const file of Klaw(rootPath)) {
            // log( 'file', file );

            let relativePath = Path.relative(rootPath, file.path);
            const uri = `file:///${relativePath}`;
            const { ctime, mtime } = file.stats;


            let e: Entity;

            if (file.stats.isDirectory()) {
                e = selectDirByUri(es, uri, { createIfNotFound: true }) as Entity;
            } else {
                e = selectFileByUri(es, uri, { createIfNotFound: true }) as Entity;
            }

            e.Stat = { ctime, mtime };
            e.SiteRef = { ref: site.id };

            files.push(e);
        }
    }

    // log('[crawlSite]', 'adding', files );

    await es.add(files);
}



/**
 * 
 * @param es 
 */
function selectSites(es: EntitySetMem): Entity[] {
    const dids: BitField = es.resolveComponentDefIds(['/component/site', '/component/dir']);
    let ents: Entity[];

    return es.getEntitiesMem(dids, { populate: true });
}



interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}


/**
 * 
 * @param es 
 * @param uri 
 * @param options 
 */
function selectDirByUri(es: EntitySetMem, uri: string, options: SelectOptions = {}): (Entity | EntityId) {
    const bf = es.resolveComponentDefIds('/component/dir');

    const com = es.findComponent(bf, (com) => {
        return com['uri'] === uri;
    });

    if (com === undefined) {
        if (options.createIfNotFound) {
            let e = es.createEntity();
            e.Dir = { uri };
            return e;
        }
        return undefined;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }
    const e = es.getEntityMem(eid);
    return e;
}

/**
 * 
 * @param es 
 * @param uri 
 * @param options 
 */
function selectFileByUri(es: EntitySetMem, uri: string, options: SelectOptions = {}): (Entity | EntityId) {
    const bf = es.resolveComponentDefIds('/component/file');

    const com = es.findComponent(bf, (com) => {
        return com['uri'] === uri;
    });

    if (com === undefined) {
        if (options.createIfNotFound) {
            let e = es.createEntity();
            e.File = { uri };
            return e;
        }
        return undefined;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }
    const e = es.getEntityMem(eid);
    return e;
}


function log(...args) {
    console.log('[SiteProcessor]', ...args);
}