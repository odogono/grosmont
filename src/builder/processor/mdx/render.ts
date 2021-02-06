


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { ProcessOptions, TranspileProps, TranspileResult } from '../../types';
import { Site } from '../../site';

import { transpile } from './transpile';
import { buildPageLinks, buildProps, getEntityCSSDependencies, getEntityImportUrlFromPath } from "./util";
import { buildSrcIndex, selectMdx } from "../../query";


const log = (...args) => console.log('[ProcMDXRender]', ...args);


export interface ProcessMDXRenderOptions extends ProcessOptions {
    target? : 'text/html' | 'text/javascript' | 'text/jsx' | 'text/ast';
}

/**
 * Renders /component/mdx into /component/text
 * 
 * @param es 
 */
export async function process(site: Site, options:ProcessMDXRenderOptions = {}) {
    const es = site.es;


    // resolve linkIndex
    let fileIndex = await buildSrcIndex(site);
    let linkIndex = site.getIndex('/index/links', true);

    // log('LINK index', linkIndex);

    const pageLinks = await buildPageLinks(es, linkIndex );

    // final pass - rendering the mdx into text
    let ents = await selectMdx(es, {...options, siteRef: site.e.id});
    let output = [];

    for (const e of ents) {
        let [data, mime] = await renderMdx(site, e, { ...options, fileIndex, pageLinks });
        if( data === undefined ){
            continue;
        }
        e.Text = { data, mime };

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
            return undefined;
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

    return undefined;
}


async function renderEntity(site: Site, src: Entity, child: TranspileResult, options: ProcessOptions) {
    const { es } = site;
    const { fileIndex } = options;
    const resolveImport = (path: string) => getEntityImportUrlFromPath(fileIndex, path);

    let props = await buildProps(site, src);

    if (child !== undefined) {
        props.children = child.component;
    }

    props.applyLinks = options.pageLinks;

    props = await applyCSSDependencies(es, src, child, props);

    // props = await applyLinkDependencies(es, src, child, props, options);

    // props.css = css;
    // props.cssLinks = cssLinks;


    let result = await transpile(props, { render: true, resolveImport });

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

    // log('[renderLayoutEntity]', layoutE.Src.url );

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






async function getLayoutFromDependency(es: EntitySet, eid: EntityId): Promise<Entity> {
    // eid = 0;
    const stmt = es.prepare(`
    [
        /component/dep#src !ca $eid ==
        /component/dep#type !ca "layout" ==
        and
        @c
    ] select
    /dst pluck!
    
    // exit with undefined if nothing was found
    dup [ undefined @! ] swap [] == if
    
    // select the entity
    pop!
    swap [ *^$1 @e ] select
    `);
    return await stmt.getResult({ eid });
}


