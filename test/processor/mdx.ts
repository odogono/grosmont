import { suite } from 'uvu';
import Path from 'path';
import { printAll, Site } from '../../src/builder/ecs';
import {
    process as resolveFileDeps,
} from '../../src/builder/processor/file_deps';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { process as resolveTargetPath, selectTargetPath } from '../../src/builder/processor/target_path';
import assert from 'uvu/assert';
import { Entity } from 'odgn-entity/src/entity';

const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = (es) => {
    console.log('\n\n---\n');
    printAll( es );
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

    const target = `file://${rootPath}/dist/`;
    tcx.site = new Site({ idgen, name: 'test', target });
    await tcx.site.init();
    // tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});


test('target path for file', async ({ es, site }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
## Here's a Heading
    
I really like using Markdown.
    `)

    // printES(es);

    await renderMdx(site, es);
    

    let e = await site.getFile('file:///pages/main.mdx');

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


    let e = await site.addFile('file:///pages/main.mdx');
    e.Mdx = { data };
    await site.update(e);

    await renderMdx(site, es);

    e = await site.getFile('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<h2>Test Page</h2><p>I really like using Markdown.</p>`);
});


test('disabled page will not render', async (tcx) => {
    const { es, site } = tcx;


    let e = await site.addFile('file:///pages/main.mdx');
    let data = `
---
isEnabled: false
---

## Main page
    `;
    e.Mdx = { data };
    await site.update(e);


    await renderMdx(site, es);

    e = await site.getFile('file:///pages/main.mdx');

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


    await renderMdx(site, es);

    let e = await site.getFile('file:///pages/main.mdx');

    assert.equal(e.Text, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});



test('meta is inherited from dir deps', async (tcx) => {
    const { es, site } = tcx;

    
    let e = await site.addDir('file:///pages/');
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
    
    await resolveFileDeps(site.es);
    await renderMdx(site, es);

    e = await site.getFile('file:///pages/disabled.mdx');
    assert.equal(e.Text, undefined);

    e = await site.getFile('file:///pages/main.mdx');
    assert.equal(e.Text.data, '<h2>Main page</h2>');

    // console.log('\n\n---\n');
    // printAll( es );
});


test('master page', async (tcx) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout

    const { es, site } = tcx;

    let data = `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>
    `;

    let e = await site.addFile('file:///layout/main.mdx');
    e.Mdx = { data };
    await site.update(e);


    // TODO - allow chains of layouts. doesnt work yet
    //     data = `
    // ---
    // layout: /layout/main
    // ---
    // <h1>{children}</h1>
    //     `;

    //     e = await site.addFile( 'file:///layout/sub.mdx' );
    //     e.Mdx = { data };
    //     await site.update(e);




    data = `
---
layout: /layout/main
---
Hello _world_
    `;
    e = await site.addFile('file:///pages/main.mdx');
    e.Mdx = { data };
    await site.update(e);

    await renderMdx(site, es);

    e = await site.getFile('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


})

// test.only('lookup of url using regex', async ({es, site}) => {

// })


test('inlined css', async ({ es, site }) => {

    /*
    build an index of urls to entity ids and mime types
    */

    // let e = await site.addFile('file:///pages/main.mdx');

    // note - important that import has no leading space
    await addMdx( site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    

    await assignMime(site, es);
    await renderScss(es);
    await renderMdx(site, es);


    let e = await site.getFile('file:///pages/main.mdx');

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

    await assignMime(site, es);
    await renderScss(es);
    await renderMdx(site, es);

    // console.log('\n\n---\n');
    // printAll(es);

    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx( site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);

    await assignMime(site, es);
    await renderScss(es);
    await renderMdx(site, es);

    let e = await site.getFile('file:///pages/main.mdx');

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
    await renderScss(es);
    await renderMdx(site);

    // console.log('\n\n---\n');
    // printAll(es);

});



test('internal page link', async ({es,site}) => {
    await addMdx( site, 'file:///pages/main.mdx', `# Main Page`);

    await addMdx( site, 'file:///pages/about.mdx', `
    # About Page
    [To Main](file:///pages/main.mdx)
    `);

    await assignMime(site);
    await renderScss(es);
    await renderMdx(site);

    // printES(es);

    let e = await site.getFile('file:///pages/about.mdx');

    assert.equal(e.Text.data,
        `<h1>About Page</h1><p><a href="/pages/main.mdx">To Main</a></p>`);

});


test('external page link', async ({es,site}) => {
    await addMdx( site, 'file:///pages/main.mdx', `
    [News](https://www.bbc.co.uk/news)
    `);

    await assignMime(site);
    await renderScss(es);
    await renderMdx(site);

    // printES(es);

    let e = await site.getFile('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<p><a href="https://www.bbc.co.uk/news">News</a></p>`);

});


// processor - extract title meta data from first h1 or h2

// processor - create target using create date and title


test.run();




async function addScss( site:Site,  url:string, data:string ){
    let e = await site.addFile(url);
    e.Scss = {data};
    await site.update(e);
}

async function addMdx( site:Site, url:string, data:string, meta?:any ){
    let e = await site.addFile(url);
    e.Mdx = { data };
    if( meta !== undefined ){
        e.Meta = { meta };
    }
    await site.update(e);
}