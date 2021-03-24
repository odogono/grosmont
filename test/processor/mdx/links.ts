import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';

import { addMdx, addSrc, beforeEach, process } from '../../helpers';

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


test('links within html', async ({ es, site, options }) => {

    await addSrc(site, 'file:///about.mdx', `
---
dst: /about.html
---
    # About
    `);

    await addSrc(site, 'file:///index.mdx', `
---
dst: /index
---

    # Main

    <a href="./about">About</a>

    Something <a href="/index">else</a> here

    [Otherwise](/index)
    `);

    await process(site, {...options, beautify:true} );

    let e = await site.getEntityBySrc('file:///index.mdx');
    // log( e.Output.data );

    assert.equal(e.Output.data, 
`<h1>Main</h1><a href="/about.html">About</a>
<p>Something <a>else</a> here</p>
<p><a>Otherwise</a></p>`);
//     assert.equal(e.Output.data,
// `<h1>Main</h1><a href="/about.html">
//     <p>About</p>
// </a>
// <p>Something <a>else</a> here</p>
// <p><a>Otherwise</a></p>`);

})




test.run();

