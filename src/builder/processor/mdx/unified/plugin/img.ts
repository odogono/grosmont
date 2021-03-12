import unistVisit from 'unist-util-visit';

export interface ImgProcProps {
    resolveLink?: (url:string, text?:string) => any;
}

export function process({ resolveLink }: ImgProcProps) {
    
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
            
            // log('src', srcValue);

            if( resolveLink ){
                let resultUrl = resolveLink( srcValue, altValue )
                if( resultUrl !== undefined ){
                    srcAttr.value.value = ensureQuotes(resultUrl);
                }
            }
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