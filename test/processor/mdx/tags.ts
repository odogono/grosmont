import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../../src/builder/site';

import { process as buildDirDeps } from '../../../src/builder/processor/build_deps';
import { process as renderScss } from '../../../src/builder/processor/scss';
import { process as mark } from '../../../src/builder/processor/mark';
import { process as evalMdx } from '../../../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../../../src/builder/processor/mdx/eval_js';
import { process as evalJsx } from '../../../src/builder/processor/jsx/eval_jsx';
import { process as renderJs } from '../../../src/builder/processor/mdx/render_js';
import { process as applyTags } from '../../../src/builder/processor/mdx/apply_tags';
import { buildSrcIndex, FindEntityOptions } from '../../../src/builder/query';
import { ProcessOptions } from '../../../src/builder/types';
import { parse } from '../../../src/builder/config';

import { printAll } from 'odgn-entity/src/util/print';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { EntityId } from 'odgn-entity/src/entity';


const log = (...args) => console.log('[TestProcMDXTags]', ...args);

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




test('tags in mdx', async ({ es, site, options }) => {
    let e = await addMdx(site, 'file:///pages/main.mdx', `
---
tags:
- weeknotes
- blog
- Good Stuff
---
## Things that happened
    `);
    e.Meta = { meta: { tags: ['active'] } };
    await site.update(e);

    e = await addMdx(site, 'file:///pages/about.mdx', `## About Me`, { tags: 'blog' });

    await process(site, options);

    // convert /meta tags into dependencies
    // await applyTags(site);

    // await printES( es );

    let eids = await site.findByTags(['weeknotes', 'blog']);

    assert.equal(eids, [1002]);
});


test('tags inherited from dir', async ({ es, site, options }) => {
    await parse(site, `
    id: 1998
    src: /pages/
    tags:
        - blog
        - odgn
    `);

    await parse(site, `
    id: 1999
    src: /pages/2021/
    tags:
        - 2021
    `);

    await addMdx(site, 'file:///pages/2021/main.mdx', `
---
tags:
- things
---
# Things that happened
    `);

    await process(site, options);

    // await printAll(es);

    assert.equal(
        await site.findByTags(['things']),
        [1008]);
    assert.equal(
        await site.findByTags(['blog', 'odgn']),
        [1008, 1998, 1999]);
    assert.equal(
        await site.findByTags(['2021', 'blog']),
        [1008, 1999]);
    assert.equal(
        await site.findByTags(['2021', 'things']),
        [1008]);
});





test.run();





async function process(site: Site, options: ProcessOptions) {
    await mark(site, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    await mark(site, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' });
    await mark(site, { exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    await buildDirDeps(site, options);

    await buildSrcIndex(site);

    await renderScss(site, options);

    await evalJsx(site, options);

    await evalMdx(site, options);

    await applyTags(site, options);

    // evaluates the js, and returns metadata
    await evalJs(site, options);

    // renders the js to /component/output
    await renderJs(site, options);
}

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
