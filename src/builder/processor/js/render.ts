import Process from 'process';
import React from 'react';
import Jsonpointer from 'jsonpointer';
import { html as BeautifyHTML } from 'js-beautify';

import { getDependencyEntities, getDependencyComponents, getLayoutFromDependency, insertDependency, selectJs, getDstUrl } from '../../query';
import { setLocation, info, debug, error, warn } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileProps, TranspileResult, EvalContext, EvalScope } from '../../types';
import { createRenderContext, getEntityCSSDependencies, parseEntityUrl } from './util';
import {
    Component, setEntityId, toComponentId,
    QueryableEntitySet,
    Entity,
    getDefId
} from '../../../es';

import { hash, toInteger } from '@odgn/utils';
import { buildImports } from './eval';
import { useServerEffect, serverEffectValue, beginServerEffects, endServerEffects } from '../jsx/server_effect';
import { createErrorComponent, replaceAsync } from '../../util';
import { transformComponent } from './transform';
import { transformJS } from '../mdx/transform';
import { printAll } from 'odgn-entity/src/util/print';


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
    disableSamePageLinks?: boolean;
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

    updates = updates.filter(Boolean);

    await es.add(updates);

    info(reporter, `processed ${ents.length}`);

    return site;
}


async function processEntity(site: Site, e: Entity, child: TranspileResult, options: RenderJsOptions): Promise<Component> {

    const { es } = site;
    const { url: base } = e.Src;
    const applyLayout = options.applyLayout ?? true;
    const { reporter } = options;
    const disableSamePageLinks = options.disableSamePageLinks ?? false;

    if (e.Js === undefined) {
        warn(reporter, `no /component/js found`, { eid: e.id });
        return undefined;
    }

    const { data } = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};
    const mime = e.Dst?.mime ?? 'text/html';

    const { require } = await buildImports(site, e.id, options);


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

    // log('[processEntity]', base );

    let result: any = transformJS(data, props, { context, require, scope });

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
    output = await replaceEntityUrls(site, context.e, output, disableSamePageLinks);

    // if( base === 'file:///test/components.jsx' ){
    //     Process.exit(1);
    // }

    if (options.beautify) {
        if (mime === 'text/html') {
            output = BeautifyHTML(output);
        }
    }
    return setEntityId(es.createComponent('/component/output', { data: output, mime }), e.id);
}


const hrefRe = /(href|src)="e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)"/gi;
const tmplRe = /{{e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)}}/gi;

/**
 * Looks through the data looking for entity urls and replaces
 * them with associated dst url
 * @param site 
 * @param data 
 */
async function replaceEntityUrls(site: Site, e: Entity, data: string, disableSelfLinks: boolean = false) {
    const { es } = site;

    // this could arguably be a processor by itself

    data = data.replace(hrefRe, (val, attr, eid, path) => {
        eid = toInteger(eid);

        let url = site.getEntityDstUrl(eid);
        // log('[replaceEntityUrls]', val, eid, path, {attr,url} );
        return url === undefined || (disableSelfLinks && eid === e.id) ? '' : `${attr}="${url}"`;
    })


    // do template replacements
    data = await replaceAsync(data, tmplRe, async (val, _eid, path) => {
        let { eid, did, attr } = parseEntityUrl(val);

        // log('[replaceEntityUrls]', val, { eid, did, attr });

        // override the dst#url using the site index
        if( did === '/component/dst' && (attr === 'url' || attr === '/url') ){
            let url = site.getEntityDstUrl(eid);
            // log('[replaceEntityUrls]', 'dst', url);
            // log( site.getDstIndex() );
            return url !== undefined ? url : '';
        }

        const def = es.getByUri(did);

        let com = await es.getComponent(toComponentId(eid, getDefId(def)));
        if (com === undefined) {
            return '';
        }

        // log('[replaceEntityUrls]',  com);

        if (!attr.startsWith('/')) {
            attr = '/' + attr;
        }

        return Jsonpointer.get(com, attr);

        // return val;
    })

    return data;
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
        if (child.css !== undefined) {
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