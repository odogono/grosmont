import Path from 'path';
import Fs from 'fs-extra';

import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'

import * as Babel from "@babel/core";
import unified from 'unified';
import parse from 'remark-parse';
import stringify from 'remark-stringify';
import frontmatter from 'remark-frontmatter';
import report from 'vfile-reporter';

import mdx from 'remark-mdx';
import mdxjs from 'remark-mdxjs';
import squeeze from 'remark-squeeze-paragraphs';
import mdxAstToMdxHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import mdxHastToJsx from './mdx-hast-to-jsx';

const _eval = require('eval');
const emoji = require('remark-emoji')

import { importCSSPlugin } from '../../unified/plugin/import_css';
import { linkProc } from '../../unified/plugin/link';
import { process as imgProc } from '../../unified/plugin/img';
import { configPlugin } from '../../unified/plugin/config';
import { removeCommentPlugin } from '../../unified/plugin/remove_comment';
import { titlePlugin } from '../../unified/plugin/title';


import { Head } from '../../../components/head';
import { isObject } from "@odgn/utils";

import {
    TranspileProps,
    TranspileOptions,
    TranspileResult,
    PageLinks,
    PageImgs,
    PageImg
} from '../../types';
import { Site } from '../../site';

const log = (...args) => console.log('[TranspileMDX]', ...args);



export const PageContext = React.createContext({})




/**
 * 
 * @param data 
 * @param path 
 * @param options 
 */
export function mdxToJs(mdxData: string, props: TranspileProps, options: TranspileOptions): TranspileResult {
    let meta = props.meta ?? {};
    let { css, cssLinks: inputCssLinks, children, applyLinks, imgs } = props;
    const { resolveImport, resolveLink, require, context } = options;

    const inPageProps = { ...meta, css, cssLinks: inputCssLinks };
    let processOpts = { pageProps: inPageProps, applyLinks, imgs, resolveLink, resolveImport, require, context };

    // convert the mdx to jsx
    let { jsx, links, ast, imgs: outImgs } = processMdx(mdxData, processOpts);
    // log('[parseMdx]', jsx );

    // convert from jsx to js
    let js = transformJSX(jsx);


    return { js, jsx, ast, links, imgs: outImgs };
}


export interface JsToComponentResult {
    pageProps: any;
    component: any;
}

/**
 * 
 * @param jsCode 
 * @param props 
 * @param options 
 */
export function jsToComponent(jsCode: string, props: TranspileProps, options: TranspileOptions): TranspileResult {

    const { path } = props;

    try {
        // evaluate the js into a component
        let evaled = evalCode(jsCode, path, options);

        return evaled;
    } catch (err) {
        log('[jsToComponent]', 'error', err);
        throw err;
    }

}

/**
 * 
 * @param component 
 * @param props 
 * @param options 
 */
export function componentToString(component: any, props: TranspileProps, options: TranspileOptions) {
    let { css, cssLinks: inputCssLinks, children, applyLinks, imgs } = props;

    const components = {
        Head,
        InlineCSS: (props) => {
            return <style dangerouslySetInnerHTML={{ __html: css }} />;
        },
        CSSLinks: () => {
            inputCssLinks = inputCssLinks.filter(Boolean);
            // if( inputCssLinks ) log('[transpile][CSSLinks]',inputCssLinks);

            // { page.cssLinks?.map(c => <link key={c} rel="stylesheet" href={c} />)}
            return inputCssLinks ? <>
                {inputCssLinks.map(c => <link key={c} rel="stylesheet" href={c} />)}
            </> : null;
        }
        // Layout,
        // a: (props) => {
        //     const {href,children} = props;
        //     links[href] = {children};
        //     console.log('[transpile]', 'link', href, children );
        //     // links.push( {href, children} );
        //     return <a {...props}></a>
        // }
    }

    const ctxValue = {
        children,
        components
    };




    let child = children !== undefined ?
        React.createElement(children, { components })
        : undefined;

    const Component = component;


    try {

        const output = ReactDOMServer.renderToStaticMarkup(
            <PageContext.Provider value={ctxValue}>
                <MDXProvider components={components}>
                    <Component>{child}</Component>
                </MDXProvider>
            </PageContext.Provider>, { pretty: true });

        return output;

    } catch (err) {
        log('WTFFFFF', err.message);
        // log('WTFFFFF', Component.toString() );
        // log( {components, child, Component})
    }
}



