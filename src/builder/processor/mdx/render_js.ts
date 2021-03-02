import { Entity } from 'odgn-entity/src/entity';
import { findEntityByUrl, getDependencies, getLayoutFromDependency, insertDependency, selectJs } from '../../query';
import { setLocation, info, debug, error } from '../../reporter';
import { Site } from '../../site';


import { ProcessOptions, TranspileProps, TranspileResult } from '../../types';
import { componentToString, jsToComponent, mdxToJs } from './transpile';
import { buildProps, getEntityCSSDependencies, resolveImport } from './util';
import { parse as parseConfig } from '../../config';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { Component, setEntityId } from 'odgn-entity/src/component';
import { toInteger } from '@odgn/utils';
import { buildImports } from './eval_js';

const Label = '/processor/mdx/render_js';
const log = (...args) => console.log(`[${Label}]`, ...args);


/**
 * Compiles Mdx
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    // let fileIndex = site.getIndex('/index/srcUrl');
    // let linkIndex = site.getIndex('/index/links', true);
    // let imgIndex = site.getIndex('/index/imgs', true);

    let ents = await selectJs(es, options);

    let updates = [];

    for (const e of ents) {

        try {

            updates.push( await processEntity(site, e, undefined, options) );

        } catch (err) {
            let ee = es.createComponent('/component/error', { message: err.message, from: Label });
            ee = setEntityId(ee, e.id);
            error(reporter, 'error', err, { eid: e.id });
        }
    }

    await es.add( updates.filter(Boolean) );

    return site;
}


async function processEntity(site: Site, e: Entity, child: TranspileResult, options: ProcessOptions):Promise<Component> {

    const { es } = site;
    const siteRef = site.getRef();
    const { fileIndex } = options;
    const { url: base } = e.Src;

    const {data} = e.Js;
    let path = site.getSrcUrl(e);
    let meta = e.Meta?.meta ?? {};

    const resolveImportLocal = (path: string, mimes?: string[]) => undefined;

    const require = await buildImports( site, e, options );


    if( meta.isEnabled === false ){
        return undefined;
    }

    if( meta.isRenderable === false && child === undefined ){
        return undefined;
    }

    let props:TranspileProps = {path};

    if (child !== undefined) {
        props.children = child.component;
    }
    props.applyLinks = options.pageLinks;
    // props.imgs = options.imgs;
    props = await applyCSSDependencies(es, e, child, props);


    
    let result:any = jsToComponent(data, props, { resolveImport: resolveImportLocal, require });

    result.css = props.css;
    result.cssLinks = props.cssLinks;

    // log('[processEntity]', base, Object.keys(result) );

    const layoutE = await getLayoutFromDependency(es, e.id);

    if( layoutE !== undefined ){
        let com = await processEntity( site, layoutE, result, options );
        return setEntityId( com, e.id );
    }

    // result = await renderLayoutEntity(site, e, result, options);

    const {component} = result;

    let output = componentToString( component, props, { resolveImport: resolveImportLocal, require });

    // replace any e:// urls with dst url links
    output = replaceEntityUrls(site, output);

    const mime = 'text/html';
    return setEntityId( es.createComponent('/component/output', {data:output, mime}), e.id);
}


function replaceEntityUrls( site:Site, data:string ){
    const idx = site.getIndex('/index/dstUrl');
    // log('[replaceEntityUrls]', idx);

    const re = new RegExp("e:\/\/([0-9]+)([-a-zA-Z0-9()@:%_+.~#?&//=]*)", "gi");
    return data.replace( re, (val, eid, path) => {
        let url = idx.getByEid( toInteger(eid) );
        // log('[replaceEntityUrls]', val, eid, url);
        return url;
    });
}



async function renderLayoutEntity(site: Site, src: Entity, child: TranspileResult, options: ProcessOptions) {
    const { es } = site;

    if (child === undefined || child.meta.layout === undefined) {
        return child;
    }

    const layoutE = await getLayoutFromDependency(es, src.id);

    // log('[renderLayoutEntity]', 'returned', layoutE.id, 'for', src.id );

    // log('[renderLayoutEntity]', layoutE );
    // printEntity(es, layoutE);

    if (layoutE === undefined) {
        return child;
    }

    return await processEntity(site, layoutE, child, options);
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


