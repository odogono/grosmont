import Path from 'path';
import { Entity, EntityId } from "odgn-entity/src/entity";
import { Site } from '../site';
import { extensionFromMime } from "./assign_mime";
import { ProcessOptions } from '../types';
import { selectTitleAndMeta } from '../query';
import { isString, slugify } from "@odgn/utils";
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { info, setLocation } from '../reporter';




const log = (...args) => console.log('[ProcAssignTitle]', ...args);



/**
 * Takes title from /component/meta slugifies it and places
 * it in /dst, taking care of existing target paths
 * 
 * @param es 
 */
export async function process(site: Site, options:ProcessOptions = {}) {
    const {reporter} = options;
    setLocation(reporter, '/processor/assign_title');

    // select /meta and /title
    const ents = await selectTitleAndMeta(site.es, {siteRef:site.e.id});

    let output:Entity[] = [];

    // await printAll(site.es);

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

        info(reporter, `set /component/dst#url ${url}`, {eid:e.id});
    }

    await site.es.add(output);
    
    return site;
}

