import { suite } from 'uvu';
import assert from 'uvu/assert';

import Day from 'dayjs';
import { addDep, addDirDep, createFileEntity, beforeEach, addSrc } from '../../helpers';

import {
    process as scanSrc,
    cloneEntitySet,
    diffEntitySets,
    applyEntitySetDiffs,
} from '../../../src/builder/processor/file';
import { ChangeSetOp, Entity, EntityId } from '../../../src/es';
import { applyUpdatesToDependencies } from '../../../src/builder/query';


const test = suite('/processor/file/deps/update');
test.before.each(beforeEach);
const log = (...args) => console.log(`[/test${test.name}]`, ...args);




test('dependencies are also marked as updated', async ({ es, site }) => {
    // id = 1000;
    let mem = await es.clone({ cloneEntities: false });
    
    let ents = [
        createFileEntity(site, 'file:///pages/'),
        createFileEntity(site, 'file:///pages/readme.md'),
        createFileEntity(site, 'file:///pages/index.mdx')
    ];
    
    await mem.add(ents);
    
    
    // log('> RUN 1')
    await scanSrc(site, { readFSResult: mem });
    

    mem = await es.clone({ cloneEntities: false });
    const { btime, mtime } = ents[0].Ftimes;
    ents[0].Ftimes = { btime, mtime: Day(mtime).add(2, 'hour').toISOString() };
    
    // await printAll(es);
    
    // log('> RUN 2');
    await mem.add(ents);

    await scanSrc(site, { readFSResult: mem });

    
    let e = await es.getEntity(1005);
    assert.equal( e.Upd.op, 2 );

});


test('child deps', async ({es, site}) => {
    let index = await addSrc( site, 'file:///index.mdx', '', {upd: ChangeSetOp.Update} );
    let about = await addSrc( site, 'file:///about.mdx', '', );
    let projects = await addSrc( site, 'file:///projects.mdx', '', );

    await addDep( site, about.id, index.id, 'link' );
    await addDep( site, projects.id, about.id, 'link' );

    await applyUpdatesToDependencies( site );

    // await printAll( es );

    let e = await site.getEntityBySrc('file:///about.mdx');
    assert.equal( e.Upd.op, ChangeSetOp.Update );
    e = await site.getEntityBySrc('file:///projects.mdx');
    assert.equal( e.Upd.op, ChangeSetOp.Update );
});


test('cyclical deps', async ({es, site}) => {

    let index = await addSrc( site, 'file:///index.mdx', '', {dst:'/index.html', upd: ChangeSetOp.Update} );
    let menu = await addSrc( site, 'file:///components/menu.mdx', '', );
    let about = await addSrc( site, 'file:///about.mdx', '', );

    await addDep( site, menu.id, index.id, 'import');
    await addDep( site, index.id, menu.id, 'import');
    await addDep( site, about.id, menu.id, 'import');
    
    await applyUpdatesToDependencies( site );

    // await printAll( es );
    
    let e = await site.getEntityBySrc('file:///components/menu.mdx');
    assert.equal( e.Upd.op, ChangeSetOp.Update );
    e = await site.getEntityBySrc('file:///about.mdx');
    assert.equal( e.Upd.op, ChangeSetOp.Update );
});


test('ignore certain deps', async ({es,site}) => {
    let index = await addSrc( site, 'file:///index.mdx', '', {upd: ChangeSetOp.Add} );
    let about = await addSrc( site, 'file:///about.mdx', '', );
    let projects = await addSrc( site, 'file:///projects.mdx', '', );

    await addDep( site, about.id, index.id, 'link' );
    await addDep( site, projects.id, index.id, 'import' );
    
    // await printAll( es, undefined, [ '/component/src', '/component/dep', '/component/upd' ] );

    await applyUpdatesToDependencies( site, {exclude:['link']} );


    let e = await site.getEntityBySrc('file:///about.mdx');
    assert.equal( e.Upd, undefined );
    e = await site.getEntityBySrc('file:///projects.mdx');
    assert.equal( e.Upd.op, ChangeSetOp.Add );
});


test.run();


// async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
//     await parseEntity( site, `
//     /component/dep:
//         src: ${src}
//         dst: ${dst}
//         type: dir
//     `);
// }