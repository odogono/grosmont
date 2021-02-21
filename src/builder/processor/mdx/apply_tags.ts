import { getComponentEntityId } from "odgn-entity/src/component";
import { 
    getDependencyParents, 
    getDepenendencyDst, 
    insertDependency, 
    selectSrcByFilename
} from "../../query";
import { debug, info, setLocation } from "../../reporter";
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
    const es = options.es ?? site.es;
    const { reporter, onlyUpdated } = options;
    setLocation(reporter, '/processor/mdx/apply_tags');

    const eids = await site.getDependencyLeafEntityIds( 'dir', options );

    // we ignore directory meta, as they have already been processed
    let coms = await site.getDirectoryMetaComponents(options);
    let blacklistEids = coms.map( c => getComponentEntityId(c) );
    
    debug(reporter, `leafs ${eids} bl ${blacklistEids}`);

    for( const eid of eids ){
        // get the parents of this e
        const peids = await getDependencyParents( es, eid, 'dir' );
        // debug(reporter, `${eid} parents ${peids}`);
        peids.push( eid );

        let tagIds = [];

        for( const peid of peids ){
            if( blacklistEids.indexOf(peid) !== -1 ){
                continue;
            }
            // apply tags that we have gatherered
            for( const tagId of tagIds ){
                let depId = await insertDependency( es, peid, tagId, 'tag' );
                if( depId !== 0 ) {
                    info(reporter, `add tag ${tagId} to ${peid}`, {eid:depId});
                }
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
