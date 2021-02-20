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
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { StatementArgs } from 'odgn-entity/src/query';
import { getPtr, parse, parseConfigString } from './config';
import { pathToFileURL, fileURLToPath } from 'url';
import { setEntityId } from 'odgn-entity/src/component';
import {
    findEntitiesByTags,
    findLeafDependenciesByType,
    getDstUrl,
    selectEntityBySrc,
    selectSrcByEntity,
    selectSrcByUrl,
    selectTextByEntity,
    selectUpdated
} from './query';
import { DependencyType, SiteIndex } from './types';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { isString, parseUri } from '@odgn/utils';
import { printEntity } from 'odgn-entity/src/util/print';
import { createUUID } from '@odgn/utils';
import { info, Level, Reporter, setLevel, setLocation } from './reporter';
import { uriToPath } from './util';



const log = (...args) => console.log('[Site]', ...args);

interface SelectOptions {
    debug?: boolean;
    returnEid?: boolean;
    createIfNotFound?: boolean;
    ext?: string;
}



export interface SiteOptions extends EntitySetOptions {
    uuid?: string;
    name?: string;
    dst?: string;
    dir?: string;
    es?: EntitySet;
    configPath?: string;
    rootPath?: string;
    data?: any;
    reporter?: Reporter;
}



export class Site {
    es: EntitySet;
    e: Entity; // reference to the active site entity
    rootPath: string;

    indexes: Map<string, SiteIndex> = new Map<string, SiteIndex>();

    static async create(options: SiteOptions = {}) {
        // read from the path
        let site = new Site();

        let reporter = new Reporter();
        setLocation(reporter, '/site');
        setLevel(reporter, Level.INFO);

        // log('[create]', options);

        // attempt to initialise the ES from the configPath
        await initialiseES(site, {...options, reporter});

        // await readConfig(site, options);

        

        return site;
    }

    private constructor() { }



    async run(script: string) {
        const stmt = this.es.prepare(script);
        await stmt.run();
        return true;
    }

    /**
     * Marks an Entity with an update flag
     * 
     * @param eid 
     * @param op 
     */
    async markUpdate(eid: EntityId | Entity, op: ChangeSetOp): Promise<EntityId> {
        if (eid === undefined) {
            return undefined;
        }
        if (isEntity(eid)) {
            eid = (eid as Entity).id;
        }
        let com = this.es.createComponent('/component/upd', { op });
        com = setEntityId(com, eid as EntityId);
        await this.es.add(com);
        return eid as EntityId;
    }


    async getUpdatedEntityIds() {
        return await selectUpdated(this.es, {siteRef:this.getRef()});
    }

    /**
     * Returns the sites src url
     * 
     * @param appendPath 
     */
    getSrcUrl(appendPath?: string | Entity) {
        // let path = this.e.Src?.url ?? '';
        let res = uriToPath(this.e.Src?.url);
        if (appendPath) {
            let path = isString(appendPath) ? appendPath : (appendPath as Entity).Src?.url ?? '';
            res = Path.join(res, uriToPath(path) );
        }
        return res;
    }

    /**
     * Returns the sites dst url
     * 
     * @param appendPath 
     */
    getDstUrl(appendPath?: string) {
        let res = this.e.Dst.url;

        if (appendPath) {
            res = uriToPath(res);
            res = Path.join(res, uriToPath(appendPath) );
        }

        return res;
    }

    /**
     * Returns the computed dst url for an entity
     * @param e 
     * @param appendRoot 
     */
    async getEntityDstUrl(eid: EntityId | Entity, appendRoot: boolean = false) {
        return getDstUrl(this.es, isEntity(eid) ? (eid as Entity).id : eid as EntityId);
    }

