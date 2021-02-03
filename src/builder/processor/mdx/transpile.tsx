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
import { configPlugin } from '../../unified/plugin/config';
import { removeCommentPlugin } from '../../unified/plugin/remove_comment';
import { titlePlugin } from '../../unified/plugin/title';


import { Head } from '../../../components/head';
import { isObject } from 'odgn-entity/src/util/is';

import { 
    TranspileProps, 
    TranspileOptions, 
    TranspileResult, 
    PageLinks 
} from '../../types';

const log = (...args) => console.log('[TranspileMDX]', ...args);



export const PageContext = React.createContext({})


export async function transpile(props: TranspileProps, options: TranspileOptions): Promise<TranspileResult> {

    let meta = props.meta ?? {};

    let {css, cssLinks:inputCssLinks, children, applyLinks} = props;

    let { data, path } = props;
    const { resolveImport } = options;
    const forceRender = options.forceRender ?? false;
    const doRender = forceRender || (options.render ?? false);


    const components = {
        Head,
        InlineCSS: (props) => {
            return <style dangerouslySetInnerHTML={{__html:css}} />;
        },
        CSSLinks: () => {
            inputCssLinks = inputCssLinks.filter(Boolean);
            // if( inputCssLinks ) log('[transpile][CSSLinks]',inputCssLinks);
            
            // { page.cssLinks?.map(c => <link key={c} rel="stylesheet" href={c} />)}
            return inputCssLinks ? <>
                {inputCssLinks.map( c => <link key={c} rel="stylesheet" href={c} />)}
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
    if( path !== undefined ){
        // data = await Fs.readFile(path, 'utf8');
    }

    const inPageProps = { ...meta, css, cssLinks:inputCssLinks };
    const mdxResult = await parseMdx(data, path, { pageProps:inPageProps,applyLinks, resolveImport } );
    
    const { component, frontMatter,
        code, jsx, ast, page, default: d, 
        requires, links, cssLinks,
        pageProps, ...rest } = mdxResult;
        
    meta = { ...meta, ...pageProps };

    // log('[transpile]', 'meta', mdxResult );

    let result:TranspileResult = {
        path,  jsx, /* code, ast,*/ component, links, meta, cssLinks, additional:rest
    };

    // log('[transpile]', 'requires', requires);
    // log('[transpile]', 'cssLinks', cssLinks);

    let depends = [];
    for( let r of requires ){
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

    if( doRender ){
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



function parseMdx(data: string, path:string, options:ProcessMDXOptions) {
    // let content = Fs.readFileSync(path, 'utf8');

    try {
        let [jsx, links, ast] = processMdx(data, options);
        
        let code = transformJSX(jsx);
        let el = evalCode(code, path);

        // log('[parseMdx]', 'el', el );
    
        return { ...el, code, jsx, ast, links };

    } catch( err ){
        log('[parseMdx]', `failed to process mdx ${path}`, err.stack );
        log('[parseMdx]', data);
        throw err;
    }

}


export type ProcessMDXOptions = {
    pageProps?: any;
    applyLinks?: PageLinks;
    resolveImport?: (path) => string | undefined;
}

export type ProcessMDXResult = [ string, PageLinks, any];

export function processMdx(content: string, options:ProcessMDXOptions): ProcessMDXResult {

    const {  pageProps, applyLinks, resolveImport } = options;
    let links = new Map<string, any>();
    let ast;

    // const resolveCSS = (path) => {
    //     log('[resolveCSS]', path);
    //     return true;
    // }

    // log('[processMdx]', 'content:', content );
    // remark-mdx has a really bad time with html comments even
    // if they are removed with the removeCommentPlugin, so a brute
    // force replace is neccesary here until i can figure it out
    content = content.replace( /<!--(.*?)-->/, '' );

    let output = unified()
        // .use(() => console.dir)
        .use(parse)
        .use(stringify)
        .use(frontmatter)
        .use(emoji)
        
        .use(configPlugin, { page: pageProps })
        .use(removeCommentPlugin)
        
        .use(linkProc, { links, applyLinks })
        // take a snap of the AST
        .use( () => tree => {ast = JSON.stringify(tree,null,'\t')} )
        .use(mdx)
        .use(mdxjs)
        .use(titlePlugin)
        .use(importCSSPlugin, {resolve: resolveImport})
        .use(squeeze)
        .use(mdxAstToMdxHast)
        .use(mdxHastToJsx)
        // .use(() => console.dir)
        // .use( () => console.log('💦doh') )
        .processSync(content);
    // console.log( output.toString());

    return ['/* @jsx mdx */\n' + output.toString(), links, ast];
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

function evalCode(code: string, path: string) {
    let requires = [];
    const requireManual = (requirePath) => {
        log('[evalCode][requireManual]', requirePath);
        const fullPath = Path.resolve(Path.dirname(path), requirePath);
        
        let extPath = findFileWithExt(fullPath, ['mdx'] );
        
        if (Fs.existsSync(extPath) && extPath.endsWith('.mdx')) {
            requires.push({path:extPath});
            const data = Fs.readFileSync(path, 'utf8');
            const out = parseMdx(data, extPath, {});
            // console.log('[require]', requirePath, Object.keys(out), out);
            out.__esModule = true;

            return out;
        }

        extPath = findFileWithExt(fullPath, ['jsx', 'js'] );
        if( extPath.endsWith('.jsx') ){
            requires.push({path:extPath});
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
        mdx: mdxReact,
        createElement: mdxReact,
        React,
        require: requireManual,
        console: console
    });
    
    const {default:component, page:pageProps, ...rest} = out;

    return { ...rest, pageProps, requires, component };
}



function findFileWithExt( path:string, exts:string[] ){
    exts = [ '', ...exts ];
    for( const ext of exts ){
        let epath = path + `.${ext}`;
        if( Fs.existsSync(epath) ){
            return epath;
        }
    }
    return path;
}