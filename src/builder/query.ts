import Path from 'path';

import {
    createStdLibStack,
    Component, getComponentEntityId, setEntityId,
    Entity, EntityId, isEntity,
    QueryableEntitySet,
    QueryStack,
    StackValue,
    Statement,
    SType
} from "../es";
import { Site } from "./site";
import { extensionFromMime, uriToPath } from './util';
import { DependencyType, ProcessOptions } from './types';
import { BitField } from "@odgn/utils/bitfield";
import { hash, hashToString, parseUri, slugify, toBoolean } from '@odgn/utils';





export interface FindEntityOptions {
    siteRef?: EntityId;
    title?: string;
    onlyUpdated?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    srcUrl?: string;
    eids?: EntityId[];
    debug?: boolean;
}

export interface ParseOptionsOptions extends FindEntityOptions {
    warnOnEmptyRef?: boolean;
}

function parseOptions(options: FindEntityOptions = {}, throwOnMissingRef:boolean = true) {
    const ref = options.siteRef ?? 0;
    const onlyUpdated = options.onlyUpdated ?? false;
    const eids = options.eids;
    if (ref === 0 && throwOnMissingRef) {
        // console.warn('[parseOptions]', 'empty siteRef passed');
        throw new Error('[parseOptions] empty siteRef passed');
    }
    return { ref, onlyUpdated, eids };
}


let esStacks: Map<string, QueryStack> = new Map<string, QueryStack>();
// let stack: QueryStack;
let qCache: Map<string, StackValue[]> = new Map<string, StackValue[]>();

/**
 * Prepares a query statement
 * 
 * @param es 
 * @param q 
 * @returns 
 */
export function prepare(es: QueryableEntitySet, q: string, cache: boolean = true, options: FindEntityOptions = {}): Statement {
    
    let stack = esStacks.get(es.getUrl());

    if (stack === undefined) {
        stack = createStdLibStack();

        stack = stack.addWord('lookupMimeExt', (stack) => {
            const mime = stack.popValue();
            const ext = extensionFromMime(mime);
            return [SType.Value, ext];
        });

        stack = stack.addWord('findByTags', async (stack) => {
            let tags = stack.popValue();
            tags = Array.isArray(tags) ? tags : [tags];
            const eids = await findEntitiesByTags( es, tags, options );
            return [SType.List, eids];
        });

        let ref = options.siteRef;
        stack = stack.addWord('getRef', (stack) => {
            return [SType.Value, ref ];
        });

        // stack.addUDWord('bogus', [SType.Value, true]);

        esStacks.set(es.getUrl(), stack);
    }

    if( q === undefined ){
        return undefined;
    }

    let insts: StackValue[];

    if (cache) {
        // let id = hash(q, true) as string;
        insts = qCache.get(q);
        // if( insts !== undefined ) console.log('[prepare]', 'cache hit', q );
    }


    if (insts === undefined) {
        // console.log('[prepare]', {hit:insts !== undefined}, q );
        // stack._stacks[0].id = 0;
    }

    // console.log('[prepare]', {hit:insts !== undefined}, q );
    const stmt = es.prepare(q, { stack, insts });

    if (cache && insts === undefined) {
        qCache.set(q, stmt.insts);
    }

    return stmt;
}



export async function selectTagBySlug(es: QueryableEntitySet, name: string, options: FindEntityOptions = {}) {
    const slug = slugify(name);
    const { ref } = parseOptions(options);

    const stmt = prepare(es, `
    [
        /component/tag#slug !ca $slug ==
        /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select
    `);

    return await stmt.getEntity({ ref, slug });
}

export interface FindEntitiesByTagsOptions extends FindEntityOptions {
    mode?: 'AND'|'OR';
}

/**
 * Returns EntityIds which have all of the specified tags
 * 
 * @param es 
 * @param tags 
 * @param options 
 */
export async function findEntitiesByTags(es: QueryableEntitySet, tags: string[], options: FindEntitiesByTagsOptions = {}): Promise<EntityId[]> {
    const { ref } = parseOptions(options, false);
    const mode = options.mode ?? 'AND';

    const q = `
    // since this may be called as directly, or as a word, $ref wont always be set
    // getRef is defined in prepare
    getRef $ref or ref let

    es let
    [
        $es [
            /component/tag#slug !ca *^$1 ==
            /component/site_ref#ref !ca $ref ==
            and
            @eid 
        ] select swap drop
        [ drop false @! ] swap size 0 == rot swap if
        pop!
        @>
    ] *selectTagBySlug define

    [
        $es [
            /component/dep#dst !ca *^$1 ==
            @eid /component/dep#src @ca
        ] select swap drop
        // [ drop [] @! ] swap size 0 == rot swap if
        
        @>
    ] *selectTagDepByDst define

    // first, resolve the incoming slugs to tag eids
    $tags *selectTagBySlug map

    // remove empty results
    [ false != ] filter

    [] // reduce result
    [
        swap *selectTagDepByDst
        [ [union!] ] [ [intersect!] ] $mode "AND" == iif
        
        // [ intersect! ] [ + ] *%3 size 0 == swap drop iif
        [ + ] *%3 size 0 == swap drop  iif
        // [ union! ] [ + ] *%3 size 0 == swap drop  iif
        
    ] reduce
    
    unique // get rid of dupes
    `;

    
    const stmt = prepare(es, q);
    return await stmt.getResult({ ref, tags, mode });
}



export async function selectMeta(es: QueryableEntitySet, options: FindEntityOptions = {}) {
    const { ref } = parseOptions(options);


    const stmt = prepare(es, `
    [
        /component/site_ref#ref !ca $ref ==
        /component/meta !bf
        // [/component/meta /component/upd] !bf
        // and
        @c
    ] select
    `);

    return await stmt.getResult({ ref });
}



