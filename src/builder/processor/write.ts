import { Site } from "../site";
import { ChangeSetOp, getComponentEntityId } from '../../es';
import { ProcessOptions } from '../types';
import { getDstUrl, selectOutputWithDst } from '../query';
import { debug, error, info, setLocation } from "../reporter";
import { toComponentId } from "odgn-entity/src/component";


const Label = '/processor/write';
const log = (...args) => console.log(`[${Label}]`, ...args);

/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter, onlyUpdated, dryRun } = options;
    setLocation(reporter, Label);

    const idx = site.getDstIndex();
    const did = es.resolveComponentDefId('/component/output');

    for (const [path, [eid, op]] of idx) {

        // log('path', path, {op} );

        if ((op === undefined && onlyUpdated) || op === ChangeSetOp.Remove) {
            continue;
        }

        let com = await es.getComponent(toComponentId(eid, did));

        if (com === undefined) {
            continue;
        }

        let fullPath = site.getDstUrl(path);

        if (dryRun) {
            info(reporter, `[dryRun] wrote to ${path} : ${op}`, { eid });
        } else {
            await site.writeToUrl(fullPath, com.data);
            info(reporter, `wrote to ${path} : ${op}`, { eid });
        }

    }

    return site;
}
