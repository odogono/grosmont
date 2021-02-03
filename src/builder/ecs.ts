import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Util from 'util';

import GlobCb from 'glob';
const Glob = Util.promisify( GlobCb );

import Yaml from 'yaml';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';

import Beautify from 'js-beautify';

import {
    BuildContext, removeExtension, PageMeta,
    resolvePaths,
    PageLinks,
    splitPathExtension,
    PageLink
} from './context';
import { readDirMeta } from '.';
import { defs } from './defs';

// import {
//     // EntitySetMem, EntitySet, Entity
// } from 'odgn-entity/dist/cjs/index';

import {
    Entity, EntityId, isEntity
} from 'odgn-entity/src/entity';

import {
    EntitySetMem, EntitySet, EntitySetOptions
} from 'odgn-entity/src/entity_set';
import {
    EntitySetSQL
} from 'odgn-entity/src/entity_set_sql';


import { TranspileOptions, transpile } from './transpile';
import { getComponentEntityId, Component, toComponentId, getComponentDefId } from 'odgn-entity/src/component';
import { isEmpty } from 'odgn-entity/src/util/is';
import { TYPE_OR, BitField, get as bfGet } from 'odgn-entity/src/util/bitfield';
import { slugify } from '../util/string';
import { parseUri } from '../util/uri';

interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}


export class SiteContext extends BuildContext {
    es: EntitySetMem;
    persistentEs: EntitySetSQL;

    inactivePaths: string[] = [];

    validExtensions: string[] = ['mdx', 'jsx', 'tsx', 'html', 'css'];

    renderableExtensions: string[] = ['mdx', 'html', 'css'];

    depends: string[] = [];

    constructor(rootPath: string | SiteContext, dstPath?: string) {
        super(rootPath, dstPath);

        this.es = new EntitySetMem();
        const path = Path.join(dstPath,'cms.sqlite');
        console.log('[SiteContext]', 'persistent es', path);
        this.persistentEs = new EntitySetSQL({ path, uuid:'CMS-A' });
    }

    async init() {
        for (const def of defs) {
            await this.es.register(def);
        }
    }

    filePath(uri:string){
        if( !uri.startsWith('file:') ){
            return undefined;
        }
        const path = uri.substring( 'file:/'.length );
        return Path.join( this.rootPath , path );
    }

    pageSrcPath(page: Entity): string {
        if( page.File === undefined ){
            return undefined;
        }
        const { path, ext } = page.File ?? {};
        return Path.join(this.rootPath, path) + `.${ext}`;
    }

    pageDstPath(e: Entity|EntityId, asAbsolute:boolean = true ): string {
        let page:Entity;
        if( isEntity(e) ){
            page = e as Entity;
        } else {
            page = this.es.getEntityMem(e as EntityId, true);
        }

        let filename = '';
        let path = '';
        let ext = '';

        // derive initial filename and path from src
        const uri = page.Source?.uri;
        if( uri !== undefined ){
            const {file,directory} = parseUri(uri);
            filename = file; path = directory;
        }

        const meta = getPageMeta(this,page);

        filename = meta.filename ?? filename;

        if( meta.title !== undefined ){
            filename = slugify(meta.title);
        }

        path = meta.dst ?? meta.dstPath ?? path;
        
        ext = Path.extname(filename);
        
        if( page.Mdx ){
            ext = 'html';
        } else if( page.Css ){
            ext = 'css';
        }

        filename = removeExtension(filename) + '.' + ext;

        return asAbsolute ?
            Path.join( this.dstPath, path, filename )
            : Path.join(path,filename);
    }

    isPathDisabled(relativePath: string) {
        return this.inactivePaths.find(p => relativePath.startsWith(p));
    }

    addDependencies(page: Entity, dependencies: string[]) {
        dependencies = dependencies.map(path => {
            let relPath = Path.isAbsolute(path) ? Path.relative(this.rootPath, path) : path;
            return relPath;
        });
        this.depends = [...new Set([...this.depends, ...dependencies])];
    }

    createPageEntity():Entity {
        let page = this.es.createEntity();
        page.Renderable = {};
        page.Enabled = {};
        return page;
    }

    createMdxEntity():Entity {
        let page = this.createPageEntity();
        page.Mdx = {};
        return page;
    }
    createCssEntity():Entity {
        let page = this.createPageEntity();
        page.Css = {};
        return page;
    }

    async add(entitiesOrComponents: any) {
        await this.es.add(entitiesOrComponents);
    }

    getAdded(): EntityId[] {
        return Array.from( this.es.entChanges.added );
        // log('[add]', this.es.entChanges.added );
    }

    async processPages( targetPath?:string ):Promise<SiteContext> {
        
        await gatherPages(this, targetPath);

        await applyStat(this);
        
        await resolveMeta(this, targetPath);

        await resolveDependencies(this);
        
        await resolvePageLinks(this);
        
        await resolveLayout(this);
        
        await resolveDest(this);
        
        await processCSS(this);
        
        // await resolveCssLinks(this);
        
        await resolveLinks(this);
        
        await renderPages(this);

        await writePages(this, { beautify: true, writeCode: false, writeJSX: false })

        return this;
    }
}

/**
 * Reads through the src directory and gathers information about the files and dirs
 * found
 * 
 * @param ctx 
 */
