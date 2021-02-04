import { 
    getDependencyParents, 
    getDepenendencyDst, 
    insertDependency 
} from "../../query";
import { Site } from "../../site";


const log = (...args) => console.log('[ProcApplyTags]', ...args);



/**
 * Applies tags to an entity that belong to their parents (dir dependencies)
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options = {}) {
    const {es} = site;

    const eids = await site.getDependencyLeafEntityIds( 'dir' );

    for( const eid of eids ){
        // get the parents of this e
        const peids = await getDependencyParents( es, eid, 'dir' );
        peids.push( eid );

        let tagIds = [];

        for( const peid of peids ){
            // apply tags that we have gatherered
            for( const tagId of tagIds ){
                await insertDependency( es, peid, tagId, 'tag' );
            }

            // get tags for this e
            const pTagIds = await getDepenendencyDst(es, peid, 'tag');
            // add them to the tag list
            tagIds = tagIds.concat( pTagIds );
            // remove any duplicates
            tagIds = [...new Set(tagIds)];
        }

    }

    return site;
}

// export async function processOld(site: Site, options = {}) {
//     const es = site.es;

//     const coms:Component[] = await selectMeta( site );


//     for( const com of coms ){
//         let tags = com['meta']?.tags;
//         if( tags === undefined ){
//             continue;
//         }

//         const eid = getComponentEntityId(com);

//         // get rid of duplicates
//         tags = Object.values( tags.reduce( (r,tag) => {
//             r[slugify(tag)] = tag;
//             return r;
//         }, {}) );

//         for( const tag of tags ){
//             // select the tag entity
//             let etag = await selectTagBySlug(site, tag);
//             if( etag === undefined ){
//                 etag = await createTag(site, tag);
//             }

//             let tid = await insertDependency(site.es, eid, etag.id, 'tag');
//         }
//         // log('tags', tags);
//     }

//     return site;
// }
