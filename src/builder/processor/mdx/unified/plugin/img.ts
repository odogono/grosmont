import unistVisit from 'unist-util-visit';
import { ResolveLinkType } from '../../../../types';
import { ensureQuotes, removeQuotes } from '../../../../util';

export interface ImgProcProps {
    resolveLink?: ResolveLinkType;
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

            // console.log('replace url', {srcAttr, altAttr});

            if( srcAttr === undefined ){
                return;
            }

            let srcValue = srcAttr.value?.value ?? srcAttr.value;
            let altValue = altAttr?.value;

            if( srcValue === undefined ){
                return;
            }

            // clean the src
            srcValue = removeQuotes(srcValue);

            // console.log('replace url', {srcValue, altValue});
            
            if( resolveLink ){
                let result = resolveLink( srcValue, altValue )
                if( result !== undefined ){
                    // console.log('replace url', resultUrl);
                    srcAttr.value = result.url;// ensureQuotes(resultUrl);
                }
            }
        }

        const test = [
            {type:'image'}
        ]
        unistVisit(tree, test, (node, index,parent) => {
            
            // console.log( node );

            let srcValue:string = node.url as string;
            let altValue:string = node.alt as string;

            if( !srcValue ){
                return;
            }

            if( resolveLink ){
                let result = resolveLink( srcValue, altValue )
                // console.log('replace url', resultUrl);
                if( result !== undefined ){
                    node.url = result.url;
                }
            }

        });
    }
}

/**
 * 
 * srcAttr: {
    type: 'mdxAttribute',
    name: 'src',
    value: 'file:///media/grosmont.jpg',
    position: { start: [Object], end: [Object] }
  },

  srcAttr: {
    type: 'mdxAttribute',
    name: 'src',
    value: {
      type: 'mdxValueExpression',
      value: "'file:///static/image.jpg'",
      position: [Object]
    },
    position: { start: [Object], end: [Object] }
  },
 * 
 */