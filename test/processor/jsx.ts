import { suite } from 'uvu';
import Path from 'path';
import Beautify from 'js-beautify';
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
import { process as mark } from '../../src/builder/processor/mark';


import { process as evalJsx } from '../../src/builder/processor/jsx/eval_jsx';
import { process as evalJs } from '../../src/builder/processor/mdx/eval_js';
import { process as renderJs } from '../../src/builder/processor/mdx/render_js';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { buildSrcIndex, FindEntityOptions } from '../../src/builder/query';
import { EntityId } from 'odgn-entity/src/entity';


const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = async (site: Site) => {
    console.log('\n\n---\n');
    await printAll(site.es);
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/jsx');


// test.before.each(async (tcx) => {
//     let id = 1000;
//     let idgen = () => ++id;

//     const dst = `file://${rootPath}/dist/`;
//     tcx.site = await Site.create({ idgen, name: 'test', dst });
//     // tcx.siteEntity = tcx.site.getEntity();
//     tcx.es = tcx.site.es;
// });


// test('render code', async () => {
//     let id = 1000;
//     const idgen = () => ++id;

//     // const configPath = `file://${rootPath}/test/fixtures/rootC.yaml`;
//     const site = await Site.create({ idgen });


//     let e = await addJsx(site, 'file:///sitemap.jsx', `
//     import {site} from '@odgn-ssg';
// // import { Text as message } from 'e:///component/file?src=file:///message.jsx';
// // import { Text as message } from '[ /component/file#src !ca file://message.jsx == @e] select';

// const XmlHeader = (props) => React.createElement("?xml", props);

// export const mime = 'text/xml';
// export const dst = '/sitemap.xml';

// const url = site.getUrl();

// export default () => (

//     <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
//     <sitemap>
//        <loc>http://www.example.com/sitemap1.xml.gz</loc>
//        <lastmod>2014-10-01T18:23:17+00:00</lastmod>
//     </sitemap>
//  </sitemapindex>

// );
//     `);

//     await addJsx(site, 'file:///message.jsx', `
// export default () => "Hello World";
// `);

//     await mark(site, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })

//     await preProcessJSX(site);
//     await processJSX(site);

//     // await buildDstIndex(site);

//     await printES(site);

//     e = await site.getEntityByDst('/sitemap.xml');

//     // log( Beautify.html(e.Output.data) );


// });

function idgen() {
    let id = 1000;
    return () => ++id;
}


test('resolve imports', async () => {
    const site = await Site.create({ idgen: idgen() });
    let options = { siteRef: site.getRef() as EntityId } as FindEntityOptions;
    
    await addJsx(site, 'file:///main.jsx', `
    import Message from 'file:///message.jsx';
    export const page = { dst: '/main.html' };
    
    export default () => <div>Message: <Message /></div>;
    `);
    await addJsx(site, 'file:///message.jsx', `export default () => "Hello World";`);

    await mark(site, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    
    await buildSrcIndex(site);

    await evalJsx(site, options);

    await evalJs(site, options);

    await renderJs(site, options);
    
    // await processJSX(site);

    await buildDstIndex(site);

    // await printES(site);

    let e = await site.getEntityByDst('/main.html');

    assert.equal( e.Output.data, '<div>Message: Hello World</div>');
});




test.run();


async function addJsx(site: Site, url: string, data: string, meta?: any) {
    let e = await site.addSrc(url);
    e.Data = { data };
    // e.Jsx = { data };
    // if( meta !== undefined ){
    //     e.Meta = { meta };
    // }
    return await site.update(e);
}