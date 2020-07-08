import unistVisit from 'unist-util-visit';
import { PageLinks, PageLink } from "../../context";
import {select,selectAll} from 'unist-util-select';


export interface LinkProcProps {
    links: PageLinks;
    applyLinks?: PageLinks;
}

export function linkProc({ links, applyLinks }: LinkProcProps) {
    
    return (tree, file, ...args) => {
        // let links =  {};
        // console.log('[linkProc]', tree);

        // selectAll('linkReference', tree);

        unistVisit(tree, ['link', 'linkReference'], visitor);

        function visitor(node) {
            // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
            const ctx = node;
            if (!ctx) return;

            const text = select('text', node);
            const url = node.url;

            if( url === undefined ){
                return;
            }

            if (applyLinks !== undefined) {
                let applyLink = applyLinks.get(ctx.url);
                if (applyLink !== undefined) {
                    ctx.url = applyLink.url;
                }
            }

            console.log('[linkProc]', text?.value, url );
            // console.log('[linkProc]', args, ctx);
            let child = ctx.children[0];
            let link: PageLink = { url: url, child: text?.value ?? url };
            links.set(url, link);
        }
    }
}
