import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const test = suite('/processor/mdx/assign_title');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each(beforeEach);



test('extract target slug from title', async ({ es, site, options }) => {

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `);
    e.Dst = { url: '/html/' };
    await site.update(e);

    await process(site, options);

    // await printAll(es);

    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Dst.url, '/html/extracting-the-page-title.html');
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




test.run();

