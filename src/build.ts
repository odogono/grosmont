import 'stateful-hooks';
import Util from 'util';
import Path from 'path';
import Yargs from 'yargs';
import { Site, SiteOptions } from './builder/site';
import { build } from './builder';
import { Level } from './builder/reporter';
import { selectErrors } from './builder/query';
import { getComponentEntityId } from './es';

const log = (...args) => console.log('[odgn-ssg]', ...args);


const argv = Yargs
    .usage('Usage: $0 [configPath]')
    .check((argv, options) => {
        if (argv._.length > 1) {
            throw new Error("path to config required.")
        }
        return true;
    })
    .option('reset', {
        alias: 'r',
        description: 'ignore update only flag when building',
        type: 'boolean'
    })
    .option('graph', {
        alias: 'g',
        description: 'outputs graphviz dot file',
        type: 'boolean'
    })
    .option('clear', {
        alias: 'c',
        description: 'clears existing data',
        type: 'boolean'
    })
    .help()
    .alias('help', 'h')
    .argv;


const [config] = argv._;
const configPath = Path.resolve(config);

const onlyUpdated = argv.reset === undefined ? true : false;

log('args', argv);

(async () => {
    log('config', Path.resolve(config));
    log('building from', { configPath });

    const site = await Site.create({ configPath, level: Level.INFO });

    let options:any = {onlyUpdated};

    if( argv.graph ){
        let path = Path.dirname(configPath);
        let filename = Path.basename(configPath, Path.extname(configPath));
        options = {
            ...options,
            // '/processor/graph_gen': {
                type:'png',
                path: Path.join(path, filename + '.png')
            // }
        }
    }

    await build(site, options);

    const errors = await selectErrors(site.es, { siteRef: site.getRef() });

    log('src index:');
    for (const [key, [eid]] of site.getSrcIndex()) {
        log(eid, key);
    }

    log('dst index:');
    for (const [key, [eid]] of site.getDstIndex()) {
        log(eid, key);
    }

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

