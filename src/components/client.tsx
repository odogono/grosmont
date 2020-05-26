import { Fragment, h, toChildArray, VNode } from 'preact'
import { render as renderPreactToString } from 'preact-render-to-string'

export function Client({children, ...props}) {
    console.log('[Client]', props );
    let childs = toChildArray(children);
    // childs.forEach(child => {
        // console.log('[Head]', child['props'].mdxType );
        // console.log('[Head]', renderPreactToString(child as any));
        // if (child.type === 'title') {
        // }
    // });
    return null; //<Fragment></>;
}