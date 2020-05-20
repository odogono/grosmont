import Path from 'path';
import Fs from 'fs-extra';
import Mdx from '@mdx-js/mdx';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as Babel from "@babel/core";
const _eval = require('eval');
import { mdx, MDXProvider } from '@mdx-js/react'
const emoji = require('remark-emoji')
const frontmatter = require('remark-frontmatter');
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';

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


export async function transpile(path: string) {

    const Component = readToElements(path);

    // const fn = new Function('_fn', 'React', `return ${code}`);

    const components = {
        wrapper: ({ children, ...props }) => {
            //   console.log(children.map(child => child.props.mdxType))
            return <>{children}</>
        },
        Something: ({ children, ...props }) => <div className="blnk">{children}</div>
    }

    const html = ReactDOMServer.renderToStaticMarkup(
        <MDXProvider components={components}>
            <Component />
        </MDXProvider>);
    // console.log(html);

    return html;
    // const out = fn({}, React );
    // console.log('out = ', mdx("h1", null, `Hello, world!`) );
}

function readToElements(path: string) {
    const content = Fs.readFileSync(path, 'utf8');

    // this is probably the key to extracting data from the mdx

    const options = {
        filepath: path,
        remarkPlugins: [
            emoji,
            [frontmatter, { type: 'config', marker: '+' }],
            configPlugin,
            removeCommentPlugin,
        ],
        // skipExport: true
    };

    let jsx = Mdx.sync(content, options);

    console.log('jsx', jsx);
    let code = transformJSX(jsx);
    const el = buildElement(code, path);

    return el;
}

function transformJSX(jsx: string) {
    return Babel.transform(jsx, { presets }).code;
}

function buildElement(code: string, path: string) {
    const require = (requirePath) => {
        const fullPath = Path.resolve(Path.dirname(path), requirePath);
        return readToElements(fullPath);
    }
    let ed = _eval(code, path, { mdx, require });

    console.log('[buildElement]', ed);

    return ed.default;
}



function removeTypePlugin(options = {}) {
    return (tree, file) => {
        // console.log('[removeTypePlugin]', file);
        unistRemove(tree, options);
    }
}

function configPlugin() {
    return (tree, file) => {
        unistVisit(tree, { type: 'config' }, (node, index, parent) => {

            // TODO : convert this into a javascript call

            // console.log('[configPlugin]', node);// (node as any).value);
        })
        unistRemove(tree, 'config');
    }
};

function removeCommentPlugin() {
    return (tree, file) => {
        unistRemove(tree, {cascade:false}, (node, idx, parent) => {
            if( node.type === 'paragraph' ){
                const exists = node.children.filter( node => node.type === 'text' && node.value.trim().startsWith('//') );
                if( exists.length > 0 ){
                    // console.log('[removeCommentPlugin]', node);
                    return true;
                }
            }
            return false;
        });
    }
};