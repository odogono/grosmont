import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { addSrc, beforeEach, printAll, process } from '../../helpers';

const test = suite('/processor/mdx/master');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);



test.before.each(beforeEach);




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

test('master page receives childs properties', async ({ es, site, options }) => {
    await addSrc(site, 'file:///layout/master.mdx', `
---
isRenderable: false
title: Master Page
---
import { e } from '@site';

    <html lang="en"><head>
    <title>{e.Title.title}</title></head>
    <body>{children}</body></html>`);


    await addSrc(site, 'file:///pages/main.mdx', `
---
layout: /layout/master
date: 2021/03/10
isMain: true
---
import { e, layout } from '@site';

    # Main Page
    Hello {e.Title.title}, layout is {layout.Title.title}
        `);

    await process(site, { ...options, beautify: true });

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<html lang="en">

<head>
    <title>Main Page</title>
</head>

<body>
    <h1>Main Page</h1>
    <p>Hello Main Page, layout is Master Page</p>
</body>

</html>`);
})


test.skip('import mdx', async ({ es, site, options }) => {
    await addSrc(site, 'file:///message.mdx', `<a href="/main">Main</a>`);

    await addSrc(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---
import Message from 'file:///message.mdx';

<html lang="en">
    <body>
        <div><Message /></div>
        {children}
    </body>
</html>`);


    await addSrc(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
dst: /main.html
---
Main Page
    `);

    await process(site, options);

    await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    log(e.Output.data);

});


test('override layout from parent', async ({ es, site, options }) => {
    await addSrc(site, 'file:///layout/first.mdx', `
        <body><h1>1st</h1>{children}</body>
    `, { isRenderable: false });
    await addSrc(site, 'file:///layout/second.mdx', `
        <body><h1>2nd</h1>{children}</body>
    `, { isRenderable: false });
    await addSrc(site, 'file:///layout/third.mdx', `
        <body><h1>3rd</h1>{children}</body>
    `, { isRenderable: false });

    await parseEntity(site, `
    src: file:///dir.e.yaml
    layout: /layout/first
    `);

    await parseEntity(site, `
    src: file:///pages/dir.e.yaml
    layout: /layout/second
    `);

    await addSrc(site, 'file:///pages/main.mdx', `
---
layout: /layout/third
dst: /main.html
---
Main Page`);

    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<body><p><h1>3rd</h1><p>Main Page</p></p></body>`);

});



test.run();

