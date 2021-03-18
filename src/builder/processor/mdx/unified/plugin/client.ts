import unified from 'unified';
import Util from 'util';
import parse from 'remark-parse';
import unistVisit from 'unist-util-visit';
import { select } from 'unist-util-select';
import unistRemove from 'unist-util-remove';
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import { toJSX, serializeChildren } from '../../mdx-hast-to-jsx';
import { parseJSX, generateFromAST, transformJSX } from '../../../../transpile';
import { hastToMdxHast, toHAST } from '../../util';
import { MDXPluginOptions } from '../../../../types';
import { hash } from '@odgn/utils';


const log = (...args) => console.log(`[/processor/mdx/plugin/client]`, ...args);
// const log = (...args) => { };


/**
 * Extracts code from ClientCode tags and places them in an external js file
 * which is then included in the page
 * 
 * ClientCode is replaced with a 'holder' div with a unique id
 * the code is parsed and packaged into a component; imports are extracted
 * a script file for the entity is retrieved/created
 * this script e has entries for every script on the page (or maybe the site?)
 * code is added
 * 
 * // TODO : server render the component into the holder div so
 * 
 * when rendering the client script, it is passed to rollup which transpiles it into /output
 * an import is added to the page
 */
export function clientProc({ registerClientCode }: MDXPluginOptions) {

    // <script crossorigin src="https://unpkg.com/react@17/umd/react.development.js"></script>
    // <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"></script>


    return async (tree, vFile, next) => {

        let imports = [];
        let components = {};

        // unistVisit(tree, ['mdxBlockElement'], visitor);
        unistVisit(tree, { type: 'mdxBlockElement', name: 'ClientCode' },
            (node, index, parent) => {
                // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
                // const ctx = node;
                // if (!ctx) return;

                // console.log('[clientProc]', 'index', index, node);

                // extract the content from the node
                // setDebug( true );
                let {imports:codeImports, code, componentId} = prepareCode(node);

                components[ componentId ] = code;
                imports = imports.concat( codeImports );


                const data = `<div id="client-code-${componentId}"></div>`;

                let { ast } = toHAST(data);

                const replaceNode = hastToMdxHast(ast);

                (parent.children as any[])[index] = replaceNode;
            });

        await registerClientCode( {imports, components} );

        return next();
        // unistRemove(tree, { type: 'mdxBlockElement', name: 'ClientCode' });
    }
}


function prepareCode(node: any) {
    
    let jsx = node.children.map(c => toJSX(c, undefined, {odgnMode:true} )).join('\n');

    // log('jsx', jsx);

    let ast = parseJSX(jsx);
    let {imports, statements, expressions} = extractImports(ast);
    // let code = generateFromAST(ast);

    let buffer = [];
    // buffer.push( 'function Component(){ ');
    buffer = buffer.concat( statements );
    buffer.push( 'return <>');
    buffer = buffer.concat( expressions );
    buffer.push( '</>;' );

    let body = buffer.join('\n');
    let bodyHash = hash( body, true );

    body = `function Component${bodyHash}() { ${body} }`;

    let code = body;
    // let code = transformJSX( body );
    // code = code.replace('"use strict";\n', '');

    // log('code', imports);
    return {imports, code, componentId:bodyHash };
}


function extractImports(ast: any) {

    let imports = [];
    let lastExpression = null;

    // extract and remove import/export from tree
    traverse(ast, {
        ImportDeclaration(path) {
            let jsx = generateFromAST(path.node);
            // we add both the full code line AND the import src
            imports.push( [jsx, path.node.source.value] );
            path.remove();
        },
        ExportNamedDeclaration(path){
            let jsx = generateFromAST(path.node);
            imports.push( jsx );
            path.remove();
        },
    });

    const {body} = ast.program;

    let statements = [];
    let expressions = [];
    let expressionMode = true;
    // gather the last expression statements
    for( let ii=body.length-1;ii>=0; ii-- ){
        // log('type', body[ii].type );
        if( body[ii].type !== 'ExpressionStatement' ){
            expressionMode = false;
        }
        let jsx = generateFromAST(body[ii]);
        if( expressionMode ){
            if( jsx.endsWith(';') ){
                jsx = jsx.substring(0, jsx.length-1 );
            }
            expressions.push( jsx );
        } else {
            statements.push( jsx );
        }
    }

    statements.reverse();
    expressions.reverse();

    // log('and');
    // ast.program.body.forEach( n => log('type', n.type ));

    // log('imports', imports);

    return {ast, imports, statements, expressions};
}