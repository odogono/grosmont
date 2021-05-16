import Path from 'path';
import Day from 'dayjs';

import { Entity, EntityId, printAll } from "../../es";
import { Site } from '../site';
import { ProcessOptions } from '../types';
import { slugify } from "@odgn/utils";
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
    let {reporter, tags:filterTags, bf:filterBf, siteRef:ref, onlyUpdated } = options;
    setLocation(reporter, Label);

    let ents:Entity[];
    let q:string;
    let eids:EntityId[];

    onlyUpdated = false;

    let qb = [ `[` ];
    if( filterTags ){
        eids = await site.findByTags(filterTags);
        qb.push('$eids');
    }
    if( onlyUpdated ){
        qb.push(`/component/upd#/op !ca 1 ==`);
        qb.push(`/component/upd#/op !ca 2 ==`);
        qb.push(`or`);
    }
    qb.push('[ /component/title /component/date  ] !bf ');
    qb.push('@e');
    qb.push('] select');

    q = qb.join('\n');

    ents = await es.prepare(q).getEntities({eids});

    let dstIndex = site.getDstIndex();

    for( let e of ents ){
        let {title} = e.Title;
        let date = Day(e.Date.date);

        const [dst,op,mime] = dstIndex.getByEid(e.id, {full:true});

        let path = [ Path.dirname(dst) ];

        path.push( date.year() + '' );
        path.push( (date.month()+1) + '' );
        path.push( date.date() + '' );

        path.push( slugify(title) );
        
        let genDst = path.join( Path.sep );

        // let ext = extensionFromMime( mime );
        
        // genDst = `${genDst}.${ext}`;

        // log('setting', genDst);
        
        dstIndex.setByEid( e.id, genDst, op, mime );
        
        // log( 'ents', title, {dst,op,mime}, genDst );
        
        info(reporter, `update dst ${genDst}`, {eid:e.id});
    }


    return site;
}