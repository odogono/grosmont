import Chokidar from 'chokidar';
import express from 'express';
import parseUrl from 'parseurl';
import encodeUrl from 'encodeurl';
import escapeHtml from 'escape-html';
import Path from 'path';
import Fs from 'fs-extra';
import send from 'send';
import url from 'url';
import Mitt from 'mitt'
import { Site } from '../builder/site';
import { build } from '../builder';
import { process as scanSrc } from '../builder/processor/file';
import { debounce } from '../util/debounce';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntityUpdate } from '../builder/types';
import { clearUpdates } from '../builder/query';
import Day from 'dayjs';
import { EntityId } from 'odgn-entity/src/entity';
import { toInteger } from 'odgn-entity/src/util/to';
import { parseUri } from '../util/uri';
const log = (...args) => console.log('[server]', ...args);

const app = express();
const port = 3000;

const emitter = Mitt();

let site:Site;

const [config] = process.argv.slice(2);
const configPath = Path.resolve(config);


// Chokidar.watch('.').on('all', (event, path) => {
//     if (event === 'change') {
//         console.log(event, path);

//         emitter.emit('sse', { event: event, path });
//     }
// });

// __dirname, '../../dist'

const clientHandlerPath = Path.join(__dirname, 'client.js');
const debugHTMLPath = Path.join(__dirname, 'debug.html');

const clientHandler = '<script>' + Fs.readFileSync( clientHandlerPath, 'utf-8' ) + '</script>';

const debugHTML = Fs.readFileSync( debugHTMLPath, 'utf-8' );


async function onStart(){
    log(`listening at http://localhost:${port}`);
    
    site = await Site.create({configPath});
    log('config', configPath );
    log('root', site.getSrcUrl() );

    await build(site);

    // await printAll(site.es);

    log('index', site.getIndex('/index/dstUrl').index );

    let changeQueue:EntityUpdate[] = [];

    
    let processChangeQueue = debounce( async () => {
        // log('[cq]', changeQueue );
        // await clearUpdates(site);
        await build(site, {updates:changeQueue});
        // await scanSrc(site, {updates: changeQueue});


        const eids = await site.getUpdatedEntityIds();
        log('updated:');
        let updates = [];
        for( const eid of eids ){
            let url = await site.getEntityDstUrl( eid );
            let srcUrl = await site.getEntitySrcUrl( eid );
            log( eid, srcUrl, url );
            updates.push( [url, srcUrl, eid ] );
            // printEntity( site.es, await site.es.getEntity(eid) );
        }

        emitter.emit( '/serve/e/update', updates );
        

        changeQueue = [];
    } )

    Chokidar.watch( site.getSrcUrl() ).on('all', async (event, path) => {
        let relPath = Path.sep + path.replace( site.getSrcUrl(), '' );
        // log( '[change]', event, relPath );

        let op = ChangeSetOp.None;
        if( event === 'change' ){
            op = ChangeSetOp.Update;
        } else if( event === 'add' || event === 'addDir' ){
            op = ChangeSetOp.Add;
        } else if( event === 'unlink' || event === 'unlinkDir' ){
            op = ChangeSetOp.Remove;
        }
        
        const eid = await site.getEntityIdBySrc( 'file://' + relPath );
        
        log('[change]', 'file://' + relPath, eid, op);
        
        if( eid !== undefined ){
            changeQueue.push( [eid,op] );
            processChangeQueue();
        }
        
    })
}

// https://stackoverflow.com/a/50594265/2377677
app.get('/sseEvents', function (req, res) {
    let originalUrl = parseUrl.original(req)
    let path = parseUrl(req).pathname;
    let query = parseUri(originalUrl.href).queryKey;

    try {
        log('[sseEvents]', 'connect', originalUrl.href);
        let {e:rEid,path:rPath} = query;
        rEid = toInteger(rEid);


        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        req.on('close', () => {
            log('[sseEvents]', 'disconnected.');
            // clearTimeout(manualShutdown)  // prevent shutting down the connection twice
          })

        emitter.on('sse', e => {
            const { event, ...rest } = e;
            res.write(`event: ${event}\n`);
            res.write("data: " + JSON.stringify(rest) + "\n\n")
            log('[/sse]', e);
        });

        emitter.on('/serve/e/update', (updates) => {
            log('[/serve/e/update]', updates);
            const update = updates.find( ([url,srcUrl,eid]) => eid === rEid );
            if( update !== undefined ){
                res.write(`event: reload\n`);
                res.write("data: " + JSON.stringify(update) + "\n\n");
            }
        });

        setTimeout(() => {
            res.write(`event: initial\n`)
            res.write('data: ' + JSON.stringify({ evt: 'connected' }) + '\n\n');
        }, 1000);

        heartbeat(res);

        // countdown(res, 15);
    } catch (err) {
        console.warn('[sseEvents]', err);
    }
})

function heartbeat( res ){
    // log('[heartbeat]');
    res.write("event: ping\n");
    res.write(`data: ${Day().toISOString()}\n\n`);
    setTimeout( () => heartbeat(res), 10000);
}

