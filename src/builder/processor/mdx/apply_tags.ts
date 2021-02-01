import { Component, getComponentEntityId } from "odgn-entity/src/component";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { StrictMode } from "react";
import { slugify } from "../../../util/string";

import { Site } from "../../site";
import { createTimes, insertDependency, selectDependency } from "../../util";

const log = (...args) => console.log('[ProcApplyTags]', ...args);


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


async function createTag(site:Site, name:string){
    let e = site.es.createEntity();
    e.Tag = { slug: slugify(name) };
    e.Title = { title:name };
    e.SiteRef = { ref: site.e.id };
    e.Times = createTimes();

    return await site.update(e);
}

async function selectTagBySlug( site:Site, name:string ){
    const slug = slugify(name);
    const {es,e} = site;

    const stmt = es.prepare(`
    [
        /component/tag#slug !ca $slug ==
        /component/site_ref#ref !ca $ref ==
        and
        @e
    ] select
    `);

    return await stmt.getEntity({ref:e.id, slug});
}

async function selectMeta( site:Site ){
    const {es} = site;


    const stmt = es.prepare(`
    [
        /component/site_ref#ref !ca $ref ==
        /component/meta !bf
        // [/component/meta /component/upd] !bf
        // and
        @c
    ] select
    `);

    return await stmt.getResult({ref:site.e.id});
}