export async function selectTitleAndMeta(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const query = `
        [
            /component/site_ref#ref !ca $ref ==
            [ /component/title /component/dst  ] !bf 
            @e
        ] select
        
        // /@e pluck
        // rot [ *^$1 /component/dst !bf @c ] select rot +
    `;

    return await prepare(es, query).getEntities({ ref });
}


/**
 * Returns Output Components which have a /dst
 * @param es 
 * @param options 
 * @returns 
 */
export async function selectOutputWithDst(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const q = onlyUpdated ? `
        [ 
            [ /component/dst /component/output /component/upd ] !bf 
                        /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            @eid
        ] select
        swap [ *^$1 @eid /component/output !bf @c ] select
    `
        : `
    [ 
            [ /component/dst /component/output ] !bf 
            /component/site_ref#ref !ca $ref ==
        and
        @eid
    ] select
    swap [ *^$1 @eid /component/output !bf @c ] select
    `

    return await prepare(es, q).getResult({ ref });
}

/**
 * Returns /component/src which belong to an entity which has /dst and /static
 * 
 * @param es 
 * @param options 
 */
export async function selectStaticWithDst(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const q = onlyUpdated ? `
        [ 
            [ /component/src /component/static ] !bf 
                        /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            @eid
        ] select
        swap [ *^$1 @eid /component/src !bf @c ] select
    `
        : `
    [ 
        [ /component/src /component/static ] !bf
        /component/site_ref#ref !ca $ref ==
        @eid
    ] select
    
    swap [ *^$1 @eid /component/src !bf @c ] select
    `

    return await prepare(es, q).getResult({ ref });
}

export async function selectMetaSrc(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const q = onlyUpdated ? `
    [
                /component/src#url !ca ~r/meta.(?:toml)?(?:yaml)?$/ ==
                [/component/src /component/upd] !bf // ensure it has both components
            and
                    /component/upd#op !ca 1 ==
                    /component/upd#op !ca 2 ==
                or
                /component/site_ref#ref !ca $ref ==
            and
        and
        @c
    ] select
    ` : `
    [
                /component/src#url !ca ~r/meta.(?:toml)?(?:yaml)?$/ ==
                [/component/src /component/upd] !bf // ensure it has both components
            and
            /component/site_ref#ref !ca $ref ==
        and
        @c
    ] select
    `;


    return await prepare(es, q).getEntities({ ref });
}



export async function selectMetaDisabled(es: QueryableEntitySet): Promise<EntityId[]> {
    const stmt = prepare(es, `[
        /component/status#is !ca active !=
        // /component/meta#/meta/isEnabled !ca false ==
        @eid
    ] select`);

    return await stmt.getResult();
}


export async function selectJsx(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated, eids } = parseOptions(options);
    let q: string;

    if (eids !== undefined) {
        q = `[
            $eids
            /component/jsx !bf
            @e
        ] select`
    } else if (onlyUpdated) {
        q = `
        [
                    /component/jsx !bf
                        /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            @e 
        ] select`;
    } else {
        q = `[
            /component/jsx !bf
            /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select`
    }

    return await prepare(es, q).getEntities({ ref, eids });
}

export async function selectMdx(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    let q = onlyUpdated ? `
        [
            /component/mdx !bf
                    /component/upd#op !ca 1 ==
                    /component/upd#op !ca 2 ==
                or
                /component/site_ref#ref !ca $ref ==
            and
        and
        
        @e ] select` :
        `[
                /component/mdx !bf
                /component/site_ref#ref !ca $ref ==
            and
            @e
        ] select`;

    return await prepare(es, q).getEntities({ ref });
}


export async function selectClientCode(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);
    let q: string;

    if (onlyUpdated) {
        q = `
        [
            /component/upd#op !ca 1 ==
            /component/upd#op !ca 2 ==
            or
            /component/site_ref#ref !ca $ref ==
            and
            /component/client_code !bf
            @c
        ] select
        `
    } else {
        q = `[    
            /component/site_ref#ref !ca $ref ==
            /component/client_code !bf
            @c
        ] select`;
    };


    return prepare(es, q).getResult({ ref });
}



export async function selectJs(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated, eids } = parseOptions(options);

    let q: string;

    if (eids !== undefined) {
        q = `[
            $eids
            /component/js !bf
            @e
        ] select`
    } else if (onlyUpdated) {
        q = `
        [
                    /component/js !bf
                        /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            @e 
        ] select
        `;
    } else {
        q = `[
            /component/js !bf
            /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select`
    }

    return await prepare(es, q).getEntities({ ref, eids });
}




export async function selectMdxSrc(es: QueryableEntitySet, options: FindEntityOptions = {}) {
    const { ref, onlyUpdated } = parseOptions(options);

    let q = onlyUpdated ? `
        [
            /component/src#url !ca ~r/.mdx$/ ==
                    /component/upd#op !ca 1 ==
                    /component/upd#op !ca 2 ==
                or
                /component/site_ref#ref !ca $ref ==
            and
        and
        /component/src !bf
        @c ] select` : `
        [
                /component/src#url !ca ~r/.mdx$/ ==
                /component/site_ref#ref !ca $ref ==
            and
            /component/src !bf
            @c
        ] select`;

    return await prepare(es, q).getResult({ ref });
}



// export async function selectScss(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
//     const { ref, onlyUpdated } = parseOptions(options);

//     let q = onlyUpdated ? `
//         [
//                 /component/upd#op !ca 1 ==
//                 /component/upd#op !ca 2 ==
//             or
//             /component/site_ref#ref !ca $ref ==
//         and
//         [/component/scss /component/src] !bf
//         @c 
//         ] select` :
//         `[
//             /component/site_ref#ref !ca $ref ==
//             [/component/scss /component/src] !bf
//             @c
//         ] select`;

//     return await prepare(es, q).getEntities({ ref });
// }


