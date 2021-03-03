import unistVisit from 'unist-util-visit';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";


export interface ImportPluginOptions {
    resolve?: (path:string, mimes?:string[]) => string | undefined;
}

/**
 * 
 * @param options 
 */
export function importPlugin(options: ImportPluginOptions = {}) {
    return (tree, vFile) => {
        let cssPaths = [];
        // log( tree );
        unistVisit(tree, ['import'], (node) => {
            let changed = false;
            const ast = babelParser(node.value as string, { sourceType: 'module' });

            traverse(ast, {
                ImportDeclaration(path) {
                    let importPath = path.node.source.value;
                    const resolved = options.resolve( importPath );
                    // log('[importCSS]', path.node.source.value );
                    if( resolved !== undefined ){
                        path.node.source.value = resolved;
                        changed = true;
                    }
                }
            });

            if( changed ){
                let generateResult = babelGenerate(ast);
                node.value = generateResult.code;
            }
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