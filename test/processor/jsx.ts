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
import { process as markMdx } from '../../src/builder/processor/mdx/mark';
import { 
    process as processJSX, 
    preprocess as preProcessJSX 
} from '../../src/builder/processor/jsx';

import { parse } from '../../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';


const log = (...args) => console.log('[TestProcMDX]', ...args);

const printES = async (site:Site) => {
    console.log('\n\n---\n');
    await printAll( site.es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/jsx');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    // tcx.siteEntity = tcx.site.getSite();
    tcx.es = tcx.site.es;
});



test.only('render code', async () => {
    let id = 1000;
    const idgen = () => ++id;

    const configPath = `file://${rootPath}/test/fixtures/rootC.yaml`;
    const site = await Site.create({ idgen, configPath });


    let e = await addJsx( site, 'file:///sitemap.jsx',`

    import {site} from '@odgn-ssg';
// import { Text as message } from 'e:///component/file?src=file:///message.jsx';
// import { Text as message } from '[ /component/file#src !ca file://message.jsx == @e] select';

const XmlHeader = (props) => React.createElement("?xml", props);

export const mime = 'text/xml';
export const dst = '/sitemap.xml';

const url = site.getUrl();

export default () => (

    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
       <loc>http://www.example.com/sitemap1.xml.gz</loc>
       <lastmod>2014-10-01T18:23:17+00:00</lastmod>
    </sitemap>
 </sitemapindex>

);
    `);

    await addJsx( site, 'file:///message.jsx', `
export default () => "Hello World";
`);

    // await markMdx( site );
    // await mdxPreprocess(site);

    // await assignTitle(site);

    // await mdxRender(site, {target:'text/html'} );

    await preProcessJSX(site);
    await processJSX(site);

    await buildDstIndex(site);

    await printES(site);

    e = await site.getEntityByDst('/sitemap.xml');

    log( Beautify.html(e.Text.data) );


});


test.run();




async function addScss( site:Site,  url:string, data:string ){
    let e = await site.addSrc(url);
    e.Scss = {data};
    await site.update(e);
}

async function addMdx( site:Site, url:string, data:string, meta?:any ){
    let e = await site.addSrc(url);
    e.Mdx = { data };
    if( meta !== undefined ){
        e.Meta = { meta };
    }
    return await site.update(e);
}

async function addJsx( site:Site, url:string, data:string, meta?:any ){
    let e = await site.addSrc(url);
    e.Jsx = { data };
    if( meta !== undefined ){
        e.Meta = { meta };
    }
    return await site.update(e);
}