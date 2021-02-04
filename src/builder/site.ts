import Fs, { linkSync } from 'fs-extra';
import Path from 'path';
import Klaw from 'klaw';
import Util from 'util';

import GlobCb from 'glob';
const Glob = Util.promisify(GlobCb);

import { defs } from './defs';

import {
    Entity, EntityId, isEntity
} from 'odgn-entity/src/entity';

import {
    EntitySetMem, EntitySet, EntitySetOptions
} from 'odgn-entity/src/entity_set';

import { StatementArgs } from 'odgn-entity/src/query';
import { parse } from './config';
import { pathToFileURL, fileURLToPath } from 'url';
import { parseUri } from '../util/uri';
import { getComponentEntityId } from 'odgn-entity/src/component';
import { findEntitiesByTags, findLeafDependenciesByType } from './query';
import { DependencyType, SiteIndex } from './types';


const log = (...args) => console.log('[Site]', ...args);

interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}



export interface SiteOptions extends EntitySetOptions {
    name?: string;
    dst?: string;
    dir?: string;
    es?: EntitySet;
    configPath?: string;
    rootPath?: string;
}


export class Site {
    es: EntitySet;
    e: Entity; // reference to the active site entity
    rootPath: string;

    indexes: Map<string, SiteIndex> = new Map<string, SiteIndex>();

    static async create(options: SiteOptions = {}) {
        // read from the path

        let es = options.es ?? new EntitySetMem(undefined, options);

        let site = new Site();

        site.es = options.es ?? new EntitySetMem(undefined, options);

        for (const def of defs) {
            await site.es.register(def);
        }

        await site.parseOptions(options);

        await site.readConfig(options);

        return site;
    }

    private constructor() { }

    /**
     * 
     * @param options 
     */
    async readConfig(options: SiteOptions = {}) {
        let { configPath, rootPath } = options;

        if (configPath === undefined) {
            return;
        }
        if (configPath.startsWith('file://')) {
            configPath = fileURLToPath(configPath);
        }

        if (rootPath === undefined) {
            rootPath = Path.dirname(configPath);
        }
        if (rootPath.startsWith('file://')) {
            rootPath = fileURLToPath(rootPath);
        }
        rootPath = rootPath.endsWith(Path.sep) ? rootPath : rootPath + Path.sep;

        // const path = fileURLToPath(options.configPath);
        let config = await Fs.readFile(configPath, 'utf8');

        this.rootPath = pathToFileURL(rootPath).href;

        if (config) {
            // log('parsing', config);
            let e = await parse(this, config, 'yaml', { add: true });

            // resolve the src and dst paths
            let url = e.Src?.url ?? pathToFileURL(rootPath).href;
            url = url.startsWith('file://') ? fileURLToPath(url) : url;
            url = pathToFileURL(Path.join(rootPath, url)).href;
            e.Src = { url };

            // log('[readConfig]', 'src', url);

            url = e.Dst?.url ?? pathToFileURL(rootPath).href;;
            url = url.startsWith('file://') ? fileURLToPath(url) : url;
            // log('[readConfig]', 'dst', Path.join(rootPath,url) );
            url = pathToFileURL(Path.join(rootPath, url)).href;
            e.Dst = { url };
            // log('[readConfig]', 'dst', url);


            if (e.Site === undefined) {
                e.Site = {};
            }

            this.e = await this.update(e);
        }
    }

    async run(script: string) {
        const stmt = this.es.prepare(script);
        await stmt.run();
        return true;
    }

    async parseOptions(options: SiteOptions = {}) {
        // await parse(this.es, options, undefined);
        const { name, dst, dir, rootPath } = options;
        this.rootPath = rootPath;

        let e = this.es.createEntity();
        if (name !== undefined) {
            e.Site = { name };
        }
        if (dir !== undefined) {
            e.Src = { url: dir };
        }
        if (dst !== undefined) {
            e.Dst = { url: dst };
        }
        if (e.size > 0) {
            await this.es.add(e);
            let eid = this.es.getUpdatedEntities()[0];
            this.e = await this.es.getEntity(eid, true);
        }


    }

    getSrcUrl(appendPath?: string) {
        let res = fileURLToPath(this.e.Src.url);
        if (appendPath) {
            res = Path.join(res, appendPath.startsWith('file://') ? fileURLToPath(appendPath) : appendPath);
        }
        return res;
    }

