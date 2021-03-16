import Util from 'util';
import Path from 'path';
import { getComponentDefId, getComponentEntityId, toComponentId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { buildUrl, resolveUrlPath, uriToPath } from "../../util";
import { PageLink, PageLinks, SiteIndex, TranspileProps, ProcessOptions, DependencyType, ImportDescr } from "../../types";
import { getDependencyEntities, getDependencyEntityIds, getDepenendencyDst, getDstUrl, insertDependency } from "../../query";
import { Site } from "../../site";
import { toInteger } from '@odgn/utils';
import { useServerEffect } from '../jsx/server_effect';
import { buildProcessors, OutputES } from '../..';
import { StatementArgs } from 'odgn-entity/src/query';
import { info } from '../../reporter';

const log = (...args) => console.log('[/processor/mdx/util]', ...args);

export async function buildProps(site:Site, e: Entity): Promise<TranspileProps> {

    let data = await site.getEntityData(e);

    let eMeta = e.Meta?.meta ?? {};
    let path = site.getSrcUrl(e);// e.Src.url; // e.Dst?.url ?? '';
    const url = e.Src?.url;
    let props: TranspileProps = { path, data, url, meta: eMeta };

    return props;
}


export function createRenderContext( site:Site, e:Entity, options:ProcessOptions = {} ){
    const { url: base } = e.Src;
    const {reporter}  = site;

    const log = (...args) => info(reporter, Util.format(`[${base}]`,...args) );

    const context = { 
        e,
        es: site.es,
        site, 
        log,
        useServerEffect,
        processEntity: processEntityOutput(site, e, options),
        runQuery: runQuery(site, e, options),
        processEntities: processEntities(site, e, options),
    };

    return context;
}


function runQuery( site:Site, e:Entity, options:ProcessOptions ){
    return async (q:string, args:StatementArgs) => {
        const {es} = site;
        let result = await es.prepare(q).getResult(args);
        // log('[runQuery]', q, result);
        return result;
    }
}

function processEntities( site:Site, e:Entity, options:ProcessOptions ){
    return async (eids:EntityId[], dids:string[], renderOptions:ProcessOptions = {}) => {
        const {es} = site;
        const srcId = e.id;
        const bf = es.resolveComponentDefIds( dids );
        let pes = new OutputES(es, bf);

        const process = await buildProcessors( site, [
            [ '/processor/js/render', 0, renderOptions]
        ]);


        await process( site, {es:pes, eids});

        let result:Map<EntityId,Entity> = new Map<EntityId,Entity>();

        for( const eid of eids ){
            await insertDependency( es, srcId, eid, 'import' );
            let e = await es.getEntity(eid, bf);
            result.set(eid, e);
        }

        // apply the updated components from the output es to entities
        for( const com of pes.components ){
            const eid = getComponentEntityId(com);
            const e = result.get(eid);
            if( e !== undefined ){
                e.addComponentUnsafe(com);
            }
        }

        return Array.from( result.values() );
    }
}

function processEntityOutput( site:Site, e:Entity, options:ProcessOptions ){

    return async (url:string, renderOptions:ProcessOptions = {} ) => {
        const {es} = site;
        
        let pe = await site.getEntityBySrc(url);
        const bf = es.resolveComponentDefIds('/component/output');
        let pes = new OutputES(es, bf);

        const process = await buildProcessors( site, [
            [ '/processor/js/render', 0, renderOptions]
        ]);
        const eids = [ pe.id ];

        // add a dependency - since this is an import, it gets
        // reset at the point of eval_mdx/jsx
        await insertDependency( es, e.id, pe.id, 'import' );
        
        await process( site, {es:pes, eids} );

        for( const com of pes.components ){
            if( getComponentEntityId(com) === pe.id ){
                e.addComponentUnsafe( com );
            }
        }

        return e;
    }
}



export async function buildPageLinks( es:EntitySet, linkIndex:SiteIndex ){
    let result:PageLinks = new Map<string,PageLink>();

    
    for( const [url, [eid,type,child]] of linkIndex.index ){
        if( type === 'external' ){
            result.set(url, {url});
        } else {
            let path = await getDstUrl(es, eid);

            path = uriToPath(path);
            
            // log('[getDstUrl]', eid, path );
            result.set(url, {url:path});
        }
    }
    // log('[buildPageLinks]', linkIndex.index);
    // log('[buildPageLinks]', result);

    return result;
}



/**
 * Returns a url pointing to the value to import from a file path
 * 
 * @param fileIndex 
 * @param path 
 */
export function getEntityImportUrlFromPath(fileIndex: SiteIndex, path: string, mimes?: string[] ) {
    // console.log('[getEntityImportUrlFromPath]', path);
    if (fileIndex === undefined || path == '') {
        return undefined;
    }
    let entry = fileIndex.index.get(path);
    if (entry === undefined) {
        // attempt to find without ext
        for( const [url,idxEntry] of fileIndex.index ){
            let ext = Path.extname(url);
            let wit = url.substring(0, url.length-ext.length);
            if( path === wit ){
                const [mime] = idxEntry;
                if( mimes !== undefined && mimes.indexOf(mime) === -1 ){
                    continue;
                }
                // log('[gE]', url, idxEntry);
                entry = idxEntry;
                break;
            }
        }
        if( entry === undefined ){
            return undefined;
        }
    }
    // log('[gE]', 'found??', path, entry, fileIndex.index);
    const [eid, mime] = entry;
    return buildUrl(`e://${eid}/component/output`, { mime }) + '#text';
}


/**
 * 
 * @param es 
 * @param e 
 * @returns 
 */
export async function getEntityCSSDependencies(es: EntitySet, e: Entity) {
    const cssDeps = await getDependencyEntities(es, e.id, ['css']);
    if (cssDeps === undefined || cssDeps.length === 0) {
        return undefined;
    }

    const did = es.resolveComponentDefId('/component/output');
    let result = [];

    for (const dep of cssDeps) {
        const { src, dst } = dep.Dep;
        let path = await getDstUrl(es,dst);

        const com = await es.getComponent(toComponentId(dst, did));
        // log('[getEntityCSSDependencies]', dst, did, com);

        if( com ){
            result.push({ path, text: com.data });
        }
    }

    return result;
}



/**
 * 
 * @param site 
 * @param url 
 * @param base 
 * @returns 
 */
export function resolveImport( site:Site, url:string, base:string ): ImportDescr {
    const srcIndex = site.getIndex('/index/srcUrl');
    if (srcIndex === undefined) {
        throw new Error('/index/srcUrl not present');
    }

    // convert to file:// if not already
    // if( !url.match(/^.+:\/\//) ){
    //     // if( !url.startsWith('/') ){
    //     //     url = '/' + url;
    //     // }
    //     url = 'file://' + url;
    // }
    
    let path = resolveUrlPath(url, base);
    // log('[resolveImport]', 'whaaa', path, base, url);
    let entry = srcIndex.get(path);

    if( entry === undefined ){
        // attempt to find with an extension
        // log('[resolveImport]', 'whaaa', path, url);
        
        const reUrl = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^${reUrl}\..+`,'i');
        for( const key of srcIndex.index.keys() ){
        
            if( re.test(key) ){
                entry = srcIndex.get(key);
            }
        }
    }

    // log('[resolveImport]', eid, path, url);
    if (entry !== undefined) {
        const [eid, mime, bf] = entry;
        // log('[resolveImport]', {eid, path, url, mime});
        if (mime === 'text/jsx') {
            return [eid, `e://${eid}/component/jsx`, mime];
        }
        if (mime === 'text/mdx') {
            return [eid, `e://${eid}/component/mdx`, mime];
        }
        if (mime === 'text/scss') {
            return [eid, `e://${eid}/component/scss`, 'text/css'];
        }
        else {
            return [eid, `e://${eid}/`, 'application/x.entity'];
        }
    }
    return undefined;
}


/**
 * Converts an array of ImportDescr (eid,url,mime) into dependencies
 * 
 * @param site 
 * @param e 
 * @param imports 
 * @param options 
 * @returns 
 */
export async function applyImports(site: Site, e: Entity, imports:ImportDescr[], options: ProcessOptions): Promise<Entity> {
    const { es } = site;
   
    // gather existing import and css dependencies
    const existingIds = new Set(await getDependencyEntityIds(es, e.id, ['import','css']));
    
    for (let [importEid, url] of imports) {
        let type: DependencyType = 'import';
   
        const match = parseEntityUrl(url);
   
        if (match !== undefined) {
            const { eid, did } = match;
            if (did === '/component/scss') {
                type = 'css';
            }
        }

        let urlCom = es.createComponent('/component/url', { url });
        let depId = await insertDependency(es, e.id, importEid, type, [urlCom]);

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}


export function parseEntityUrl( url:string ){
    const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "i");
    let match = re.exec( url );
    if( match !== null ){
        const [ url, eid, did ] = match;
        return { eid:toInteger(eid), did, url };
    }
    return undefined;
}


