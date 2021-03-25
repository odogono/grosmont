import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as mark, scss as markScss } from '../../src/builder/processor/mark';
import { process as buildDstIndex } from '../../src/builder/processor/build_dst_index';


import { parseEntity } from '../../src/builder/config';

import { EntityId } from 'odgn-entity/src/entity';
import { FindEntityOptions } from '../../src/builder/query';
import { addSrc, beforeEach, process, printAll } from '../helpers';
import { Level } from '../../src/builder/reporter';


const rootPath = Path.resolve(__dirname, "../../");
const test = suite('/processor/scss');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);

test.before.each(beforeEach);

test('mark will only consider updated', async ({ es, site, options }) => {
    await parseEntity(site, `
    id: 2000
    src: alpha.scss
    `);
    await parseEntity(site, `
    id: 2001
    src: beta.scss
    /component/upd:
        op: 2
    `);

    await mark(site, { ...options, onlyUpdated: true, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    // await printES( site.es );


    let e = await site.es.getEntity(2000);
    assert.equal(e.Scss, undefined);
});

test('render will only consider updated', async ({ es, site, options }) => {
    await parseEntity(site, `
    id: 2000
    src: alpha.scss
    /component/data:
        data: "$primary-color: #333; body { color: $primary-color; }"
    `);
    await parseEntity(site, `
    id: 2001
    src: beta.scss
    /component/data:
        data: "$primary-color: #FFF; body { color: $primary-color; }"
    /component/upd:
        op: 1
    `);

    await mark(site, { ...options, onlyUpdated: true, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })
    await renderScss(site, { ...options, onlyUpdated: true });

    // await printAll( es );

    let e = await site.es.getEntity(2000);
    assert.equal(e.Output, undefined);
});

test('process directly from file', async () => {
    let id = 1000;
    const idgen = () => ++id;

    const configPath = `file://${rootPath}/test/fixtures/rootD.yaml`;
    const site = await Site.create({ idgen, configPath, level: Level.FATAL });
    let options: FindEntityOptions = { siteRef: site.getRef() as EntityId };

    await parseEntity(site, `
    src: file:///styles/main.scss
    dst: /main.css
    `);

    await mark(site, { ...options, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    await renderScss(site, options);

    await buildDstIndex(site, options);

    // await printES(site);

    let e = await site.getEntityByDst('/main.css');
    assert.is.not(e.Output, undefined);

});



test('@import rule', async ({ es, site, options }) => {

    await addSrc(site, 'file:///code.scss', `code { line-height: 0; }`);
    await addSrc(site, 'file:///lists.scss', `ul { text-align: left }`);
    await addSrc(site, 'file:///style.scss',
        `@import url('file:///code.scss'); @import './lists';`,
        { dst: '/style.css' });

    await process(site);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///style.scss');

    assert.equal(e.Output.data, `code{line-height:0}ul{text-align:left}`);

});

test.run();

