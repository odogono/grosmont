import { Callback, suite } from 'uvu';
import Path from 'path';
import Fs from 'fs-extra';
import assert from 'uvu/assert';

import { Site } from '../../src/builder/site';
import {
    process as scanSrc,
    cloneEntitySet,
    diffEntitySets,
    applyEntitySetDiffs,
    applyUpdatesToDependencies,
} from '../../src/builder/processor/file';
import { process as buildDeps } from '../../src/builder/processor/build_deps';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { parse as parseMeta } from '../../src/builder/processor/meta';
import { getDstUrl } from '../../src/builder/processor/dst_url';
import { process as slugifyTitle } from '../../src/builder/processor/slugify_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';

import { Entity } from 'odgn-entity/src/entity';
import { getDependencyParents, getDependencyChildren, printAll, printEntity } from '../../src/builder/util';
import { EntitySet, EntitySetMem } from 'odgn-entity/src/entity_set';
import { exportEntitySet } from 'odgn-entity/src/util/export/insts';
import { isDate } from '../../src/util/is';
import Day from 'dayjs';
import { setEntityId } from 'odgn-entity/src/component';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';

const log = (...args) => console.log('[TestFile]', ...args);

const printES = (es) => {
    console.log('\n\n---\n');
    printAll(es);
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');

let id = 1000;
const idgen = () => ++id;

interface TestProps {
    es: EntitySet;
    site: Site;
    e: Entity;
}

test.before.each(async (tcx) => {


    // const target = `file://${rootPath}/dist/`;
    // tcx.site = new Site({ idgen, name: 'test', target });
    // await tcx.site.init();
    // // tcx.siteEntity = tcx.site.getSite();
    // tcx.es = tcx.site.es;

    const configPath = `file://${rootPath}/test/fixtures/rootB/site.yaml`;

    // log( configPath );

    const site = await Site.create({ idgen, configPath, rootPath });

    tcx.site = site;
    tcx.es = site.es;
    tcx.e = site.getSite();
});

async function loadRootB(site: Site) {
    id = 1100;
    const insts = Fs.readFileSync(Path.join(rootPath, '/test/fixtures/root.b.insts'), 'utf-8');
    const stmt = site.es.prepare(insts)
    await stmt.run();

    await buildDeps(site);
}



test.only('reading a site entity', async ({ es, site }) => {
    id = 1100;
    const insts = Fs.readFileSync(Path.join(rootPath, '/test/fixtures/root.b.insts'), 'utf-8');
    const stmt = es.prepare(insts)
    await stmt.run();

    // let com = (es as EntitySet).createComponent('/component/upd', {op:ChangeSetOp.Update});
    // com = setEntityId(com, 1003);
    // await es.add(com);

    let com = es.createComponent('/component/meta', { meta: { tags: ['weeknotes'] } });
    com = setEntityId(com, 1014);
    await es.add(com);

    await buildDeps(site);

    await applyUpdatesToDependencies(site);

    await mdxResolveMeta(site, { e: 1005 });

    const eid = await getDependencyParents(site.es, 1015, 'dir');

    log('parents', eid);

    printES(es);
});

test('reading a site entity', async ({ es, site }) => {
    log('idgen', id);
    await scanSrc(site);

    const bf = es.resolveComponentDefIds(['/component/upd', '/component/dep']);
    const exportOptions = {
        path: '', exportDefs: false, retainEid: true, exclude: bf,
        pk: [["/component/site", "e:///component/src#/url"]]
    }
    let insts = await exportEntitySet(es, exportOptions);
    // printES(es);
    log(insts);
});


test('depencies are also marked as updated', async ({ es, site }) => {
    let mem = es.clone({ cloneEntities: false });// new EntitySetMem( undefined, {idgen} );
    let ents = [
        createFileEntity(es, 'file:///pages/'),
        createFileEntity(es, 'file:///pages/readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx')
    ];
    await mem.add(ents);

    // log('> RUN 1')
    await scanSrc(site, { readFSResult: mem });


    mem = es.clone({ cloneEntities: false });
    const { ctime, mtime } = ents[0].Times;
    ents[0].Times = { ctime, mtime: Day(mtime).add(2, 'hour').toISOString() };

    await mem.add(ents);

    await scanSrc(site, { readFSResult: mem, debug: true });

    // await mdxResolveMeta(site);

    printES(es);

    // log( es.getRemovedEntities() );
    // log( es.comChanges );
});

// test('flags a file which has updated', async({es, site}) => {
//     // existing es of files
//     // perform a new scan into a new es
//     // compare files between the two

//     // add new files, flag as added
//     // flag updated files
//     // remove missing files, flag their deps as missing

//     // handle new file added
//     //   flag as an update
//     // handle file updated
//     //   flag as an update
//     // handle file deleted

//     // if a dep no longer has either src or dir
//     // then it should be flagged

//     let ents = [
//         createFileEntity(es, 'file:///readme.md'),
//         createFileEntity(es, 'file:///pages/index.mdx')
//     ];
//     await site.es.add( ents );

//     let esnx = await cloneEntitySet( site.es );

//     const {ctime, mtime} = ents[1].Times;
//     ents[1].Times = { ctime, mtime:Day(mtime).add(2,'hour').toISOString() };

//     await esnx.add(ents);

//     let diffs = await diffEntitySets( es, esnx );

//     printES(es);
//     log('-----');
//     printES(esnx);
//     log('=====');

//     log( diffs );

//     await applyEntitySetDiffs( es, esnx, diffs );

//     log('result');
//     printES(es);
// });


test('apply added entities', async ({ es, site }) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
    ];
    await site.es.add(ents);

    let esnx = await cloneEntitySet(site.es);

    ents = [
        ...ents,
        createFileEntity(es, 'file:///pages/index.mdx')
    ];

    await esnx.add(ents);

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printES(es);

    let e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal(e.Diff.op, ChangeSetOp.Add);
});

