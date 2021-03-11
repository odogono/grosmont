import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { beforeEach, process } from './helpers';

const test = suite('/processor/mdx/updates');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);



test.before.each(beforeEach);



test('mark will only consider updated', async ({ es, site, options }) => {
    await parseEntity(site, `
    id: 2000
    src: alpha.mdx
    `);
    await parseEntity(site, `
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
    await parseEntity(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parseEntity(site, `
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
    await parseEntity(site, `
    id: 2000
    src: alpha.mdx
    /component/mdx:
        data: "# Alpha"
    `);
    await parseEntity(site, `
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

