import Path from 'path';
import Fs from 'fs-extra';

import React from 'react';
import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'
import ReactDOMServer from 'react-dom/server';
// import {transform as transformBuble} from 'buble-jsx-only'

import Yaml from 'yaml';
import MdxOG from '@mdx-js/mdx';
import * as Babel from "@babel/core";
import { parse as babelParser } from '@babel/parser';
const _eval = require('eval');
const emoji = require('remark-emoji')
import unistVisit from 'unist-util-visit';
import Definitions from 'mdast-util-definitions';
import unistRemove from 'unist-util-remove';
import { Layout } from '../components/layout';
import { Head } from '../components/head';

import vfile from 'to-vfile';
import report from 'vfile-reporter';
import unified from 'unified';
import parse from 'remark-parse';
import stringify from 'remark-stringify';
import frontmatter from 'remark-frontmatter';

import mdx from 'remark-mdx';
import mdxjs from 'remark-mdxjs';
import squeeze from 'remark-squeeze-paragraphs';
import mdxAstToMdxHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
// import mdxHastToJsx from '@mdx-js/mdx/mdx-hast-to-jsx';
import mdxHastToJsx from './mdx-hast-to-jsx';
import { PageContext, PageLinks, PageLink, PageMeta } from './context';


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
    render?: boolean;
    forceRender?: boolean;
    wrapper?: JSX.Element;
    meta?: PageMeta;
    children?: any;
    links?: PageLinks;
}




export interface TranspileResult {
    html?: string;
    component?: any;
    meta: PageMeta;
    code?: string;
    ast?: object;
    jsx?: string;
    links?: PageLinks;
}


export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
}

