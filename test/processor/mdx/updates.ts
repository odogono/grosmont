import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const log = (...args) => console.log('[TestProcMDX]', ...args);


const test = suite('processor/mdx/updates');



test.before.each(beforeEach);



test('mark will only consider updated', async ({ es, site, options }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/upd:
        op: 2
    `);

    await process(site, {...options, onlyUpdated:true});

    // await printAll( site.es );

    let e = await site.es.getEntity(2000);
    assert.equal(e.Mdx, undefined);
});

test('preprocess will only consider updated', async ({ es, site, options }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/mdx:
        data: "# Beta"
    /component/upd:
        op: 2
    `);

    await process(site, {...options, onlyUpdated:true});


    let e = await site.es.getEntity(2000);
    assert.equal(e.Title, undefined);
});

test('render will only consider updated', async ({ es, site, options }) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parse(site, `
    id: 2001
    src: beta.mdx
    /component/mdx:
        data: "# Beta"
    /component/upd:
        op: 1
    `);

    await process(site, {...options, onlyUpdated:true});
    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Output, undefined);
});




test.run();

