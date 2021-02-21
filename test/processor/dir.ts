import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { parse } from '../../src/builder/config';
import { process as slugifyTitle } from '../../src/builder/processor/assign_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as readE } from '../../src/builder/processor/file/read_e';
import { process as applyDirMeta } from '../../src/builder/processor/file/apply_dir_meta';
import { build } from '../../src/builder';

import assert from 'uvu/assert';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';
import { printAll } from 'odgn-entity/src/util/print';
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