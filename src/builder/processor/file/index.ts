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

import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";

import { Component, getComponentEntityId, setEntityId } from 'odgn-entity/src/component';
import { isTimeSame } from '../../util';
import { process as buildDeps } from '../build_deps';
import { selectSite, Site } from '../../site';
import { parse, ParseType } from '../../config';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { getDefId } from 'odgn-entity/src/component_def';
import { applyUpdatesToDependencies, buildSrcUrlIndex, clearUpdates, selectMetaSrc } from '../../query';
import { EntityUpdate, ProcessOptions } from '../../types';
import Day from 'dayjs';
import { info, setLocation } from '../../reporter';




let logActive = true;
const log = (...args) => logActive && console.log('[ProcFile]', ...args);



export interface ProcessFileOptions extends ProcessOptions {
    debug?: true;
    readFS?: boolean;
    readFSResult?: EntitySetMem;
    updates?: EntityUpdate[];
}


/**
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessFileOptions = {}) {
    let { reporter, updates } = options;
    setLocation(reporter, '/processor/file');
    
    // // if we are passed updated entities, then just flag them
    // if (updates !== undefined && updates.length > 0) {
        
    //     await applyUpdateToEntities( site.es, updates );

    // // otherwise, scan the entire src looking for differences
    // } else {

        // create an es to put the scan into
        let incoming = await cloneEntitySet(site.es);

        // read the fs
        await readFileSystem(site, incoming, options);

        // compare the two es
        let diffs = await diffEntitySets(site.es, incoming, options);

        info(reporter, `${diffs.length} diffs`);
        // log('diffs', diffs);
        // printES(incoming);
        // apply the diffs
        await applyEntitySetDiffs(site.es, incoming, diffs, true, options);
    // }

    // resolve any meta.* files into their containing dirs
    await readFileMeta(site, options);

    // build dependencies
    await buildDeps(site, {...options, onlyUpdated:true, debug:diffs.length>0});

    // any dependencies of entities marked as updated should also
    // be marked as updated
    // if( options.debug ){
    // printAll(site.es as EntitySetMem);
    await applyUpdatesToDependencies(site);
    // }
}


/**
 * 
 * @param es 
 */
export async function cloneEntitySet(es: EntitySet) {
    const { idgen, eidEpoch, workerId } = es;

    let result = new EntitySetMem(undefined, { idgen });

    const defs = await es.getComponentDefs();
    for (const def of defs) {
        await result.register(def);
    }

    // copy the site entity
    const se = await selectSite(es);
    await result.add(se);

    return result;
}

/**
 * 
 * @param esA 
 * @param esB 
 * @param diffs 
 */
export async function applyEntitySetDiffs(esA: EntitySet, esB: EntitySet, diffs: SrcUrlDiffResult, addDiff: boolean = true, options:ProcessOptions={}) {
    const {reporter} = options;
    let removeEids: EntityId[] = [];
    let diffComs: Component[] = [];
    let updateEs: Entity[] = [];

    const diffDefId = getDefId(esA.getByUri('/component/upd'));

    log('[applyEntitySetDiffs]', diffs);

    for (const [aEid, op, bEid] of diffs) {

        if (op === ChangeSetOp.Remove) {
            removeEids.push(aEid);
            info( reporter, '[applyEntitySetDiffs] remove', {eid:aEid});
            // add eid to remove list
            continue;
        }
        if (op === ChangeSetOp.Update || op === ChangeSetOp.Add) {
            let e = await esB.getEntity(bEid, true);
            if (e === undefined) {
                info(reporter, '[applyEntitySetDiffs] could not find', {eid:bEid});
                continue;
            }
            let eid = op === ChangeSetOp.Add ? esA.createEntityId() : aEid;
            for (const [, com] of e.components) {
                diffComs.push(setEntityId(com, eid));
            }
            if (addDiff) {
                diffComs.push(setEntityId(esA.createComponent(diffDefId, { op }), eid));
            }

            if( op === ChangeSetOp.Add ){
                info(reporter,'[applyEntitySetDiffs] add', {eid:bEid});
            } else {
                info(reporter,'[applyEntitySetDiffs] update', {eid:aEid});
            }
            // e.Upd = {op};
            // updateEs.push( e );
            // create a diff component and add to es
            // let com = setEntityId( es.createComponent( diffDefId, {op} ), eid );
            // diffComs.push( com );
            continue;
        }
    }

    // await esA.removeEntity(removeEids);

    // the retain flag means the changeset wont be cleared,
    // which in effect batches the remove and add together
    await esA.add(diffComs, { retain: true, debug:false });
    info(reporter, `[applyEntitySetDiffs] updated ${diffComs.length} coms`);
    // log( diffComs );
    // log('updated ents', esA.getUpdatedEntities() );
    // await esA.add( updateEs, {retain:true} );

    // esA.getUpdatedEntities
    return esA;
}


