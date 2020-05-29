import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import { transpile, PageLink, PageLinks } from './transpile';
import Beautify from 'js-beautify';
import Klaw from 'klaw';
import Yaml from 'yaml';

export interface PageMeta {
    title?: string;

    description?: string;

    // created at date - otherwise sourced from file
    date?: string;

    // path to render to
    dstPath?: string;

    // layout file into which this page will be rendered
    layout?: string;

    isEnabled: boolean;
    isRenderable: boolean;

    // parent wont be folded into this
    resolveParent?: boolean;
}

type BuildContextStage = [Function, any[]];

class BuildContext {
    _stages: BuildContextStage[] = [];
    rootPath: string;
    dstPath: string;
    pages: Dir[] = [];
    targetPage?: string;

    constructor(rootPath: string, dstPath: string, targetPage?: string) {
        this.rootPath = rootPath;
        this.dstPath = dstPath;
    }

    use(fn: Function, ...args: any[]) {
        // console.log('huh', this);
        this._stages.push([fn, args]);
        return this;
    }
    async process() {
        for (const [fn, args] of this._stages) {
            await fn(this, ...args);
        }
        return this;
    }
}


export interface Dir {
    path: string;
    dstPath?: string;
    // relativePath: string;
    meta: PageMeta;

}

export interface Page extends Dir {
    ext: string;
    component?: any;
    code?: string;
    jsx?: string;
    html?: string;
    links?: PageLinks;
    // pageProps: Meta; // page config
}





export async function processPages(rootPath: string, dstPath: string, targetPage?: string) {

    let ctx = new BuildContext(rootPath, dstPath);

    try {
        ctx
            .use(() => Fs.emptyDir(dstPath))
            .use(gatherPages)
            .use(parsePages)
            .use(resolveMeta)
            .use(resolveDest)
            // .use(debug)
            .use(resolveLinks)
            .use(renderPages)
            .use(writePages, { writeCode: false, writeJSX: false })
            .process()
    } catch (err) {
        console.error('[processPages]', 'error', err);
    }

    // console.log(ctx);
    function debug(ctx: BuildContext) {
        console.log('> pages');
        for (const page of ctx.pages) {
            let { code, jsx, meta, ...rest } = page as any;
            meta = getPageMeta(ctx, page);
            console.dir({
                meta,
                code: truncate(code),
                jsx: truncate(jsx),
                ...rest
            });
        }
        return ctx;
    }
    // .then(resolveLayouts)
}



async function resolveDest(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    for (const page of ctx.pages) {
        const isRenderable = page.meta.isRenderable ?? false;
        const isEnabled = page.meta.isEnabled ?? true;
        if (!isRenderable || !isEnabled) {
            pages.push(page);
            continue;
        }
        let path = page.meta.dstPath ?? page.path;
        if (path.endsWith('/')) {
            path = Path.join(path, Path.basename(page.path));
        }
        // console.log('[resolveDest]', page.path, path );

        let dstPath = path + (isDir(page) ? '' : '.html');

        pages.push({ ...page, dstPath });
    }
    ctx.pages = pages;
    return ctx;
}

async function resolveLinks(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    for (const page of ctx.pages) {
        if (isDir(page) || (page as Page).ext !== 'mdx' ) {
            pages.push(page);
            continue;
        }
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
                let rel = Path.relative(dirPath(ctx, page), fullPath(ctx, linkPage, true));
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
    ctx.pages = pages;
    return ctx;
}

interface WritePagesOptions {
    writeCode?: boolean;
    writeJSX?: boolean;
    writeHTML?: boolean;
}

async function writePages(ctx: BuildContext, options: WritePagesOptions = {}): Promise<BuildContext> {
    // console.log('[writePages]', options);
    const doWriteHTML = options.writeHTML ?? true;
    const doWriteCode = options.writeCode ?? false;
    const doWriteJSX = options.writeJSX ?? false;
    for (const page of ctx.pages) {
        if (isDir(page)) {
            continue;
        }
        const {dstPath, ext} = page as Page;

        if( ext === 'mdx' ){
            const { code, jsx, html } = (page as Page);
            if (html === undefined) {
                continue;
            }

            const outPath = Path.join(ctx.dstPath, dstPath);

            if (doWriteHTML) await writeHTML(outPath, html);
            if (doWriteCode) await writeFile(outPath + '.code', code);
            if (doWriteJSX) await writeFile(outPath + '.jsx', jsx);
        }
        else {
            const src = Path.join(ctx.rootPath, page.path + `.${ext}`);
            const dst = Path.join(ctx.dstPath,dstPath);
            await Fs.copyFile( src, dst );
        }
    }
    return ctx;
}

async function renderPages(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];

    for (const page of ctx.pages) {
        if (isDir(page) || (page as Page).ext !== 'mdx') {
            pages.push(page);
            continue;
        }
        pages.push(await renderPage(ctx, (page as Page)));
    }
    ctx.pages = pages;
    return ctx;
}