export async function gatherPages(ctx: SiteContext, targetPath: string): Promise<SiteContext> {

    let files: Entity[] = [];

    if (!await Fs.pathExists(ctx.rootPath)) {
        return ctx;
    }

    if( targetPath === undefined ){
        return ctx;
    }

    const { es } = ctx;

    // console.log('[gatherPages]', {targetPath}, ctx.pages.map(p=>p.path) );
    // console.log('ctx pages', );

    if( targetPath.startsWith('file:') ){
        targetPath = targetPath.substring( 'file:/'.length );
    }

    let rootPath = targetPath !== undefined ? Path.join(ctx.rootPath, targetPath) : ctx.rootPath;

    log('[gatherPages]', targetPath, rootPath);

    rootPath = await checkPagePath(ctx, rootPath);


    if (rootPath === undefined) {
        console.log('[gatherPages]', 'page not found', rootPath);
        return ctx;
    }

    let stats = await Fs.stat(rootPath);

    // const validExtensions = ['mdx', 'jsx', 'tsx', 'html', 'css'];

    // console.log('[gatherPages]', 'root', rootPath);


    // let relativePath = Path.relative(ctx.rootPath, rootPath);

    // if we have a single file
    // first read dir meta for all the containing dirs
    if (stats.isFile()) {
        let path = rootPath;
        let relativePath = Path.relative(ctx.rootPath, path);

        let dirEntities = await createParentDirEntities(ctx, path);
        await ctx.add(dirEntities);
        let eids = ctx.getAdded();
        
        // log('[gatherPages]', relativePath, 'added', dirEntities.length, 'dir entities', eids );

        let isEnabled = !ctx.isPathDisabled(relativePath);
        // if (ctx.isPathDisabled(relativePath)) {
        //     console.log('[gatherPages]', relativePath, 'disabled');
        //     return ctx;
        // }

        let e = createFileEntity(ctx, relativePath, stats, { isEnabled });
        if (e !== undefined) {
            // log('[gatherPages]', 'set meta deps', eids);
            let meta = e.Meta || {};
            meta.eids = eids;
            e.Meta = meta;
            await ctx.add(e);
        }

        // console.log('[gatherPages]', 'post', { targetPath }, ctx.pages.map(p => p.path));
        return ctx;
    }

    // let inactivePaths = [];

    for await (const file of Klaw(rootPath)) {
        let relativePath = Path.relative(ctx.rootPath, file.path);

        if (ctx.isPathDisabled(relativePath)) {
            continue;
        }

        let e: Entity;

        // const { ctime, mtime } = file.stats;
        if (file.stats.isDirectory()) {
            e = await createDirEntity(ctx, relativePath, file.stats);
        } else {
            e = createFileEntity(ctx, relativePath, stats);
        }

        if (e !== undefined) {
            files.push(e);
        }
    }

    await ctx.add(files);

    return ctx;
}



async function gatherPath( ctx:SiteContext, path:string )  {
    if( path.startsWith('file:') ){
        path = path.substring( 'file:/'.length );
    }

    // does the path exist as is?

    
    const absPath = Path.join( ctx.rootPath, path );
    const matches = await Glob(`${absPath}*`);

    log('[gatherPath]', absPath, matches );


    // scan this path
    // Fs.readdir( )

}


/**
 * Applies the created and modified time to source entities
 * @param ctx 
 */
export async function applyStat(ctx:SiteContext): Promise<SiteContext> {
    const pages = selectSource(ctx);
    let apply:Entity[] = [];
    for( const page of pages ){
        if( page.Times === undefined ){
            page.Times = { ctime:Date.now(), mtime:Date.now() };
            apply.push(page);
        }
    }
    await ctx.add( apply );
    
    return ctx;
}

/**
 * Parses pages of their meta data and links by doing a transpile on
 * the page source. Then resolves against directory meta. 
 * 
 * @param ctx 
 */
export async function resolveMeta(ctx: SiteContext, path?: string): Promise<SiteContext> {

    let pages;
    // select page entities - have an extension
    if (path) {
        pages = [selectPageByPath(ctx, path)].filter(Boolean);
    } else {
        // pages = await selectPages(ctx);
        pages = selectSource(ctx);
    }

    if (pages.length === 0) {
        log('[resolveMeta]', 'no pages', path);
        
        // printAll(ctx,pages);
        printAll(ctx.es);
        throw new Error('stop');
        return ctx;
    }

    // console.log('[resolveMeta]', pages.map(e => e) );

    // let pagesMeta = [];
    // for (const page of pages) {
    //     if( page.File === undefined ){ continue; }
    //     const { path } = page.File;
    //     log('getting dir meta for', path );
    //     let dirMeta = getDirMeta(ctx, path);
    //     page.Meta = { meta: { ...dirMeta, ...page.Meta?.meta } };
    //     log('updated', page.id, page.Meta);
    //     pagesMeta.push(page.Meta);
    // }

    // // log('[resolveMeta]', 'pagesMeta', pagesMeta.map(e => e) );

    // await ctx.add(pagesMeta);



    // non MDX pages initial target resolution
    // const css = pages.filter(p => p.File?.ext !== 'mdx');

    // log('[resolveMeta]', 'css', css );

    // for (let page of css) {
    //     let meta = page.Meta?.meta ?? {};
    //     // console.log('ok go', meta);
    //     [page, meta] = applyTarget(ctx, page, meta);
    //     page.Meta = { meta };
    // }
    // await ctx.add(css);


    // for (const page of pages) {
    //     console.log('[resolveMeta]', page.File.path, page.Meta.meta);
    // }

    // transpile any mdx pages
    // pages = pages.filter(p => p.File?.ext === 'mdx');
    const mdx = selectMdxPages(ctx);

    for (const page of mdx) {
        // log('transpiling');
        // printEntity(ctx,page);
        await transpileWith(ctx, page);
    }
    // console.log('updating', pages.length, 'pages', ctx.es.entChanges );
    // console.log('updating', pagesMeta );

    // console.log(ctx.es);
    return ctx;
}


/**
 * 
 * @param ctx 
 */
export async function resolveDependencies(ctx: SiteContext): Promise<SiteContext> {
    let resolved = false;
    let count = 0;

    while (!resolved) {
        let deps = [];

        // log('[resolveDependencies]', ctx.depends );

        // remove dependencies that we already have
        for( const dep of ctx.depends ){
            if( selectSourceByPath(ctx, dep, false) === undefined ){
                // log('[resolveDependencies]', 'missing', dep);
                deps.push( dep );
            }
        }

        for( const dep of deps ){
            log('[resolveDependencies]', dep);
            await gatherPages(ctx,dep);
            await resolveMeta(ctx,dep);
        }

        // resolve any CssLink.paths
        resolveCssLinks(ctx);

        resolved = deps.length === 0;

        if( (++count) > 10 ){
            throw new Error('[resolveDependencies] out of bounds');
        }

        // // first ensure each of the deps is resolved to an actual file
        // deps = (await Promise.all(ctx.depends.map(
        //     async (dep) => {
        //         let absPath = Path.join(ctx.rootPath, dep);
        //         absPath = await checkPagePath(ctx, absPath);
        //         return absPath !== undefined ? Path.relative(ctx.rootPath, absPath) : undefined;
        //     }
        // ))).filter(Boolean);

        // // only interested in pages we haven't seen yet
        // deps = deps.map(
        //     dep => selectPageByPath(ctx, dep) === undefined ? dep : undefined
        // ).filter(Boolean);

        // // console.log('[resolveDependencies]', 'b', deps );

        // for (const dep of deps) {
        //     // console.log('[resolveDependencies]', 'dep', dep);
        //     await gatherPages(ctx, dep);
        //     // console.log('[resolveDependencies]', 'dep meta', dep);
        //     await resolveMeta(ctx, dep);
        // }

        // resolved = deps.length === 0;

        // console.log('[resolveDependencies]', 'done', deps );
    }

    ctx.depends = [];

    return ctx;
}

