import { suite } from 'uvu';
import assert from 'uvu/assert';

import { parseEntity } from '../../src/builder/config';
import { getDstUrl } from '../../src/builder/query';
import { build } from '../../src/builder';
import { beforeEach } from '../helpers';

const test = suite('processor/dst_url');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each( beforeEach );


test('no dst without a target', async ({ es, site }) => {

    let e = await parseEntity( site, `
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

    let e = await parseEntity( site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/dst:
        url: main.txt
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, "/main.txt" );
});


test('file:// dst', async ({ es, site }) => {

    let e = await parseEntity( site, `
    /component/src:
        url: file:///pages/main.mdx
    /component/dst:
        url: file:///main.txt
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, "file:///main.txt" );
});




test('parent dst', async ({ es, site }) => {

    await parseEntity( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parseEntity( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parseEntity( site, `
    id: 1999
    /component/dst:
        url: /root/output.htm
    `);

    await parseEntity( site, `
    id: 2000
    /component/dst:
        url: pages/
    `);

    let e = await parseEntity( site, `
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

    await parseEntity( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parseEntity( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parseEntity( site, `
    id: 1999
    /component/dst:
        url: pages/output.txt
    `);

    await parseEntity( site, `
    id: 2000
    `);

    let e = await parseEntity( site, `
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

test('dir meta dst', async ({es, site,options}) => {
    await parseEntity( site, `
    src: file:///dir.e.yaml
    dst: pages/
    `);

    await parseEntity( site, `
    src: file:///index.mdx
    data: "# Welcome"
    dst: index.html
    `);

    await parseEntity( site, `
    src: file:///about.mdx
    data: "# About"
    `);

    await build( site, {...options, onlyUpdated:false} );

    // await printAll( es );

    let e = await site.getEntityBySrc('file:///index.mdx');

    // printEntity(es, e);

    let path = await getDstUrl(es, e.id);

    assert.equal( path, "/pages/index.html" );

    // log( site.getIndex('/index/dstUrl') );

});



test.run();