import Toml from 'toml';
import Yaml from 'yaml';
import Path from 'path';
import Jsonpointer from 'jsonpointer';


import {
    Component,
    ComponentDef,
    QueryableEntitySet,
    Entity, EntityId, getEntityId,
    isEntitySet,
    getEntityAttribute,
} from "../es";


import { slugify, stringify, toInteger } from '@odgn/utils';
import { Site } from './site';
import { findEntityBySrcUrl, FindEntityOptions, insertDependency, selectTagBySlug } from './query';
import { applyMeta, createTag, uriToPath, resolveUrlPath } from './util';
import { isString } from '@odgn/utils';
import { BitField, toValues as bfToValues } from '@odgn/utils/bitfield';
import { executionAsyncResource } from 'node:async_hooks';



const log = (...args) => console.log('[Config]', ...args);

export interface ParseOptions {
    add?: boolean;
    e?: Entity;
    es?: QueryableEntitySet;
    excludeList?: BitField;
    siteRef?: EntityId;
    // the url of the src
    srcUrl?: string;
    type?: ParseType;
}


/**
 * Parses a config and returns a populated Entity which is optionally added to the ES
 * 
 * @param es 
 * @param text 
 * @param type 
 * @param options 
 */
export async function parseEntity(from: QueryableEntitySet | Site, input: string | object, options: ParseOptions = {}): Promise<Entity> {
    const es: QueryableEntitySet = isEntitySet(from) ? from as QueryableEntitySet : (from as Site).es;

    let { siteRef } = options;
    const type = options.type ?? 'yaml';
    if (!isEntitySet(from)) {
        siteRef = (from as Site).getRef();
    }


    let data: any = isString(input) ?
        parseConfigString(input as string, type)
        : input;


    if (data === undefined || data === null) {
        return undefined;
    }

    if (Array.isArray(data)) {
        return parseArray(es, data as any[], { ...options, siteRef });
    }

    return parseData(es, data, { ...options, siteRef });

}


async function parseArray(es: QueryableEntitySet, data: ({ [key: string]: any }[]), options: ParseOptions) {
    let { e: srcE } = options;
    const addToES = options.add ?? true;

    for (const item of data) {
        let e = await parseData(es, item, { ...options, e: undefined });

        // add a gen dependency
        if (addToES && srcE !== undefined) {
            await insertDependency(es, e.id, srcE.id, 'gen');
        }
    }

    return undefined;
}


async function parseData(es: QueryableEntitySet, data: ({ [key: string]: any }), options: ParseOptions) {
    const { excludeList, siteRef, srcUrl } = options;
    const addToES = options.add ?? true;
    const selectOptions = { siteRef, srcUrl };

    let { id: eid, pk, ...other } = data;
    let coms: [ComponentDef, Component][] = [];
    let metaKeys = [];

    for (const [key, val] of Object.entries(other)) {

        const def = es.getByUri(key);
        if (def !== undefined) {
            coms.push([def, es.createComponent(def, val)]);
        } else {
            metaKeys.push(key);
        }
    }


    let e = options.e ?? es.createEntity(eid);

    for (const [def, com] of coms) {
        e[def.name] = com;
    }


    if (metaKeys.length > 0) {
        let meta = {};
        for (let key of metaKeys) {
            const value = other[key];

            if (value === undefined) {
                continue;
            }

            const isPk = key.endsWith('!');
            if (isPk) {
                key = key.substring(0, key.length - 1);
            }

            if (key === 'title') {
                applyToCom(e, 'Title', { title: value });
                pk = isPk ? '/component/title#title' : pk;
            }
            else if (key === 'url') {
                applyToCom(e, 'Url', { url: value });
                pk = isPk ? '/component/url#url' : pk;
            }
            else if (key === 'summary') {
                applyToCom(e, 'Title', { summary: value }, false);
                pk = isPk ? '/component/title#summary' : pk;
            }
            else if (key === 'src') {
                applyUrlToCom(e, 'Src', value);
                pk = isPk ? '/component/src#url' : pk;
            }
            else if (key === 'dst') {
                applyToCom(e, 'Dst', { url: uriToPath(value) }, false);
                pk = isPk ? '/component/dst#url' : pk;
            }
            else if (key === 'data') {
                e.Data = { data: value };
                pk = isPk ? '/component/data#data' : pk;
            }
            else if (key === 'date') {
                if (Array.isArray(value)) {
                    let dates = value.map(v => new Date(v));
                    e.DateRange = { date_start: dates[0], date_end: dates[1] };
                } else {
                    e.Date = { date: new Date(value) };
                    pk = isPk ? '/component/date#date' : pk;
                }
            }
            else if (key === 'output') {
                e.Output = { data: value };
                pk = isPk ? '/component/output#data' : pk;
            }
            else if (key === 'mime') {
                applyToCom(e, 'Dst', { mime: value }, false);
            }
            else if (key === 'tags') {
                await applyTags(es, e, value, selectOptions);
            }
            else if (key === 'layout') {
                await applyLayout(es, e, value, selectOptions);
            }
            else if (key === 'upd') {
                e.Upd = { op: toInteger(value) };
            }
            else {
                meta[key] = value;
            }
        }
        if (Object.keys(meta).length > 0) {
            applyMeta(e, meta);
        }
    }

    // if a primary key was specified, lookup the e to which it
    // refers
    if (e.id === 0 && pk !== undefined) {
        // check the ES for an existing entity with this component

        // get the value of this entity
        let val = getEntityAttribute(es, e, pk);

        // log('pk', e.id, pk, val );

        let ex = await getEntityByUrl(es, pk, val);

        if (ex !== undefined) {
            e = copyEntity(es, e, undefined, ex.id);
        }
    }

    // remove any excludeListed coms from the entity
    if (excludeList !== undefined) {
        const dids = bfToValues(excludeList);
        // console.log('excludeList dids', dids);
        let ce = es.createEntity(e.id);
        for (const [did, com] of e.components) {
            if (dids.indexOf(did) === -1) {
                ce.addComponentUnsafe(com);
            }
        }
        e = ce;
    }

    if (addToES) {
        if (siteRef !== undefined) {
            e.SiteRef = { ref: siteRef };
        }

        // if we couldn't insert the layout earlier because the e had not
        // yet been created, then read it from meta
        const { layout, tags, ...meta } = e.Meta?.meta ?? {};
        if (layout || tags ) {
            e.Meta = Object.keys(meta).length > 0 ? { meta } : undefined;
        }

        // apply, dont replace, to existing e
        await es.add(Array.from(e.components.values()));

        // printEntity(es, e);
        // await es.add( e );
        eid = es.getUpdatedEntities()[0];

        // if we couldn't insert the layout earlier because the e had not
        // yet been created, then insert it now
        if (layout) {
            const layoutEid = await findEntityBySrcUrl(es, layout, selectOptions);
            if (layoutEid !== undefined) {
                // log('add layout', eid, layoutEid );
                await insertDependency(es, eid, layoutEid, 'layout');
            } else {
                // log('could not find layout', layout);
            }
        }

        if( tags ){
            await addTags( es, eid, tags, options );
        }

        // log('added', eid, await es.getEntity(eid));
        return es.getEntity(eid);
    }

    return e;
}