export async function resolveLayout(ctx: SiteContext): Promise<SiteContext> {
    // at this point there should be a complete record of all files
    // so resolve page layouts
    const layoutComs = selectLayout(ctx);
    let coms = [];
    let remove = [];
    for (const com of layoutComs) {
        let { path, e } = com;
        if (e === undefined) {
            const eid = selectEntityIdByPath(ctx, path, { ext: 'mdx' });
            if (eid !== undefined) {
                coms.push({ ...com, e: eid });
            } else {
                console.log('[resolveLayout]', 'could not find', path);
                // if we cant find the layout from its path, then remove it
                remove.push(com);
            }
        }
    }
    await ctx.add(coms);
    await ctx.es.removeComponents(remove);

    return ctx;
}

/**
 * Checks Link entities to pages, and resolve their url, indicate whether they are active
 * @param ctx 
 */
export async function resolvePageLinks(ctx: SiteContext): Promise<SiteContext> {
    const { es } = ctx;
    let links = selectLinks(ctx);
    const enabledDid = es.resolveComponentDefIds('/component/enabled');

    let out = [];
    for (const e of links) {
        const link = e.PageLink;
        if (link.type === 'ext') {
            e.Enabled = {};
            // console.log('[resolvePageLinks]', 'ext', link);
        } else {

            // let absPath = Path.join(ctx.rootPath, link.url || link.page_url);
            // absPath = await checkPagePath(ctx, absPath);

            // console.log('[resolvePageLinks]', absPath, link);
            const linkE = selectPageByPath(ctx, link.url );
            // log('[resolvePageLinks]', link.url, linkE );

            if (linkE !== undefined) {
                e.PageLink = { ...link, e: linkE.id };
                if (linkE.hasComponents(enabledDid)) {
                    e.Enabled = {};
                }
            }
            // console.log('[resolvePageLinks]', e.id, e.PageLink );

        }

        out.push(e);
    }

    // update the link entities
    await ctx.add(out);

    return ctx;
}


export async function resolveDest(ctx: SiteContext): Promise<SiteContext> {

    const pages = selectRenderable(ctx);

    for (const page of pages) {
        const target = page.Target ?? {};

        // console.log('[resolveDest]', page.Target );
        if( target.filename !== undefined ){
            continue;
        }

        let path = target.path ?? page.File?.path;
        if( path !== undefined ){
            if (path.endsWith(Path.sep)) {
                path = Path.join(path, Path.basename(page.File.path));
            }
            let ext = page.File.ext;
            if (ext) {
                ext = ext === 'mdx' ? 'html' : ext;
            }

            if (!isEmpty(ext)) {
                page.Target = { ...target, path: path + '.' + ext };
            }
        }
    }

    await ctx.add(pages);



    return ctx;
}


export async function processCSS(ctx: SiteContext): Promise<SiteContext> {
    const pages = selectCSS(ctx);

    for (const page of pages) {
        const minify = page.Target.minify ?? true;
        const from = ctx.pageSrcPath(page);
        const to = ctx.pageDstPath(page) ?? from;// pageDstPath(ctx, page) || from;

        let css = page.Source?.data;
        if( from !== undefined ){
            css = await Fs.readFile(from, 'utf8');
        }

        // const css = await Fs.readFile(from, 'utf8');

        const plugins = [
            PreCSS,
            GridKISS,
            minify ? CSSNano : undefined
        ].filter(Boolean);

        let args = { from, to };
        const { css: content } = await PostCSS(plugins).process(css, args);

        // console.log('content', content);
        // throw 'stop';

        page.Target = { ...page.Target, content };
    }

    await ctx.add(pages);

    // console.log('[processCSS]');
    // printAll(ctx, pages);

    return ctx;
}

/**
 * Convert /component/css_links from paths to eids
 * @param ctx 
 */
export async function resolveCssLinks(ctx: SiteContext): Promise<SiteContext> {
    let links = selectCssLinks(ctx);

    if( links === undefined ){
        return ctx;
    }

    // console.log('[resolveCssLinks]');
    // console.log( links );
    links = links.map(com => {
        const { paths, ...rest } = com;
        const eids = paths?.map(p => selectEntityIdByPath(ctx, p, { ext: 'css' })).filter(Boolean) ?? [];
        return { ...rest, eids };
    });
    // console.log(links);

    await ctx.add(links);
    // printAll(ctx, pages);

    return ctx;
}

/**
 * 
 * @param ctx 
 */
export async function resolveLinks(ctx: SiteContext): Promise<SiteContext> {
    const pages = selectMdxPages(ctx);

    // console.log('[resolveLinks]');
    // printAll(ctx, pages);

    return ctx;
}

export async function renderPages(ctx: SiteContext): Promise<SiteContext> {
    const pages = selectMdxPages(ctx);

    // console.log('[renderPages]');
    // printAll(ctx, pages);
    let coms = [];

    for (const page of pages) {
        // retrieve page links
        let path = ctx.pageSrcPath(page);
        let links = getPageLinks(ctx, page);
        let inCss = getPageCss(ctx, page);
        let meta = getPageMeta(ctx, page, { debug: true });
        const data = page.Source?.data;

        // console.log('[renderPage]', path, inCss);
        // printAll(ctx);
        let result = await transpile({ path, data, links, meta, ...inCss }, { forceRender: true });
        let { code, component, jsx, html: content } = result;

        let mdx = {...page.Mdx };
        if( mdx.writeJS ){
            mdx.code = code;
        }
        if( mdx.writeJSX ){
            mdx.jsx = jsx;
        }

        page.Mdx = mdx; //{ ...page.Mdx, code, component, jsx };
        page.Target = { ...page.Target, content };

        if (page.Layout !== undefined) {
            const layoutPage = ctx.es.getEntityMem(page.Layout.e);
            const layoutCss = getPageCss(ctx, layoutPage, inCss);
            const layoutMeta = getPageMeta(ctx, layoutPage);

            // console.log('[renderPages]', 'layout', page.Layout.path, layoutCss );

            path = ctx.pageSrcPath(layoutPage);
            let layoutResult = await transpile({
                path,
                meta: { ...layoutMeta, ...meta },
                ...layoutCss,
                children: result.component
            }, { forceRender: true });

            page.Mdx = { ...page.Mdx, component: layoutResult.component };
            page.Target = { ...page.Target, content: layoutResult.html };
        }
        coms = coms.concat([page.Mdx, page.Target]);
    }

    await ctx.add(coms);

    return ctx;
}

