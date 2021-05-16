import { 
    EntityId, 
    QueryableEntitySet, 
    ChangeSetOp, 
    StatementArgs 
} from '../es';
import { Reporter } from './reporter';
import { Site } from './site';
import { SiteIndex } from './site_index';




export interface TranspileProps {
    data?: string;
    path: string;
    url: string;
    render?: boolean;
    forceRender?: boolean;
    wrapper?: JSX.Element;
    meta?: PageMeta;
    children?: any;
    css?: string;
    cssLinks?: string[];
    comProps?: any;
    scriptSrcs?: string[];
}

export interface TranspileResult {
    path?: string;
    html?: string;
    component?: any;
    meta?: PageMeta;
    additional?: object;
    code?: string;
    js?: string;
    ast?: any;
    jsx?: string;
    requires?: string[];
    css?: string;
    cssLinks?: string[];
    pageProps?: any;
}

export interface EvalScope {
    [key: string]: any;
}

export interface EvalContext {
    [key: string]: any;
}

export type SiteProcessor = (site:Site, options?: ProcessOptions) => Promise<Site>;


export interface ProcessOptions {
    siteRef?: EntityId;
    es?: QueryableEntitySet;
    dryRun?: boolean;
    onlyUpdated?: boolean;
    srcIndex?: SiteIndex;
    reporter?: Reporter;
    eids?: EntityId[];
    props?: any;
    beautify?: boolean;
}

export type EntityUpdate = [EntityId, ChangeSetOp];



export interface TranspileMeta {
    title?: string;

    summary?: string;

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


export interface ClientCodeDetails {
    imports: string[];
    components: ({ [key:string]: string} )
}

export interface ResolveLinkResult {
    url: string;
    attrs?: {[key: string]:any }
}

export type ResolveLinkType = (url:string, text?:string) => ResolveLinkResult | undefined;

export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
    resolveImport?: (path: string, specifiers:string[]) => [string,boolean] | undefined;
    resolveLink?: ResolveLinkType;
    // given a srcUrl, returns the data that belongs to the matching entity
    resolveData?: (srcUrl: string, text?:string, type?:DependencyType) => Promise<any>;
    registerClientCode?: ( details:ClientCodeDetails ) => Promise<any>;
    onConfig?: (config:any, override:boolean) => void;
    require: (path:string, fullPath:string) => any;
    context?: any;
    scope?: EvalScope; // vars which will present in the evaluated code
}

export interface MDXParseFrontmatterOptions {
    onConfig?: (config:any) => void;
}

export interface MDXPluginOptions extends TranspileOptions {}


export interface PageLink {
    url?: string;
    child?: any;
}

export type PageLinks = Map<string, PageLink>;



export interface PageMeta {
    title?: string;

    summary?: string;

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



/**
 * dir - a parent and child relationship
 * layout - src uses dst as a react container
 * css - src imports the css output from dst
 * tag - src is tagged using dst
 * link - src links (eg href) to a url
 * img - src references an img (similar to link)
 * import - src imports code from dst
 * script - src references code from dst (similar to import)
 * gen - src was generated from dst
 */
export type DependencyType = 'dir' | 'layout' | 'css' | 'tag' | 'link' | 'img' | 'import' | 'script' | 'gen';



// eid, url, mime, specifiers
export type ImportDescr = [ EntityId, string, string, string[] ];


// eid, e url, mime, src url, dst url
export type EntitySrcDstDescr = [ EntityId, string, string, string, string ];