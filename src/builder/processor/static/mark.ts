import Fs from 'fs-extra';
import { Component, getComponentEntityId, setEntityId, toComponentId } from "odgn-entity/src/component";
import { getDefId } from "odgn-entity/src/component_def";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { FindEntityOptions, selectSrcByExt } from '../../query';

import { Site } from "../../site";
import { ProcessOptions } from "../../types";
import { info, setLocation } from '../../reporter';

const log = (...args) => console.log('[ProcMarkStatic]', ...args);


export interface ProcessMarkStaticOptions extends ProcessOptions {
    loadData?: boolean;
    exts?: string[];
}

/**
 * /component/src which have an certain extensions are given a /component/static
 * if they do not already have them. Optionally, the content from the /src
 * is placed into /component/static#data
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ProcessMarkStaticOptions = {}) {
    const es = site.es;
    const {reporter} = options;
    const loadData = options.loadData ?? false;
    setLocation(reporter,'/processor/static/mark');

    const exts = [
        'html', 'jpeg', 'jpg', 'png', 'svg', 'txt'
    ]

    // select /component/src with a .scss extension
    const srcs = await selectSrcByExt( site.es, exts, options );

    // log('coms', coms);
    const def = es.getByUri('/component/static');
    const did = getDefId(def);

    let addComs = [];

    for( const src of srcs ){
        let eid = getComponentEntityId(src);

        let staticCom = await es.getComponent( toComponentId(eid,did) );

        if( staticCom === undefined ){
            staticCom = es.createComponent( did );
            staticCom = setEntityId( staticCom, eid );
            if( !loadData ) {
                addComs.push( staticCom );
            }

            info(reporter, `mark`, {eid});
        }

        if( loadData ){
            const {url} = src;

            let path = site.getSrcUrl(url);

            // log('loading from', path);
            // TODO - should read binary
            let content = await Fs.readFile(path, 'utf8');
            if( content ){
                staticCom.data = content;
                addComs.push( staticCom );
            }
        }
    }

    await es.add( addComs );

    return site;
}



