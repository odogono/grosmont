import Path from 'path';
import { toComponentId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { buildUrl, resolveUrlPath, uriToPath } from "../../util";
import { PageLink, PageLinks, SiteIndex, TranspileProps, ProcessOptions } from "../../types";
import { getDependencyEntities, getDepenendencyDst, getDstUrl } from "../../query";
import { Site } from "../../site";
import { toInteger } from '@odgn/utils';


const log = (...args) => console.log('[Util]', ...args);

export async function buildProps(site:Site, e: Entity): Promise<TranspileProps> {

    let data = await site.getEntityData(e);

    // let data = e.Mdx?.data;

    // if( data === undefined ){
    //     // attempt to load from src
    //     const src = e.Src?.url;

    //     if( src === undefined ){
    //         throw new Error(`mdx data not found for ${e.id}`);
    //     }

    //     data = await site.readUrl( src );

    //     // e.Mdx.data = data;
    // }

    let eMeta = e.Meta?.meta ?? {};
    let path = site.getSrcUrl(e);// e.Src.url; // e.Dst?.url ?? '';
    let props: TranspileProps = { path, data, meta: eMeta };

    return props;
}


// export async function buildPageImgs( es:EntitySet, imgIndex:SiteIndex ){
//     let result: PageImgs = new Map<string, PageImg>();

//     for( const [url, [eid,type]] of imgIndex.index ){
//         if( type === 'external' ){
//             result.set( url, {url});
//         } else {
//             let path = await getDstUrl(es, eid);
//             path = uriToPath(path);
//             result.set(url, {url:path});
//         }
//     }

//     return result;
// }


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



export async function getEntityCSSDependencies(es: EntitySet, e: Entity) {
    const cssDeps = await getDependencyEntities(es, e.id, 'css');
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

export function resolveImport( site:Site, url:string, base:string ){
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


export function parseEntityUrl( url:string ){
    const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "i");
    let match = re.exec( url );
    if( match !== null ){
        const [ url, eid, did ] = match;
        return { eid:toInteger(eid), did, url };
    }
    return undefined;
}


