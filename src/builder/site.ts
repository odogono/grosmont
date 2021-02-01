import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Util from 'util';

import GlobCb from 'glob';
const Glob = Util.promisify( GlobCb );

import { readDirMeta } from '.';
import { defs } from './defs';

import {
    Entity, EntityId, isEntity
} from 'odgn-entity/src/entity';

import {
    EntitySetMem, EntitySet, EntitySetOptions
} from 'odgn-entity/src/entity_set';
import {
    EntitySetSQL
} from 'odgn-entity/src/entity_set_sql';

import { selectDirByUri, selectFileByUri, selectSrcByUrl } from './processor/file';
import { StatementArgs } from 'odgn-entity/src/query';
import { parse } from './config';
import { pathToFileURL, fileURLToPath } from 'url';
import { parseUri } from '../util/uri';
import { getComponentEntityId } from 'odgn-entity/src/component';
import { findEntitiesByTags } from './util';


const log = (...args) => console.log('[Site]', ...args);

interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}



export interface SiteIndex {
    query?: string;
    args?: StatementArgs;
    index: Map<any, any[]>;
}


export interface SiteOptions extends EntitySetOptions {
    name?: string;
    target?: string;
    dir?: string;
    es?: EntitySet;
    configPath?: string;
    rootPath?: string;
}


export class Site {
    es: EntitySet;
    e: Entity; // reference to the active site entity
    options: SiteOptions;
    rootPath: string;

    indexes: Map<string,SiteIndex> = new Map<string,SiteIndex>();

    static async create( options:SiteOptions = {} ){
        // read from the path
        

        let es = options.es ?? new EntitySetMem(undefined, options);

        let site = new Site({es, ...options});

        await site.init();

        return site;
    }

    constructor(options:SiteOptions = {}){
        this.options = options;
    }
    
    async init(options:SiteOptions = undefined) {
        options = options ?? this.options;
        this.es = options.es ?? new EntitySetMem(undefined, options);
        
        for (const def of defs) {
            await this.es.register(def);
        }
        
        await this.parseOptions(options);

        await this.readConfig(options);
    }

    /**
     * 
     * @param options 
     */
    async readConfig(options:SiteOptions = undefined){
        options = options ?? this.options;
        const {configPath} = options;

        if( configPath === undefined ){
            return;
        }
        
        const path = fileURLToPath(options.configPath);
        let config = await Fs.readFile(path, 'utf8');
        
        
        if( config ){
            let e = await parse( this.es, config, 'yaml', {add:true} );
            let root = options.rootPath; // fileURLToPath( Path.dirname( options.configPath ) );
            let configRoot = fileURLToPath( Path.dirname( options.configPath ) );
            
            // log('[readConfig]', options.rootPath );

            // resolve the src and dst paths
            let url = e.Src?.url ?? '/.';
            url = pathToFileURL( Path.join( configRoot, fileURLToPath(url) ) ).href;
            e.Src = {url};

            url = e.Dst?.url ?? '.';
            url = pathToFileURL( Path.join( root, fileURLToPath(url) ) ).href;
            e.Dst = {url};

            if( e.Site === undefined ){
                e.Site = {};
            }

            this.e = await this.update(e);
        }
    }

    async run( script:string ){
        const stmt = this.es.prepare(script);
        await stmt.run();
        return true;
    }

    async parseOptions( options:SiteOptions = {} ){
        const {name,target,dir, rootPath} = options;
        this.rootPath = rootPath;

        let e = this.es.createEntity();
        if( name !== undefined ){
            e.Site = { name };
        }
        if( dir !== undefined ){
            e.Src = { url:dir };
        }
        if( target !== undefined ){
            e.Dst = { url:target };
        }
        if( e.size > 0 ){
            await this.es.add( e );
            let eid = this.es.getUpdatedEntities()[0];
            this.e = await this.es.getEntity(eid,true);
        }

        
    }

    getSrcUrl( appendPath?:string ){
        let res = fileURLToPath(this.e.Src.url);
        if( appendPath ){
            res = Path.join( res, appendPath.startsWith('file://') ? fileURLToPath(appendPath) : appendPath );
        }
        return res;
        // let root = fileURLToPath( Path.dirname( this.options.configPath ) );
        
        // url = url ?? this.e.Src?.url ?? '/.';
        // // const parts = parseUri( url );
        // // log('[getDstUrl]', parts);
        // let path = Path.join( root, fileURLToPath(url) );
        // // log('[getSrcUrl]', root, fileURLToPath(url) );
        // return path;
    }

    getDstUrl(appendPath?:string){
        let res = this.e.Dst.url;
        if( appendPath ){
            res = Path.join( res, appendPath.startsWith('file://') ? fileURLToPath(appendPath) : appendPath );
        }
        return res;
    }


