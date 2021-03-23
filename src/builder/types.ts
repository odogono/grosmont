import { 
    EntityId, 
    QueryableEntitySet, 
    ChangeSetOp, 
    StatementArgs 
} from '../es';
import { Reporter } from './reporter';
import { Site } from './site';




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

// export interface SiteIndex {
//     query?: string;
//     args?: StatementArgs;
//     index: Map<any, any[]>;
// }

// type SiteIndexEntry = [EntityId, ...any];

export class SiteIndex {
    query?: string;
    args?: StatementArgs;
    index: Map<any, any[]>;
    eIndex: Map<EntityId, any[]>;
    constructor(query?: string, args?:StatementArgs ){
        this.query = query;
        this.args = args;
        this.index = new Map<any, any[]>();
        this.eIndex = new Map<EntityId, any[]>();
    }
    get( key:string ){
        return this.index.get(key);
    }
    getEid( key ):EntityId {
        let entry = this.index.get(key);
        if( entry !== undefined ){
            return entry[0];
        }
        return undefined;
    }
    getByEid( eid:EntityId, full:boolean = false ) {
        let entry = this.eIndex.get(eid);
        return entry !== undefined ? 
            full ? entry : entry[0]
            : undefined;
    }
    set( key:any, eid:EntityId, ...args){
        this.index.set( key, [eid,...args]);
        this.eIndex.set( eid, [key,...args]);
    }

    setByEid( eid:EntityId, key:any, ...args ){
        this.eIndex.set(eid, [key, ...args] );
        this.index.set(key, [eid,...args]);
    }
    
    clear(){
        this.index.clear();
        this.eIndex.clear();
    }
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

export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
    resolveImport?: (path: string, specifiers:string[]) => [string,boolean] | undefined;
    resolveLink?: (url:string, text?:string) => any;
    // given a srcUrl, returns the data that belongs to the matching entity
    resolveData?: (srcUrl: string, text?:string, type?:DependencyType) => Promise<any>;
    registerClientCode?: ( details:ClientCodeDetails ) => Promise<any>;
    onConfig: (config:any) => void;
    require: (path:string, fullPath:string) => any;
    context?: any;
    scope?: EvalScope; // vars which will present in the evaluated code
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


export type DependencyType = 'dir' | 'layout' | 'css' | 'tag' | 'link' | 'img' | 'import' | 'script';



// eid, url, mime, specifiers
export type ImportDescr = [ EntityId, string, string, string[] ];


// eid, e url, mime, src url, dst url
export type EntitySrcDstDescr = [ EntityId, string, string, string, string ];