interface WriteHTMLOptions {
    beautify?: boolean;
}

interface WritePagesOptions extends WriteHTMLOptions {
    writeCode?: boolean;
    writeJSX?: boolean;
    writeHTML?: boolean;
}

export async function writePages(ctx: SiteContext, options: WritePagesOptions = {}): Promise<SiteContext> {
    let doWriteHTML = options.writeHTML ?? true;
    let doWriteCode = options.writeCode ?? false;
    let doWriteJSX = options.writeJSX ?? false;
    let doWriteAST = false;

    const ents = selectTarget(ctx);

    for (const e of ents) {
        const path = ctx.pageDstPath(e);
        let content = e.Target.content ?? e.Source?.data;

        
        
        if (e.Mdx) {
            // log('[writePages]', path, e.Source.uri, content );
            await writeHTML(path, content, options);
            let writeJS = e.Mdx.writeJS ?? doWriteCode;
            if (writeJS) await writeFile(path + '.js', e.Mdx.code);
        }
        else if (e.Static) {
            const src = ctx.pageSrcPath(e);
            const dst = ctx.pageDstPath(e);
            await Fs.ensureDir(Path.dirname(dst));
            await Fs.copyFile(src, dst);
        }
        else {
            await writeFile(path, content);
        }
    }

    return ctx;
}

async function writeFile(path: string, content: string) {
    if (content === undefined) {
        throw new Error(`${path} content is undefined`);
    }
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}

async function writeHTML(path: string, html: string, options: WriteHTMLOptions = {}) {
    html = (options.beautify ?? false) ? Beautify.html(html) : html;
    await writeFile(path, html);
}


export function getPageMeta(ctx: SiteContext, page: Entity, options: { debug?: boolean } = {}) {
    const debug = options.debug ?? false;

    let meta: any = {};

    const {es} = ctx;
    const refs = page.Meta?.eids || [];
    const did = es.resolveComponentDefId('/component/meta');

    for( let ii=refs.length-1; ii >= 0; ii-- ){
        const eid = refs[ii];
        const com = es.getComponentMem( toComponentId(eid,did) );
        if( com !== undefined ){
            meta = {...meta, ...com['meta']};
        }
    }

    
    if (page.Meta !== undefined) {
        meta = { ...meta, ...page.Meta.meta };
    }
    if (page.Title !== undefined) {
        const {title,description} = page.Title;
        meta = { ...meta, title,description };
    }

    return meta;
}

function getPageCss(ctx: SiteContext, page: Entity, { css, cssLinks }: { css?: string, cssLinks?: string[] } = {}) {
    let result: any = {};
    css = css ?? '';
    cssLinks = cssLinks ?? [];

    if (page.CssLinks !== undefined) {
        const { es } = ctx;
        const eids:EntityId[] = page.CssLinks.eids;

        if( eids === undefined ){
            return result;
        }

        // get target components which contain the css code
        const did = es.resolveComponentDefId('/component/target');
        let coms = eids.map(eid => es.getComponentMem(toComponentId(eid, did))).filter(Boolean);
        
        result.css = css + coms.map(c => c['content']).join(' ');

        const pagePath = ctx.pageDstPath(page);
        result.cssLinks = eids.map( eid => {
            // const css = es.getEntityMem(eid,true);
            const cssPath = ctx.pageDstPath(eid, true);
            // log('[getPageCss]', 'link to', Path.relative(Path.dirname(pagePath), cssPath) );
            return Path.relative( Path.dirname(pagePath), cssPath);
        });
        
        
        // log('[getPageCss]', 'umm', result);
        // result.cssLinks = [...cssLinks, ...coms.map(c => c['path'])];
        // if( debug ) console.log('[getPageMeta]', coms );
    }
    return result;
}

function getPageLinks(ctx: SiteContext, page: Entity) {
    const links = selectLinks(ctx, page);
    let result = new Map<string, PageLink>();
    const {es} = ctx;
    // log('[toPageLinks]', links);
    for (const link of links) {
        const { url, page_url, e, text } = link.PageLink;
        // let pageUrl = url;
        const linkPage = es.getEntityMem(e, true);
        if (linkPage) {
            // page_url = linkPage.Target.path
            // console.log('[toPageLinks]', url, page_url );
        }

        result.set(page_url, { child: text, url });
    }
    return result;
}

async function transpileWith(ctx: SiteContext, page: Entity, options?: TranspileOptions): Promise<SiteContext> {

    let path = ctx.pageSrcPath(page);
    let inLinks = getPageLinks(ctx, page);
    let inCss = getPageCss(ctx, page);
    let inMeta = getPageMeta(ctx, page);
    const data = page.Source?.data;
    
    // console.log('[transpileWith]', page.File.path, page.Meta.meta, inMeta );
    // console.log('[transpileWith]', props );
    // log('[transpileWith]', page.Source.uri, inCss );
    
    const props = { path, data, meta: inMeta, links: inLinks, ...inCss };
    
    let { path:absPath, meta, links, additional, requires, cssLinks } = await transpile(props, options);
    
    
    requires = requires.map( r => {
        let path = Path.isAbsolute(r) ? Path.relative(ctx.rootPath,r) : r;
        return 'file:/' + path;
    })
    // log('[transpileWith]', requires );
    // note the required files, so that they will be resolved after
    ctx.addDependencies(page, requires);

    [page, meta] = applyTitle(ctx, page, meta);
    [page, meta] = await applyLayout(ctx, page, meta);
    [page, meta] = await applyTags(ctx, page, meta);
    page = await applyCSSLinks(ctx, page, cssLinks);
    page = await applyLinks(ctx, page, links);
    [page, meta] = applyTarget(ctx, page, meta);
    
    page.Meta = {...page.Meta, meta};
    // printEntity(ctx,page);
    // console.log('---');

    await ctx.add(page);

    return ctx;
}



