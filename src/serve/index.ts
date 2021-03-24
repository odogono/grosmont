require('stateful-hooks');
import Process from 'process';
import Fastify from 'fastify';
import FastifyAutoLoad from 'fastify-autoload';
import {FastifySSEPlugin} from "fastify-sse-v2";
import Path from 'path';
import Mitt, { Emitter } from 'mitt'
import Chokidar from 'chokidar';
import { Site } from '../builder/site';
import { buildProcessors, RawProcessorEntry, renderToOutput } from '../builder';
import { Reporter, setLocation, info, error, Level, setLevel } from '../builder/reporter';
import { EntityUpdate, SiteProcessor } from '../builder/types';
import { debounce } from '@odgn/utils';
import { ChangeSetOp } from '../es';


export interface RoutesConfig {
    config: Config;
}

interface Config {
    site: Site;
    process: SiteProcessor;
    emitter: Emitter;
}

const log = require('pino')({ level: 'info', prettyPrint: true });

// Require the framework and instantiate it
const fastify = Fastify({ logger: log });

fastify.register(require('fastify-routes'))
fastify.register(FastifySSEPlugin);

const [config] = Process.argv.slice(2);

if (config === undefined) {
    log('missing config');
    Process.exit(1);
}


const configPath = Path.resolve(config);


// Run the server!
const start = async () => {
    try {
        const emitter = Mitt();
        let { site, process } = await initialiseSite(configPath);

        // console.log( site.getEntity().Meta );

        await startWatcher( site, process, emitter );

        fastify.register(FastifyAutoLoad, {
            dir: Path.join(__dirname, 'routes'),
            options: { config: {emitter, site, process} }
        });

        // fastify.register(require('./routes/sse'), {options: {config: {site,process,emitter} }} );

        const port = site.getConfig('/serve/port', 3000);

        await fastify.listen(port)

        // console.log((fastify as any).routes);

    } catch (err) {
        fastify.log.error(err)
        Process.exit(1)
    }
}


start();



async function initialiseSite(path: string) {
    const reporter = new Reporter();
    setLocation(reporter, '/server');
    setLevel(reporter, Level.INFO);

    let site = await Site.create({ configPath: path, reporter });
    info(reporter, `config: ${path}`);
    info(reporter, `root: ${site.getSrcUrl()}`);

    const spec: RawProcessorEntry[] = [
        ['/query#clearUpdates', 1000],
        ['/query#clearErrors', 1000],
        ['/processor/file'],

        ['/processor/mark#statics'],
        ['/processor/mark#jsx'],
        ['/processor/mark#mdx'],
        ['/processor/mark#scss'],

        ['/processor/build_src_index'],
        
        ['/processor/mdx/parse'],
        ['/processor/apply_tags', 0, { type: 'tag' }],
        ['/processor/apply_tags', 0, { type: 'layout' }],
        ['/processor/mdx/resolve_meta'],
        ['/processor/build_dst_index'],


        ['/processor/scss', 0, { renderScss: true }],
        ['/processor/jsx/eval'],
        ['/processor/mdx/eval'],

        ['/processor/js/eval'],
        
        ['/processor/client_code'],
        
        ['/processor/build_dst_index'],

        ['/processor/js/render', 0, { beautify: true} ],
        ['/processor/build_dst_index', -99],
        ['/processor/write', -100],
        ['/processor/static/copy', -101],
    ]

    let process = await buildProcessors(site, spec, {onlyUpdated:true});

    await process(site);

    return { site, process };
}



async function startWatcher(site: Site, process:SiteProcessor, emitter:Emitter) {
    let changeQueue: EntityUpdate[] = [];
    const reporter = site.reporter;

    let processChangeQueue = debounce(async () => {
        setLocation(reporter, '/serve/change');
        info(reporter, `processing ${changeQueue.length} changes`);
        // await clearUpdates(site);
        await process(site, {});
        // await process(site, { updates: changeQueue });
        // await scanSrc(site, {updates: changeQueue});


        const eids = await site.getUpdatedEntityIds();
        // log('updated:', eids);
        let updates = [];
        for (const eid of eids) {
            let url = await site.getEntityDstUrl(eid);
            let srcUrl = await site.getEntitySrcUrl(eid);
            info(reporter, `update ${srcUrl} ${url}`, { eid });
            updates.push([url, srcUrl, eid]);
            // printEntity( site.es, await site.es.getEntity(eid) );
        }

        emitter.emit('/serve/e/update', updates);

        changeQueue = [];
    })

    Chokidar.watch(site.getSrcUrl()).on('all', async (event, path) => {
        let relPath = Path.sep + path.replace(site.getSrcUrl(), '');
        // log( '[change]', event, relPath );

        let op = ChangeSetOp.None;
        if (event === 'change') {
            op = ChangeSetOp.Update;
        } else if (event === 'add' || event === 'addDir') {
            op = ChangeSetOp.Add;
        } else if (event === 'unlink' || event === 'unlinkDir') {
            op = ChangeSetOp.Remove;
        }

        const eid = await site.getEntityIdBySrc('file://' + relPath);

        setLocation(reporter, '/serve/watch');
        info(reporter, `change - file://${relPath}`, { eid });

        if (eid !== undefined) {
            changeQueue.push([eid, op]);
            processChangeQueue();
        }
    })
}