    /**
     * Returns the /component/src#url of the given entity
     * 
     * @param eid 
     * @param appendRoot 
     */
    async getEntitySrcUrl(eid: EntityId | Entity, appendRoot: boolean = false) {
        return await selectSrcByEntity(this.es, eid);
        // return getDstUrl(this.es, isEntity(eid) ? (eid as Entity).id  : eid as EntityId );
    }
    /**
     * Returns the /component/text #data and #mime of the given entity
     * 
     * @param eid 
     * @param appendRoot 
     */
    async getEntityText(eid: EntityId | Entity) {
        return selectTextByEntity(this.es, eid);
        // return getDstUrl(this.es, isEntity(eid) ? (eid as Entity).id  : eid as EntityId );
    }



    /**
     * Attempts to read data from the specified path
     * 
     * @param path 
     */
    async readUrl(path: string) {
        if (!(await Fs.pathExists(path))) {
            path = this.getSrcUrl(path);
            if (!(await Fs.pathExists(path))) {
                return undefined;
            }
        }
        return await Fs.readFile(path, 'utf-8');
    }

    /**
     * 
     * @param path 
     * @param data 
     */
    async writeToUrl(path: string, data: string) {
        if (data === undefined) {
            throw new Error(`${path} data is undefined`);
        }
        path = uriToPath(path);
        // log('writing', path);
        await Fs.ensureDir(Path.dirname(path));
        await Fs.writeFile(path, data);

        return true;
    }

    /**
     * Copies the given src to the path
     * 
     * @param path 
     * @param src 
     */
    async copyToUrl(path:string, src:string){
        path = uriToPath(path);
        src = uriToPath(src);
        
        // log('writing', path);
        await Fs.ensureDir(Path.dirname(path));
        await Fs.copyFile(src, path);

        return true;
    }

    /**
     * Returns the site entity
     */
    // getSite(): Entity {
    //     return this.e;
    // }
    getEntity(): Entity {
        return this.e;
    }

    /**
     * Returns the EntityId for the site
     */
    getRef(): EntityId {
        return this.e?.id ?? 0;
    }

    // /**
    //  * Returns the EntityId for the site
    //  */
    // getSiteEntityId(): EntityId {
    //     return this.e.id;
    // }

    /**
     * Returns the sites host url
     */
    getUrl(): string {
        return this.e.Url?.url ?? 'http://localhost/';
    }

    /**
     * Convenience function for adding an entity with a /component/src
     * 
     * @param url 
     */
    async addSrc(url: string): Promise<Entity> {
        return selectEntityBySrc(this, url, { createIfNotFound: true }) as Promise<Entity>;
    }

    /**
     * Returns an EntityId by /component/src#url
     * @param url
     */
    async getEntityIdBySrc(url: string): Promise<EntityId> {
        return selectEntityBySrc(this, url, { returnEid: true, createIfNotFound: false }) as Promise<EntityId>;
    }

    /**
     * Returns an Entity by /component/src#url
     * @param url
     */
    async getEntityBySrc(url: string): Promise<Entity> {
        return selectEntityBySrc(this, url, { returnEid: false, createIfNotFound: false }) as Promise<Entity>;
    }

    /**
     * Returns an entity by its dst url
     * This relies on the /index/dstUrl index being up to date
     * 
     * @param url 
     * @param populate 
     */
    async getEntityByDst(url: string, populate: boolean = true): Promise<Entity> {
        const eid = this.getEntityIdByDst(url);
        return eid !== undefined ? this.es.getEntity(eid, populate) : undefined;
    }