/**
 * Applies Title and Description from page meta to the page entity
 * 
 * @param ctx 
 * @param page 
 * @param data 
 */
function applyTitle(ctx: SiteContext, page: Entity, data: PageMeta = {}): [Entity, PageMeta] {
    let { title, description, ...rest } = data;
    let com: any = {};
    if (title !== undefined) {
        com.title = title;
    }
    if (description !== undefined) {
        com.description = description;
    }
    if (Object.keys(com).length > 0) {
        page.Title = com;
    }
    // console.log('[applyTitle]', page.Title );

    return [page, rest];
}

async function applyLayout(ctx: SiteContext, page: Entity, data: PageMeta = {}): Promise<[Entity, PageMeta]> {
    const { layout, ...rest } = data;

    // console.log('[applyLayout]', page.File.path, data );

    if (layout !== undefined) {
        let resPath = await findPagePath(ctx, page, layout, 'mdx');

        // console.log('[applyLayout]', 'found', layout, resPath);

        const layoutPage = selectPageByPath(ctx, resPath);
        // console.log('[applyLayout]', resPath, layoutPage );
        const com: any = { path: resPath };
        if (layoutPage !== undefined) {
            // page.Layout = { e: layoutPage.id, path: layout };
            com.e = layoutPage.id;
        } else {
            // console.log('[applyLayout]', layout );
            ctx.addDependencies(page, [resPath]);
        }

        page.Layout = com;

    }

    return [page, rest];
}

async function applyCSSLinks(ctx: SiteContext, page: Entity, cssLinks: string[]): Promise<Entity> {
    // const { cssLinks, ...rest } = data as any;

    if (cssLinks === undefined) {
        return page;
    }

    // log('[applyCSSLinks]', 'with', cssLinks );
    // log('[applyCSSLinks]', 'for', page.Source );

    const srcUri = page.Source?.uri;

    if( srcUri === undefined ){
        throw new Error(`page uri not defined`);
    }

    // printAll(ctx);

    let paths = [];
    let eids = [];
    for (const path of cssLinks) {
        // let eid = selectTargetByPath( ctx, path );
        let eid = selectSourceByPath( ctx, path ); 
        if( eid !== undefined ){
            eids.push( eid );
        }
        else {
            let resUri = resolveRelative(ctx, srcUri, path);
            // let resPath = await findPagePath(ctx, page, path);
            paths.push(resUri);
        }
    }
    // let paths = await resolvePagePaths(ctx, cssLinks);
    // log('[applyCSSLinks]', page.Source.uri, cssLinks, paths);

    if( paths.length > 0 ){
        ctx.addDependencies( page, paths );
    }

    page.CssLinks = { paths, eids };

    return page;
}

async function applyTags(ctx: SiteContext, page: Entity, data: PageMeta = {}): Promise<[Entity, PageMeta]> {
    const { tags, ...rest } = data as any;

    if (tags !== undefined) {
        let tags = [];
        for (const name of tags) {
            tags.push(await selectOrCreateTag(ctx, name));
        }
        // fetch or create a tag entity
        page.Tags = { tags };
    }

    return [page, rest];
}

async function applyLinks(ctx: SiteContext, page: Entity, pageLinks: PageLinks): Promise<Entity> {
    if (pageLinks === undefined || pageLinks.size <= 0) {
        return page;
    }

    let links = [];
    const pagePath = ctx.pageSrcPath(page);
    log('[applyLinks]', pagePath, pageLinks );
    const dirPath = pagePath !== undefined ? Path.dirname(pagePath) : '';

    for (let [, { url, child }] of pageLinks) {
        let type = 'page';
        let page_url = url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            type = 'ext'; //external link
        }
        // check if this is a relative link to a local file - ./blog/about
        if (type === 'page') {
            // resolve the url
            url = Path.relative(ctx.rootPath, Path.resolve(dirPath, url));
            let foundPath = await checkPagePath(ctx, Path.join(ctx.rootPath, url));
            if( foundPath !== undefined ){
                url = Path.relative(ctx.rootPath, foundPath);
            }
            // log('[applyLinks]', url, page_url );
            log('[applyLinks]', '=', url );

            url = `file://${url}`;
            // create or select an entity to this page

            // printAll(ctx,undefined, ['/component/source']);
            // printAll(ctx);
            // throw 'stop';

            // important that the original url is retained, as this is the unique
            // key which we will use to rewrite it later

            ctx.addDependencies(page, [url]);
        }


        const linkE = await selectOrCreatePageLink(ctx, { page_url, url, type, text: child });

        // retain the original url so that we can rewrite it in the page
        links.push(linkE);
    }

    const existing = page.Links?.links ?? [];
    links = [...new Set([...existing, ...links])];
    page.Links = { links };

    return page;
}

function applyTarget(ctx: SiteContext, page: Entity, data: PageMeta = {}): [Entity, PageMeta] {
    const { dstPath, dst,
        writeJS, writeJSX, writeAST, 
        isEnabled, isRenderable, minify, 
        ...rest } = data as any;

    // log('[applyTarget]', page );

    let target: any = page.Target ?? {};
    
    if( page.Mdx ){
        let mdx: any = page.Mdx;
        if (writeJS) { mdx.writeJS = true }
        if (writeJSX) { mdx.writeJSX = true }
        if (writeAST) { mdx.writeAST = true }
        page.Mdx = mdx;
    }

    // target.minify = minify ?? true;
    

    if (dstPath !== undefined) {
        target.path = dstPath;
    }
    if (dst !== undefined) {
        target.path = dst;
    }

    if( target.filename === undefined ){
        const title = page.Title?.title;
        if( title !== undefined ){
            const ext = getPageExtension(page);
            target.filename = slugify(title) + `.${ext}`;
        }
    }

    // log('[applyTarget]', Path.basename(target.path) );
    // printEntity(ctx,page);

    page.Target = target;

    if (isEnabled === false) {
        page.Enabled = undefined;
    }

    if (isRenderable === false) {
        page.Renderable = undefined;
    }

    // console.log('[applyTarget]', page.Target, data );

    return [page, rest];
}

