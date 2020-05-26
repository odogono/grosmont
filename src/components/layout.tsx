import React from 'react';

export function Layout({children, src, ...props}) {
    console.log('[Layout]', src );
    let childs = React.Children.toArray(children);
    // childs.forEach(child => {
        // console.log('[Head]', child['props'].mdxType );
        // console.log('[Head]', renderPreactToString(child as any));
        // if (child.type === 'title') {
        // }
    // });
    return null; //<Fragment></>;
}