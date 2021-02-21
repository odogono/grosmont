import Fs from 'fs-extra';
import { Component, getComponentEntityId, setEntityId, toComponentId } from "odgn-entity/src/component";
import { getDefId } from "odgn-entity/src/component_def";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { FindEntityOptions, selectSrcByExt } from '../../query';

import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { info, setLocation } from '../../reporter';
import { applyMimeToEntityId } from '../../util';

const log = (...args) => console.log('[ProcMarkScss]', ...args);


export interface ProcessMarkScssOptions extends ProcessOptions {
    loadData?: boolean;
}

/**
 * /component/src which have an .scss extension are given a /component/scss
 * if they do not already have them. Optionally, the content from the src
 * is placed into /component/scss#data
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ProcessMarkScssOptions = {}) {
    const es = site.es;
    const {reporter} = options;
    const loadData = options.loadData ?? false;
    setLocation(reporter,'/processor/scss/mark');

    // select /component/src with a .scss extension
    const coms = await selectSrcByExt( site.es, ['scss'], options );

    // log('coms', coms);
    const def = es.getByUri('/component/scss');
    const did = getDefId(def);

    let addComs = [];

    for( const com of coms ){
        let eid = getComponentEntityId(com);

        let scss = await es.getComponent( toComponentId(eid,did) );

        if( scss === undefined ){
            scss = es.createComponent( did );
            scss = setEntityId( scss, eid );
            if( !loadData ) {
                addComs.push( scss );
            }
            info(reporter, `mark`, {eid});
        }

        // set the mime type
        let meta = await applyMimeToEntityId(es, eid, 'text/scss');
        addComs.push( meta );

        if( loadData ){
            const {url} = com;

            let path = site.getSrcUrl(url);

            // log('loading from', path);

            let content = await Fs.readFile(path, 'utf8');
            if( content ){
                scss.data = content;
                addComs.push( scss );
            }
        }
    }

    await es.add( addComs );

    return site;
}



