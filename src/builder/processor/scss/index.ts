import PostCSS from 'postcss';
import PreCSS from 'precss';
import GridKISS from 'postcss-grid-kiss';
import CSSNano from 'cssnano';
import AtImport from './plugin-import';


import { Site } from '../../site';
import { ProcessOptions } from '../../types';
import { selectScss, FindEntityOptions, getDstUrl, selectSrcByMime } from '../../query';
import { info, error, setLocation } from '../../reporter';
import { createErrorComponent, joinPaths, resolveImport } from '../../util';
import { Component, getComponentEntityId, setEntityId, toComponentId } from '../../../es';


const Label = '/processor/scss';
const log = (...args) => console.log(`[${Label}]`, ...args);



/**
 * Loads data for entities which have /component/scss
 * 
 * @param site 
 * @param options 
 */
// export async function load(site: Site, options: ProcessOptions = {}) {
//     const es = options.es ?? site.es;
//     const { reporter } = options;
//     setLocation(reporter, Label + '/load');

//     const srcComs = await selectSrcByMime(es, ['text/scss'], options);
//     let addComs = [];

//     for (let srcCom of srcComs) {
//         const eid = getComponentEntityId(srcCom);

//         const data = await site.getEntityData(eid);

//         let com = es.createComponent('/component/scss', { data });
//         addComs.push(setEntityId(com, eid));

//         // log('loaded', srcCom.url );
//     }

//     await es.add(addComs);

//     return site;
// }

export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    // const ents = await selectScss(es, options);
    const srcComs = await selectSrcByMime(es, ['text/scss'], options);

    let addComs = [];

    for (let srcCom of srcComs) {
        const eid = getComponentEntityId(srcCom);

        
        
        // log('rendering', srcCom.url);
        try {
            const scss = await site.getEntityData(eid);

            const css = await renderScss( site, srcCom.url, scss, options );

            // log('rendered', srcCom.url, css);

            let com = es.createComponent('/component/output', { data: css, mime: 'text/css' });
            addComs.push(setEntityId(com, eid));

        } catch (err) {
            addComs.push(createErrorComponent(es, eid, err, { from: Label }));
            error(reporter, err.message, err);
            // throw err;
        }
    }

    await es.add(addComs);

    return site;
}




/**
 * Renders an entity with an Scss component
 * 
 * @param es 
 * @param e 
 */
 export async function renderScss(site: Site, srcUrl:string, scss: string, options: ProcessOptions = {}): Promise<string> {

    const minify = true;
    const {es} = site;

    const did = es.resolveComponentDefId('/component/scss');

    async function resolveSrc( src:string, parent:string ){
        let entry = resolveImport(site, src, parent);
        if (entry !== undefined) {
            const [eid, lurl, mime, srcUrl, dstUrl] = entry;
            const data = await site.getEntityData(eid);
            // const com = await es.getComponent( toComponentId(eid, did) );
            return data;
        }
        return undefined;
    }

    const plugins = [
        AtImport({resolveSrc}),
        PreCSS,
        GridKISS,
        minify ? CSSNano : undefined
    ].filter(Boolean);

    let args = { from: srcUrl, to: '/' };
    const { css, ...rest } = await PostCSS(plugins)
        .process(scss, args);

    return css;
    // return { css, srcPath, dstPath };
}



/**
 * Takes Entities with Scss components and processes them, 
 * putting the result into a text component
 * 
 */
// export async function processOld(site: Site, options: ProcessOptions = {}) {
//     const es = options.es ?? site.es;
//     const { reporter } = options;
//     setLocation(reporter, Label);

//     // select scss entities
//     // const ents = await selectScss(es, options);
//     const srcComs = await selectSrcByMime(es, ['text/scss'], options);
//     let addComs = [];

//     for (let srcCom of srcComs) {
//         const eid = getComponentEntityId(srcCom);
//         const { url } = srcCom;

//         try {
//             const { css, srcPath, dstPath } = await renderScss(site, srcCom, options);

//             let com = es.createComponent('/component/output', { data: css, mime: 'text/css' });
//             addComs.push(setEntityId(com, eid));

//             // alter the target filename

//             let dstUrl = await getDstUrl(es, eid);


//             if (dstUrl !== undefined) {
//                 // log('target', dstUrl);

//                 let ext = Path.extname(dstUrl);

//                 if (ext == '' || ext === '.scss') {
//                     ext = '.css';
//                 }

//                 // remove ext
//                 dstUrl = dstUrl.replace(/\.[^/.]+$/, "");

//                 // log('ext removed', dstUrl, ext);

//                 let filename = dstUrl + ext;

//                 com = es.createComponent('/component/dst', { url: filename });
//                 addComs.push(setEntityId(com, eid));
//             }

//             info(reporter, url, { eid: eid });

//         } catch (err) {
//             addComs.push(createErrorComponent(es, eid, err, { from: Label }));
//             error(reporter, err.message, err);
//             // throw err;
//         }
//     }

//     // apply changes
//     // await es.add(ents);
//     await es.add(addComs);

//     return site;
// }







interface RenderScssResult {
    css: string;
    srcPath: string;
    dstPath: string;
}



// async function render(data: string, srcPath: string, dstPath: string, minify: boolean = false) {
//     const plugins = [
//         AtImport(),
//         PreCSS,
//         GridKISS,
//         minify ? CSSNano : undefined
//     ].filter(Boolean);

//     let args = { from: srcPath, to: dstPath };
//     const { css: content, ...rest } = await PostCSS(plugins)
//         .process(data, args);

//     // log('[render]', rest);

//     return content;
// }


