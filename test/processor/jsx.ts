import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addSrc, beforeEach } from '../helpers';
import { buildProcessors, RawProcessorEntry } from '../../src/builder';

const test = suite('/processor/jsx');
const log = (...args) => console.log(`[${test.name}]`, ...args);
test.before.each(beforeEach);
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

test('resolve imports', async ({es, site, options}) => {
    // const site = await Site.create({ idgen: idgen() });
    // let options = { siteRef: site.getRef() as EntityId } as FindEntityOptions;
    
    await addSrc(site, 'file:///main.jsx', `
import Message from 'file:///message.jsx';
export const dst =  '/main.html';

export default () => <div>Message: <Message /></div>;
    `);

    await addSrc(site, 'file:///message.jsx', `export default () => "Hello World";`);

    const spec:RawProcessorEntry[] = [
        [ '/processor/mark#jsx' ],
        [ '/processor/build_src_index' ],
        [ '/processor/jsx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render'],
        [ '/processor/build_dst_index'],
    ];

    const process = await buildProcessors( site, spec );
    await process(site,options);

    // await printAll(site.es);

    let e = await site.getEntityByDst('/main.html');

    assert.equal( e.Output.data, '<div>Message: Hello World</div>');
});



test('typescript', async ({es, site, options}) => {
    await addSrc( site, 'file:///main.tsx', `
    export const dst:string = '/main.html';
    
    const noun:string = 'World';

    export default () => <div>Hello {noun}</div>;
    `);

    const spec:RawProcessorEntry[] = [
        [ '/processor/mark#jsx' ],
        [ '/processor/build_src_index' ],
        [ '/processor/jsx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render'],
        [ '/processor/build_dst_index'],
    ];

    const process = await buildProcessors( site, spec );
    await process(site,options);

    // await printAll(site.es);

    let e = await site.getEntityByDst('/main.html');

    assert.equal( e.Output.data, '<div>Hello World</div>');
})


test.run();
