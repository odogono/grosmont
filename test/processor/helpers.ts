import { suite } from 'uvu';
import Path from 'path';
import { Site, SiteOptions } from '../../src/builder/site';
import { process as buildDirDeps } from '../../src/builder/processor/build_dir_deps';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as assignTitle } from '../../src/builder/processor/assign_title';

import { process as applyTags } from '../../src/builder/processor/apply_tags';
import { process as buildDstIndex } from '../../src/builder/processor/build_dst_index';

import { process as mark } from '../../src/builder/processor/mark';
import { process as evalClientCode } from '../../src/builder/processor/client_code';
import { process as evalMdx } from '../../src/builder/processor/mdx/eval';
import { process as evalJs } from '../../src/builder/processor/js/eval';
import { process as evalJsx } from '../../src/builder/processor/jsx/eval';
import { process as renderJs } from '../../src/builder/processor/js/render';
import { process as resolveMeta } from '../../src/builder/processor/mdx/resolve_meta';

import { buildSrcIndex, FindEntityOptions, selectEntityBySrc } from '../../src/builder/query';

import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../src/builder/types';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { Level } from '../../src/builder/reporter';
import { parseEntity } from '../../src/builder/config';

export const rootPath = Path.resolve(__dirname, "../../");


export async function createSite(options:SiteOptions = {}){
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB, idgen });

    return await Site.create({ name: 'test', es, dst, level: Level.ERROR, ...options });
}

export async function beforeEach(tcx) {
    tcx.site = await createSite();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter:tcx.site.reporter } as FindEntityOptions;
}



export async function process( site:Site, options?:ProcessOptions ){
    await mark(site, { ...options, exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' } );
    await mark(site, { ...options, exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await mark(site, { ...options, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    await buildDirDeps(site, options);

    await buildSrcIndex(site);

    await renderScss(site, options);

    await evalJsx(site, options);

    // creates a /component/js with the data
    await evalMdx(site, options);

    await applyTags(site, options);

    
    // evaluates the js, and returns metadata
    await evalJs(site, options);
    
    await evalClientCode(site, options);
    
    // resolve meta with parents
    await resolveMeta( site, options );
    
    await buildDstIndex(site, options);
    
    // renders the js to /component/output
    await renderJs(site, options );

    await assignTitle(site, options);
}


export async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}



export async function addSrc(site: Site, url: string, data: string, additional:any = {}) {
    let e = await site.getEntityBySrc(url);
    let add = e === undefined;

    e = await parseEntity( site, {
        src: url,
        data,
        ...additional}, { add, e } );

    if( !add ){
        await site.es.add( e );
    }
}

export async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    await parseEntity( site, `
    /component/dep:
        src: ${src}
        dst: ${dst}
        type: dir
    `);
}