async function renderPage(ctx: BuildContext, page: Page): Promise<Page> {
    const isRenderable = page.meta.isRenderable ?? false;
    const isEnabled = page.meta.isEnabled ?? true;
    if (!isEnabled || !isRenderable) {
        return page;
    }

    let { meta, links } = page;
    let path = fullPath(ctx, page);

    try {
        // const unpick = ({code,component,html,jsx}:any) => ({code,component,html,jsx});
        let result = await transpile({ path, links, meta }, { forceRender: true });

        const layoutPage = getPageLayout(ctx, page);

        if (layoutPage === undefined) {
            return {
                ...page,
                code: result.code,
                component: result.component,
                html: result.html,
                jsx: result.jsx
            };
        }

        // render the page into the layout page
        path = fullPath(ctx, layoutPage);

        result = await transpile({ path, meta, children: result.component }, { forceRender: true });

        return {
            ...page,
            code: result.code,
            component: result.component,
            html: result.html,
            jsx: result.jsx
        };

    } catch (err) {
        console.error('[renderPage]', err);
        console.log('[renderPage]', (page as any).jsx);// (layoutPage as any).jsx);
        return page;
    }

}



async function parsePages(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];
    for (const page of ctx.pages) {
        if (isDir(page) || (page as Page).ext !== 'mdx') {
            pages.push(page);
            continue;
        }

        const path = fullPath(ctx, page);
        let { meta } = page;

        let { meta: outMeta, links } = await transpile({ meta, path });

        // console.log('[parsePages]', 'links', links );
        meta = { ...page.meta, ...outMeta };
        let upd: any = { ...page, meta };
        if (links !== undefined && links.size > 0) {
            upd = { ...upd, links };
        }

        pages.push(upd);
    }
    ctx.pages = pages;
    return ctx;
}


async function resolveMeta(ctx: BuildContext): Promise<BuildContext> {
    let pages = [];

    // first pass, resolve own meta
    for (const page of ctx.pages) {
        let { meta } = page;
        if (isDir(page) || (page as Page).ext !== 'mdx') {
            pages.push(page);
            continue;
        }
        // console.log('[resolveMeta]', page);
        const path = fullPath(ctx, page);

        // just interested in meta
        let { meta: outMeta } = await transpile({ meta, path });

        meta = { ...meta, ...outMeta };
        pages.push({ ...page, meta });
    }

    ctx.pages = pages;
    pages = [];

    // resolve pages
    for (const page of ctx.pages) {
        if (isDir(page)) {
            pages.push(page);
            continue;
        }
        let { meta } = page;
        const path = fullPath(ctx, page);

        // resolve against dir meta
        meta = getDirMeta(ctx, page.path, meta);

        // first, layout
        const layout = getPageLayout(ctx, page);

        if (layout !== undefined) {
            meta = { ...layout.meta, ...meta };
        }

        let { meta: outMeta, jsx } = await transpile({ meta, path });

        meta = { ...meta, ...outMeta };
        pages.push({ ...page, meta });
    }

    ctx.pages = pages;
    return ctx;
}

function getDirMeta(ctx: BuildContext, path: string, meta: PageMeta = createMeta()) {
    let page = ctx.pages.find(d => d.path === path);

    if (page !== undefined) {
        meta = { ...page.meta, ...meta };
    }

    // console.log('[getDirMeta]', path, meta);
    if (path === '' || meta.resolveParent === false) {
        return meta;
    }

    const parent = parentPath(path);
    // console.log('[getDirMeta]', 'parent', parent );

    return getDirMeta(ctx, parent, meta);
}

function parentPath(path: string) {
    return path.split(Path.sep).slice(0, -1).join(Path.sep);
}

