import { assert } from 'chai';
import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
// import {transpile} from '../src/transpile';
import {transpile, processMdx,configPlugin, removeCommentPlugin} from '../src/transpile';
import Beautify from 'js-beautify';
import Klaw from 'klaw';
import {Test} from '../src/components/test';

describe('Pipleline', () => {

    it('creates from values', async () => {
        const root = Path.resolve(__dirname, "../");
        // const filename = 'pages/index.mdx';
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve( root, 'dist' );

        await Fs.emptyDir(outPath);
        
        // await mdxTest();

        processPages( path, outPath );
    });

});


export interface Page {
    path: string;
    relativePath: string;
    outPath?: string;
    html?: string;
    component?: any;
    pageProps: any; // page config
    layout?: string;
}



async function processPages( pagesPath:string, outPath:string ){

    let pages = await Promise.resolve(pagesPath)
        .then( gatherPages )
        .then( parsePages )
        .then( resolveLayouts )
        .then( p => setOutPath(p, outPath) )
        .then( renderPages )
        .then( writePages )
        .catch( err => {
            console.error('[processPages]', 'error', err );
            return [];
        })
}

async function writePages( pages:Page[] ):Promise<Page[]> {
    
    for( const page of pages ){
        if( page.html === undefined ){
            continue;
        }
        // console.log('[writePages]', page.outPath );
        // let pagePath = Path.relative(pagesPath,file.path)
        // let outPagePath = pagePath.replace(/\.[^/.]+$/, "") + '.html';

        await writeHTML(page.outPath, page.html);
        await writeFile(page.outPath+'.code', (page as any).code);
        await writeFile(page.outPath+'.jsx', (page as any).jsx);
    }
    return pages;
}

async function renderPages( pages:Page[] ):Promise<Page[]> {
    let result = [];

    for( const page of pages ){
        if( page.outPath === undefined ){
            result.push(page);
            continue;
        }
        result.push( await renderPage(page, pages) );
    }
    return result;
}

async function renderPage( page:Page, pages:Page[], pageProps:object = {} ):Promise<Page> {
    // let wrapper = undefined;
    let layoutPage;
    if( page.layout ){
        layoutPage = pages.find( p => p.relativePath === page.layout );

        // wrapper = layoutPage.component;
        let props = {...layoutPage.pageProps, ...page.pageProps, ...pageProps};
        
        // return await renderPage( layoutPage, pages, props );

        const {html} = await transpile({...layoutPage, 
            pageProps: props,
            forceRender:true,
            children: page.component
        });
        // // console.log('[renderPage]', 'layout', (page as any).code);
        // // console.log('[renderPage]', 'layout', page.pageProps);
        // // console.log('[renderPage]', 'layout', layoutPage.component);
        // // console.log('[renderPage]', 'layout', html);
        // // throw 'stop';
        return {...page, html};
    }

    try {
        let props = {...page.pageProps, ...pageProps};
        const {html,...rest} = await transpile({
            ...page,
            pageProps:props,
            forceRender:true,
            // wrapper,
            render: true
        });
        return {...page, html};
    } catch( err ){
        console.error('[renderPage]', err);
        console.log('[renderPage]', (page as any).jsx );// (layoutPage as any).jsx);
        return page;
    }
}

function setOutPath( pages:Page[], outPath:string ): Page[] {
    let result = [];

    for( const page of pages ){
        if( page.pageProps?.enabled === false ){
            result.push(page);
            continue;
        }
        let out = Path.join( outPath, 
            page.relativePath.replace(/\.[^/.]+$/, "") + '.html' );
            // console.log('wot', out);
        result.push( {...page, outPath:out});
    }
    return result;
}

function resolveLayouts( pages:Page[] ): Page[] {
    let result = [];
    for( let page of pages ){
        let config = page.pageProps;
        if( config === undefined ){
            result.push(page);
            continue;
        }
        let layout = config.layout ?? '';
        if( layout === '' ){
            result.push(page);
            continue;
        }
        // look for layout in pages
        let layoutPage = findLayout( layout, pages );

        if( layoutPage ){
            // console.log('layoutPage for', page.relativePath, 'is', layoutPage.relativePath );
            page = {...page, layout:layoutPage.relativePath};
        }

        result.push(page);
    }

    return result;
}

function findLayout( path:string, pages:Page[] ):Page {
    path = ensureFileExtension( Path.resolve(path), 'mdx');
    return pages.find( page => {
        const pagePath = Path.resolve( page.relativePath );
        // console.log('[findLayout]', path, '==', Path.resolve(page.relativePath) );
        return pagePath === path ? page : undefined;
    })
}

function ensureFileExtension(path:string, defaultTo = 'mdx' ){
    // const re = /(?:\.([^.]+))?$/;
    // let ext = re.exec(path)[1];
    const ext = path.substr(path.lastIndexOf('.') + 1);
    // console.log('[ensure]', path, ext);
    return ext !== 'mdx' ? path + `.${defaultTo}` : path;
}

async function parsePages( pages:any[] ): Promise<Page[]>{
    let result = [];
    for( let page of pages ){
        const {html,...rest} = await transpile({
            render: false,
            ...page
        })

        result.push( {...page, ...rest} );
    }
    return result;
}

async function gatherPages( pagesPath:string ): Promise<Page[]>{
    // const root = Path.resolve(__dirname, "../");
    // pagesPath = Path.resolve( root, pagesPath );

    let result = [];

    for await( const file of Klaw(pagesPath) ){
        if( file.stats.isDirectory() ){
            continue;
        }
        if( Path.extname(file.path) !== '.mdx' ){
            continue;
        }

        const {ctime,mtime} = file.stats;
        let pagePath = Path.relative(pagesPath,file.path)

        result.push( {relativePath:pagePath, path:file.path, ctime,mtime} );
    }

    return result;
}

async function writeFile( path:string, content:string ){
    await Fs.ensureDir( Path.dirname(path) );
    await Fs.writeFile( path, content );
}

async function writeHTML( path:string, html:string ){
    writeFile( path, Beautify.html(html) );
}