import unistVisit from 'unist-util-visit';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';



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
        unistVisit(tree, ['import'], (node) => {
            const ast = babelParser(node.value as string, { sourceType: 'module' });

            if (ast.type === 'File' && ast.program?.sourceType === 'module') {
                let found = false;
                ast.program.body = ast.program.body.filter(node => {
                    if (node.type !== 'ImportDeclaration') {
                        return true;
                    }
                    const { value } = node.source;

                    if (options.resolve) {
                        let cssPath = options.resolve(value, ['text/css', 'text/scss'] );
                        if( cssPath !== undefined ){
                            // log('adding cssPath', cssPath);
                            cssPaths.push(cssPath);
                            found = true;
                            return false;
                        }
                        // if (options.resolve(value)) {
                        //     cssPaths.push(value);
                        //     found = true;
                        //     return false;
                        // }
                    }

                    // log('found', node.source.value);

                    // if (value.endsWith('.css')) {
                    //     cssPaths.push(value);
                    //     found = true;
                    //     return false;
                    // }
                    return true;
                });

                if (found) {
                    let generateResult = babelGenerate(ast);
                    if (generateResult) {
                        node.value = generateResult.code;
                    }
                }
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