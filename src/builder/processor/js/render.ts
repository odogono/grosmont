import Process from 'process';
import React from 'react';
import { html as BeautifyHTML } from 'js-beautify';

import { getDependencyEntities, getDependencyComponents, getLayoutFromDependency, insertDependency, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileProps, TranspileResult, EvalContext, EvalScope } from '../../types';
import { createRenderContext, getEntityCSSDependencies } from './util';
import {
    Component, setEntityId, toComponentId,
    QueryableEntitySet,
    Entity,
} from '../../../es';

import { hash, toInteger } from '@odgn/utils';
import { buildImports } from './eval';
import { useServerEffect, serverEffectValue, beginServerEffects, endServerEffects } from '../jsx/server_effect';
import { createErrorComponent } from '../../util';
import { transformComponent } from './transform';
import { transformJS } from '../mdx/transform';

const Label = '/processor/js/render';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface RenderJsOptions extends ProcessOptions {
    applyLayout?: boolean;
    renderToIndex?: boolean;
    renderToE?: boolean;
    scope?: EvalScope;
    context?: EvalContext;
    scripts?: string[];
    beautify?: boolean;
}


/**
 * Compiles Mdx
 */
export async function process(site: Site, options: RenderJsOptions = {}) {
    const es = site.getEntitySet(options);
    const { reporter } = options;
    setLocation(reporter, Label);


    let ents = await selectJs(es, options);

    let updates = [];

    for (const e of ents) {
        const srcUrl = e.Src?.url;

        try {

            updates.push(await processEntity(site, e, undefined, options));

        } catch (err) {
            log('[error]', srcUrl, err.message);
            error(reporter, `error ${srcUrl}`, err, { eid: e.id });
            // log('[error]', es.getUrl(), es.componentDefs );
            updates.push(createErrorComponent(es, e, err, { from: Label }));
        }
    }

    await es.add(updates.filter(Boolean));

    return site;
}


async function processEntity(site: Site, e: Entity, child: TranspileResult, options: RenderJsOptions): Promise<Component> {

    const { es } = site;
    const { url: base } = e.Src;
    const applyLayout = options.applyLayout ?? true;

    const { data } = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};

    const { require } = await buildImports(site, e.id, options);

    function onConfig(config: any) { }


    if (meta.isEnabled === false) {
        return undefined;
    }

    if (meta.isRenderable === false && child === undefined) {
        return undefined;
    }


    let props: TranspileProps = { path, url: base };
    const layoutE = applyLayout ? await getLayoutFromDependency(es, e.id) : undefined;


    if (child !== undefined) {
        props.children = child.component;
    }
    // props.imgs = options.imgs;
    props = await applyCSSDependencies(es, e, child, props);


    let scripts = await getScriptDependencies(site, e);
    // log('[processEntity]', base, {scripts} );
    if (options.scripts) {
        scripts = [...scripts, ...options.scripts];
    }
    props.scriptSrcs = scripts;


    props.comProps = { e, es, site, page: e, ...options.props };



    let context = createRenderContext(site, e, options);
    if (options.context) {
        context = { ...context, ...options.context };
    }
    if (layoutE !== undefined) {
        context.layout = layoutE;
    }


    // scope vars which appear globally defined to the code
    const scope = {
        // site,
        // e,
        // page: e,
        // layout: undefined,
        ...options.scope
    }

    // reset requests
    beginServerEffects(base);

    // log('[processEntity]', base, {data} );

    let result: any = transformJS(data, props, { context, onConfig, require, scope });

    if (result.component === undefined) {
        // no default component found, so no render possible
        return undefined;
    }

    result.css = props.css;
    result.cssLinks = props.cssLinks;



    if (layoutE !== undefined) {
        let layoutScope = {
            ...options.scope,
            // e,
            // page: e,
            // layout: layoutE
        };
        let layoutContext = {
            ...context,
            e,
            page: e,
            layout: layoutE
        }
        // log('[processEntity]', base, 'eid', e.id);
        let com = await processEntity(site, layoutE, result,
            { ...options, context: layoutContext, scripts, scope: layoutScope });
        return setEntityId(com, e.id);
    }



    const { component } = result;
    let output;
    // log('[processEntity]', base, '>');
    // try {
    output = await transformComponent(component, props);
    // } catch (err ){
    //     log('[processEntity]', 'error', err);

    //     log( result );
    //     Process.exit(1);
    // }
    // log('[processEntity]', base, '<');


    // resolve all the server effects
    await endServerEffects(base);

    if (output === undefined) {
        return undefined;
    }

    // render again to reconcile any server effects
    output = await transformComponent(component, props);

    // replace any e:// urls with dst url links
    // we pass the context.e because this might be a layout render
    output = replaceEntityUrls(site, context.e, output);

    // if( base === 'file:///test/components.jsx' ){
    //     Process.exit(1);
    // }

    const mime = 'text/html';

    if (options.beautify) {
        output = BeautifyHTML(output);
    }
    return setEntityId(es.createComponent('/component/output', { data: output, mime }), e.id);
}


const hrefRe = /href="e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)"/gi;

/**
 * Looks through the data looking for entity urls and replaces
 * them with associated dst url
 * @param site 
 * @param data 
 */
function replaceEntityUrls(site: Site, e:Entity, data: string) {

    // this could arguably be a processor by itself

    data = data.replace( hrefRe, (val,eid,path) => {
        eid = toInteger(eid);
        let url = site.getEntityDstUrl( eid );
        log('[replaceEntityUrls]', e.id, {url, eid} );
        return url === undefined || eid === e.id ? '' : `href="${url}"`;
    })

    return data;
    // const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "gi");
    // return data.replace(re, (val, eid, path) => {
    //     let url = site.getEntityDstUrl( toInteger(eid) );

    //     // log('[replaceEntityUrls]', e.id, {path, eid, data, url} );

    //     return url === undefined ? '' : url;
    // });
}





async function applyCSSDependencies(es: QueryableEntitySet, e: Entity, child: TranspileResult, props: TranspileProps): Promise<TranspileProps> {
    // build css links and content from deps
    const cssEntries = await getEntityCSSDependencies(es, e);


    if (cssEntries === undefined) {
        return props;
    }

    
    let css = cssEntries.map(ent => ent.text).join('\n');
    let cssLinks = cssEntries.map(ent => ent.path);
    if (child !== undefined) {
        // log('[applyCSSDependencies]', e.id, {css, child:child.css});
        if( child.css !== undefined ){
            css = css + ' ' + child.css;
        }
        // log('[applyCSSDependencies]', child.cssLinks);

        cssLinks = Array.isArray(child.cssLinks) ? cssLinks.concat(child.cssLinks) : cssLinks;
        // cssLinks = [...cssLinks, ...child.cssLinks];
    }
    return { ...props, css, cssLinks };
}


async function getScriptDependencies(site: Site, e: Entity): Promise<string[]> {
    const { es } = site;
    const deps = await getDependencyComponents(es, e.id, ['script']);

    if (deps === undefined || deps.length === 0) {
        return [];
    }

    // log('[getScriptDependencies]', deps);

    const urlDid = es.resolveComponentDefId('/component/url');

    // const srcDid = es.resolveComponentDefId('/component/dst');

    // log('[getScriptDependencies]', url);

    let result = [];
    for (const dep of deps) {
        const dst = dep.dst;
        const urlCom = await es.getComponent(toComponentId(dst, urlDid));
        if (urlCom !== undefined) {
            result.push(urlCom.url);
        }
        else {
            const url = site.getEntityDstUrlIndexed(dst);
            if (url !== undefined) {
                result.push(url);
            }
        }
    }
    return result;
}