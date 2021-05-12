import { suite } from 'uvu';
import assert from 'uvu/assert';

import { ChangeSetOp } from '../../src/es';
import { build, buildProcessors, RawProcessorEntry } from '../../src/builder';
import { addFile, addSrc, beforeEach, printAll, process } from '../helpers';
import { Level, setLevel } from '../../src/builder/reporter';


const test = suite('/processor/assign_url');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each( beforeEach );


test('assign to entity', async ({es, site, options}) => {

    await addSrc( site, 'file:///one.mdx', `
---
title: First Blog Entry
dst: /blog/
tags: [ 'cat-blog' ]
date: '2021-05-12'
---
# First
`);

    const spec:RawProcessorEntry[] = [
        [ '/processor/assign_url', -1, { tags: [ 'cat-blog' ]} ],
    ];

    const process = await buildProcessors(site, '/test/assign_url', spec, { includeDefault:true } );

    await process(site);

    let e = await site.getEntityBySrc( 'file:///one.mdx' );
    let dst = site.getDstIndex().getByEid( e.id );

    assert.equal( dst, '/blog/2021/5/12/first-blog-entry.html' );

    // log('dst index');
    // for( const [key, [eid]] of site.getDstIndex() ){
    //     log( eid, key );
    // }
});


test.run();