/**
 * Site processor starts with a Root entity and walks the specified file path
 * to build a list of entities with file and dir components
 */


import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Through2 from 'through2';
import Globalyzer from 'globalyzer';
import Micromatch from 'micromatch';

import { 
    getDefId,
    Component, getComponentEntityId, setEntityId,
    ChangeSetOp,
    Entity, EntityId,
    EntitySet,
    QueryableEntitySetMem,
    QueryableEntitySet
} from "../../../es";

import { isTimeSame } from '../../util';
import { process as buildDirDeps } from '../build_dir_deps';
import { process as readEntityFiles } from './read_e';
import { process as applyDirMeta } from './apply_dir_meta';
import { selectSite, Site } from '../../site';
import { applyUpdatesToDependencies, buildSrcUrlIndex, selectSrcByFilename } from '../../query';
import { EntityUpdate, ProcessOptions } from '../../types';
import Day from 'dayjs';
import { debug, info, warn, setLocation } from '../../reporter';






let logActive = true;

const Label = '/processor/file/';
const log = (...args) => logActive && console.log(`[${Label}]`, ...args);



export interface ProcessFileOptions extends ProcessOptions {
    debug?: true;
    readFS?: boolean;
    readFSResult?: QueryableEntitySetMem;
    updates?: EntityUpdate[];
}


/**
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessFileOptions = {}) {
    const es = options.es ?? site.es;
    let { reporter, updates } = options;
    setLocation(reporter, Label);
    options.siteRef = site.getRef();

    // // if we are passed updated entities, then just flag them
    // if (updates !== undefined && updates.length > 0) {

    //     await applyUpdateToEntities( site.es, updates );

    // // otherwise, scan the entire src looking for differences
    // } else {

    // create an es to put the scan into
    let incoming = await cloneEntitySet(es);

    // read the fs into the incoming es
    await readFileSystem(site, { ...options, es: incoming });

    // compare the two es
    let diffs = await diffEntitySets(es, incoming, options);
    
    if (diffs.length > 0) {
        info(reporter, `${diffs.length} diffs`);
    }

    await applyEntitySetDiffs(es, incoming, diffs, true, options);

    // read all files marked as being entities
    await readEntityFiles(site, options);

    // merge dir.e.* files into their parents
    await applyDirMeta(site, options);


    // build dependencies
    await buildDirDeps(site, { ...options, debug: diffs.length > 0 });

    // any dependencies of entities marked as updated should also
    // be marked as updated
    // if( options.debug ){
    // printAll(site.es as EntitySetMem);
    await applyUpdatesToDependencies(site, {...options, exclude:['link']});
    // }
}


/**
 * 
 * @param es 
 */
