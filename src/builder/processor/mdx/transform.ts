import React from 'react';
import unified from 'unified';
import parse from 'remark-parse';
import stringify from 'remark-stringify';
import frontmatter from 'remark-frontmatter';

import mdx from 'remark-mdx';
import mdxjs from 'remark-mdxjs';
import squeeze from 'remark-squeeze-paragraphs';
import mdxAstToMdxHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import mdxHastToJsx from './mdx-hast-to-jsx';

const emoji = require('remark-emoji')

import { importPlugin } from './unified/plugin/import';
import { linkProc } from './unified/plugin/link';
import { process as imgProc } from './unified/plugin/img';
import { configPlugin } from './unified/plugin/config';
import { removeCommentPlugin } from './unified/plugin/remove_comment';
import { titlePlugin } from './unified/plugin/title';
import { clientProc } from './unified/plugin/client';
import { TranspileOptions, TranspileProps, TranspileResult } from '../../types';
import { evalCode, EvalOptions } from '../../eval';

import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'



const log = (...args) => console.log('[/processor/mdx/transform]', ...args);




export interface JsToComponentResult {
    pageProps: any;
    component: any;
}

/**
 * Converts a string of JS code into a JSX Component
 * 
 * @param jsCode 
 * @param props 
 * @param options 
 */
export function transformJS(jsCode: string, props: TranspileProps, options: TranspileOptions): TranspileResult {

    const { path } = props;
    // let { context } = options;

    // log('[jsToComponent]', options);
    try {
        // evaluate the js into a component
        let evaled = evalMDXCode(jsCode, path, options);

        return evaled;
    } catch (err) {
        // log('[jsToComponent]', err);
        throw err;
    }

}


function evalMDXCode( code:string, path:string, options:EvalOptions = {} ){
    let scope = {
        mdx: mdxReact,
        createElement: mdxReact,
        MDXProvider,
        React,
        log: (...args) => log('[evalCode]', ...args),
        ...options.scope
    }

    return evalCode( code, path, {...options, scope} );
}



export type TransformMDXOptions = {

    resolveImport?: (path: string) => [string, boolean] | undefined;
    resolveLink?: (url: string, text?: string) => any;
    onConfig: (config: any) => void;
    require?: (path: string, fullPath: string) => any;
    context?: any;
}

export interface TransformMDXResult {
    jsx: string;
    ast: any;
}

export function transformMdx(content: string, options: TransformMDXOptions): TransformMDXResult {

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
        .use(clientProc, {})
        .use(imgProc, { resolveLink })
        .use(linkProc, { resolveLink })
        // take a snap of the AST
        // .use(() => tree => { ast = JSON.stringify(tree, null, '\t') })
        .use(() => tree => { ast = tree })
        .use(mdx)
        .use(mdxjs)
        .use(titlePlugin, { onConfig })
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