    getDstUrl(appendPath?: string) {
        let res = this.e.Dst.url;

        if (appendPath) {
            res = res.startsWith('file://') ? fileURLToPath(res) : res;
            res = Path.join(res, appendPath.startsWith('file://') ? fileURLToPath(appendPath) : appendPath);
        }

        return res;
    }


    /**
     * Returns the site entity
     */
    getSite(): Entity {
        return this.e;
    }
    getEntity(): Entity {
        return this.e;
    }

    /**
     * Returns the EntityId for the site
     */
    getSiteEntityId(): EntityId {
        return this.e.id;
    }


    /**
     * Convenience function for adding an entity with a /component/src
     * 
     * @param url 
     */
    async addSrc(url: string): Promise<Entity> {
        return selectSiteSrcByUrl(this, url, { createIfNotFound: true }) as Promise<Entity>;
    }

    /**
     * Returns an entity by /component/src#url
     * @param uri 
     */
    async getSrc(uri: string): Promise<Entity> {
        return selectSiteSrcByUrl(this, uri) as Promise<Entity>;
    }


    /**
     * Returns an entity by its dst url
     * This relies on the /index/dstUrl index being up to date
     * 
     * @param url 
     * @param populate 
     */
    async getEntityByDst(url:string, populate:boolean = true): Promise<Entity> {
        const eid = this.getEntityIdByDst( url );
        return eid !== undefined ? this.es.getEntity( eid, populate ) : undefined;
    }

    /**
     * Returns an entity id by its dst url
     * This relies on the /index/dstUrl index being up to date
     * 
     * @param url 
     */
    getEntityIdByDst(url:string): EntityId {
        const idx = this.getIndex('/index/dstUrl');
        if( idx === undefined ){
            return undefined;
        }
        const entry = idx.index.get(url);
        if( entry === undefined ){
            return undefined;
        }
        return entry[0];
    }

    async update(e: Entity) {
        if (e.SiteRef === undefined && this.e) {
            e.SiteRef = { ref: this.e.id };
        }
        await this.es.add(e);
        return this.getLastAdded();
    }

    async getLastAdded() {
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
    async addQueryIndex(name: string, query: string, args: StatementArgs) {
        let index: SiteIndex = { query, args, index: new Map<any, any[]>() };
        this.indexes.set(name, index);
        await this.buildIndexes(name);
        return index;
    }

    /**
     * Returns an array of Entity Ids that have dependencies on the given
     * tags. The operation is an AND, meaning that the entities have all of
     * the specified tags
     * 
     * @param tags 
     */
    async findByTags(tags: string[]): Promise<EntityId[]> {
        return findEntitiesByTags(this.es, tags, { siteRef: this.e.id });
    }

    /**
     * Returns an array of EntityId which have parents of the given
     * type, but no children.
     * 
     * @param type 
     */
    async getDependencyLeafEntityIds( type:DependencyType ){
        return findLeafDependenciesByType(this.es, type, {siteRef:this.e.id} );
    }


    /**
     * Returns an index with the given name, optionally creating one
     * if it is not found
     * 
     * @param name 
     * @param create 
     */
    getIndex(name: string, create: boolean = false): SiteIndex {
        let index = this.indexes.get(name);
        if (index === undefined && create) {
            index = { index: new Map<any, any[]>() };
            this.indexes.set(name, index);
        }
        return index;
    }

    /**
     * builds all the indexes
     */
    async buildIndexes(runName?: string) {

        for (const [name, idx] of this.indexes) {
            const { query, args, index } = idx;


            if (query !== undefined) {

                index.clear();

                const stmt = this.es.prepare(query);

                let rows = await stmt.getResult(args);

                if (rows === undefined || rows.length === 0) {
                    continue;
                }

                // the result may just be a single row, so ensure
                // we have the right format
                if (!Array.isArray(rows[0])) {
                    rows = [rows];
                }

                for (const [key, eid, ...rest] of rows) {
                    index.set(key, [eid, ...rest]);
                }
            }

        }
    }
}


export async function selectSite(es: EntitySet) {
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
    const { es } = site;
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
        e.SiteRef = { ref };
        return e;
    }

    const eid = getComponentEntityId(com);
    if (options.returnEid === true) { return eid; }

    const e = es.getEntity(eid);
    return e;
}