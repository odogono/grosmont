import { Site } from '../../site';


import { process as preprocess } from './parse';
import { process as resolveMeta } from './resolve_meta';
import { process as render } from './render';
import { ProcessOptions } from '../../types';


const log = (...args) => console.log('[ProcMDX]', ...args);


/**
 * Compiles Mdx
 */
export async function process(site: Site, options:ProcessOptions = {}){
    
    // parse the mdx and pick out links,css,meta
    await preprocess( site );

    // resolve meta with parents
    await resolveMeta( site );

    // render the mdx into html
    await render( site );

    return site;
}
