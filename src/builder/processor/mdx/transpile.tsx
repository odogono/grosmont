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

import mdx from 'remark-mdx';
import mdxjs from 'remark-mdxjs';
import squeeze from 'remark-squeeze-paragraphs';
import mdxAstToMdxHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import mdxHastToJsx from './mdx-hast-to-jsx';

const _eval = require('eval');
const emoji = require('remark-emoji')

import { importPlugin } from '../../unified/plugin/import';
import { linkProc } from '../../unified/plugin/link';
import { process as imgProc } from '../../unified/plugin/img';
import { configPlugin } from '../../unified/plugin/config';
import { removeCommentPlugin } from '../../unified/plugin/remove_comment';
import { titlePlugin } from '../../unified/plugin/title';


import { Head } from '../../../components/head';
import { isObject, isPromise } from "@odgn/utils";

import {
    TranspileProps,
    TranspileOptions,
    TranspileResult,
} from '../../types';
import { ServerEffectProvider } from '../jsx/server_effect';
import { clientProc } from '../../unified/plugin/client';

const log = (...args) => console.log('[/processor/mdx/transpile]', ...args);



export const PageContext = React.createContext({})




/**
 * 
 * @param data 
 * @param path 
 * @param options 
 */
export function mdxToJs(mdxData: string, props: TranspileProps, options: TranspileOptions): TranspileResult {
    let meta = props.meta ?? {};
    let { css, cssLinks: inputCssLinks, children } = props;
    const { resolveImport, resolveLink, onConfig, require, context } = options;

    const inPageProps = { ...meta, css, cssLinks: inputCssLinks };
    let processOpts = { pageProps: inPageProps, resolveLink, resolveImport, onConfig, require, context };

    // convert the mdx to jsx
    let { jsx, ast } = processMdx(mdxData, processOpts);
    // log('[parseMdx]', jsx );

    // convert from jsx to js
    let js = transformJSX(jsx);

    return { js, jsx, ast };
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
    // let { context } = options;

    // log('[jsToComponent]', options);
    try {
        // evaluate the js into a component
        let evaled = evalCode(jsCode, path, options);

        return evaled;
    } catch (err) {
        // log('[jsToComponent]', err);
        throw err;
    }

}

/**
 * 
 * @param component 
 * @param props 
 * @param options 
 */
export async function componentToString(component: any, props: TranspileProps, options: TranspileOptions) {
    let { css, cssLinks: inputCssLinks, children, url, comProps } = props;
    


    // these two cases are really only used for non-mdx components
    // undecided whether this is a good idea...
    
    comProps.InlineCSS = css !== undefined ? 
        () => <style dangerouslySetInnerHTML={{ __html: css }} /> 
        : null;
    
    inputCssLinks = inputCssLinks !== undefined ? inputCssLinks.filter(Boolean) : [];
    comProps.CSSLinks = inputCssLinks.length > 0 ? 
            () => <>{inputCssLinks.map( c => <link key={c} rel='stylesheet' href={c} />)}</>
            : null;
    

    const components = {
        Head,
        InlineCSS: comProps.InlineCSS,
        CSSLinks: comProps.CSSLinks,
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
        React.createElement(children, { components, ...comProps })
        : undefined;

    const Component = await component;

    // log('[componentToString]', 'CSSLinks', inputCssLinks);
    // log('[componentToString]', 'CSSLinks', components);

    try {

        const output = ReactDOMServer.renderToStaticMarkup(
            <ServerEffectProvider>
                <PageContext.Provider value={ctxValue}>
                    <MDXProvider components={components}>
                        <Component {...comProps}>{child}</Component>
                    </MDXProvider>
                </PageContext.Provider>
            </ServerEffectProvider>
            , { pretty: true });

        return output;

    } catch (err) {
        log('[componentToString]', url, err.message);
        
        throw err;
    }
}


export type ProcessMDXOptions = {
    
    resolveImport?: (path: string) => [string,boolean] | undefined;
    resolveLink?: (url: string, text?: string) => any;
    onConfig: (config:any) => void;
    require?: (path: string, fullPath: string) => any;
    context?: any;
}

export interface ProcessMDXResult {
    jsx: string;
    ast: any;
}

export function processMdx(content: string, options: ProcessMDXOptions): ProcessMDXResult {

    let { resolveImport, resolveLink, onConfig } = options;
    let ast;

    // remark-mdx has a really bad time with html comments even
    // if they are removed with the removeCommentPlugin, so a brute
    // force replace is neccesary here until i can figure it out
    content = content.replace(/<!--(.*?)-->/, '');

    let output = unified()
        .use(parse)
        .use(stringify)
        .use(frontmatter)
        .use(emoji)
        .use(configPlugin, { onConfig })
        .use(removeCommentPlugin)
        // .use(() => console.dir)
        .use(clientProc, { })
        .use(imgProc, { resolveLink })
        .use(linkProc, { resolveLink })
        // take a snap of the AST
        // .use(() => tree => { ast = JSON.stringify(tree, null, '\t') })
        .use(() => tree => { ast = tree })
        .use(mdx)
        .use(mdxjs)
        .use(titlePlugin, {onConfig} )
        .use(importPlugin, { resolveImport })
        .use(squeeze)
        .use(mdxAstToMdxHast)
        .use(mdxHastToJsx)
        .processSync(content);

    // log('[processMdx]', ast);

    return {
        jsx: '/* @jsx mdx */\n' + output.toString(),
        ast
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


export function transformJSX(jsx: string) {
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
    scope?: any;
}

/**
 * 
 * @param code 
 * @param path 
 */
function evalCode(code: string, path: string, options: EvalOptions = {}) {
    let { context, scope:inScope } = options;

    // log('[evalCode]', path, code );

    context = {
        useServerEffect: () => { },
        ...context
    }

    
    // log('[evalCode]', path, context.useServerEffect.toString() );

    const requireManual = (requirePath) => {

        if (requirePath === '@odgn/grosmont' || requirePath === '@site') {
            // log('[evalCode]', context);
            return context;
        }

        const fullPath = Path.resolve(Path.dirname(path), requirePath);

        let result;
        if (options.require) {
            result = options.require(requirePath, fullPath);
        }


        if (result === undefined) {
            result = require(requirePath);
        }
        // log('[evalCode]', requirePath, result);
        return result;
    }

    const scope = {
        mdx: mdxReact,
        createElement: mdxReact,
        MDXProvider,
        React,
        require: requireManual,
        console: console,
        setTimeout,
        log: (...args) => log('[evalCode]', ...args),
        ...inScope
    }

    let out = _eval(code, path, scope);

    const { default: component, ...rest } = out;

    return { ...rest, component };
}
