import unistVisit from 'unist-util-visit';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";


export interface ImportCSSPluginOptions {
    resolve?: (path:string, mimes?:string[]) => string | undefined;
}

/**
 * 
 * @param options 
 */
export function importCSSPlugin(options: ImportCSSPluginOptions = {}) {
    return (tree, vFile) => {
        let cssPaths = [];
        // log( tree );
        unistVisit(tree, ['import'], (node) => {
            let changed = false;
            const ast = babelParser(node.value as string, { sourceType: 'module' });

            traverse(ast, {
                ImportDeclaration(path) {
                    let importPath = path.node.source.value;
                    path.node.source.value = options.resolve( importPath );
                    // log('[importCSS]', path.node.source.value );
                    changed = true;
                    // let resolvedEid = resolvePath(site, importPath, srcUrl);
                    // if (resolvedEid !== undefined) {
                    //     const val = `e://${resolvedEid}/component/jsx#component`;
                    //     imports.push([resolvedEid, val]);
                    //     // importEids.push(resolvedEid);
                    //     path.node.source.value = val;
                    // }
                }
            });

            if( changed ){
                let generateResult = babelGenerate(ast);
                node.value = generateResult.code;
            }


            // if (ast.type === 'File' && ast.program?.sourceType === 'module') {
            //     let found = false;
            //     ast.program.body = ast.program.body.filter(node => {
            //         if (node.type !== 'ImportDeclaration') {
            //             return true;
            //         }
            //         const { value } = node.source;

            //         if (options.resolve) {
            //             let cssPath = options.resolve(value, ['text/css', 'text/scss'] );
            //             if( cssPath !== undefined ){
            //                 log('adding cssPath', cssPath, value);
            //                 cssPaths.push(cssPath);
            //                 found = true;
            //                 return false;
            //             }
            //         }

            //         return true;
            //     });

            //     if (found) {
            //         let generateResult = babelGenerate(ast);
            //         if (generateResult) {
            //             node.value = generateResult.code;
            //         }
            //     }
            // }
        });


        if (cssPaths.length > 0) {
            let cssNode = {
                type: 'export',
                value: `export const cssLinks = [ ${cssPaths.map(c => `'${c}'`).join(',')} ]`
            };
            // log( cssNode );
            tree.children.unshift(cssNode);
        }
    }
}


const log = (...args) => console.log('[importCSSPlugin]', ...args);