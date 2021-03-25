import Path from 'path';
import { Entity, EntityId } from "../../es";
import { Site } from '../site';
import { extensionFromMime } from "./assign_mime";
import { ProcessOptions } from '../types';
import { selectTitleAndMeta } from '../query';
import { isString, slugify } from "@odgn/utils";
import { info, setLocation } from '../reporter';



const Label = '/processor/assign_title';
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

    // select /meta and /title
    let ents:Entity[];// = await selectTitleAndMeta(site.es, options);

    let output:Entity[] = [];

    if( filterTags ){
        const eids = await site.findByTags(filterTags);
        const q = `[
            $eids
            [ ${filterBf.join(' ')} ] !bf
            @e
        ] select`;
        ents = await es.prepare(q).getEntities({eids,ref})
    } else {
        ents = await selectTitleAndMeta(site.es, options);
    }

    // await printAll(site.es);

    for( let e of ents ){
        // printEntity( site.es, e );

        let {title} = e.Title;
        // let meta = e.Meta?.meta ?? {};
        let dst = e.Dst?.url;
        let outputMime = e.Output?.mime;

        if( isString(dst) && dst.length > 0 && !dst.endsWith(Path.sep) ){
            continue;
        }

        let url = slugify(title);
        if( dst ){
            url = `${dst}${url}`;
        }

        let ext = Path.extname(url);

        
        // log( url, {title, dst, outputMime} );
        if( outputMime ){
            ext = extensionFromMime( outputMime );
        }

        if( ext !== undefined && ext !== '' ){
            url = `${url}.${ext}`;
        }

        e.Dst = { url };
        
        output.push(e.Dst);

        info(reporter, `set /component/dst#url ${url}`, {eid:e.id});
    }

    await site.es.add(output);
    
    return site;
}

