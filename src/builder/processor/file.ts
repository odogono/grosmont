/**
 * Site processor starts with a Root entity and walks the specified file path
 * to build a list of entities with file and dir components
 */


import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Process from 'process';
import Through2 from 'through2';
import Globalyzer from 'globalyzer';
import Micromatch from 'micromatch';

import { BitField } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";

import { parseUri } from '../../util/uri';
import { Component, getComponentEntityId, setEntityId } from 'odgn-entity/src/component';
import { insertDependency, printAll } from '../util';
import { Site } from '../site';
import { parse } from '../config';



const log = (...args) => console.log('[ProcFile]', ...args);

/**
 * Matches /site + /dir component and scans the directory for
 * files
 * 
 * @param es 
 */
export async function process(es: EntitySetMem) {
    // select site + dir components
    const sites = await selectSites(es);

    // start the crawl of each site
    for (const site of sites) {
        await gather(es, site);
    }

    return es;
}

export async function processNew(site: Site) {

    // recurse through the sites Src creating entities
    await readFileSystem(site);

    // resolve any meta.* files into their containing files
    await readFileMeta(site);

    // build dependencies
    await buildDeps(site);
}


async function buildDeps(site: Site){
    const {es} = site;

    // select /src entities with a file url
    const coms = await selectFileSrc(es);

    for( const com of coms ){
        const {url} = com;

        // find the parent
        const parentUrl = Path.dirname( url ) + Path.sep;
        const parent = await selectComponentByUrl(es, parentUrl);

        const eid = getComponentEntityId(com);
        const pid = getComponentEntityId(parent);

        if( pid === 0 ){
            continue;
        }

        // insert or update
        const depId = await insertDependency( es, eid, pid, 'dir');
        // await selectDependency(es, eid, pId, 'dir');


        // log('com', eid, '->', pid, '=', depId);
        // log('com', getComponentEntityId(com), 'parent', getComponentEntityId(parent) );

    }

    return site;
}

async function readFileMeta(site: Site){
    const {es} = site;
    // find /src with meta.(yaml|toml) files
    const metaEnts = await selectMeta( site.es );

    // log('meta', metaEnts);

    let coms = [];

    for( const e of metaEnts ){
        let path = site.getSrcUrl(e.Src.url);
        let ext = Path.extname(path).substring(1);

        // find the parent dir
        const parentUrl = Path.dirname( e.Src.url ) + Path.sep;
        let parentE = await selectByUrl(es, parentUrl);

        if( parentE === undefined ){
            parentE = es.createEntity();
            parentE.Src = {url:parentUrl};
        }

        let content = await Fs.readFile(path, 'utf8');

        // parse the meta into an entity
        let metaE = await parse( site.es, content, ext, {add:false} );

        // fold this entity into the parent
        for( let [,com] of metaE.components ){
            
            com = setEntityId( com, parentE.id );
            coms.push( com );
        }

        // copy over the stat times
        coms.push(  setEntityId( e.Stat, parentE.id ) );
    }

    await site.es.add( coms );

    // dont remove the meta files - we will need them to compare
    // for updates
    // await site.es.removeEntity( metaEnts.map( e => e.id) );

    return site;
}


async function selectByUrl( es:EntitySet, url:string ): Promise<Entity> {
    const stmt = es.prepare(`[
        /component/src#url !ca $url ==
        @c
    ] select`);

    let res = await stmt.getEntities({url});
    return res.length > 0 ? res[0] : undefined;
}

async function selectComponentByUrl( es:EntitySet, url:string ): Promise<Component> {
    const stmt = es.prepare(`[
        /component/src#url !ca $url ==
        /component/src !bf
        @c
    ] select`);

    let res = await stmt.getResult({url});
    return res.length > 0 ? res[0] : undefined;
}

async function selectFileSrc( es:EntitySet ): Promise<Component[]> {
    const stmt = es.prepare(`[
        /component/src#url !ca ~r/^file\:\/\// ==
        /component/src !bf
        @c
    ] select`);

    return await stmt.getResult();
}

async function selectMeta( es:EntitySet ): Promise<Entity[]> {
    const stmt = es.prepare(`[
        /component/src#url !ca ~r/meta.(?:toml)?(?:yaml)?$/ ==
        @c
    ] select`);

    return await stmt.getEntities();
}



async function readFileSystem(site: Site) {
    let rootPath = site.getSrcUrl();
    const siteEntity = site.getEntity();

    const [include, exclude] = gatherPatterns(site);

    // log('root', rootPath);

    // log('patterns', { include, exclude });

    let matches = await getMatches(rootPath, include, exclude);

    // log('matches', matches);

    let files = [];

    for (const file of matches) {
        // for await (const file of Klaw(rootPath)) {
        // log( 'file', file );

        let relativePath = Path.relative(rootPath, file.path);
        let url = `file:///${relativePath}`;
        const { ctime, mtime } = file.stats;


        let e: Entity;

        if (file.stats.isDirectory()) {
            // ensure trailing sep present
            url = url.endsWith(Path.sep) ? url : url + Path.sep;
        }

        e = await selectSrcByUrl(site.es, url, { createIfNotFound: true }) as Entity;

        e.Stat = { ctime, mtime };
        e.SiteRef = { ref: siteEntity.id };

        files.push(e);
    }

    // log('files', files);
    
    await site.es.add(files);
    
    // printAll( site.es as EntitySetMem, files );

    return site;
}

