import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';

import {
    process as scanSrc,
    cloneEntitySet,
    diffEntitySets,
    applyEntitySetDiffs,
} from '../../../src/builder/processor/file';
import { clearUpdates } from '../../../src/builder/query';

import { addDep, addDirDep, createFileEntity, beforeEach, printAll } from '../../helpers';

const test = suite('/processor/file/deps/remove');
test.before.each(beforeEach);
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test('removed', async ({ es, site, options }) => {
    // id = 1000;
    let mem = await es.clone({ cloneEntities: false });
    
    let ents = [
        createFileEntity(site, 'file:///pages/'),
        createFileEntity(site, 'file:///pages/readme.md'),
        createFileEntity(site, 'file:///pages/index.mdx')
    ];
    
    await mem.add(ents);

    await scanSrc(site, { readFSResult: mem });


    await clearUpdates(site, options);

    ents = [ ents[0], ents[2] ];

    // log( ents );

    mem = await es.clone({ cloneEntities: false });
    await mem.add(ents);

    await scanSrc(site, { readFSResult: mem });

    let e = await es.getEntity(1006);
    assert.equal( e.Upd.op, 4 );

});

test.run();