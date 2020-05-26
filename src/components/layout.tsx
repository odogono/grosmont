import { Fragment, h, toChildArray, VNode } from 'preact'
import { render as renderPreactToString } from 'preact-render-to-string'

export function Layout({children, src, ...props}) {
    console.log('[Layout]', src );
    let childs = toChildArray(children);
    // childs.forEach(child => {
        // console.log('[Head]', child['props'].mdxType );
        // console.log('[Head]', renderPreactToString(child as any));
        // if (child.type === 'title') {
        // }
    // });
    return null; //<Fragment></>;
}