async function getMatches(rootPath: string, include, exclude) {

    const globFilter = buildGlobFilter(rootPath, include, exclude);

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
    return matches.reduce((result, { path, stats }) => {
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
}

function buildGlobFilter(rootPath: string, include: Pattern[], exclude: Pattern[]) {
    /**
     * Filter that applies include and exclude glob patterns to the visited files
     */
    return Through2.obj(function (item, enc, next) {

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
}


/**
 * 
 * @param es 
 * @param uri 
 * @param options 
 */
export async function selectSrcByUrl(es: EntitySet, url: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
    // const bf = es.resolveComponentDefIds('/component/file');

    // const com = es.findComponent(bf, (com) => {
    //     return com['uri'] === uri;
    // });

    const stmt = es.prepare(`[ /component/src#url !ca $url == @c] select`);
    let com = await stmt.getResult({ url });
    com = com.length === 0 ? undefined : com[0];

    // log('[selectSrcByUrl]', 'com', com );

    if (com === undefined) {
        if (!options.createIfNotFound) {
            return undefined;
        }
        let e = es.createEntity();
        e.Src = { url };
        let ctime = new Date().toISOString();
        let mtime = ctime;
        e.Stat = { ctime, mtime };
        return e;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }
    const e = es.getEntity(eid);
    return e;
}


interface Pattern {
    glob?: string;
    name?: string;
}

function gatherPatterns(site: Site): [Pattern[], Pattern[]] {
    let include = [];
    let exclude = [];

    let patterns = site.getEntity().Patterns;

    if (patterns !== undefined) {
        const { include: inc, exclude: exc } = patterns;
        if (inc !== undefined) { include = [...include, ...inc]; }
        if (exc !== undefined) { exclude = [...exclude, ...exc]; }
    }

    include = include.map(p => {
        return Globalyzer(p).isGlob ? { glob: p } : { name: p };
    });
    exclude = exclude.map(p => {
        return Globalyzer(p).isGlob ? { glob: p } : { name: p };
    });

    return [include, exclude];
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

            e = await selectDirByUri(es, uri, { createIfNotFound: true }) as Entity;
        } else {
            e = await selectFileByUri(es, uri, { createIfNotFound: true }) as Entity;
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
async function selectSites(es: EntitySet): Promise<Entity[]> {
    // const dids: BitField = es.resolveComponentDefIds(['/component/site']);
    // return es.getEntity(dids, { populate: true });

    const stmt = es.prepare(`
        [ /component/site !bf @e ] select
    `);

    return stmt.getEntities();
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
export async function selectDirByUri(es: EntitySet, uri: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
    if (!uri.endsWith('/')) {
        uri = uri + '/';
    }

    const stmt = es.prepare(`[ /component/dir#uri !ca $uri == @c] select`);
    let result = await stmt.getResult({ uri });
    let com = result.length > 0 ? result[0] : undefined;

    // const bf = es.resolveComponentDefIds('/component/dir');
    // const com = es.findComponent(bf, (com) => com['uri'] === uri );

    // console.log('[selectDirByUri]', 'existing', com );

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
    const e = es.getEntity(eid);
    return e;
}

/**
 * 
 * @param es 
 * @param uri 
 * @param options 
 */
export async function selectFileByUri(es: EntitySet, uri: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
    // const bf = es.resolveComponentDefIds('/component/file');

    // const com = es.findComponent(bf, (com) => {
    //     return com['uri'] === uri;
    // });

    const stmt = es.prepare(`[ /component/file#uri !ca $uri == @c] select`);
    const com = await stmt.getResult({ uri });

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
    const e = es.getEntity(eid);
    return e;
}


export async function writeFile(path: string, content: string) {
    if (content === undefined) {
        throw new Error(`${path} content is undefined`);
    }
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}


export function joinPaths(a: string, b: string) {
    a = uriToPath(a);
    b = uriToPath(b);
    return Path.join(a, b);
}

export function uriToPath(uri: string) {
    if (uri === undefined) {
        return '';
    }
    return uri.startsWith('file://') ? uri.substring('file://'.length) : uri;
}

export function pathToUri(path: string) {
    if (path === undefined) {
        return undefined;
    }
    return path.startsWith('file://') ? path : 'file://' + path;
}


// function log(...args) {
//     console.log('[SiteProcessor]', ...args);
// }