app.use(async (req, res, next) => {
    let originalUrl = parseUrl.original(req)
    let path = parseUrl(req).pathname

    
    log('[ok]', originalUrl.href, path);


    // let out = Path.join(__dirname, '../../dist', path );

    const e = site.getEntityIdByDst(path);

    if( e !== undefined ){
        log('found', e);
        let text = await site.getEntityText( e );
        if( text !== undefined ){
            let [data,mime] = text;

            if( mime === 'text/html' ){
                res.send( data + debugHTML + clientIdHeader(e,path) + clientHandler );
            } else {
                res.send( data );
            }

            return;
        }
    }

    const [exists, filePath] = await resolveRequestPath(path);

    if (!exists) {
        // console.log('[serveStatic] not found', path);
        return next();
    }

    console.log('[serveStatic]', path, filePath);

    if (filePath.endsWith('.html')) {
        const data = await Fs.readFile(filePath, 'utf8');

        res.send(data + debugHTML + clientHandler);
    }
    else {
        res.sendFile(filePath);
    }
})

function clientIdHeader(eid:EntityId, path:string){
    return `
    <script>window.odgnServe = { eid: ${eid}, path:'${path}' };</script>
    `;
}


function countdown(res, count) {
    res.write("data: " + count + "\n\n")
    if (count)
        setTimeout(() => countdown(res, count - 1), 1000)
    else
        res.end()
}

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, onStart);



async function resolveRequestPath(path: string): Promise<[boolean, string]> {
    const root = Path.join(__dirname, '../../dist');
    let out = Path.join(root, path);

    const exists = await Fs.pathExists(out);

    if (!exists) {
        return [false, undefined];
    }

    const stats = await Fs.stat(out);

    if (stats.isDirectory()) {
        let index = Path.join(out, 'index.html');
        const indexExists = await Fs.pathExists(index);
        return indexExists ? [true, index] : [false, undefined];
    }

    return [true, out];
}


/**
 * @param {string} root
 * @param {object} [options]
 * @return {function}
 * @public
 */

function serveStatic(root, options = {}) {
    if (!root) {
        throw new TypeError('root path required')
    }

    if (typeof root !== 'string') {
        throw new TypeError('root path must be a string')
    }

    // copy options object
    var opts = Object.create(options || null)

    // fall-though
    var fallthrough = opts.fallthrough !== false

    // default redirect
    var redirect = opts.redirect !== false

    // headers listener
    var setHeaders = opts.setHeaders

    if (setHeaders && typeof setHeaders !== 'function') {
        throw new TypeError('option setHeaders must be function')
    }

    // setup options for send
    opts.maxage = opts.maxage || opts.maxAge || 0
    opts.root = Path.resolve(root)

    // construct directory listener
    var onDirectory = redirect
        ? createRedirectDirectoryListener()
        : createNotFoundDirectoryListener()

    return function serveStatic(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (fallthrough) {
                return next()
            }

            // method not allowed
            res.statusCode = 405
            res.setHeader('Allow', 'GET, HEAD')
            res.setHeader('Content-Length', '0')
            res.end()
            return
        }

        var forwardError = !fallthrough
        var originalUrl = parseUrl.original(req)
        var path = parseUrl(req).pathname

        // make sure redirect occurs at mount
        if (path === '/' && originalUrl.pathname.substr(-1) !== '/') {
            path = ''
        }

        // create send stream
        var stream = send(req, path, opts)

        // add directory handler
        stream.on('directory', onDirectory)

        // add headers listener
        if (setHeaders) {
            stream.on('headers', setHeaders)
        }

        // add file listener for fallthrough
        if (fallthrough) {
            stream.on('file', function onFile() {
                // once file is determined, always forward error
                forwardError = true
            })
        }

        // forward errors
        stream.on('error', function error(err) {
            if (forwardError || !(err.statusCode < 500)) {
                next(err)
                return
            }

            next()
        })

        // pipe
        stream.pipe(res);

        console.log('[serveStatic]', originalUrl, path);

    }
}

/**
 * Collapse all leading slashes into a single slash
 * @private
 */
function collapseLeadingSlashes(str) {
    for (var i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) !== 0x2f /* / */) {
            break
        }
    }

    return i > 1
        ? '/' + str.substr(i)
        : str
}

/**
 * Create a minimal HTML document.
 *
 * @param {string} title
 * @param {string} body
 * @private
 */

function createHtmlDocument(title, body) {
    return '<!DOCTYPE html>\n' +
        '<html lang="en">\n' +
        '<head>\n' +
        '<meta charset="utf-8">\n' +
        '<title>' + title + '</title>\n' +
        '</head>\n' +
        '<body>\n' +
        '<pre>' + body + '</pre>\n' +
        '</body>\n' +
        '</html>\n'
}

/**
 * Create a directory listener that just 404s.
 * @private
 */

function createNotFoundDirectoryListener() {
    return function notFound() {
        this.error(404)
    }
}

/**
 * Create a directory listener that performs a redirect.
 * @private
 */

function createRedirectDirectoryListener() {
    return function redirect(res) {
        if (this.hasTrailingSlash()) {
            this.error(404)
            return
        }

        // get original URL
        var originalUrl = parseUrl.original(this.req)

        // append trailing slash
        originalUrl.path = null
        originalUrl.pathname = collapseLeadingSlashes(originalUrl.pathname + '/')

        // reformat the URL
        var loc = encodeUrl(url.format(originalUrl))
        var doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml(loc) + '">' +
            escapeHtml(loc) + '</a>')

        // send redirect response
        res.statusCode = 301
        res.setHeader('Content-Type', 'text/html; charset=UTF-8')
        res.setHeader('Content-Length', Buffer.byteLength(doc))
        res.setHeader('Content-Security-Policy', "default-src 'none'")
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Location', loc)
        res.end(doc)
    }
}