import Mime from 'mime-types';
import Path from 'path';
import Fs from 'fs-extra';
import { Component, getComponentEntityId, setEntityId, toComponentId } from "odgn-entity/src/component";
import { getDefId } from "odgn-entity/src/component_def";
import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { FindEntityOptions, selectSrcByExt } from '../query';

import { Site } from "../site";
import { ProcessOptions } from "../types";
import { info, setLocation } from '../reporter';
import { applyMimeToEntityId } from '../util';

const log = (...args) => console.log('[ProcMark]', ...args);


export interface MarkOptions extends ProcessOptions {
    exts: string[];
    comUrl: string;
    mime?: string;
    loadData?: boolean;
}

export interface ProcessMarkJSXOptions extends ProcessOptions {
    loadData?: boolean;
}




/**
 * /component/src which have the given extensions are given the given component
 * if they do not already have them. Optionally, the content from the src
 * is placed into #data
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: MarkOptions) {
    const es = site.es;
    const { reporter, exts, comUrl } = options;
    let { mime } = options;
    const loadData = options.loadData ?? false;
    setLocation(reporter, '/processor/mark');

    // select /component/src with a .scss extension
    const coms = await selectSrcByExt(site.es, exts, { ...options, siteRef: site.getRef() });

    // log('coms', coms);
    const def = es.getByUri(comUrl);
    const did = getDefId(def);

    let addComs = [];

    for (const com of coms) {
        let eid = getComponentEntityId(com);
        const { url } = com;

        let typeCom = await es.getComponent(toComponentId(eid, did));

        if (typeCom === undefined) {
            typeCom = es.createComponent(did);
            typeCom = setEntityId(typeCom, eid);
            if (!loadData) {
                addComs.push(typeCom);
            }
            info(reporter, `mark`, { eid });
        }

        if (mime === undefined) {
            const ext = Path.extname(url);
            mime = Mime.lookup(ext);
        }

        // set the mime type
        com.mime = mime;
        addComs.push(com);

        // let meta = await applyMimeToEntityId(es, eid, mime);
        // addComs.push(meta);

        if (loadData) {
            let data = await site.getEntityData( eid );

            let dataCom = es.createComponent('/component/data');
            addComs.push( setEntityId(dataCom, eid) );
        }
    }

    await es.add(addComs);

    return site;
}


