import Path from 'path';
import { getDstUrl, selectDstEntityIds, selectSrc } from '../query';
import { Site } from "../site";
import { ProcessOptions } from "../types";
import { uriToPath, mapToTargetMime, appendExtFromMime, removeExt, mimeFromExtension } from '../util';
import { Entity, EntityId, getComponentEntityId, toComponentId } from '../../es';
import { info, setLocation } from '../reporter';


const Label = '/processor/build_dst_index';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface DstIndexOptions extends ProcessOptions {
    overwrite?: boolean;
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
    const { reporter } = options;
    const overwrite = options.overwrite ?? true;
    setLocation(reporter, Label);
    const dstIndex = site.getDstIndex(true);


    const coms = await selectSrc(es, { ...options, onlyUpdated: false });

    const upDid = es.resolveComponentDefId('/component/upd');

    for (const com of coms) {
        const eid = getComponentEntityId(com);

        let existing = dstIndex.getByEid(eid);

        // log('process', eid);
        let url = await getDstUrl(es, eid);

        // if( overwrite === false && url && existing ){
        //     continue;
        // }

        if (url !== undefined) {
            if (url.endsWith('dir.e.yaml')) {
                continue;
            }
            

            const updCom = await es.getComponent(toComponentId(eid, upDid));

            // log('input', eid, url, updCom);
            let mime = undefined;
            [url, mime] = await ensureExtension(site, eid, url);
            // throw 'stop';
            
            // log('set', url, eid, {existing});
            
            let setUrl = uriToPath(url);
            if (overwrite === false && existing) {
                setUrl = existing;
            }
            
            // setUrl = removeExt(setUrl);
            // log('output', eid, url, setUrl, {mime});
            dstIndex.setPath(setUrl, eid, updCom?.op, mime);
        } else {
            dstIndex.removeByEid(eid);
        }
    }

    info(reporter, `processed ${coms.length}`);

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
async function ensureExtension(site: Site, eid: EntityId, url: string): Promise<[string, string]> {
    const { es } = site;
    const ext = Path.extname(url);

    if (ext !== '') {
        return [ removeExt(url), mimeFromExtension(ext) ];
    }

    let did = es.resolveComponentDefId('/component/output');
    let com = await es.getComponent(toComponentId(eid, did));

    

    // let result = appendExtFromMime(url, com?.mime);
    if (com?.mime !== undefined) {
        
        return [url, com.mime];
    }

    // read from dst
    did = es.resolveComponentDefId('/component/dst');
    com = await es.getComponent(toComponentId(eid, did));

    if (com?.mime !== undefined) {
        
        return [url, com.mime];
    }



    // attempt to read mime from meta
    did = es.resolveComponentDefId('/component/meta');
    com = await es.getComponent(toComponentId(eid, did));


    if (com?.meta?.mime !== undefined) {
        return [url, com?.meta?.mime];;
    }



    // read from src - either from the mime attr or from the url
    did = es.resolveComponentDefId('/component/src');
    com = await es.getComponent(toComponentId(eid, did));

    if (com !== undefined) {
        // attempt a converseion from src to dst mime
        let mime = mapToTargetMime(com?.mime);

        
        // result = appendExtFromMime(url, mime);
        if (mime !== undefined) {
            return [url, mime];
        }

        let ext = Path.extname(com.url);
        if (ext) {
            return [ removeExt(url), mimeFromExtension(ext)];
        }

    }

    // look for /mdx /scss components


    return [url, undefined];
}