export async function cloneEntitySet(es: QueryableEntitySet): Promise<QueryableEntitySet> {
    const { idgen, eidEpoch, workerId } = es;

    let result = new QueryableEntitySetMem(undefined, { idgen });

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
export async function applyEntitySetDiffs(esA: EntitySet, esB: EntitySet, diffs: SrcUrlDiffResult, addDiff: boolean = true, options: ProcessOptions = {}) {
    const { reporter } = options;
    let removeEids: EntityId[] = [];
    let diffComs: Component[] = [];
    let updateEs: Entity[] = [];
    setLocation(reporter, `${Label}#apply_entity_set_diffs`)

    const diffDefId = getDefId(esA.getByUri('/component/upd'));

    // log('[applyEntitySetDiffs]', diffs);

    for (const [aEid, op, bEid] of diffs) {

        if (op === ChangeSetOp.Remove) {
            removeEids.push(aEid);
            debug(reporter, 'remove', { eid: aEid });
            // add eid to remove list
            continue;
        }
        if (op === ChangeSetOp.Update || op === ChangeSetOp.Add) {
            let e = await esB.getEntity(bEid, true);
            if (e === undefined) {
                warn(reporter, 'could not find', { eid: bEid });
                continue;
            }
            let eid = op === ChangeSetOp.Add ? esA.createEntityId() : aEid;
            for (const [, com] of e.components) {
                diffComs.push(setEntityId(com, eid));
            }
            if (addDiff) {
                diffComs.push(setEntityId(esA.createComponent(diffDefId, { op }), eid));
            }

            if (op === ChangeSetOp.Add) {
                debug(reporter, 'add', { eid: bEid });
            } else {
                debug(reporter, 'update', { eid: aEid });
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
    await esA.add(diffComs, { retain: true, debug: false });
    info(reporter, `updated ${diffComs.length} coms`);
    // log( diffComs );
    // log('updated ents', esA.getUpdatedEntities() );
    // await esA.add( updateEs, {retain:true} );

    // esA.getUpdatedEntities
    return esA;
}


async function applyUpdateToEntities(es: QueryableEntitySet, updates: EntityUpdate[]) {
    const diffDefId = getDefId(es.getByUri('/component/upd'));

    let coms: Component[] = [];
    for (const [eid, op] of updates) {
        let com = es.createComponent(diffDefId, { op });
        coms.push(setEntityId(com, eid));
    }

    await es.add(coms);
    return es;
}


type SrcUrlDiffResult = [EntityId, ChangeSetOp, EntityId?][];

/**
 * Compares two EntitySets using /component/src#/url as a key
 */
export async function diffEntitySets(esA: QueryableEntitySet, esB: QueryableEntitySet, options: ProcessOptions = {}): Promise<SrcUrlDiffResult> {
    const { reporter } = options;
    setLocation(reporter, `${Label}#diff_entity_sets`);
    const idxA = await buildSrcUrlIndex(esA, options);
    const idxB = await buildSrcUrlIndex(esB, options);

    let result = [];

    // log('idxA', idxA);
    // log('idxB', idxB);

    // await printAll( esB );

    for (let [url, eid, mtime, bf] of idxA) {

        // log('consider', url);
        if( !url.startsWith('file://') ){
            continue;
        }

        // find url in b
        let row = idxB.find(b => b[0] === url);

        if (row === undefined) {
            // a does not exist in b (removed)
            result.push([eid, ChangeSetOp.Remove]);
            info(reporter, `remove - could not find ${url}`, { eid });
            // log( idxA );
            continue;
        }

        const [, bEid, bTime, bBf] = row;

        if (!isTimeSame(mtime, bTime)) {
            // b has a different timestamp (updated)
            result.push([eid, ChangeSetOp.Update, bEid]);
            let at = Day(mtime).toISOString()
            let bt = Day(bTime).toISOString()
            info(reporter, `update - different timestamp to ${eid} - ${at} != ${bt}`, { eid: bEid });

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
            debug(reporter, `add`, { eid });
            continue;
        }
        // debug(reporter, `exists`, { eid });
    }


    return result;
    // log( '[diffEntitySets]', coms );
}







/**
 * Scans through the site src path and creates entities for files and dirs
 * 
 * @param site 
 * @param es 
 * @param options 
 */
async function readFileSystem(site: Site, options: ProcessFileOptions = {}) {
    const es = options.es ?? site.es;
    const { reporter } = options;
    let rootPath = site.getSrcUrl();
    const siteEntity = site.getEntity();

    setLocation(reporter, `${Label}#read_file_system`);
    

    if (options.readFSResult) {
        let coms = [];
        for await ( const com of options.readFSResult.getComponents() ){
            coms.push(com);
        }
        
        await es.add(coms);
        
        return es;
    }

    if (rootPath === undefined) {
        warn(reporter, `[readFileSystem] no root path`);
        return es;
    }

    const [include, exclude] = gatherPatterns(site);


    // log('patterns', { include, exclude });

    info(reporter, `reading from ${rootPath}`);

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

    // console.log('ok', rootPath);

    // gather the files/dirs
    let matches: any[] = await new Promise((res, rej) => {
        let items = [];
        Klaw(rootPath)
            .on('error', (err, item) => {
                console.log(err.message)
                console.log(item.path) // the file the error occurred on
                rej(err);
            })
            .pipe(globFilter)
            .on('data', item => items.push(item))
            .on('end', () => {
                res(items);
            })
    });

    // console.log('ok', matches);

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
export async function selectSrcByUrl(es: QueryableEntitySet, url: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
    let com: Component;

    // try {
        const stmt = es.prepare(`[ /component/src#url !ca $url == @c] select`);
        com = await stmt.getResult({ url });
        com = com !== undefined ? com[0] : undefined;
    // } catch (err) {
    //     log('[selectSrcByUrl]', es.getUrl(), err.message );
    // }



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