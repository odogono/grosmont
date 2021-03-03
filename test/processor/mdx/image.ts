import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';

import { process as buildDirDeps } from '../../../src/builder/processor/build_deps';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalMdx } from '../../../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../../../src/builder/processor/mdx/eval_js';
import { process as evalJsx } from '../../../src/builder/processor/jsx/eval_jsx';
import { process as renderJs } from '../../../src/builder/processor/mdx/render_js';
import { process as applyTags } from '../../../src/builder/processor/mdx/apply_tags';
import { process as buildDstIndex } from '../../../src/builder/processor/dst_index';
import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';

import { Site } from '../../../src/builder/site';
import { parse } from '../../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { printAll } from 'odgn-entity/src/util/print';
import { Reporter } from '../../../src/builder/reporter';
import { ProcessOptions } from '../../../src/builder/types';



const log = (...args) => console.log('[TestMdxImage]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/mdx/image');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/test/fixtures/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    const reporter = new Reporter();
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter } as FindEntityOptions;
});



test('renders image', async ({site,es, options}) => {

    await parse( site, `
    src: file:///static/image.jpg
    dst: image.jpg
    `);

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# My home

<img src={'file:///static/image.jpg'} alt="Image alt" />

    `);

    await process(site, options);
    
    // await printAll(es);
    
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>My home</h1><img src="/image.jpg" alt="Image alt"/>`);
});


test.run();



async function process(site: Site, options: ProcessOptions) {
    await mark(site, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await mark(site, { exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    await buildDirDeps(site, options);

    await buildSrcIndex(site);

    await renderScss(site, options);

    await evalJsx(site, options);

    await evalMdx(site, options);

    await applyTags(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);

    await buildDstIndex(site, options);

    // renders the js to /component/output
    await renderJs(site, options);
}

async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
