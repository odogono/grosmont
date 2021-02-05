


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { ProcessOptions, TranspileProps, TranspileResult } from '../../types';
import { Site } from '../../site';

import { transpile } from './transpile';
import { buildPageLinks, buildProps, getEntityCSSDependencies, getEntityImportUrlFromPath } from "./util";
import { buildSrcIndex, selectMdx } from "../../query";


const log = (...args) => console.log('[ProcMDXRender]', ...args);



/**
 * Renders /component/mdx into /component/text
 * 
 * @param es 
 */
export async function process(site: Site, options:ProcessOptions = {}) {
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
        let data = await renderMdx(site, e, { fileIndex, pageLinks });
        if( data === undefined ){
            continue;
        }
        e.Text = { data, mime:'text/html' };

        output.push(e);
    }

    await es.add(output);


    return site;
}



async function renderMdx(site: Site, e: Entity, options: ProcessOptions): Promise<string> {
    
    try {
        let result = await renderEntity(site, e, undefined, options);

        const { html, meta } = result;
        const { isEnabled, isRenderable } = meta;

        if (isEnabled === false) {
            return undefined;
        }

        return html;

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


