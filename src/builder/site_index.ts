import {
    EntityId,
    QueryableEntitySet,
    ChangeSetOp,
    StatementArgs
} from '../es';
import { appendExtFromMime, extensionFromPath, removeExt } from './util';
import { Reporter } from './reporter';
import { Site } from './site';

const log = (...args) => console.log(`[SiteIndex]`, ...args);

// export interface SiteIndex {
//     query?: string;
//     args?: StatementArgs;
//     index: Map<any, any[]>;
// }


type EntityIndexEntry = [string /*path*/, EntityId, string/*mime*/, ChangeSetOp];


export interface GetOptions {
    full?: boolean;
    withExtension?: boolean;
}

export class SiteIndex {
    query?: string;
    args?: StatementArgs;
    keyIndex: Map<any, any[]>;
    eidIndex: Map<EntityId, any[]>;

    constructor(query?: string, args?: StatementArgs) {
        this.query = query;
        this.args = args;
        this.keyIndex = new Map<any, any[]>();
        this.eidIndex = new Map<EntityId, any[]>();
    }
    
    get(key: string) {
        return this.keyIndex.get(key);
    }

    getByPath(path:string):any[] {
        let result = this.keyIndex.get(path);
        if( result !== undefined ){
            return result;
        }
        result = this.keyIndex.get( removeExt(path) );
        
        return result;
    }

    getEid(key:string): EntityId {
        // log('[getEid]', key, this );
        let entry = this.keyIndex.get(key);
        if (entry !== undefined) {
            return entry[0];
        }
        return undefined;
    }

    [Symbol.iterator]() {
        return this.keyIndex.entries();
    }

    keys(): IterableIterator<any>{
        return this.keyIndex.keys();
    }

    /**
     * Removes the given keys from the index
     * 
     * @param keys 
     */
    remove(keys: any[]) {
        for (const key of keys) {
            let entry = this.keyIndex.get(key);
            if (entry !== undefined) {
                this.keyIndex.delete(key);
                this.eidIndex.delete(entry[0]);
            }
            else {
                entry = this.eidIndex.get(key);
                if (entry !== undefined) {
                    this.eidIndex.delete(key);
                    this.keyIndex.delete(entry[0]);
                }
            }
        }
    }

    removeByEid(eid: EntityId) {
        let entry = this.eidIndex.get(eid);
        if (entry !== undefined) {
            this.eidIndex.delete(eid);
            this.keyIndex.delete(entry[0]);
        }
    }

    /**
     * Returns the path associated with this eid
     * or, if full details are required, an array of details
     * @param eid 
     * @param full 
     * @returns 
     */
    getByEid(eid: EntityId, options:GetOptions = {}) {
        const full = options.full ?? false;
        let withExt = options.withExtension ?? false;

        let entry = this.eidIndex.get(eid);
        if( entry === undefined ){
            return undefined;
        }
        if( full ){
            return entry;
        }

        let [ url, _eid, mime, upd] = entry;

        let result = url;
        // if( mime !== 'text/html' ){
        //     withExt = true;
        //     log('ugh', mime, url);
        // }

        if( withExt && mime ){
            result = appendExtFromMime( result, mime );
        }

        return result;
    }

    /**
     * 
     * @param key 
     * @param eid 
     * @param args 
     */
    set(key: any, eid: EntityId, ...args) {
        // log('[set]', {eid, key}, ...args);
        this.removeByEid(eid);
        this.keyIndex.set(key, [eid, ...args]);
        this.eidIndex.set(eid, [key, ...args]);
    }

    setPath(path:string, eid: EntityId, upd:ChangeSetOp, mime:string ){
        this.removeByEid(eid);

        

        this.keyIndex.set(path, [eid, upd, mime]);
        this.eidIndex.set( eid, [path, upd, mime] );
    }

    /**
     * 
     * @param eid 
     * @param key 
     * @param args 
     */
    setByEid(eid: EntityId, key: any, ...args) {
        // log('[setByEid]', {eid, key}, ...args);
        this.removeByEid(eid);
        this.eidIndex.set(eid, [key, ...args]);
        this.keyIndex.set(key, [eid, ...args]);
    }

    /**
     * 
     */
    clear() {
        this.keyIndex.clear();
        this.eidIndex.clear();
    }
}
