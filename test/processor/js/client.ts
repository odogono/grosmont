import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { Site } from '../../../src/builder/site';

import { printAll } from 'odgn-entity/src/util/print';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { FindEntityOptions } from '../../../src/builder/query';
import { EntityId } from 'odgn-entity/src/entity';

import { Level } from '../../../src/builder/reporter';

import { addMdx, beforeEach, createSite, process, rootPath } from '../helpers';

const test = suite('processor/js/client');
const log = (...args) => console.log(`[${suite.name}]`, ...args);
test.before.each(beforeEach);




test('use', async ({ es, site, options }) => {

    // await addMdx(site, 'file:///components/client.jsx', `
    // `);

    await addMdx(site, 'file:///pages/main.mdx', `
import 'https://unpkg.com/react@17/umd/react.development.js';

    <ScriptLinks />
    
    # Client Test

    <ClientCode element="root">
        <h1>Hello, world! <span>nice</span></h1>
    </ClientCode>
    
    `);

    await process(site, options);

    console.log('\n\n');
    await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    // assert.equal(e.Output.data,
    //     `<div>Count is 5</div>`);


    // assert.ok(true);
});




test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    tcx.site = await Site.create({ idgen, name: 'test', es, dst, level: Level.ERROR });
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = {
        reporter: tcx.site.reporter,
        siteRef: tcx.site.getRef() as EntityId
    } as FindEntityOptions;
});




test.run();
