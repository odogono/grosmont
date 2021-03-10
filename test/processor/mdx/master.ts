import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const test = suite('processor/mdx/master');

const log = (...args) => console.log(`[${test.name}]`, ...args);



test.before.each(beforeEach);




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

test('master page receives childs properties', async ({ es, site, options }) => {
    await addMdx(site, 'file:///layout/main.mdx', `
---
isRenderable: false
title: Master Page
---
    
    <html lang="en"><head>
    <title>{e.Title.title}</title></head>
    <body>{children}</body></html>`);


    await addMdx(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
date: 2021/03/10
isMain: true
---

    # Main Page
    Hello {e.Title.title}
        `);

    // console.log('\n\n');
    await process(site, options);

    // await printAll(es);
    // console.log('\n\n');

    let e = await site.getEntityBySrc('file:///pages/main.mdx');
    // let e = await site.getEntityBySrc('file:///layout/main.mdx');
    // printEntity(es, e);

    // log(e.Js.data);
    // console.log('\n\n');
    // log(e.Output.data);

    assert.equal(e.Output.data,
        `<html lang="en"><head><title>Main Page</title></head><body><h1>Main Page</h1><p>Hello Main Page</p></body></html>`);
})



test.run();

