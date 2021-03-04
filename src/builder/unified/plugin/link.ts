import unistVisit from 'unist-util-visit';
import {select} from 'unist-util-select';


export interface LinkProcProps {
    resolveLink?: (url:string, text?:string) => any;
}

export function linkProc({ resolveLink }: LinkProcProps) {
    
    return (tree, vFile) => {
        // let links =  {};
        // console.log('[linkProc]', tree);

        // selectAll('linkReference', tree);

        unistVisit(tree, ['link', 'linkReference'], visitor);

        function visitor(node) {
            // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
            const ctx = node;
            if (!ctx) return;

            // console.log('[linkProc]', ctx)

            const text = select('text', node);
            const url = node.url;

            if( url === undefined ){
                return;
            }

            if( resolveLink ){
                let resultUrl = resolveLink( url, text?.value as string )
                if( resultUrl !== undefined ){
                    ctx.url = resultUrl;
                }
            }
        }
    }
}
