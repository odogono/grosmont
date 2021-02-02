import Path from 'path';
import Fs from 'fs-extra';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';

import { Component } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../../ecs";
import { joinPaths, writeFile } from '../file';
import { resolveTarget, selectDirTarget } from '../clear_target';
import { applyMeta } from '../../util';
import { Site } from '../../site';
import { getDstUrl } from '../dst_url';



/**
 * Takes Entities with Scss components and processes them, 
 * putting the result into a text component
 * 
 */
export async function process(site: Site) {
    const {es} = site;

    // select scss entities
    const ents = await selectScss(es);

    for (let e of ents) {

        // const path = await selectTargetPath(es, e.id);
        // log('targetPath', e.id, path);
        // const filename = await selectTargetFilename(es, e.id);

        const {css, srcPath, dstPath} = await renderScss( es, e );
        e.Text = { data:css, mime: 'text/css' };


        // alter the target filename
        const url = e.Src.url;
        let filename = Path.basename(url);

        const dstUrl = await getDstUrl(es, e.id);

        log('dstUrl', dstUrl);

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
export async function renderScss(es: EntitySet, e: Entity): Promise<RenderScssResult> {
    if (e.Scss === undefined) {
        return { css: undefined, srcPath: undefined, dstPath: undefined };
    }

    // const siteTargetUri = await selectSiteTarget(es, e.SiteRef.ref);

    const targetUri = await resolveTarget(es, e);

    // // determine target using dir deps
    // const targetCom = await selectDirTarget(es, e.id);

    const filename = getSrcUrl(e);

    // let dstPath = targetCom !== undefined ?
    //     joinPaths(siteTargetUri, targetCom?.uri) :
    //     siteTargetUri;

    // log('[renderScss]', {targetUri, filename});

    let dstPath = joinPaths(targetUri, filename);

    // log('siteTargetUri', siteTargetUri);
    // log('dstPath', dstPath);

    const srcPath = '/';
    const scss = e.Scss.data;

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


export async function selectScss(es: EntitySet): Promise<Entity[]> {
    const query = `[
        /component/scss !bf
        @e
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}


const log = (...args) => console.log('[ScssProc]', ...args);