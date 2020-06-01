import unistVisit from 'unist-util-visit';
import { PageLinks, PageLink } from "../../context";

export interface LinkProcProps {
    links: PageLinks;
    applyLinks?: PageLinks;
}

export function linkProc({ links, applyLinks }: LinkProcProps) {
    // console.log('[linkProc]', options);

    return (tree, file, ...args) => {
        // let links =  {};

        unistVisit(tree, ['link', 'linkReference'], visitor);

        function visitor(node) {
            // const ctx = node.type === 'link' ? node : Definitions(node.identifier)
            const ctx = node;
            if (!ctx) return;

            if (applyLinks !== undefined) {
                let applyLink = applyLinks.get(ctx.url);
                if (applyLink !== undefined) {
                    ctx.url = applyLink.url;
                }
            }

            // console.log('[linkProc]', args, ctx);
            let child = ctx.children[0];
            let link: PageLink = { url: ctx.url, child: child.type === 'text' ? child.value : ctx.url };
            links.set(ctx.url, link);
        }
    }
}