function getPageExtension(page:Entity):string {
    if( page.File && page.File.ext ){
        return page.File.ext;
    }
    if( page.Mdx ){
        return 'html';
    }
    if( page.Css ){
        return 'css';
    }
}

async function createParentDirEntities(ctx: SiteContext, path: string) {
    // read parent directories
    // path = Path.dirname(path);
    // let relativePath = path;// Path.relative(ctx.rootPath, path);
    let result: Entity[] = [];

    const parentPaths = getParentPaths(ctx, path);
    // console.log('[createParentDirEntities]', parentPaths);

    for (let ii = 0; ii < parentPaths.length; ii++) {
        let dirE = await createDirEntity(ctx, parentPaths[ii]);
        if (dirE !== undefined) { result.push(dirE) };
    }

    // while (relativePath) {
    //     path = Path.dirname(path);
    //     relativePath = Path.relative(ctx.rootPath, path);
    //     let dirE = await createDirEntity(ctx, relativePath);
    //     if( dirE !== undefined ){ result.push( dirE ) };
    //     // console.log('[createParentDirEntities]', 'parent', relativePath);
    // }

    return result;
}



async function createDirEntity(ctx: SiteContext, relativePath: string, stats?: Fs.Stats, options: CreateEntityOptions = {}) {

    relativePath = relativePath.endsWith(Path.sep) ? relativePath : relativePath + Path.sep;
    const fullPath = Path.join(ctx.rootPath, relativePath);
    const uri = 'file:' + (relativePath.startsWith('/') ? relativePath : '/' + relativePath);

    if (stats == undefined) {
        stats = await Fs.stat(fullPath);
    }

    const { ctime, mtime } = stats;

    // log('[createDirEntity]', relativePath, Path.normalize(relativePath) );
    // if( debug ) console.log('[createDirEntity]', relativePath, Path.normalize(relativePath) );

    // look for existing
    let e: Entity = selectPageByPath(ctx, relativePath);

    // if( debug ) console.log('[createDirEntity]', relativePath, e?.id );

    if (e !== undefined) {
        if( e.Stat?.modifiedAt > mtime ){
            console.log('[createDirEntity]', relativePath, 'modified');
        }
        return e;
    }

    let meta = await readDirMeta(fullPath);
    if (meta === undefined) {
        return;
    }
    // early culling of disabled paths
    if (meta['isEnabled'] === false) {
        ctx.inactivePaths.push(relativePath);
        return;
    }

    

    e = ctx.es.createEntity();

    // e.File = { 
    //     path: relativePath,
    // };
    e.Dir = { path: relativePath };
    // e.Source = {uri};
    e.Times = {
        ctime,
        mtime
    }

    e.Meta = { meta };
    // e.Build = { isResolved: false };

    let enabled = options.isEnabled ?? true;
    if (enabled) {
        e.Enabled = {};
    }

    return e;
}


interface CreateEntityOptions {
    isEnabled?: boolean;
}

function createFileEntity(ctx: SiteContext, relativePath: string, stats: Fs.Stats, options: CreateEntityOptions = {}) {
    const ext = Path.extname(relativePath).substring(1);
    if (ctx.validExtensions.indexOf(ext) === -1) {
        return undefined;
    }

    const { ctime, mtime } = stats;
    const uri = 'file://' + relativePath;
    relativePath = removeExtension(relativePath);

    // console.log('[createFileEntity]', relativePath, ext);

    // const existing = selectPageByPath(ctx, relativePath, {ext});
    const existing = selectEntityBySource(ctx, uri);

    if( existing !== undefined ){
        console.log('[createFileEntity]', relativePath, 'existing', existing.id );
        // printEntity(ctx, existing);

        // compare modified times to determine whether this is an update
        if( existing.Stat?.modifiedAt > mtime ){
            console.log('[createFileEntity]', relativePath, 'modified', existing.id );
        } else {
            return existing;
        }
    }

    let e = ctx.es.createEntity();
    e.File = {
        path: relativePath,
        ext
    };
    e.Source = {
        uri
    }
    e.Times = {
        ctime,
        mtime
    }
    // e.Build = { isResolved: false };

    let enabled = options.isEnabled ?? true;
    if (enabled) {
        e.Enabled = {};
    }

    if (ctx.renderableExtensions.indexOf(ext) !== -1) {
        e.Renderable = {};
    }

    switch (ext) {
        case 'mdx':
            e.Mdx = {};
            break;
        case 'css':
            e.Css = {};
            break;
        default:
            e.Static = {};
            break;
    }

    return e;
}


function getDirMeta(ctx: SiteContext, path: string) {
    const paths = getParentPaths(ctx, path);
    let result: PageMeta = {};
    // log('[getDirMeta]', paths);
    for (const dir of paths) {
        const parent = selectPageByPath(ctx, dir);
        if (parent === undefined) { continue; }
        const meta = parent?.Meta?.meta ?? {};
        result = { ...meta, ...result };
    }
    return result;

}




function getParentPaths(ctx: SiteContext, path: string, absolute: boolean = false): string[] {
    let result = [];

    if( path === '' || path === Path.sep ){
        return result;
    }

    // log('[getParentPaths]', path, Path.isAbsolute(path));
    path = Path.isAbsolute(path) ? path : Path.join(ctx.rootPath, path);
    let relativePath = path;
    let count = 0;


    while (relativePath) {
        path = Path.dirname(path);
        relativePath = Path.relative(ctx.rootPath, path);
        // log('[getParentPaths]', ctx.rootPath, path, relativePath);
        result.push(relativePath + Path.sep);
        if( ++count > 10 ) break;
    }

    return result;
}

function resolveRelative(ctx:SiteContext, srcUri:string, path:string ){
    // create full path from uri
    let srcPath = ctx.filePath( srcUri );
    if( !srcPath.endsWith(Path.sep) ){
        srcPath = Path.dirname( srcPath );
    }

    let absPath = Path.resolve( srcPath, path );

    let relative = Path.relative( ctx.rootPath, absPath );

    // log('[resolveRelative]', absPath, relative );

    return 'file://' + relative;

}

/**
 * 
 * @param ctx 
 * @param page 
 * @param path 
 * @param defaultExt 
 */
