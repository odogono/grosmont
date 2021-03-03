import unistVisit from 'unist-util-visit';
import { PageLinks, PageLink } from "../../types";
import {select,selectAll} from 'unist-util-select';


export interface LinkProcProps {
    links: PageLinks;
    applyLinks?: PageLinks;
    resolveLink?: (url:string, text?:string) => any;
}

export function linkProc({ links, applyLinks, resolveLink }: LinkProcProps) {
    
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

            // // incoming links can overwrite the link url
            // if (applyLinks !== undefined) {
            //     let applyLink = applyLinks.get(ctx.url);
            //     // console.log('[linkProc]', 'applyLink', ctx.url, applyLink);
            //     if (applyLink !== undefined) {
            //         ctx.url = applyLink.url;
            //     }
            // }

            // console.log('[linkProc]', text?.value, url );
            // console.log('[linkProc]', args, ctx);
            // let child = ctx.children[0];
            // let link: PageLink = { url: url, child: text?.value ?? url };
            // links.set(url, link);
        }
    }
}
