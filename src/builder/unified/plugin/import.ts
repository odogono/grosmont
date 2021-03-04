import unistRemove from 'unist-util-remove';
import unistVisit from 'unist-util-visit';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";


export interface ImportPluginOptions {
    resolveImport?: (path: string) => [string, boolean] | undefined;
}

/**
 * 
 * @param options 
 */
export function importPlugin(options: ImportPluginOptions = {}) {
    return (tree, vFile) => {
        let cssPaths = [];
        let removeList = [];

        unistVisit(tree, ['import'], (node, index, parent) => {
            let changed = false;
            let removed = false;
            const ast = babelParser(node.value as string, { sourceType: 'module' });

            traverse(ast, {
                ImportDeclaration(path) {
                    let importPath = path.node.source.value;
                    const resolved = options.resolveImport(importPath);
                    // log('[importCSS]', importPath, resolved);
                    if (resolved !== undefined) {
                        const [url, remove] = resolved;
                        path.node.source.value = url;
                        if (remove) {
                            // removeList.push( url );
                            removed = true;
                        } else {
                            changed = true;
                        }
                    }
                }
            });

            if (removed) {
                (parent.children as any[]).splice(index, 1);
                return [unistVisit.SKIP, index]
            }

            if (changed) {
                let generateResult = babelGenerate(ast);
                node.value = generateResult.code;
            }
        });

        // log('[importCSS]', 'remove', removeList);
        // if( removeList.length > 0 ){
        //     removeList.forEach( url => unistRemove(tree, {value:url} ));
        // }


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