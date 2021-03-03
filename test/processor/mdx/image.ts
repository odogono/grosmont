import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../../src/builder/site';
import { parse } from '../../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as mdxPreprocess } from '../../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../../src/builder/processor/mdx/resolve_meta';
import { process as mdxRender } from '../../../src/builder/processor/mdx/render';
import { printAll } from 'odgn-entity/src/util/print';
import { FindEntityOptions, selectSrcByExt } from '../../../src/builder/query';
import { Reporter } from '../../../src/builder/reporter';



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

    await mdxPreprocess(site, options);
    await mdxRender(site, options);
    
    // await printAll(es);
    
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>My home</h1><img src="/image.jpg" alt="Image alt"/>`);
});


test.run();




async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Mdx = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