async function applyUpdateToEntities( es:EntitySet, updates:EntityUpdate[] ){
    const diffDefId = getDefId(es.getByUri('/component/upd'));

    let coms:Component[] = [];
    for( const [eid, op] of updates ){
        let com = es.createComponent( diffDefId, {op} );
        coms.push( setEntityId(com, eid) );
    }

    await es.add( coms );
    return es;
}


type SrcUrlDiffResult = [EntityId, ChangeSetOp, EntityId?][];

/**
 * Compares two EntitySets using /component/src#/url as a key
 */
export async function diffEntitySets(esA: EntitySet, esB: EntitySet, options:ProcessOptions={}): Promise<SrcUrlDiffResult> {
    const {reporter} = options;
    setLocation(reporter, '/processor/file/diffEntitySets');
    const idxA = await buildSrcUrlIndex(esA);
    const idxB = await buildSrcUrlIndex(esB);

    let result = [];

    // log('idxA', idxA);
    // log('idxB', idxB);

    for (let [url, eid, mtime, bf] of idxA) {

        // find url in b
        let row = idxB.find(b => b[0] === url);


        if (row === undefined) {
            // a does not exist in b (removed)
            result.push([eid, ChangeSetOp.Remove]);
            info(reporter, `remove - could not find ${url}`, {eid});
            // log( idxA );
            continue;
        }

        const [, bEid, bTime, bBf] = row;

        if (!isTimeSame(mtime, bTime)) {
            // b has a different timestamp (updated)
            result.push([eid, ChangeSetOp.Update, bEid]);
            let at = Day(mtime).toISOString()
            let bt = Day(bTime).toISOString()
            info(reporter,`update - different timestamp to ${eid} - ${at} != ${bt}`, {eid:bEid});
            
            // log(`e ${eid} has different timestamp to ${bEid} - ${mtime} != ${bTime}`);
            continue;
        }

        // comparing components doesnt work, since the incoming changes only consider src
        // if (bfToString(bf) != bfToString(bBf)) {
        //     result.push([eid, ChangeSetOp.Update, bEid]);
        //     log('[diffEntitySets]', '[update]', bEid, `com change`,bfToString(bf), bfToString(bBf) );
        //     let ea = await esA.getEntity(eid,true);
        //     let eb = await esB.getEntity(bEid,true);
        //     printEntity(esA, ea);
        //     printEntity(esB, eb);
        // }
    }

    for (let [url, eid, mtime] of idxB) {
        let row = idxA.find(a => a[0] === url);

        if (row === undefined) {
            // b does not exist in a (added)
            result.push([undefined, ChangeSetOp.Add, eid]);
            info(reporter, `add`, {eid}); 
            continue;
        }
    }


    return result;
    // log( '[diffEntitySets]', coms );
}






/**
 * 
 * @param site 
 * @param options 
 */
