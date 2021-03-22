import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Head } from '../../../components/head';

import { TranspileOptions, TranspileProps } from "../../types";
import { ServerEffectProvider } from '../../processor/jsx/server_effect';
import { mdx as mdxReact, MDXProvider } from '@mdx-js/react'
import { isUrlInternal } from '../../util';



export const PageContext = React.createContext({})


const log = (...args) => console.log('[/processor/js/transform]', ...args);

/**
 * 
 * @param component 
 * @param props 
 */
export async function transformComponent(component: any, props: TranspileProps): Promise<string> {
    let { css, cssLinks: inputCssLinks, scriptSrcs, children, url, comProps } = props;



    // these two cases are really only used for non-mdx components
    // undecided whether this is a good idea...

    comProps.InlineCSS = css !== undefined ?
        () => <style dangerouslySetInnerHTML={{ __html: css }} />
        : () => null;

    inputCssLinks = inputCssLinks !== undefined ? inputCssLinks.filter(Boolean) : [];
    comProps.CSSLinks =
        () => <>{inputCssLinks.map(c => <link key={c} rel='stylesheet' href={c} />)}</>;

    // log('[transformComponent]', 'css', css);
    // log('[transformComponent]', 'scriptSrcs', scriptSrcs);
    scriptSrcs = sortScriptSrcs(scriptSrcs);
    comProps.ScriptLinks = () => <>{scriptSrcs.map(src => <script crossOrigin="anonymous" key={src} src={src} />)}</>;

    const components = {
        Head,
        InlineCSS: comProps.InlineCSS,
        CSSLinks: comProps.CSSLinks,
        ScriptLinks: comProps.ScriptLinks,
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

    // log('[transformComponent]', 'CSSLinks', inputCssLinks);
    // log('[transformComponent]', 'props', {comProps});
    // log('[transformComponent]', 'components', {components});
    // log('[transformComponent]', 'component', {component});

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
        log('[transformComponent]', url, err.message);

        throw err;
    }
}


/**
 * Sorts script srcs so that external urls are ordered first
 * 
 * @param srcs 
 */
function sortScriptSrcs(srcs: string[]) {
    if (srcs === undefined) {
        return [];
    }
    srcs = srcs.filter(Boolean)
    srcs.sort((a, b) => {
        const isAExt = !isUrlInternal(a);
        const isBExt = !isUrlInternal(b);
        if (isAExt && isBExt) {
            return 0;
        }
        if (isAExt) {
            return -1;
        }
        if (isBExt) {
            return 1;
        }
        return 0;
    })
    return srcs;
}