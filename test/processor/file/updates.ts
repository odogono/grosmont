import { suite } from 'uvu';
import assert from 'uvu/assert';

import Day from 'dayjs';
import { addDirDep, createFileEntity, beforeEach } from '../../helpers';

import {
    process as scanSrc,
    cloneEntitySet,
    diffEntitySets,
    applyEntitySetDiffs,
} from '../../../src/builder/processor/file';
import { printAll } from 'odgn-entity/src/util/print';


const test = suite('/processor/file/deps');
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
    
    // log( mem );
    
    await mem.add(ents);
    
    
    // log('> RUN 1')
    await scanSrc(site, { readFSResult: mem });
    

    mem = await es.clone({ cloneEntities: false });
    const { ctime, mtime } = ents[0].Times;
    ents[0].Times = { ctime, mtime: Day(mtime).add(2, 'hour').toISOString() };
    
    // await printAll(es);
    
    // log('> RUN 2');
    await mem.add(ents);

    await scanSrc(site, { readFSResult: mem });

    
    let e = await es.getEntity(1005);
    assert.equal( e.Upd.op, 2 );

});


test.run();