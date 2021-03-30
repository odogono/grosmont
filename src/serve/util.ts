import { renderToOutput } from "../builder";
import { getDependencyEntities, getDependencyOfEntities } from "../builder/query";
import { Site } from "../builder/site";
import { EntityId, Entity, toComponentId } from "../es";
import { SiteProcessor } from "../builder/types";
import { applyMeta } from "../builder/util";
import { QueryableEntitySet } from "odgn-entity/src/entity_set/queryable";


/**
 * 
 * @param site 
 * @param eid 
 * @returns 
 */
export async function buildEntityDisplay(site: Site, process:SiteProcessor, eid: EntityId) {
    const e = await site.es.getEntity(eid, true);
    const props = { e, eid, es: site.es };

    console.log('### props', {props} );

    if( e === undefined ){
        return `e ${eid} not found`;
    }

    return renderEntityOutput(site, process, 'file:///admin/entity.tsx', props);
}

/**
 * 
 * @param site 
 * @param eid 
 * @returns 
 */
 export async function buildEntityDepsDisplay(site: Site, process:SiteProcessor, eid: EntityId) {
    const { es }= site;
    const e = await site.es.getEntity(eid, true);

    if( e === undefined ){
        return `e ${eid} not found`;
    }

    let deps = await getDependencyEntities(site.es, eid);

    // add the src url of the dst to each dep
    deps = await Promise.all(deps.map(async dep => buildDepData(site,dep) ));
        

    const props = { e, es: site.es, deps };

    return renderEntityOutput(site, process, 'file:///admin/entity_deps.tsx', props);
}

export async function buildEntityDepsOfDisplay(site: Site, process:SiteProcessor, eid: EntityId) {
    const e = await site.es.getEntity(eid, true);

    if( e === undefined ){
        return `e ${eid} not found`;
    }

    let deps = await getDependencyOfEntities(site.es, eid);

    // add the src url of the dst to each dep
    deps = await Promise.all(deps.map(async dep => buildDepData(site,dep) ));
    
    const props = { e, es: site.es, deps };

    return renderEntityOutput(site, process, 'file:///admin/entity_deps_of.tsx', props);
}


async function buildDepData( site:Site, e:Entity ){
    const {es} = site;
    const type = e.Dep.type;
    let dst = e.Dep.dst ?? 0;
    if (dst === 0) {
        return e;
    }
    let meta:any = {};
    if( type === 'tag' ){
        const did = es.resolveComponentDefId('/component/title');
        let com = await es.getComponent( toComponentId(dst, did) );
        meta.label = com.title;
    }
    else {
        meta.label = await site.getEntitySrcUrl(dst);
    }
    return applyMeta(e, meta );
}

export async function renderEntityOutput(site: Site, process:SiteProcessor, src: string, props: any = {}) {
    let displayE = await site.getEntityBySrc(src);

    if (displayE === undefined) {
        return '';
    }

    try {
        const output = await renderToOutput(site, process, displayE.id, props);

        if (output !== undefined) {
            return output.data;
        }
    } catch (err) {
        console.log('[error]', err.stack);
        console.log('[error]', site.es.getUrl());
    }
    return ``;
}



// async function resolveRequestPath(path: string): Promise<[boolean, string]> {
//     const root = Path.join(__dirname, '../../dist');
//     let out = Path.join(root, path);

//     const exists = await Fs.pathExists(out);

//     if (!exists) {
//         return [false, undefined];
//     }

//     const stats = await Fs.stat(out);

//     if (stats.isDirectory()) {
//         let index = Path.join(out, 'index.html');
//         const indexExists = await Fs.pathExists(index);
//         return indexExists ? [true, index] : [false, undefined];
//     }

//     return [true, out];
// }


// /**
//  * @param {string} root
//  * @param {object} [options]
//  * @return {function}
//  * @public
//  */

// function serveStatic(root, options = {}) {
//     if (!root) {
//         throw new TypeError('root path required')
//     }

//     if (typeof root !== 'string') {
//         throw new TypeError('root path must be a string')
//     }

//     // copy options object
//     var opts = Object.create(options || null)

//     // fall-though
//     var fallthrough = opts.fallthrough !== false

