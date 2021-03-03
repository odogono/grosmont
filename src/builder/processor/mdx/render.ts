


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { PageImgs, ProcessOptions, TranspileProps, TranspileResult } from '../../types';
import { Site } from '../../site';

import { transpile } from './transpile';
import { buildPageImgs, buildPageLinks, buildProps, getEntityCSSDependencies, getEntityImportUrlFromPath, resolveImport } from "./util";
import { buildSrcIndex, getLayoutFromDependency, selectMdx } from "../../query";
import { info, setLocation } from "../../reporter";
import { printEntity } from "odgn-entity/src/util/print";

const Label = '/processor/mdx/render';
const log = (...args) => console.log('[ProcMDXRender]', ...args);


export interface ProcessMDXRenderOptions extends ProcessOptions {
    target? : 'text/html' | 'text/javascript' | 'text/jsx' | 'text/ast';
    imgs?: PageImgs;
}

/**
 * Renders /component/mdx into /component/output
 * 
 * @param es 
 */
export async function process(site: Site, options:ProcessMDXRenderOptions = {}) {
    const es = site.es;
    const {reporter} = options;

    setLocation(reporter,Label);

    // resolve linkIndex
    let fileIndex = site.getIndex('/index/srcUrl');
    let linkIndex = site.getIndex('/index/links', true);
    let imgIndex = site.getIndex('/index/imgs', true);

    const pageLinks = await buildPageLinks(es, linkIndex );
    const imgs = await buildPageImgs(es, imgIndex);

    // final pass - rendering the mdx into text
    let ents = await selectMdx(es, options);
    let output = [];

    for (const e of ents) {
        // todo - this should be folded into the query
        const isRenderable = e.Meta?.meta?.renderable ?? true;

        if( !isRenderable ){
            continue;
        }
        // log('render');
        // printEntity(es, e);

        let [data, mime] = await renderMdx(site, e, { ...options, fileIndex, imgs, pageLinks });
        if( data === undefined ){
            continue;
        }
        e.Output = { data, mime };

        info(reporter, '', {eid:e.id});

        output.push(e);
    }

    await es.add(output);


    return site;
}



async function renderMdx(site: Site, e: Entity, options: ProcessMDXRenderOptions): Promise<[string,string]> {
    const target = options.target ?? 'text/html';

    try {
        let result = await renderEntity(site, e, undefined, options);

        const { html, code, jsx, ast, meta } = result;
        const { isEnabled, isRenderable } = meta;

        // log('[renderMdx]', result);

        if (isEnabled === false) {
            return [undefined, undefined];
        }

        if( target === 'text/ast' ){
            return [ ast, target ];
        }
        if( target === 'text/jsx' ){
            return [ jsx, target ];
        }
        if( target === 'text/javascript' ){
            return [ code, target ];
        }
        
            
        return [ html, target ];

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return [undefined, undefined];
}


async function renderEntity(site: Site, src: Entity, child: TranspileResult, options: ProcessMDXRenderOptions) {
    const { es } = site;
    const { fileIndex } = options;
    const { url:base } = src.Src;
    // let imports = [];
    // const resolveImport = (path: string, mimes?:string[]) => getEntityImportUrlFromPath(fileIndex, path, mimes);
    const resolveImportLocal = (path: string, mimes?: string[]) => {

        let entry = resolveImport(site, path, base );
        if( entry !== undefined ){
            // imports.push( entry );
            return entry[1];
        }

        // return getEntityImportUrlFromPath(fileIndex, path, mimes);
    }

    const require = async (path:string) => {
        log('[require]', path);
        return null;
    };

    let props = await buildProps(site, src);

    if (child !== undefined) {
        props.children = child.component;
    }

    props.applyLinks = options.pageLinks;
    props.imgs = options.imgs;

    props = await applyCSSDependencies(es, src, child, props);

    // props = await applyLinkDependencies(es, src, child, props, options);

    // props.css = css;
    // props.cssLinks = cssLinks;


    let result = await transpile(props, { render: true, resolveImport:resolveImportLocal, require });

    // log('[renderEntity]', src.Src.url, result );
    result.css = props.css;
    result.cssLinks = props.cssLinks;

    result = await renderLayoutEntity(site, src, result, options);

    return result;
}

async function renderLayoutEntity(site: Site, src: Entity, child: TranspileResult, options: ProcessOptions) {
    const { es } = site;

    if (child === undefined || child.meta.layout === undefined) {
        return child;
    }

    const layoutE = await getLayoutFromDependency(es, src.id);

    // printAll(es as EntitySetMem);

    // log('[renderLayoutEntity]', 'returned', layoutE.id, 'for', src.id );

    // log('[renderLayoutEntity]', layoutE );
    // printEntity(es, layoutE);

    if (layoutE === undefined) {
        return child;
    }

    // log('[renderLayoutEntity]', 'child', child);

    return await renderEntity(site, layoutE, child, options);
}



async function applyCSSDependencies(es: EntitySet, e: Entity, child: TranspileResult, props: TranspileProps): Promise<TranspileProps> {
    // build css links and content from deps
    const cssEntries = await getEntityCSSDependencies(es, e);

    if (cssEntries === undefined) {
        return props;
    }


    // log('[renderEntity]', src.id, child );
    let css = cssEntries.map(ent => ent.text).join('\n');
    let cssLinks = cssEntries.map(ent => ent.path);
    if (child !== undefined) {
        css = css + ' ' + child.css;
        // log('[applyCSSDependencies]', child.cssLinks);

        cssLinks = Array.isArray(child.cssLinks) ? cssLinks.concat(child.cssLinks) : cssLinks;
        // cssLinks = [...cssLinks, ...child.cssLinks];
    }
    return { ...props, css, cssLinks };
}




