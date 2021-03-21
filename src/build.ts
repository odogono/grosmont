import 'stateful-hooks';
import Util from 'util';
import Path from 'path';
import { Site, SiteOptions } from './builder/site';
import { build } from './builder';
import { Level } from './builder/reporter';
import { selectErrors } from './builder/query';
import { getComponentEntityId } from './es';

const log = (...args) => console.log('[odgn-ssg]', ...args);


const [config] = process.argv.slice(2);
const configPath = Path.resolve(config);



(async () => {
    log('config', Path.resolve(config));
    log('building from', { configPath });

    const site = await Site.create({ configPath, level: Level.INFO });

    await build(site);

    const errors = await selectErrors(site.es, { siteRef: site.getRef() });

    if (errors.length > 0) {
        for (const err of errors) {
            const eid = getComponentEntityId(err);
            const e = await site.es.getEntity(eid, true);
            log('error', err.from);
            log('src', e.id, e.Src?.url);
            // log( err.message );
            log(Util.format(err.stack));
        }

    } else {
        // await printAll(site.es);
    }

})();

