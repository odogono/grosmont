import Path from 'path';


import {
    Component, getComponentEntityId, setEntityId,

    Entity, EntityId, isEntity,
    QueryableEntitySet
} from "../es";
import { Site } from "./site";
import { uriToPath } from './util';
import { DependencyType, ProcessOptions } from './types';
import { BitField } from "@odgn/utils/bitfield";
import { parseUri, slugify, toBoolean } from '@odgn/utils';





export interface FindEntityOptions {
    siteRef?: EntityId;
    title?: string;
    onlyUpdated?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    srcUrl?: string;
    eids?: EntityId[];
}

export interface ParseOptionsOptions extends FindEntityOptions {
    warnOnEmptyRef?: boolean;
}

function parseOptions(options: FindEntityOptions = {}) {
    const ref = options.siteRef ?? 0;
    const onlyUpdated = options.onlyUpdated ?? false;
    const eids = options.eids;
    if (ref === 0) {
        // console.warn('[parseOptions]', 'empty siteRef passed');
        throw new Error('[parseOptions] empty siteRef passed');
    }
    return { ref, onlyUpdated, eids };
}

export async function selectTagBySlug(es: QueryableEntitySet, name: string, options: FindEntityOptions = {}) {
    const slug = slugify(name);
    const { ref } = parseOptions(options);

    const stmt = es.prepare(`
    [
        /component/tag#slug !ca $slug ==
        /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select
    `);

    return await stmt.getEntity({ ref, slug });
}


/**
 * Returns EntityIds which have all of the specified tags
 * 
 * @param es 
 * @param tags 
 * @param options 
 */
export async function findEntitiesByTags(es: QueryableEntitySet, tags: string[], options: FindEntityOptions = {}): Promise<EntityId[]> {
    const { ref } = parseOptions(options);

    const q = `
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
    ] selectTagBySlug define

    [
        $es [
            /component/dep#dst !ca *^$1 ==
            @eid /component/dep#src @ca
        ] select swap drop
        [ drop false @! ] swap size 0 == rot swap if
        
        @>
    ] selectTagDepByDst define

    // first, resolve the incoming slugs to tag eids
    $tags *selectTagBySlug map
    // remove empty results
    [ false != ] filter

    
    [] // reduce result
    [
        swap *selectTagDepByDst
        [ intersect! ] [ + ] *%3 size 0 == swap drop iif
    ] reduce
    
    unique // get rid of dupes
    `;

    const stmt = es.prepare(q);
    return await stmt.getResult({ ref, tags });
}



