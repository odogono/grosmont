import PostCSS from 'postcss';
import PreCSS from 'precss';
import CSSNano from 'cssnano';
import AtImport from './plugin-import';


import { Site } from '../../site';
import { ImportDescr, ProcessOptions } from '../../types';
import { selectSrcByMime } from '../../query';
import { info, error, setLocation } from '../../reporter';
import { createErrorComponent, joinPaths, resolveImport } from '../../util';
import { Component, getComponentEntityId, setEntityId, toComponentId } from '../../../es';
import { applyImports } from '../js/util';


const Label = '/processor/scss';
const log = (...args) => console.log(`[${Label}]`, ...args);


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

            const {css, imports} = await renderScss(site, srcCom.url, scss, options);

            await applyImports(site, eid, imports, options);

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



interface RenderResult {
    css: string;
    imports: ImportDescr[];
}

/**
 * Renders an entity with an Scss component
 * 
 * @param es 
 * @param e 
 */
export async function renderScss(site: Site, srcUrl: string, scss: string, options: ProcessOptions = {}): Promise<RenderResult> {

    const minify = true;
    const { es } = site;
    let imports = [];

    const did = es.resolveComponentDefId('/component/scss');

    async function resolveSrc(src: string, parent: string) {
        let entry = resolveImport(site, src, parent);
        if (entry !== undefined) {
            const [eid, lurl, mime, srcUrl, dstUrl] = entry;
            const data = await site.getEntityData(eid);
            imports.push([eid, lurl, mime]);
            // const com = await es.getComponent( toComponentId(eid, did) );
            return data;
        }
        return undefined;
    }

    const plugins = [
        AtImport({ resolveSrc }),
        PreCSS,
        minify ? CSSNano : undefined
    ].filter(Boolean);

    let args = { from: srcUrl, to: '/' };
    const { css, ...rest } = await PostCSS(plugins)
        .process(scss, args);

    

    return {css, imports};
    // return { css, srcPath, dstPath };
}


