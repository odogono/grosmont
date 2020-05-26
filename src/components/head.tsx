import React from 'react';

export function Head({children, ...props}) {
    console.log('[Head]', props );
    // console.log('[Head]', renderPreactToString(children) );
    let childs = React.Children.toArray(children);
    childs.forEach(child => {
        // console.log('[Head]', child['props'].mdxType );
        // console.log('[Head]', renderPreactToString(child as any));
        // if (child.type === 'title') {
        // }
    });
    return null; //<Fragment></>;
}