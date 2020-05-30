import Path from 'path';
import React from 'react';

export const PageContext = React.createContext({})


export interface PageLink {
    url?: string;
    child: any;
}

export type PageLinks = Map<string, PageLink>;

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

export class BuildContext {
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




export function createDir(path: string, meta: PageMeta = createMeta(), extra: object = {}): Dir {
    return {
        meta,
        path,
        // relativePath,
        ...extra
    }
}

export function createPage(path: string, meta: PageMeta = createMeta(), extra: object = {}): Page {
    return {
        ext: 'mdx',
        meta,
        path,
        ...extra
    }
}

export function createMeta(values: object = {}): PageMeta {
    return {
        isEnabled: true,
        isRenderable: true,
        ...values
    }
}

export function pageSrcPath(ctx: BuildContext, page:Dir):string {
    return Path.join(ctx.rootPath, page.path) +
        (('ext' in page) ? `.${page['ext']}` : '');
}

export function pageDstPath(ctx: BuildContext, page:Dir):string {
    return Path.join(ctx.dstPath, page.dstPath);
}


export function dirPath(ctx: BuildContext, page: Dir) {
    let path = isDir(page) ? Path.join(ctx.dstPath, page.dstPath) : parentDir(ctx, page, true) + '/';
    return path;
}

export function isDir(dir: Dir) {
    return !('ext' in dir);
}


export function parentDir(ctx: BuildContext, page: Dir, useDst: boolean = false) {
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

export function getPageMeta(ctx: BuildContext, page: Dir): PageMeta {
    if (page === undefined) {
        return createMeta();
    }
    const parent = getParent(ctx, page);
    const pMeta = getPageMeta(ctx, parent);
    return { ...pMeta, ...page.meta };
}