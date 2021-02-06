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
import { selectJsx } from '../../query';
import { Site } from '../../site';
import { parse as parseConfig } from '../../config';
import { ProcessOptions } from '../../types';



const log = (...args) => console.log('[ProcJSX]', ...args);


/**
 * Compiles Jsx
 */
export async function process(site: Site, options:ProcessOptions = {}){
    const {es} = site;

    let ents = await selectJsx(es, {...options, siteRef: site.e.id});
    let output = [];

    for (const e of ents) {

        try {
            const data = await renderJsx( site, e, options );

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
    const {es} = site;

    let ents = await selectJsx(es, {...options, siteRef: site.e.id});
    let output = [];

    for (const e of ents) {

        try {
            let props = await buildProps(site, e);
            let code = transformJSX(props.data);
            let {Component,requires, ...meta} = evalCode(code, props.path, {site});

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
        
        let code = transformJSX(data);

        let el = evalCode(code, path, {site});

        log( el );

        return renderHTML(el);

        // return '';

    } catch (err) {
        log('[renderJsx]', `failed to process mdx ${path}`, err.stack);
        log('[renderJsx]', data);
        throw err;
    }

}

function processAST( code:string ){
    const ast = babelParser(code, { sourceType: 'module' });

    // log('ast', ast);
    const alterObj = {
    }

    traverse(ast, alterObj);
}



export const PageContext = React.createContext({})

function renderHTML({ components, Component, children }) {

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


/**
 * 
 * @param code 
 * @param path 
 */
function evalCode(code: string, path: string, context:any = {}) {
    let requires = [];
    const requireManual = (requirePath) => {
        log('[evalCode][requireManual]', requirePath);

        if( requirePath === '@odgn-ssg' ){
            return context;
        }

        const fullPath = Path.resolve(Path.dirname(path), requirePath);

        let extPath = findFileWithExt(fullPath, ['mdx']);

        // if (Fs.existsSync(extPath) && extPath.endsWith('.mdx')) {
        //     requires.push({ path: extPath });
        //     const data = Fs.readFileSync(path, 'utf8');
        //     const out = parseMdx(data, extPath, {});
        //     // console.log('[require]', requirePath, Object.keys(out), out);
        //     out.__esModule = true;

        //     return out;
        // }

        extPath = findFileWithExt(fullPath, ['jsx', 'js']);
        if (extPath.endsWith('.jsx')) {
            requires.push({ path: extPath });
            let jsx = Fs.readFileSync(extPath, 'utf8');
            let code = transformJSX(jsx);
            return evalCode(code, extPath);
        }

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

    const { default: Component, ...rest } = out;

    return { ...rest, requires, Component };
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
    let data = e.Jsx?.data;

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