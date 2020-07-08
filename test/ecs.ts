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
    printQuery
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

describe('ECS', () => {

    // it.only('remove ext', () => {
    //     // let path = '/com.opendoorgonorth/pages/main.mdx';
    //     let path = 'main';

    //     const ext = Path.extname(path).substring(1);
    //     const bare = ext.length > 0 ? path.substring(0, path.length-ext.length -1 ) : path;

    //     console.log('=', bare, ext, Path.basename(path) );
    // });

    it('does stuff', async () => {
        const root = Path.resolve(__dirname, "../");
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve(root, 'dist');
        
        await Fs.emptyDir(outPath);

        let ctx = new SiteContext(path, outPath);
        await ctx.init();

        let { es } = ctx;


        
        // await gatherPages(ctx,'misc/2018/jan.mdx');
        // await gatherPages(ctx,'index.mdx');
        // await gatherPages(ctx,'static/static.html');
        await gatherPages(ctx,'blog/about.mdx');
        // await gatherPages(ctx,'blog/about.mdx');
        // await gatherPages(ctx);

        // console.log('post gatherPages:');
        // printAll(ctx);

        await resolveMeta(ctx);
        
        // await resolveDependencies(ctx);
        if( false ){
        
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
        printAll(ctx);
        
        // console.log( 'hell', result.map(e => [e.File?.path, e.File?.ext]) );
        // console.log( 'hell', result[0] );
        // printEntity(ctx,result[0]);
        // const stack = createStdLibStack();

    });

    it.only('creates a page', async () => {
        const root = Path.resolve(__dirname, "../");
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve(root, 'dist');
        
        await Fs.emptyDir(outPath);

        let ctx = new SiteContext(path, outPath);
        await ctx.init();

        let { es } = ctx;

        let page = es.createEntity();

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

        ??
        `;

        page.Source = { data };
        page.Mdx = {};
        page.Target = { path:'/misc', writeJS:true };
        page.Enabled = {}
        page.Renderable = {}

        await ctx.add( page );

        await ctx.processPages();

        console.log('E:');
        printAll(ctx);

    });

});

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