import { toBoolean } from '@odgn/utils';
import unistVisit from 'unist-util-visit';
import { ensureQuotes, removeQuotes } from '../../../../util';

import { DependencyType } from '../../../../types';
import { hastToMdxHast, toHAST } from '../../util';

export interface SvgProcProps {
    // given a srcUrl, returns the data that belongs to the matching entity
    resolveData?: (srcUrl: string, text?:string, type?:DependencyType) => Promise<any>;
    resolveLink?: (url:string, text?:string) => any;
}

export function process({ resolveData, resolveLink }: SvgProcProps) {

    return async (tree, vFile, next) => {

        let replaceNodes = [];

        unistVisit(tree, { type: 'mdxBlockElement', name: 'svg' }, (node, index, parent) => {
            if (!node) {
                return;
            }

            const srcAttr = (node as any).attributes.find(attr => attr.name === 'src');
            const inlineAttr = (node as any).attributes.find(attr => attr.name === 'inline');

            let srcValue = removeQuotes( srcAttr?.value?.value );
            const isInline = toBoolean(inlineAttr?.value?.value ?? inlineAttr?.value );

            // console.log('[svg]', srcValue, isInline );

            if( !isInline ){
                if( resolveLink ){
                    let resultUrl = resolveLink( srcValue )
                    if( resultUrl !== undefined ){
                        srcAttr.value.value = ensureQuotes(resultUrl);
                    }
                }

                return;
            }

            if( srcValue !== undefined ){
                replaceNodes.push( [parent,index, srcValue] );
            }
        });


        for( const [parent,index,srcValue] of replaceNodes ){

            let data = await resolveData(srcValue, undefined, 'img');

            // console.log('[svg][resolveData]', srcValue, data );

            if( data === undefined ){
                continue;
            }

            let {ast} = toHAST(data);
            
            const replaceNode = hastToMdxHast( ast );

            (parent.children as any[])[index] = replaceNode;
        }

        return next();
    }
}