    /**
     * Returns the site entity
     */
    getSite():Entity {
        return this.e;
    }
    getEntity():Entity {
        return this.e;
    }

    /**
     * Returns the EntityId for the site
     */
    getSiteEntityId():EntityId {
        return this.e.id;
    }


    async addSrc( url:string ): Promise<Entity> {
        return selectSiteSrcByUrl( this, url, {createIfNotFound:true} ) as Promise<Entity>;
    }

    async getSrc( uri:string ): Promise<Entity> {
        return selectSiteSrcByUrl( this, uri) as Promise<Entity>;
    }


    async update( e:Entity ){
        if( e.SiteRef === undefined && this.e ){
            e.SiteRef = { ref: this.e.id };
        }
        await this.es.add( e );
        return this.getLastAdded();
    }

    async getLastAdded(){
        let eid = this.es.getUpdatedEntities()[0];
        return this.es.getEntity(eid);
    }

    /**
     * Adds a new index
     * 
     * the query should return an array. 
     * the first item is the key
     * the second item should an entity id
     * 
     */
    async addQueryIndex( name:string, query:string, args:StatementArgs ){
        let index:SiteIndex = { query, args, index: new Map<any,any[]>() };
        this.indexes.set( name, index );
        await this.buildIndexes( name );
        return index;
    }

    /**
     * Returns an array of Entity Ids that have dependencies on the given
     * tags
     * 
     * @param tags 
     */
    async findByTags( tags:string[] ):Promise<EntityId[]> {
        return findEntitiesByTags( this.es, tags, {siteRef:this.e.id} );
    }

    getIndex( name:string, create:boolean = false ){
        let index = this.indexes.get(name);
        if( index === undefined && create ){
            index = { index: new Map<any,any[]>() };
            this.indexes.set( name, index );
        }
        return index;
    }

    /**
     * builds all the indexes
     */
    async buildIndexes( runName?:string ){
        
        for( const [name,idx] of this.indexes ){
            const {query,args,index} = idx;

            
            if( query !== undefined ){
                
                index.clear();

                const stmt = this.es.prepare(query);
                
                let rows = await stmt.getResult(args);

                if( rows === undefined || rows.length === 0 ){
                    continue;
                }

                // the result may just be a single row, so ensure
                // we have the right format
                if( !Array.isArray(rows[0]) ){
                    rows = [rows];
                }
            
                for( const [key,eid,...rest] of rows ){
                    index.set(key, [eid, ...rest]);
                }
            }

        }
    }
}


export async function selectSite( es:EntitySet ){
    const stmt = es.prepare(`
    [ /component/site !bf @e ] select
    `);

    return await stmt.getEntity();
}


// async function selectSiteFileByUri( es:EntitySet, siteE:Entity, uri:string, options: SelectOptions = {} ){
//     const stmt = es.prepare(`[
//         /component/file#uri !ca $uri ==
//         /component/site_ref#ref !ca $ref ==
//         and
//         @e
//     ] select`);
    
//     const ents = await stmt.getEntities({uri, ref:siteE.id});

//     if( ents && ents.length > 0 ){
//         let e = ents[0];
//         return options.returnEid === true ? e.id : e;
//     }
    
//     // log('[selectSiteByUri]', 'found', ents, options );
//     if (options.createIfNotFound) {
//         let e = es.createEntity();
//         e.File = { uri };
//         let ctime = new Date().toISOString();
//         let mtime = ctime;
//         e.Times = { ctime, mtime };
//         e.SiteRef = { ref:siteE.id };

//         await es.add( e );

//         let eid = es.getUpdatedEntities()[0];
//         return es.getEntity(eid);
//     }
//     return undefined;
// }

async function selectSiteSrcByUrl(site: Site, url: string, options: SelectOptions = {}): Promise<(Entity | EntityId)> {
    const {es} = site;
    const ref = site.e.id;
    const stmt = es.prepare(`
        [
            /component/src#/url !ca $url ==
            /component/site_ref#/ref !ca $ref ==
            and
            @c
        ] select
    `);
    let com = await stmt.getResult({ url, ref });
    com = com.length === 0 ? undefined : com[0];

    // log('[selectSiteSrcByUrl]', url, com );
    if (com === undefined) {
        if (!options.createIfNotFound) {
            // log('[selectSiteSrcByUrl]', 'nope', {url,ref});
            // log( stmt );
            return undefined;
        }
        let e = es.createEntity();
        e.Src = { url };
        let ctime = new Date().toISOString();
        let mtime = ctime;
        e.Times = { ctime, mtime };
        e.SiteRef = {ref};
        return e;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }
    
    const e = es.getEntity(eid);
    return e;
}