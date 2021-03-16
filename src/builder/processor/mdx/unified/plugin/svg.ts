import { toBoolean } from '@odgn/utils';
import unistVisit from 'unist-util-visit';
import { ensureQuotes, removeQuotes } from '../../../../util';
import Unified = require('unified')
import RHParse = require('rehype-parse')
import RHStringify = require('rehype-stringify')
import { DependencyType } from '../../../../types';

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

            let hast = toHAST(data);
            let child = hast.ast.children[0];
            const replaceNode = hastToMdxHast( child );

            (parent.children as any[])[index] = replaceNode;
        }

        return next();
    }
}


/**
 * Converts incoming html data to an AST
 * 
 * @param content 
 * @returns 
 */
function toHAST(content: string) {
    let ast;

    let output = Unified()
        .use(RHParse, { emitParseErrors: false, fragment: true })
        // .use(rehype2remark)
        .use(() => tree => { ast = tree })
        .use(RHStringify)
        .processSync(content);

    return {...output, ast};
}

/**
 * Converts from html AST to mdx AST
 * 
 * @param node 
 * @returns 
 */
function hastToMdxHast( node ){
    if (node.type === 'element') {
        return convertElement( node );
    }
}

function convertElement( node ){
    const props = node.properties ?? {};
    let attributes = [];
    for( const key in props ){
        attributes.push( propertyToAttribute(key, props[key] ) );
    }
    let children = [];
    for( const child of node.children ){
        children.push( hastToMdxHast(child) );
    }
    return {
        type: 'mdxBlockElement',
        name: node.tagName,
        attributes,
        children
    }
}

function propertyToAttribute( name:string, value:any ){
    return {
        type: 'mdxAttribute',
        name,
        value
    }
}