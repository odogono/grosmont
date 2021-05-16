import { suite } from 'uvu';
import assert from 'uvu/assert';

import { ChangeSetOp } from '../../src/es';
import { build, buildProcessors, RawProcessorEntry } from '../../src/builder';
import { addFile, addSrc, beforeEach, printAll, process } from '../helpers';
import { Level, setLevel } from '../../src/builder/reporter';
import { parseEntity } from '../../src/builder/config';
import { Site } from '../../src/builder/site';


const test = suite('/processor/assign_url');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each( beforeEach );


test('assign to entity', async ({es, site, options}) => {

    await addSrc( site, 'file:///one.mdx', `
---
title: First Blog Entry
dst: /blog/
tags: [ 'odgn-blog' ]
date: '2021-05-12'
---
# First
`);

    const process = await buildProcess( site );
    
    await process(site);

    let e = await site.getEntityBySrc( 'file:///one.mdx' );
    let dst = site.getDstIndex().getByEid( e.id, {withExtension: true} );

    assert.equal( dst, '/blog/2021/5/12/first-blog-entry.html' );

});

test('updates only', async ({es, site, options}) => {

    await parseEntity(site, `
    id: 2001
    src: one.mdx
    dst: /blog/
    date: '2021-05-16'
    title: First blog entry
    /component/mdx:
        data: "# First"
    tags: [ 'odgn-blog' ]
    /component/upd:
        op: 1
    `);

    
    const process = await buildProcess( site );
    await process(site, {...options, onlyUpdated:true});

    // await printAll(es);

    let e = await site.getEntityBySrc( 'file:///one.mdx' );
    let dst = site.getDstIndex().getByEid( e.id, {withExtension:true} );

    // log( site.getDstIndex() );
    // log( dst );

    assert.equal( dst, '/blog/2021/5/16/first-blog-entry.html' );

});



async function buildProcess( site:Site ){
    const spec:RawProcessorEntry[] = [
        [ '/processor/noop', 1000 ], // remove clearUpdates
        [ '/processor/assign_url', -1, { tags: [ 'odgn-blog' ]} ],
    ];

    return await buildProcessors(site, '/test/assign_url', spec, { includeDefault:true } );
}


test.run();