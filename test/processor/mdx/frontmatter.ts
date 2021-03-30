import { printAll } from 'odgn-entity/src/util/print';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addSrc, beforeEach, process } from '../../helpers';


const test = suite('/processor/mdx/frontmatter');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);

test.before.each(beforeEach);


test('frontmatter', async ({ es, site, options }) => {

    await addSrc(site, 'file:///pages/main.mdx', `
---
title: Test Page
---
import {page} from '@site';

# {page.Title.title}

I really like using Markdown.
    `);

    await process(site, options);

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


    await process(site, options);

    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output, undefined);

    // console.log('\n\n---\n');
    // printAll( es );
});

test('meta is inherited from dir deps', async ({ es, site, options }) => {

    let e = await site.addSrc('file:///pages/');
    e.Meta = { meta: { isEnabled: false } };
    await site.update(e);

    await addSrc(site, 'file:///pages/main.mdx', `
---
isEnabled: true
---

# Main page
    `);

    await addSrc(site, 'file:///pages/disabled.mdx', `
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
    await addSrc(site, 'file:///index.mdx', `
---
dst: intro.html
tags: [ "one", "two" ]
/component/url:
  url: https://www.bbc.co.uk/news
---
# Welcome
    `);


    await process(site, options);

    // await printAll( es );

    let e = await site.getEntityByDst('/intro.html');
    assert.equal(e.Title.title, 'Welcome');
});



test('master page', async ({ es, site, options }) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout
    await addSrc(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>`);

    
await addSrc(site, 'file:///pages/main.mdx', `
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




test.run();


