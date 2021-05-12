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
import { EntitySrcDstDescr, ImportDescr } from './types';
import { BitField } from '@odgn/utils/bitfield';


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
export function ensureQuotes(str: string): string {
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
export function removeQuotes(str: string): string {
    return str !== undefined ? str.trim().replace(/^["']?(.+(?=["']$))["']?$/, '$1') : '';
}




export async function getTimestamps(e: Entity) {
    if (e === undefined || e.Ftimes === undefined) {
        return undefined;
    }
    let { btime, mtime } = e.Ftimes;

    return {
        btime: new Date(btime),
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
    if (/^(\.|\/|file:).*/.test(url)) {
        return true;
    }

    if (/^(http|https).*/.test(url)) {
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
    return { btime: time, mtime: time };
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
    e.Ftimes = createTimes();

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

export function createErrorComponent(es: QueryableEntitySet, e: Entity | EntityId, err: Error, options: ErrorOptions = {}) {
    const eid: EntityId = isEntity(e) ? (e as Entity).id : e as EntityId;
    let com = es.createComponent('/component/error', { ...options, message: err.message, stack: err.stack });
    return setEntityId(com, eid);
}


export function mapToTargetMime(mime: string) {
    switch (mime) {
        case 'text/x-scss':
            return 'text/css';
        case 'text/mdx':
            return 'text/html';
        case 'text/jsx':
            return 'text/html';

        default:
            return mime;
    }
}

/**
 * 
 * @param site 
 * @param url 
 * @param base 
 * @returns 
 */
export function resolveImport(site: Site, url: string, base: string): EntitySrcDstDescr {

    const entry = resolveSiteUrl(site, url, base);


    if (entry === undefined) {
        return undefined;
    }

    const [src, dst, eid, mime, bf] = entry;



    // log('[resolveImport]', {eid, path, url, mime});
    if (mime === 'text/jsx') {
        return [eid, `e://${eid}/component/jsx`, mime, src, dst];
    }
    if (mime === 'text/mdx') {
        return [eid, `e://${eid}/component/mdx`, mime, src, dst];
    }
    if (mime === 'text/scss') {
        return [eid, `e://${eid}/component/scss`, 'text/css', src, dst];
    }
    else {
        return [eid, `e://${eid}/`, 'application/x.entity', src, dst];
    }

}


// eid, url, mime, specifiers
export type ResolveSiteUrlResult = [string, string, EntityId, string, BitField];

/**
 * Attempts to resolves a url coming from base against either a src url or a dst url
 * 
 * Returns [ srcUrl, dstUrl, eid, mime, bf ]
 * 
 * @param site 
 * @param url 
 * @param base 
 * @returns 
 */
export function resolveSiteUrl(site: Site, url: string, base: string): ResolveSiteUrlResult {
    const srcIdx = site.getSrcIndex();
    const dstIdx = site.getDstIndex();

    let path = resolveUrlPath(url, base);

    // log('[resolveSiteUrl]', {url,base}, path);

    // attempt getting by given value
    let entry = srcIdx.get(path);
    if (entry !== undefined) {
        const [eid, mime, bf] = entry;
        const dst = dstIdx !== undefined ? dstIdx.getByEid(eid) : undefined;
        return [path, dst, eid, mime, bf];
    }

    if (dstIdx !== undefined) {
        entry = dstIdx.get(url);
        if (entry !== undefined) {
            const [eid] = entry;
            const [src, mime, bf] = srcIdx.getByEid(eid, true);
            return [src, url, eid, mime, bf];
        }
    }

    // attempt partial path
    let reUrl = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let re = new RegExp(`^${reUrl}(?:\..+)?`, 'i');

    for (const key of srcIdx.index.keys()) {
        // log('[resolveSiteUrl]', 'test', key, reUrl);
        if (re.test(key)) {
            const [eid, mime, bf] = srcIdx.get(key);
            const dst = dstIdx !== undefined ? dstIdx.getByEid(eid) : undefined;
            return [key, dst, eid, mime, bf];
        }
    }

    if (dstIdx !== undefined) {
        reUrl = reUrl.replace('file://', '');
        re = new RegExp(`^${reUrl}(?:\..+)?`, 'i');

        let possibles = [];
        for (const key of dstIdx.index.keys()) {
            if (re.test(key)) {
                possibles.push(key);
            }
        }
        if (possibles.length === 0) {
            return undefined;
        }

        // get the shortest possible url
        possibles.sort((a, b) => a.length - b.length);

        // log('possibles for', reUrl, ':', possibles);
        const [eid] = dstIdx.get(possibles[0]);
        const [src, mime, bf] = srcIdx.getByEid(eid, true);
        // log('look at', key, src );
        return [src, possibles[0], eid, mime, bf];

        // for (const key of dstIdx.index.keys()) {
        //     log('look at', key, '?', reUrl, dstIdx.get(key));
        //     if (re.test(key)) {
        //         const [eid] = dstIdx.get(key);
        //         const [src, mime, bf] = srcIdx.getByEid(eid, true);
        //         // log('look at', key, src );
        //         return [src, key, eid, mime, bf];
        //     }
        // }
    }
    return undefined;
}




export enum FormatDateType {
    MonthYear = 0,
    DayMonthYear = 1
}

export function formatDate( obj:any, formatType:FormatDateType = FormatDateType.MonthYear ){
    if( obj === undefined ){ return ''; }

    // log('[formatDate]', obj, formatType);

    let result = '';
    let format = 'MMM YYYY';

    if( formatType === FormatDateType.DayMonthYear ){
        format = 'D MMMM, YYYY';
    }

    if(obj.date_start ){
        let { date_start:start, date_end:end } = obj;
        let isSameYear = false;
        let isSame = false;
        let isBothStart = false;
        
        if( start !== undefined && end !== undefined ){
            isSameYear = Day(start).year() === Day(end).year();
            isSame = Day(start).isSame( Day(end) );
            isBothStart = Day(start).month() === 0 && Day(end).month() === 0;
        }

        if( isSame ){
            return applyDayFormat(start, formatType === FormatDateType.DayMonthYear ? format : 'YYYY' );
        }

        if( isBothStart ){
            format = 'YYYY';
        }

        let startStr = start !== undefined ? applyDayFormat( start, isSameYear ? format.replace(/Y/gi, '').trim() : format ) : '';
        let endStr = end !== undefined ? applyDayFormat(end,format) : '';

        if( Day(end).year() === 9999 ){
            endStr = '';
        }
        
        if( startStr !== endStr ){
            result = (startStr + ' - ' + endStr).trim();
        } else {
            result = startStr;
        }
    }

    else if( obj.date ){
        result = applyDayFormat(obj.date, format);// Day(obj.date).format(format);
    }

    return result;
}

function applyDayFormat( date:string, format:string ){
    if( toInteger(date) + '' === date ){
        return date;
    }
    let day = Day(date);
    return Day(day).format(format);
}