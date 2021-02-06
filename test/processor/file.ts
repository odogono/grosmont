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
} from '../../src/builder/processor/file';
import { process as buildDeps } from '../../src/builder/processor/build_deps';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';
import { process as markMdx } from '../../src/builder/processor/mdx/mark';
import { process as markScss } from '../../src/builder/processor/scss/mark';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';

import { Entity } from 'odgn-entity/src/entity';
import { EntitySet, EntitySetMem } from 'odgn-entity/src/entity_set';
import { exportEntitySet } from 'odgn-entity/src/util/export/insts';
import Day from 'dayjs';
import { setEntityId } from 'odgn-entity/src/component';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { sqlClear } from 'odgn-entity/src/entity_set_sql/sqlite';
import { printAll } from 'odgn-entity/src/util/print';
import { 
    clearUpdates,
    applyUpdatesToDependencies 
} from '../../src/builder/query';
import { isDate } from 'odgn-entity/src/util/is';

const log = (...args) => console.log('[TestFile]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    await printAll(es);
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
    id = 1000;
    const configPath = `file://${rootPath}/test/fixtures/rootB/site.yaml`;
    const site = await Site.create({ idgen, configPath });

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


test.only('using sql es', async () => {
    id = 1000;
    const configPath = `file://${rootPath}/test/fixtures/rootC.yaml`;
    const liveDB = { path: `${rootPath}/test/fixtures/rootC.sqlite`, isMemory: false };
    const testDB = { uuid: 'TEST-1', isMemory: true };

    // sqlClear( liveDB.path );
    // const es = new EntitySetSQL({...testDB});
    const es = new EntitySetMem(undefined, {idgen});
    const site = await Site.create({es, idgen, configPath});

    await scanSrc(site); // dont use updates - in fact skip when only updating
    await markMdx(site, {loadData:true}); // use updates ✓
    await markScss(site, { loadData: true }); // use updates ✓
    await renderScss(site); // use updates ✓
    await mdxPreprocess( site ); // use updates ✓
    await mdxResolveMeta( site ); // use updates ✓
    await mdxRender( site ); // use updates ✓

    await buildDstIndex(site); // remove with update = remove

    await clearUpdates(site);

    let eid = await site.getEntityIdByDst('/blah');
    await site.markUpdate( eid, ChangeSetOp.Update );
    
    await applyUpdatesToDependencies(site);

    await printES( es );

    log('>---');
    const eids = await site.getUpdatedEntityIds();
    log('updated', eid, eids);

    // a file is updated
    // scanSrc is run
    // entities which are marked are rendered
    // a note is made of which e were updated


    // returns an array of entity ids which have parents but no children
    // ignore orphans. obey update rules
    // const eids = await site.getDependencyLeafEntityIds( 'dir' );
});


test('reading a site entity', async ({ es, site }) => {
    await loadRootB(site);

    let com = (es as EntitySet).createComponent('/component/upd', {op:ChangeSetOp.Update});
    com = setEntityId(com, 1011);
    await es.add(com);

    // let com = es.createComponent('/component/meta', { meta: { tags: ['weeknotes'] } });
    // com = setEntityId(com, 1014);
    // await es.add(com);

    await buildDeps(site);

    await markMdx(site, {loadData:true});
    // await applyUpdatesToDependencies(site);

    // await mdxResolveMeta(site, { e: 1014 });

    // printES(es);
});

// test('reading a site entity', async ({ es, site }) => {
//     log('idgen', id);
//     await scanSrc(site);

//     const bf = es.resolveComponentDefIds(['/component/upd', '/component/dep']);
//     const exportOptions = {
//         path: '', exportDefs: false, retainEid: true, exclude: bf,
//         pk: [["/component/site", "e:///component/src#/url"]]
//     }
//     let insts = await exportEntitySet(es, exportOptions);
//     // printES(es);
//     log(insts);
// });


test('dependencies are also marked as updated', async ({ es, site }) => {
    // id = 1000;
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

    await scanSrc(site, { readFSResult: mem });

    // await mdxResolveMeta(site);

    // printES(es);
    
    let e = await es.getEntity(1006);
    assert.equal( e.Upd.op, 2 );

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
    assert.equal(e.Upd.op, ChangeSetOp.Add);
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
    assert.equal(e.Upd.op, ChangeSetOp.Update);
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
    assert.equal(e.Upd.op, ChangeSetOp.Update);
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