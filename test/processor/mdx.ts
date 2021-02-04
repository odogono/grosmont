import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { process as assignTitle } from '../../src/builder/processor/assign_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as applyTags } from '../../src/builder/processor/mdx/apply_tags';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';
import { process as buildDeps } from '../../src/builder/processor/build_deps';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';

import { parse } from '../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';


const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    await printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
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
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    // tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});


test('target path for file', async ({ es, site }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
## Here's a Heading
    
I really like using Markdown.
    `)

    
    await renderMdx(site);
    
    // printES(es);

    let e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<h2>Here&#x27;s a Heading</h2><p>I really like using Markdown.</p>`);

});


test('frontmatter', async (tcx) => {
    const { es, site } = tcx;
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

    await renderMdx(site);

    e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<h2>Test Page</h2><p>I really like using Markdown.</p>`);
});


test('disabled page will not render', async (tcx) => {
    const { es, site } = tcx;


    let e = await site.addSrc('file:///pages/main.mdx');
    let data = `
---
isEnabled: false
---

## Main page
    `;
    e.Mdx = { data };
    await site.update(e);


    await renderMdx(site);

    e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});

test('meta disabled page will not render', async (tcx) => {
    const { es, site } = tcx;


    await addMdx(site, 'file:///pages/main.mdx', `
## Main page
    `, {isEnabled: false} );
    
    // e.Meta = { meta: { isEnabled: false } };
    // await site.update(e);


    await renderMdx(site);

    let e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});



test('meta is inherited from dir deps', async (tcx) => {
    const { es, site } = tcx;

    
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
    
    await buildDeps(site);

    await renderMdx(site);

    // printES(es);

    e = await site.getSrc('file:///pages/disabled.mdx');
    assert.equal(e.Text, undefined);

    e = await site.getSrc('file:///pages/main.mdx');
    assert.equal(e.Text.data, '<h2>Main page</h2>');

    // console.log('\n\n---\n');
    // printAll( es );
});


test('dst defined in meta is applied to entity', async ({es,site}) => {
    await addMdx(site, 'file:///index.mdx', `
---
dst: intro.html
tags: [ "one", "two" ]
/component/url:
  url: https://www.bbc.co.uk/news
---
# Welcome
    `);


    await mdxPreprocess(site);
    await mdxResolveMeta(site);
    
    // await assignTitle(site);
    // printES(es);
    await mdxRender(site);

    await buildDstIndex(site);

    // await printES(site.es);

    let e = await site.getEntityByDst('/intro.html');
    assert.equal( e.Title.title, 'Welcome');
});


test('master page', async ({es,site}) => {

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

    await renderMdx(site);

    // log('>==');
    e = await site.getSrc('file:///pages/main.mdx');

    // printES(es);
    // console.log( e );
    
    assert.equal(e.Text.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


})


test('inlined css', async ({ es, site }) => {

    /*
    build an index of urls to entity ids and mime types
    */


    // note - important that import has no leading space
    await addMdx( site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    

    await assignMime(site);
    await renderScss(site);

    // printES(es);

    await renderMdx(site);


    let e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:#00f}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
});


test('old css dependencies are cleared', async ({ es, site }) => {

    await addMdx( site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await assignMime(site);
    await renderScss(site);
    await renderMdx(site);

    // console.log('\n\n---\n');
    // printAll(es);

    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx( site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);

    await assignMime(site);
    await renderScss(site);
    await renderMdx(site);

    let e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:red}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
});



test('inlined css with master page', async ({ es, site }) => {

    await addScss(site, 'file:///styles/layout.scss', `body { color: black; }`);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    
    await addMdx( site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

import 'file:///styles/layout.scss';

<html lang="en">
    <CSSLinks />
    <body>{children}</body>
</html>` );

    await addMdx( site, 'file:///pages/main.mdx', `
---
layout: /layout/main
---

import 'file:///styles/main.scss';

Hello _world_
    ` );
    

    await assignMime(site);
    await renderScss(site);
    await renderMdx(site);

    // console.log('\n\n---\n');
    // printAll(es);

});