//     // default redirect
//     var redirect = opts.redirect !== false

//     // headers listener
//     var setHeaders = opts.setHeaders

//     if (setHeaders && typeof setHeaders !== 'function') {
//         throw new TypeError('option setHeaders must be function')
//     }

//     // setup options for send
//     opts.maxage = opts.maxage || opts.maxAge || 0
//     opts.root = Path.resolve(root)

//     // construct directory listener
//     var onDirectory = redirect
//         ? createRedirectDirectoryListener()
//         : createNotFoundDirectoryListener()

//     return function serveStatic(req, res, next) {
//         if (req.method !== 'GET' && req.method !== 'HEAD') {
//             if (fallthrough) {
//                 return next()
//             }

//             // method not allowed
//             res.statusCode = 405
//             res.setHeader('Allow', 'GET, HEAD')
//             res.setHeader('Content-Length', '0')
//             res.end()
//             return
//         }

//         var forwardError = !fallthrough
//         var originalUrl = parseUrl.original(req)
//         var path = parseUrl(req).pathname

//         // make sure redirect occurs at mount
//         if (path === '/' && originalUrl.pathname.substr(-1) !== '/') {
//             path = ''
//         }

//         // create send stream
//         var stream = send(req, path, opts)

//         // add directory handler
//         stream.on('directory', onDirectory)

//         // add headers listener
//         if (setHeaders) {
//             stream.on('headers', setHeaders)
//         }

//         // add file listener for fallthrough
//         if (fallthrough) {
//             stream.on('file', function onFile() {
//                 // once file is determined, always forward error
//                 forwardError = true
//             })
//         }

//         // forward errors
//         stream.on('error', function error(err) {
//             if (forwardError || !(err.statusCode < 500)) {
//                 next(err)
//                 return
//             }

//             next()
//         })

//         // pipe
//         stream.pipe(res);

//         console.log('[serveStatic]', originalUrl, path);

//     }
// }

// /**
//  * Collapse all leading slashes into a single slash
//  * @private
//  */
// function collapseLeadingSlashes(str) {
//     for (var i = 0; i < str.length; i++) {
//         if (str.charCodeAt(i) !== 0x2f /* / */) {
//             break
//         }
//     }

//     return i > 1
//         ? '/' + str.substr(i)
//         : str
// }

// /**
//  * Create a minimal HTML document.
//  *
//  * @param {string} title
//  * @param {string} body
//  * @private
//  */

// function createHtmlDocument(title, body) {
//     return '<!DOCTYPE html>\n' +
//         '<html lang="en">\n' +
//         '<head>\n' +
//         '<meta charset="utf-8">\n' +
//         '<title>' + title + '</title>\n' +
//         '</head>\n' +
//         '<body>\n' +
//         '<pre>' + body + '</pre>\n' +
//         '</body>\n' +
//         '</html>\n'
// }

// /**
//  * Create a directory listener that just 404s.
//  * @private
//  */

// function createNotFoundDirectoryListener() {
//     return function notFound() {
//         this.error(404)
//     }
// }

// /**
//  * Create a directory listener that performs a redirect.
//  * @private
//  */

// function createRedirectDirectoryListener() {
//     return function redirect(res) {
//         if (this.hasTrailingSlash()) {
//             this.error(404)
//             return
//         }

//         // get original URL
//         var originalUrl = parseUrl.original(this.req)

//         // append trailing slash
//         originalUrl.path = null
//         originalUrl.pathname = collapseLeadingSlashes(originalUrl.pathname + '/')

//         // reformat the URL
//         var loc = encodeUrl(url.format(originalUrl))
//         var doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml(loc) + '">' +
//             escapeHtml(loc) + '</a>')

//         // send redirect response
//         res.statusCode = 301
//         res.setHeader('Content-Type', 'text/html; charset=UTF-8')
//         res.setHeader('Content-Length', Buffer.byteLength(doc))
//         res.setHeader('Content-Security-Policy', "default-src 'none'")
//         res.setHeader('X-Content-Type-Options', 'nosniff')
//         res.setHeader('Location', loc)
//         res.end(doc)
//     }
// }