async function readFileMeta(site: Site, options: ProcessOptions = {}) {
    const { es } = site;
    const {reporter} = options;
    setLocation(reporter, '/processor/file/read_file_meta');

    // find /src with meta.(yaml|toml) files
    const ents = await selectMetaSrc(es, options);

    if( ents.length > 0 ) {
        info(reporter,`${ents.map(e => e.id)}`);
        // ents.map( e => printEntity(es, e) );
    }

    let coms = [];

    // info(reporter, `selected ${ents.length} ents`);

    for (const e of ents) {
        let path = site.getSrcUrl(e);
        let ext = Path.extname(path).substring(1);

        // find the parent dir
        const parentUrl = Path.dirname(e.Src.url) + Path.sep;
        let parentE = await selectSrcByUrl(es, parentUrl) as Entity;

        if (parentE === undefined) {
            parentE = es.createEntity();
            parentE.Src = { url: parentUrl };
        }

        let content = await Fs.readFile(path, 'utf8');

        // parse the meta into an entity
        let metaE = await parse(site, content, ext as ParseType, { add: false });

        // fold this entity into the parent
        for (let [, com] of metaE.components) {
            com = setEntityId(com, parentE.id);
            coms.push(com);
        }

        // add the update flag if present
        if( e.Upd ){
            coms.push(setEntityId(e.Upd, parentE.id));
        }

        // copy over the stat times
        coms.push(setEntityId(e.Stat, parentE.id));

        info(reporter, `read from ${path}`, {eid:e.id});
    }

    await es.add(coms);

    // if( metaEnts.length > 0 ) {
    //     log('[readFileMeta]', coms);
    // }

    // dont remove the meta files - we will need them to compare
    // for updates
    // await site.es.removeEntity( metaEnts.map( e => e.id) );

    return es;
}






/**
 * Scans through the site src path and creates entities for files and dirs
 * 
 * @param site 
 * @param es 
 * @param options 
 */
async function readFileSystem(site: Site, es?: EntitySet, options: ProcessFileOptions = {}) {
    let rootPath = site.getSrcUrl();
    const siteEntity = site.getEntity();
    es = es ?? site.es;

    if (options.readFSResult) {
        let ents = Array.from(options.readFSResult.components.values());
        await es.add(ents);
        return es;
    }

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

        e = await selectSrcByUrl(es, url, { createIfNotFound: true }) as Entity;

        e.Times = { ctime, mtime };
        e.SiteRef = { ref: siteEntity.id };

        files.push(e);
    }

    // log('files', files);

    await es.add(files);

    // printAll( site.es as EntitySetMem, files );

    return es;
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
        e.Times = { ctime, mtime };
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
// async function gather(es: EntitySetMem, site: Entity) {
//     let rootPath = Process.cwd();
//     if (site.Dir !== undefined) {
//         const { path } = parseUri(site.Dir.uri);
//         rootPath = path;
//     }

//     let include = [];
//     let exclude = [];

//     if (site.Patterns !== undefined) {
//         const { include: inc, exclude: exc } = site.Patterns;
//         if (inc !== undefined) { include = [...include, ...inc]; }
//         if (exc !== undefined) { exclude = [...exclude, ...exc]; }
//     }

//     include = include.map(p => {
//         return Globalyzer(p).isGlob ? { glob: p } : { name: p };
//     });
//     exclude = exclude.map(p => {
//         return Globalyzer(p).isGlob ? { glob: p } : { name: p };
//     });

//     // log('[crawlSite]', __dirname, Process.cwd() );
//     log('[crawlSite]', rootPath, { include, exclude });

//     // if (!await Fs.pathExists(rootPath)) {
//     //     log('[crawlSite]', 'not exist', rootPath);
//     //     return es;
//     // }

//     // let stats = await Fs.stat(rootPath);

//     let files: Entity[] = [];


//     /**
//      * Filter that applies include and exclude glob patterns to the visited files
//      */
//     const globFilter = Through2.obj(function (item, enc, next) {

//         const relativePath = Path.relative(rootPath, item.path);
//         for (const { glob, name } of include) {
//             if (glob && Micromatch.isMatch(relativePath, glob) === false) {
//                 // log('nope regex', glob, relativePath);
//                 return next();
//             } else if (name !== undefined && name != Path.basename(relativePath)) {
//                 // log('nope pattern', relativePath);
//                 return next();
//             }
//         }

//         for (const { glob, name } of exclude) {
//             if (glob && Micromatch.isMatch(item.path, glob)) {
//                 // log('glob exclude', item.path);
//                 return next();
//             } else if (name == Path.basename(item.path)) {
//                 // log('um,', Path.basename(item.path));
//                 return next();
//             }
//         }
//         this.push(item);
//         next();
//     });

