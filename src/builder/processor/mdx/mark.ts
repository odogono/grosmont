import Fs from 'fs-extra';
import { getComponentEntityId, setEntityId, toComponentId } from "odgn-entity/src/component";
import { getDefId } from "odgn-entity/src/component_def";
import { selectMdxSrc } from '../../query';
import { info, setLocation } from '../../reporter';

import { Site } from "../../site";
import { ProcessOptions } from "../../types";

const log = (...args) => console.log('[ProcApplyTags]', ...args);


export interface ProcessMarkMdxOptions extends ProcessOptions {
    loadData?: boolean;
}

/**
 * /component/src which have an .mdx extension are given a /component/mdx
 * if they do not already have them. Optionally, the content from the src
 * is placed into /component/mdx#data
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ProcessMarkMdxOptions = {}) {
    const es = site.es;
    const {reporter} = options;
    const loadData = options.loadData ?? false;
    setLocation(reporter,'/processor/mdx/mark');
    
    // select /component/src with a .mdx extension
    const coms = await selectMdxSrc( site.es, options );

    // log('coms', coms);
    const def = es.getByUri('/component/mdx');
    const did = getDefId(def);

    let addComs = [];

    for( const com of coms ){
        let eid = getComponentEntityId(com);

        let mdx = await es.getComponent( toComponentId(eid,did) );

        if( mdx === undefined ){
            mdx = es.createComponent( did );
            mdx = setEntityId( mdx, eid );
            if( !loadData ) {
                addComs.push( mdx );
            }
            info(reporter, `mark`, {eid});
        }

        if( loadData ){
            const {url} = com;

            let path = site.getSrcUrl(url);

            // log('loading from', path);

            let content = await Fs.readFile(path, 'utf8');
            if( content ){
                mdx.data = content;
                addComs.push( mdx );
            }
        }
    }

    await es.add( addComs );

    return site;
}
