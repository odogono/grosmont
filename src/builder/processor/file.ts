/**
 * Site processor starts with a Root entity and walks the specified file path
 * to build a list of entities with file and dir components
 */


import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Process from 'process';
import Through2 from 'through2';
import Globrex from 'globrex';
import Globalyzer from 'globalyzer';
import Micromatch from 'micromatch';

import { BitField } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { parseUri } from '../../util/uri';
import { getComponentEntityId } from 'odgn-entity/src/component';
import { Result } from 'postcss';




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
    let rootPath = Process.cwd();
    if (site.Dir !== undefined) {
        const { path } = parseUri(site.Dir.uri);
        rootPath = path;
    }

    let include = [];
    let exclude = [];

    if (site.Patterns !== undefined) {
        const { include: inc, exclude: exc } = site.Patterns;
        if (inc !== undefined) { include = [...include, ...inc]; }
        if (exc !== undefined) { exclude = [...exclude, ...exc]; }
    }

    include = include.map(p => {
        return Globalyzer(p).isGlob ? { glob: p } : { name: p };
    });
    exclude = exclude.map(p => {
        return Globalyzer(p).isGlob ? { glob: p } : { name: p };
    });

    // log('[crawlSite]', __dirname, Process.cwd() );
    log('[crawlSite]', rootPath, { include, exclude });

    // if (!await Fs.pathExists(rootPath)) {
    //     log('[crawlSite]', 'not exist', rootPath);
    //     return es;
    // }

    // let stats = await Fs.stat(rootPath);

    let files: Entity[] = [];


    /**
     * Filter that applies include and exclude glob patterns to the visited files
     */
    const globFilter = Through2.obj(function (item, enc, next) {

        const relativePath = Path.relative(rootPath, item.path);
        for (const { glob, name } of include) {
            if (glob && Micromatch.isMatch(relativePath, glob) === false) {
                // log('nope regex', glob, relativePath);
                return next();
            } else if (name !== undefined && name != Path.basename(relativePath)) {
                // log('nope pattern', relativePath);
                return next();
            }
        }

        for (const { glob, name } of exclude) {
            if (glob && Micromatch.isMatch(item.path, glob)) {
                // log('glob exclude', item.path);
                return next();
            } else if (name == Path.basename(item.path)) {
                // log('um,', Path.basename(item.path));
                return next();
            }
        }
        this.push(item);
        next();
    });

    // gather the files/dirs
    let matches: any[] = await new Promise((res, rej) => {
        let items = [];
        Klaw(rootPath)
            .pipe(globFilter)
            .on('data', item => items.push(item))
            .on('end', () => {
                res(items);
            })
    });

    // ensure all matches have a directory - this may be missed
    // if a glob include was used
    matches = matches.reduce((result, { path, stats }) => {
        if (stats.isFile()) {
            const dirPath = Path.dirname(path);
            const existsL = result.find(m => m.path === dirPath) !== undefined;
            const exists = matches.find(m => m.path === dirPath) !== undefined;
            // const exists = matches.indexOf( m => m.path === dirPath ) !== -1;
            // log('file parent?', dirPath, existsL, result.map( ({path}) => path ) );
            if (!existsL && !exists) {
                const dirStats = Fs.statSync(dirPath);
                // log('add', dirPath);
                result.push({ path: dirPath, stats: dirStats });
            }
        }
        result.push({ path, stats });
        return result;
    }, []);

    // log('matches', matches.map( ({path}) => path ));

    for (const file of matches) {
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

    // log('[crawlSite]', 'adding', files );

    await es.add(files);
}



/**
 * 
 * @param es 
 */
function selectSites(es: EntitySetMem): Entity[] {
    const dids: BitField = es.resolveComponentDefIds(['/component/site']);
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
export function selectDirByUri(es: EntitySetMem, uri: string, options: SelectOptions = {}): (Entity | EntityId) {
    if( !uri.endsWith('/') ){
        uri = uri + '/';
    }
    const bf = es.resolveComponentDefIds('/component/dir');
    const com = es.findComponent(bf, (com) => com['uri'] === uri );
    
    if (com === undefined) {
        if (options.createIfNotFound) {
            let e = es.createEntity();
            e.Dir = { uri };
            let ctime = new Date().toISOString();
            let mtime = ctime;
            e.Stat = { ctime, mtime };
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
export function selectFileByUri(es: EntitySetMem, uri: string, options: SelectOptions = {}): (Entity | EntityId) {
    const bf = es.resolveComponentDefIds('/component/file');

    const com = es.findComponent(bf, (com) => {
        return com['uri'] === uri;
    });

    if (com === undefined) {
        if (options.createIfNotFound) {
            let e = es.createEntity();
            e.File = { uri };
            let ctime = new Date().toISOString();
            let mtime = ctime;
            e.Stat = { ctime, mtime };
            return e;
        }
        return undefined;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }
    const e = es.getEntityMem(eid);
    return e;
}


export async function writeFile(path: string, content: string) {
    if (content === undefined) {
        throw new Error(`${path} content is undefined`);
    }
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}


export function joinPaths( a:string, b:string ){
    a = uriToPath(a);
    b = uriToPath(b);
    return Path.join( a, b );
}

export function uriToPath( uri:string ){
    if( uri === undefined ){
        return '';
    }
    return uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
}

export function pathToUri( path:string ){
    if( path === undefined ){
        return undefined;
    }
    return path.startsWith('file://') ? path : 'file://' + path;
}


function log(...args) {
    console.log('[SiteProcessor]', ...args);
}