//     // gather the files/dirs
//     let matches: any[] = await new Promise((res, rej) => {
//         let items = [];
//         Klaw(rootPath)
//             .pipe(globFilter)
//             .on('data', item => items.push(item))
//             .on('end', () => {
//                 res(items);
//             })
//     });

//     // ensure all matches have a directory - this may be missed
//     // if a glob include was used
//     matches = matches.reduce((result, { path, stats }) => {
//         if (stats.isFile()) {
//             const dirPath = Path.dirname(path);
//             const existsL = result.find(m => m.path === dirPath) !== undefined;
//             const exists = matches.find(m => m.path === dirPath) !== undefined;
//             // const exists = matches.indexOf( m => m.path === dirPath ) !== -1;
//             // log('file parent?', dirPath, existsL, result.map( ({path}) => path ) );
//             if (!existsL && !exists) {
//                 const dirStats = Fs.statSync(dirPath);
//                 // log('add', dirPath);
//                 result.push({ path: dirPath, stats: dirStats });
//             }
//         }
//         result.push({ path, stats });
//         return result;
//     }, []);

//     // log('matches', matches.map( ({path}) => path ));

//     for (const file of matches) {
//         // for await (const file of Klaw(rootPath)) {
//         // log( 'file', file );

//         let relativePath = Path.relative(rootPath, file.path);
//         const uri = `file:///${relativePath}`;
//         const { ctime, mtime } = file.stats;


//         let e: Entity;

//         if (file.stats.isDirectory()) {

//             e = await selectDirByUri(es, uri, { createIfNotFound: true }) as Entity;
//         } else {
//             e = await selectFileByUri(es, uri, { createIfNotFound: true }) as Entity;
//         }

//         e.Times = { ctime, mtime };
//         e.SiteRef = { ref: site.id };

//         files.push(e);
//     }

//     // log('[crawlSite]', 'adding', files );

//     await es.add(files);
// }



/**
 * 
 * @param es 
 */
// async function selectSites(es: EntitySet): Promise<Entity[]> {
//     // const dids: BitField = es.resolveComponentDefIds(['/component/site']);
//     // return es.getEntity(dids, { populate: true });

//     const stmt = es.prepare(`
//         [ /component/site !bf @e ] select
//     `);

//     return stmt.getEntities();
// }



interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}



// /**
//  * 
//  * @param es 
//  * @param uri 
//  * @param options 
//  */
// export async function selectDirByUri(es: EntitySet, uri: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
//     if (!uri.endsWith('/')) {
//         uri = uri + '/';
//     }

//     const stmt = es.prepare(`[ /component/dir#uri !ca $uri == @c] select`);
//     let result = await stmt.getResult({ uri });
//     let com = result.length > 0 ? result[0] : undefined;

//     // const bf = es.resolveComponentDefIds('/component/dir');
//     // const com = es.findComponent(bf, (com) => com['uri'] === uri );

//     // console.log('[selectDirByUri]', 'existing', com );

//     if (com === undefined) {
//         if (options.createIfNotFound) {
//             let e = es.createEntity();
//             e.Dir = { uri };
//             let ctime = new Date().toISOString();
//             let mtime = ctime;
//             e.Times = { ctime, mtime };
//             return e;
//         }
//         return undefined;
//     }

//     const eid = getComponentEntityId(com);
//     if (options.returnEid === true) { return eid; }
//     const e = es.getEntity(eid);
//     return e;
// }

/**
 * 
 * @param es 
 * @param uri 
 * @param options 
 */
// export async function selectFileByUri(es: EntitySet, uri: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {

//     const stmt = es.prepare(`[ /component/file#uri !ca $uri == @c] select`);
//     const com = await stmt.getResult({ uri });

//     if (com === undefined) {
//         if (options.createIfNotFound) {
//             let e = es.createEntity();
//             e.File = { uri };
//             let ctime = new Date().toISOString();
//             let mtime = ctime;
//             e.Times = { ctime, mtime };
//             return e;
//         }
//         return undefined;
//     }

//     const eid = getComponentEntityId(com);
//     if (options.returnEid === true) { return eid; }
//     const e = es.getEntity(eid);
//     return e;
// }


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