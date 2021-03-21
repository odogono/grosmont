import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { build } from '../../src/builder';

import assert from 'uvu/assert';
import { EntityId, printAll } from '../../src/es';
import { Level } from '../../src/builder/reporter';

const log = (...args) => console.log('[TestProcMeta]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/dir');


// test.before.each(async (tcx) => {
//     let id = 1000;
//     let idgen = () => ++id;

//     const dst = `file://${rootPath}/dist/`;
//     tcx.site = await Site.create({ idgen, name: 'test', dst });
    
//     // tcx.siteEntity = tcx.site.getEntity();
//     tcx.es = tcx.site.es;
// });



test('dir', async () => {
    let id = 1000; let idgen = () => ++id;
    const configPath = `file://${rootPath}/test/fixtures/rootE.yaml`;
    const site = await Site.create({idgen, configPath, level:Level.INFO});
    const options = { siteRef:site.getRef() };
    
    // await parse( site, `
    // src: file:///pages/
    // `);

    // let e = await parse( site, `
    // src: file:///pages/dir.e.yaml
    // `);

    await build(site);
    
    // await readE(site, options);

    // await applyDirMeta(site, options);
    
    // log('>--- BUILD 2'); await build(site);

    let eids = await site.findByTags(['blog', 'main']);

    assert.equal( eids, [1007] );

    // log('\n>---\n');

    await printAll( site.es );
});


test.run();


async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    await parse( site.es, `
    /component/dep:
        src: ${src}
        dst: ${dst}
        type: dir
    `);
}