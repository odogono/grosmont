import Mime from 'mime-types';
import Path from 'path';
import { getDstUrl, selectDstTextIds } from '../query';
import { Site } from "../site";
import { ProcessOptions } from "../types";
import { uriToPath } from '../util';
import { Entity, EntityId, toComponentId } from '../../es';



const log = (...args) => console.log('[/processor/build_dst_index]', ...args);


export interface DstIndexOptions extends ProcessOptions {
    loadData?: boolean;
}

/**
 * Builds an index of dst urls for each entity which has a /dst and a /text
 * component
 * 
 * 
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: DstIndexOptions = {}) {
    const es = site.es;

    const dstIndex = site.getIndex('/index/dstUrl', true);
    const eids = await selectDstTextIds(es);

    for (const eid of eids) {
        let url = await site.getEntityDstUrl(eid, false);

        if (url !== undefined) {
            url = await ensureExtension(site, eid, url);
            // log(url, eid);
            dstIndex.set(uriToPath(url), eid);
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

    // read from src - either from the mime attr or from the url
    did = es.resolveComponentDefId('/component/src');
    com = await es.getComponent(toComponentId(eid, did));

    if (com !== undefined) {
        result = appendExtFromMime(url, com?.mime);
        if (result !== undefined) {
            return result;
        }

        let ext = Path.extname(com.url);
        if (ext) {
            return url + '.' + ext;
        }

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