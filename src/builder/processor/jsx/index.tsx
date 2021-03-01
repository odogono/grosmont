import Path from 'path';
import Fs from 'fs-extra';
const _eval = require('eval');
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as Babel from "@babel/core";
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";

import { parse as babelParser } from '@babel/parser';

import { Entity } from 'odgn-entity/src/entity';
import { getDependencies, getDependencyEntities, selectJsx } from '../../query';
import { Site } from '../../site';
import { parse as parseConfig } from '../../config';
import { ProcessOptions } from '../../types';
import { parseJS } from './resolve_imports';
import { parseEntityUri } from '../../util';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { parseUri, toInteger } from '@odgn/utils';

import { process as resolveImports } from './resolve_imports';

const log = (...args) => console.log('[ProcJSX]', ...args);


/**
 * Compiles Mdx
 */
export async function process(site: Site, options:ProcessOptions = {}){
    
    // parse the mdx and pick out links,css,meta
    await preprocess( site, options );

    // resolve meta with parents
    // await resolveMeta( site, options );
    await resolveImports(site, options);

    // render the mdx into html
    await render( site, options );

    return site;
}




/**
 * Compiles Jsx
 */
export async function render(site: Site, options:ProcessOptions = {}){
    const es = options.es ?? site.es;

    let ents = await selectJsx(es, {...options, siteRef:site.getRef()});
    let output = [];

    for (const e of ents) {

        try {
            const { data } = await renderJsx( site, e, options );

            e.Text = { data };
        } catch( err ){
            e.Error = {message:err.message, stack:err.stack};
        }
        
        output.push(e);
    }

    await es.add(output);

    return site;
}



export async function preprocess(site: Site, options:ProcessOptions = {}){
    const es = options.es ?? site.es;

    let ents = await selectJsx(es, {...options, siteRef:site.getRef()});
    let output = [];

    // log( ents );

    for (const e of ents) {

        try {

            // gather the import dependencies
            let importData = await buildImportData(site, e, options);

            let props = await buildProps(site, e);
            let code = transformJSX(props.data);
            let {Component,requires, ...meta} = evalCode(code, props.path, {site, importData});

            await parseConfig(site, meta, undefined, {add:false, e} );

        } catch( err ){
            e.Error = {message:err.message, stack:err.stack};
        }
        
        output.push(e);

    }

    await es.add(output);

    return site;
}


async function renderJsx(site: Site, e: Entity, options: ProcessOptions) {

    let props = await buildProps(site, e);

    const {data,path} = props;

    try {
        // log('[renderJsx]', e.Src.url );
        // gather the import dependencies
        let importData = await buildImportData(site, e, options);
        
        // log('imports');
        // printAll(site.es, imports);
        
        let code = transformJSX(data);

        let el = evalCode(code, path, {site, importData});

        // log( el );

        const result = renderHTML(el);

        return {...el, data:result};

        // return '';

    } catch (err) {
        log('[renderJsx]', `failed to process mdx ${path}`, err.stack);
        log('[renderJsx]', data);
        throw err;
    }

}

async function buildImportData(site:Site, e:Entity, options:ProcessOptions){
    const {es} = site;
    let imports = await getDependencyEntities(es, e.id, 'import');

    let result = {};

    for( const imp of imports ){
        // const dst = imp.Dep.dst;
        const url = imp.Url?.url;

        // figure out what kind of data the url is asking for
        let {host, path:did} = parseUri( url );
        let eid = toInteger(host);

        let dstE = await es.getEntity(eid, true);

        // log('[buildImportData]', eid, url);
        // printEntity(es, dstE);

        if( did === '/component/jsx' ){
            const ren = await renderJsx( site, dstE, options );
            result[url] = ren.default;
        } else {
            result[url] = dstE;
        }
    }
    return result;
}

// function processAST( code:string ){
//     const ast = babelParser(code, { sourceType: 'module' });

//     // log('ast', ast);
//     const alterObj = {
//     }

//     traverse(ast, alterObj);
// }



export const PageContext = React.createContext({})

function renderHTML({ components, default:Component, children }) {

    const ctxValue = {
        status: 'ready to go',
        children,
        components
    };

    let child = children !== undefined ?
        React.createElement(children, { components })
        : undefined;

    const data = ReactDOMServer.renderToStaticMarkup(
        <PageContext.Provider value={ctxValue}>
                <Component>{child}</Component>
            </PageContext.Provider>, { pretty: true });

    return data;
}


export interface EvalCodeResult {
    default: any;
    components: any;
    children: any;
    [key: string]: any;
}

/**
 * 
 * @param code 
 * @param path 
 */
function evalCode(code: string, path: string, context:any = {}): EvalCodeResult {
    let requires = [];
    const {importData} = context;

    const requireManual = (requirePath) => {
        // log('[evalCode][requireManual]', requirePath);

        if( requirePath === '@site' || requirePath === '@odgn/grosmont' ){
            return context;
        }

        if( importData && importData[requirePath] ){
            // log('[evalCode][requireManual]', importData[requirePath] );
            return importData[requirePath];
        }
        // if( requirePath.startsWith('e://') ){
        //     let euri = parseEntityUri(requirePath);
        //     if( euri !== undefined ){
        //         euri.eid
        //     }
        // }

        // const fullPath = Path.resolve(Path.dirname(path), requirePath);

        // let extPath = findFileWithExt(fullPath, ['mdx']);

        // extPath = findFileWithExt(fullPath, ['jsx', 'js']);
        // if (extPath.endsWith('.jsx')) {
        //     requires.push({ path: extPath });
        //     let jsx = Fs.readFileSync(extPath, 'utf8');
        //     let code = transformJSX(jsx);
        //     return evalCode(code, extPath);
        // }

        // the default behaviour - normal require
        const req = require(requirePath);

        requires.push({ exports: Object.keys(req).join(','), path: requirePath })
        return req;
    }



    let out = _eval(code, path, {
        // createElement: mdxReact,
        React,
        require: requireManual,
        console: console
    });

    // log('[evalCode]', code );

    // const { default, ...rest } = out;

    return { ...out, requires };
}

const presets = [
    ["@babel/preset-env", {
        "exclude": [
            "@babel/plugin-transform-spread"
        ],
        "targets": { "node": "current" }
    }],
    "@babel/preset-react"
];


function transformJSX(jsx: string) {
    const plugins = [
        ["module-resolver", {
            "root": ["."],
            // alias
        }]
    ]
    const {code,...other} = Babel.transform(jsx, { presets, plugins });

    // log('[transformJSX]', other);
    return code;
}




function findFileWithExt(path: string, exts: string[]) {
    exts = ['', ...exts];
    for (const ext of exts) {
        let epath = path + `.${ext}`;
        if (Fs.existsSync(epath)) {
            return epath;
        }
    }
    return path;
}


export async function buildProps(site:Site, e: Entity) {
    let data = e.Data?.data;

    if( data === undefined ){
        // attempt to load from src
        const src = e.Src?.url;

        if( src === undefined ){
            throw new Error(`jsx data not found for ${e.id}`);
        }

        data = await site.readUrl( src );

        // e.Mdx.data = data;
    }

    let eMeta = e.Meta?.meta ?? {};
    let path = e.Dst?.url ?? '';
    let props = { path, data, meta: eMeta };

    return props;
}