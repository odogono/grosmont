import Path from 'path';
import { 
    ChangeSetOp,
    Entity, EntityId,
    Component, setEntityId,
    QueryableEntitySet
} from '../../../es';
import { getDependencyEntityIds, getUrlComponent, insertDependency, selectEntitiesByMime } from '../../query';
import { setLocation, info, debug, error, warn } from '../../reporter';
import { Site } from '../../site';


import { ClientCodeDetails, DependencyType, ProcessOptions, SiteIndex, TranspileOptions, TranspileProps, TranspileResult } from '../../types';
import { transformJSX } from '../../transpile';
import { applyImports, buildProps, resolveImport } from '../js/util';
import { parseEntity } from '../../config';
import { createErrorComponent, isUrlInternal, resolveUrlPath } from '../../util';
import { transformMdx } from './transform';

const Label = '/processor/mdx/eval';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface EvalMdxOptions extends ProcessOptions {
    linkIndex?: SiteIndex;
}

/**
 * Compiles Mdx
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    // options.fileIndex = site.getIndex('/index/srcUrl');
    // options.srcIndex = site.getIndex('/index/srcUrl');
    // options.linkIndex = site.getIndex('/index/links', true);
    // options.imgIndex = site.getIndex('/index/imgs', true);

    // select mdx entities
    // let ents = await selectMdx(es, options);
    let ents = await selectEntitiesByMime(es, ['text/mdx'], options);

    let output: Component[] = [];

    // first pass at parsing the mdx - pulling out links, local meta etc
    for (const e of ents) {
        const srcUrl = e.Src?.url;

        try {
            let coms = await processEntity(site, e, options);
            output = output.concat(coms);

            info(reporter, `${e.Src?.url}`, { eid: e.id });

        } catch (err) {
            output.push( createErrorComponent(es, e, err, {from:Label}) );
            error(reporter, `error ${srcUrl}`, err, { eid: e.id });
            // log(`error: ${srcUrl}`, err);
        }

    }

    await es.add(output);


    return site;
}



async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<Component[]> {

    const { es } = site;
    const siteRef = site.getRef();
    const { srcIndex } = options;
    const { url: base } = e.Src;
    const { reporter } = options;

    let imports = [];
    let links:LinkDescr[] = [];
    let meta = e.Meta?.meta ?? {};
    let config = {};

    // function passed into the mdx parser and called whenever
    // an import is found
    function resolveImportLocal(path: string, specifiers?: string[]): [string,boolean]|undefined {

        // if the path starts with http(s), then this is an import to the page,
        // most likely js
        if( !isUrlInternal(path) ){
            // log('[resolveImportLocal]', 'ext', path);
            let remove = path === '@site' ? false : true;
            if( remove ){
                links.push(['ext', undefined, path, undefined, 'script' ]);
            }
            return [path, remove];
        }

        let entry = resolveImport(site, path, base);
        // log('[resolveImportLocal]', path, specifiers, entry );
        if (entry !== undefined) {
            const [eid, url, mime, spec] = entry;
            let remove = (mime === 'text/css' || mime === 'text/scss');
            imports.push([eid,url,mime, specifiers]);
            
            return [url, remove];
        } else {
            warn(reporter, `import ${path} not resolved`, { eid: e.id });
        }
    }

    function onConfig( incoming: any ){
        config = {...config, ...incoming };
    }

    const require = (path: string, fullPath) => {
        // log('[processEntity]', path);
        return false;
    };

    const resolveLink = (url: string, text: string) => {
        // log('[resolveLink]', url);
        if (!isUrlInternal(url)) {
            links.push(['ext', undefined, url, text]);
            return url;
        }

        let entry = resolveImport(site, url, base);
        if (entry !== undefined) {
            links.push(['int', entry[0], url, text]);
            return entry[1];
        }

        return url;
    }

    async function resolveData( srcUrl:string, text?:string, type:DependencyType = 'img' ){
        if (!isUrlInternal(srcUrl)) {
            links.push(['ext', undefined, srcUrl, text, type]);
            warn(reporter, `[resolveData] ${srcUrl} not resolved`, { eid: e.id });
            return undefined;
        }

        let entry = resolveImport(site, srcUrl, base);
        // log('[resolveData]', srcUrl, entry );
        if (entry === undefined) {
            warn(reporter, `[resolveData] ${srcUrl} not resolved`, { eid: e.id });
            return undefined;
        }
        
        let eid = entry[0];
        links.push(['int', entry[0], srcUrl, text, type]);
        
        
        return e !== undefined ? site.getEntityData( eid ) : undefined;
    }


    // deals with the client code plugin which will extract code designated to
    // be executed client side.
    async function registerClientCode( details:ClientCodeDetails ){
        
        // log('[registerClientCode]', details );

        const codeName = `code.${e.id}.js`;
        let codeUrl = Path.dirname(base) + Path.sep + codeName;
        codeUrl = codeUrl.replace('file://', 'src://');
        let codeE = await site.addSrc( codeUrl );
        codeE.Upd = {op: codeE.id === 0 ? ChangeSetOp.Add : ChangeSetOp.Update };
        codeE.Dst = {url:`file:///${codeName}`};

        let {imports:clientImports,components} = codeE.ClientCode ?? {imports:[], components:{}};

        for( let [code,path,spec] of details.imports ){
            let [url] = resolveImportLocal( path, spec as any );
            code = code.replace(path,url);

            // ensure we are not re-adding the same import
            const notFound = clientImports.findIndex( imp => imp[0] === code ) === -1;
            
            if( notFound ){
                clientImports.push( [code,url,spec] );
            }
            // log('[registerClientCode]', 'import', [code, url, undefined,spec]);
        }

        // imports = imports.concat( details.imports );
        components = {...components, ...details.components };
        codeE.ClientCode = {imports:clientImports, components};
        
        // log('[registerClientCode]', codeE.ClientCode );
        codeE = await site.update(codeE);
        // log('[registerClientCode]', '<');

        // log('[registerClientCode]', e.id, codeUrl, codeE.id );
        links.push(['int', codeE.id, codeUrl, undefined, 'script' ]);
    }


    let props = await buildProps(site, e);
    const { data } = props;
    let context = { site, e };

    // log('->', e.id, props);

    if (data === undefined) {
        return [];
    }

    const { js, jsx } = await mdxToJs(data, props, { 
        onConfig, 
        registerClientCode,
        resolveLink, resolveData, resolveImport: resolveImportLocal,
        require, context 
    });

    const jsCom = setEntityId(es.createComponent('/component/js', { data: js }), e.id);
    // const jsxCom = setEntityId(es.createComponent('/component/jsx', { data: jsx }), e.id);

    meta = {...meta, ...config};
    await parseEntity(es, meta, { add: true, e, siteRef });

    // creates link dependencies and adds to the link
    // index for use at the point of rendering
    await applyLinks(site, e, links, options);

    await applyImports(site, e, imports, options);

    return [jsCom];
}



type LinkDescr = [ 'ext'|'int', EntityId, string /*url*/, string? /*text*/, DependencyType? ];