export async function selectMeta(es: QueryableEntitySet, options: FindEntityOptions = {}) {
    const { ref } = parseOptions(options);


    const stmt = es.prepare(`
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

    return await es.prepare(query).getEntities({ ref });
}


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

    return await es.prepare(q).getResult({ ref });
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
            [ /component/src /component/dst /component/static ] !bf 
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
        [ /component/src /component/dst /component/static ] !bf
        /component/site_ref#ref !ca $ref ==
        @eid
    ] select
    
    swap [ *^$1 @eid /component/src !bf @c ] select
    `

    return await es.prepare(q).getResult({ ref });
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


    return await es.prepare(q).getEntities({ ref });
}



export async function selectMetaDisabled(es: QueryableEntitySet): Promise<EntityId[]> {
    const stmt = es.prepare(`[
        /component/enabled#is !ca false ==
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

    return await es.prepare(q).getEntities({ ref, eids });
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

    return await es.prepare(q).getEntities({ ref });
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


    return es.prepare(q).getResult({ ref });
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
        ] select`;
    } else {
        q = `[
            /component/js !bf
            /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select`
    }

    return await es.prepare(q).getEntities({ ref, eids });
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

    return await es.prepare(q).getResult({ ref });
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

//     return await es.prepare(q).getEntities({ ref });
// }


export async function selectErrors(es: QueryableEntitySet, options: FindEntityOptions = {}): Promise<Component[]> {
    const { ref } = parseOptions(options);

    let q = `[
        /component/site_ref#ref !ca $ref ==
        /component/error !bf
        @c
        ] select`;

    return await es.prepare(q).getResult({ ref });
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
    return await es.prepare(q).getResult({ ref });
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
    return await es.prepare(q).getResult({ ref });
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

    // console.log('[selectSrcByExt]', ref, q);
    return await es.prepare(q).getEntities({ ref });
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

    return await es.prepare(q).getResult({ ref });
}




export async function selectDstEntityIds(es: QueryableEntitySet): Promise<EntityId[]> {

    const q = `
        [ [ /component/dst ] !bf @eid] select
    `;

    const stmt = es.prepare(q);
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

    const stmt = es.prepare(query);
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

    const stmt = es.prepare(query);
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
    // e://component/file?uri=file:///pages/main.mdx - address an entity
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


export async function getUrlComponent(es: QueryableEntitySet, url: string, options: FindEntityOptions = {}) {
    const { ref, onlyUpdated } = parseOptions(options);
    const stmt = es.prepare(`
    [
        /component/site_ref#ref !ca $ref ==
        /component/url#url !ca $url ==
        @c
    ] select
    `);
    const r = await stmt.getResult({ ref, url });
    return r.length > 0 ? r[0] : undefined;
}


export async function getEntityByUrl(es: QueryableEntitySet, url: string) {
    const stmt = es.prepare(`
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
    `
    const stmt = es.prepare(query);
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

    return await es.prepare(q).getEntities({ ref });
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

    const stmt = es.prepare(q);

    return await stmt.getResult({ ref });
}


export async function selectSrcByUrl(es: QueryableEntitySet, url: string): Promise<Component> {
    const stmt = es.prepare(`[
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
    const stmt = es.prepare(`[
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

    // console.log('[selectSiteSrcByUrl]', url, com );

    if (com === undefined) {
        if (!options.createIfNotFound) {
            // console.log('[selectSiteSrcByUrl]', 'nope', {url,ref});
            // log( stmt );
            return undefined;
        }
        let e = es.createEntity();
        e.Src = { url };
        let ctime = new Date().toISOString();
        let mtime = ctime;
        e.Ftimes = { ctime, mtime };
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
export async function getDstUrl(es: QueryableEntitySet, eid: EntityId): Promise<string | undefined> {

    // TODO - a complex statement which has many words which should be
    // predefined

    const stmt = es.prepare(`
    [] paths let
    "" filename let

    // ( str -- str|false )
    [ ~r/^\/|file:\/\/\// eval ] selectAbsUri define

    [ false true rot ~r/^\/|file:\/\/\// eval iif ] isAbsPath define

    [ false true rot ~r/^[^\/]*$/ eval iif ] isFilename define

    [ "" swap ~r/^\\/+/ replace ] removeLeadingSlash define

    [ "" swap ~r/\\/$/ replace ] removeTrailingSlash define

    [
        dup isAbsPath
        // dup ~r/^\\// eval
        [["/" *^^$0] "" join ] swap false == if

    ] ensureLeadingSlash define


    [ $paths + paths ! ] addToPaths define
    

    // ( es eid -- es str|false )
    // returns the target uri from an entity
    [
        
        swap [ *^$1 @eid /component/dst#url @ca ] select pop? swap drop
        
        // swap [ *^$1 @eid /component/dst !bf @c ] select
        
        // if no /dst component exists, return undefined
        // taking care to drop the empty result
        dup [ drop false @! ] swap undefined == if

        @> // restart exec after @!
        
    ] selectDst define


    // selects the parent entity, or false if none is found
    // ( es eid -- es eid|false )
    [        
        swap
        [
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca dir ==
            and
            /component/dep !bf
            @c
        ] select


        // if the size of the select result is 0, then return false
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck!
        @>
    ] selectParent define

    // if /component/dst exists, add to paths.
    // returns "abs" if the target uri is absolute, "rel" if
    // relative, and false if it doesn't exist
    // es eid -- es eid "abs"|"rel"|false
    [
        // to order eid es eid
        dup rot rot

        selectDst
        
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
        
    ] handleDst define


    // es eid -- es eid|false
    [   
        
        selectParent

        // if no parent, stop execution
        dup [ @! ] swap false == if

    ] handleParent define

    [
        [ drop @!] $filename size! 0 != if
        filename !
        @>
    ] setFilename define

    // takes a path, extracts the filename and sets it if exists
    // returns the path without filename
    // str
    [
        
        ~r/(.*\\/)?(.*)/ eval
        dup [ drop @! ] swap false == if
        
        pop // filename
        setFilename
        pop!
        
        dup [ drop "" @! ] swap undefined == if
        
        @>
        
    ] selectFilenameAndPath define
    

    // iterate up the dir dependency tree
    $eid
    [
        
        // examine /component/dst and add to the result
        // if it exists
        handleDst

        // if the dst exists and is absolute, then we have
        // finished
        dup [ drop drop @! ] swap "abs" == if
        
        // es eid false
        
        
        drop // drop the false result
        
        
        // swap // so we have es eid
        
        
        // find the parent dir using deps
        handleParent

         

        true // loop only continues while true
    ] loop

    // if no filename is found, then quit
    [ undefined @! ] $filename size! 0 == if


    $paths "" join 
    $filename swap +

    
    
    dup [ drop undefined @! ] swap size! 0 == if
    ensureLeadingSlash
    
    @>
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
 * Selects a dependency entity
 */
// export async function selectDependency(es: QueryableEntitySet, src?: EntityId, dst?: EntityId, type?: DependencyType, asEntity: boolean = false) {
//     // const did:ComponentDefId = es.resolveComponentDefId('/component/dep');

//     let conds = [];
//     if (src !== undefined) {
//         conds.push(`/component/dep#src !ca ${src} ==`);
//     }
//     if (dst !== undefined) {
//         conds.push(`/component/dep#dst !ca ${dst} ==`);
//     }
//     if (conds.length === 2) { conds.push('and'); }
//     if (type !== undefined) {
//         conds.push(`/component/dep#type !ca ${type} ==`);
//     }
//     if (conds.length >= 2) { conds.push('and'); }

//     if (asEntity) {
//         let query = `[
//             /component/dep !bf
//             ${conds.join('\n')}
//             @c
//         ] select`;
//         let stack = await es.query(query);
//         return stack.popValue() as unknown as Component[];
//     }

//     let query = `[
//         /component/dep !bf
//         ${conds.join('\n')}
//         @c
//     ] select`;

//     let out = await es.queryEntities(query);

//     return out;
// }



/**
 *  
 */
export async function getDependency(es: QueryableEntitySet, eid: EntityId, type: DependencyType): Promise<EntityId> {
    const depId = await getDependencies(es, eid, [type], true) as EntityId[];
    return depId.length > 0 ? depId[0] : undefined;
}




export async function getLayoutFromDependency(es: QueryableEntitySet, eid: EntityId): Promise<Entity> {
    // eid = 0;
    const stmt = es.prepare(`
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
    
    const stmt = site.es.prepare(`

        // returns [eid,op] of all entities which have an update
        [
            $es [ /component/upd !bf @c ] select
            [ /@e /op ] pluck!
        ] selectUpdates define


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
        ] selectDepSrcExclude define

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
    `);

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

    const stmt = es.prepare(`
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

    const stmt = es.prepare(`
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

    const stmt = es.prepare(`
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

    const stmt = es.prepare(query);
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
    const stmt = es.prepare(`
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
    const stmt = es.prepare(`

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
    ] selectParent define

    [ // es eid -- es eid [meta]
        swap [ *^%1 @eid /component/meta !bf @c ] select 
        /meta pluck!
        rot swap // rearrange exit vars
    ] selectMeta define

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
        dup [ drop @! ] swap false == if

        true // true
    ] loop

    `);
    await stmt.run({ eid });

    let metaList = stmt.getValue('result');

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
    const stmt = es.prepare(`
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
    ] selectParent define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        selectParent

        
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
    const stmt = es.prepare(`

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
    ] selectChildren define
    
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
    const stmt = es.prepare(`
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
    const stmt = es.prepare(`
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

    return await es.prepare(q).getResult({ eid });
}

export async function getDependencyEntityIds(es: QueryableEntitySet, eid: EntityId, type?: DependencyType[]): Promise<EntityId[]> {
    return getDependencies(es, eid, type, true) as Promise<EntityId[]>;
}
export async function getDependencyEntities(es: QueryableEntitySet, eid: EntityId, type?: DependencyType[]): Promise<Entity[]> {
    return getDependencies(es, eid, type, false) as Promise<Entity[]>;
}

export async function getDependencyComponent(es: QueryableEntitySet, src: EntityId, dst: EntityId, type: DependencyType): Promise<Component> {
    const stmt = es.prepare(`
    [
        /component/dep#src !ca ${src} ==
        /component/dep#dst !ca ${dst} ==
        and
        /component/dep#type !ca ${type} ==
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
    return es.prepare(q).getResult({ src });
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


    return await es.prepare(q).getResult({ eid });
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

    return await es.prepare(q).getResult({ eid, type });
}

export async function getDependencyOfEntityIds(es: QueryableEntitySet, eid: EntityId, type?: DependencyType): Promise<EntityId[]> {
    return getDependenciesOf(es, eid, type, true) as Promise<EntityId[]>;
}
export async function getDependencyOfEntities(es: QueryableEntitySet, eid: EntityId, type?: DependencyType): Promise<Entity[]> {
    return getDependenciesOf(es, eid, type, false) as Promise<Entity[]>;
}