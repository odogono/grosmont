import unistVisit from 'unist-util-visit';
import { PageLinks, PageLink, PageImgs, PageImg } from "../../types";
import {select,selectAll} from 'unist-util-select';
import { hash, isString, parseJSON } from '@odgn/utils';

const log = (...args) => console.log('[imgPlugin]', ...args);

export interface ImgProcProps {
    imgs?: PageImgs;
}

export function process({ imgs }: ImgProcProps) {
    
    return (tree, vFile) => {
        // let links =  {};
        // console.log('[linkProc]', tree);

        // selectAll('linkReference', tree);

        unistVisit(tree, ['mdxSpanElement', 'mdxBlockElement'], visitor);

        function visitor(node) {
            if( !node  ){
                return;
            }

            const srcAttr = node.attributes.find( attr => attr.name === 'src');
            const altAttr = node.attributes.find( attr => attr.name === 'alt');

            // const src = select('[src]', node);
            // const url = node.url;
            // log('src', src);

            if( srcAttr === undefined ){
                return;
            }

            let srcValue = srcAttr.value?.value;
            let altValue = altAttr?.value;

            if( srcValue === undefined ){
                return;
            }

            // clean the src
            srcValue = srcValue.trim().replace(/^'(.+)'$/,'$1');
            

            const key = srcValue;// hash( srcValue + ':' + altValue, true ) as string;

            let entry = imgs.get(key);

            
            if( entry !== undefined ){
                // apply incoming
                srcAttr.value.value = ensureQuotes(entry.url);
                if( entry.alt !== undefined && altValue !== undefined && isString(altValue) ){
                    log('setting', entry.alt, altAttr);
                    altAttr.value = entry.alt;
                }
            } else {
                let img:PageImg = { url:srcValue, alt:altValue };
                imgs.set( key, img );
            }

            // // incoming links can overwrite the link url
            // if (applyLinks !== undefined) {
            //     let applyLink = applyLinks.get(ctx.url);
            //     // console.log('[linkProc]', 'applyLink', ctx.url, applyLink);
            //     if (applyLink !== undefined) {
            //         ctx.url = applyLink.url;
            //     }
            // }

            // // console.log('[linkProc]', text?.value, url );
            // // console.log('[linkProc]', args, ctx);
            // let child = ctx.children[0];
            // let link: PageLink = { url: url, child: text?.value ?? url };
            // links.set(url, link);
        }
    }
}

function ensureQuotes(str:string){
    if( str === undefined ){
        return '';
    }
    str = str.trim().replace(/^'(.+)'$/,'$1');
    return `'${str}'`;
}