import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Head } from '../../../components/head';

import { TranspileOptions, TranspileProps } from "../../types";
import { ServerEffectProvider } from '../../processor/jsx/server_effect';
import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'



export const PageContext = React.createContext({})


const log = (...args) => console.log('[/processor/js/transform]', ...args);

/**
 * 
 * @param component 
 * @param props 
 * @param options 
 */
 export async function transformComponent(component: any, props: TranspileProps, options: TranspileOptions): Promise<string> {
    let { css, cssLinks: inputCssLinks, children, url, comProps } = props;



    // these two cases are really only used for non-mdx components
    // undecided whether this is a good idea...

    comProps.InlineCSS = css !== undefined ?
        () => <style dangerouslySetInnerHTML={{ __html: css }} />
        : null;

    inputCssLinks = inputCssLinks !== undefined ? inputCssLinks.filter(Boolean) : [];
    comProps.CSSLinks = inputCssLinks.length > 0 ?
        () => <>{inputCssLinks.map(c => <link key={c} rel='stylesheet' href={c} />)}</>
        : null;


    const components = {
        Head,
        InlineCSS: comProps.InlineCSS,
        CSSLinks: comProps.CSSLinks,
        // Layout,
        // a: (props) => {
        //     const {href,children} = props;
        //     links[href] = {children};
        //     console.log('[transpile]', 'link', href, children );
        //     // links.push( {href, children} );
        //     return <a {...props}></a>
        // }
    }



    const ctxValue = {
        children,
        components
    };

    let child = children !== undefined ?
        React.createElement(children, { components, ...comProps })
        : undefined;

    const Component = await component;

    // log('[componentToString]', 'CSSLinks', inputCssLinks);
    // log('[componentToString]', 'CSSLinks', components);

    try {

        const output = ReactDOMServer.renderToStaticMarkup(
            <ServerEffectProvider>
                <PageContext.Provider value={ctxValue}>
                    <MDXProvider components={components}>
                        <Component {...comProps}>{child}</Component>
                    </MDXProvider>
                </PageContext.Provider>
            </ServerEffectProvider>
            , { pretty: true });

        return output;

    } catch (err) {
        log('[componentToString]', url, err.message);

        throw err;
    }
}

