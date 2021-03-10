import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import unistVisit from 'unist-util-visit';
import {select,selectAll} from 'unist-util-select';
import { isString } from "@odgn/utils";


export interface ConfigProps {
    onConfig: (config:any) => any;
}

/**
 * 
 * @param options 
 */
export function titlePlugin( { onConfig }: ConfigProps ) {
    return (tree, vFile) => {
        let config:any = {};
        
        // let pageProps = appendExport(tree, 'page', { });
        // // log('ok', pageProps);

        // if( 'title' in pageProps && 'summary' in pageProps ){
        //     return;
        // }

        const firstHeading = select('heading[depth=1] > text', tree);
        if( firstHeading ){
            config.title = firstHeading.value;
        }

        if( firstHeading ){
            const summary = select('heading[depth=1] + paragraph > text', tree);

            if( summary ){
                config.summary = summary.value;
            }

            // if( !('title' in pageProps) ){
            //     pageProps.title = firstHeading.value;
            // }
            // if( !('summary' in pageProps) ){
            //     let value = summary?.value;
            //     if( isString(value) && (value as string).length > 0 ){
            //         pageProps.summary = value;
            //     }
            // }
        }

        if( Object.keys(config).length > 0 ){
            onConfig( config );
        }

        // re-apply with new properties
        // pageProps = appendExport(tree, 'page', pageProps );

        // log('tree', tree);
    }
};


// function appendExport(tree, name: string, additional: any = {}) {

//     let props:any = {};
//     let found = false;

//     unistVisit(tree, ['export'], (node) => {
//         const ast = babelParser(node.value as string, { sourceType: 'module' });

//         const propGather = {
//             ObjectProperty(path) {
//                 const key = path.node.key?.name ?? path.node.key?.value;
//                 if( key === undefined ){
//                     return;
//                 }
//                 // const value = path.node.value?.value;
//                 path.skip(); // prevent going any further
//                 try {
//                     // log('eval', key, path.node.type, JSON.parse(babelGenerate(path.node.value).code) );
//                     // log( path.node );

//                     // let value = eval( babelGenerate(path.node.value).code );
//                     let value = JSON.parse( babelGenerate(path.node.value).code );
                    
//                     this.props[key] = value;
                    
//                     // log('eval ok', key, value);

//                 } catch( err ){
//                     // log('err', err.message, key, path.node.type, babelGenerate(path.node.value).code );
//                 }
//             }
//         };

//         const propSet = {
//             ObjectExpression(path) {
//                 // log('[ObjectExpression]', path.node,
//                 // path.node.properties.map( p => babelGenerate(p).code ) );

//                 let properties = Object.keys(this.props).map(key => {
//                     // log('[propSet]', key, this.props[key] );
//                     return t.objectProperty(t.stringLiteral(key), t.valueToNode(this.props[key]));
//                 })
//                 path.node.properties = properties;
//                 path.skip();
//             }
//         }

//         const alterObj = {
//             VariableDeclarator(path) {
//                 if (path.node.id.name === name) {
//                     found = true;
                    
//                     path.traverse(propGather, { props });
//                     // log('[traverse][VariableDeclarator]', name, props, babelGenerate(path.node).code );

//                     // log('[traverse][VariableDeclarator]', path.node.key?.name );

//                     props = { ...props, ...additional };
//                     path.traverse(propSet, { props });
//                 }
//             }
//         }

//         // ast.traverse( alterObj, {haha:'lol'});
//         traverse(ast, alterObj);

//         // console.log('[titlePlugin]', 'pre', node.value);

//         let generateResult = babelGenerate(ast);
//         if (generateResult) {
//             node.value = generateResult.code;
//         }

//         // console.log('[titlePlugin]', 'post', node.value);
//     });

//     if( found === false ){
//         // no page export found - add a new export node
//         // let value = `export const page = ${JSON.stringify(props)};`;
//         // tree.children.unshift({
//         //     type:'export', value
//         // });
//     }
    

//     return props;
// }


const log = (...args) => console.log('[titlePlugin]', ...args);