export async function transpile(props: TranspileProps, options: TranspileOptions): Promise<TranspileResult> {

    let meta = props.meta ?? {};

    let { css, cssLinks: inputCssLinks, children, applyLinks, imgs } = props;

    let { data, path } = props;
    const { resolveImport, require, context } = options;
    const forceRender = options.forceRender ?? false;
    const doRender = forceRender || (options.render ?? false);


    const components = {
        Head,
        InlineCSS: (props) => {
            return <style dangerouslySetInnerHTML={{ __html: css }} />;
        },
        CSSLinks: () => {
            inputCssLinks = inputCssLinks.filter(Boolean);
            // if( inputCssLinks ) log('[transpile][CSSLinks]',inputCssLinks);

            // { page.cssLinks?.map(c => <link key={c} rel="stylesheet" href={c} />)}
            return inputCssLinks ? <>
                {inputCssLinks.map(c => <link key={c} rel="stylesheet" href={c} />)}
            </> : null;
        }
        // Layout,
        // a: (props) => {
        //     const {href,children} = props;
        //     links[href] = {children};
        //     console.log('[transpile]', 'link', href, children );
        //     // links.push( {href, children} );
        //     return <a {...props}></a>
        // }
    }
    if (path !== undefined) {
        // data = await Fs.readFile(path, 'utf8');
    }

    const inPageProps = { ...meta, css, cssLinks: inputCssLinks };

    const mdxResult = await parseMdx(data, path,
        { pageProps: inPageProps, applyLinks, imgs, resolveImport, require, context });

    const { component, frontMatter,
        code, jsx, ast, page, default: d,
        requires, links, cssLinks,
        pageProps, ...rest } = mdxResult;
    imgs = mdxResult.imgs;

    meta = { ...meta, ...pageProps };

    // log('[transpile]', 'imgs', imgs );

    let result: TranspileResult = {
        path, jsx, code, ast, /* code, ast,*/ component, links, imgs, meta, cssLinks, additional: rest
    };



    // log('[transpile]', 'requires', requires);
    // log('[transpile]', 'cssLinks', cssLinks);

    let depends = [];
    for (let r of requires) {
        r = isObject(r) ? r.path : r;
        // r = await resolveRelativePath(path, r);
        depends.push(r);
    }

    result.requires = depends;

    // if( cssLinks ){
    //     // resolve these to absolute
    //     result.cssLinks = await Promise.all( cssLinks.map( link => resolveRelativePath(path,link)) );
    // }

    // console.log('[transpile]', path, 'and now', rest );
    if (!forceRender && (frontMatter !== undefined && frontMatter.enabled === false)) {
        return result;
        // return { code, jsx, ast, meta, component, requires:depends, links, ...rest };
    }

    if (doRender) {
        result.html = renderHTML({ components, component, children });
    }

    return result;
}


function renderHTML({ components, component: Component, children }) {

    const ctxValue = {
        status: 'ready to go',
        children,
        components
    };

    let child = children !== undefined ?
        React.createElement(children, { components })
        : undefined;

    const html = ReactDOMServer.renderToStaticMarkup(
        <PageContext.Provider value={ctxValue}>
            <MDXProvider components={components}>
                <Component>{child}</Component>
            </MDXProvider></PageContext.Provider>, { pretty: true });

    return html;
}



