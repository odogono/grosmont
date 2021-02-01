import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { isString } from "../../../util/is";
import { Site } from '../../ecs';
import { ProcessOptions } from "../../types";

import { selectMdx } from "./util";



const log = (...args) => console.log('[ProcMDXResolveMeta]', ...args);


export interface ResolveMetaOptions extends ProcessOptions {
    e?: EntityId;
}


/**
 * Resolves /component/meta for an entity by using its
 * dir dependencies
 * 
 * @param es 
 */
export async function process(site: Site, options: ResolveMetaOptions = {}) {
    const es = site.es;
    const eid = options.e;



    // second pass - resolving meta with dependencies
    let ents = eid !== undefined ?
        [await es.getEntity(eid)]
        : await selectMdx(es);

    let output = [];

    for (const e of ents) {

        let metaList = await selectDependencyMeta(es, e.id);
        if( metaList.length === 0 ){
            continue;
        }
        log('dirCom', metaList);

        let meta = mergeMeta(metaList);


        e.Meta = { meta };

        output.push(e);
    }
    await es.add(output);

    return site;
}


function mergeMeta(metaList: any[]) {
    // merge the meta - ignore keys with undefined values
    return metaList.reduce((r, meta) => {
        for (const [key, val] of Object.entries(meta)) {
            if (val !== undefined) {
                if( key === 'tags' ){
                    let pre = Array.isArray(r[key]) ? r[key] : [];
                    if( isString(val) ){
                        r[key] = [ ...pre, val ];
                    } else if( Array.isArray(val) ){
                        r[key] = [ ...pre, ...val ];
                    }
                    
                } else {
                    r[key] = val;
                }
            }
        }
        return r;
    }, {});
}


/**
 * Returns an array of Meta starting at the eid and working up the dir dependencies
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
        size 0 == [ drop false @! ] swap if
        pop!
        /dst pluck
        @>
    ] selectParent define

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
        
        selectParent
        
        // if no parent, stop execution
        dup [ drop @! ] swap false == if

        true // true
    ] loop
    // prints

    `);
    await stmt.run({ eid });

    let metaList = stmt.getValue('result');

    return metaList;
}