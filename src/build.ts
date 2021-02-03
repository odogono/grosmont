// import Process from 'process';
import { EntitySetMem } from 'odgn-entity/src/entity_set';
import Path from 'path';
import { pathToFileURL } from 'url';
import { Site, SiteOptions } from './builder/site';
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
import { printAll } from 'odgn-entity/src/util/print';
import { build } from './builder';


const log = (...args) => console.log('[odgn-ssg]', ...args);


const [config] = process.argv.slice(2);
const configPath = Path.resolve(config);



(async () => {
    log('config', Path.resolve(config));
    log('building from', { configPath });

    const site = await Site.create({configPath});

    await build(site);
    
    await printAll(site.es);
})();

