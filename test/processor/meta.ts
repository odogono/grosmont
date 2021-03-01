import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parse } from '../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as markStatic } from '../../src/builder/processor/static/mark';
import { process as copyStatic } from '../../src/builder/processor/static/copy';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as buildDeps } from '../../src/builder/processor/build_deps';
import { printAll } from 'odgn-entity/src/util/print';
import { FindEntityOptions, getDstUrl, selectSrcByExt } from '../../src/builder/query';
import { Reporter } from '../../src/builder/reporter';
import { readFileMeta } from '../../src/builder/processor/file';



const log = (...args) => console.log('[TestProcMeta]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/meta');



test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/test/fixtures/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    let reporter = tcx.reporter = new Reporter();
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter } as FindEntityOptions;
});



test('selects src by extension', async ({site,es, options}) => {

    await parse( site, `
    src: file:///pages/
    `);

    await parse( site, `
    src: file:///pages/dir.e.yaml
    dst: /pages/
    `);

    await parse( site, `
    src: file:///pages/beta.mdx
    dst: beta.html
    `);

    await readFileMeta(site, options);

    await buildDeps(site, options);

    await mdxResolveMeta(site, options);

    await buildDstIndex(site, options);

    await printAll( es );

    const e = await site.getEntityBySrc( 'file:///pages/beta.mdx' );

    const dst = await getDstUrl(es, e.id);

    log('dst', dst);

    // let coms = await selectSrcByExt( es, ['jpeg', 'html'], options);

    // assert.equal( coms.map(c=>c.url), ['file:///alpha.JPEG', 'file:///beta.html'] );
    
    // coms = await selectSrcByExt( es, ['html'], options);
});


test.run();