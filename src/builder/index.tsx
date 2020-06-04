import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import { transpile } from './transpile';
import Beautify from 'js-beautify';
import Klaw from 'klaw';
import Yaml from 'yaml';
import { transformCSS } from './css';
import { BuildContext, 
    Page, Dir, 
    PageMeta ,
    createMeta,
    createPage, createDir,
    isDir, dirPath,
    pageSrcPath, pageDstPath,
    PageLink, PageLinks, getPageLayout, parentDir, getPageMeta, isMdxPage, resolvePaths, findPagePath, hasPage, removeExtension, isPageRenderable
} from './context';





export async function processPages(rootPath: string, dstPath: string, targetPage?: string): Promise<BuildContext> {

    let ctx = new BuildContext(rootPath, dstPath);

    try {
        ctx = await ctx
            .use(() => Fs.emptyDir(dstPath))
            .use(gatherPages, targetPage)
            .use(resolveMeta)
            .use(removeDisabled)
            .use(resolveDependencies)
            .use(resolveDest)
            .use(processCSS)
            .use(resolveLinks)
            .use(resolveCSSLinks)
            // .use(debug)
            .use(renderPages)
            .use(writePages, { beautify:true, writeCode: false, writeJSX: false })
            .process()
    } catch (err) {
        console.error('[processPages]', 'error', err);
    }

    // console.log(ctx);
    function debug(ctx: BuildContext) {
        console.log('> pages');
        for (const page of ctx.pages) {
            let { code, jsx, content, meta, ...rest } = page as any;
            meta = getPageMeta(ctx, page);
            let out:any = {meta,...rest};
            if( content != null ){ out.content = truncate(content) }
            if( code != null ){ out.code = truncate(code) }
            if( jsx != null ){ out.jsx = truncate(jsx) }
            console.dir(out);
        }
        return ctx;
    }

    return ctx;
    // .then(resolveLayouts)
}

// export async function findDependencies(ctx:BuildContext, targetPage: string){
    
//     if( hasPage(ctx,targetPage) ){
//         return ctx;
//     }

//     ctx = await gatherPages(ctx, targetPage);
//     ctx = await resolveMeta(ctx);
//     ctx = await removeDisabled(ctx);

//     // resolve dependencies
//     for( const page of ctx.pages) {
//         if( page.requires.length > 0 ){
//             for( const path of page.requires ){
//                 ctx = await findDependencies(ctx, path);
//             }
//         }
//     }

//     return ctx;
// }

async function resolveDependencies(ctx: BuildContext): Promise<BuildContext> {

    // console.log('[resolveDependencies]', 'pre', ctx.pages.map(p=>p.path) );
    for(const page of ctx.pages){
        for( const dep of page.requires ){
            if( hasPage(ctx,dep) ){
                continue;
                // console.log('[resolveDependencies]', dep );
            }
            ctx = await gatherPages(ctx,dep);
            // console.log('[resolveDependencies]', 'post', ctx.pages.map(p=>p.path) );
            ctx = await resolveMeta(ctx);
        }
    }

    return ctx;
}

async function resolveDest(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    for (const page of ctx.pages) {
        const isRenderable = page.isRenderable !== false;
        const isEnabled = page.isEnabled;
        if (!isEnabled || !isRenderable) {
            pages.push(page);
            continue;
        }
        let path = page.meta['dstPath'] ?? page.path;
        if (path.endsWith('/')) {
            path = Path.join(path, Path.basename(page.path));
        }
        // console.log('[resolveDest]', page.path, path );
        let ext = (page as any).ext === 'mdx' ? 'html' : (page as any).ext;

        let dstPath = path + (isDir(page) ? '' : `.${ext}`);

        pages.push({ ...page, dstPath });
    }
    ctx.pages = pages;
    return ctx;
}

