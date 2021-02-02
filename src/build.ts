// import Process from 'process';
import { EntitySetMem } from 'odgn-entity/src/entity_set';
import Path from 'path';
import { pathToFileURL } from 'url';
import { Site } from './builder/site';
import { printAll } from './builder/util';
import { process as scanSrc } from './builder/processor/file';
import { process as markMdx } from './builder/processor/mdx/mark';
import { process as markScss } from './builder/processor/scss/mark';
import { process as assignMime } from './builder/processor/assign_mime';
import { process as mdxPreprocess } from './builder/processor/mdx/parse';
import { process as mdxResolveMeta } from './builder/processor/mdx/resolve_meta';
import { process as mdxRender } from './builder/processor/mdx/render';
import { process as renderScss } from './builder/processor/scss';
import { process as assignTitle } from './builder/processor/assign_title';
import { process as write } from './builder/processor/write';


const log = (...args) => console.log('[odgn-ssg]', ...args);


const [ config ] = process.argv.slice(2);
// const configPath = pathToFileURL( Path.resolve(config) ).href;
const configPath = Path.resolve(config);
// const rootPath = Path.dirname(Path.resolve(config));

log('config', Path.resolve(config) );
log('building from', {configPath} );


Site.create({configPath}).then( async site => {

    // log('created', site);

    
    await scanSrc(site);
    await markMdx(site, {loadData:true});
    await markScss(site, {loadData:true});

    await assignMime(site);

    await renderScss(site);

    // mdx
    await mdxPreprocess( site );
    await mdxResolveMeta( site );
    await mdxRender( site );
  
    await assignTitle(site);

    await write(site);

    printAll(site.es as EntitySetMem);
});