import unified from 'unified';
var stringify = require('remark-stringify')
import parse from 'remark-parse';
import unistVisit from 'unist-util-visit';
import { select } from 'unist-util-select';
import unistRemove from 'unist-util-remove';
import { toJSX } from '../../mdx-hast-to-jsx';
import { parseJSX, generateFromAST, transformJSX } from '../../../../transpile';

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
                        {
                            type: 'mdxAttribute', name: 'id',
                            value: { type: 'mdxValueExpression', value: `'holder'` }
                        }
                    ]
                };



                // setDebug( true );
                let jsx = toJSX((node as any).children[0], undefined, { odgnMode: true });
                const ast = parseJSX(jsx);

                let code = generateFromAST(ast);
                // console.log('[clientProc]', 'code', generateResult.code);

                console.log('[clientProc]', 'jsx', jsx);
                console.log('[clientProc]', 'bG', code);
                console.log('[clientProc]', 'transform', transformJSX(jsx));

                // setDebug( false );
                (parent.children as any[])[index] = holderNode; //splice( Math.max(0,(index-1)), 0, holderNode );
            });

        // unistRemove(tree, { type: 'mdxBlockElement', name: 'ClientCode' });
    }
}
