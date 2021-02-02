import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { slugify } from "../../util/string";
import { Site } from '../site';
import { extensionFromMime } from "./assign_mime";
import { getDstUrl } from "./dst_url";




const log = (...args) => console.log('[ProcSlugifyTitle]', ...args);



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
        let target = e.Dst?.url ?? '';// await getDstUrl(site.es,e.eid);// e.Dst?.url ?? '';

        let url = slugify(title);
        if( target ){
            url = `${target}${url}`;
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
        [ [ /component/title /component/meta /component/dst ] !bf @c] select
        /@e pluck!
        rot [ *^$1 /component/dst !bf @c ] select rot +    
    `;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}