import 'stateful-hooks';
import Path from 'path';
import { Site, SiteOptions } from './builder/site';
import { printAll } from 'odgn-entity/src/util/print';
import { build } from './builder';
import { Level } from './builder/reporter';

const log = (...args) => console.log('[odgn-ssg]', ...args);


const [config] = process.argv.slice(2);
const configPath = Path.resolve(config);



(async () => {
    log('config', Path.resolve(config));
    log('building from', { configPath });

    const site = await Site.create({configPath, level:Level.INFO});

    await build(site);
    
    await printAll(site.es);
})();

