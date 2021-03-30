import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { addSrc, beforeEach, process } from '../../helpers';

const test = suite('/processor/mdx/tags');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each(beforeEach);




test('tags in mdx', async ({ es, site, options }) => {
    let e = await addSrc(site, 'file:///pages/main.mdx', `
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

    e = await addSrc(site, 'file:///pages/about.mdx', `## About Me`, { tags: 'blog' });

    await process(site, options);

    // convert /meta tags into dependencies
    // await applyTags(site);

    // await printES( es );

    let eids = await site.findByTags(['weeknotes', 'blog']);

    assert.equal(eids, [1002]);
});


test('tags inherited from dir', async ({ es, site, options }) => {
    await parseEntity(site, `
    id: 1998
    src: /pages/
    tags:
        - blog
        - odgn
    `);

    await parseEntity(site, `
    id: 1999
    src: /pages/2021/
    tags:
        - 2021
    `);

    await addSrc(site, 'file:///pages/2021/main.mdx', `
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

