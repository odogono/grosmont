import Path from 'path';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';


import { Entity, EntityId } from "odgn-entity/src/entity";

import { Site } from '../../site';
import { ProcessOptions } from '../../types';
import { selectScss, FindEntityOptions, getDstUrl, selectSrcByMime } from '../../query';
import { info, error, setLocation } from '../../reporter';
import { printEntity } from 'odgn-entity/src/util/print';
import { joinPaths } from '../../util';
import { Component, getComponentEntityId, setEntityId } from 'odgn-entity/src/component';



/**
 * Takes Entities with Scss components and processes them, 
 * putting the result into a text component
 * 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    const { reporter } = options;
    setLocation(reporter, '/processor/scss');

    // select scss entities
    // const ents = await selectScss(es, options);
    const srcComs = await selectSrcByMime(es, ['text/scss'], options);
    let addComs = [];

    for (let srcCom of srcComs) {
        const eid = getComponentEntityId(srcCom);
        const { url } = srcCom;

        try {
            const { css, srcPath, dstPath } = await renderScss(site, srcCom, options);
            
            let com = es.createComponent( '/component/output', {data:css, mime:'text/css'} );
            addComs.push( setEntityId(com, eid) );



            // alter the target filename
            // const url = e.Src.url;
            // let filename = Path.basename(url);

            let dstUrl = await getDstUrl(es, eid);

            if( dstUrl !== undefined ){
                let filename = dstUrl.substr(0, dstUrl.lastIndexOf(".")) + ".css";
    
                com = es.createComponent( '/component/dst', {url:filename} );
                addComs.push( setEntityId(com, eid) );
            }


            info(reporter, url, { eid: eid });

        } catch (err) {
            let com = es.createComponent('/component/error', { message: err.message, stack: err.stack });
            addComs.push( setEntityId(com, eid) );
            error( reporter, err.message, err);
            throw err;
        }
    }

    // apply changes
    // await es.add(ents);
    await es.add( addComs );

    return site;
}







interface RenderScssResult {
    css: string;
    srcPath: string;
    dstPath: string;
}


/**
 * Renders an entity with an Scss component
 * 
 * @param es 
 * @param e 
 */
export async function renderScss(site: Site, srcCom: Component, options: ProcessOptions = {}): Promise<RenderScssResult> {
    // if (e.Scss === undefined) {
    //     return { css: undefined, srcPath: undefined, dstPath: undefined };
    // }

    const eid = getComponentEntityId(srcCom);

    const dst = await getDstUrl(site.es, eid);
    let dstUrl = site.getDstUrl(dst);

    // const filename = getSrcUrl(e);
    const { url } = srcCom;
    const filename = Path.basename(url);


    let dstPath = joinPaths(dstUrl, filename);

    const scss = await site.getEntityData(eid);

    const srcPath = '/';
    // let scss = e.Scss?.data;
    // if( scss === undefined ){
    // scss = await site.readUrl( e.Src?.url );
    if (scss === undefined) {
        throw new Error(`scss data not found for ${eid}`);
    }
    // }

    const css = await render(scss, srcPath, dstPath, true);

    return { css, srcPath, dstPath };
}



async function render(data: string, srcPath: string, dstPath: string, minify: boolean = false) {
    const plugins = [
        PreCSS,
        GridKISS,
        minify ? CSSNano : undefined
    ].filter(Boolean);

    let args = { from: srcPath, to: dstPath };
    const { css: content } = await PostCSS(plugins).process(data, args);

    return content;
}


const log = (...args) => console.log('[ScssProc]', ...args);