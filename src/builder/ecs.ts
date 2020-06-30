import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
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
    Entity, EntityId
} from 'odgn-entity/src/entity';

import {
    EntitySetMem, EntitySet
} from 'odgn-entity/src/entity_set';

import { TranspileOptions, transpile } from './transpile';
import { getComponentEntityId, Component, toComponentId } from 'odgn-entity/src/component';
import { isEmpty } from 'odgn-entity/src/util/is';







export class SiteContext extends BuildContext {
    es: EntitySetMem;

    inactivePaths: string[] = [];

    validExtensions: string[] = ['mdx', 'jsx', 'tsx', 'html', 'css'];

    renderableExtensions: string[] = ['mdx', 'html', 'css'];

    depends: string[] = [];

    constructor(rootPath: string | SiteContext, dstPath?: string) {
        super(rootPath, dstPath);
        this.es = new EntitySetMem();
    }

    async init() {
        for (const def of defs) {
            await this.es.register(def);
        }
    }

    pageSrcPath(page: Entity): string {
        const { path, ext } = page.File ?? {};
        return Path.join(this.rootPath, path) + `.${ext}`;
    }

    pageDstPath(page:Entity): string {
        const {path} = page.Target ?? {};
        return Path.join( this.dstPath, path);
    }

    isPathDisabled(relativePath: string) {
        return this.inactivePaths.find(p => relativePath.startsWith(p));
    }

    addDependencies(page:Entity, dependencies:string[] ){
        dependencies = dependencies.map( path => Path.isAbsolute(path) ? Path.relative(this.rootPath, path) : path );
        this.depends = [...new Set([...this.depends, ...dependencies])];
    }

    async add( entitiesOrComponents:any ){
        await this.es.add( entitiesOrComponents );
    }
}

/**
 * Reads through the src directory and gathers information about the files and dirs
 * found
 * 
 * @param ctx 
 */
