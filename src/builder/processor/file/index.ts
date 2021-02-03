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

import { BitField, create as createBitField, toString as bfToString } from 'odgn-entity/src/util/bitfield';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";

import { parseUri } from '../../../util/uri';
import { Component, getComponentEntityId, setEntityId } from 'odgn-entity/src/component';
import { insertDependency, isTimeSame } from '../../util';
import { process as buildDeps } from '../build_deps';
import { selectSite, Site } from '../../site';
import { parse } from '../../config';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { getDefId } from 'odgn-entity/src/component_def';




let logActive = true;
const log = (...args) => logActive && console.log('[ProcFile]', ...args);



export interface ProcessOptions {
    debug?: true;
    readFS?: boolean;
    readFSResult?: EntitySetMem;
}


export async function process(site: Site, options: ProcessOptions = {}) {
    // logActive = options.debug ?? false;
    // const readFS = options.readFS ?? true;

    // TODO clear the updated component
    await clearUpdated(site.es);

    // if (readFS) {
        // create an es to put the scan into
        let incoming = await cloneEntitySet(site.es);

        // read the fs
        await readFileSystem(site, incoming, options);

        // compare the two es
        let diffs = await diffEntitySets(site.es, incoming);

        // log('diffs', diffs);
        // printES(incoming);
        // apply the diffs
        await applyEntitySetDiffs(site.es, incoming, diffs, true);
    // }

    // resolve any meta.* files into their containing files
    await readFileMeta(site);

    // build dependencies
    await buildDeps(site);

    // any dependencies of entities marked as updated should also
    // be marked as updated
    // if( options.debug ){
        // printAll(site.es as EntitySetMem);
    await applyUpdatesToDependencies(site);
    // }
}


/**
 * - select entity ids that are marked as updated
 * - for each eid, select /deps which have matching dst
 * - take the src eids, add upd coms with same op
 * - take the src eids add to update list
 * @param site 
 */
export async function applyUpdatesToDependencies(site:Site){
    const stmt = site.es.prepare(`

        [
            $es [ /component/upd !bf @c ] select
            [ /@e /op ] pluck!
        ] selectUpdates define

        // selects /dep which match the eid and returns the src
        // es eid -- es [ eid ]
        [
            swap [ 
                /component/dep#dst !ca *^$1 ==
                /component/dep#src @ca 
            ] select
        ] selectDepSrc define

        // adds the op to each of the eids
        // eids op -- [ eid, op ]
        [
            swap [ [] + *^%0 + ] map
            swap drop
        ] applyOp define

        // adds a /upd to the e
        // [eid,op] -- 
        [
            spread
            [ op *^$0 @e *^$0 ] eval to_map
            [] /component/upd + swap + $es swap !c + drop
        ] addUpdCom define


        // set the es as a word - makes easier to reference
        es let

        selectUpdates
        
        [ @! ] swap size 0 == rot swap if
        
        [
            pop?
            spread swap // op eid
            *$3 swap // pull the es to the top
            
            selectDepSrc
            rot applyOp
            
            // add upd coms to each e
            dup
            **addUpdCom map drop
            
            // add the result to the list
            rot swap +
            // continue to loop while there are still eids
            size 0 !=
        ] loop
    `);

    await stmt.run();

    return site;
}


async function clearUpdated(es:EntitySet){
    // TODO - select component id
    const stmt = es.prepare(`[ /component/upd !bf @cid ] select`);
    let cids = await stmt.getResult();

    await es.removeComponents( cids );

    // log('[clearCompleted]', cids);
}

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
export async function applyEntitySetDiffs(esA: EntitySet, esB: EntitySet, diffs: SrcUrlDiffResult, addDiff: boolean = true) {

    let removeEids: EntityId[] = [];
    let diffComs: Component[] = [];
    let updateEs: Entity[] = [];

    const diffDefId = getDefId(esA.getByUri('/component/upd'));

    for (const [aEid, op, bEid] of diffs) {

        if (op === ChangeSetOp.Remove) {
            removeEids.push(aEid);
            // add eid to remove list
            continue;
        }
        if (op === ChangeSetOp.Update || op === ChangeSetOp.Add) {
            let e = await esB.getEntity(bEid, true);
            if (e === undefined) {
                log('[applyEntitySetDiffs]', 'could not find', bEid);
            }
            let eid = op === ChangeSetOp.Add ? esA.createEntityId() : aEid;
            for (const [, com] of e.components) {
                diffComs.push(setEntityId(com, eid));
            }
            if (addDiff) {
                diffComs.push(setEntityId(esA.createComponent(diffDefId, { op }), eid));
            }
            // e.Upd = {op};
            // updateEs.push( e );
            // create a diff component and add to es
            // let com = setEntityId( es.createComponent( diffDefId, {op} ), eid );
            // diffComs.push( com );
            continue;
        }
    }

    await esA.removeEntity(removeEids);

    // the retain flag means the changeset wont be cleared,
    // which in effect batches the remove and add together
    await esA.add(diffComs, { retain: true });
    // await esA.add( updateEs, {retain:true} );

    esA.getUpdatedEntities
    return esA;
}


