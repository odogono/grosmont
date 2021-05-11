/* eslint react/jsx-key: 0 */

import React from 'react'
// import Prism from "prism-react-renderer/prism";
import Highlight, { defaultProps } from 'prism-react-renderer'
// import {LiveProvider, LiveEditor, LiveError, LivePreview} from 'react-live'
import {mdx} from '@mdx-js/react'

// declare var Prism: any;
// (typeof global !== "undefined" ? global : window).Prism = Prism;
import './prism-filth';

/**
 * 
 * https://github.com/mdx-js/mdx/blob/master/examples/syntax-highlighting/src/components/CodeBlock.js
 * https://github.com/FormidableLabs/prism-react-renderer#advanced-props
 * 
 */
export default ({ children, className, live, render }) => {
  const language = className?.replace(/language-/, '');

  // prism won't work unless '@mdx-js/react' is imported
  if( mdx === undefined ){
    throw new Error('mdx undefined');
  }

  let {theme, ...themelessProps} = defaultProps;

  return (
    <Highlight {...themelessProps} code={children.trim()} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={{ ...style, padding: '20px' }}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line, key: i })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}
