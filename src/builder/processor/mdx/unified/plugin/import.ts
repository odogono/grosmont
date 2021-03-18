import unistVisit from 'unist-util-visit';
import traverse from "@babel/traverse";
import { generateFromAST, parseJSX } from '../../../../transpile';

const log = (...args) => console.log('[/plugin/import]', ...args);


export interface ImportPluginOptions {
    resolveImport?: (path: string, specifiers: string[]) => [string, boolean] | undefined;
}

/**
 * 
 * @param options 
 */
export function importPlugin({resolveImport}: ImportPluginOptions = {}) {
    return (tree, vFile) => {

        unistVisit(tree, ['import'], (node, index, parent) => {
            let changed = false;
            let removed = false;
            const ast = parseJSX(node.value as string);

            // log('import', ast );
            
            traverse(ast, {
                ImportDeclaration(path) {
                    let jsx = generateFromAST(path.node);
                    let specifiers = path.node.specifiers.map( s => generateFromAST(s));
                    let importPath = path.node.source.value;

                    const resolved = resolveImport(importPath, specifiers);
                    // log('resolved', importPath, resolved );
                    
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
                node.value = generateFromAST(ast);
            }
        });
    }
}


