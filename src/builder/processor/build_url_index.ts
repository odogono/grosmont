import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { Component } from 'odgn-entity/src/component';
import { Site } from '../ecs';
import { selectTargetPath } from "./target_path";

const log = (...args) => console.log('[ProcUrlIndex]', ...args);


/**
 * /component/file#uri -> { eid, mime, target }
 * 
 * @param es 
 */
export async function process(site: Site, es: EntitySet = undefined) {
    es = es ?? site.es;
    const siteEntity = site.getSite();

    // let files = await selectFiles(es, siteEntity.id);

    // select entities with /component/file AND /component/text (eg. have been rendered)
    const query = `[
        /component/site_ref#ref !ca $ref ==
        [/component/file /component/text /component/meta] !bf
        and
        @e
    ] select

    [ /component/file#uri /id /component/meta#/meta/mime ] pluck

    `;

    await site.addIndex( '/index/fileUri', query, {ref:siteEntity.id} );

    // log('index', site.getIndex('/index/fileUri') );
    
}