export async function selectErrors(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref } = parseOptions(options);

    let q = `[
        /component/site_ref#ref !ca $ref ==
        /component/error !bf
        @c
        ] select`;

    return await prepare(es, q).getResult({ ref });
}

export async function selectSrc(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);
    let q: string;

    if (onlyUpdated) {
        q = `
        [
                            /component/upd#op !ca 1 ==
                            /component/upd#op !ca 2 ==
                        or
                        /component/upd#op !ca 4 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            [/component/src /component/dst] !bf !or
            @c
        ] select`;
    } else {
        q = `
        [
            /component/site_ref#ref !ca $ref ==
            [/component/src /component/dst] !bf !or
            @c
        ] select`;
    }

    return await prepare(es, q).getResult({ ref });
}

/**
 * Returns /component/src components with the given file extensions
 * 
 * @param es 
 * @param ext
 * @param options 
 */
export async function selectSrcByExt(es: QueryableEntitySet, ext: string[], options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const regexExt = ext.join('|');

    let q = onlyUpdated ? `
        [
                /component/src#/url !ca ~r/^.*\.(${regexExt})$/i ==
                /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            /component/src !bf
            @c 
        ] select`
        : `
    [
            /component/src#/url !ca ~r/^.*\.(${regexExt})$/i ==
            /component/site_ref#ref !ca $ref ==
        and
        /component/src !bf
        @c 
    ] select`;

    // console.log('[selectSrcByExt]', ref, q);
    return await prepare(es, q, false).getResult({ ref }, true);
}

export async function selectSrcByMime(es: QueryableEntitySet, mime: string[], options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const regexExt = mime.join('|');

    let q = onlyUpdated ? `
        [
                /component/src#/mime !ca ~r/^(${regexExt})$/i ==
                /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            /component/src !bf
            @c 
        ] select`
        : `
    [
        
            /component/src#/mime !ca ~r/^(${regexExt})$/i ==
            /component/site_ref#ref !ca $ref ==
        and
        /component/src !bf
        
        @c 
    ] select`;

    // console.log('[selectSrcByExt]', ref, q);
    return await prepare(es, q, false).getResult({ ref });
}

export async function selectEntitiesByMime(es: QueryableEntitySet, mime: string[], options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const regexExt = mime.join('|');

    let q = onlyUpdated ? `
        [
                /component/src#/mime !ca ~r/^(${regexExt})$/i ==
                /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            /component/src !bf
            @e
        ] select`
        : `
    [
        
            /component/src#/mime !ca ~r/^(${regexExt})$/i ==
            /component/site_ref#ref !ca $ref ==
        and
        /component/src !bf
        @e
    ] select`;
    return await prepare(es, q, false).getEntities({ ref });
}


export interface FindEntityFilenameOptions extends FindEntityOptions {
    ignoreExt?: boolean;
}

/**
 * Returns /component/src components with the given file names
 * @param es 
 * @param names 
 * @param options 
 */
export async function selectSrcByFilename(es: QueryableEntitySet, names: string[], options: FindEntityFilenameOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const regexExt = names.join('|');
    const regex = toBoolean(options.ignoreExt) ? `~r/^.*(${regexExt}).*/i` : `~r/^.*(${regexExt})$/i`;

    // console.log('[selectSrcByFilename]', regexExt, ref);
    let q = onlyUpdated ? `
        [
                /component/src#/url !ca ${regex} ==
                        /component/upd#op !ca 1 ==
                        /component/upd#op !ca 2 ==
                    or
                    /component/site_ref#ref !ca $ref ==
                and
            and
            /component/src !bf
            @c 
        ] select`
        : `
    [
            /component/src#/url !ca ${regex} ==
            /component/site_ref#ref !ca $ref ==
        and
        /component/src !bf
        @c
    ] select`;

    return await prepare(es, q, false).getResult({ ref });
}




export async function selectDstEntityIds(es: QueryableEntitySet): Promise<EntityId[]> {

    const q = `
        [ [ /component/dst ] !bf @eid] select
    `;

    const stmt = prepare(es, q);
    return await stmt.getResult();
}


/**
 * Finds an entity by its /component/src#/url ignoring any file extension
 * 
 * @param es 
 * @param path 
 * @param options 
 */
export async function findEntityBySrcUrl(es: QueryableEntitySet, path: string, options: FindEntityOptions = {}): Promise<EntityId> {
    const { ref } = parseOptions(options);

    // convert to an extension-less path
    path = uriToPath(path);
    const ext = Path.extname(path);
    path = path.substring(0, path.length - ext.length);
    // log('[findEntityBySrcUrl]', path,  );

    const query = `
    // compose the RE
    ["^.*://"] $path + ".*" + "" join !r

    // make sure the ES is before the select
    swap
    [
        /component/site_ref#ref !ca $ref ==
        /component/src#url !ca *^$1 ==
        and
        @eid
    ] select`;

    const stmt = prepare(es, query);
    const r = await stmt.getResult({ ref, path });
    return r.length > 0 ? r[0] : undefined;
}


export async function getEntityBySrcUrl(es: QueryableEntitySet, url: string, options: FindEntityOptions = {}): Promise<Entity> {
    const { ref, onlyUpdated } = parseOptions(options);

    const query = `
    [
        /component/site_ref#ref !ca $ref ==
        /component/src#url !ca $url ==
        and
        @e
    ] select`;

    const stmt = prepare(es, query);
    const r = await stmt.getEntities({ ref, url });
    return r.length > 0 ? r[0] : undefined;
}



/**
 * 
 * @param es 
 * @param url 
 * @param options 
 */
