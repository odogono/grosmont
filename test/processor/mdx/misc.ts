import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const log = (...args) => console.log('[TestProcMDX]', ...args);


const test = suite('processor/mdx/misc');



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

    await parse(site, `
    src: file:///weeknotes/2021-01-10.mdx
    dst: weeknotes.html
    `);

    await process(site, options);

    // await printES(site);

    let e = await site.getEntityByDst('/weeknotes.html');
    assert.is.not(e.Output, undefined);

});



test.run();

