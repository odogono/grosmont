


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { ProcessOptions, TranspileProps, TranspileResult } from '../../types';
import { Site } from '../../site';

import { transpile } from './transpile';
import { buildSrcIndex, buildPageLinks, buildProps, getEntityCSSDependencies, getEntityImportUrlFromPath, selectMdx } from "./util";
import { printAll } from "../../util";



const log = (...args) => console.log('[ProcMDXRender]', ...args);



/**
 * Renders /component/mdx into /component/text
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;


    // resolve linkIndex
    let fileIndex = await buildSrcIndex(site);
    let linkIndex = site.getIndex('/index/links', true);

    // log('LINK index', linkIndex);

    const pageLinks = await buildPageLinks(es, linkIndex );

    // final pass - rendering the mdx into text
    let ents = await selectMdx(es);
    let output = [];

    for (const e of ents) {
        output.push(await renderMdx(es, e, undefined, { fileIndex, pageLinks }));
    }

    await es.add(output);


    return site;
}



async function renderMdx(es: EntitySet, e: Entity, child: TranspileResult, options: ProcessOptions): Promise<Entity> {


    try {
        let result = await renderEntity(es, e, undefined, options);

        const { html, meta } = result;
        const { isEnabled, isRenderable } = meta;

        if (isEnabled === false) {
            return e;
        }

        // log('[renderMdx]', e.Src.url, meta);

        // if( isRenderable !== false ){
        e.Text = { data: html, mime: 'text/html' };
        // }

    } catch (err) {
        log('[preProcessMdx]', 'error', err);
    }

    return e;
}


async function renderEntity(es: EntitySet, src: Entity, child: TranspileResult, options: ProcessOptions) {
    const { fileIndex } = options;
    const resolveImport = (path: string) => getEntityImportUrlFromPath(fileIndex, path);

    let props = buildProps(src);

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

    result = await renderLayoutEntity(es, src, result, options);

    return result;
}

async function renderLayoutEntity(es: EntitySet, src: Entity, child: TranspileResult, options: ProcessOptions) {
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

    return await renderEntity(es, layoutE, child, options);
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