test('apply updated entities', async ({ es, site }) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx')
    ];
    await site.es.add(ents);

    let esnx = await cloneEntitySet(site.es);

    const { ctime, mtime } = ents[1].Times;
    ents[1].Times = { ctime, mtime: Day(mtime).add(2, 'hour').toISOString() };

    await esnx.add(ents);

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printES(es);

    let e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal(e.Diff.op, ChangeSetOp.Update);
});

async function getEntityBySrcUrl(es: EntitySet, url: string) {
    let stmt = es.prepare(`[
        /component/src#/url !ca $url ==
        @e
    ] select`);
    return await stmt.getEntity({ url });
}

test('apply updated component entities', async ({ es, site }) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx')
    ];
    await site.es.add(ents);

    let esnx = await cloneEntitySet(site.es);
    await esnx.add(ents);


    // add a title component to index.mdx
    let e = await getEntityBySrcUrl(esnx, 'file:///pages/index.mdx');
    e.Title = { title: 'Updated!' };
    // log('update', e.id)
    await esnx.add(e);

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal(e.Diff.op, ChangeSetOp.Update);
});



test('apply removed entities', async ({ es, site }) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx')
    ];
    await site.es.add(ents);

    let e = await getEntityBySrcUrl(es, 'file:///readme.md');

    let esnx = await cloneEntitySet(site.es);

    ents = [
        ents[1]
    ];

    await esnx.add(ents);

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printES(es);

    // log( es.getRemovedEntities() );

    assert.equal(es.getRemovedEntities(), [e.id]);

});



test.run();






function createFileEntity(es: EntitySet, url: string,
    ctime?: Date | string, mtime?: Date | string) {
    let e = es.createEntity();
    e.Src = { url };
    ctime = ctime ?? new Date();
    mtime = mtime ?? ctime;

    if (isDate(ctime)) {
        ctime = (ctime as Date).toISOString();
    }
    if (isDate(mtime)) {
        mtime = (mtime as Date).toISOString();
    }

    e.Times = { ctime, mtime };
    return e;
}