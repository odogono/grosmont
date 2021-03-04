import unified from 'unified';
var stringify = require('remark-stringify')
import parse from 'remark-parse';
import unistVisit from 'unist-util-visit';
import { select } from 'unist-util-select';
import unistRemove from 'unist-util-remove';
import { toJSX } from '../../processor/mdx/mdx-hast-to-jsx';
import { parse as babelParser } from '@babel/parser';
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";
import { transformJSX, processMdx } from '../../processor/mdx/transpile';

export interface LinkProcProps {
    resolveLink?: (url: string, text?: string) => any;
}

export function clientProc({ resolveLink }: LinkProcProps) {

    return (tree, vFile) => {

        // unistVisit(tree, ['mdxBlockElement'], visitor);
        unistVisit(tree, { type: 'mdxBlockElement', name: 'ClientCode' },

            (node, index, parent) => {
                // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
                // const ctx = node;
                // if (!ctx) return;

                // console.log('[clientProc]', 'index', index, parent);

                

                const holderNode = {
                    type: 'mdxBlockElement',
                    name: 'div',
                    attributes: [
                        { type:'mdxAttribute', name:'id', 
                            value:{ type: 'mdxValueExpression', value:`'holder'`} }
                    ]
                };

                
                // (parent.children as any[]).splice( index, 0, holderNode );


                // const {ast:divAst} = processMdx(`<div id={'root'}/>`, {});
                // let divAst;
                // let div = unified()
                //     .use(parse)
                //     .use(stringify)
                //     .use(() => tree => { divAst = JSON.stringify(tree, null, '\t') })
                //     .use(mdx)
                //     .use(mdxjs)
                //     .processSync(`<div id={'root'}/>`);
                // .use(() => tree => { ast = JSON.stringify(tree, null, '\t') })
                // console.log('[clientProc]', 'div', JSON.stringify( divAst.children[1], null, '\t') );

                // console.log('[clientProc]', JSON.stringify(node as any, null, '\t'));
                // console.log('[clientProc]', node);

                // setDebug( true );
                let jsx = toJSX( (node as any).children[0], undefined, { odgnMode:true } );
                const ast = babelParser(jsx, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

                let generateResult = babelGenerate(ast);
                // console.log('[clientProc]', 'code', generateResult.code);

                console.log('[clientProc]', 'jsx', jsx );
                console.log('[clientProc]', 'bG', generateResult.code );
                console.log('[clientProc]', 'transform', transformJSX( jsx ) );


                // setDebug( false );
                (parent.children as any[])[index] = holderNode; //splice( Math.max(0,(index-1)), 0, holderNode );
            });

        // unistRemove(tree, { type: 'mdxBlockElement', name: 'ClientCode' });
    }
}
