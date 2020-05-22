import Path from 'path';
import Fs from 'fs-extra';

import Toml from 'toml';
import Mdx from '@mdx-js/mdx';
import { Fragment, h, toChildArray } from 'preact'
import { mdx, MDXProvider } from '@mdx-js/preact'
import { render } from 'preact-render-to-string'
// import render from 'preact-render-to-string/jsx';
import { useState } from 'preact/hooks';

import * as Babel from "@babel/core";
const _eval = require('eval');
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
    "babel-preset-preact"
];


export async function transpile(path: string) {

    // await altParse(path);

    const {Component, frontMatter, ...rest} = readToElements(path);

    const components = {
        wrapper: ({ children, ...props }) => {
            return <Fragment>{children}</Fragment>
        },
        Something: ({ children, ...props }) => <div className="blnk">{children}</div>,
        ClientSide: ({ children, ...props }) => {
            console.log('[ClientSide]', App.toString());
            // console.log('[ClientSide]', toChildArray( children ) );
            return <div id="attach0" />
        }
    }

    const props = {page:frontMatter, ...rest};

    console.log('🦉props are', props);

    const html = render(
        <MDXProvider components={components}>
            <Component />
        </MDXProvider>, { pretty: true });

    return html;
}



// async function altParse(path: string) {
//     const { read, write } = require('to-vfile')
//     const remark = require('remark')
//     const mdx = require('remark-mdx')
//     const file = await read(path)
//     const contents = await remark()
//         .use(emoji)
//         .use(frontmatter, { type: 'frontMatter', marker: '+' })
//         .use(configPlugin)
//         .use(removeCommentPlugin)
//         .use(mdx)
//         // .use(() => tree => console.log(tree))
//         .process(file);

//     console.log('[altParse]', contents);
// }

function readToElements(path: string) {
    const content = Fs.readFileSync(path, 'utf8');

    // this is probably the key to extracting data from the mdx

    const options = {
        filepath: path,
        remarkPlugins: [
            emoji,
            [frontmatter, { type: 'frontMatter', marker: '+' }],
            configPlugin,
            removeCommentPlugin,
            () => tree => console.log('[readToElements]', 'tree', tree)
        ],
        // skipExport: true
    };

    let jsx = Mdx.sync(content, options);

    // console.log('jsx', jsx);
    let code = transformJSX(jsx);
    console.log('code', code);
    const el = buildElement(code, path);

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

function buildElement(code: string, path: string) {
    const require = (requirePath) => {
        const fullPath = Path.resolve(Path.dirname(path), requirePath);
        return readToElements(fullPath);
    }
    let out = _eval(code, path, { mdx, require });
    const Component = out['default'];

    // console.log('[buildElement]', out);

    return {...out, Component};
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



const App = () => {
    const [input, setInput] = useState('');

    return (
        <div>
            <p>Do you agree to the statement: "Preact is awesome"?</p>
            <input value={input} onChange={e => setInput((e.target as HTMLTextAreaElement).value)} />
        </div>
    )
}