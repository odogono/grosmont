import Mime from 'mime-types';
import Path from 'path';
import { getDstUrl, selectDstEntityIds, selectSrc } from '../query';
import { Site } from "../site";
import { ProcessOptions } from "../types";
import { uriToPath, mapToTargetMime } from '../util';
import { Entity, EntityId, getComponentEntityId, toComponentId } from '../../es';



const log = (...args) => console.log('[/processor/build_dst_index]', ...args);


export interface DstIndexOptions extends ProcessOptions {
    
}

/**
 * Builds an index of dst urls
 * e are selected by having a /src
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: DstIndexOptions = {}) {
    const es = site.es;

    const dstIndex = site.getDstIndex(true);
    const coms = await selectSrc(es, options);
    

    const upDid = es.resolveComponentDefId('/component/upd');

    // log('building', coms);

    for (const com of coms) {
        const eid = getComponentEntityId(com);
        
        // log('process', eid);
        let url = await getDstUrl(es, eid);
        
        if (url !== undefined) {
            if( url.endsWith('dir.e.yaml') ){
                continue;
            }
            const updCom = await es.getComponent( toComponentId(eid,upDid) );

            // log('input', eid, url);
            url = await ensureExtension(site, eid, url);
            // log('set', url, eid);
            dstIndex.set(uriToPath(url), eid, updCom?.op);
        } else {
            dstIndex.removeByEid(eid);
        }
    }

    // return await site.addQueryIndex('/index/srcUrl', query, { ref: siteEntity.id });

    return site;
}

/**
 * If the given url is missing an extension, then one is found for it by looking
 * at its components
 * 
 * @param site 
 * @param eid 
 * @param url 
 * @returns 
 */
async function ensureExtension(site: Site, eid: EntityId, url: string) {
    const { es } = site;
    if (Path.extname(url) !== '') {
        return url;
    }

    let did = es.resolveComponentDefId('/component/output');

    let com = await es.getComponent(toComponentId(eid, did));

    
    let result = appendExtFromMime(url, com?.mime);
    if (result !== undefined) {
        return result;
    }


    // attempt to read mime from meta
    did = es.resolveComponentDefId('/component/meta');
    com = await es.getComponent(toComponentId(eid, did));

    if (com !== undefined) {
        result = appendExtFromMime(url, com?.meta?.mime);
        if( result !== undefined ){
            return result;
        }
    }


    // read from src - either from the mime attr or from the url
    did = es.resolveComponentDefId('/component/src');
    com = await es.getComponent(toComponentId(eid, did));

    if (com !== undefined) {
        // attempt a converseion from src to dst mime
        let mime = mapToTargetMime( com?.mime );

        result = appendExtFromMime(url, mime);
        if (result !== undefined) {
            return result;
        }

        let ext = Path.extname(com.url);
        if (ext) {
            return url + '.' + ext;
        }

    }

    // look for /mdx /scss components


    return url;
}

function appendExtFromMime(url: string, mime: string) {
    let ext = Mime.extension(mime);
    if (ext) {
        return url + '.' + ext;
    }
    return undefined;
}