export async function gatherPages(ctx: SiteContext, targetPath?: string): Promise<SiteContext> {

    let files: Entity[] = [];

    if (!await Fs.pathExists(ctx.rootPath)) {
        return ctx;
    }

    const { es } = ctx;

    // console.log('[gatherPages]', {targetPath}, ctx.pages.map(p=>p.path) );
    // console.log('ctx pages', );

    let rootPath = targetPath !== undefined ? Path.join(ctx.rootPath, targetPath) : ctx.rootPath;

    rootPath = await checkPagePath(ctx, rootPath);

    if( rootPath === undefined ){
        console.log('[gatherPages]', 'page not found', rootPath );
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
        await ctx.add( dirEntities );

        // console.log('[gatherPages]', 'added', dirEntities.length, 'dir entities');

        let isEnabled = !ctx.isPathDisabled(relativePath);
        // if (ctx.isPathDisabled(relativePath)) {
        //     console.log('[gatherPages]', relativePath, 'disabled');
        //     return ctx;
        // }

        let e = createFileEntity(ctx, relativePath, stats, {isEnabled});
        if (e !== undefined) {
            await ctx.add(e);
        }
        
        console.log('[gatherPages]', 'post', {targetPath}, ctx.pages.map(p=>p.path) );
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



/**
 * Parses pages of their meta data and links by doing a transpile on
 * the page source. Then resolves against directory meta. 
 * 
 * @param ctx 
 */
export async function resolveMeta(ctx: SiteContext, path?:string): Promise<SiteContext> {

    let pages;
    // select page entities - have an extension
    if( path ){
        pages = [ selectPageByPath(ctx, path) ].filter(Boolean);
    } else {
        pages = await selectPages(ctx);
    }

    // console.log('[resolveMeta]', pages);

    if( pages.length === 0 ){
        // console.log('[resolveMeta]', 'no pages', path);
        // printAll(ctx);
        // throw 'stop';
        return ctx;
    }

    // console.log('[resolveMeta]', pages.map(e => e.File.path) );

    let pagesMeta = [];
    for (const page of pages) {
        const { path } = page.File;
        // console.log('getting dir meta for', path );
        let dirMeta = getDirMeta(ctx, path);
        page.Meta = { meta:{ ...dirMeta, ...page.Meta?.meta} };
        // console.log('updated', page.id);
        pagesMeta.push(page.Meta);
    }
    await ctx.add(pagesMeta);

    // non MDX pages initial target resolution
    const css = pages.filter( p => p.File.ext !== 'mdx' );
    for( let page of css ){
        let meta = page.Meta?.meta ?? {};
        [page,meta] = applyTarget(ctx, page, meta);
        page.Meta = {meta};
    }
    await ctx.add(css);


    for( const page of pages ){
        console.log('[resolveMeta]', page.File.path, page.Meta.meta );
    }

    // transpile any mdx pages
    pages = pages.filter( p => p.File.ext === 'mdx');

    for (const page of pages) {
        await transpileWith(ctx, page);
    }
    // console.log('updating', pages.length, 'pages', ctx.es.entChanges );
    // console.log('updating', pagesMeta );

    // console.log(ctx.es);
    return ctx;
}


export async function resolveDependencies(ctx: SiteContext): Promise<SiteContext> {
    

    let resolved = false;

    while (!resolved) {
        let deps = [];

        // first ensure each of the deps is resolved to an actual file
        deps = (await Promise.all( ctx.depends.map(
            async (dep) => {
                let absPath = Path.join(ctx.rootPath, dep);
                absPath = await checkPagePath(ctx, absPath);
                return absPath !== undefined ? Path.relative(ctx.rootPath,absPath) : undefined;
            }
        ))).filter(Boolean);
        
        // only interested in pages we haven't seen yet
        deps = deps.map( 
            dep => selectPageByPath(ctx, dep) === undefined ? dep : undefined
        ).filter(Boolean);
        
        // console.log('[resolveDependencies]', 'b', deps );

        for (const dep of deps) {
            // console.log('[resolveDependencies]', 'dep', dep);
            await gatherPages(ctx, dep);
            // console.log('[resolveDependencies]', 'dep meta', dep);
            await resolveMeta(ctx, dep);
        }

        resolved = deps.length === 0;

        // console.log('[resolveDependencies]', 'done', deps );
    }

    ctx.depends = [];

    return ctx;
}

export async function resolveLayout(ctx:SiteContext): Promise<SiteContext> {
    // at this point there should be a complete record of all files
    // so resolve page layouts
    const layoutComs = selectLayout(ctx);
    let coms = [];
    let remove = [];
    for( const com of layoutComs ){
        let {path,e} = com;
        if( e === undefined ){
            const eid = selectEntityIdByPath(ctx,path,{ext:'mdx'});
            if( eid !== undefined ){
                coms.push( {...com, e:eid} );
            }  else {
                console.log('[resolveLayout]', 'could not find', path);
                // if we cant find the layout from its path, then remove it
                remove.push( com );
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
export async function resolvePageLinks(ctx:SiteContext): Promise<SiteContext> {
    const {es} = ctx;
    let links = selectLinks(ctx);
    const enabledDid = es.resolveComponentDefIds('/component/enabled');

    let out = [];
    for( const e of links ){
        const link = e.PageLink;
        if( link.type === 'ext' ){
            e.Enabled = {};
            // console.log('[resolvePageLinks]', 'ext', link);
        } else {
            let absPath = Path.join(ctx.rootPath, link.url || link.page_url);
            absPath = await checkPagePath(ctx, absPath);
            
            // console.log('[resolvePageLinks]', absPath, link);
            const linkE = selectPageByPath(ctx, absPath);

            if( linkE !== undefined ){
                e.PageLink = {...link, e:linkE.id };
                if( linkE.hasComponents(enabledDid) ){
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


export async function resolveDest(ctx:SiteContext): Promise<SiteContext> {

    const pages = selectRenderable(ctx);

    for( const page of pages ){
        const target = page.Target ?? {};

        let path = target.path ?? page.File.path;
        if (path.endsWith(Path.sep)) {
            path = Path.join(path, Path.basename(page.File.path));
        }
        let ext = page.File.ext;
        if( ext ){
            ext = ext === 'mdx' ? 'html' : ext;
        }

        if( !isEmpty(ext) ){
            page.Target = {...target, path: path + '.' + ext};
        }
    }

    await ctx.add(pages);

    

    return ctx;
}


export async function processCSS(ctx:SiteContext): Promise<SiteContext> {
    const pages = selectCSS(ctx);

    for( const page of pages ){
        const minify = page.Target.minify ?? true;
        const from = ctx.pageSrcPath(page);
        const to = ctx.pageDstPath(page) ?? from;// pageDstPath(ctx, page) || from;
        const css = await Fs.readFile(from, 'utf8');

        const plugins = [
            PreCSS,
            GridKISS, 
            minify ? CSSNano : undefined
        ].filter(Boolean);

        let args = {from, to};
        const {css:content} = await PostCSS(plugins).process(css, args);

        // console.log('content', content);
        // throw 'stop';

        page.Target = {...page.Target, content};
    }

    await ctx.add( pages );

    // console.log('[processCSS]');
    // printAll(ctx, pages);

    return ctx;
}

/**
 * Convert /component/css_links from paths to eids
 * @param ctx 
 */
export async function resolveCssLinks(ctx:SiteContext): Promise<SiteContext> {
    let links = selectCssLinks(ctx);

    // console.log('[resolveCssLinks]');
    // console.log( links );
    links = links.map( com => {
        const {paths,...rest} = com;
        const links = paths.map( p => selectEntityIdByPath(ctx,p) ).filter(Boolean);
        return {...rest, links};
    });
    // console.log( links );

    await ctx.add(links);
    // printAll(ctx, pages);

    return ctx;
}

/**
 * 
 * @param ctx 
 */
export async function resolveLinks(ctx:SiteContext): Promise<SiteContext> {
    const pages = selectMdxPages(ctx);

    // console.log('[resolveLinks]');
    // printAll(ctx, pages);

    return ctx;
}

export async function renderPages(ctx:SiteContext): Promise<SiteContext> {
    const pages = selectMdxPages(ctx);

    // console.log('[renderPages]');
    // printAll(ctx, pages);
    let coms = [];

    for( const page of pages ){
        // retrieve page links
        let path = ctx.pageSrcPath(page);
        let links = getPageLinks(ctx,page);
        let inCss = getPageCss(ctx, page);
        let meta = getPageMeta(ctx,page, {debug:true});
        
        console.log('[renderPage]', path, page.Mdx );
        // printAll(ctx);
        let result = await transpile({ path, links, meta, ...inCss }, { forceRender: true });
        let {code, component, jsx, html:content } = result;
        
        page.Mdx = {...page.Mdx, code, component, jsx };
        page.Target = { ...page.Target, content };

        // if( page.Layout === undefined ){
            // page.Mdx = { code, component, jsx };
            // continue;
            // return {
            //     ...page,
            //     code: result.code,
            //     component: result.component,
            //     content: result.html,
            //     jsx: result.jsx
            // };
        // }

        if( page.Layout !== undefined ){
            const layoutPage = ctx.es.getEntityMem(page.Layout.e);
            // console.log('[renderPage]', 'layout', page.Layout.path, page.Layout.e );
            
            // console.log('[renderPage]', 'layout', page.Layout.path, layoutPage );
            const layoutMeta = getPageMeta(ctx, layoutPage);

            // console.log('[renderPages]', 'layout', page.Layout.path, layoutMeta );

            path = ctx.pageSrcPath(layoutPage);
            let layoutResult = await transpile({
                path, 
                meta:{...layoutMeta,...meta}, 
                children:result.component
            }, {forceRender:true});

            page.Mdx = {...page.Mdx, component:layoutResult.component };
            page.Target = {...page.Target, content:layoutResult.html };
        }
        coms = coms.concat( [page.Mdx, page.Target] );
    }

    await ctx.add( coms );
    
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

export async function writePages(ctx:SiteContext, options: WritePagesOptions = {}): Promise<SiteContext> {
    let doWriteHTML = options.writeHTML ?? true;
    let doWriteCode = options.writeCode ?? false;
    let doWriteJSX = options.writeJSX ?? false;
    let doWriteAST = false;

    const ents = selectTarget(ctx);

    for( const e of ents ){
        const path = ctx.pageDstPath(e);
        const {content} = e.Target;
        console.log('[writePages]', path);

        // const { content } = (page as Page);
        // const outPath = pageDstPath(ctx, page);

        if( e.Mdx ){
            writeHTML(path, content, options);
        }
        else if( e.Static ){
            const src = ctx.pageSrcPath(e);
            const dst = ctx.pageDstPath(e);
            await Fs.ensureDir(Path.dirname(dst));
            await Fs.copyFile(src, dst);
        }
        else {
            writeFile(path, content);
        }
        // await Fs.ensureDir(Path.dirname(path));
        // await Fs.writeFile(path, content);
    }


    return ctx;
}

async function writeFile(path: string, content: string) {
    if( content === undefined ){
        throw new Error(`${path} content is undefined`);
    }
    await Fs.ensureDir(Path.dirname(path));
    await Fs.writeFile(path, content);
}

async function writeHTML(path: string, html: string, options: WriteHTMLOptions = {}) {
    html = (options.beautify ?? false) ? Beautify.html(html) : html;
    writeFile(path, html);
}


function getPageMeta(ctx:SiteContext, page:Entity, options:{debug?:boolean} = {}){
    const debug = options.debug ?? false;

    const path = ctx.pageSrcPath(page);

    let meta:any = { path };
    if( page.Meta !== undefined ){
        meta = {...meta, ...page.Meta.meta };
    }
    if( page.Title !== undefined ){
        meta = {...meta, ...page.Title };
    }

    

    // get css

    return meta;
}

function getPageCss(ctx:SiteContext, page:Entity){
    let result:any = {};
    // get cssLinks:
    if( page.CssLinks !== undefined ){
        const {es} = ctx;
        const did = es.resolveComponentDefId('/component/target');
        
        let coms = page.CssLinks.links.map( eid => es.getComponentMem( toComponentId(eid,did) ) );
        result.cssLinks = coms.map( c => c['path'] );
        result.css = coms.map( c => c['content'] ).join(' ');
        // if( debug ) console.log('[getPageMeta]', coms );
    }
    return result;
}

function getPageLinks(ctx:SiteContext, page:Entity){
    const links = selectLinks(ctx,page);
    let result = new Map<string, PageLink>();
    // console.log('[toPageLinks]', links);
    for( const link of links ){
        const {url,page_url,e,text} = link.PageLink;
        // let pageUrl = url;
        const linkPage = ctx.es.getEntityMem( e, true);
        if( linkPage ){
            // page_url = linkPage.Target.path
            // console.log('[toPageLinks]', url, page_url );
        }

        result.set(page_url, {child:text, url});
    }
    return result;
}

async function transpileWith(ctx: SiteContext, page: Entity, options?: TranspileOptions): Promise<SiteContext> {

    let path = ctx.pageSrcPath(page);
    let inLinks = getPageLinks(ctx,page);
    let inCss = getPageCss(ctx, page);
    let inMeta = getPageMeta(ctx,page);
    
    // console.log('[transpileWith]', props );
    
    const props = {path, meta:inMeta, links:inLinks, ...inCss};

    let { meta, links, requires, ...rest } = await transpile(props, options);

    console.log('[transpileWith]', page.File.path, meta );

    // note the required files, so that they will be resolved after
    ctx.addDependencies( page, requires );

    [page, meta] = applyTitle(ctx, page, meta);
    [page, meta] = await applyLayout(ctx, page, meta);
    [page, meta] = await applyTags(ctx, page, meta);
    [page, meta] = await applyCSSLinks(ctx, page, meta);
    page = await applyLinks(ctx, page, links);
    [page, meta] = applyTarget(ctx, page, meta);

    // console.log('[transpileWith][out]', Object.keys(rest) );
    // console.log('[transpileWith][out]', 'meta', meta);
    // console.log('[transpileWith][out]', 'requires', requires );

    // console.log('[transpileWith][out]', page.File.path, ctx.depends );

    // printEntity(ctx,page);

    // let upd: TranspileResult = { ...rest, meta, requires };

    // if ('cssLinks' in meta) {
    //     let cssLinks = await resolvePaths(ctx, meta['cssLinks']);
    //     // console.log('[]', 'requires', page.path, cssLinks );
    //     upd.meta = { ...(meta as any), cssLinks };
    // }

    // upd.requires = await resolvePaths(ctx, requires);

    // if (links !== undefined && links.size > 0) {
    //     upd['links'] = links;
    // }
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
    let com:any = {};
    if( title !== undefined ){
        com.title = title;
    }
    if( description !== undefined ){
        com.description = description;
    }
    if( Object.keys(com).length > 0 ){
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
        const com:any = {path:resPath};
        if (layoutPage !== undefined) {
            // page.Layout = { e: layoutPage.id, path: layout };
            com.e = layoutPage.id;
        } else {
            // console.log('[applyLayout]', layout );
            ctx.addDependencies( page, [resPath] );
        }

        page.Layout = com;
        
    }

    return [page, rest];
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
async function applyCSSLinks(ctx: SiteContext, page: Entity, data: PageMeta = {}): Promise<[Entity, PageMeta]> {
    const { cssLinks, ...rest } = data as any;
    if (cssLinks !== undefined) {
        // console.log('[applyCSSLinks]', cssLinks);
        let paths = await resolvePaths(ctx, cssLinks);
        // let links = [];
        // for (const path of paths) {

        //     // links.push( await selectOrCreatePageCss(ctx, path) );
        // }
        page.CssLinks = { paths };
        // console.log('[transpileWith][out]', 'cssLinks', paths );
    }

    return [page, rest];
}

async function applyLinks(ctx: SiteContext, page: Entity, pageLinks: PageLinks): Promise<Entity> {
    if (pageLinks === undefined || pageLinks.size <= 0) {
        return page;
    }

    let links = [];
    const pagePath = ctx.pageSrcPath(page);
    const dirPath = Path.dirname(pagePath);

    for (let [, { url, child }] of pageLinks) {
        let type = 'page';
        let page_url = url;
        if( url.startsWith('http://') || url.startsWith('https://') ){
            type = 'ext';
        }
        // check if this is a relative link to a local file - ./blog/about
        if( type === 'page' ){
            // resolve the url
            url = Path.relative(ctx.rootPath, Path.resolve(dirPath, url) );
            // console.log('[applyLinks]', pagePath, url, page_url );
            
            // important that the original url is retained, as this is the unique
            // key which we will use to rewrite it later

            ctx.addDependencies(page, [url] );
        }
        const linkE = await selectOrCreatePageLink(ctx, { page_url, url, type, text: child });

        // retain the original url so that we can rewrite it in the page
        links.push(linkE);
    }

    const existing = page.Links?.links ?? [];
    links = [...new Set([...existing, ...links])];
    page.Links = {links};

    return page;
}

function applyTarget(ctx: SiteContext, page: Entity, data: PageMeta = {}): [Entity, PageMeta] {
    const { dstPath, writeJS, writeJSX, writeAST, isEnabled, isRenderable, minify, ...rest } = data as any;

    let target:any = {};
    if( writeJS ){ target.writeJS = true }
    if( writeJSX ){ target.writeJSX = true }
    if( writeAST ){ target.writeAST = true }
    target.minify = minify ?? true;

    
    if( dstPath !== undefined ){
        target.path = dstPath;
    }
    
    page.Target = target;

    if( isEnabled === false ){
        page.Enabled = undefined;
    }

    if( isRenderable === false ){
        page.Renderable = undefined;
    }

    return [page, rest];
}



async function createParentDirEntities(ctx:SiteContext, path:string){
    // read parent directories
    // path = Path.dirname(path);
    // let relativePath = path;// Path.relative(ctx.rootPath, path);
    let result:Entity[] = [];

    const parentPaths = getParentPaths(ctx,path);
    // console.log('[createParentDirEntities]', parentPaths);

    for( let ii=0;ii<parentPaths.length;ii++ ){
        let dirE = await createDirEntity(ctx, parentPaths[ii] );
        if( dirE !== undefined ){ result.push( dirE ) };
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



async function createDirEntity(ctx: SiteContext, relativePath: string, stats?: Fs.Stats, options:CreateEntityOptions = {}) {

    // let debug = relativePath === '/';

    relativePath = relativePath.endsWith(Path.sep) ? relativePath : relativePath + Path.sep;
    // if( debug ) console.log('[createDirEntity]', relativePath, Path.normalize(relativePath) );

    // look for existing
    let e:Entity = selectPageByPath(ctx, relativePath);

    // if( debug ) console.log('[createDirEntity]', relativePath, e?.id );

    if( e !== undefined ){
        return e;
    }

    const fullPath = Path.join(ctx.rootPath, relativePath);
    let meta = await readDirMeta(fullPath);
    if (meta === undefined) {
        return;
    }
    // early culling of disabled paths
    if (meta['isEnabled'] === false) {
        ctx.inactivePaths.push(relativePath);
        return;
    }

    if( stats == undefined ){
        stats = await Fs.stat(fullPath);
    }

    const { ctime, mtime } = stats;

    e = ctx.es.createEntity();

    e.File = {
        path: relativePath,
        createdAt: ctime,
        modifiedAt: mtime
    };

    e.Meta = { meta };
    e.Build = { isResolved: false };

    let enabled = options.isEnabled ?? true;
    if( enabled ){
        e.Enabled = {};
    }

    return e;
}


interface CreateEntityOptions {
    isEnabled?: boolean;
}

function createFileEntity(ctx: SiteContext, relativePath: string, stats: Fs.Stats, options:CreateEntityOptions = {}) {
    const ext = Path.extname(relativePath).substring(1);
    if (ctx.validExtensions.indexOf(ext) === -1) {
        return undefined;
    }

    const { ctime, mtime } = stats;
    relativePath = removeExtension(relativePath);

    let e = ctx.es.createEntity();
    e.File = {
        path: relativePath,
        ext,
        createdAt: ctime,
        modifiedAt: mtime
    };
    e.Build = { isResolved: false };

    let enabled = options.isEnabled ?? true;
    if( enabled ){
        e.Enabled = {};
    }

    if( ctx.renderableExtensions.indexOf(ext) !== -1 ){
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
    const paths = getParentPaths(ctx,path);
    let result: PageMeta = {};
    // console.log('[getDirMeta]', paths);
    for (const dir of paths) {
        const parent = selectPageByPath(ctx, dir);
        if (parent === undefined) { continue; }
        const meta = parent?.Meta?.meta ?? {};
        result = { ...meta, ...result };
    }
    return result;

}




function getParentPaths(ctx:SiteContext, path: string, absolute:boolean = false): string[] {
    let result = [];

    path = Path.isAbsolute(path) ? path : Path.join(ctx.rootPath,path);
    let relativePath = path;
    // let count = 0;

    // console.log('[getParentPaths]', path, Path.isAbsolute(path));

    while (relativePath) {
        path = Path.dirname(path);
        relativePath = Path.relative(ctx.rootPath, path);
        result.push( relativePath + Path.sep );
        // if( ++count > 5 ) break;
    }

    return result;
}

/**
 * 
 * @param ctx 
 * @param page 
 * @param path 
 * @param defaultExt 
 */
async function findPagePath(ctx:SiteContext, page:Entity, path:string, defaultExt:string = 'mdx' ){
    if( Path.extname(path) === '' ){
        path = `${path}.${defaultExt}`;
    }

    if( path.startsWith(ctx.rootPath) && Path.isAbsolute(path) ){
        path = Path.relative(ctx.rootPath, path);
    }
    if( await Fs.pathExists(path) ){
        return removeExtension( path );
    }

    let resPath = Path.join( ctx.rootPath, path );
    if( await Fs.pathExists(resPath) ){
        return removeExtension( Path.relative(ctx.rootPath,resPath) );
    }
    resPath = Path.resolve( Path.dirname(ctx.pageSrcPath(page)), path );
    if( await Fs.pathExists(resPath) ){
        return removeExtension( Path.relative(ctx.rootPath,resPath) );
    }
    return undefined;
}


/**
 * 
 * @param ctx 
 * @param path 
 */
async function checkPagePath(ctx:SiteContext, path:string){
    let exists = await Fs.pathExists(path);
    if( exists ){
        return path;
    }
    const [bare,ext] = splitPathExtension(path);

    if( ext ){
        // has an extension, but cannot be found
        return undefined;
    }

    // try with extensions
    for( const ext of ctx.validExtensions ){
        let extPath = path + '.' + ext;
        if( await Fs.pathExists(extPath) ){
            return extPath;
        }
    }
    return undefined;
}


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

function selectCssLinks(ctx:SiteContext): Component[] {
    const {es} = ctx;
    let bf = es.resolveComponentDefIds('/component/css_links');
    let coms = es.getComponentsMem(bf);
    return coms;
}

function selectMdxPages(ctx: SiteContext): Entity[] {
    const {es} = ctx;
    const dids = es.resolveComponentDefIds([
        '/component/enabled', '/component/renderable', '/component/mdx'
    ]);
    const ents = es.getEntitiesMem( dids, {populate:true} );
    return ents;
    // const query = `[ 
    //     // selects entities which have /component/mdx
    //     [ /component/mdx ] !bf @e
    //     // selects all components from the entities selected
    //     all @c
    //     ] select`;

    // return ctx.es.queryEntities(query);
}


/**
 * Returns entities which are both enabled and renderable
 * @param ctx 
 */
function selectRenderable(ctx:SiteContext){
    const {es} = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable'] );
    const ents = es.getEntitiesMem( dids, {populate:true} );
    return ents;
}


function selectCSS(ctx:SiteContext):Entity[]{
    const {es} = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable', '/component/css'] );
    const ents = es.getEntitiesMem( dids, {populate:true} );
    return ents;
}

function selectTarget(ctx:SiteContext):Entity[]{
    const {es} = ctx;
    const dids = es.resolveComponentDefIds(['/component/enabled', '/component/renderable', '/component/target'] );
    const ents = es.getEntitiesMem( dids, {populate:true} );
    return ents;
}

function selectLayout(ctx:SiteContext):Component[] {
    const {es} = ctx;
    const bf = es.resolveComponentDefIds('/component/layout');
    return es.getComponentsMem( bf );
}

function selectLinks(ctx: SiteContext, page?:Entity){
    const {es} = ctx;

    if( page !== undefined ){
        const eids = page.Links?.links ?? [];
        // const eids = links.map( l => l[1] );

        return es.getEntitiesByIdMem( eids, {populate:true} );
    }

    const ents = es.getEntitiesMem( es.resolveComponentDefIds('/component/page_link'), {populate:true} );

    return ents;
}


interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    ext?: string;
}


function selectPageByPath(ctx: SiteContext, path: string, options?:SelectOptions): Entity {
    return selectEntityByPath(ctx,path,{...options,returnEid:false}) as Entity;
}
function selectEntityIdByPath(ctx: SiteContext, path: string, options?:SelectOptions): EntityId {
    return selectEntityByPath(ctx,path,{...options,returnEid:true}) as EntityId;
}

function selectEntityByPath(ctx: SiteContext, path: string, {debug,returnEid,...options}:SelectOptions = {}): Entity|EntityId {
    if( path.startsWith(ctx.rootPath) && Path.isAbsolute(path) ){
        path = Path.relative(ctx.rootPath, path);
    }

    let [bare,ext] = splitPathExtension(path);
    ext = options.ext ?? ext;
    
    const {es} = ctx;

    // debug = debug && path === '/';

    const bf = es.resolveComponentDefIds('/component/file');
    const com = es.findComponent( bf, (com) => {
        const matchPath = com['path'] === bare;
        const matchExt = ext === '' ? com['ext'] === undefined : com['ext'] === ext;

        // const match = com['path'] === bare && (
        //     ext === '' ? com['ext'] === undefined : com['ext'] === ext
        // );
        if( debug && matchPath ){ console.log('[find]', path, ext, matchPath, matchExt) }
        // return com['path'] === bare && com['ext'] == ext;
        // return com['path'] === bare &&  
        return matchPath && matchExt;
    });

    // if( debug ) console.log('[selectPageByPath]', {bare,ext}, com ? com['@e'] : 'not found');
    if( com !== undefined ){
        const eid = getComponentEntityId(com);
        if( returnEid === true ){ return eid; }
        const e = es.getEntityMem( eid );
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
export function selectAll(ctx: SiteContext): Entity[] {
    return ctx.es.getEntitiesByIdMem(true, { populate: true });
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

export async function selectOrCreatePageCss(ctx:SiteContext, url:string): Promise<EntityId> {
    const {es} = ctx;
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

async function selectOrCreatePageLink(ctx: SiteContext, pageLink:ComponentPageLink ): Promise<EntityId> {
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


export async function printAll(ctx: SiteContext, ents?:Entity[]) {
    let result = ents || selectAll(ctx);
    for (const e of result) {
        printEntity(ctx, e);
    }
}

export async function printQuery(ctx: SiteContext, q: string) {
    let result = await ctx.es.queryEntities(q);
    for (const e of result) {
        printEntity(ctx, e);
    }
}

export function printEntity(ctx: SiteContext, e: Entity) {
    const { es } = ctx;
    console.log(`- e(${e.id})`);
    for (const [did, com] of e.components) {
        const { '@e': eid, '@d': did, ...rest } = com;
        // const did = com['@d'];
        const def = es.getByDefId(did);
        console.log(`   ${def.name}`, JSON.stringify(rest));
    }
}
