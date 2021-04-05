import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { ChangeSetOp, Entity, EntityId } from '../../src/es';
import { parseEntity } from '../../src/builder/config';
import { statics as markStatic } from '../../src/builder/processor/mark';
import { process as copyStatic } from '../../src/builder/processor/static/copy';
import { FindEntityOptions, selectSrcByExt } from '../../src/builder/query';
import { Level, Reporter, setLevel } from '../../src/builder/reporter';
import { addFile, addSrc, printAll } from '../helpers';
import { buildProcessors, RawProcessorEntry } from '../../src/builder';



const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('/processor/static');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/test/fixtures/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst, level: Level.FATAL });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});



test('selects src by extension', async ({site,es, options}) => {

    await parseEntity( site, `
    src: file:///alpha.JPEG
    `);
    await parseEntity( site, `
    src: file:///beta.html
    `);

    let coms = await selectSrcByExt( es, ['jpeg', 'html'], options);

    assert.equal( coms.map(c=>c.url), ['file:///alpha.JPEG', 'file:///beta.html'] );
    
    coms = await selectSrcByExt( es, ['html'], options);
});


test('marks static files', async ({site,es, options}) => {
    await parseEntity( site, `
    src: file:///alpha.JPEG
    `);
    await parseEntity( site, `
    src: file:///beta.html
    `);
    await parseEntity( site, `
    src: file:///index.mdx
    `);

    await markStatic(site, options);

    let e = await site.getEntityBySrc('file:///beta.html');

    assert.ok( e.Static );
});

test('copies static files', async ({site,es, options}) => {
    await parseEntity( site, `
    src: file:///alpha.JPEG
    dst: 'alpha.jpg'
    `);
    await parseEntity( site, `
    src: file:///beta.html
    dst: 'about.html'
    `);
    await parseEntity( site, `
    src: file:///index.mdx
    `);

    // options.reporter = new Reporter();
    await markStatic(site, options);
    await copyStatic(site, {...options, dryRun:true});

    // await printAll(es);
    // let e = await site.getEntityBySrc('file:///beta.html');

    // assert.ok( e.Static );
});


test('ignore non-relevent', async ({site, es, options}) => {
    await parseEntity(site, `
    id: 2000
    src: alpha.mdx
    dst: alpha.html
    /component/mdx:
        data: "# Alpha"
    `);

    // options.reporter = new Reporter();
    await markStatic(site, options);
    await copyStatic(site, {...options, dryRun:true});

});


test('copy changed', async ({site, es, options}) => {
    await addFile( site, 'file:///logo.svg', {dst:'logo.svg'} );
    await addFile( site, 'file:///header.png', {dst:'header.png'} );
    await addFile( site, 'file:///image.jpg', {dst:'image.jpg', upd:ChangeSetOp.Update} );

    // setLevel(site.reporter, Level.DEBUG);

    const spec:RawProcessorEntry[] = [
        [ '/processor/build_src_index' ],
        [ '/processor/mark#statics' ],
        [ '/processor/build_dst_index'],
        [ '/processor/static/copy'],
    ];
    const process = await buildProcessors( site, '/test', spec );
    await process( site, {...options, onlyUpdated:true, dryRun:true} );

    // await printAll(es);

});


test.run();
