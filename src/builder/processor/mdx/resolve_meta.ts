


import { Entity, EntityId } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { PageLink, PageLinks, ProcessOptions, TranspileMeta, TranspileProps, TranspileResult } from './types';
import { Site, SiteIndex } from '../../ecs';

import { transpile } from './transpile';
import { html } from "js-beautify";
import { buildQueryString, buildUrl, parseUri } from "../../../util/uri";
import {
    applyMeta,
    getDependencies,
    getDependencyEntities,
    findEntityByFileUri,
    findEntityByUrl,
    insertDependency,
    removeDependency,
    selectDependencyMeta,
} from "../../util";
import { toInteger } from "odgn-entity/src/util/to";
import { selectTargetPath } from "../target_path";
import { toComponentId } from "odgn-entity/src/component";
import { buildFileIndex, buildProps, getEntityImportUrlFromPath, selectMdx } from "./util";



const log = (...args) => console.log('[ProcMDXResolveMeta]', ...args);



/**
 * Compiles .mdx
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