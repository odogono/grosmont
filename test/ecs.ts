import { suite } from 'uvu';
import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
// import { create as createEntitySet } from 'odgn-entity/src/entity_set';
// import { createEntitySet } from 'odgn-entity/dist/cjs/index';
import {
    SiteContext, gatherPages,
    resolveMeta,
    resolveDependencies,
    resolvePageLinks,
    resolveDest,
    processCSS,
    resolveCssLinks,
    resolveLinks,
    resolveLayout,
    renderPages,
    writePages,
    selectAll,
    printAll,
    printQuery,
    selectEntityBySource,
    getPageMeta
} from '../src/builder/ecs';
import { Entity } from 'odgn-entity/src/entity';
// import {
//     EntitySetMem, EntitySet,
//     createStdLibStack, query
// } from 'odgn-entity/dist/cjs';

// console.log( require('odgn-entity') );

// import { create } from 'odgn-entity';
// import { create } from 'odgn-entity/dist/esm/sql';
// import { create as createSQLES } from 'odgn-entity/dist/cjs/sql';


const test = suite('ECS');


test('does stuff', async () => {
    const root = Path.resolve(__dirname, "../");
    const path = Path.resolve(root, 'pages');
    let outPath = Path.resolve(root, 'dist');

    await Fs.emptyDir(outPath);

    let ctx = new SiteContext(path, outPath);
    await ctx.init();

    let { es } = ctx;



    // await gatherPages(ctx,'misc/2018/jan.mdx');
    await gatherPages(ctx, 'misc/2018/feb.mdx');
    // await gatherPages(ctx,'index.mdx');
    // await gatherPages(ctx,'static/static.html');
    // await gatherPages(ctx,'blog/about.mdx');
    // await gatherPages(ctx,'blog/about.mdx');
    // await gatherPages(ctx);

    // console.log('post gatherPages:');
    // printAll(ctx);

    await resolveMeta(ctx);

    // await resolveDependencies(ctx);
    if (false) {

        await resolvePageLinks(ctx);

        await resolveLayout(ctx);

        await resolveDest(ctx);

        await processCSS(ctx);

        await resolveCssLinks(ctx);

        await resolveLinks(ctx);

        await renderPages(ctx);

        await writePages(ctx, { beautify: true, writeCode: false, writeJSX: false })
    }

    // await ctx.persistentEs.add( ctx.es );

    // console.log('MDX:')
    // await printQuery(ctx,querySelectMdx);

    // console.log('CSS:')
    // await printQuery(ctx,querySelectCss);
    // await printQuery(ctx,querySelectPageCss);

    // console.log('Links:');
    // await printQuery(ctx,querySelectPageLinks);

    // console.log('Files:');
    // await printQuery(ctx,querySelectFiles);

    console.log('E:');
    printAll(ctx.es);

    // console.log( 'hell', result.map(e => [e.File?.path, e.File?.ext]) );
    // console.log( 'hell', result[0] );
    // printEntity(ctx,result[0]);
    // const stack = createStdLibStack();

});

test('creates a page', async () => {
    const ctx = await setupContext();
    let page = ctx.createMdxEntity();

    // ---
    // title: Testing Da Src
    // ---
    const data = `

export const facts = {
    water: 'cold',
    fire: 'hot'
};
        export const exampleVar = false;

        ## Mistake

        nothing here

        # Testing Source
        this is a test of the source

        ## References

        [0] nothing to see

        # Lower Title

        ??`;

    page.Source = { data };
    page.Target = { path: '/misc', writeJS: false };

    await ctx.add(page);

    await ctx.processPages();

    console.log('E:');
    printAll(ctx.es);

});

test('inlines css', async () => {
    const ctx = await setupContext();
    const { es } = ctx;

    let page = ctx.createCssEntity();

    let data = `
        $font-stack:    Helvetica, sans-serif;
        $primary-color: #333;

        body {
        font: 100% $font-stack;
        color: $primary-color;
        }`;
    page.Source = { data, uri: 'css:/test.css' };

    // removing target means it wont manifest
    page.Target = undefined;
    await ctx.add(page);

    // note - important that import has no leading space
    data = `
import 'css:/test.css';

        <InlineCSS />

        # Importing CSS using a target uri
        
        the target uri lets us reference the css using its target path
        `;

    page = ctx.createMdxEntity();
    page.Source = { data, uri: 'mdx:/page/test' };
    page.Target = {};
    await ctx.add(page);

    await ctx.processPages();

    console.log('E:');
    printAll(ctx.es);
});


test.only('file', async () => {
    const ctx = await setupContext();
    
    
    await ctx.processPages('file://misc/2018/feb.mdx');

    // await gatherPages(ctx, 'file://misc/2018/feb.mdx');


    // await resolveMeta(ctx);
    // await resolveDependencies(ctx);
    // await resolvePageLinks(ctx);
    
    console.log('E:');
    printAll(ctx);
    
    // const page = selectEntityBySource(ctx, 'file:/styles/misc.css' );
    // // const page = selectEntityBySource(ctx, 'file:/misc/2018/feb.mdx' );
    // const meta = getPageMeta(ctx, page);
    // const dst = ctx.pageDstPath(page, false);
    // console.log('meta:', meta);
    // console.log('dst', dst);
});


test.run();





async function setupContext(): Promise<SiteContext> {
    const root = Path.resolve(__dirname, "../");
    const path = Path.resolve(root, 'pages');
    let outPath = Path.resolve(root, 'dist');

    await Fs.emptyDir(outPath);

    let ctx = new SiteContext(path, outPath);
    await ctx.init();
    return ctx;
}

// {
//     type: 'root',
//     children: [
//       {
//         type: 'export',
//         value: 'export const page = {"title":"Testing Da Src"};',
//         position: [Position]
//       },
//       {
//         type: 'heading',
//         depth: 1,
//         children: [Array],
//         position: [Position]
//       },
//       { type: 'paragraph', children: [Array], position: [Position] }
//     ],
//     position: {
//       start: { line: 1, column: 1, offset: 0 },
//       end: { line: 7, column: 9, offset: 101 }
//     }
//   }

const querySelectMdx = `[ 
    // selects entities which have /component/mdx
    /component/file#ext !ca mdx ==
    // [ /component/title /component/meta /component/file ] !bf
    // selects all components from the entities selected
    all 
    @c
    ] select`;

const querySelectCss = `[
    // selects entities which have /component/mdx
    /component/file#ext !ca css ==
    all @c
    ] select`;


const querySelectPageCss = `[ 
    // selects entities which have /component/mdx
    [ /component/page_css ] !bf @c
    ] select`;
const querySelectPageLinks = `[ 
    // selects entities which have /component/mdx
    [ /component/page_link ] !bf @c
    ] select`;

const querySelectFiles = `[ 
    // selects entities which have /component/mdx
    [ /component/file ] !bf @c
    ] select`;

