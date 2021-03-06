import { getComponentEntityId } from "odgn-entity/src/component";
import { 
    getDependencyParents, 
    getDepenendencyDst, 
    insertDependency, 
    selectSrcByFilename
} from "../query";
import { debug, info, setLocation } from "../reporter";
import { Site } from "../site";
import { DependencyType, ProcessOptions } from "../types";

const Label = '/processor/apply_tags';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface ApplyDepsToChildrenOptions extends ProcessOptions {
    type?: DependencyType;
}

/**
 * Applies tags to an entity that belong to their parents (dir dependencies)
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ApplyDepsToChildrenOptions = {}) {
    const es = options.es ?? site.es;
    const { reporter, onlyUpdated } = options;
    setLocation(reporter, Label);
    const depType = options.type ?? 'tag';

    const eids = await site.getDependencyLeafEntityIds( 'dir', options );

    // we ignore directory meta, as they have already been processed
    let coms = await site.getDirectoryMetaComponents(options);
    let excludeEids = coms.map( c => getComponentEntityId(c) );
    
    debug(reporter, `leafs ${eids} bl ${excludeEids}`);
    log( `leafs ${eids} bl ${excludeEids}` );

    for( const eid of eids ){
        // get the parents of this e
        const peids = await getDependencyParents( es, eid, 'dir' );
        peids.push( eid );

        let tagIds = [];

        for( const peid of peids ){
            if( excludeEids.indexOf(peid) !== -1 ){
                continue;
            }
            // apply tags that we have gatherered
            for( const tagId of tagIds ){
                let depId = await insertDependency( es, peid, tagId, depType );
                if( depId !== 0 ) {
                    info(reporter, `add ${depType} ${tagId} to ${peid}`, {eid:depId});
                }
            }

            // get tags for this e
            const pTagIds = await getDepenendencyDst(es, peid, depType);
            // add them to the tag list
            tagIds = tagIds.concat( pTagIds );
            // remove any duplicates
            tagIds = [...new Set(tagIds)];
        }

    }

    return site;
}
