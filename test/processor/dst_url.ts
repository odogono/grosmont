import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parse } from '../../src/builder/config';
import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { getDstUrl } from '../../src/builder/query';

const log = (...args) => console.log('[TestProcTargetPath]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/target_path');

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}


test.before.each( async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    tcx.site = await Site.create({idgen, name:'test', dst});
    tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});



test('no dst without a target', async ({ es, site }) => {

    let e = await parse( site, `
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

    let e = await parse( site, `
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

    let e = await parse( site, `
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

    await parse( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parse( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parse( site, `
    id: 1999
    /component/dst:
        url: /root/output.htm
    `);

    await parse( site, `
    id: 2000
    /component/dst:
        url: pages/
    `);

    let e = await parse( site, `
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

    await parse( site, `
    /component/dep:
        src: 2001
        dst: 2000
        type: dir
    `);
    
    await parse( site, `
    /component/dep:
        src: 2000
        dst: 1999
        type: dir
    `);

    await parse( site, `
    id: 1999
    /component/dst:
        url: pages/output.txt
    `);

    await parse( site, `
    id: 2000
    `);

    let e = await parse( site, `
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


// test.only('scss sitation', async ({es,site}) => {

//     await parse( site, `
//     /component/dep:
//         src: 2000
//         dst: 1999
//         type: dir
//     `);

//     await parse( site, `
//     id: 1999
//     src: file:///styles/
//     dst: /styles/
//     `);

//     let e = await parse( site, `
//     id: 2000
//     /component/src:
//         url: file:///styles/main.scss
//     `);

//     let path = await getDstUrl( es, e.id );

//     log( 'path', path);
// })


test.run();