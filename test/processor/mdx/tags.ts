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

    await mdxPreprocess(site, options);

    // convert /meta tags into dependencies
    // await applyTags(site);

    // await printES( es );

    let eids = await site.findByTags(['weeknotes', 'blog']);

    assert.equal(eids, [1002]);
});


test.only('tags inherited from dir', async ({ es, site, options }) => {
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

    await buildDeps(site, options);

    await mdxPreprocess(site, options);

    await applyTags(site, options);

    await printAll(es);

    assert.equal(
        await site.findByTags(['blog', 'odgn']),
        [1008, 1998, 1999]);
    assert.equal(
        await site.findByTags(['things']),
        [1008]);
    assert.equal(
        await site.findByTags(['2021', 'blog']),
        [1008, 1999]);
    assert.equal(
        await site.findByTags(['2021', 'things']),
        [1008]);
    // let eids = await site.findByTags(['2021', 'blog'] );
    // log( eids );
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
