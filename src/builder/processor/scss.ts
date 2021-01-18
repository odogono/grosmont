import Path from 'path';
import Fs from 'fs-extra';

import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';

import { Component } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { selectSiteTarget } from './read_dir_meta';
import { joinPaths, writeFile } from './file';
import { resolveTarget, selectDirTarget } from './clear_target';
import { applyMeta } from '../util';



/**
 * Takes Entities with Scss components and processes them, 
 * putting the result into a text component
 * 
 */
export async function process(es: EntitySet) {

    // select scss entities
    const ents = await selectScss(es);

    for (let e of ents) {

        // const path = await selectTargetPath(es, e.id);
        // log('targetPath', e.id, path);
        // const filename = await selectTargetFilename(es, e.id);

        const {css, srcPath, dstPath} = await renderScss( es, e );
        e.Text = { data:css, mime: 'text/css' };

        // if( dstPath !== undefined && css !== undefined ){
        //     await writeFile(dstPath, css);
        // }
    }

    // printAll(es, ents);

    // apply changes
    await es.add( ents );
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

    const filename = selectFilename(e);

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
function selectFilename(e: Entity) {
    if (e.File !== undefined) {
        const uri = e.File.uri;
        return Path.basename(uri);
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