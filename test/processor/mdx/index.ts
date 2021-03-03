import { suite } from 'uvu';
import Path from 'path';
import Beautify from 'js-beautify';
import { Site } from '../../../src/builder/site';
import { process as assignMime } from '../../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as renderMdx } from '../../../src/builder/processor/mdx';
import { process as assignTitle } from '../../../src/builder/processor/assign_title';
import { process as mdxPreprocess } from '../../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../../src/builder/processor/mdx/resolve_meta';
import { process as applyTags } from '../../../src/builder/processor/mdx/apply_tags';
import { process as mdxRender } from '../../../src/builder/processor/mdx/render';
import { process as buildDeps } from '../../../src/builder/processor/build_deps';
import { process as buildDstIndex } from '../../../src/builder/processor/dst_index';
import { process as markMdx } from '../../../src/builder/processor/mdx/mark';

import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalMdx } from '../../../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../../../src/builder/processor/mdx/eval_js';
import { process as renderJs } from '../../../src/builder/processor/mdx/render_js';
import { process as resolveMeta } from '../../../src/builder/processor/mdx/resolve_meta';

import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';

import { parse } from '../../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../../src/builder/types';
import { EntityId } from 'odgn-entity/src/entity';


const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = async (site: Site) => {
    console.log('\n\n---\n');
    await printAll(site.es);
}

const rootPath = Path.resolve(__dirname, "../../../");
const test = suite('processor/mdx');


// interface TestContext {
//     site: Site;
//     siteEntity: Entity;
//     es: EntitySet;
// }


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    tcx.site = await Site.create({ idgen, name: 'test', es, dst });
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});


test('target path for file', async ({ es, site, options }) => {


    await addMdx(site, 'file:///pages/main.mdx', `
    # Here's a Heading
    
    I really like using Markdown.
    `)

    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await buildSrcIndex(site);

    // creates a /component/js with the data
    await evalMdx(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);
    
    // renders the js to /component/output
    await renderJs(site, options);


    // await printAll(es);
    

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>Here&#x27;s a Heading</h1><p>I really like using Markdown.</p>`);
});

test('frontmatter', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
---
title: Test Page
---

# {page.title}

I really like using Markdown.
    `);

    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await buildSrcIndex(site);

    // creates a /component/js with the data
    await evalMdx(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);
    
    // renders the js to /component/output
    await renderJs(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');
    assert.equal(e.Output.data,
        `<h1>Test Page</h1><p>I really like using Markdown.</p>`);
});


test('disabled page will not render', async ({ es, site, options }) => {

    let e = await site.addSrc('file:///pages/main.mdx');
    let data = `
---
isEnabled: false
---

## Main page
    `;
    e.Mdx = { data };
    await site.update(e);


    await renderMdx(site, options);

    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});

test('meta disabled page will not render', async (tcx) => {
    const { es, site } = tcx;


    await addMdx(site, 'file:///pages/main.mdx', `
## Main page
    `, { isEnabled: false });

    // e.Meta = { meta: { isEnabled: false } };
    // await site.update(e);


    await renderMdx(site);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});



test('meta is inherited from dir deps', async ({ es, site, options }) => {

    let e = await site.addSrc('file:///pages/');
    e.Meta = { meta: { isEnabled: false } };
    await site.update(e);

    await addMdx(site, 'file:///pages/main.mdx', `
---
isEnabled: true
---

# Main page
    `);

    await addMdx(site, 'file:///pages/disabled.mdx', `
# Disabled page
    `);

    await process(site, options);
    

    // await printAll(es);

    e = await site.getEntityBySrc('file:///pages/disabled.mdx');
    assert.equal(e.Output, undefined);

    e = await site.getEntityBySrc('file:///pages/main.mdx');
    assert.equal(e.Output.data, '<h1>Main page</h1>');

});


test('dst defined in meta is applied to entity', async ({ es, site, options }) => {
    await addMdx(site, 'file:///index.mdx', `
---
dst: intro.html
tags: [ "one", "two" ]
/component/url:
  url: https://www.bbc.co.uk/news
---
# Welcome
    `);


    await process(site, options);

    // await printES(site.es);

    let e = await site.getEntityByDst('/intro.html');
    assert.equal(e.Title.title, 'Welcome');
});



test('master page', async ({ es, site, options }) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout
    await addMdx(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>`);

    
