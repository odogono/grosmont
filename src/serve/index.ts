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

const app = express();
const port = 3000;

const emitter = Mitt()

Chokidar.watch('.').on('all', (event, path) => {
    if (event === 'change') {
        console.log(event, path);

        emitter.emit('sse', { event: event, path });
    }
});

// app.use(serveStatic('dist') );

app.use(async (req, res, next) => {
    let originalUrl = parseUrl.original(req)
    let path = parseUrl(req).pathname

    // console.log('[ok]', originalUrl, path);

    // let out = Path.join(__dirname, '../../dist', path );

    const [exists, filePath] = await resolveRequestPath(path);

    if (!exists) {
        // console.log('[serveStatic] not found', path);
        return next();
    }

    console.log('[serveStatic]', path, filePath);

    if (filePath.endsWith('.html')) {
        const data = await Fs.readFile(filePath, 'utf8');

        res.send(data + clientDebug + clientHandler);
    }
    else {
        res.sendFile(filePath);
    }
})

// https://stackoverflow.com/a/50594265/2377677
app.get('/sseEvents', function (req, res) {

    try {


        console.log('[sseEvents]', 'connect');

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        })
        emitter.on('sse', e => {
            const { event, ...rest } = e;
            res.write(`event: ${event}\n`);
            res.write("data: " + JSON.stringify(rest) + "\n\n")
            console.log('[sseEvents]', e);
        });

        setTimeout(() => {
            res.write(`event: initial\n`)
            res.write('data: ' + JSON.stringify({ evt: 'connected' }) + '\n\n');
        }, 1000);

        // countdown(res, 15);
    } catch (err) {
        console.warn('[sseEvents]', err);
    }
})

function countdown(res, count) {
    res.write("data: " + count + "\n\n")
    if (count)
        setTimeout(() => countdown(res, count - 1), 1000)
    else
        res.end()
}

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))



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

const clientDebug = `
<h1>SSE: <span id="state"></span></h1>
<h3>Data: <span id="data"></span></h3>
`;

const clientHandler = `
<script>
  if (!!window.EventSource) {
    var source = new EventSource('/sseEvents')

    source.addEventListener('message', function(e) {
        console.log('[sse][message]', e);
      document.getElementById('data').innerHTML = e.data
    }, false)

    source.addEventListener('initial', function(e) {
        console.log('[sse][initial]', e);
      document.getElementById('data').innerHTML = e.data
    }, false)
    
    source.addEventListener('change', function(e) {
        console.log('[sse][change]', e);
      document.getElementById('data').innerHTML = JSON.parse(e.data);
    }, false)

    source.onmessage = (evt) => {
        console.log('[sseEvents]', evt );
    }

    source.addEventListener('open', function(e) {
      document.getElementById('state').innerHTML = "Connected"
    }, false)

    source.addEventListener('error', function(e) {
        console.log('[sseEvents][error]', e );
      const id_state = document.getElementById('state')
      if (e.eventPhase == EventSource.CLOSED)
        source.close()
      if (e.target.readyState == EventSource.CLOSED) {
        id_state.innerHTML = "Disconnected"
      }
      else if (e.target.readyState == EventSource.CONNECTING) {
        id_state.innerHTML = "Connecting..."
      }
    }, false)
  } else {
    console.log("Your browser doesn't support SSE")
  }
  </script>
`


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