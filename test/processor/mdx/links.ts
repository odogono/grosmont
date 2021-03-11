import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';

import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const test = suite('/processor/mdx/links');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each(beforeEach);


test('internal page link', async ({ es, site, options }) => {
    // await addMdx( site, 'file:///pages/main.mdx', `# Main Page`);

    let e = await parseEntity(site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/data:
        data: "# Main Page"
    /component/dst:
        url: /pages/main.html
    `);
    await site.update(e);

    await addMdx(site, 'file:///pages/about.mdx', `
---
dst: about.html
---
    # About Page
    [To Main](./main.mdx)
    `);

    await process(site, options);

    
    // await printAll(es);

    // log( site.getIndex('/index/dstUrl') );

    e = await site.getEntityBySrc('file:///pages/about.mdx');

    assert.equal(e.Output.data,
        `<h1>About Page</h1><p><a href="/pages/main.html">To Main</a></p>`);

});


test('external page link', async ({ es, site, options }) => {
    await addMdx(site, 'file:///pages/main.mdx', `
    [News](https://www.bbc.co.uk/news)
    `);

    await process(site, options);

    // printES(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<p><a href="https://www.bbc.co.uk/news">News</a></p>`);

});




test.run();

