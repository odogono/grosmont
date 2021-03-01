import Path from 'path';
import Fs, { pathExists } from 'fs-extra';

import { pathToFileURL } from 'url';
import { Site, SiteOptions } from './site';
import { process as scanSrc } from './processor/file';
import { process as markMdx } from './processor/mdx/mark';
import { process as mark } from './processor/mark';
import { process as markScss } from './processor/scss/mark';
import { process as markStatic } from './processor/static/mark';
import { process as assignMime } from './processor/assign_mime';
import { process as applyTags } from './processor/mdx/apply_tags';
import { process as mdxPreprocess } from './processor/mdx/parse';
import { process as mdxResolveMeta } from './processor/mdx/resolve_meta';
import { process as mdxRender } from './processor/mdx/render';
import { process as renderScss } from './processor/scss';
import { process as assignTitle } from './processor/assign_title';
import { process as write } from './processor/write';
import { process as copyStatic } from './processor/static/copy';
import { process as buildDstIndex } from './processor/dst_index';
import { EntityUpdate, ProcessOptions } from './types';
import { buildSrcIndex, clearUpdates } from './query';
import { Reporter } from './reporter';
import { printAll } from 'odgn-entity/src/util/print';


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

    await buildSrcIndex(site);

    await markStatic(site, updateOptions);

    await markMdx(site, updateOptions);

    await markScss(site, updateOptions);

    await mark(site, {...updateOptions, exts:['jsx', 'tsx'], comUrl:'/component/jsx', mime: 'text/jsx' });

    // await printAll( site.es );
    // await assignMime(site, updateOptions);

    await renderScss(site, updateOptions);


    // mdx
    await mdxPreprocess(site, updateOptions);

    await applyTags(site, updateOptions);
    // if( true ){

    await mdxResolveMeta(site, updateOptions);

    await mdxRender(site, updateOptions);

    await assignTitle(site, updateOptions);

    await buildDstIndex(site, { reporter });

    await write(site, updateOptions);

    await copyStatic(site, updateOptions);

    // }

    return site;
}