async function parseMdx(data: string, path: string, options: ProcessMDXOptions) {

    try {
        // convert the mdx to jsx
        let { jsx, links, ast, imgs } = await processMdx(data, options);

        // convert from jsx to js
        let code = transformJSX(jsx);

        // log('[parseMdx]', code);

        // evaluate the js into a component
        let el = evalCode(code, path, options);

        return { ...el, code, jsx, ast, links, imgs };

    } catch (err) {
        log('[parseMdx]', `failed to process mdx ${path}`, err.stack);
        log('[parseMdx]', data);
        throw err;
    }

}


export type ProcessMDXOptions = {
    pageProps?: any;
    applyLinks?: PageLinks;
    imgs?: PageImgs;
    resolveImport?: (path) => string | undefined;
    resolveLink?: (url: string, text?: string) => any;
    require?: (path: string, fullPath: string) => any;
    context?: any;
}

// export type ProcessMDXResult = [string, PageLinks, any];
export interface ProcessMDXResult {
    jsx: string;
    links: PageLinks,
    ast: any;
    imgs: PageImgs
}

export function processMdx(content: string, options: ProcessMDXOptions): ProcessMDXResult {

    let { pageProps, applyLinks, resolveImport, resolveLink, imgs } = options;
    let links = new Map<string, any>();
    let ast;

    if (imgs === undefined) {
        imgs = new Map<string, PageImg>();
    }

    // remark-mdx has a really bad time with html comments even
    // if they are removed with the removeCommentPlugin, so a brute
    // force replace is neccesary here until i can figure it out
    content = content.replace(/<!--(.*?)-->/, '');

    let output = unified()
        .use(parse)
        .use(stringify)
        .use(frontmatter)
        .use(emoji)
        .use(configPlugin, { page: pageProps })
        .use(removeCommentPlugin)
        // .use(() => console.dir)
        .use(imgProc, { imgs })
        .use(linkProc, { links, applyLinks, resolveLink })
        // take a snap of the AST
        .use(() => tree => { ast = JSON.stringify(tree, null, '\t') })
        .use(mdx)
        .use(mdxjs)
        .use(titlePlugin)
        .use(importCSSPlugin, { resolve: resolveImport })
        .use(squeeze)
        .use(mdxAstToMdxHast)
        .use(mdxHastToJsx)
        // .use(() => console.dir)
        // .use( () => console.log('💦doh') )
        // .process(content);
        .processSync(content);
    // console.log( output.toString());

    // log( 'ast', ast ); throw 'stop';

    // return ['/* @jsx mdx */\n' + output.toString(), links, ast];

    return {
        jsx: '/* @jsx mdx */\n' + output.toString(),
        links,
        ast,
        imgs
    };
}


const presets = [
    // ["latest-node", { "target": "current" }],
    ["@babel/preset-env", {
        "exclude": [
            "@babel/plugin-transform-spread"
        ],
        "targets": { "node": "current" }
    }],
    "@babel/preset-react"
];


function transformJSX(jsx: string) {
    // const alias = {
    //     "react": "preact-compat",
    //     'react-dom': 'preact-compat',
    // }
    const plugins = [
        ["module-resolver", {
            "root": ["."],
            // alias
        }]
    ]
    return Babel.transform(jsx, { presets, plugins }).code;
}


interface EvalOptions {
    require?: (path, fullPath) => any;
    context?: any;
}

/**
 * 
 * @param code 
 * @param path 
 */
function evalCode(code: string, path: string, options: EvalOptions = {}) {
    let requires = [];
    const { context } = options;

    // log('[evalCode]', path, code );


    const requireManual = (requirePath) => {

        if (requirePath === '@odgn/grosmont' || requirePath === '@site') {
            return context;
        }

        const fullPath = Path.resolve(Path.dirname(path), requirePath);

        let result;
        if (options.require) {
            result = options.require(requirePath, fullPath);
        }

        // log('[evalCode]', requirePath, result);

        if (result === undefined) {
            result = require(requirePath);
        }
        return result;
    }

    let out = _eval(code, path, {
        mdx: mdxReact,
        createElement: mdxReact,
        React,
        require: requireManual,
        console: console
    });

    const { default: component, page: pageProps, ...rest } = out;

    return { ...rest, pageProps, requires, component };
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