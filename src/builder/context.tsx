import Path from 'path';
import React from 'react';
import Fs from 'fs-extra';

export const PageContext = React.createContext({})



export interface Dir {
    path: string;
    dstPath?: string;
    // relativePath: string;
    meta: PageMeta;

    // used during build to indicate this pages meta has been resolved
    isResolved: boolean;

    isEnabled: boolean;
    isRenderable: boolean;

    // an array of paths that this dir depends on
    requires: string[];
}

export interface Page extends Dir {
    ext: string;
    component?: any;
    code?: string;
    jsx?: string;
    ast?: any;
    content?: string;
    links?: PageLinks;

    
    // pageProps: Meta; // page config
}



export interface PageLink {
    url?: string;
    child: any;
}

export type PageLinks = Map<string, PageLink>;

export interface PageMeta {
    title?: string;

    description?: string;

    // created at date - otherwise sourced from file
    // date?: string;

    // path to render to
    // dstPath?: string;

    // layout file into which this page will be rendered
    layout?: string;

    // whether the page is enabled - it will be ignored if not
    // isEnabled?: boolean;

    /**
     * Things that can be rendered - html,mdx,css
     */
    // isRenderable?: boolean;

    // parent wont be folded into this
    resolveParent?: boolean;

    css?: string;
    // _inlineCSS?: string[];
    // cssLinks: string[];
}

type BuildContextStage = [Function, any[]];

export class BuildContext {
    _stages: BuildContextStage[] = [];
    rootPath: string;
    dstPath: string;
    pages: Dir[] = [];

    constructor(rootPath: string|BuildContext, dstPath?: string) {
        if( rootPath instanceof BuildContext ){
            this.rootPath = (rootPath as BuildContext).rootPath;
            this.dstPath = (rootPath as BuildContext).dstPath;
        } else {
            this.rootPath = rootPath;
            this.dstPath = dstPath;
        }
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



export function createDir(path: string, meta: PageMeta = createMeta(), extra: object = {}): Dir {
    return {
        meta,
        path,
        isResolved: false,
        isEnabled: true,
        isRenderable: false,
        requires: [],
        // relativePath,
        ...extra
    }
}

export function createPage(path: string, meta: PageMeta = createMeta(), extra: object = {}): Page {
    const page = createDir(path, meta, {
        ext: 'mdx',
        ...extra,
    }) as Page;

    page.isRenderable = ['mdx','html','css'].indexOf(page.ext) !== -1;
    
    return page;
}

export function createMeta(values: object = {}): PageMeta {
    return {
        // isEnabled: true,
        // isRenderable: true,
        ...values
    }
}

export function pageSrcPath(ctx: BuildContext, page:Dir):string {
    return Path.join(ctx.rootPath, page.path) +
        (('ext' in page) ? `.${page['ext']}` : '');
}

export function hasPage(ctx:BuildContext, pagePath:string):boolean {
    return getPage(ctx,pagePath) !== undefined;
}

export function getPage(ctx:BuildContext, pagePath:string):Dir {
    pagePath = removeExtension(pagePath);
    return ctx.pages.find( p => p.path === pagePath );
}

export async function findPagePath(ctx:BuildContext, pagePath:string): Promise<string> {
    let page = ctx.pages.find( p => p.path === pagePath );
    if( page !== undefined ){
        return pageSrcPath(ctx,page);
    }
    let path = Path.join(ctx.rootPath, pagePath);
    if( await Fs.pathExists(path) ){
        return path;
    }
    let extPath = path + '.mdx';
    if( await Fs.pathExists(extPath) ){
        return extPath;
    }
    return undefined;
}

export function pageDstPath(ctx: BuildContext, page:Dir):string {
    return page.dstPath !== undefined ? Path.join(ctx.dstPath, page.dstPath) : undefined;
}


export function dirPath(ctx: BuildContext, page: Dir) {
    let path = isDir(page) ? Path.join(ctx.dstPath, page.dstPath) : parentDir(ctx, page, true) + '/';
    return path;
}

export function isDir(dir: Dir) {
    return !('ext' in dir);
}


export function isMdxPage(page:Dir){
    return page !== undefined && ('ext' in page) && page['ext'] === 'mdx';
}

export function isPageRenderable(page:Dir){
    return !isDir(page) && page.dstPath !== undefined;// && page.meta.isRenderable;
}


export function parentDir(ctx: BuildContext, page: Dir, useDst: boolean = false) {
    // console.log('[parentDir]', page.isRenderable, page.dstPath);
    const fullPath = useDst ? Path.join(ctx.dstPath, page.dstPath) : Path.join(ctx.rootPath, page.path);
    const dir = Path.resolve(fullPath, '..');// dirnameExtra(fullPath);
    return dir;
}

export function getParent(ctx: BuildContext, dir: Dir) {
    if (dir === undefined) {
        return undefined;
    }
    const dirname = parentDir(ctx, dir);

    let result = ctx.pages.find(d => d.path === dirname);
    return result;
}


export function getPageLayout(ctx: BuildContext, page: Dir) {
    if (page === undefined) {
        return undefined;
    }
    if( page.meta.layout === undefined ){
        return undefined;
    }
    // console.log('[getPageLayout]', page.path, page.meta.layout, ctx.pages.map(p=>p.path))
    return ctx.pages.find(d => page.meta.layout === d.path);
}

export function getPageMeta(ctx: BuildContext, page: Dir): PageMeta {
    if (page === undefined) {
        return createMeta();
    }
    const parent = getParent(ctx, page);
    const pMeta = getPageMeta(ctx, parent);
    return { ...pMeta, ...page.meta };
}


export async function resolvePaths(ctx:BuildContext, paths:string[]): Promise<string[]> {
    let result = [];
    for( const path of paths ){
        if( await Fs.pathExists(path) ){
            result.push( Path.relative(ctx.rootPath, path) );
        } else {
            // console.log('[resolvePaths]', path);
            let fullPath = Path.join(ctx.rootPath, path);
            if( await Fs.pathExists(fullPath) ){
                result.push( Path.relative(ctx.rootPath, fullPath) );
            }
        }
    }

    return result;
}

export async function resolveRelativePath(basePath:string, path:string): Promise<string> {
    if( await Fs.pathExists(path) ){
        return path;
    }

    // console.log('[resolveRelativePath]', basePath, path );

    const dir = Path.resolve(basePath, '..');

    // console.log('[resolveRelativePath]', Path.resolve(dir, path) );

    return Path.resolve(dir, path);
}

export function removeExtension(path:string){
    return path.replace(/\.[^/.]+$/, "");
}