async function findPagePath(ctx: SiteContext, page: Entity, path: string, defaultExt: string = 'mdx') {
    if (Path.extname(path) === '') {
        path = `${path}.${defaultExt}`;
    }

    if (path.startsWith(ctx.rootPath) && Path.isAbsolute(path)) {
        path = Path.relative(ctx.rootPath, path);
    }
    if (await Fs.pathExists(path)) {
        return removeExtension(path);
    }

    let resPath = Path.join(ctx.rootPath, path);
    if (await Fs.pathExists(resPath)) {
        return removeExtension(Path.relative(ctx.rootPath, resPath));
    }
    if (page !== undefined) {
        resPath = Path.resolve(Path.dirname(ctx.pageSrcPath(page)), path);
        if (await Fs.pathExists(resPath)) {
            return removeExtension(Path.relative(ctx.rootPath, resPath));
        }
    }
    return undefined;
}

async function resolvePagePaths(ctx: BuildContext, paths: string[]): Promise<string[]> {
    let result = [];
    for (const path of paths) {
        if (await Fs.pathExists(path)) {
            result.push(Path.relative(ctx.rootPath, path));
        } else {
            console.log('[resolvePagePaths]', path);
            let fullPath = Path.join(ctx.rootPath, path);
            if (await Fs.pathExists(fullPath)) {
                result.push(Path.relative(ctx.rootPath, fullPath));
            }
        }
    }

    return result;
}



/**
 * 
 * @param ctx 
 * @param path 
 */
async function checkPagePath(ctx: SiteContext, path: string) {
    let exists = await Fs.pathExists(path);
    if (exists) {
        return path;
    }
    const [bare, ext] = splitPathExtension(path);

    if (ext) {
        // has an extension, but cannot be found
        return undefined;
    }

    // try with extensions
    for (const ext of ctx.validExtensions) {
        let extPath = path + '.' + ext;
        log('[checkPagePath]', extPath);
        if (await Fs.pathExists(extPath)) {
            return extPath;
        }
    }
    return undefined;
}


function selectSource(ctx:SiteContext):Entity[] {
    const { es } = ctx;
    const dids = es.resolveComponentDefIds(['/component/file', '/component/source']);
    dids.type = TYPE_OR; // either file or source
    const ents = es.getEntitiesMem(dids, { populate: true });

    return ents;
}

/**
 * Returns pages
 * 
 * @param ctx 
 */
async function selectPages(ctx: SiteContext): Promise<Entity[]> {
    const query = `[ 
        // select component which has an extension length >= 1
        /component/file#/ext !ca ~r/^.{1,}$/ ==
        // returns all the components on the entity
        all
        // fetch components
        @c 
    ] select`;

    return ctx.es.queryEntities(query);
}

function selectCssLinks(ctx: SiteContext): Component[] {
    const { es } = ctx;
    let bf = es.resolveComponentDefIds('/component/css_links');
    let coms = es.getComponentsMem(bf);
    return coms;
}

function selectMdxPages(ctx: SiteContext): Entity[] {
    const { es } = ctx;
    const dids = es.resolveComponentDefIds([
        '/component/enabled', '/component/renderable', '/component/mdx'
    ]);
    const ents = es.getEntitiesMem(dids, { populate: true });
    return ents;
    // const query = `[ 
    //     // selects entities which have /component/mdx
    //     [ /component/mdx ] !bf @e
    //     // selects all components from the entities selected
    //     all @c
    //     ] select`;

    // return ctx.es.queryEntities(query);
}

export function selectEntityBySource(ctx:SiteContext, path:string):Entity {
    let eid = selectSourceByPath(ctx,path);
    return eid !== undefined ? ctx.es.getEntityMem(eid, true) : undefined;
}


function selectSourceByPath(ctx:SiteContext, path:string, enabled:boolean = true ):EntityId {
    const {es} = ctx;
    const sourceDid = es.resolveComponentDefId('/component/source');
    const dids = es.resolveComponentDefIds([
        enabled ? '/component/enabled':'', '/component/source'
    ]);

    // log('[selectSourceByPath]', path);
    const com = es.findComponent(dids, (com) => {
        if( getComponentDefId(com) !== sourceDid ){
            return false;
        }
        if( com['uri'] === path ){
            return true;
        }
        // if( path.startsWith('source:') ){
        //     let src = path.substring( 'source:'.length );
        //     if( com['uri'] === src ){
        //         return true;
        //     }
        // }
    });
    return com !== undefined ? getComponentEntityId(com) : undefined;
}

function selectTargetByPath(ctx:SiteContext, path:string ):EntityId {
    const {es} = ctx;
    const targetDid = es.resolveComponentDefId('/component/target');
    const dids = es.resolveComponentDefIds([
        '/component/enabled', '/component/target'
    ]);

    

    // const ents = es.getEntitiesMem(dids, { populate: true });
    const com = es.findComponent(dids, (com) => {
        if( getComponentDefId(com) !== targetDid ){
            return false;
        }
        // log('[selectTargetByPath]', com);

        if( path.startsWith('target:') ){
            let target = path.substring( 'target:/'.length );
            if( com['filename'] === target ){
                return true;
            }
            // log('[applyCSSLinks]', 'finding', target);
            // selectTargetByPath(ctx, target);
        }

        // const matchPath = com['path'] === bare;
        // const matchExt = ext === '' ? com['ext'] === undefined : com['ext'] === ext;

        // // const match = com['path'] === bare && (
        // //     ext === '' ? com['ext'] === undefined : com['ext'] === ext
        // // );
        // if (debug && matchPath) { console.log('[find]', path, ext, matchPath, matchExt) }
        // // return com['path'] === bare && com['ext'] == ext;
        // // return com['path'] === bare &&  
        // return matchPath && matchExt;
    });
    return com !== undefined ? getComponentEntityId(com) : undefined;
}

/**
 * Returns entities which are both enabled and renderable
 * @param ctx 
 */
function selectRenderable(ctx: SiteContext) {
    const { es } = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable']);
    const ents = es.getEntitiesMem(dids, { populate: true });
    return ents;
}


function selectCSS(ctx: SiteContext): Entity[] {
    const { es } = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable', '/component/css']);
    const ents = es.getEntitiesMem(dids, { populate: true });
    return ents;
}

function selectTarget(ctx: SiteContext): Entity[] {
    const { es } = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable', '/component/target']);
    const ents = es.getEntitiesMem(dids, { populate: true });
    return ents;
}

