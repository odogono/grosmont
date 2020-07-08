import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';
import {select,selectAll} from 'unist-util-select';

/**
 * 
 * @param options 
 */
export function titlePlugin() {
    return (tree, file) => {

        let pageProps = appendExport(tree, 'page', { });

        if( 'title' in pageProps && 'description' in pageProps ){
            return;
        }

        const firstHeading = select('heading[depth=1] > text', tree);

        if( firstHeading ){
            const description = select('heading[depth=1] + paragraph > text', tree);

            if( !('title' in pageProps) ){
                pageProps.title = firstHeading.value;
            }
            if( !('description' in pageProps) ){
                pageProps.description = description?.value ?? '';
            }
        }

        // re-apply with new properties
        pageProps = appendExport(tree, 'page', pageProps );

        // log('tree', tree);
    }
};


function appendExport(tree, name: string, additional: any = {}) {

    let props:any = {};
    let found = false;

    unistVisit(tree, ['export'], (node) => {
        const ast = babelParser(node.value as string, { sourceType: 'module' });

        const propGather = {
            ObjectProperty(path) {
                const key = path.node.key?.name ?? path.node.key?.value;
                const value = path.node.value?.value;
                // log('propGather', key);
                if (key !== undefined) {
                    this.props[key] = value;
                }
            }
        };

        const propSet = {
            ObjectExpression(path) {
                // log('[ObjectExpression]', path.node,
                // path.node.properties.map( p => babelGenerate(p).code ) );

                let properties = Object.keys(this.props).map(key => {
                    return t.objectProperty(t.stringLiteral(key), t.valueToNode(this.props[key]));
                })
                path.node.properties = properties;
            }
        }

        const alterObj = {
            VariableDeclarator(path) {
                if (path.node.id.name === name) {
                    found = true;
                    
                    path.traverse(propGather, { props });
                    // log('[traverse][VariableDeclarator]', name, props, babelGenerate(path.node).code );

                    // log('[traverse][VariableDeclarator]', path.node);

                    props = { ...props, ...additional };
                    path.traverse(propSet, { props });
                }
            }
        }

        // ast.traverse( alterObj, {haha:'lol'});
        traverse(ast, alterObj);

        // console.log('[titlePlugin]', 'pre', node.value);

        let generateResult = babelGenerate(ast);
        if (generateResult) {
            node.value = generateResult.code;
        }

        // console.log('[titlePlugin]', 'post', node.value);
    });

    if( found === false ){
        // no page export found - add a new export node
        let value = `export const page = ${JSON.stringify(props)};`;
        tree.children.unshift({
            type:'export', value
        });
    }
    

    return props;
}


function log(...args){
    console.log('[titlePlugin]', ...args);
}