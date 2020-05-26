import React from 'react';
import { PageContext } from '../context';

export function Head({children, ...props}) {

  const ctx = React.useContext(PageContext)

  // console.log('[Head]', ctx );
  // console.log('[Head]', renderPreactToString(children) );
  let childs = React.Children.toArray(children);
  // console.log('[Head]', childs );
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
