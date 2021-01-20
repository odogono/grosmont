import { toComponentId } from "odgn-entity/src/component";
import { Entity } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { buildUrl } from "../../../util/uri";
import { Site, SiteIndex } from "../../ecs";
import { getDependencyEntities } from "../../util";
import { selectTargetPath } from "../target_path";
import { PageLink, PageLinks, TranspileProps } from "./types";



export function buildProps(e: Entity): TranspileProps {
    let data = e.Mdx.data;
    let eMeta = e.Meta?.meta ?? {};
    let path = e.File?.uri ?? '';
    let props: TranspileProps = { path, data, meta: eMeta };

    return props;
}


export async function buildPageLinks( es:EntitySet, linkIndex:SiteIndex ){
    let result:PageLinks = new Map<string,PageLink>();

    
    for( const [url, [eid,type,child]] of linkIndex.index ){
        if( type === 'external' ){
            result.set(url, {url});
        } else {
            let path = await selectTargetPath(es, eid);
            result.set(url, {url:path});
        }
    }
    // log('[buildPageLinks]', linkIndex.index);
    // log('[buildPageLinks]', result);

    return result;
}



export async function buildFileIndex(site: Site) {
    // let es = site.es;
    const siteEntity = site.getSite();

    // let files = await selectFiles(es, siteEntity.id);

    // select entities with /component/file AND /component/text (eg. have been rendered)
    const query = `[
        /component/site_ref#ref !ca $ref ==
        [/component/file /component/text /component/meta] !bf
        and
        @e
    ] select

    [ /component/file#uri /id /component/meta#/meta/mime ] pluck

    `;

    return await site.addQueryIndex('/index/fileUri', query, { ref: siteEntity.id });
}



export async function selectMdx(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/mdx !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}

/**
 * Returns a url pointing to the value to import from a file path
 * 
 * @param fileIndex 
 * @param path 
 */
export function getEntityImportUrlFromPath(fileIndex: SiteIndex, path: string) {
    if (fileIndex === undefined || path == '') {
        return undefined;
    }
    const entry = fileIndex.index.get(path);
    if (entry === undefined) {
        return undefined;
    }
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
        let path = await selectTargetPath(es, dst);

        // log('[getEntityCSSDependencies]', dst, did);
        const com = await es.getComponent(toComponentId(dst, did));

        result.push({ path, text: com.data });
    }

    return result;
}