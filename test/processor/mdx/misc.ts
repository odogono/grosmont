import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parseEntity } from '../../../src/builder/config';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, addSrc, beforeEach, createSite, process, rootPath } from './helpers';
import { printAll } from 'odgn-entity/src/util/print';

const test = suite('/processor/mdx/misc');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each(beforeEach);


test('target path for file', async ({ es, site, options }) => {


    await addMdx(site, 'file:///pages/main.mdx', `
    # Here's a Heading
    
    I really like using Markdown.
    `)

    await process(site, options);


    // await printAll(es);
    

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>Here&#x27;s a Heading</h1><p>I really like using Markdown.</p>`);
});




test('process directly from file', async () => {
    const configPath = `file://${rootPath}/test/fixtures/rootD.yaml`;
    const site = await createSite({configPath});
    const options = { siteRef: site.getRef() as EntityId } as FindEntityOptions;

    await parseEntity(site, `
    src: file:///weeknotes/2021-01-10.mdx
    dst: weeknotes.html
    `);

    await process(site, options);

    // await printES(site);

    let e = await site.getEntityByDst('/weeknotes.html');
    assert.is.not(e.Output, undefined);

});


test('menu', async ({es, site, options}) => {

//     await addSrc(site, 'file:///pages/projects.mdx', `
// ---
// dst: /projects
// ---
//     # Projects
//     `);
//     await addSrc(site, 'file:///pages/about.mdx', `
// ---
// dst: /about
// ---
//     # About
//     `);
    await addSrc(site, 'file:///pages/home.mdx', `
---
dst: /index.html
---
import Menu from '../components/menu';

    # Home

    <Menu />
    `);

    await addSrc(site, 'file:///components/menu.mdx', `
    <a href="/index.html">Home</a>
    <a href="/projects">Projects</a>
    <a href="/about">About</a>
    `);

    await process( site, {...options, beautify:true} );

    // await printAll( es );

    let e = await site.getEntityByDst('/index.html');

    assert.equal( e.Output.data, `<h1>Home</h1><a href="/index.html">
    <p>Home</p>
</a><a href="/projects">
    <p>Projects</p>
</a><a href="/about">
    <p>About</p>
</a>`)

});



test.run();