async function resolveCSSLinks(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    let [mdxPages,other] = filterPagesByExt(ctx,'mdx');

    for (const page of mdxPages) {

        let {_inlineCSS, ...meta} = page.meta as any;
        if( _inlineCSS === undefined || _inlineCSS.length === 0 ){
            pages.push(page);
            continue;
        }
        const dir = parentDir(ctx, page);
        const cssPages = _inlineCSS.map( url => {
            let path = Path.resolve(dir, url);
            path = Path.relative(ctx.rootPath, path);
            path = removeExtension(path);
            return ctx.pages.find(p => p.path === path);
        }).filter(Boolean);

        const cssLinks = cssPages.map( cssPage => 
            Path.relative(dirPath(ctx, page), pageDstPath(ctx, cssPage)) );

        let css:string = cssPages.reduce( (content,cssPage) => 
            content + ' ' + (cssPage as Page).content
            , '');
        
        if( cssLinks.length > 0 ){
            meta = {...meta, cssLinks};
        }
        if( css.length > 0 ){
            // css = css.replace('>', "\\u003E");
            meta = {...meta, css};
        }

        pages.push({...page, meta});
    }
    ctx.pages = [...other, ...pages];
    return ctx;
}

async function resolveLinks(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    let [mdxPages,other] = filterPagesByExt(ctx,'mdx');

    for (const page of mdxPages) {
        let { links } = page as Page;
        if (links === undefined || links.size === 0) {
            pages.push(page);
            continue;
        }

        let rewriteLinks = new Map<string, PageLink>();
        for (const [url, value] of links) {

            const dir = parentDir(ctx, page)
            let path = Path.resolve(dir, url);
            path = Path.relative(ctx.rootPath, path);

            let linkPage = ctx.pages.find(p => p.path === path);

            if (linkPage !== undefined) {
                let rel = Path.relative(dirPath(ctx, page), pageDstPath(ctx, linkPage));
                // console.log('[resolveL]', path, linkPage?.dstPath, rel );
                // console.log('[resolveLinks]', url, page.path, linkPage.path, rel );
                // console.log('[resolveLinks]', url, dirPath(ctx,page) );
                // console.log('[resolveLinks]', url,  fullPath(ctx,linkPage,true) );
                // console.log('[resolveLinks]', url,  rel );
                rewriteLinks.set(url, { ...value, url: rel });
            } else {
                rewriteLinks.set(url, value);
            }
        }
        // console.log('[resolveLinks]', rewriteLinks );
        pages.push({ ...page, links: rewriteLinks });
    }

    ctx.pages = [...other, ...pages];
    return ctx;
}




interface WritePagesOptions extends WriteHTMLOptions {
    writeCode?: boolean;
    writeJSX?: boolean;
    writeHTML?: boolean;
}

async function writePages(ctx: BuildContext, options: WritePagesOptions = {}): Promise<BuildContext> {
    // console.log('[writePages]', options);
    let doWriteHTML = options.writeHTML ?? true;
    let doWriteCode = options.writeCode ?? false;
    let doWriteJSX = options.writeJSX ?? false;
    let doWriteAST = false;

    for (const page of ctx.pages) {
        if( !isPageRenderable(page) ){
        // if (isDir(page) ){//|| page.meta.isRenderable !== true ) {
            continue;
        }
        const {ext} = page as Page;

        if( isMdxPage(page) ){
            const { code, jsx,ast, meta, content } = (page as Page);
            if (content === undefined) {
                // console.log('[writePages]', 'no content', page.path);
                continue;
            }

            const outPath = pageDstPath(ctx,page);

            doWriteCode = meta['writeJS'] === true || doWriteCode;
            doWriteJSX = meta['writeJSX'] === true || doWriteJSX;
            doWriteAST = meta['writeAST'] === true || doWriteAST;

            if (doWriteHTML) await writeHTML(outPath, content, options);
            if (doWriteCode) await writeFile(outPath + '.js', code);
            if (doWriteJSX) await writeFile(outPath + '.jsx', jsx);
            if (doWriteAST) await writeFile(outPath + '.ast', ast as any);
        }
        else if( ext === 'css' ){
            const {content} = (page as Page);
            const outPath = pageDstPath(ctx,page);
            await Fs.ensureDir( Path.dirname(outPath) );
            await writeFile( outPath, content );
        }
        else {
            // console.log('[writePages]', page.path, page.meta );
            const src = pageSrcPath(ctx,page);// Path.join(ctx.rootPath, page.path + `.${ext}`);
            const dst = pageDstPath(ctx,page);// Path.join(ctx.dstPath,dstPath);
            await Fs.ensureDir( Path.dirname(dst) );
            await Fs.copyFile( src, dst );
        }
    }
    return ctx;
}

