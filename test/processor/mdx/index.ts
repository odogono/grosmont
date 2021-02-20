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
import {
    process as processJSX,
    preprocess as preProcessJSX
} from '../../../src/builder/processor/jsx';

import { parse } from '../../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../../src/builder/types';
import { FindEntityOptions } from '../../../src/builder/query';
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
    ## Here's a Heading
    
    I really like using Markdown.
    `)

    await renderMdx(site, options);

    // await printES(site);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<h2>Here&#x27;s a Heading</h2><p>I really like using Markdown.</p>`);

});


test('frontmatter', async ({ es, site, options }) => {

    let data =
        `
---
title: Test Page
---

## {page.title}

I really like using Markdown.
    `;


    let e = await site.addSrc('file:///pages/main.mdx');
    e.Mdx = { data };
    await site.update(e);

    await renderMdx(site, options);

    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<h2>Test Page</h2><p>I really like using Markdown.</p>`);
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

    assert.equal(e.Text, undefined);

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

    assert.equal(e.Text, undefined);

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

## Main page
    `);

    await addMdx(site, 'file:///pages/disabled.mdx', `
## Disabled page
    `);

    await buildDeps(site, options);

    await renderMdx(site, options);

    // printES(es);

    e = await site.getEntityBySrc('file:///pages/disabled.mdx');
    assert.equal(e.Text, undefined);

    e = await site.getEntityBySrc('file:///pages/main.mdx');
    assert.equal(e.Text.data, '<h2>Main page</h2>');

    // console.log('\n\n---\n');
    // printAll( es );
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


    await mdxPreprocess(site, options);
    await mdxResolveMeta(site, options);

    // await assignTitle(site);
    // printES(es);
    await mdxRender(site, options);

    await buildDstIndex(site, options);

    // await printES(site.es);

    let e = await site.getEntityByDst('/intro.html');
    assert.equal(e.Title.title, 'Welcome');
});


test('master page', async ({ es, site, options }) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout
    let data = `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>
    `;

    let e = await site.addSrc('file:///layout/main.mdx');
    e.Mdx = { data };
    await site.update(e);


    // TODO - allow chains of layouts. doesnt work yet
    //     data = `
    // ---
    // layout: /layout/main
    // ---
    // <h1>{children}</h1>
    //     `;

    //     e = await site.addSrc( 'file:///layout/sub.mdx' );
    //     e.Mdx = { data };
    //     await site.update(e);

    data = `
---
layout: /layout/main
---
Hello _world_
    `;
    e = await site.addSrc('file:///pages/main.mdx');
    e.Mdx = { data };
    await site.update(e);

    await renderMdx(site, options);

    // log('>==');
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    // printES(es);
    // console.log( e );

    assert.equal(e.Text.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


})


test('inlined css', async ({ es, site, options }) => {

    /*
    build an index of urls to entity ids and mime types
    */


    // note - important that import has no leading space
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);

    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);



    await assignMime(site, options);
    await renderScss(site, options);

    // printES(es);

    await renderMdx(site, options);


    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:#00f}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
});


test('old css dependencies are cleared', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    // console.log('\n\n---\n');
    // printAll(es);

    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);

    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:red}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
});



test('inlined css with master page', async ({ es, site, options }) => {

    await addScss(site, 'file:///styles/layout.scss', `body { color: black; }`);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);


    await addMdx(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

import 'file:///styles/layout.scss';

<html lang="en">
    <CSSLinks />
    <body>{children}</body>
</html>` );

    await addMdx(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
---

import 'file:///styles/main.scss';

Hello _world_
    ` );


    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    // console.log('\n\n---\n');
    // printAll(es);

});



test('internal page link', async ({ es, site, options }) => {
    // await addMdx( site, 'file:///pages/main.mdx', `# Main Page`);

    let e = await parse(site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/mdx:
        data: "# Main Page"
    /component/dst:
        url: file:///pages/main.html
    `);
    await site.update(e);

    await addMdx(site, 'file:///pages/about.mdx', `
    # About Page
    [To Main](file:///pages/main.mdx)
    `);

    await assignMime(site, options);
    await renderScss(site, options);
    // printES(es);
    await renderMdx(site, options);

    e = await site.getEntityBySrc('file:///pages/about.mdx');

    assert.equal(e.Text.data,
        `<h1>About Page</h1><p><a href="/pages/main.html">To Main</a></p>`);

});


test('external page link', async ({ es, site, options }) => {
    await addMdx(site, 'file:///pages/main.mdx', `
    [News](https://www.bbc.co.uk/news)
    `);

    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    // printES(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<p><a href="https://www.bbc.co.uk/news">News</a></p>`);

});


test('extract target slug from title', async ({ es, site, options }) => {

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    e.Dst = { url: '/html/' };
    await site.update(e);

    await assignMime(site, options);
    await mdxPreprocess(site, options);

    // printES(es);

    await mdxResolveMeta(site, options);
    await mdxRender(site, options);

    // await printES(site);
    await assignTitle(site, options);


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

    await assignMime(site, options);
    await mdxPreprocess(site, options);

    await assignTitle(site, options);
    // printES(es);

    await mdxResolveMeta(site, options);
    await mdxRender(site, options);


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
    // e.Dst = { url:'/html/' };
    // await site.update(e);

    await assignMime(site, options);
    await mdxPreprocess(site, options);
    await mdxResolveMeta(site, options);

    await assignTitle(site, options);
    await mdxRender(site, options);
    await buildDstIndex(site, options);

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

    await markMdx(site, { onlyUpdated: true });

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

    await markMdx(site, { onlyUpdated: true });

    await mdxPreprocess(site, { onlyUpdated: true });

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

    await mdxRender(site, { onlyUpdated: true });

    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Text, undefined);
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

    await markMdx(site, options);

    await mdxRender(site, options);

    await assignTitle(site, options);

    await buildDstIndex(site, options);

    // await printES(site);

    let e = await site.getEntityByDst('/weeknotes.html');
    assert.is.not(e.Text, undefined);

});



test.run();




async function addScss(site: Site, url: string, data: string) {
    let e = await site.addSrc(url);
    e.Scss = { data };
    await site.update(e);
}

async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Mdx = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
