import { suite } from 'uvu';
import Path from 'path';
import { printAll, Site } from '../../src/builder/ecs';
import { 
    process as resolveFileDeps, 
} from '../../src/builder/processor/file_deps';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { process as resolveTargetPath, selectTargetPath } from '../../src/builder/processor/target_path';
import assert from 'uvu/assert';
import { Entity } from 'odgn-entity/src/entity';
import { EntitySet } from 'odgn-entity/src/entity_set';

const log = (...args) => console.log('[TestProcMDX]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/mdx');


interface TestContext {
    site:Site;
    siteEntity: Entity;
    es: EntitySet;
}


test.before.each( async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const target = `file://${rootPath}/dist/`;
    tcx.site = new Site({idgen, name:'test', target});
    await tcx.site.init();
    tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});


test('target path for file', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    let data = `
## Here's a Heading

I really like using Markdown.
    `;


    let e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    e.Mdx = { data };
    await site.update(e);

    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );

    assert.equal( e.Text.data, 
        `<h2>Here&#x27;s a Heading</h2><p>I really like using Markdown.</p>` );

    // console.log( e );
    // await site.run(init);

    // let path = await selectTargetPath( es, 1002 );

    // assert.equal( path, 'file:///Users/alex/work/odgn/cms/dist/content/pages/test.html' );

    // log('target path', path);

    // console.log('\n\n---\n');
    // printAll( es );
});


test('frontmatter', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    let data = 
`
---
title: Test Page
---

## {page.title}

I really like using Markdown.
    `;


    let e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    e.Mdx = { data };
    await site.update(e);

    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );

    assert.equal( e.Text.data, 
        `<h2>Test Page</h2><p>I really like using Markdown.</p>` );
});


test('disabled page will not render', async (tcx) => {
    const {es, site, siteEntity} = tcx;

    
    let e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    let data = `
---
isEnabled: false
---

## Main page
    `;
    e.Mdx = {data};
    await site.update( e );


    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );

    assert.equal( e.Text, undefined );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('meta disabled page will not render', async (tcx) => {
    const {es, site, siteEntity} = tcx;

    
    let e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    let data = `
## Main page
    `;
    e.Mdx = {data};
    e.Meta = { meta:{ isEnabled: false} };
    await site.update( e );


    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );

    assert.equal( e.Text, undefined );

    // console.log('\n\n---\n');
    // printAll( es );
});



test('meta is inherited from dir deps', async (tcx) => {
    const {es, site, siteEntity} = tcx;

    let e = await site.addDir( siteEntity, 'file:///pages/' );
    e.Meta = { meta:{ isEnabled:false } };
    await site.update(e);

    e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    let data = `
---
isEnabled: true
---

## Main page
    `;
    e.Mdx = {data};
    await site.update( e );

    e = await site.addFile( siteEntity, 'file:///pages/disabled.mdx' );
    data = `
## Disabled page
    `;
    e.Mdx = {data};
    await site.update( e );

    await resolveFileDeps( site.es );
    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/disabled.mdx' );
    assert.equal( e.Text, undefined );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );
    assert.equal( e.Text.data, '<h2>Main page</h2>' );

    // console.log('\n\n---\n');
    // printAll( es );
});


test('master page', async (tcx) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout

    const {es, site, siteEntity} = tcx; 

    let data = `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>
    `;

    let e = await site.addFile( siteEntity, 'file:///layout/main.mdx' );
    e.Mdx = { data };
    await site.update(e);
    
    
//     data = `
// ---
// layout: /layout/main
// ---
// <h1>{children}</h1>
//     `;

//     e = await site.addFile( siteEntity, 'file:///layout/sub.mdx' );
//     e.Mdx = { data };
//     await site.update(e);




    data = `
---
layout: /layout/main
---
Hello _world_
    `;
    e = await site.addFile( siteEntity, 'file:///pages/main.mdx' );
    e.Mdx = { data };
    await site.update(e);
    
    await renderMdx( site, es );

    e = await site.getFile( siteEntity, 'file:///pages/main.mdx' );

    assert.equal( e.Text.data, 
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>` );

    // console.log('\n\n---\n');
    // printAll( es );
})




test('inlined css', async (tcx) => {
});

test('inlined css with master page', async (tcx) => {
});

test.run();