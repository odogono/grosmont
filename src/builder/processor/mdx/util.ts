import Unified = require('unified')
import RHParse = require('rehype-parse')
import RHStringify = require('rehype-stringify')

/**
 * Converts incoming html data to an AST
 * 
 * @param content 
 * @returns 
 */
 export function toHAST(content: string) {
    let ast;

    let output = Unified()
        .use(RHParse, { emitParseErrors: false, fragment: true })
        // .use(rehype2remark)
        .use(() => tree => { ast = tree })
        .use(RHStringify)
        .processSync(content);

    let child = ast.children[0];

    return {...output, ast:child};
}

/**
 * Converts from html AST to mdx AST
 * 
 * @param node 
 * @returns 
 */
export function hastToMdxHast( node ){
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