import Path from 'path';
import { Site, SiteOptions } from '../../../src/builder/site';
import { process as buildDirDeps } from '../../../src/builder/processor/build_dir_deps';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as assignTitle } from '../../../src/builder/processor/assign_title';

import { process as applyTags } from '../../../src/builder/processor/apply_tags';
import { process as buildDstIndex } from '../../../src/builder/processor/build_dst_index';

import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalMdx } from '../../../src/builder/processor/mdx/eval';
import { process as evalJs } from '../../../src/builder/processor/js/eval';
import { process as evalJsx } from '../../../src/builder/processor/jsx/eval';
import { process as renderJs } from '../../../src/builder/processor/js/render';
import { process as resolveMeta } from '../../../src/builder/processor/mdx/resolve_meta';

import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';


import { 
    EntitySetSQL,
    EntityId,
} from '../../../src/es';

import { ProcessOptions } from '../../../src/builder/types';
import { Level } from '../../../src/builder/reporter';
export { addMdx, addSrc } from '../helpers';

export const rootPath = Path.resolve(__dirname, "../../../");


export async function createSite(options:SiteOptions = {}){
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    return await Site.create({ idgen, name: 'test', es, dst, level: Level.ERROR, ...options });
}

export async function beforeEach(tcx) {
    tcx.site = await createSite();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter:tcx.site.reporter } as FindEntityOptions;
}



export async function process( site:Site, options?:ProcessOptions ){

    // const spec:RawProcessorEntry[] = [
    //     [ '/processor/mark#jsx' ],
    //     [ '/processor/mark#mdx' ],
    //     [ '/processor/mark#scss' ],
    //     [ '/processor/build_dir_deps' ],
    //     [ '/processor/build_src_index' ],
    //     [ '/processor/jsx/eval'],
    //     [ '/processor/mdx/eval'],
    //     [ '/processor/apply_tags'],
    //     [ '/processor/js/eval'],
    //     [ '/processor/resolve_meta'],
    //     [ '/processor/build_dst_index'],
    //     [ '/processor/js/render'],
    //     [ '/processor/assign_title'],
    // ];

    // const process = await buildProcessors( site, spec );
    // await process(site,options);

    await mark(site, {...options, exts: ['html', 'jpeg', 'jpg', 'png', 'svg', 'txt'], comUrl: '/component/static' });
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

    // resolve meta with parents
    await resolveMeta( site, options );
    
    await buildDstIndex(site, options);
    
    // renders the js to /component/output
    await renderJs(site, options);

    await assignTitle(site, options);
}