async function renderPages(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];

    let [mdxPages,other] = filterPagesByExt(ctx,'mdx', p => p.isRenderable );

    for (const page of mdxPages) {
        // console.log('[renderPage]', page.path );
        pages.push(await renderPage(ctx, (page as Page)));
    }

    ctx.pages = [...other, ...pages];
    return ctx;
}

async function renderPage(ctx: BuildContext, page: Page): Promise<Page> {
    // const isRenderable = page.meta.isRenderable ?? false;
    // if (!isRenderable) {
    //     return page;
    // }

    let { meta, links } = page;
    let path = pageSrcPath(ctx,page);

    try {
        // const unpick = ({code,component,html,jsx}:any) => ({code,component,html,jsx});
        // console.log('[renderPage]', path );
        let result = await transpile({ path, links, meta }, { forceRender: true });

        const layoutPage = getPageLayout(ctx, page);

        if (layoutPage === undefined) {
            return {
                ...page,
                code: result.code,
                component: result.component,
                content: result.html,
                jsx: result.jsx
            };
        }

        // render the page into the layout page
        path = pageSrcPath(ctx,layoutPage);

        let layoutResult = await transpile({ path, meta, children: result.component }, { forceRender: true });

        return {
            ...page,
            code: result.code,
            // ast: result.ast,
            component: layoutResult.component,
            content: layoutResult.html,
            jsx: result.jsx
        };

    } catch (err) {
        console.error('[renderPage]', page.path, err);
        console.log('[renderPage]', (page as any).jsx);// (layoutPage as any).jsx);
        return page;
    }

}


function extractMetaPageProps(page:Dir, meta:PageMeta){
    let {isEnabled, isRenderable, ...outMeta} = meta as any;
    isEnabled = isEnabled ?? true;
    isRenderable = isRenderable ?? page.isRenderable;
    return [{isEnabled,isRenderable}, outMeta];
}


/**
 * Parses pages of their meta data and links by doing a transpile on
 * the page source. Then resolves against directory meta. 
 * 
 * @param ctx 
 */
