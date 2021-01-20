import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { Site } from '../../ecs';

import { selectMdx } from "./util";



const log = (...args) => console.log('[ProcMDXResolveMeta]', ...args);



/**
 * Resolves /component/meta for an entity by using its
 * dir dependencies
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;


    // second pass - resolving meta with dependencies
    let ents = await selectMdx(es);
    let output = [];

    for (const e of ents) {
        let meta = await selectDependencyMeta(es, e.id);

        e.Meta = { meta };

        output.push(e);
    }
    await es.add(output);

    return es;
}


/**
 * 
 * @param es 
 * @param eid 
 */
async function selectDependencyMeta(es: EntitySet, eid: EntityId) {
    const stmt = es.prepare(`

    // selects the parent dir entity, or 0 if none is found
    // ( es eid -- es eid )
    [
        swap
        [
            /component/dep !bf
            /component/dep#src !ca *^$1 ==
            /component/dep#type !ca dir ==
            and
            @c
        ] select

        // if the size of the select result is 0, then return 0
        size! 0 == [ drop false @! ] swap if
        pop!
        /dst pluck
        @>
    ] selectParentDir define

    [ // es eid -- es eid [meta]
        swap [ *^%1 @eid /component/meta !bf @c ] select 
        /meta pluck
        rot swap // rearrange exit vars
    ] selectMeta define

    [] result let

    // iterate up the dir dependency tree
    $eid
    [
        // select meta
        selectMeta

        // add to result
        $result + result !
        
        selectParentDir
        


        // if no parent, stop execution
        dup [ drop @! ] swap false == if

        true // true
    ] loop
    // prints

    `);
    await stmt.run({ eid });

    let metaList = stmt.getValue('result');

    // merge the meta - ignore keys with undefined values
    metaList = metaList.reduce((r, meta) => {
        for (const [key, val] of Object.entries(meta)) {
            if (val !== undefined) {
                r[key] = val;
            }
        }
        return r; //{...r, ...meta};
    }, {});

    // log('dirCom', metaList );
    return metaList;
}