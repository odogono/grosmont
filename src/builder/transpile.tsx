import * as Babel from "@babel/core";
import babelGenerate from '@babel/generator';
import { parse as babelParser } from '@babel/parser';
import { File as BabelAST } from "@babel/types";

const log = (...args) => console.log('[/processor/mdx/transpile]', ...args);




export function parseJSX(jsx: string): BabelAST {
    // const plugins = [
    //     ["module-resolver", {
    //         "root": ["."],
    //         // alias
    //     }],
    // ];

    return babelParser(jsx, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
}

/**
 * 
 * @param ast 
 * @returns 
 */
export function generateFromAST(ast: BabelAST): string {

    let generateResult = babelGenerate(ast);
    return generateResult !== undefined ? generateResult.code : undefined;


}

export function transformJSX(jsx: string, esModules: boolean = false): string {
    // const targets = esModules ? { esmodules: true } : { node: 'current' };
    const targets = { node: 'current' };
    const presets = [
        // ["latest-node", { "target": "current" }],
        ["@babel/preset-env", {
            exclude: [
                "@babel/plugin-transform-spread"
            ],
            modules: esModules ? false : 'commonjs',
            targets
        }],
        "@babel/preset-react"
    ];

    // const alias = {
    //     "react": "preact-compat",
    //     'react-dom': 'preact-compat',
    // }
    const plugins = [
        ["module-resolver", {
            "root": ["."],
            // alias
        }],
        ["@babel/plugin-transform-typescript", {
            isTSX: true
        }]
    ]
    return Babel.transformSync(jsx, { presets, plugins }).code;
}

/**
 * Transforms any import/export statements to Commonjs equivilents
 * 
 * @param js 
 * @returns 
 */
export function transformModulesToCJS(js: string): string {
    const {code} = Babel.transformSync(js, {
        plugins: ["@babel/plugin-transform-modules-commonjs"]
    });
    return code;
}