export async function findEntityByUrl(es: QueryableEntitySet, url: string, options: FindEntityOptions = {}): Promise<Entity> {

    // file:///file:///pages/main.mdx - ref to File component
    // e://component/file?url=file:///pages/main.mdx - address an entity
    // https://news.bbc.co.uk/ - external

    if (url.startsWith('/')) {
        const eid = await findEntityBySrcUrl(es, url, options);
        return eid !== undefined ? await es.getEntity(eid) : undefined;
    }

    let { protocol, host, path, anchor: attr, queryKey } = parseUri(url);

    if (protocol === 'file') {
        return await getEntityBySrcUrl(es, url, options);
    }

    if (protocol === 'https' || protocol === 'http') {
        // const cUrl = `${protocol}://${host}${path}`;
        let e = await getEntityByUrl(es, url);
        if (e === undefined) {
            e = es.createEntity();
            e.Url = { url };
            if (options.title) {
                e.Title = { title: options.title };
            }
            await es.add(e);
            let eid = es.getUpdatedEntities()[0];
            return await es.getEntity(eid, true);
        }
        return e;
    }

    // log('[findEntityByUrl]', { protocol, host, path, queryKey });

    return undefined;
}

/**
 * Returns an existing /component/url with the given url
 * 
 * @param es 
 * @param url 
 * @param options 
 * @returns 
 */
export async function getUrlComponent(es: QueryableEntitySet, url: string, options: FindEntityOptions = {}) {
    const { ref, onlyUpdated } = parseOptions(options);
    const stmt = prepare(es, `
    [
        // urls dont have a siteref
        // /component/site_ref#ref !ca $ref ==
        /component/url#url !ca $url ==
        @c
    ] select
    `);
    const r = await stmt.getResult({ ref, url });
    return r.length > 0 ? r[0] : undefined;
}


export async function getEntityByUrl(es: QueryableEntitySet, url: string) {
    const stmt = prepare(es, `
    [
        /component/url#url !ca $url ==
        @e
    ] select
    `);
    const r = await stmt.getEntities({ url });
    return r.length > 0 ? r[0] : undefined;
}




export async function buildSrcIndex(site: Site) {
    const ref = site.getRef();
    const query = `

    [
        /component/site_ref#ref !ca $ref ==
        /component/src !bf
        and
        @e
    ] select
    [ /component/src#url /id /component/src#/mime /bitField ] pluck
    `;

    return await site.addQueryIndex('/index/srcUrl', query, { ref });
}


