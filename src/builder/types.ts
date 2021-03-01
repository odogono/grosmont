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
    links?: PageLinks;
    css?: string;
    cssLinks?: string[];
    applyLinks?: PageLinks;
    imgs?: PageImgs;
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
    imgs?: PageImgs;
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
    constructor(query?: string, args?:StatementArgs ){
        this.query = query;
        this.args = args;
        this.index = new Map<any, any[]>();
    }
    getEid( key ):EntityId {
        let entry = this.index.get(key);
        if( entry !== undefined ){
            return entry[0];
        }
        return undefined;
    }
    set( key, eid:EntityId, ...args){
        this.index.set( key, [eid,...args]);
    }
    clear(){
        this.index.clear();
    }
}


export interface ProcessOptions {
    siteRef?: EntityId;
    es?: EntitySet;
    dryRun?: boolean;
    onlyUpdated?: boolean;
    fileIndex?: SiteIndex;
    imgIndex?: SiteIndex;
    linkIndex?: SiteIndex;
    pageLinks?: PageLinks;
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
    resolveImport: (path: string) => string | undefined;
    require: (path:string, fullPath:string) => any;
    context?: any;
}


export interface PageLink {
    url?: string;
    child?: any;
}

export type PageLinks = Map<string, PageLink>;


export interface PageImg {
    url?: string;
    alt?: string;
    attrs?: Map<string, any>;
}

export type PageImgs = Map<string, PageImg>;


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