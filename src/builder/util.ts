import Path from 'path';
import { 
    Component, 
    Entity,
    EntityId,
    isEntity,
    getComponentEntityId, 
    setEntityId, 
    toComponentId,
    QueryableEntitySet,
    ComponentDefUrl, getDefId
} from "../es";

import Day from 'dayjs';
import { Site } from './site';
import { buildQueryString, parseUri, slugify, stringify, toBoolean, toInteger } from "@odgn/utils";
import { isString } from "@odgn/utils";
import { FindEntityOptions } from './query';


const log = (...args) => console.log('[ProcUtils]', ...args);


export function applyMeta(e: Entity, data: any): Entity {
    let meta = e.Meta?.meta ?? {};
    // log('existing meta', meta, 'new', data);
    meta = mergeMeta([meta, data]);
    // meta = {...meta, ...data};
    e.Meta = { meta };
    return e;
}

export async function applyMimeToEntityId(es: QueryableEntitySet, eid: EntityId, mime: string): Promise<Component> {
    return applyMetaComponentToEntityId(es, eid, { mime });
}

export async function applyMetaComponentToEntityId(es: QueryableEntitySet, eid: EntityId, data: any): Promise<Component> {
    const metaDef = es.getByUri('/component/meta');
    const metaDid = getDefId(metaDef);

    let meta = await es.getComponent(toComponentId(eid, metaDid));
    if (meta === undefined) {
        meta = es.createComponent(metaDid, { meta: {} });
    }
    meta = applyMetaToComponent(meta, data);
    return setEntityId(meta, eid);
}

export function applyMetaToComponent(com: Component, data: any): Component {
    let meta = com.meta ?? {};
    com.meta = mergeMeta([meta, data]);
    return com;
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







/**
 * Adds single quotes to a string if it does not already have them
 * 
 * @param str 
 * @returns 
 */
 export function ensureQuotes(str: string):string {
    if (str === undefined) {
        return '';
    }
    str = str.trim().replace(/^["'](.+)["']$/, '$1');
    return `'${str}'`;
}


/**
 * Removes single or double quotes from a string
 * 
 * @param str 
 * @returns 
 */
export function removeQuotes(str:string):string {
    return str !== undefined ? str.trim().replace(/^["']?(.+(?=["']$))["']?$/, '$1') : '';
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



export async function selectSiteTargetUri(es: QueryableEntitySet, e: Entity) {
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



/**
 * Returns true if the given URL is considered 'internal'
 * 
 * @param url 
 * @returns 
 */
export function isUrlInternal(url: string) {
    if( /^(\.|\/|file:).*/.test(url) ){
        return true;
    }

    if( /^(http|https).*/.test(url) ){
        return false;
    }

    return false;
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

export function createTimes() {
    let time = new Date().toISOString();
    return { ctime: time, mtime: time };
}


export async function createTag(es: QueryableEntitySet, name: string, options: FindEntityOptions = {}) {
    if (!isString(name)) {
        name = stringify(name);
    }
    let e = es.createEntity();
    e.Tag = { slug: slugify(name) };
    e.Title = { title: name };
    if (options.siteRef !== undefined) {
        e.SiteRef = { ref: options.siteRef };
    }
    e.Times = createTimes();

    await es.add(e);
    let eid = es.getUpdatedEntities()[0];
    return es.getEntity(eid);
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


/**
 * Resolves the path against the base url
 * 
 * @param path 
 * @param base 
 */
export function resolveUrlPath(path: string, base?: string): string {
    path = Path.normalize(path);
    const url = new URL(path, base);
    return url.href;
}

interface ParseEntityUriResult {
    eid: EntityId;
    did: ComponentDefUrl;
    attr?: string;
}

/**
 * 
 * @param uri 
 */
export function parseEntityUri(uri: string): ParseEntityUriResult {
    let parts = parseUri(uri);
    if (parts === undefined) {
        return undefined;
    }
    const { protocol, host, path, anchor: attr } = parts;

    // log('[parseEntityUri]', parts);

    if (protocol !== 'e') {
        return undefined;
    }

    let eid = toInteger(host);

    return { eid, did: path, attr };

    // let url = new URL(requirePath);

}


export interface ErrorOptions {
    from?: string;
}

export function createErrorComponent( es:QueryableEntitySet, e:Entity|EntityId, err:Error, options:ErrorOptions = {} ){
    const eid:EntityId = isEntity(e) ? (e as Entity).id : e as EntityId;
    let com = es.createComponent('/component/error', { ...options, message: err.message, stack: err.stack });
    return setEntityId(com, eid);
}