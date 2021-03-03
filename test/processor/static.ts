import { suite } from 'uvu';
import assert from 'uvu/assert';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parse } from '../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as markStatic } from '../../src/builder/processor/static/mark';
import { process as copyStatic } from '../../src/builder/processor/static/copy';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';
import { printAll } from 'odgn-entity/src/util/print';
import { FindEntityOptions, selectSrcByExt } from '../../src/builder/query';
import { Level, Reporter } from '../../src/builder/reporter';



const log = (...args) => console.log('[TestProcStatic]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/static');


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

    await parse( site, `
    src: file:///alpha.JPEG
    `);
    await parse( site, `
    src: file:///beta.html
    `);

    let coms = await selectSrcByExt( es, ['jpeg', 'html'], options);

    assert.equal( coms.map(c=>c.url), ['file:///alpha.JPEG', 'file:///beta.html'] );
    
    coms = await selectSrcByExt( es, ['html'], options);
});


test('marks static files', async ({site,es, options}) => {
    await parse( site, `
    src: file:///alpha.JPEG
    `);
    await parse( site, `
    src: file:///beta.html
    `);
    await parse( site, `
    src: file:///index.mdx
    `);

    await markStatic(site, options);

    let e = await site.getEntityBySrc('file:///beta.html');

    assert.ok( e.Static );
});

test('copies static files', async ({site,es, options}) => {
    await parse( site, `
    src: file:///alpha.JPEG
    dst: 'alpha.jpg'
    `);
    await parse( site, `
    src: file:///beta.html
    dst: 'about.html'
    `);
    await parse( site, `
    src: file:///index.mdx
    `);

    options.reporter = new Reporter();
    await markStatic(site, options);
    await copyStatic(site, {...options, dryRun:true});

    // await printAll(es);
    // let e = await site.getEntityBySrc('file:///beta.html');

    // assert.ok( e.Static );
});


test.only('ignore non-relevent', async ({site, es, options}) => {
    await parse(site, `
    id: 2000
    src: alpha.mdx
    dst: alpha.html
    /component/mdx:
        data: "# Alpha"
    `);

    options.reporter = new Reporter();
    await markStatic(site, options);
    await copyStatic(site, {...options, dryRun:true});

});


test.run();


async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    await parse( site, `
    /component/dep:
        src: ${src}
        dst: ${dst}
        type: dir
    `);
}