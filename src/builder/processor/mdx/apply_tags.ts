import { Component, getComponentEntityId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { StrictMode } from "react";
import { slugify } from "../../../util/string";
import { insertDependency, selectMeta, selectTagBySlug } from "../../query";

import { Site } from "../../site";
import { createTag, createTimes } from "../../util";

const log = (...args) => console.log('[ProcApplyTags]', ...args);



/**
 * Takes Entities which have tags within their Meta and creates tag
 * entities and dependencies
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options = {}) {
    const es = site.es;

    const coms:Component[] = await selectMeta( site );


    for( const com of coms ){
        let tags = com['meta']?.tags;
        if( tags === undefined ){
            continue;
        }

        const eid = getComponentEntityId(com);

        // get rid of duplicates
        tags = Object.values( tags.reduce( (r,tag) => {
            r[slugify(tag)] = tag;
            return r;
        }, {}) );

        for( const tag of tags ){
            // select the tag entity
            let etag = await selectTagBySlug(site, tag);
            if( etag === undefined ){
                etag = await createTag(site, tag);
            }

            let tid = await insertDependency(site.es, eid, etag.id, 'tag');
        }
        // log('tags', tags);
    }

    return site;
}
