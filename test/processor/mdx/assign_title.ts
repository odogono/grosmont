import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addSrc, beforeEach, printAll, process } from '../../helpers';

const test = suite('/processor/mdx/assign_title');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each(beforeEach);

test.skip('extract target slug from title', async ({ es, site, options }) => {

    await addSrc(site, 'file:///pages/main.mdx', `
# Extracting the Page Title
    `, { dst: '/html/' });

    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Dst.url, '/html/extracting-the-page-title.html');
});



test.skip('extract target slug from title with dst', async ({ es, site, options }) => {

    let e = await addSrc(site, 'file:///pages/main.mdx', `
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

    await addSrc(site, 'file:///pages/main.mdx', `
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

test('extracted title does not override frontmatter', async ({ es, site, options }) => {
    await addSrc(site, 'file:///pages/main.mdx', `
---
title: Main
---
# Front Page
    `);

    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Title.title, 'Main');
})


test('extract first paragraph as summary', async ({ es, site, options }) => {
    await addSrc(site, 'file:///pages/main.mdx', `
---
title: How to blog
---

# How to blog

![How To Blog](file:///media/how-to-blog.png)

Writing a blog post can be delightful and painful in equal measures
`);

    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    // assert.equal(e.Title.title, 'How to blog');
    assert.equal(e.Title.summary, 'Writing a blog post can be delightful and painful in equal measures');

});


test.run();

