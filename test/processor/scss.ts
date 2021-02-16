import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { process as assignTitle } from '../../src/builder/processor/assign_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as applyTags } from '../../src/builder/processor/mdx/apply_tags';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';
import { process as buildDeps } from '../../src/builder/processor/build_deps';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';
import { process as markScss } from '../../src/builder/processor/scss/mark';

import { parse } from '../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';


const log = (...args) => console.log('[TestProcSCSS]', ...args);

const printES = async (site:Site) => {
    console.log('\n\n---\n');
    await printAll( site.es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/scss');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    // tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});



test('mark will only consider updated', async({es,site}) => {
    await parse( site, `
    id: 2000
    src: alpha.scss
    `);
    await parse( site, `
    id: 2001
    src: beta.scss
    /component/upd:
        op: 2
    `);

    await markScss( site, {onlyUpdated:true} );

    // await printES( site.es );
    

    let e = await site.es.getEntity(2000);
    assert.equal( e.Scss, undefined );
});

test('render will only consider updated', async({es,site}) => {
    await parse( site, `
    id: 2000
    src: alpha.scss
    /component/scss:
        data: "$primary-color: #333; body { color: $primary-color; }"
    `);
    await parse( site, `
    id: 2001
    src: beta.scss
    /component/scss:
        data: "$primary-color: #FFF; body { color: $primary-color; }"
    /component/upd:
        op: 1
    `);

    await markScss( site, {onlyUpdated:true} );
    await renderScss( site, {onlyUpdated:true} );

    // await printES( site );
    
    let e = await site.es.getEntity(2000);
    assert.equal( e.Text, undefined );
});

test('process directly from file', async () => {
    let id = 1000;
    const idgen = () => ++id;

    const configPath = `file://${rootPath}/test/fixtures/rootD.yaml`;
    const site = await Site.create({ idgen, configPath });

    await parse( site, `
    src: file:///styles/main.scss
    `);

    await markScss( site );

    await renderScss(site);

    await buildDstIndex(site);

    // await printES(site);

    let e = await site.getEntityByDst('/main.css');
    assert.is.not( e.Text, undefined );

});


test.run();

