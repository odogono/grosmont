import unistVisit from 'unist-util-visit';
import {select} from 'unist-util-select';
import { removeQuotes } from '../../../../util';


export interface LinkProcProps {
    resolveLink?: (url:string, text?:string) => any;
}

export function linkProc({ resolveLink }: LinkProcProps) {
    
    return (tree, vFile) => {
        unistVisit(tree, ['link', 'linkReference'], (node, index, parent) => {
            let removed = false;

            // console.log('[linkProc]', node)

            const text = select('text', node);
            let url = removeQuotes( node.url as string );

            if( url === undefined ){
                return;
            }

            
            if( resolveLink ){
                let resultUrl = resolveLink( url, text?.value as string )
                if( resultUrl !== undefined ){
                    // console.log('[link]', url, '->', resultUrl );
                    node.url = resultUrl;
                }
            }

            if (removed) {
                (parent.children as any[]).splice(index, 1);
                return [unistVisit.SKIP, index]
            }
        });
    }
}
