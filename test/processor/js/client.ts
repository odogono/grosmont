import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../../src/builder/site';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalJsx } from '../../../src/builder/processor/jsx/eval_jsx';

import { process as evalMdx } from '../../../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../../../src/builder/processor/mdx/eval_js';
import { process as renderJs } from '../../../src/builder/processor/mdx/render_js';

import { printAll } from 'odgn-entity/src/util/print';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../../src/builder/types';
import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';
import { EntityId } from 'odgn-entity/src/entity';
import { build } from '../../../src/builder';
import { Level } from '../../../src/builder/reporter';

const log = (...args) => console.log('[TestProcUseSE]', ...args);

const rootPath = Path.resolve(__dirname, "../../../");
const test = suite('processor/js/client');




test('use', async ({ es, site, options }) => {

    // await addMdx(site, 'file:///components/client.jsx', `
    // `);

    await addMdx(site, 'file:///pages/main.mdx', `
    # Client Test


    <ClientCode element="root">
        import { stuff } from 'src';
        <h1>Hello, world! <span>nice</span></h1>
    </ClientCode>
    
    `);

    await process(site,options);
    

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

    tcx.site = await Site.create({ idgen, name: 'test', es, dst, level:Level.ERROR });
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { 
        reporter:tcx.site.reporter, 
        siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});




test.run();


async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}

async function process(site: Site, options: ProcessOptions) {
    await mark(site, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await mark(site, { exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })
    
    await buildSrcIndex(site);
    
    await renderScss(site, options);

    await evalJsx(site, options);

    await evalMdx(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);

    // renders the js to /component/output
    await renderJs(site, options);
}