await addMdx(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
---
Hello _world_
    `);
    
    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


});



test('internal page link', async ({ es, site, options }) => {
    // await addMdx( site, 'file:///pages/main.mdx', `# Main Page`);

    let e = await parse(site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/data:
        data: "# Main Page"
    /component/dst:
        url: /pages/main.html
    `);
    await site.update(e);

    await addMdx(site, 'file:///pages/about.mdx', `
---
dst: about.html
---
    # About Page
    [To Main](./main.mdx)
    `);

    await process(site, options);

    
    // await printAll(es);

    // log( site.getIndex('/index/dstUrl') );

    e = await site.getEntityBySrc('file:///pages/about.mdx');

    assert.equal(e.Output.data,
        `<h1>About Page</h1><p><a href="/pages/main.html">To Main</a></p>`);

});


test('external page link', async ({ es, site, options }) => {
    await addMdx(site, 'file:///pages/main.mdx', `
    [News](https://www.bbc.co.uk/news)
    `);

    await process(site, options);

    // printES(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<p><a href="https://www.bbc.co.uk/news">News</a></p>`);

});


test('extract target slug from title', async ({ es, site, options }) => {

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    e.Dst = { url: '/html/' };
    await site.update(e);

    await process(site, options);


    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Dst.url, '/html/extracting-the-page-title.html');

    // log( es );
    // printES(es);
});

test('extract target slug from title with dst', async ({ es, site, options }) => {

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    e.Dst = { url: '/html/' };
    await site.update(e);

    await process(site, options);

    
    

    // await printES(es);

    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Dst.url, '/html/extracting-the-page-title.html');

});

test('title does not override dst', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
---
dst: index.html
---
# Extracting the Page Title
    `);
    
    await process(site, options);

    let e = await site.getEntityByDst('/index.html');
    assert.equal(e.Title.title, 'Extracting the Page Title');

    // e = await site.getEntityBySrc('file:///pages/main.mdx');

    // assert.equal( e.Dst.url, '/index.html');

    // printES(es);
});




test('mark will only consider updated', async ({ es, site }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/upd:
        op: 2
    `);

    await process(site, {onlyUpdated:true});

    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Mdx, undefined);
});

test('preprocess will only consider updated', async ({ es, site, options }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/mdx:
        data: "# Beta"
    /component/upd:
        op: 2
    `);

    await process(site, {onlyUpdated:true});

    // await markMdx(site, { onlyUpdated: true });

    // await mdxPreprocess(site, { onlyUpdated: true });

    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Title, undefined);
});

test('render will only consider updated', async ({ es, site, options }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/mdx:
        data: "# Beta"
    /component/upd:
        op: 1
    `);

    // await markMdx( site, {onlyUpdated:true} );

    await process(site, {onlyUpdated:true});
    // await mdxRender(site, { onlyUpdated: true });

    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Output, undefined);
});



test('process directly from file', async () => {
    let id = 1000;
    const idgen = () => ++id;

    const configPath = `file://${rootPath}/test/fixtures/rootD.yaml`;
    const site = await Site.create({ idgen, configPath });
    let options: FindEntityOptions = { siteRef: site.getRef() as EntityId };


    await parse(site, `
    src: file:///weeknotes/2021-01-10.mdx
    dst: weeknotes.html
    `);

    await process(site, options);

    // await printES(site);

    let e = await site.getEntityByDst('/weeknotes.html');
    assert.is.not(e.Output, undefined);

});



test.run();



async function process( site:Site, options?:ProcessOptions ){
    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await buildSrcIndex(site);
    await buildDeps(site, options);

    // creates a /component/js with the data
    await evalMdx(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);

    // resolve meta with parents
    await resolveMeta( site, options );

    await assignTitle(site, options);

    await buildDstIndex(site, options);
    
    // renders the js to /component/output
    await renderJs(site, options);
}


async function addScss(site: Site, url: string, data: string) {
    let e = await site.addSrc(url);
    e.Data = { data };
    await site.update(e);
}

async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
