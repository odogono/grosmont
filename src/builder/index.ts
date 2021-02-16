import Path from 'path';
import Fs, { pathExists } from 'fs-extra';

import { pathToFileURL } from 'url';
import { Site, SiteOptions } from './site';
import { process as scanSrc } from './processor/file';
import { process as markMdx } from './processor/mdx/mark';
import { process as markScss } from './processor/scss/mark';
import { process as assignMime } from './processor/assign_mime';
import { process as mdxPreprocess } from './processor/mdx/parse';
import { process as mdxResolveMeta } from './processor/mdx/resolve_meta';
import { process as mdxRender } from './processor/mdx/render';
import { process as renderScss } from './processor/scss';
import { process as assignTitle } from './processor/assign_title';
import { process as write } from './processor/write';
import { process as buildDstIndex } from './processor/dst_index';
import { EntityUpdate, ProcessOptions } from './types';
import { clearUpdates } from './query';
import { Reporter } from './reporter';


export interface BuildProcessOptions extends ProcessOptions {
    updates?: EntityUpdate[];
}


/**
 * 
 * @param site 
 */
export async function build(site:Site, options:BuildProcessOptions = {}) {

    let reporter = new Reporter();
    const siteRef = site.e.id;
    const updateOptions = {onlyUpdated:true, reporter, siteRef};

    // clear /component/update from site
    await clearUpdates(site);

    await scanSrc(site, {...options, reporter});

    await markMdx(site, updateOptions);
    
    await markScss(site, updateOptions);

    await assignMime(site, updateOptions);

    await renderScss(site, updateOptions);

    if( true ){
    // mdx
    await mdxPreprocess(site, updateOptions);
    await mdxResolveMeta(site, updateOptions);
    await mdxRender(site, updateOptions);

    await assignTitle(site, updateOptions);

    await buildDstIndex(site, {reporter});

    await write(site, updateOptions);

    }

    return site;
}




