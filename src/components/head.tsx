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


/*{ <Head>
  <title>Open Door Go North</title>
  <meta name="description" content="Open Door Go North" />
  <meta name="author" content="SitePoint" />
  <meta charset="utf-8" />
</Head>}*/