async function applyLinks(site: Site, e: Entity, links:LinkDescr[], options: EvalMdxOptions) {
    const { es } = site;
    const existingIds = new Set(await getDependencyEntityIds(es, e.id, ['link', 'script']));

    for (let [type, linkEid, url, text, depType] of links) {
        if (type === 'ext') {
            linkEid = await getUrlEntityId(es, url, options);
        }

        let depId = await insertDependency(es, e.id, linkEid, depType ?? 'link');

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}


async function getUrlEntityId(es: QueryableEntitySet, url: string, options: EvalMdxOptions) {
    let com = await getUrlComponent(es, url, options);

    if (com === undefined) {
        com = es.createComponent('/component/url', { url });
        await es.add(com);
        return es.getUpdatedEntities()[0];
    }
    return com;
}



/**
 * 
 * @param data 
 * @param path 
 * @param options 
 */
 async function mdxToJs(mdxData: string, props: TranspileProps, options: TranspileOptions): Promise<TranspileResult> {
    let meta = props.meta ?? {};
    let { css, cssLinks: inputCssLinks, children } = props;
    const inPageProps = { ...meta, css, cssLinks: inputCssLinks };
    let processOpts = { ...options, pageProps: inPageProps };

    // convert the mdx to jsx
    let { jsx, ast } = await transformMdx(mdxData, processOpts);
    

    // log('[mdxToJs]', jsx);
    // convert from jsx to js
    let js = transformJSX(jsx, true);

    return { js, jsx, ast };
}