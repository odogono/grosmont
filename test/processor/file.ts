import 'stateful-hooks';
import { suite } from 'uvu';
import Path from 'path';
import Fs from 'fs-extra';
import assert from 'uvu/assert';

import { Site } from '../../src/builder/site';
import { build } from '../../src/builder';
import {
    process as scanSrc,
    cloneEntitySet,
    diffEntitySets,
    applyEntitySetDiffs,
} from '../../src/builder/processor/file';
import { process as buildDeps } from '../../src/builder/processor/build_dir_deps';

import { Entity } from 'odgn-entity/src/entity';
import { EntitySet, EntitySetMem } from 'odgn-entity/src/entity_set';
import { exportEntitySet } from 'odgn-entity/src/util/export/insts';
import Day from 'dayjs';
import { setEntityId } from 'odgn-entity/src/component';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { sqlClear } from 'odgn-entity/src/entity_set_sql/sqlite';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { 
    clearUpdates,
    applyUpdatesToDependencies, 
    getDependencyEntities
} from '../../src/builder/query';
import { isDate } from '@odgn/utils';
import { buildUrl } from '../../src/builder/util';
import { Level, Reporter } from '../../src/builder/reporter';

const log = (...args) => console.log('[TestFile]', ...args);


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
    // id = 1000;
    // const configPath = `file://${rootPath}/test/fixtures/rootB/site.yaml`;
    // const site = await Site.create({ idgen, configPath });

    // tcx.site = site;
    // tcx.es = site.es;
    // tcx.e = site.getSite();
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
    const configPath = `file://${rootPath}/test/fixtures/rootA.yaml`;
    const liveDB = { path: `${rootPath}/test/fixtures/odgn.sqlite`, isMemory: false };
    const testDB = { uuid: 'TEST-1', isMemory: true };

    // sqlClear( liveDB.path );
    // const es = new EntitySetSQL({...testDB});
    // const es = new EntitySetMem(undefined, {idgen});
    const site = await Site.create({configPath, level:Level.DEBUG});

    await build(site);
    // await printAll(site.es, undefined, ['/component/src', '/component/dst', '/component/meta', '/component/times']);
    // await printAll(site.es, undefined, ['/component/title']);

    // select 5 entities tagged with weeknotes ordered by date desc
    const eids = await site.findByTags([ 'weeknotes'] );
    const q = `
    [
        // debug
        $eids
        /component/times#/ctime !ca desc order
        4 0 limit
        [/component/title /component/mdx] !bf
        // prints
        @e
    ] select`;

    log('>>---');
    // let mdxEids = await site.es.prepare(q).getResult({eids});

    // let page = await site.getEntityBySrc('file:///weeknotes/2021-01-01.mdx');
    let page = await site.getEntityBySrc('file:///index.mdx');
    printEntity( site.es, page );

    // let deps = await getDependencyEntities(site.es, page.id);
    // await printAll( site.es, deps);

    // printEntity( site.es, site.getEntity() );

    // await printAll(site.es, null, [
    //     '/component/src', 
    //     '/component/dst', 
    //     '/component/js', 
    //     '/component/title', '/component/meta']);
    
    // mdxEids.forEach( e => { log( e.id, e.Title.title )});
    // mdxEids.forEach( e => printEntity(site.es,e));
    // log('dst index', site.getIndex('/index/dstUrl').index );

});


test('using sql es', async () => {
    id = 1000;
    const configPath = `file://${rootPath}/test/fixtures/rootC.yaml`;
    const liveDB = { path: `${rootPath}/test/fixtures/rootC.sqlite`, isMemory: false };
    const testDB = { uuid: 'TEST-1', isMemory: true };

    // sqlClear( liveDB.path );
    // const es = new EntitySetSQL({...testDB});
    const es = new EntitySetMem(undefined, {idgen});
    const site = await Site.create({es, idgen, configPath});

    await build(site);

    await clearUpdates(site, {siteRef:site.getRef()});

    let eid = await site.getEntityIdByDst('/blah');
    await site.markUpdate( eid, ChangeSetOp.Update );
    
    await applyUpdatesToDependencies(site);

    await printAll( site.es );

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

    // printAll(es);
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
//     // printAll(es);
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

    // printAll(es);
    
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

//     printAll(es);
//     log('-----');
//     printAll(esnx);
//     log('=====');

//     log( diffs );

//     await applyEntitySetDiffs( es, esnx, diffs );

//     log('result');
//     printAll(es);
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

    // printAll(es);
    // log('-----');
    // printAll(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printAll(es);

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

    // printAll(es);
    // log('-----');
    // printAll(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printAll(es);

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

    // printAll(es);
    // log('-----');
    // printAll(esnx);
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

    // printAll(es);
    // log('-----');
    // printAll(esnx);
    // log('=====');

    let diffs = await diffEntitySets(es, esnx);
    await applyEntitySetDiffs(es, esnx, diffs);

    // printAll(es);

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