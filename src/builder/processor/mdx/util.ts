import Path from 'path';
import { toComponentId } from "odgn-entity/src/component";
import { Entity } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { buildUrl, uriToPath } from "../../util";
import { PageLink, PageImg, PageImgs, PageLinks, SiteIndex, TranspileProps } from "../../types";
import { getDependencyEntities, getDstUrl } from "../../query";
import { Site } from "../../site";


const log = (...args) => console.log('[Util]', ...args);

export async function buildProps(site:Site, e: Entity): Promise<TranspileProps> {
    let data = e.Mdx?.data;

    if( data === undefined ){
        // attempt to load from src
        const src = e.Src?.url;

        if( src === undefined ){
            throw new Error(`mdx data not found for ${e.id}`);
        }

        data = await site.readUrl( src );

        // e.Mdx.data = data;
    }

    let eMeta = e.Meta?.meta ?? {};
    let path = site.getSrcUrl(e);// e.Src.url; // e.Dst?.url ?? '';
    let props: TranspileProps = { path, data, meta: eMeta };

    return props;
}


export async function buildPageImgs( es:EntitySet, imgIndex:SiteIndex ){
    let result: PageImgs = new Map<string, PageImg>();

    for( const [url, [eid,type]] of imgIndex.index ){
        if( type === 'external' ){
            result.set( url, {url});
        } else {
            let path = await getDstUrl(es, eid);
            path = uriToPath(path);
            result.set(url, {url:path});
        }
    }

    return result;
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
    return buildUrl(`e://${eid}/component/text`, { mime }) + '#text';
}



export async function getEntityCSSDependencies(es: EntitySet, e: Entity) {
    const cssDeps = await getDependencyEntities(es, e.id, 'css');
    if (cssDeps === undefined || cssDeps.length === 0) {
        return undefined;
    }

    const did = es.resolveComponentDefId('/component/text');
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