import unistVisit from 'unist-util-visit';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';


export function importCSSPlugin() {
    return (tree, file) => {
        let cssPaths = [];
        unistVisit(tree, ['import'], (node) => {
            const ast = babelParser(node.value as string, { sourceType: 'module' });
            
            if (ast.type === 'File'
                && ast.program?.sourceType === 'module'
            ) {
                
                // const decls = ast.program.body.filter(n => n.type === 'ImportDeclaration');

                // for (const decl of decls) {
                //     const value = decl['source'].value;
                //     if (value.endsWith('.css')) {
                //         console.log('[importCSSPlugin]', babelGenerate(decl) );
                //         cssPaths.push(value);
                //         // decl.type = 'killme';
                //     }
                // }

                let found = false;
                ast.program.body = ast.program.body.filter( node => {
                    if( node.type !== 'ImportDeclaration' ){
                        return true;
                    }
                    if( node.source.value.endsWith('.css') ){
                        cssPaths.push(node.source.value);
                        found = true;
                        return false;
                    }
                    return true;
                });

                if( found ){
                    let generateResult = babelGenerate(ast);
                    if( generateResult ){
                        node.value = generateResult.code;
                    }
                }
                // console.log( ast.program.body );
            }
        });

        if( cssPaths.length > 0 ){
            let cssNode = {
                type: 'export',
                value: `export const _inlineCSS = [ ${cssPaths.map(c => `'${c}'`).join(',')} ]`
            };
            tree.children.unshift(cssNode);
        }
    }
}