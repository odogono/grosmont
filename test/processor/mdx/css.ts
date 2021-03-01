import { suite } from 'uvu';
import Path from 'path';
import Beautify from 'js-beautify';
import { Site } from '../../../src/builder/site';
import { process as assignMime } from '../../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as renderMdx } from '../../../src/builder/processor/mdx';
import { process as assignTitle } from '../../../src/builder/processor/assign_title';
import { process as mdxPreprocess } from '../../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../../src/builder/processor/mdx/resolve_meta';
import { process as applyTags } from '../../../src/builder/processor/mdx/apply_tags';
import { process as mdxRender } from '../../../src/builder/processor/mdx/render';
import { process as buildDeps } from '../../../src/builder/processor/build_deps';
import { process as buildDstIndex } from '../../../src/builder/processor/dst_index';
import { process as markMdx } from '../../../src/builder/processor/mdx/mark';
import {
    process as processJSX,
    preprocess as preProcessJSX
} from '../../../src/builder/processor/jsx';

import { parse } from '../../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../../../src/builder/types';
import { FindEntityOptions } from '../../../src/builder/query';
import { EntityId } from 'odgn-entity/src/entity';


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

    tcx.site = await Site.create({ idgen, name: 'test', es, dst });
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});


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



    await assignMime(site, options);
    await renderScss(site, options);

    // printES(es);

    await renderMdx(site, options);


    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:#00f}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
});


test('old css dependencies are cleared', async ({ es, site, options }) => {

    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/main.scss';

<InlineCSS />

## Main page
    `);
    await addScss(site, 'file:///styles/main.scss', `h2 { color: blue; }`);

    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    // console.log('\n\n---\n');
    // printAll(es);

    await addScss(site, 'file:///styles/alt.scss', `h2 { color: red; }`);
    await addMdx(site, 'file:///pages/main.mdx', `
import 'file:///styles/alt.scss';

<InlineCSS />

## Main page
    `);

    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Text.data,
        `<style>h2{color:red}</style><h2>Main page</h2>`);

    // console.log('\n\n---\n');
    // printAll(es);
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


    await assignMime(site, options);
    await renderScss(site, options);
    await renderMdx(site, options);

    // console.log('\n\n---\n');
    // printAll(es);

});



test.run();




async function addScss(site: Site, url: string, data: string) {
    let e = await site.addSrc(url);
    e.Scss = { data };
    await site.update(e);
}

async function addMdx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Mdx = { data };
    if (meta !== undefined) {
        e.Meta = { meta };
    }
    return await site.update(e);
}