function applyUrlToCom(e: Entity, name: string, url: string, overwrite: boolean = false) {
    if (/^.*:\/\//.exec(url) === null) {
        // url = pathToFileURL( url ).href;
        if (!url.startsWith(Path.sep)) {
            url = `${Path.sep}${url}`;
        }
        url = `file://${url}`;
    }

    return applyToCom(e, name, { url }, overwrite);
}

function applyToCom(e: Entity, name: string, attrs: any, overwrite: boolean = true) {
    let com = e[name] ?? {};
    com = overwrite ? { ...attrs } : { ...com, ...attrs };
    e[name] = com;
    return e;
}


async function applyLayout(es: QueryableEntitySet, e: Entity, url: string, options: FindEntityOptions = {}) {
    let { srcUrl } = options;
    srcUrl = srcUrl ?? e.Src?.url ?? '';

    url = resolveUrlPath(url, srcUrl);

    // find the entity matching the layout
    const layoutEid = await findEntityBySrcUrl(es, url, options);

    if (e.id === 0) {
        // log('[applyLayout]', url, 'e not yet present', layoutEid);
        applyMeta(e, { layout: url });
        return e;
    }

    if (layoutEid !== undefined) {
        await insertDependency(es, e.id, layoutEid, 'layout');
    } else {
        log('[applyLayout]', 'could not find layout for', url);
        log('[applyLayout]', 'reading from', srcUrl);

        throw new Error('layout path not found');
    }
    return e;
}


async function applyTags(es: QueryableEntitySet, e: Entity, tags: string | string[], options: FindEntityOptions = {}) {

    if (e.id === 0) {
        // log('[applyTags]', 'e not yet present', tags);
        applyMeta(e, { tags });
        return e;
    }

    return addTags(es, e.id, tags, options);
}


async function addTags(es: QueryableEntitySet, eid: EntityId, tags: string | string[], options: FindEntityOptions = {}) {
    let names: string[] = isString(tags) ? [tags as string] : tags as string[];

    // get rid of duplicates
    names = Object.values(names.reduce((r, tag) => {
        r[slugify(tag)] = tag;
        return r;
    }, {}));

    for (const tag of names) {
        let etag = await selectTagBySlug(es, tag, options);
        if (etag === undefined) {
            etag = await createTag(es, tag, options);
        }

        // log('[addTags]', '', tag, eid, etag.id);

        await insertDependency(es, eid, etag.id, 'tag');
    }
}




// function parseUrl( rootPath:string, url:string ){
//     if( url.startsWith('file://') ){
//         return url;
//     }
//     // log('[parseUrl]', url);
//     // if( !Path.isAbsolute(url) ){
//     //     url = Path.join(rootPath, url);
//     // }
//     return pathToFileURL( url ).href;
// }


export type ParseType = 'yaml' | 'toml' | 'text/yaml' | 'text/toml';

/**
 * 
 * @param data 
 * @param type 
 */
export function parseConfigString(data: string, type: ParseType = 'yaml') {
    if (type == 'toml' || type == 'text/toml') {
        try {
            return Toml.parse(data);
        } catch (err) {
            log('[parse] error', err);
            return undefined;
        }
    }
    else if (type === 'yaml' || type === 'text/yaml') {
        try {
            return Yaml.parse(data);
        }
        catch (err) {
            log('[parse] error', err);
            return undefined;
        }
    }
}

export function getPtr(data: any, path: string) {
    return Jsonpointer.get(data, path);
}

async function getEntityByUrl(es: QueryableEntitySet, url: string, val: string) {
    const q = `[ ${url} !ca ${stringify(val)} == @e ] select`;
    const stmt = es.prepare(q);
    const ents = await stmt.getEntities();
    return ents.length > 0 ? ents[0] : undefined;
}

function copyEntity(es: QueryableEntitySet, src: Entity, dst?: Entity, id?: EntityId) {
    let e = es.createEntity(id ?? src.id);
    for (const [did, com] of src.components) {
        // log('adding', getEntityId(e) );
        e.addComponentUnsafe(com);
    }
    return e;
}