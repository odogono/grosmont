import React from 'react';
import { Entity } from 'odgn-entity/src/entity';
import { getLayoutFromDependency, insertDependency, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileProps, TranspileResult, EvalScope } from '../../types';
import { createRenderContext, getEntityCSSDependencies } from './util';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { Component, setEntityId } from 'odgn-entity/src/component';
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

            updates.push( await processEntity(site, e, undefined, options) );

        } catch (err) {
            // log('[error]', srcUrl, err.message, err.stack );
            error(reporter, `error ${srcUrl}`, err, { eid: e.id });
            // log('[error]', es.getUrl(), es.componentDefs );
            updates.push( createErrorComponent(es, e, err, {from:Label}) );
        }
    }

    await es.add( updates.filter(Boolean) );

    return site;
}


async function processEntity(site: Site, e: Entity, child: TranspileResult, options: RenderJsOptions):Promise<Component> {

    const { es } = site;
    const { url: base } = e.Src;
    const applyLayout = options.applyLayout ?? true;

    const {data} = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};

    const require = await buildImports( site, e, options );

    function onConfig(config:any){}


    if( meta.isEnabled === false ){
        return undefined;
    }

    if( meta.isRenderable === false && child === undefined ){
        return undefined;
    }

    let props:TranspileProps = {path, url:base};

    if (child !== undefined) {
        props.children = child.component;
    }
    // props.imgs = options.imgs;
    props = await applyCSSDependencies(es, e, child, props);

    props.comProps = { ...options.props };

    // log('[processEntity]', base, options );
    
    const context = createRenderContext(site, e, options);
    
    const scope = {
        site,
        e,
        page: e,
        layout: undefined,
        ...options.scope
    }

    // reset requests
    beginServerEffects(base);
    
    let result:any = transformJS(data, props, { context, onConfig, require, scope });

    result.css = props.css;
    result.cssLinks = props.cssLinks;

    const layoutE = applyLayout ? await getLayoutFromDependency(es, e.id) : undefined;

    if( layoutE !== undefined ){
        let layoutScope = {
            ...options.scope,
            e,
            page: e,
            layout: layoutE
        }
        let com = await processEntity( site, layoutE, result, {...options, scope:layoutScope} );
        return setEntityId( com, e.id );
    }

    const {component} = result;

    let output = await transformComponent( component, props, { onConfig, require });

    
    // resolve all the server effects
    await endServerEffects(base);
    
    if( output === undefined ){
        return undefined;
    }

    // render again to reconcile any server effects
    output = await transformComponent( component, props, { require, onConfig });

    // replace any e:// urls with dst url links
    output = replaceEntityUrls(site, output);

    const mime = 'text/html';
    return setEntityId( es.createComponent('/component/output', {data:output, mime}), e.id);
}


/**
 * Looks through the data looking for entity urls and replaces
 * them with associated dst url
 * @param site 
 * @param data 
 */
function replaceEntityUrls( site:Site, data:string ){
    const idx = site.getIndex('/index/dstUrl');
    // log('[replaceEntityUrls]', data);

    const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "gi");
    return data.replace( re, (val, eid, path) => {
        let url = idx.getByEid( toInteger(eid) );
        // log('[replaceEntityUrls]', val, eid, url);
        return url;
    });
}





async function applyCSSDependencies(es: EntitySet, e: Entity, child: TranspileResult, props: TranspileProps): Promise<TranspileProps> {
    // build css links and content from deps
    const cssEntries = await getEntityCSSDependencies(es, e);

    // log('[applyCSSDependencies]', e.id, cssEntries);

    if (cssEntries === undefined) {
        return props;
    }

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