async function resolveMeta(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];

    // filter out dirs
    let [inPages,other] = filterPages(ctx, p => p.isResolved !== true );
    
    // let inPages = ctx.pages.filter(p => p.isResolved !== true );

    // first pass, resolve own meta, and also links
    for (const page of inPages) {
        // let { meta } = page;
        let dirMeta = await getDirMeta(ctx,page);
        // let [{isEnabled,isRenderable}, exMeta] = extractMetaPageProps(page,dirMeta);
        
        // isEnabled = isEnabled ?? true;
        // isRenderable = isRenderable ?? page.isRenderable;
        // meta.isRenderable = meta.isRenderable ?? isMdxPage(page) ? true : false;
        
        const path = pageSrcPath(ctx, page);

        let upd: any = { ...page, meta:dirMeta, isResolved:true };

        if( isMdxPage(page) ){
            // just interested in meta
            let { meta: outMeta, links } = await transpile({ meta:upd.meta, path });
            upd.meta = { ...upd.meta, ...outMeta };
            if (links !== undefined && links.size > 0) {
                upd = { ...upd, links };
            }
        }
        let [{isEnabled,isRenderable}, exMeta] = extractMetaPageProps(page,upd.meta);
        upd = {...upd, isEnabled, isRenderable, meta:exMeta};

        // console.log('[resolveMeta]', page.path, upd.meta );
        
        pages.push(upd);
    }

    // ctx.pages = [...other, ...pages];
    inPages = pages;
    pages = [];

    // let [mdxPages,other] = filterPagesByExt(ctx,'mdx', p => p.isResolved !== true );

    // second pass, resolve layout
    for (const page of inPages) {
        if( !isMdxPage(page) ){
            pages.push(page);
            continue;
        }

        let { meta, requires } = page;
        const path = pageSrcPath(ctx, page);

        // first, layout
        const layout = getPageLayout(ctx, page);

        if (layout !== undefined) {
            meta = { ...layout.meta, ...meta };
        }
        
        // if( isMdxPage(page) ){
            let { meta: outMeta, requires:pReq } = await transpile({ meta, path });
            meta = { ...meta, ...outMeta };

            if( layout !== undefined ){
                pReq.push( pageSrcPath(ctx,layout) );
            }
            else if( meta.layout !== undefined ){
                const pagePath = await findPagePath(ctx,meta.layout);
                if( pagePath !== undefined ) {
                    pReq.push( pagePath );
                }
            }

            // resolve requires against context
            pReq = resolvePaths(ctx, pReq);

            // requires = [...requires, layout.path ];

            requires = [...requires,...pReq];
        // }

        let [{isEnabled,isRenderable}, exMeta] = extractMetaPageProps(page,meta);
        const upd = {...page, isEnabled, isRenderable, meta:exMeta, requires};

        pages.push(upd);
    }

    ctx.pages = [...other,...pages];
    // ctx.pages = pages;
    return ctx;
}


async function removeDisabled(ctx:BuildContext): Promise<BuildContext> {
    let pages = [];
    let [mdxPages,other] = filterPagesByExt(ctx,'mdx');
    
    for (const page of mdxPages) {
        if( page.isEnabled === false ){
            continue;
        }
        pages.push(page);
    }

    ctx.pages = [...other, ...pages];
    return ctx;
}



async function processCSS(ctx:BuildContext): Promise<BuildContext> {
    let pages = [];
    let [cssPages,other] = filterPagesByExt(ctx,'css');
    
    for (const page of cssPages) {
        let tpage = await transformCSS(ctx, page as Page, {minify:true});
        pages.push(tpage);
    }

    ctx.pages = [...other, ...pages];
    return ctx;
}


function parentPath(path: string) {
    return path.split(Path.sep).slice(0, -1).join(Path.sep);
}



/**
 * Reads through the src directory and gathers information about the files and dirs
 * found
 * 
 * @param ctx 
 */