type SrcUrlDiffResult = [EntityId, ChangeSetOp, EntityId?][];

/**
 * Compares two EntitySets using /component/src#/url as a key
 */
export async function diffEntitySets(esA: EntitySet, esB: EntitySet): Promise<SrcUrlDiffResult> {
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
            continue;
        }

        const [, bEid, bTime, bBf] = row;

        if (!isTimeSame(mtime, bTime)) {
            // b has a different timestamp (updated)
            result.push([eid, ChangeSetOp.Update, bEid]);
            // log(`e ${eid} has different timestamp to ${bEid} - ${mtime} != ${bTime}`);
            continue;
        }

        if (bfToString(bf) != bfToString(bBf)) {
            result.push([eid, ChangeSetOp.Update, bEid]);
        }
    }

    for (let [url, eid, mtime] of idxB) {
        let row = idxA.find(a => a[0] === url);

        if (row === undefined) {
            // b does not exist in a (added)
            result.push([undefined, ChangeSetOp.Add, eid]);
            continue;
        }
    }


    return result;
    // log( '[diffEntitySets]', coms );
}



async function buildSrcUrlIndex(es: EntitySet): Promise<[string, EntityId, string, BitField][]> {
    const query = `
    [ [/component/src /component/times] !bf @e ] select
    [ /component/src#/url /id /component/times#/mtime /bitField ] pluck!
    `
    const stmt = es.prepare(query);
    let result = await stmt.getResult();
    if (result.length === 0) {
        return result;
    }
    // make sure we have an array of array
    return Array.isArray(result[0]) ? result : [result];
}




async function readFileMeta(site: Site, es?: EntitySet) {
    es = es ?? site.es;

    // find /src with meta.(yaml|toml) files
    const metaEnts = await selectMeta(es);

    // log('meta', metaEnts);

    let coms = [];

    for (const e of metaEnts) {
        let path = site.getSrcUrl(e.Src.url);
        let ext = Path.extname(path).substring(1);

        // find the parent dir
        const parentUrl = Path.dirname(e.Src.url) + Path.sep;
        let parentE = await selectByUrl(es, parentUrl);

        if (parentE === undefined) {
            parentE = es.createEntity();
            parentE.Src = { url: parentUrl };
        }

        let content = await Fs.readFile(path, 'utf8');

        // parse the meta into an entity
        let metaE = await parse(site, content, ext, { add: false });

        // fold this entity into the parent
        for (let [, com] of metaE.components) {

            com = setEntityId(com, parentE.id);
            coms.push(com);
        }

        // copy over the stat times
        coms.push(setEntityId(e.Stat, parentE.id));
    }

    await es.add(coms);

    // dont remove the meta files - we will need them to compare
    // for updates
    // await site.es.removeEntity( metaEnts.map( e => e.id) );

    return es;
}


async function selectByUrl(es: EntitySet, url: string): Promise<Entity> {
    const stmt = es.prepare(`[
        /component/src#url !ca $url ==
        @c
    ] select`);

    let res = await stmt.getEntities({ url });
    return res.length > 0 ? res[0] : undefined;
}




async function selectMeta(es: EntitySet): Promise<Entity[]> {
    const stmt = es.prepare(`[
        /component/src#url !ca ~r/meta.(?:toml)?(?:yaml)?$/ ==
        [/component/src /component/upd] !bf // ensure it has both components
        and
        @c
    ] select`);

    return await stmt.getEntities();
}



async function readFileSystem(site: Site, es?: EntitySet, options: ProcessOptions = {}) {
    let rootPath = site.getSrcUrl();
    const siteEntity = site.getEntity();
    es = es ?? site.es;

    if( options.readFSResult ){
        let ents = Array.from( options.readFSResult.components.values() );
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