async function gatherPages(ctx: BuildContext): Promise<BuildContext> {

    let pages = [];

    if (!Fs.existsSync(ctx.rootPath)) {
        return ctx;
    }

    let rootPath = ctx.targetPage ? Path.join(ctx.rootPath, ctx.targetPage) : ctx.rootPath;

    let stats = Fs.statSync(rootPath);

    const validExtensions = ['mdx', 'html', 'css'];

    // if we have a single file
    if (stats.isFile()) {
        const ext = Path.extname(rootPath).substring(1);
        if (validExtensions.indexOf(ext) === -1) {
            return ctx;
        }

        const { ctime, mtime } = stats;
        let relativePath = Path.relative(ctx.rootPath, rootPath);

        ctx.pages = [
            createPage(relativePath, createMeta(), { ctime, mtime })
        ];
        return ctx;
    }

    for await (const file of Klaw(rootPath)) {
        let relativePath = Path.relative(ctx.rootPath, file.path);

        const { ctime, mtime } = file.stats;
        if (file.stats.isDirectory()) {
            let meta = await readDirConfig(file.path);
            if (meta !== undefined) {
                pages.push(createDir(relativePath, meta, { ctime, mtime }));
            }
            // console.log('[gatherPages]', file.path, meta);
            continue;
        }

        const ext = Path.extname(file.path).substring(1);
        // console.log('[gatherPages]', file.path, ext);
        if (validExtensions.indexOf(ext) === -1) {
            continue;
        }
        // if (Path.extname(file.path) !== '.mdx') {
        //     continue;
        // }

        relativePath = relativePath.replace(/\.[^/.]+$/, "");

        pages.push(createPage(relativePath, createMeta(), { ext, ctime, mtime }));
    }

    ctx.pages = pages;
    return ctx;
}


async function writeFile(path: string, content: string) {
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}

async function writeHTML(path: string, html: string) {
    writeFile(path, Beautify.html(html));
}

async function readDirConfig(path: string): Promise<PageMeta> {
    let metaPath = Path.join(path, 'meta.yaml');
    if (await Fs.existsSync(metaPath) === false) {
        return undefined; //createMeta({isRenderable:false});
    }
    let content = await Fs.readFile(metaPath, 'utf8');
    let meta = Yaml.parse(content) as PageMeta;
    return { ...meta, isRenderable: false };
}


function createDir(path: string, meta: PageMeta = createMeta(), extra: object = {}): Dir {
    return {
        meta,
        path,
        // relativePath,
        ...extra
    }
}

function createPage(path: string, meta: PageMeta = createMeta(), extra: object = {}): Page {
    return {
        ext: 'mdx',
        meta,
        path,
        ...extra
    }
}

function createMeta(values: object = {}): PageMeta {
    return {
        isEnabled: true,
        isRenderable: true,
        ...values
    }
}

function fullPath(ctx: BuildContext, page: Dir, useDst: boolean = false) {
    if (useDst) {
        return Path.join(ctx.dstPath, page.dstPath);
    }
    return Path.join(ctx.rootPath, page.path) +
        (('ext' in page) ? `.${page['ext']}` : '');
}

function dirPath(ctx: BuildContext, page: Dir) {
    let path = isDir(page) ? Path.join(ctx.dstPath, page.dstPath) : parentDir(ctx, page, true) + '/';
    return path;
}

function isDir(dir: Dir) {
    return !('ext' in dir);
}


function truncate(str: string, len = 10) {
    return str === undefined ? '' : str.length <= len ? str : str.slice(0, len) + '...';
}

function parentDir(ctx: BuildContext, page: Dir, useDst: boolean = false) {
    const fullPath = useDst ? Path.join(ctx.dstPath, page.dstPath) : Path.join(ctx.rootPath, page.path);
    const dir = Path.resolve(fullPath, '..');// dirnameExtra(fullPath);
    return dir;
}

function getParent(ctx: BuildContext, dir: Dir) {
    if (dir === undefined) {
        return undefined;
    }
    const dirname = parentDir(ctx, dir);

    let result = ctx.pages.find(d => d.path === dirname);
    return result;
}


function getPageLayout(ctx: BuildContext, page: Dir) {
    if (page === undefined) {
        return undefined;
    }
    if (page.meta === undefined || !('layout' in page.meta)) {
        const parent = getParent(ctx, page);
        return getPageLayout(ctx, parent);
    }
    const dir = parentDir(ctx, page);
    const layoutPath = Path.join(dir, page.meta.layout);
    const result = ctx.pages.find(d => {
        return Path.join(ctx.rootPath, d.path) === layoutPath
    });
    return result;
}

function getPageMeta(ctx: BuildContext, page: Dir): PageMeta {
    if (page === undefined) {
        return createMeta();
    }
    const parent = getParent(ctx, page);
    const pMeta = getPageMeta(ctx, parent);
    return { ...pMeta, ...page.meta };
}