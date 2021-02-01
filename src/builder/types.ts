import { SiteIndex } from "./ecs";




export interface TranspileProps {
    data?: string;
    path: string;
    render?: boolean;
    forceRender?: boolean;
    wrapper?: JSX.Element;
    meta?: PageMeta;
    children?: any;
    links?: PageLinks;
    css?: string;
    cssLinks?: string[];
    applyLinks?: PageLinks;
}

export interface TranspileResult {
    path: string;
    html?: string;
    component?: any;
    meta: PageMeta;
    additional: object;
    code?: string;
    ast?: any;
    jsx?: string;
    links?: PageLinks;
    requires?: string[];
    css?: string;
    cssLinks?: string[];
}




export interface ProcessOptions {
    onlyUpdated?: boolean;
    fileIndex?: SiteIndex;
    linkIndex?: SiteIndex;
    pageLinks?: PageLinks;
}



export interface TranspileMeta {
    title?: string;

    description?: string;

    // created at date - otherwise sourced from file
    // date?: string;

    // path to render to
    // dstPath?: string;

    // layout file into which this page will be rendered
    layout?: string;

    // whether the page is enabled - it will be ignored if not
    // isEnabled?: boolean;

    /**
     * Things that can be rendered - html,mdx,css
     */
    // isRenderable?: boolean;

    // parent wont be folded into this
    resolveParent?: boolean;

    css?: string;
    // _inlineCSS?: string[];
    // cssLinks: string[];
}


export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
    resolveImport: (path:string) => string | undefined;
}


export interface PageLink {
    url?: string;
    child?: any;
}

export type PageLinks = Map<string, PageLink>;

export interface PageMeta {
    title?: string;

    description?: string;

    // created at date - otherwise sourced from file
    // date?: string;

    // path to render to
    // dstPath?: string;

    // layout file into which this page will be rendered
    layout?: string;

    // whether the page is enabled - it will be ignored if not
    isEnabled?: boolean;

    /**
     * Things that can be rendered - html,mdx,css
     */
    isRenderable?: boolean;

    // parent wont be folded into this
    resolveParent?: boolean;

    css?: string;
    // _inlineCSS?: string[];
    // cssLinks: string[];
}