function selectLayout(ctx: SiteContext): Component[] {
    const { es } = ctx;
    const bf = es.resolveComponentDefIds('/component/layout');
    return es.getComponentsMem(bf);
}

function selectLinks(ctx: SiteContext, page?: Entity) {
    const { es } = ctx;

    if (page !== undefined) {
        const eids = page.Links?.links ?? [];
        // const eids = links.map( l => l[1] );

        return es.getEntitiesByIdMem(eids, { populate: true });
    }

    const ents = es.getEntitiesMem(es.resolveComponentDefIds('/component/page_link'), { populate: true });

    return ents;
}




function selectPageByPath(ctx: SiteContext, path: string, options?: SelectOptions): Entity {
    return selectEntityByPath(ctx, path, { ...options, returnEid: false }) as Entity;
}
function selectEntityIdByPath(ctx: SiteContext, path: string, options?: SelectOptions): EntityId {
    return selectEntityByPath(ctx, path, { ...options, returnEid: true }) as EntityId;
}

function selectEntityByPath(ctx: SiteContext, path: string, { debug, returnEid, ...options }: SelectOptions = {}): Entity | EntityId {
    
    const { es } = ctx;

    if( path.startsWith('file:') ){
        let e = selectSourceByPath(ctx, path, false);

        // log('[selectEntityByPath]', e, returnEid );

        if( e !== undefined ){
            return returnEid ? e : es.getEntityMem(e);
        }
    }
    
    
    if (path.startsWith(ctx.rootPath) && Path.isAbsolute(path)) {
        path = Path.relative(ctx.rootPath, path);
    }

    let [bare, ext] = splitPathExtension(path);
    ext = options.ext ?? ext;

    

    // debug = debug && path === '/';

    const bf = es.resolveComponentDefIds('/component/file');
    const com = es.findComponent(bf, (com) => {
        const matchPath = com['path'] === bare;
        const matchExt = ext === '' ? com['ext'] === undefined : com['ext'] === ext;

        // const match = com['path'] === bare && (
        //     ext === '' ? com['ext'] === undefined : com['ext'] === ext
        // );
        if (debug && matchPath) { console.log('[find]', path, ext, matchPath, matchExt) }
        // return com['path'] === bare && com['ext'] == ext;
        // return com['path'] === bare &&  
        return matchPath && matchExt;
    });

    // if( debug ) console.log('[selectPageByPath]', {bare,ext}, com ? com['@e'] : 'not found');
    if (com !== undefined) {
        const eid = getComponentEntityId(com);
        if (returnEid === true) { return eid; }
        const e = es.getEntityMem(eid);
        return e;
    }

    return undefined;

    // const query = `[ 
    //     // select component which has an extension length >= 1
    //     /component/file#/path !ca ${bare} ==
    //     // returns all the components on the entity
    //     all
    //     // fetch components
    //     @c 
    // ] select`;

    // const result = await ctx.es.queryEntities(query);
    // return result[0];
}

/**
 * Returns all entities populated with components
 * @param ctx 
 */
export function selectAll(es: EntitySet): Entity[] {
    if( es instanceof EntitySetMem ){
        return es.getEntitiesByIdMem(true, { populate: true });
    }
    return [];
}

export async function selectTagByName(ctx: SiteContext, name: string): Promise<Entity> {
    const query = `[
        /component/tag#name !ca ${name} ==
        @c
    ] select`;
    const result = await ctx.es.queryEntities(query);
    return result[0];
}

export async function selectOrCreateTag(ctx: SiteContext, name: string): Promise<EntityId> {
    let te = await selectTagByName(ctx, name);
    if (te !== undefined) {
        return te.id;
    }
    const { es } = ctx;
    const eid = es.createEntityId();
    const c = es.createComponent('/component/tag', { '@e': eid, name });
    await ctx.add(c);
    return eid;
}

export async function selectOrCreatePageCss(ctx: SiteContext, url: string): Promise<EntityId> {
    const { es } = ctx;
    // const bf = es.resolveComponentDefIds('/component/file');
    const eid = es.createEntityId();
    let e = es.createEntity(eid);
    e.PageCss = { url };
    await ctx.add(e);
    return eid;
}

interface ComponentPageLink {
    e?: number; // owning entity
    url: string;
    page_url?: string;
    text?: string;
    type: string;
}

async function selectOrCreatePageLink(ctx: SiteContext, pageLink: ComponentPageLink): Promise<EntityId> {
    // let e = await selectPageLinkByUrl(ctx, pageLink.page_url);
    // if (e !== undefined) {
    //     return e.id;
    // }
    const { es } = ctx;
    const eid = es.createEntityId();
    let e = es.createEntity(eid);
    e.PageLink = pageLink;// { ...link, url: path };
    await ctx.add(e);
    return eid;
}


async function selectPageLinkByUrl(ctx: SiteContext, url: string): Promise<Entity> {
    const query = `[
        /component/page_link#page_url !ca "${url}" ==
        @c
    ] select`;
    const result = await ctx.es.queryEntities(query);
    return result[0];
}


async function selectCSSLinks(ctx: SiteContext): Promise<Entity[]> {
    const query = `[
        /component/link#type !ca css ==
        @c
    ] select`;
    return await ctx.es.queryEntities(query);

}


export function printAll(es: EntitySet, ents?: Entity[], dids?:string[]) {
    let result = ents || selectAll(es);
    for (const e of result) {
        printEntity(es, e, dids);
    }
}

export async function printQuery(ctx: SiteContext, q: string) {
    let result = await ctx.es.queryEntities(q);
    for (const e of result) {
        printEntity(ctx.es, e);
    }
}

export function printEntity(es: EntitySet, e: Entity, dids?:string[]) {
    let bf:BitField;
    if( es === undefined || e === undefined ){
        console.log('(undefined e)');
        return;
    }
    if( dids !== undefined ){
        bf = es.resolveComponentDefIds(dids);
    }
    console.log(`- e(${e.id})`);
    for (const [did, com] of e.components) {
        if( bf && bfGet(bf,did) === false ){
            continue;
        }
        const { '@e': eid, '@d': _did, ...rest } = com;
        const def = es.getByDefId(did);
        console.log(`   ${def.name}`, JSON.stringify(rest));
    }
}

function log(...args){
    console.log('[EcsContext]', ...args);
}