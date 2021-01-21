import { suite } from 'uvu';
import Path from 'path';
import { printAll, Site } from '../../src/builder/ecs';
import {
    process as resolveFileDeps,
} from '../../src/builder/processor/file_deps';
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

const log = (...args) => console.log('[TestProcMeta]', ...args);

const printES = (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const target = `file://${rootPath}/dist/`;
    tcx.site = new Site({ idgen, name: 'test', target });
    await tcx.site.init();
    // tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});



test('no dst without a target', async ({ es, site }) => {

    let e = await parseMeta( site, `
    ["/component/src"]
    url = "file:///pages/main.mdx"
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, undefined );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('filename dst', async ({ es, site }) => {

    let e = await parseMeta( site, `
    ["/component/src"]
    url = "file:///pages/main.mdx"
    ["/component/dst"]
    url = "main.txt"
    `);

    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    assert.equal( path, "/main.txt" );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('parent dst', async ({ es, site }) => {

    await parseMeta( site, `
    ["/component/dep"]
    src = 2001
    dst = 2000
    type = "dir"
    `);
    
    await parseMeta( site, `
    ["/component/dep"]
    src = 2000
    dst = 1999
    type = "dir"
    `);

    await parseMeta( site, `
    id = 1999
    ["/component/dst"]
    url = "/root/output.htm"
    `);

    await parseMeta( site, `
    id = 2000
    ["/component/dst"]
    url = "pages/"
    `);

    let e = await parseMeta( site, `
    id = 2001
    ["/component/src"]
    url = "file:///pages/main.mdx"
    ["/component/dst"]
    url = "main.txt"
    `);

    
    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    // console.log('\n\n---\n');
    // printAll( es );

    assert.equal( path, "/root/pages/main.txt" );

});

test('parent has filename', async ({ es, site }) => {

    await parseMeta( site, `
    ["/component/dep"]
    src = 2001
    dst = 2000
    type = "dir"
    `);
    
    await parseMeta( site, `
    ["/component/dep"]
    src = 2000
    dst = 1999
    type = "dir"
    `);

    await parseMeta( site, `
    id = 1999
    ["/component/dst"]
    url = "pages/output.txt"
    `);

    await parseMeta( site, `
    id = 2000
    `);

    let e = await parseMeta( site, `
    id = 2001
    ["/component/src"]
    url = "file:///pages/main.mdx"
    `);

    
    // there will be no dst url because there is no target
    let path = await getDstUrl( es, e.id );

    // console.log('\n\n---\n');
    // printAll( es );

    assert.equal( path, "/pages/output.txt" );

});


test.run();