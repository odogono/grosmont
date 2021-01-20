import { Site } from '../../ecs';


import { process as preprocess } from './parse';
import { process as resolveMeta } from './resolve_meta';
import { process as render } from './render';


const log = (...args) => console.log('[ProcMDX]', ...args);


/**
 * Compiles Mdx
 */
export async function process(site: Site){
    
    await preprocess( site );

    await resolveMeta( site );

    await render( site );

    return site;
}
