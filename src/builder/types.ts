import { EntityId } from 'odgn-entity/src/entity';
import { EntitySet } from 'odgn-entity/src/entity_set';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { StatementArgs } from 'odgn-entity/src/query';
import { Reporter } from './reporter';




export interface TranspileProps {
    data?: string;
    path: string;
    render?: boolean;
    forceRender?: boolean;
    wrapper?: JSX.Element;
    meta?: PageMeta;
    children?: any;
    css?: string;
    cssLinks?: string[];
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



// export interface SiteIndex {
//     query?: string;
//     args?: StatementArgs;
//     index: Map<any, any[]>;
// }

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
    set( key, eid:EntityId, ...args){
        this.index.set( key, [eid,...args]);
        this.eIndex.set( eid, [key,...args]);
    }
    clear(){
        this.index.clear();
        this.eIndex.clear();
    }
}


export interface ProcessOptions {
    siteRef?: EntityId;
    es?: EntitySet;
    dryRun?: boolean;
    onlyUpdated?: boolean;
    fileIndex?: SiteIndex;
    srcIndex?: SiteIndex;
    imgIndex?: SiteIndex;
    linkIndex?: SiteIndex;
    reporter?: Reporter;
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


export interface TranspileOptions {
    render?: boolean;
    forceRender?: boolean;
    resolveImport?: (path: string) => [string,boolean] | undefined;
    resolveLink?: (url:string, text?:string) => any;
    require: (path:string, fullPath:string) => any;
    context?: any;
}


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


export type DependencyType = 'dir' | 'layout' | 'css' | 'tag' | 'link' | 'img' | 'import';