export async function buildSrcUrlIndex(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<[string, EntityId, string, BitField][]> {
    const { ref } = parseOptions(options);

    const query = `
    [ 
        [/component/src /component/ftimes /component/site_ref] !bf 
        @e 
    ] select

    [ /component/src#/url /id /component/ftimes#/mtime /bitField ] pluck!
    `;

    // console.log('[buildSrcUrlIndex]', 'with', es);
    const stmt = prepare(es, query);
    let result = await stmt.getResult({ ref });
    if (result.length === 0) {
        return result;
    }
    // make sure we have an array of array
    return Array.isArray(result[0]) ? result : [result];
}

export async function selectFiles(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Entity[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const q = onlyUpdated ? `[
        /component/upd#op !ca 2 ==
        /component/upd#op !ca 1 ==
        or
        /component/site_ref#ref !ca $ref ==
        and
        /component/src !bf 
        and
        @e
    ] select`
        : `[
        /component/site_ref#ref !ca $ref ==
        /component/src !bf 
        and
        @e
    ] select`

    return await prepare(es, q).getEntities({ ref });
}


/**
 * Selects /component/src which have a file:// url
 * 
 * @param es 
 */
export async function selectFileSrc(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    const q = onlyUpdated ? `[
        /component/upd#op !ca 2 ==
        /component/upd#op !ca 1 ==
        or
        /component/src#url !ca ~r/^file\:\/\// ==
        and
        /component/src !bf
        @c
    ] select`
        : `[
            /component/src#url !ca ~r/^file\:\/\// ==
            /component/src !bf
            @c
        ] select
        `;

    const stmt = prepare(es, q);

    return await stmt.getResult({ ref });
}


export async function selectSrcByUrl(es: QueryableEntitySet, url: string): Promise<Component> {
    const stmt = prepare(es, `[
        /component/src#url !ca $url ==
        /component/src !bf
        @c
    ] select`);

    let res = await stmt.getResult({ url });
    return res.length > 0 ? res[0] : undefined;
}

export async function selectSrcByEntity(es: QueryableEntitySet, e: EntityId | Entity): Promise<string> {
    const eid = isEntity(e) ? (e as Entity).id : e as EntityId;
    const stmt = es.prepare(`[
        $eid @eid
        /component/src !bf
        @c
    ] select /url pluck!`);

    let res = await stmt.getResult({ eid });
    return res.length > 0 ? res[0] : undefined;
}

export async function selectOutputByEntity(es: QueryableEntitySet, e: EntityId | Entity): Promise<[string, string]> {
    const eid = isEntity(e) ? (e as Entity).id : e as EntityId;
    const stmt = prepare(es, `[
        $eid @eid
        /component/output !bf
        @c
    ] select [/data /mime] pluck!`);

    let res = await stmt.getResult({ eid });
    return res.length > 0 ? res[0] : undefined;
}





/**
 * Returns an Entity by its Src Url
 * @param site 
 * @param url 
 * @param options 
 */
export async function selectEntityBySrc(site: Site, url: string, options: FindEntityOptions = {}): Promise<(Entity | EntityId)> {
    const { es } = site;
    const { ref } = parseOptions(options);
    // const {ref, onlyUpdated} = parseOptions(options);

    // const stmt = prepare(es, `
    const stmt = es.prepare(`
        [
            /component/src#/url !ca $url ==
            /component/site_ref#/ref !ca $ref ==
            and
            @c
        ] select
    `);
    let com = await stmt.getResult({ url, ref });
    com = com.length === 0 ? undefined : com[0];


    if (com === undefined) {
        if (!options.createIfNotFound) {
            // console.log('[selectSiteSrcByUrl]', 'nope', {url,ref});
            // log( stmt );
            return undefined;
        }
        let e = es.createEntity();
        e.Src = { url };
        let btime = new Date().toISOString();
        let mtime = btime;
        e.Ftimes = { btime, mtime };
        e.SiteRef = { ref };
        return e;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }

    const e = es.getEntity(eid);
    return e;
}



/**
 * Returns an absolute path for the given entity by looking at /component/src, 
 * and /component/dst.
 * 
 * wont return anything if the entity does not have a filename dst
 */
export async function getDstUrl(es: QueryableEntitySet, eid: EntityId, options: FindEntityOptions = {}): Promise<string | undefined> {
    const debug = options.debug;
    // TODO - a complex statement which has many words which should be
    // predefined

    const stmt = prepare(es, `
    [] paths let
    "" filename let

    // ( str -- str|false )
    [ ~r/^\/|file:\/\/\// eval ] *selectAbsUri define

    [ false true rot ~r/^\/|file:\/\/\// eval iif ] *isAbsPath define

    [ false true rot ~r/^[^\/]*$/ eval iif ] *isFilename define

    [ "" swap ~r/^\\/+/ replace ] *removeLeadingSlash define

    [ "" swap ~r/\\/$/ replace ] *removeTrailingSlash define

    [ $paths "" join ] *pathsToStr define

    // (str -- str)
    [
        dup isAbsPath
        [["/" *^^$0] "" join ] swap false == if
    ] *ensureLeadingSlash define


    [ $paths + paths ! ] *addToPaths define
    
    // returns the src url from an entity
    // ( es eid -- es str|false )
    [
        
        swap [ *^$1 @eid /component/src#url @ca ] select pop? swap drop
        dup [ drop false @! ] swap undefined == if
        @>
    ] *selectSrcUrl define

    // returns the mime from /component/output
    // ( es eid -- es str|false )
    [
        swap [ *^$1 @eid /component/output#mime @ca ] select pop? swap drop
        
        dup [ drop false @! ] swap undefined == if
        @>
    ] *selectOutputMime define

    // returns the target url from an entity
    // ( es eid -- es str|false )
    [
        swap [ *^$1 @eid /component/dst#url @ca ] select pop? swap drop
        
        // if no /dst component exists, return undefined
        // taking care to drop the empty result
        dup [ drop false @! ] swap undefined == if

        @> // restart exec after @!
        
    ] *selectDstUrl define


    // selects the parent entity, or false if none is found
    // ( es eid -- es eid|false )
    [
        swap
        [
            /component/dep#src !ca *^%1 ==
            /component/dep#type !ca dir ==
            and
            /component/dep !bf
            @c
        ] select
        rot swap 
        // -- es eid [coms]
        
        // if the size of the select result is 0, then return false
        size 0 == [ drop drop false @! ] swap if
        pop!
        /dst pluck!

        // "select dep".
        // prints
        // "halt right there" throw

        [ ["src === dst error" *^%1 ] to_str! throw ] *%2 *%2 == if
        
        *$1 drop // rid of the original eid

        

        @>
    ] *selectParent define

    // if /component/dst exists, add to paths.
    // returns "abs" if the target uri is absolute, "rel" if
    // relative, and false if it doesn't exist
    // es eid -- es eid "abs"|"rel"|false
    [ 
        // to order eid es eid
        dup rot rot

        selectDstUrl
        
        dup
        
        // if no /dst exists, return false
        [ drop swap false @! ] swap false == if
        
        selectFilenameAndPath
        
        dup [ drop swap false @! ] swap size! 0 == if
        
        dup isAbsPath
        
        // if abs path, add to result, return true
        [ addToPaths swap "abs" @! ] swap if
        
        // relative path
        addToPaths swap "rel"
        @>
        
    ] *handleDst define


    // es eid -- es eid|false
    [           
        selectParent

        // if no parent, stop execution
        [ @! ] *%1 false == if

    ] *handleParent define

    // ( str|false -- )
    [
        [ drop @! ] *%1 false == if
        // if we already have a filename, return
        [ drop @!] $filename size! 0 != if
        filename !
        @>
    ] *setFilename define

    // ( str -- str|false )
    [
        ~r/(?!\/$)(?:.*\/)?(.*)/ eval
        dup [ drop @! ] swap false == if
        pop!
        size [ drop false @! ] swap 0 == if
        @>
    ] *filenameFromPath define

    // takes a path, extracts the filename and sets it if exists
    // returns the path without filename
    // ( str -- str )
    [
        ~r/(.*\\/)?(.*)/ eval
        dup [ drop @! ] swap false == if
        
        pop // filename
        setFilename
        pop!
        
        dup [ drop "" @! ] swap undefined == if
        
        @>
    ] *selectFilenameAndPath define


    // ( es eid -- es eid filename|false )
    [
        // [[ "selectFileNameFromOutput" *^%0 ] to_str! .] $debug if
        selectFilenameFromSrc
        

        *$1 *%2 selectOutputMime

        // ( eid filename es mime -- )
        // return if false
        [ drop swap drop swap false @! ] *%1 false == if
        
        lookupMimeExt
        // -- eid fname es ext
        
        *$2 ~r/(.+?)(\.[^.]*$|$)/ eval spread drop *$1 drop 
        // note the ugly double escape to prevent
        [] + swap +  **. join
        
        // clear eid so result is -- es filename
        *$2 drop
        
        @>
    ] *selectFilenameFromOutput define
    

    // ( es eid -- es eid filename|false )
    [
        
        dup *$2 *$1 selectSrcUrl

        
        [ drop swap false @! ] *%1 false == if
        
        filenameFromPath

    ] *selectFilenameFromSrc define
    
    

    // iterate up the dir dependency tree
    $eid
    [
        
        // examine /component/dst and add to the result
        // if it exists
        handleDst

        // ( es eid "abs"|"rel"|false -- )

        // if the dst exists and is absolute, then we have
        // finished
        [ drop @! ] *%1 "abs" == if
        
        // ( es eid false --  )
        
        // drop the false result
        [ drop ] *%1 false == if
        [ drop ] *%1 rel == if
        
        // find the parent dir using deps
        
        handleParent
        
        true // loop only continues while true
    ] loop

    // drop the false result back from handleParent
    [ drop $eid ] %1 false == if

    // the top value will be the last eid - parent
    drop $eid

    // ( es eid --  )
    
    pathsToStr size! 0 > hasPath let

    
    // lookup filename from output
    [ 
    
        selectFilenameFromOutput 
        
        // [ "select fname is" *^%0 ] to_str! .
        setFilename
    ] $filename size! 0 == $hasPath and if
    
    
    // [ $filename size! 0 == hasPath and ] $debug if
    
    
    // lookup filename from src providing we have a path
    [   
        selectFilenameFromSrc

        setFilename
        // $paths "" join [ "path is" *^$1 ] to_str! .
    ] $filename size! 0 == $hasPath and if

    
    // if no filename is found, then quit
    [ undefined @! ] $filename size! 0 == if
    
    
    pathsToStr $filename +

    dup [ drop undefined @! ] swap size! 0 == if
    ensureLeadingSlash
    
    @>
    // [ "ok done" $eid *^%0 ] to_str! .
    `);


    const dirCom = await stmt.getResult({ eid });
    return dirCom && dirCom.length > 0 ? dirCom : undefined;
}


/**
 * Inserts a Dependency Entity if one does not already exist
 * @param es 
 * @param src 
 * @param dst 
 * @param type 
 */
export async function insertDependency(es: QueryableEntitySet, src: EntityId, dst: EntityId, type: DependencyType, extra?: Component[]): Promise<EntityId> {
    if (src === 0 || dst === 0) {
        return 0;
    }
    if (src === dst) {
        return 0;
    }

    let depCom = await getDependencyComponent(es, src, dst, type);

    // const layoutEid = await getDependency(es, src, type);
    if (depCom !== undefined) {
        return getComponentEntityId(depCom);
    }

    // let e = es.createEntity();
    let com = es.createComponent('/component/dep', { src, dst, type });

    await es.add(extra ? [com, ...extra] : com);

    let reid = es.getUpdatedEntities()[0];

    return reid;
}

/**
 * Removes a dependency entity
 * 
 * @param es 
 * @param eid 
 * @param type 
 */
export async function removeDependency(es: QueryableEntitySet, eid: EntityId, type: DependencyType) {
    const dstEid = await getDependency(es, eid, type);
    if (dstEid === undefined) {
        return false;
    }
    await es.removeEntity(dstEid);
    return true;
}



/**
 *  
 */
export async function getDependency(es: QueryableEntitySet, eid: EntityId, type: DependencyType): Promise<EntityId> {
    const depId = await getDependencies(es, eid, [type], true) as EntityId[];
    return depId.length > 0 ? depId[0] : undefined;
}




export async function getLayoutFromDependency(es: QueryableEntitySet, eid: EntityId): Promise<Entity> {
    // eid = 0;
    const stmt = prepare(es, `
    [
        /component/dep#src !ca $eid ==
        /component/dep#type !ca "layout" ==
        and
        @c
    ] select
    
    /dst pluck!
    
    // exit with undefined if nothing was found
    dup [ undefined @! ] swap [] == if
    
    // select the entity
    pop!
    `);
    return await stmt.getEntity({ eid });
}

export interface ApplyDepUpdateOptions extends ProcessOptions {
    exclude?: DependencyType[];
}

/**
 * - select entity ids that are marked as updated
 * - for each eid, select /deps which have matching dst
 * - take the src eids, add upd coms with same op
 * - take the src eids add to update list
 * 
 * @param site 
 */
export async function applyUpdatesToDependencies(site: Site, options: ApplyDepUpdateOptions = {}) {
    let exclude = options.exclude;

    const regexExt = exclude !== undefined ? exclude.join('|') : undefined;

    const stmt = prepare(site.es, `

        // returns [eid,op] of all entities which have an update
        [
            $es [ /component/upd !bf @c ] select
            [ /@e /op ] pluck!
        ] *selectUpdates define


        // selects /dep which match the eid and returns the src
        // es eid -- es [ eid ]
        [
            // ["eid is" *^%0] to_str! .
            swap [
                /component/dep#dst !ca *^$1 ==
                /component/dep#type !ca ~r/^(?!${regexExt}).+/i ==
                and
                /component/dep#src @ca
            ] select
            // ["result is" *^%0] to_str! .
        ] *selectDepSrcExclude define

        // adds the op to each of the eids
        // eids op -- [ eid, op ]
        [
            swap [ [] + *^%0 + ] map
            swap drop
        ] *applyOp define

        // adds a /upd to the e
        // [eid,op] -- 
        [
            spread
            [ op *^$0 @e *^$0 ] eval to_map
            [] /component/upd + swap + $es swap !c + drop
        ] *addUpdCom define

        // set the es as a word - makes easier to reference
        es let
        // 0 count let
        [] visited let

        selectUpdates
        
        [ @! ] swap size 0 == rot swap if
        
        [
            pop?
            spread swap // op eid
            
            // have we seen this eid already?
            $visited *%1 index_of! -1 !=
            [ @! ] *$1 if

            // add the eid to visited
            dup $visited swap + visited !
            

            *$3 swap // pull the es to the top
            
            
            // selectDepSrc
            selectDepSrcExclude
            // ["result is" *^%0] to_str! .
            rot applyOp
            
            // add upd coms to each e
            dup
            **addUpdCom map drop
            
            
            // add the result to the list
            rot swap +
            // continue to loop while there are still eids
            size 0 !=
            
            // $count 1 + count !

            // $count 3 !=
        ] loop
    `, false);

    await stmt.run();

    return site;
}


/**
 * Returns EntityIds of Entities that have been marked as updated
 * 
 * @param site 
 */
export async function selectUpdated(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<EntityId[]> {
    const { ref } = parseOptions(options);

    const stmt = prepare(es, `
        [
            /component/upd#op !ca 2 ==
            /component/upd#op !ca 1 ==
            or
            // this clause is evaled first
            /component/site_ref#ref !ca $ref ==
            and
            @eid
        ] select
    `);

    return await stmt.getResult({ ref });
}


/**
 * Removes all update components
 * 
 * @param es 
 */
export async function clearUpdates(site: Site, options: FindEntityOptions = {}) {
    const { es } = site;
    const { ref } = parseOptions(options);

    const stmt = prepare(es, `
        [ 
            /component/site_ref#ref !ca $ref ==
            /component/upd !bf 
            @cid 
        ] select
    `);
    let cids = await stmt.getResult({ ref });

    await es.removeComponents(cids);

    return es;
}

export async function clearErrors(site: Site, options: FindEntityOptions = {}) {
    const { es } = site;
    const { ref } = parseOptions(options);

    const stmt = prepare(es, `
        [ 
            /component/site_ref#ref !ca $ref ==
            /component/error !bf 
            @cid 
        ] select
    `);
    let cids = await stmt.getResult({ ref });

    await es.removeComponents(cids);

    return es;
}



export async function selectTarget(es: QueryableEntitySet): Promise<Entity[]> {
    const query = `[
        /component/target !bf
        @e
    ] select`;

    const stmt = prepare(es, query);
    return await stmt.getEntities();
}


/**
 * Finds a target Component for the given entity.
 * If one doesn't belong to the entity, it uses Dir dependencies
 * to find a parent with one.
 * 
 * @param es 
 * @param eid 
 */
export async function selectDirTarget(es: QueryableEntitySet, eid: EntityId): Promise<Component | undefined> {
    const stmt = prepare(es, `
    [
        // ["💥 eid is" $eid] to_str! .
        [ $eid @eid /component/target !bf @c ] select

        
        // if we have a result, then exit
        dup [ @! ] rot size! 0 < if
        
        // remove the empty result
        // es now on top
        drop
        
        
        // select the parent of the target
        [
            /component/dep !bf
            /component/dep#src !ca $eid ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select

        // if there is no parent, then exit
        dup [ @! ] rot size! 0 == if

        // set eid to parent
        /dst pluck! eid !

        // keeps the loop looping
        true
    ] loop
    `);

    const dirCom = await stmt.getResult({ eid });
    return dirCom.length > 0 ? dirCom[0] : undefined;
}


/**
 * Returns an array of Meta starting at the eid and working up the dir dependencies
 */
export async function selectDependencyMeta(es: QueryableEntitySet, eid: EntityId) {
    const stmt = prepare(es, `

    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )

    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select 

        // if the size of the select result is 0, then return 0
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck!
        @>
        
    ] *selectParent define

    [ // es eid -- es eid [meta]
        
        swap [ *^%1 @eid /component/meta !bf @c ] select 
        
        /meta pluck!
        rot swap // rearrange exit vars
    ] *selectMeta define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        // select meta
        selectMeta

        // add to result
        $result + result !
    
        selectParent
        
        // if no parent, stop execution
        dup [ drop  @! ] swap false == if

        true // true
    ] loop
    `, true);
    await stmt.run({ eid }, true);

    let metaList = stmt.getValue('result');
    // console.log('[selectDependencyMeta]', 'complete', stmt.stack.toString());

    return metaList;
}

/**
 * Returns an array of the parent ids of this dependency
 * 
 * @param es EntitySet
 * @param eid EntityId
 * @param type string
 */
export async function getDependencyParents(es: QueryableEntitySet, eid: EntityId, type: DependencyType): Promise<EntityId[]> {
    const stmt = prepare(es, `
    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )
    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca $type ==
            and
            @c
        ] select

        // if the size of the select result is 0, then return false
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck!
        @>
    ] *selectParent define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        selectParent

        // if we have already seen this, then exit
        $result *%1 index_of! -1 !=
        [ @! ] *$1 if
        
        // if no parent, stop execution
        dup [ drop @! ] swap false == if
        
        // add to result
        dup $result + result !
        
        true // loop
    ] loop
    $result
    `);
    return await stmt.getResult({ eid, type });
}

/**
 * Returns an array of eids which are children of the specified eid by type.
 * 
 * @param es 
 * @param eid 
 * @param type 
 * @param depth 
 */
export async function getDependencyChildren(es: QueryableEntitySet, eid: EntityId, type: DependencyType, depth: number = 100): Promise<EntityId[]> {
    const stmt = prepare(es, `

    // selects child ids of the e, or false if none found
    [
        $es [
            /component/dep !bf
            /component/dep#dst !ca *^$1 ==
            /component/dep#type !ca $type ==
            and
            @c
        ] select
        
        // if the size of the select result is 0, then return false
        size 0 == [ drop false @! ] swap if
        /src pluck!
        
        @>
        swap drop // drop the es
    ] *selectChildren define
    
    es let
    [] result let
    [] $eid +
    [
        [] [ swap *selectChildren + ] reduce
        [ false != ] filter
        
        // if no children, stop
        dup [ drop @! ] swap size! 0 == if

        // add to result
        dup $result swap + result !
        
        1 $depth - depth !
        
        0 $depth > // loop
    ] loop
    $result
    `);

    return await stmt.getResult({ eid, type, depth });
}


/**
 * Returns an array of EntityId which have parents but not children of the specified type
 * @param es 
 * @param type 
 * @param options 
 */
export async function findLeafDependenciesByType(es: QueryableEntitySet, type: DependencyType, options: FindEntityOptions = {}): Promise<EntityId[]> {
    const { ref, onlyUpdated } = parseOptions(options);

    // select dependency components by type
    // build a list of all src and all dst
    // remove from src all those that appear in dst
    const stmt = prepare(es, `
    [
        /component/dep#type !ca $type ==
        @c
    ] select

    /src pluck unique
    swap /dst pluck! unique
    swap diff! // ids which are in src but not dst
    
    // // /component/site_ref#ref !ca $ref ==
    // swap // es
    // [
        
    //             /component/upd#op !ca 1 ==
    //             /component/upd#op !ca 2 ==
    //         or
    // ]
    
    // $onlyUpdated if

    `);

    return await stmt.getResult({ type, ref, onlyUpdated });
}

/**
 * Returns the EntityIds that the given EntityId is dependent on
 * @param es 
 * @param src 
 * @param type 
 */
export async function getDepenendencyDst(es: QueryableEntitySet, src: EntityId, type: DependencyType): Promise<EntityId[]> {
    const stmt = prepare(es, `
    [
        /component/dep#type !ca $type ==
        /component/dep#src !ca $src ==
        and
        /component/dep !bf
        @c
    ] select
    /dst pluck!
    `);
    return await stmt.getResult({ src, type });
}


/**
 * Returns the entities which are linked to the given entity by a dependency
 * 
 * @param es 
 * @param eid 
 * @param type 
 */
export async function getDependencyDstEntities(es: QueryableEntitySet, eid, type?: DependencyType[] ) {
    const regexExt = type.join('|');

    let q = `
    // select the dst eids from the dependency entities
    [
        /component/dep#type !ca ~r/^(${regexExt})$/i ==
        /component/dep#src !ca $eid ==
        and
        /component/dep !bf
        @c
    ] select
    
    /dst pluck!

    // select the entities using the eids
    swap
    [
        *^$1
        @e
    ] select
    `;

    return await prepare(es, q, false).getResult({eid});
}


/**
 * Returns EntityIds of the dependency entities which match the given eid and type
 * 
 * @param es 
 * @param eid 
 * @param type 
 */
export async function getDependencies(es: QueryableEntitySet, eid: EntityId, type?: DependencyType[], returnEid: boolean = true): Promise<Entity[] | EntityId[]> {
    const ret = returnEid ? '@eid' : '@e';
    let q: string;

    if (type !== undefined) {
        const regexExt = type.join('|');
        q = `
        [
            /component/dep#type !ca ~r/^(${regexExt})$/i ==
            /component/dep#src !ca $eid ==
            and
            /component/dep !bf
            ${ret}
        ] select`;
    } else {
        q = `
        [
            /component/dep#src !ca $eid ==
            /component/dep !bf
            ${ret}
        ] select`;
    }

    return await prepare(es, q, false).getResult({ eid });
}

export async function getDependencyEntityIds(es: QueryableEntitySet, eid: EntityId, type?: DependencyType[]): Promise<EntityId[]> {
    return getDependencies(es, eid, type, true) as Promise<EntityId[]>;
}
export async function getDependencyEntities(es: QueryableEntitySet, eid: EntityId, type?: DependencyType[]): Promise<Entity[]> {
    return getDependencies(es, eid, type, false) as Promise<Entity[]>;
}

export async function getDependencyComponent(es: QueryableEntitySet, src: EntityId, dst: EntityId, type: DependencyType): Promise<Component> {
    const stmt = prepare(es, `
    [
        /component/dep#src !ca $src ==
        /component/dep#dst !ca $dst ==
        and
        /component/dep#type !ca $type ==
        and
        /component/dep !bf
        @c
    ] select
    `);
    const result = await stmt.getResult({ src, dst, type });
    return result.length > 0 ? result[0] : undefined;
}

export async function getDepdendencyComponentBySrc(es: QueryableEntitySet, src: EntityId): Promise<Component[]> {
    const q = `
    [
        /component/dep#src !ca $src ==
        /component/dep !bf
        @c
    ] select
    `;
    return prepare(es, q).getResult({ src });
}

export async function getDependencyComponents(es: QueryableEntitySet, eid: EntityId, type: DependencyType[]): Promise<Component[]> {

    let q: string;

    if (type !== undefined) {
        const regexExt = type.join('|');
        q = `
        [
            /component/dep#type !ca ~r/^(${regexExt})$/i ==
            /component/dep#src !ca $eid ==
            and
            /component/dep !bf
            @c
        ] select`;
    } else {
        q = `
        [
            /component/dep#src !ca $eid ==
            /component/dep !bf
            @c
        ] select`;
    }


    return await prepare(es, q, false).getResult({ eid });
}


/**
 * Returns EntityIds of the dependency entities which match the given eid and type
 * 
 * @param es 
 * @param eid 
 * @param type 
 */
export async function getDependenciesOf(es: QueryableEntitySet, eid: EntityId, type?: DependencyType, returnEid: boolean = true): Promise<Entity[] | EntityId[]> {
    const ret = returnEid ? '@eid' : '@e';
    const q = type !== undefined ? `
    [
        /component/dep#type !ca $type ==
        /component/dep#dst !ca $eid ==
        and
        /component/dep !bf
        ${ret}
    ] select
    ` : `
    [
        /component/dep#dst !ca $eid ==
        /component/dep !bf
        ${ret}
    ] select`;

    return await prepare(es, q, false).getResult({ eid, type });
}

export async function getDependencyOfEntityIds(es: QueryableEntitySet, eid: EntityId, type?: DependencyType): Promise<EntityId[]> {
    return getDependenciesOf(es, eid, type, true) as Promise<EntityId[]>;
}
export async function getDependencyOfEntities(es: QueryableEntitySet, eid: EntityId, type?: DependencyType): Promise<Entity[]> {
    return getDependenciesOf(es, eid, type, false) as Promise<Entity[]>;
}