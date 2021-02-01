// import Process from 'process';
import { EntitySetMem } from 'odgn-entity/src/entity_set';
import Path from 'path';
import { pathToFileURL } from 'url';
import { Site } from './builder/site';
import { printAll } from './builder/util';
import { process as scanSrc } from './builder/processor/file';
import { process as markMdx } from './builder/processor/mdx/mark';
import { process as markScss } from './builder/processor/scss/mark';

import { process as mdxPreprocess } from './builder/processor/mdx/parse';
import { process as mdxResolveMeta } from './builder/processor/mdx/resolve_meta';
import { process as mdxRender } from './builder/processor/mdx/render';
import { process as renderScss } from './builder/processor/scss';

const log = (...args) => console.log('[odgn-ssg]', ...args);


const [ config ] = process.argv.slice(2);
const configPath = pathToFileURL( Path.resolve(config) ).href;
const rootPath = process.cwd();// Path.resolve(__dirname);

log('building from', {configPath, rootPath} );


Site.create({configPath:configPath, rootPath}).then( async site => {

    // log('created', site);

    
    await scanSrc(site);
    await markMdx(site, {loadData:true});
    await markScss(site, {loadData:true});

    await renderScss(site);

    // mdx
    await mdxPreprocess( site );
    await mdxResolveMeta( site );
    await mdxRender( site );
    
    printAll(site.es as EntitySetMem);
});