import { suite } from 'uvu';
import assert from 'uvu/assert';

import { parse } from '../../../src/builder/config';

import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const log = (...args) => console.log('[TestProcMDXTags]', ...args);



const test = suite('processor/mdx/tags');
test.before.each(beforeEach);




test('tags in mdx', async ({ es, site, options }) => {
    let e = await addMdx(site, 'file:///pages/main.mdx', `
---
tags:
- weeknotes
- blog
- Good Stuff
---
## Things that happened
    `);
    e.Meta = { meta: { tags: ['active'] } };
    await site.update(e);

    e = await addMdx(site, 'file:///pages/about.mdx', `## About Me`, { tags: 'blog' });

    await process(site, options);

    // convert /meta tags into dependencies
    // await applyTags(site);

    // await printES( es );

    let eids = await site.findByTags(['weeknotes', 'blog']);

    assert.equal(eids, [1002]);
});


test('tags inherited from dir', async ({ es, site, options }) => {
    await parse(site, `
    id: 1998
    src: /pages/
    tags:
        - blog
        - odgn
    `);

    await parse(site, `
    id: 1999
    src: /pages/2021/
    tags:
        - 2021
    `);

    await addMdx(site, 'file:///pages/2021/main.mdx', `
---
tags:
- things
---
# Things that happened
    `);

    await process(site, options);

    // await printAll(es);

    assert.equal(
        await site.findByTags(['things']),
        [1008]);
    assert.equal(
        await site.findByTags(['blog', 'odgn']),
        [1008, 1998, 1999]);
    assert.equal(
        await site.findByTags(['2021', 'blog']),
        [1008, 1999]);
    assert.equal(
        await site.findByTags(['2021', 'things']),
        [1008]);
});





test.run();

