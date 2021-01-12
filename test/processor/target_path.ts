import { suite } from 'uvu';
import Path from 'path';
import { printAll, Site } from '../../src/builder/ecs';
import { 
    process as resolveFileDeps, 
} from '../../src/builder/processor/file_deps';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as resolveTargetPath, selectTargetPath } from '../../src/builder/processor/target_path';
import assert from 'uvu/assert';

const log = (...args) => console.log('[TestProcTargetPath]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/target_path');



test.before.each( async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const target = `file://${rootPath}/dist/`;
    tcx.site = new Site({idgen, name:'test', target});
    await tcx.site.init();
    tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});


test('target path for file', async (tcx) => {
    const {es, site} = tcx; 
    let init = `

    // select the site eid
    [ /component/site !bf @eid ] select pop! sid let
    
    [ /component/file {uri: "file:///content/pages/test.html"} ] !c
    [ /component/site_ref {ref: $sid} ] !c
    gather
    +
    `;

    await site.run(init);

    let path = await selectTargetPath( es, 1002 );

    assert.equal( path, '/content/pages/test.html' );

    // log('target path', path);

    // console.log('\n\n---\n');
    // printAll( es );
});



test('target path for file only', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    
    let e = await site.addFile( siteEntity, 'file:///content/style.scss' );
    let path = await selectTargetPath( es, e.id );

    assert.equal( path, '/content/style.scss' );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('target path for file with target', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    
    let e = await site.addFile( siteEntity, 'file:///content/style.scss' );
    e.Target = { uri: '/styles/' };
    await site.update( e );
    
    let path = await selectTargetPath( es, e.id );

    assert.equal( path, '/styles/style.scss' );

    // console.log('\n\n---\n');
    // printAll( es );
});


test('target path for file in directory', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    
    let e = await site.addDir( siteEntity, `file:///content/` );
    e = await site.addFile( siteEntity, 'file:///content/style.scss' );
    
    // important so that the file is linked to the dir
    await resolveFileDeps( site.es );

    let path = await selectTargetPath( es, e.id );

    assert.equal( path, '/content/style.scss' );

    // console.log('\n\n---\n');
    // printAll( es );
});


test('absolute target path for file in many directories', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    
    let e = await site.addDir( siteEntity, `file:///content/` );
    e = await site.addDir( siteEntity, `file:///content/alpha/` );
    
    e = await site.addDir( siteEntity, `file:///content/alpha/styles/` );
    e.Target = { uri:'/css/' };
    await site.update(e);
    e = await site.addFile( siteEntity, 'file:///content/alpha/styles/style.scss' );
    
    // important so that the file is linked to the dir
    await resolveFileDeps( site.es );

    let path = await selectTargetPath( es, e.id );

    assert.equal( path, 
        '/css/style.scss' );

    // console.log('\n\n---\n');
    // printAll( es );
});

test('relative target path for file in many directories', async (tcx) => {
    const {es, site, siteEntity} = tcx; 
    
    let e = await site.addDir( siteEntity, `file:///content/` );
    e = await site.addDir( siteEntity, `file:///content/alpha/` );
    
    e = await site.addDir( siteEntity, `file:///content/alpha/styles/` );
    e.Target = { uri:'css/' };
    await site.update(e);
    e = await site.addFile( siteEntity, 'file:///content/alpha/styles/style.scss' );
    
    // important so that the file is linked to the dir
    await resolveFileDeps( site.es );

    let path = await selectTargetPath( es, e.id );

    assert.equal( path, 
        '/content/alpha/css/style.scss' );

    // console.log('\n\n---\n');
    // printAll( es );
});


test.skip('create files and folders', async (tcx) => {
    const {es, site} = tcx;

    let siteEntity = site.getSite();

    // printAll(ctx.es, siteEntity);
    // console.log(siteEntity);

    let data = `
        $font-stack:    Helvetica, sans-serif;
        $primary-color: #333;

        body {
            font: 100% $font-stack;
            color: $primary-color;
        }`;

    let e = await site.addDir( siteEntity, `file:///content/` );
    // e = await ctx.addDir( siteEntity, `file:///content/` );

    e = await site.addFile( siteEntity, `file:///content/style.scss`);
    e.Scss = { data };
    // e.Target = { uri: `file:///output/style.css` };

    await site.update( e );

    await resolveFileDeps( site.es );
    await renderScss( site.es );
    await resolveTargetPath( site.es );


    // in this case the target will be /content/style.css


    console.log('\n---\n');
    printAll( es );

});


test.run();