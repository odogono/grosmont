
import { Site, SiteOptions } from './site';
import { process as scanSrc } from './processor/file';
import { process as evalJsx } from './processor/jsx/eval_jsx';
import { process as evalJs } from './processor/mdx/eval_js';
import { process as renderJs } from './processor/mdx/render_js';
import { process as evalMdx } from './processor/mdx/eval_mdx';
import { process as resolveMeta } from './processor/mdx/resolve_meta';
import { process as mark } from './processor/mark';
import { process as applyTags } from './processor/mdx/apply_tags';
import { process as renderScss } from './processor/scss';
import { process as assignTitle } from './processor/assign_title';
import { process as write } from './processor/write';
import { process as copyStatic } from './processor/static/copy';
import { process as buildDstIndex } from './processor/dst_index';
import { EntityUpdate, ProcessOptions } from './types';
import { buildSrcIndex, clearUpdates } from './query';


export interface BuildProcessOptions extends ProcessOptions {
    updates?: EntityUpdate[];
}


/**
 * 
 * @param site 
 */
export async function build(site: Site, options: BuildProcessOptions = {}) {

    let reporter = site.reporter;
    const siteRef = site.getRef();
    const updateOptions = { onlyUpdated: true, reporter, siteRef };

    // clear /component/update from site
    await clearUpdates(site.es, { siteRef });

    await scanSrc(site, updateOptions); //{...options, reporter, siteRef});

    

    // await markStatic(site, updateOptions);

    await mark(site, { ...options, exts: ['html', 'jpeg', 'jpg', 'png', 'svg', 'txt'], comUrl: '/component/static' });
    await mark(site, { ...options, exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    await mark(site, { ...options, exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' })
    await mark(site, { ...options, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    await buildSrcIndex(site);

    await renderScss(site, updateOptions);

    await evalJsx(site, updateOptions);

    // creates a /component/js with the data
    await evalMdx(site, updateOptions);

    await applyTags(site, updateOptions);
    // if( true ){

    // evaluates the js, and returns metadata
    await evalJs(site, updateOptions);

    // resolve meta with parents
    await resolveMeta( site, updateOptions );

    await buildDstIndex(site, updateOptions);

    // renders the js to /component/output
    await renderJs(site, updateOptions);

    await assignTitle(site, updateOptions);

    await buildDstIndex(site, updateOptions);

    await write(site, updateOptions);

    await copyStatic(site, updateOptions);

    return site;
}




