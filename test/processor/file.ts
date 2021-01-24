import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import {
    process as resolveFileDeps,
} from '../../src/builder/processor/file_deps';
import { processNew as scanSrc, cloneEntitySet, diffEntitySets, applyEntitySetDiffs } from '../../src/builder/processor/file';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { parse as parseMeta } from '../../src/builder/processor/meta';
import { getDstUrl } from '../../src/builder/processor/dst_url';
import { process as slugifyTitle } from '../../src/builder/processor/slugify_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';


import { process as resolveTargetPath, selectTargetPath } from '../../src/builder/processor/target_path';
import assert from 'uvu/assert';
import { Entity } from 'odgn-entity/src/entity';
import { printAll, printEntity } from '../../src/builder/util';
import { transformCSS } from '../../src/builder/css';
import { createSecureContext } from 'tls';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { isDate } from '../../src/util/is';
import Day from 'dayjs';
import { setEntityId } from 'odgn-entity/src/component';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';

const log = (...args) => console.log('[TestFile]', ...args);

const printES = (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    // const target = `file://${rootPath}/dist/`;
    // tcx.site = new Site({ idgen, name: 'test', target });
    // await tcx.site.init();
    // // tcx.siteEntity = tcx.site.getSite();
    // tcx.es = tcx.site.es;

    const configPath = `file://${rootPath}/test/fixtures/rootB/site.yaml`;
    
    // log( configPath );

    const site = await Site.create( {idgen, configPath, rootPath} );

    tcx.site = site;
    tcx.es = site.es;
    tcx.e = site.getSite();
});



test('reading a site entity', async ({es,site}) => {
    
    // log( site.getSrcUrl() );

    // printEntity(es, site.getSite());

    await scanSrc(site);
    
    // printES(es);
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


test('apply added entities', async({es, site}) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
    ];
    await site.es.add( ents );

    let esnx = await cloneEntitySet( site.es );

    ents = [ 
        ...ents,
        createFileEntity(es, 'file:///pages/index.mdx') 
    ];

    await esnx.add( ents );

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets( es, esnx );
    await applyEntitySetDiffs( es, esnx, diffs );

    // printES(es);

    let e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal( e.Diff.op, ChangeSetOp.Add );
});

test('apply updated entities', async({es, site}) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx') 
    ];
    await site.es.add( ents );

    let esnx = await cloneEntitySet( site.es );

    const {ctime, mtime} = ents[1].Times;
    ents[1].Times = { ctime, mtime:Day(mtime).add(2,'hour').toISOString() };

    await esnx.add( ents );

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets( es, esnx );
    await applyEntitySetDiffs( es, esnx, diffs );

    // printES(es);

    let e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal( e.Diff.op, ChangeSetOp.Update );
});

async function getEntityBySrcUrl(es:EntitySet, url:string){
    let stmt = es.prepare(`[
        /component/src#/url !ca $url ==
        @e
    ] select`);
    return await stmt.getEntity({url});
}

test('apply updated component entities', async({es, site}) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx') 
    ];
    await site.es.add( ents );

    let esnx = await cloneEntitySet( site.es );
    await esnx.add( ents );


    // add a title component to index.mdx
    let e = await getEntityBySrcUrl(esnx, 'file:///pages/index.mdx');
    e.Title = {title:'Updated!'};
    // log('update', e.id)
    await esnx.add( e );

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets( es, esnx );
    await applyEntitySetDiffs( es, esnx, diffs );

    e = await getEntityBySrcUrl(es, 'file:///pages/index.mdx');
    assert.equal( e.Diff.op, ChangeSetOp.Update );
});



test('apply removed entities', async({es, site}) => {
    let ents = [
        createFileEntity(es, 'file:///readme.md'),
        createFileEntity(es, 'file:///pages/index.mdx') 
    ];
    await site.es.add( ents );

    let e = await getEntityBySrcUrl(es, 'file:///readme.md');

    let esnx = await cloneEntitySet( site.es );

    ents = [
        ents[1]
    ];

    await esnx.add( ents );

    // printES(es);
    // log('-----');
    // printES(esnx);
    // log('=====');

    let diffs = await diffEntitySets( es, esnx );
    await applyEntitySetDiffs( es, esnx, diffs );

    // printES(es);

    // log( es.getRemovedEntities() );

    assert.equal( es.getRemovedEntities(), [ e.id ] );
    
});



test('no dst without a target', async ({ es, site }) => {

    let e = await parseMeta( site, `
    /component/src:
        url: file:///pages/main.mdx
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, undefined );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('filename dst', async ({ es, site }) => {

    let e = await parseMeta( site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/dst:
        url: main.txt
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, "/main.txt" );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('parent dst', async ({ es, site }) => {

    await parseMeta( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parseMeta( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parseMeta( site, `
    id: 1999
    /component/dst:
        url: /root/output.htm
    `);

    await parseMeta( site, `
    id: 2000
    /component/dst:
        url: pages/
    `);

    let e = await parseMeta( site, `
    id: 2001
    /component/src:
        url: file:///pages/main.mdx
    /component/dst:
        url: main.txt
    `);

    
    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    // console.log('\n\n---\n');
    // printAll( es );

    assert.equal( path, "/root/pages/main.txt" );

});

test('parent has filename', async ({ es, site }) => {

    await parseMeta( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parseMeta( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parseMeta( site, `
    id: 1999
    /component/dst:
        url: pages/output.txt
    `);

    await parseMeta( site, `
    id: 2000
    `);

    let e = await parseMeta( site, `
    id: 2001
    /component/src:
        url: file:///pages/main.mdx
    `);

    // console.log('\n\n---\n');
    // printAll( es );
    
    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );


    assert.equal( path, "/pages/output.txt" );

});


test.run();






function createFileEntity( es:EntitySet, url:string,
    ctime?:Date|string, mtime?:Date|string ){
let e = es.createEntity();
e.Src = {url};
ctime = ctime ?? new Date();
mtime = mtime ?? ctime;

if( isDate(ctime) ){
    ctime = (ctime as Date).toISOString();
}
if( isDate(mtime) ){
    mtime = (mtime as Date).toISOString();
}

e.Times = { ctime, mtime };
return e;
}