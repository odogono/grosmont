import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addMdx, addScss, beforeEach, createSite, process, rootPath } from './helpers';

const log = (...args) => console.log('[TestProcMDX]', ...args);

const test = suite('processor/mdx/css');
test.before.each(beforeEach);


test('inlined css', async ({ es, site, options }) => {


    // note - important that import has no leading space
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);

    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<style>h2{color:#00f}</style><h2>Main page</h2>`);
});


test('old css dependencies are cleared', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await process(site, options);




    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);


    // log('\n\n 👟 \n\n');

    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<style>h2{color:red}</style><h2>Main page</h2>`);
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


    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');
    assert.equal(e.Output.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


    // printAll(es);


});



test.run();