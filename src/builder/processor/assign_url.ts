import Path from 'path';
import Day from 'dayjs';

import { Entity, EntityId } from "../../es";
import { Site } from '../site';
import { extensionFromMime } from "./assign_mime";
import { ProcessOptions } from '../types';
import { selectTitleAndMeta } from '../query';
import { isString, slugify } from "@odgn/utils";
import { info, setLocation } from '../reporter';


const Label = '/processor/assign_url';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface AssignDstOptions extends ProcessOptions {
    tags?: string[];
    bf?: string[];
}

/**
 * Takes entities with a title and no existing dst filename and
 * applies to the dst
 * 
 * @param es 
 */
export async function process(site: Site, options:AssignDstOptions = {}) {
    const es = options.es ?? site.es;
    const {reporter, tags:filterTags, bf:filterBf, siteRef:ref } = options;
    setLocation(reporter, Label);

    let ents:Entity[];
    let q:string;
    let eids:EntityId[];

    // retrieve entities by tag
    if( filterTags ){
        eids = await site.findByTags(filterTags);
        q = `[
            $eids
            /component/site_ref#ref !ca $ref ==
            [ /component/title /component/date  ] !bf 
            @e
        ] select`;
    } else {
        q = `[
            [ /component/title /component/date  ] !bf 
            @e
        ] select`
    }

    ents = await es.prepare(q).getEntities({eids,ref});

    let dstIndex = site.getDstIndex();

    for( let e of ents ){
        let {title} = e.Title;
        let date = Day(e.Date.date);

        const [dst,op,mime] = dstIndex.getByEid(e.id, true);

        let path = [ Path.dirname(dst) ];

        path.push( date.year() + '' );
        path.push( (date.month()+1) + '' );
        path.push( date.date() + '' );

        path.push( slugify(title) );
        
        let genDst = path.join( Path.sep );

        let ext = extensionFromMime( mime );

        genDst = `${genDst}.${ext}`;

        dstIndex.setByEid( e.id, genDst, op, mime );

        info(reporter, `update dst ${genDst}`, {eid:e.id});
    }


    return site;
}