async function gatherPages(ctx: BuildContext, targetPath?:string ): Promise<BuildContext> {

    let pages = [];

    if( !await Fs.pathExists(ctx.rootPath) ){
        return ctx;
    }

    // console.log('[gatherPages]', {targetPath}, ctx.pages.map(p=>p.path) );
    // console.log('ctx pages', );
    
    let rootPath = targetPath !== undefined ? Path.join(ctx.rootPath, targetPath) : ctx.rootPath;

    let stats = Fs.statSync(rootPath);

    const validExtensions = ['mdx', 'jsx', 'tsx', 'html', 'css'];

    // if we have a single file
    if (stats.isFile()) {
        const ext = Path.extname(rootPath).substring(1);
        if (validExtensions.indexOf(ext) === -1) {
            return ctx;
        }

        const { ctime, mtime } = stats;
        let relativePath = Path.relative(ctx.rootPath, rootPath);
        relativePath = removeExtension(relativePath);

        ctx.pages = [
            ...ctx.pages,
            createPage(relativePath, createMeta(), { ext, ctime, mtime })
        ];
        // console.log('[gatherPages]', 'post', {targetPath}, ctx.pages.map(p=>p.path) );
        return ctx;
    }

    let inactivePaths = [];

    for await (const file of Klaw(rootPath)) {
        let relativePath = Path.relative(ctx.rootPath, file.path);

        const isDisabled = inactivePaths.find( p => relativePath.startsWith(p) );

        if( isDisabled ){
            // console.log('[gatherPages]', relativePath, 'disabled' );
            continue;
        }

        const { ctime, mtime } = file.stats;
        if (file.stats.isDirectory()) {
            let meta = await readDirMeta(file.path);
            if (meta !== undefined) {
                // early culling of disabled paths
                if( meta['isEnabled'] === false ){
                    inactivePaths.push( relativePath );
                    continue;
                }
                // const dir = createDir(relativePath, meta, { ctime, mtime });
                // pages.push(dir);
            }
            // console.log('[gatherPages]', relativePath, meta);
            continue;
        }

        const ext = Path.extname(file.path).substring(1);
        if (validExtensions.indexOf(ext) === -1) {
            continue;
        }
        
        relativePath = removeExtension(relativePath);
        
        // console.log('[gatherPages]', relativePath, ext);
        pages.push(createPage(relativePath, createMeta(), { ext, ctime, mtime }));
    }

    ctx.pages = [...ctx.pages, ...pages];

    return ctx;
}


async function writeFile(path: string, content: string) {
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}

interface WriteHTMLOptions {
    beautify?:boolean;
}

async function writeHTML(path: string, html: string, options:WriteHTMLOptions={}) {
    html = (options.beautify ?? false) ? Beautify.html(html) : html;
    writeFile(path, html);
}

async function readDirMeta(path: string): Promise<PageMeta> {
    let metaPath = Path.join(path, 'meta.yaml');
    if (await Fs.pathExists(metaPath) === false) {
        return undefined; //createMeta({isRenderable:false});
    }
    let content = await Fs.readFile(metaPath, 'utf8');
    let meta = Yaml.parse(content) as PageMeta;
    // console.log('meta was', meta);
    // yaml will return null rather than undefined
    return meta === null ? undefined : meta;
}


/**
 * Recursively works up the directories until it reaches root building
 * data from each meta.yaml file
 * 
 * @param ctx 
 * @param page 
 * @param meta 
 */
async function getDirMeta(ctx: BuildContext, page: Dir, meta = page.meta) {
    const path = pageSrcPath(ctx,page);

    if( path === Path.dirname(ctx.rootPath) || !await pathExists(path) ){
        // console.log('[getDirMeta]', meta);
        return meta;
    }

    const stats = await Fs.stat(path);

    if( stats.isDirectory() ){
        let dirMeta = await readDirMeta(path);
        meta = {...dirMeta, ...meta};
    }

    let dirPath = Path.dirname(path);
    dirPath = Path.relative(ctx.rootPath,dirPath);

    return getDirMeta( ctx, createDir(dirPath), meta );
}




function truncate(str: string, len = 10) {
    return str === undefined ? '' : str.length <= len ? str : str.slice(0, len) + '...';
}

function filterPages(ctx:BuildContext, filterFn?:Function ): [ Dir[], Dir[] ] {
    return ctx.pages.reduce( ([mdx,other], d) => {
        const fnPass = filterFn ? filterFn(d) : true;
        if( fnPass ){
            mdx = [...mdx,d]
        }  else {
            other = [...other,d];
        }
        return [mdx,other];
   },[[],[]]);
}

function filterPagesByExt(ctx:BuildContext, ext:string = 'mdx', filterFn?:Function ): [ Dir[], Dir[] ] {
    return ctx.pages.reduce( ([mdx,other], d) => {
        const fnPass = filterFn ? filterFn(d) : true;
        if( !isDir(d) && (d as Page).ext === ext && fnPass ){
            mdx = [...mdx,d]
        }  else {
            other = [...other,d];
        }
        return [mdx,other];
   },[[],[]]);
}