    /**
     * Returns an entity id by its dst url
     * This relies on the /index/dstUrl index being up to date
     * 
     * @param url 
     */
    getEntityIdByDst(url: string): EntityId {
        const idx = this.getIndex('/index/dstUrl');
        if (idx === undefined) {
            return undefined;
        }
        const entry = idx.index.get(url);
        if (entry === undefined) {
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
    async getDependencyLeafEntityIds(type: DependencyType) {
        return findLeafDependenciesByType(this.es, type, { siteRef: this.e.id });
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



/**
 * Reads the config data from file if it exists
 * 
 * @param options 
 */
async function loadConfig(options: SiteOptions): Promise<SiteOptions> {
    let { configPath, rootPath, data } = options;
    let uuid = options.uuid ?? createUUID();

    if (configPath === undefined) {
        return {...options, uuid};
    }
    configPath = uriToPath(configPath);
    
    if (rootPath === undefined) {
        rootPath = Path.dirname(configPath);
    }
    rootPath = uriToPath(rootPath);
    rootPath = rootPath.endsWith(Path.sep) ? rootPath : rootPath + Path.sep;

    if (data === undefined) {
        data = await Fs.readFile(configPath, 'utf8');
    }


    return { ...options, configPath, rootPath, data, uuid };
}



/**
 * Initialises the EntitySet according to config from options
 * 
 * @param site 
 * @param options 
 */
async function initialiseES(site: Site, options: SiteOptions) {
    options = await loadConfig(options);
    let { data, rootPath, configPath, reporter } = options;
    // let { configPath, rootPath, data } = await loadConfig(options);

    
    
    let es: EntitySet;

    // attempt to initialise an es from the loaded config data
    if (data !== undefined) {
        let config = parseConfigString(data);
        const defsPath = getPtr(config, '/~1component~1meta/meta/defs');
        const esData = getPtr(config, '/~1component~1meta/meta/es');

        let uuid = getPtr(config, '/~1component~1uuid/uuid');
        if (uuid !== undefined) {
            options.uuid = uuid;
        }
        // log('config', config);

        if (esData !== undefined && es === undefined) {
            let esUrl = esData.url;
            let { protocol, host, path, queryKey } = parseUri(esUrl);
            // log('metaUrl', {protocol, host, path});

            if (path !== undefined) {
                path = Path.join(rootPath, path);
            }

            // log('es path', path);
            if (protocol === 'es') {
                if (host === 'sqlite') {
                    es = new EntitySetSQL({ path, ...esData, ...queryKey });
                }
            }
        }
    }


    if (options.es !== undefined) {
        es = options.es;
    }

    

    if (es === undefined) {
        es = new EntitySetMem(undefined, options);
    }

    site.es = es;

    info(reporter,`created ${site.es.getUrl()}`);

    // register defs against the entityset
    for (const def of defs) {
        await es.register(def);
    }

    // ensure the site entity
    await initialiseSiteEntity(site, options);



    // log('root:', rootPath);
    // log('config:', configPath);
    // log('[initialiseES]', es.getUrl());

    return site;
}


async function initialiseSiteEntity(site: Site, options: SiteOptions) {
    const es = options.es ?? site.es;
    const { name, dst, dir, uuid, data } = options;

    const stmt = es.prepare(`
    [ 
        /component/site !bf 
        /component/uuid#/uuid !ca $uuid ==
        @e 
    ] select
    `);

    let e = await stmt.getEntity({ uuid });

    if (e === undefined) {
        e = es.createEntity();
        e.Site = {};
        e.Uuid = { uuid };
    }

    if (data !== undefined) {
        e = await readSiteFromConfig(site, e, options);
    }

    // let e = this.es.createEntity();
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
        await es.add(e);
        let eid = es.getUpdatedEntities()[0];
        site.e = await es.getEntity(eid, true);
    }

    return e;
}



/**
 * 
 * @param site 
 * @param options 
 */
async function readSiteFromConfig(site: Site, e: Entity, options: SiteOptions = {}) {
    let { configPath, data, rootPath } = options;

    if (!data) {
        return e;
    }

    e = await parse(site.es, data, 'yaml', { add: false, e, siteRef:site.getRef() });

    // resolve the src and dst paths
    let url = e.Src?.url ?? pathToFileURL(rootPath).href;
    url = uriToPath(url);
    url = pathToFileURL(Path.join(rootPath, url)).href;
    e.Src = { url };

    // log('[readConfig]', 'src', url);

    url = e.Dst?.url ?? pathToFileURL(rootPath).href;;
    url = uriToPath(url);
    // log('[readConfig]', 'dst', Path.join(rootPath,url) );
    url = pathToFileURL(Path.join(rootPath, url)).href;
    e.Dst = { url };
    // log('[readConfig]', 'dst', url);

    // log('[readConfig]');
    // printEntity(this.es, e);
    // site.e = await this.update(e);

    return e;
}

