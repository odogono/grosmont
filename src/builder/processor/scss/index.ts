import Path from 'path';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';


import { Entity, EntityId } from "odgn-entity/src/entity";

import { joinPaths} from '../file';
import { Site } from '../../site';
import { ProcessOptions } from '../../types';
import { selectScss, FindEntityOptions, getDstUrl } from '../../query';



/**
 * Takes Entities with Scss components and processes them, 
 * putting the result into a text component
 * 
 */
export async function process(site: Site, options:ProcessOptions = {}) {
    const {es} = site;

    // select scss entities
    const ents = await selectScss(es, {...options, siteRef:site.e.id});

    for (let e of ents) {

        // const path = await selectTargetPath(es, e.id);
        // log('targetPath', e.id, path);
        // const filename = await selectTargetFilename(es, e.id);

        const {css, srcPath, dstPath} = await renderScss( site, e, options );
        e.Text = { data:css, mime: 'text/css' };


        // alter the target filename
        const url = e.Src.url;
        let filename = Path.basename(url);

        // const dstUrl = await getDstUrl(es, e.id);

        // log('dstUrl', dstUrl);

        filename = filename.substr(0, filename.lastIndexOf(".")) + ".css";
        e.Dst = { url:filename };
        
    }

    // printAll(es, ents);

    // apply changes
    await es.add( ents );

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
export async function renderScss(site: Site, e: Entity, options:ProcessOptions = {}): Promise<RenderScssResult> {
    if (e.Scss === undefined) {
        return { css: undefined, srcPath: undefined, dstPath: undefined };
    }

    // const siteTargetUri = await selectSiteTarget(es, e.SiteRef.ref);

    const dst = await getDstUrl(site.es, e.id);
    let dstUrl = site.getDstUrl( dst );

    // const targetUri = await resolveTarget(es, e);

    // // determine target using dir deps
    // const targetCom = await selectDirTarget(es, e.id);

    const filename = getSrcUrl(e);

    // let dstPath = targetCom !== undefined ?
    //     joinPaths(siteTargetUri, targetCom?.uri) :
    //     siteTargetUri;

    // log('[renderScss]', {targetUri, filename});

    let dstPath = joinPaths(dstUrl, filename);

    // log('siteTargetUri', siteTargetUri);
    // log('dstPath', dstPath);

    const srcPath = '/';
    let scss = e.Scss?.data;
    if( scss === undefined ){
        scss = await site.readUrl( e.Src?.url );
        if( scss === undefined ){
            throw new Error(`scss data not found for ${e.id}`);
        }
    }

    

    const css = await render(scss, srcPath, dstPath, true);

    return { css, srcPath, dstPath };
}


/**
 * 
 * @param e 
 */
function getSrcUrl(e: Entity) {
    if (e.Src !== undefined) {
        const url = e.Src.url;
        return Path.basename(url);
    }

    return undefined;
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