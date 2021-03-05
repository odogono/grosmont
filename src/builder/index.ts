import Jsonpointer from 'jsonpointer';
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

const Label = '/build';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface BuildProcessOptions extends ProcessOptions {
    updates?: EntityUpdate[];
}


type ProcessorEntry = [ Function, number, any? ];

/**
 * 
 * @param site 
 */
export async function build(site: Site, options: BuildProcessOptions = {}) {

    let reporter = site.reporter;
    const siteRef = site.getRef();
    const updateOptions = { reporter, onlyUpdated: true, ...options, siteRef };

    let siteE = site.getEntity();
    let config = Jsonpointer.get(siteE, '/Meta/meta/processors');

    
    
    let processors:ProcessorEntry[] = [
        [ clearUpdates,     1000 ],
        [ scanSrc,          0 ],
        [ mark,             0, { exts: ['html', 'jpeg', 'jpg', 'png', 'svg', 'txt'], comUrl: '/component/static' } ],
        [ mark,             0, { exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' } ],
        [ mark,             0, { exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' } ],
        [ mark,             0, { exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' } ],
        [ buildSrcIndex,    0 ],
        [ renderScss,       0, {renderScss:true} ],
        [ evalJsx,          0 ],
        [ evalMdx,          0 ],
        [ applyTags,        0 ],
        [ evalJs,           0 ],
        [ resolveMeta,      0 ],
        [ buildDstIndex,    0, {url:'/processor/build_dst_index'} ],
        [ renderJs,         0 ],    
        [ buildDstIndex,    -99 ],
        [ write,            -100 ],
        [ copyStatic,       -101 ],
    ];

    const loaded = await parseProcessorConfig(config);
    processors = processors.concat(loaded);

    // sort according to priority descending
    processors.sort( ([a,ap],[b,bp]) => {
        if( ap < bp ){ return 1; }
        if( ap > bp ){ return -1; }
        return 0;
    });

    
    for( let [ prc, priority, options ] of processors ){
        options = options ?? {};
        await prc( site, {...updateOptions, ...options} );
    }

    
    // // clear /component/update from site
    // await clearUpdates(site, { siteRef });
    
    // await scanSrc(site, updateOptions); //{...options, reporter, siteRef});
    

    // // await markStatic(site, updateOptions);

    // await mark(site, { ...options, exts: ['html', 'jpeg', 'jpg', 'png', 'svg', 'txt'], comUrl: '/component/static' });
    // await mark(site, { ...options, exts: ['jsx', 'tsx'], comUrl: '/component/jsx', mime: 'text/jsx' })
    // await mark(site, { ...options, exts: ['mdx'], comUrl: '/component/mdx', mime: 'text/mdx' })
    // await mark(site, { ...options, exts: ['scss'], comUrl: '/component/scss', mime: 'text/scss' })

    // await buildSrcIndex(site);

    // await renderScss(site, updateOptions);

    // await evalJsx(site, updateOptions);

    // // creates a /component/js with the data
    // await evalMdx(site, updateOptions);

    // await applyTags(site, updateOptions);
    // // if( true ){

    // // evaluates the js, and returns metadata
    // await evalJs(site, updateOptions);

    // // resolve meta with parents
    // await resolveMeta( site, updateOptions );

    // await buildDstIndex(site, updateOptions);

    // // renders the js to /component/output
    // await renderJs(site, updateOptions);

    // await assignTitle(site, updateOptions);

    // await buildDstIndex(site, updateOptions);

    // await write(site, updateOptions);

    // await copyStatic(site, updateOptions);

    return site;
}




async function parseProcessorConfig( config:any[] ){
    let result:ProcessorEntry[] = [];

    for( const entry of config ){
        for( const pUrl of Object.keys(entry) ){
            let { priority, ...options } = entry[pUrl];
            log('proc', pUrl, priority, options );

            try {
                const { process } = await import( './' + pUrl );

                result.push( [ process, priority, options ] );
                
            } catch( err ){
                log('[parseProcessorConfig]', 'not found', pUrl );
            }

            // log(pUrl, module);
        }
    }

    return result;
}