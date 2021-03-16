import unistVisit from 'unist-util-visit';
import { ensureQuotes, removeQuotes } from '../../../../util';

export interface ImgProcProps {
    resolveLink?: (url:string, text?:string) => any;
}

export function process({ resolveLink }: ImgProcProps) {
    
    return (tree, vFile) => {

        unistVisit(tree, ['mdxSpanElement', 'mdxBlockElement'], visitor);

        function visitor(node) {
            if( !node  ){
                return;
            }

            if( node.name !== 'img' ){
                return;
            }

            const srcAttr = node.attributes.find( attr => attr.name === 'src');
            const altAttr = node.attributes.find( attr => attr.name === 'alt');

            if( srcAttr === undefined ){
                return;
            }

            let srcValue = srcAttr.value?.value;
            let altValue = altAttr?.value;

            if( srcValue === undefined ){
                return;
            }

            // console.log('src', srcValue, node);

            // clean the src
            srcValue = removeQuotes(srcValue);
            
            if( resolveLink ){
                let resultUrl = resolveLink( srcValue, altValue )
                if( resultUrl !== undefined ){
                    srcAttr.value.value = ensureQuotes(resultUrl);
                }
            }
        }
    }
}