test('internal page link', async ({es,site}) => {
    // await addMdx( site, 'file:///pages/main.mdx', `# Main Page`);

    let e = await parse( site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/mdx:
        data: "# Main Page"
    /component/dst:
        url: file:///pages/main.html
    `);
    await site.update(e);

    await addMdx( site, 'file:///pages/about.mdx', `
    # About Page
    [To Main](file:///pages/main.mdx)
    `);

    await assignMime(site);
    await renderScss(site);
    // printES(es);
    await renderMdx(site);

    e = await site.getSrc('file:///pages/about.mdx');

    assert.equal(e.Text.data,
        `<h1>About Page</h1><p><a href="/pages/main.html">To Main</a></p>`);

});


test('external page link', async ({es,site}) => {
    await addMdx( site, 'file:///pages/main.mdx', `
    [News](https://www.bbc.co.uk/news)
    `);

    await assignMime(site);
    await renderScss(site);
    await renderMdx(site);

    // printES(es);

    let e = await site.getSrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<p><a href="https://www.bbc.co.uk/news">News</a></p>`);

});


test('extract target slug from title', async({es,site}) => {

    let e = await addMdx( site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    await site.update(e);

    await assignMime(site);
    await mdxPreprocess(site);
    
    // printES(es);
    
    await mdxResolveMeta(site);
    await mdxRender(site);
    
    await assignTitle(site);

    e = await site.getSrc('file:///pages/main.mdx');

    assert.equal( e.Dst.url, 'extracting-the-page-title.html');

    // printES(es);

});

test('extract target slug from title with dst', async({es,site}) => {

    let e = await addMdx( site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    e.Dst = { url:'/html/' };
    await site.update(e);

    await assignMime(site);
    await mdxPreprocess(site);
    
    await assignTitle(site);
    // printES(es);
    
    await mdxResolveMeta(site);
    await mdxRender(site);
    

    // await printES(es);

    e = await site.getSrc('file:///pages/main.mdx');

    assert.equal( e.Dst.url, '/html/extracting-the-page-title.html');

});

test('title does not override dst', async({es,site}) => {

    await addMdx( site, 'file:///pages/main.mdx', `
---
dst: index.html
---
# Extracting the Page Title
    `);
    // e.Dst = { url:'/html/' };
    // await site.update(e);

    await assignMime(site);
    await mdxPreprocess(site);
    await mdxResolveMeta(site);
    
    await assignTitle(site);
    await mdxRender(site);
    await buildDstIndex(site);

    let e = await site.getEntityByDst('/index.html');
    assert.equal( e.Title.title, 'Extracting the Page Title');

    // e = await site.getSrc('file:///pages/main.mdx');

    // assert.equal( e.Dst.url, '/index.html');

    // printES(es);
});


test('tags in mdx', async({es,site}) => {
    let e = await addMdx( site, 'file:///pages/main.mdx',`
---
tags:
- weeknotes
- blog
- Good Stuff
---
## Things that happened
    `);
    e.Meta = {meta:{ tags:[ 'active'] } };
    await site.update(e);

    e = await addMdx(site, 'file:///pages/about.mdx', `## About Me`, { tags:'blog'} );

    await mdxPreprocess(site);

    // convert /meta tags into dependencies
    // await applyTags(site);

    // await printES( es );

    let eids = await site.findByTags(['weeknotes', 'blog'] );

    assert.equal( eids, [ 1002 ] );
});


test('tags inherited from dir', async({es,site}) => {
    await parse( site, `
    id: 1998
    src: /pages/
    tags:
        - blog
        - odgn
    `);

    await parse( site, `
    id: 1999
    src: /pages/2021/
    tags:
        - 2021
    `);

    await addMdx( site, 'file:///pages/2021/main.mdx',`
---
tags:
- things
---
# Things that happened
    `);

    await buildDeps(site);

    await mdxPreprocess(site);

    await applyTags(site);

    // await printES(es);

    assert.equal( 
        await site.findByTags(['blog', 'odgn'] ),
        [1008,1998,1999] );
    assert.equal( 
        await site.findByTags(['things'] ),
        [1008] );
    assert.equal( 
        await site.findByTags(['2021', 'blog'] ),
        [1008, 1999] );
    assert.equal( 
        await site.findByTags(['2021', 'things'] ),
        [1008] );
    // let eids = await site.findByTags(['2021', 'blog'] );
    // log( eids );
});



// processor - extract title meta data from first h1 or h2

// processor - create target using create date and title




test.run();




async function addScss( site:Site,  url:string, data:string ){
    let e = await site.addSrc(url);
    e.Scss = {data};
    await site.update(e);
}

async function addMdx( site:Site, url:string, data:string, meta?:any ){
    let e = await site.addSrc(url);
    e.Mdx = { data };
    if( meta !== undefined ){
        e.Meta = { meta };
    }
    return await site.update(e);
}