export async function transpile(props: TranspileProps, options: TranspileOptions = {}): Promise<TranspileResult> {
    let { children, path, meta, links: applyLinks } = props;
    const forceRender = options.forceRender ?? false;
    const doRender = forceRender || (options.render ?? false);

    // let links:PageLinks = {};

    const components = {
        Head,
        InlineCSS: (props) => {
            return <style dangerouslySetInnerHTML={{__html:meta.css}} />;
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

    const mdxResult = await parseMdx(path, meta, applyLinks);
    const { component, frontMatter,
        code, jsx, ast, page, default: d, requires, links,
        pageProps, ...rest } = mdxResult;

    meta = { ...pageProps, ...rest };


    if (!forceRender && (frontMatter !== undefined && frontMatter.enabled === false)) {
        return { code, jsx, ast, meta, component, links, ...rest };
    }

    const html = doRender ?
        renderHTML({ components, component, children, ...rest })
        : undefined;
    // if( Object.keys(links).length > 0 )
    // console.log('[transpile]', path, links );

    return {
        code, jsx, meta, ast,
        component,
        html,
        links,
        ...rest
    }
}

// function MDXShite({children,components,...props}) {
//     return <div className="dogshite">{children}</div>
// };

function renderHTML({ components, component: Component, children, ...rest }) {

    // let kids = <span>poppo</span>;
    // console.log('HAHAHA', kids);
    // console.log('HAHAHA', children );
    // console.log('HAHAHA', MDXShite({children:kids, components:null}) );
    // kids = children()({});
    // let huh = React.createElement( children );
    // console.log('HAHAHA', components );

    // console.log('HAHAHAH', ReactDOMServer.renderToStaticMarkup(  
    //     huh
    // ) );

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


function parseMdx(path: string, pageProps: object, applyLinks?: PageLinks) {
    let content = Fs.readFileSync(path, 'utf8');

    let [jsx, links, ast] = processMdx(content, pageProps, applyLinks);

    // if( path.includes('index.mdx') )
    // console.log('🦉jsx', jsx);
    // console.log('🦉jsxOG', jsxOG);

    // console.log('code', code);

    let code = transformJSX(jsx);
    let el = evalCode(code, path);

    return { ...el, code, jsx, ast, links };
}


export function processMdx(content: string, pageProps: object, applyLinks?: PageLinks): [string, PageLinks, object] {

    let links = new Map<string, any>();
    let ast;

    // return new Promise( (res,rej) => {
    let output = unified()
        .use(parse)
        .use(stringify)
        .use(frontmatter)
        .use(configPlugin, { page: pageProps })
        .use(removeCommentPlugin)
        .use(linkProc, { links, applyLinks })
        .use( () => tree => ast = {...tree} )
        .use(mdx)
        .use(mdxjs)
        .use(importCSSPlugin)
        // .use(() => console.dir)
        .use(squeeze)
        .use(mdxAstToMdxHast)
        .use(mdxHastToJsx)
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
        
        // console.log('[require]', fullPath);
        
        if (Fs.existsSync(fullPath) && fullPath.endsWith('.mdx')) {
            // console.log('[require]', fullPath);
            return parseMdx(fullPath, {}).default;
        }

        const extPath = findFileWithExt(fullPath, ['jsx', 'js'] );
        if( extPath.endsWith('.jsx') ){
            let jsx = Fs.readFileSync(extPath, 'utf8');
            let code = transformJSX(jsx);
            return evalCode(code, extPath);
        }

        const req = require(requirePath);

        requires.push({ exports: Object.keys(req).join(','), path: requirePath })
        return req;
    }
    // console.log('[evalCode]', code);
    // const child = () => <div className="poop">Heck</div>;
    let out = _eval(code, path, {
        mdx: mdxReact,
        createElement: mdxReact,
        React,
        require: requireManual
    });
    const component = out['default'];
    const pageProps = out['page'];
    // console.log('[evalCode]', component);

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

function removeTypePlugin(options = {}) {
    return (tree, file) => {
        // console.log('[removeTypePlugin]', file);
        unistRemove(tree, options);
    }
}

export function configPlugin(options) {
    return (tree, file, ...rest) => {
        unistVisit(tree, { type: 'yaml' }, (node, index, parent) => {

            const config = (node as any).value;
            // TODO : convert this into a javascript call
            try {
                let parsed = Yaml.parse(config);

                // const {enabled, ...rest} = parsed;
                // console.log('[configPlugin]', parsed, options);
                if (options.page) {
                    parsed = { ...options.page, ...parsed };
                }

                (node as any).type = 'export';
                // (node as any).value = 'export const frontMatter = ' + JSON.stringify(parsed) + ';';
                (node as any).value = 'export const page = ' + JSON.stringify(parsed) + ';';

            } catch (e) {
                console.error("Parsing error on line " + e.line + ", column " + e.column +
                    ": " + e.message);
            }

        })
        unistRemove(tree, 'frontMatter');
    }
};

export function removeCommentPlugin() {
    return (tree, file) => {
        unistRemove(tree, { cascade: false }, (node, idx, parent) => {
            if (node.type === 'paragraph') {
                const exists = node.children.filter(node => node.type === 'text' && node.value.trim().startsWith('//'));
                if (exists.length > 0) {
                    // console.log('[removeCommentPlugin]', node);
                    return true;
                }
            }
            return false;
        });
    }
};


interface LinkProcProps {
    links: PageLinks;
    applyLinks?: PageLinks;
}

function linkProc({ links, applyLinks }: LinkProcProps) {
    // console.log('[linkProc]', options);

    return (tree, file, ...args) => {
        // let links =  {};

        unistVisit(tree, ['link', 'linkReference'], visitor);

        function visitor(node) {
            // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
            const ctx = node;
            if (!ctx) return;

            if (applyLinks !== undefined) {
                let applyLink = applyLinks.get(ctx.url);
                if (applyLink !== undefined) {
                    ctx.url = applyLink.url;
                }
            }

            // console.log('[linkProc]', args, ctx);
            let child = ctx.children[0];
            let link: PageLink = { url: ctx.url, child: child.type === 'text' ? child.value : ctx.url };
            links.set(ctx.url, link);
        }
    }
}



function importCSSPlugin() {
    return (tree, file) => {
        let cssPaths = [];
        unistVisit(tree, ['import'], (node) => {
            const ast = babelParser(node.value as string, { sourceType: 'module' });
            
            if (ast.type === 'File'
                && ast.program?.sourceType === 'module'
            ) {
                const decls = ast.program.body.filter(n => n.type === 'ImportDeclaration');

                for (const decl of decls) {
                    const value = decl['source'].value;
                    if (value.endsWith('.css')) {
                        cssPaths.push(value);
                        node.type = 'killme';
                    }
                }
            }
        });

        unistRemove(tree, {cascade: false}, n => n.type === 'killme');

        if( cssPaths.length > 0 ){
            let cssNode = {
                type: 'export',
                value: `export const _inlineCSS = [ ${cssPaths.map(c => `'${c}'`).join(',')} ]`
            };
            tree.children.unshift(cssNode);
        }

        // unistRemove(tree, { cascade: false }, (node, idx, parent) => {
        //     if (node.type === 'import') {
        //         // const exists = node.children.filter(node => node.type === 'text' && node.value.trim().startsWith('//'));
        //         if (node.value > 0) {
        //             // console.log('[removeCommentPlugin]', node);
        //             // return true;
        //         }
        //     }
        //     return false;
        // });
        // console.log('[importCSSPlugin]', cssPaths);
    }
}