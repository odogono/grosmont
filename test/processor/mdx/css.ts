import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../../src/builder/site';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalMdx } from '../../../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../../../src/builder/processor/mdx/eval_js';
import { process as evalJsx } from '../../../src/builder/processor/jsx/eval_jsx';
import { process as renderJs } from '../../../src/builder/processor/mdx/render_js';

import { printAll } from 'odgn-entity/src/util/print';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../../src/builder/types';
import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';
import { EntityId } from 'odgn-entity/src/entity';
import { Level, Reporter } from '../../../src/builder/reporter';


const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = async (site: Site) => {
    console.log('\n\n---\n');
    await printAll(site.es);
}

const rootPath = Path.resolve(__dirname, "../../../");
const test = suite('processor/mdx');


// interface TestContext {
//     site: Site;
//     siteEntity: Entity;
//     es: EntitySet;
// }


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    tcx.site = await Site.create({ idgen, name: 'test', es, dst, level: Level.ERROR });
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});


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



test('inlined css', async ({ es, site, options }) => {

    /*
    build an index of urls to entity ids and mime types
    */


    // note - important that import has no leading space
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);

    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<style>h2{color:#00f}</style><h2>Main page</h2>`);
});


test('old css dependencies are cleared', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await process(site, options);

    
    

    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);


    // log('\n\n 👟 \n\n');

    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<style>h2{color:red}</style><h2>Main page</h2>`);
});



test('inlined css with master page', async ({ es, site, options }) => {

    await addScss(site, 'file:///styles/layout.scss', `body { color: black; }`);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);


    await addMdx(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

import 'file:///styles/layout.scss';

<html lang="en">
    <CSSLinks />
    <body>{children}</body>
</html>` );

    await addMdx(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
---

import 'file:///styles/main.scss';

Hello _world_
    ` );


    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');
    assert.equal(e.Output.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


    // printAll(es);


});



test.run();




async function addScss(site: Site, url: string, data: string) {
    let e = await site.addSrc(url);
    e.Data = { data };
    await site.update(e);
}

async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
