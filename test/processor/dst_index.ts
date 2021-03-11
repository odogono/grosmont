import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parseEntity } from '../../src/builder/config';

import assert from 'uvu/assert';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as buildDstIndex } from '../../src/builder/processor/build_dst_index';
import { printAll } from 'odgn-entity/src/util/print';
import { addDirDep, beforeEach } from './helpers';


const test = suite('/processor/build_dst_index');
test.before.each(beforeEach);
const log = (...args) => console.log(`[/test${test.name}]`, ...args);




test('build an index', async ({site,es}) => {

    await parseEntity( site, `
    id: 1999
    dst: /styles/
    `);

    let e = await parseEntity( site, `
    id: 2001
    text: css-data-here
    dst: main.css
    `);

    await addDirDep(site, 2001, 1999 );

    await buildDstIndex(site);

    // const dst = await getDstUrl(es, 2001);

    // log( dst );

    // printES(es);

    assert.equal( site.getIndex('/index/dstUrl').index.get('/styles/main.css'), [ 2001 ] );
});


test.run();
