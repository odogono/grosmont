import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { getDstUrl } from '../../src/builder/processor/dst_url';
import { parse as parseMeta } from '../../src/builder/processor/meta';
import assert from 'uvu/assert';
import { printAll } from '../../src/builder/util';

const log = (...args) => console.log('[TestProcTargetPath]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/target_path');

const printES = (es) => {
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
});


test('file:// dst', async ({ es, site }) => {

    let e = await parseMeta( site, `
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