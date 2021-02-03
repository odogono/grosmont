import Path from 'path';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { printEntity } from "odgn-entity/src/util/print";
import { isString } from "../../util/is";
import { slugify } from "../../util/string";
import { Site } from '../site';
import { extensionFromMime } from "./assign_mime";
import { getDstUrl } from "./dst_url";




const log = (...args) => console.log('[ProcAssignTitle]', ...args);



/**
 * Takes title from /component/meta slugifies it and places
 * it in the target, taking care of existing target paths
 * 
 * @param es 
 */
export async function process(site: Site) {
    
    // select /meta and /title
    const ents = await select(site.es);

    // log('input', ents);
    let output:Entity[] = [];

    for( let e of ents ){
        // printEntity( site.es, e );

        let {title} = e.Title;
        let meta = e.Meta?.meta ?? {};
        let dst = e.Dst?.url;

        // log('existing title', dst);
        if( isString(dst) && dst.length > 0 && !dst.endsWith(Path.sep) ){
            continue;
        }

        let url = slugify(title);
        if( dst ){
            url = `${dst}${url}`;
        }
        
        if( meta.mime ){
            let ext = extensionFromMime( meta.mime );
            url = `${url}.${ext}`;
        }


        e.Dst = { url };
        
        output.push(e.Dst);
    }

    await site.es.add(output);
    
    return site;
}


export async function select(es: EntitySet): Promise<Entity[]> {

    // select components which have /title AND /meta but also optionally
    // /dst
    const query = `
        [ [ /component/title /component/meta ] !bf @c] select
        /@e pluck
        rot [ *^$1 /component/dst !bf @c ] select rot +    
    `;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}