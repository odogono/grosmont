import Path from 'path';
import Fs from 'fs-extra';

import React from 'react';
import { mdx, MDXProvider } from '@mdx-js/react'
import ReactDOMServer from 'react-dom/server';

import Toml from 'toml';
import Mdx from '@mdx-js/mdx';
import * as Babel from "@babel/core";
const _eval = require('eval');
const emoji = require('remark-emoji')
const frontmatter = require('remark-frontmatter');
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';
import { Layout } from './components/layout';
import { Head } from './components/head';


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
    relativePath: string;
    render?: boolean;
}

export interface TranspileResult extends TranspileProps {
    html?: string;
    component?: any;
}


export async function transpile(props:TranspileProps):Promise<TranspileResult> {
    const doRender = props.render ?? false;
    const {path} = props;

    const components = {
        wrapper: ({ children, ...props }) => {
            return <div className="layout">{children}</div>
        },
        Head,
        Layout
    }

    // console.log('[transpile]', props);

    const {component, frontMatter, ...rest} = parseMdx(path);

    // console.log('[transpile]', path, frontMatter);

    if( frontMatter !== undefined && frontMatter.enabled === false ){
        return props;
    }

    const html = doRender ? 
        renderHTML({components, component, frontMatter, ...rest}) 
        : undefined;

    return {
        ...props,
        component,
        html
    }
}

function renderHTML({components, component:Component, frontMatter, ...rest}){

    const html = ReactDOMServer.renderToStaticMarkup(
        <MDXProvider components={components}>
            <Component />
        </MDXProvider>, { pretty: true });

    return html;
}


function parseMdx(path: string) {
    let content = Fs.readFileSync(path, 'utf8');

    // todo - must be a better way to handle this
    // essentially, fragments defined as <> get converted into
    // React.Fragment, which gets complained about
    // content = content.replace(/<\>/g, '<Fragment>');
    // content = content.replace(/\<\/\>/g, '</Fragment>');

    // this is probably the key to extracting data from the mdx

    const options = {
        filepath: path,
        remarkPlugins: [
            emoji,
            [frontmatter, { type: 'frontMatter', marker: '+' }],
            configPlugin,
            removeCommentPlugin,
            // () => tree => console.log('[parseMdx]', 'tree', tree)
        ],
        // skipExport: true
    };

    let jsx = Mdx.sync(content, options);

    // if( path.includes('index.mdx') )
    // console.log('🦉jsx');

    let code = transformJSX(jsx);
    // console.log('🦉evalCode', path);
    const el = evalCode(code, path);

    // if( path.includes('index.mdx') )
    // console.log('el', el);
    // console.log('🦉el', path);

    return el;
}

function transformJSX(jsx: string) {
    const alias = {
        "react": "preact-compat",
        'react-dom': 'preact-compat',
    }
    const plugins = [
        [ "module-resolver", {
            "root": ["."],
            alias
        }]
    ]
    return Babel.transform(jsx, { presets, plugins }).code;
}

function evalCode(code: string, path: string) {
    let requires = [];
    const requireManual = (requirePath) => {
        console.log('[require]', requirePath );
        const fullPath = Path.resolve(Path.dirname(path), requirePath);
        if( Fs.existsSync(fullPath) && fullPath.endsWith('.mdx') ){
            // console.log('[require]', fullPath);
            return parseMdx(fullPath).default;
        }
        const req = require(requirePath);

        requires.push({ exports:Object.keys(req).join(','), path:requirePath})
        return req;
    }
    let out = _eval(code, path, { mdx, require:requireManual });
    const component = out['default'];

    return {...out, requires, component};
}



function removeTypePlugin(options = {}) {
    return (tree, file) => {
        // console.log('[removeTypePlugin]', file);
        unistRemove(tree, options);
    }
}

function configPlugin() {
    return (tree, file) => {
        unistVisit(tree, { type: 'frontMatter' }, (node, index, parent) => {
            
            const config = (node as any).value;
            // TODO : convert this into a javascript call
            try {
                let parsed = Toml.parse(config);
                // console.log('[configPlugin]', parsed);

                (node as any).type = 'export';
                (node as any).value = 'export const frontMatter = ' + JSON.stringify(parsed) + ';';
                (node as any).value += 'export const page = ' + JSON.stringify(parsed) + ';';
                
            } catch (e) {
                console.error("Parsing error on line " + e.line + ", column " + e.column +
                    ": " + e.message);
            }

        })
        unistRemove(tree, 'frontMatter');
    }
};

function removeCommentPlugin() {
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


