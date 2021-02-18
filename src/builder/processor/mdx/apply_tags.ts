import { 
    getDependencyParents, 
    getDepenendencyDst, 
    insertDependency 
} from "../../query";
import { setLocation } from "../../reporter";
import { Site } from "../../site";
import { ProcessOptions } from "../../types";


const log = (...args) => console.log('[ProcApplyTags]', ...args);



/**
 * Applies tags to an entity that belong to their parents (dir dependencies)
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ProcessOptions = {}) {
    const {es} = site;
    const { reporter } = options;
    setLocation(reporter, '/processor/mdx/apply_tags');

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
