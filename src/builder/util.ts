import Path from 'path';
import { Component, getComponentEntityId, toComponentId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import Day from 'dayjs';
import { Site } from './site';
import { buildQueryString, slugify, stringify, toBoolean } from "@odgn/utils";
import { isString } from "@odgn/utils";

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



export interface BuildUrlOptions {
    ignoreEmptyValues?: boolean;
}

/**
 * 
 * @param {*} action 
 * @param {*} qs 
 */
export function buildUrl(action: string, qs = {}, options: BuildUrlOptions = {}): string {
    const ignoreEmptyValues = toBoolean(options.ignoreEmptyValues);

    const queryString = buildQueryString(qs, ignoreEmptyValues);

    if (queryString) {
        return `${action}?${queryString}`;
    } else {
        return action;
    }
}