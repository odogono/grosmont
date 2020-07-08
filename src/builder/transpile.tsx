import Path from 'path';
import Fs from 'fs-extra';

import React from 'react';
import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'
import ReactDOMServer from 'react-dom/server';
// import {transform as transformBuble} from 'buble-jsx-only'


// import MdxOG from '@mdx-js/mdx';
import * as Babel from "@babel/core";

const _eval = require('eval');
const emoji = require('remark-emoji')
import unistVisit from 'unist-util-visit';
// import Definitions from 'mdast-util-definitions';
import unistRemove from 'unist-util-remove';
// import { Layout } from '../components/layout';
import { Head } from '../components/head';

// import vfile from 'to-vfile';
// import report from 'vfile-reporter';
import unified from 'unified';
import parse from 'remark-parse';
import stringify from 'remark-stringify';
import frontmatter from 'remark-frontmatter';

import mdx from 'remark-mdx';
import mdxjs from 'remark-mdxjs';
import squeeze from 'remark-squeeze-paragraphs';
import mdxAstToMdxHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import mdxHastToJsx from './mdx-hast-to-jsx';
import { PageContext, PageLinks, PageLink, PageMeta, resolveRelativePath } from './context';
import { importCSSPlugin } from './unified/plugin/import_css';
import { linkProc } from './unified/plugin/link';
import { configPlugin } from './unified/plugin/config';
import { removeCommentPlugin } from './unified/plugin/remove_comment';
import { isObject } from 'util';
import { titlePlugin } from './unified/plugin/title';


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

export interface TranspileProps {
    path: string;
    data?: string;
    render?: boolean;
    forceRender?: boolean;
    wrapper?: JSX.Element;
    meta?: PageMeta;
    children?: any;
    links?: PageLinks;
    css?: string;
    cssLinks?: string[];
}

export interface TranspileResult {
    path: string;
    html?: string;
    component?: any;
    meta: PageMeta;
    additional: object;
    code?: string;
    ast?: any;
    jsx?: string;
    links?: PageLinks;
    requires?: string[];
    cssLinks?: string[];
}


export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
}

export async function transpile(props: TranspileProps, options: TranspileOptions = {}): Promise<TranspileResult> {
    let { children, path, data, meta, links: applyLinks, css } = props;
    const forceRender = options.forceRender ?? false;
    const doRender = forceRender || (options.render ?? false);

    // let links:PageLinks = {};

    const components = {
        Head,
        InlineCSS: (props) => {
            return <style dangerouslySetInnerHTML={{__html:css}} />;
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
        data = await Fs.readFile(path, 'utf8');
    }

    const inPageProps = { ...meta, css, cssLinks:props.cssLinks };
    const mdxResult = await parseMdx(data, path, inPageProps, applyLinks);
    
    const { component, frontMatter,
        code, jsx, ast, page, default: d, 
        requires, links, cssLinks,
        pageProps, ...rest } = mdxResult;
        
    meta = { ...pageProps };

    let result:TranspileResult = {
        path, code, jsx, ast, component, links, meta, additional:rest
    };


    let depends = [];
    for( let r of requires ){
        r = isObject(r) ? r.path : r;
        r = await resolveRelativePath(path, r);
        depends.push(r);
    }
    result.requires = depends;

    if( cssLinks ){
        // resolve these to absolute
        result.cssLinks = await Promise.all( cssLinks.map( link => resolveRelativePath(path,link)) );
    }
    
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


function parseMdx(data: string, path:string, pageProps: object, applyLinks?: PageLinks) {
    // let content = Fs.readFileSync(path, 'utf8');

    try {
        // console.log('code', data);
        let [jsx, links, ast] = processMdx(data, pageProps, applyLinks);
        // if( path.includes('index.mdx') )
        // console.log('🦉jsx', jsx);
        // console.log('🦉jsxOG', jsxOG);
    
        // console.log('code', code);
        
        let code = transformJSX(jsx);
        let el = evalCode(code, path);
    
        return { ...el, code, jsx, ast, links };

    } catch( err ){
        console.warn('[parseMdx]', `failed to process mdx ${path}`, err.message, err.stack );
        console.log('[parseMdx]', data);
        throw err;
    }

}


export function processMdx(content: string, pageProps: object, applyLinks?: PageLinks): [string, PageLinks, any] {

    let links = new Map<string, any>();
    let ast;

    // console.log('[processMdx]', 'wat', content );
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
        .use(importCSSPlugin)
        // .use( () => tree => console.log('HERE', tree) )
        .use(squeeze)
        .use(mdxAstToMdxHast)
        .use(mdxHastToJsx)
        // .use( () => console.log('💦doh') )
        .processSync(content);
    // console.log(output);

    return ['/* @jsx mdx */\n' + output.toString(), links, ast];
}

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
    const component = out['default'];
    const pageProps = out['page'];
    
    let {cssLinks} = out;
    if( cssLinks !== undefined ){
        requires = [...requires,...cssLinks];
    }
    // console.log('[evalCode]', requires);

    return { ...out, pageProps, requires, component };
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


