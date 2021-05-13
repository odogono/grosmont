import { Node } from 'unist'
import unistVisit from 'unist-util-visit';
import { select } from 'unist-util-select';
import { removeQuotes } from '../../../../util';
import { ResolveLinkType } from '../../../../types';

const log = (...args) => console.log('[/plugin/link]', ...args);

export interface LinkProcProps {
    resolveLink?: ResolveLinkType;
}

export function linkProc({ resolveLink }: LinkProcProps) {

    return (tree, vFile) => {



        // unistVisit(tree, {type:'paragraph'}, (node, index,parent) => {
        //     log('para', node);
        // });

        // unistVisit(tree, {type:'paragraph'}, (node,index,parent) => {
        //     log('para', node);
        // });


        const test = [
            { type: 'mdxBlockElement', name: 'a' },
            { type: 'mdxSpanElement', name: 'a' }
        ]
        unistVisit(tree, test, (node, index, parent) => {

            const hrefNodeIdx = (node as any).attributes.findIndex(attr => attr.name === 'href');

            if (hrefNodeIdx === -1) {
                return;
            }

            let hrefNode = node.attributes[hrefNodeIdx];
            let url = hrefNode.value;


            const textNode = select('* > text', node);
            let text = textNode?.value;


            // annoyingly, the a elements text is contained within a paragraph
            // this removes that paragraph
            if ((node.children as Node[]).length === 1) {
                let paraNode: Node = node.children[0];
                if (paraNode && paraNode.type === 'paragraph') {
                    node.children[0] = textNode;
                }
            }

            if (resolveLink) {
                let result = resolveLink(url, text as string);

                if (result !== undefined) {
                    hrefNode.value = result.url;

                    if (result.attrs?.isCurrent) {
                        (node.attributes as any[]).push({
                            type: 'mdxAttribute',
                            name: 'aria-current',
                            value: 'true'
                        });
                    }
                    // log('[resolveLink]', '!!', node);
                }
                else {
                    // remove the href
                    (node.attributes as any[]).splice(hrefNodeIdx, 1);
                }
            }

        });


        unistVisit(tree, ['link', 'linkReference'], (node, index, parent) => {
            let removed = false;

            // log('[linkProc]', node)

            const text = select('text', node);
            let url = removeQuotes(node.url as string);

            if (url === undefined) {
                return;
            }


            if (resolveLink) {
                let result = resolveLink(url, text?.value as string)
                // log('[resolveLink]', url, text, result);

                if (result !== undefined) {
                    // console.log('[link]', url, '->', resultUrl );
                    node.url = result.url;
                    
                    if (result.attrs?.isCurrent) {
                        if( !node.attributes ){
                            node.attributes = [];
                        }
                        (node.attributes as any[]).push({
                            type: 'mdxAttribute',
                            name: 'aria-current',
                            value: 'true'
                        });
                    }
                    
                    // log('[resolveLink]', node);
                    // node.attributes
                } else {
                    node.type = 'mdxSpanElement';
                    node.name = 'a';
                }
            }

            if (removed) {
                (parent.children as any[]).splice(index, 1);
                return [unistVisit.SKIP, index]
            }
        });
    }
}
