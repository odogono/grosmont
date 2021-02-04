import Path from 'path';
import { Component, getComponentEntityId, toComponentId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { BitField, get as bfGet } from "odgn-entity/src/util/bitfield";
import { parseUri } from "../util/uri";
import Day from 'dayjs';
import { ProcessOptions } from './types';
import { isString } from '../util/is';
import { fileURLToPath } from 'url';
import { Site } from './site';
import { slugify } from '../util/string';
import { getDependencyComponent } from './query';
import { stringify } from 'odgn-entity/src/util/json';

const log = (...args) => console.log('[ProcUtils]', ...args);


export function applyMeta(e: Entity, data: any): Entity {
    let meta = e.Meta?.meta ?? {};
    // log('existing meta', meta, 'new', data);
    meta = mergeMeta([meta, data]);
    // meta = {...meta, ...data};
    e.Meta = { meta };
    return e;
}


/**
 * Merges an array of meta into a single value
 * 
 * @param metaList 
 */
export function mergeMeta(metaList: any[]) {
    // merge the meta - ignore keys with undefined values
    return metaList.reduce((r, meta) => {
        for (const [key, val] of Object.entries(meta)) {
            if (val !== undefined) {
                if (key === 'tags') {
                    let pre = Array.isArray(r[key]) ? r[key] : [];
                    if (isString(val)) {
                        r[key] = [...pre, val];
                    } else if (Array.isArray(val)) {
                        r[key] = [...pre, ...val];
                    }

                } else {
                    r[key] = val;
                }
            }
        }
        return r;
    }, {});
}














export async function getTimestamps(e: Entity) {
    if (e === undefined || e.Times === undefined) {
        return undefined;
    }
    let { ctime, mtime } = e.Times;

    return {
        ctime: new Date(ctime),
        mtime: new Date(mtime)
    }
}

/**
 * Returns true if the dates match
 */
export function isTimeSame(dateA: string | Date, dateB: string | Date): boolean {
    return Day(dateA).isSame(Day(dateB), 'second');
}


export function getParentDirectory(uri: string) {
    const result = Path.dirname(uri);
    return result.endsWith(Path.sep) ? result : result + Path.sep;
}



export async function selectSiteTargetUri(es: EntitySet, e: Entity) {
    if (e.Site !== undefined) {
        return e.Target !== undefined ? e.Target.uri : undefined;
    }
    if (e.SiteRef !== undefined) {
        const eid = e.SiteRef.ref;
        const did = es.resolveComponentDefId('/component/target');
        const com = await es.getComponent(toComponentId(eid, did));
        return com !== undefined ? com.uri : undefined;
    }
    return undefined;
}


// /**
//  * 
//  * @param es 
//  * @param e 
//  */
// export async function fileUriToAbsolute( es:EntitySet, e:Entity ){
//     const rootPath = await selectSitePath( es, e.SiteRef.ref );
//     return joinPaths(rootPath, e.File.uri);
// }






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

export function createTimes() {
    let time = new Date().toISOString();
    return { ctime: time, mtime: time };
}


export async function createTag(site:Site, name:string){
    if( !isString(name) ){
        name = stringify(name);
    }
    let e = site.es.createEntity();
    e.Tag = { slug: slugify(name) };
    e.Title = { title:name };
    e.SiteRef = { ref: site.e.id };
    e.Times = createTimes();

    return await site.update(e);
}


// export function printAll(es: EntitySetMem, ents?: Entity[], dids?: string[]) {
//     let result = ents || selectAll(es);
//     for (const e of result) {
//         printEntity(es, e, dids);
//     }
// }

// // export async function printQuery(ctx: SiteContext, q: string) {
// //     let result = await ctx.es.queryEntities(q);
// //     for (const e of result) {
// //         printEntity(ctx.es, e);
// //     }
// // }

// export function printEntity(es: EntitySet, e: Entity, dids?: string[]) {
//     let bf: BitField;
//     if (es === undefined || e === undefined) {
//         console.log('(undefined e)');
//         return;
//     }
//     if (dids !== undefined) {
//         bf = es.resolveComponentDefIds(dids);
//     }
//     console.log(`- e(${e.id})`);
//     for (const [did, com] of e.components) {
//         if (bf && bfGet(bf, did) === false) {
//             continue;
//         }
//         const { '@e': eid, '@d': _did, ...rest } = com;
//         const def = es.getByDefId(did);
//         console.log(`   ${def.name}`, JSON.stringify(rest));
//     }
// }

// var asyncIterable = {
//     [Symbol.asyncIterator]() {
//         let i = 0;
//         return {
//             next() {
//                 if (i < 3) {
//                     return Promise.resolve({ value: i++, done: false });
//                 }

//                 return Promise.resolve({ value: i, done: true });
//             }
//         };
//     }
// };

// let testIt = {
//     [Symbol.asyncIterator]: test
// };

// async function* test() {
//     for (let i = 0; i < 10; ++i) {
//         // yield i > 5 ? `Greater than 5: (${i})` : `Less than 5: (${i})`;
//         let value = i > 5 ? `Greater than 5: (${i})` : `Less than 5: (${i})`;
//         yield { value, done: false }
//     }

//     yield {done:true};
// }


// export async function printAES(es: EntitySet) {
//     for await (let num of es.getEntityIterator() ) {
//         console.log(num);
//     }
// }


