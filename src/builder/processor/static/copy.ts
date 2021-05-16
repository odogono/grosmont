import { Site } from "../../site";
import { getComponentEntityId } from '../../../es';
import { ProcessOptions } from '../../types';
import { getDstUrl, selectStaticWithDst } from '../../query';
import { debug, error, info, setLocation } from "../../reporter";


const Label = '/processor/static/copy';
const log = (...args) => console.log(`[${Label}]`, ...args);


/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    const dryRun = options.dryRun ?? false;
    setLocation(reporter, Label);

    const srcComs = await selectStaticWithDst(es, options);
    const dstIndex = site.getDstIndex();

    // log('src', srcComs);

    for (const src of srcComs) {
        const eid = getComponentEntityId(src);
        try {
            
            // const dst = await getDstUrl(es, eid);
            const dst = dstIndex.getByEid(eid, {withExtension:true});
            // log('no dst found', eid, dst);

            // log( 'no dst found' );
            if (dst === undefined) {
                debug(reporter, 'no dst found', { eid });
                continue;
            }

            let srcUrl = site.getSrcUrl(src.url);
            let dstUrl = site.getDstUrl(dst);

            // log('copying from', srcUrl, 'to', dstUrl );

            if (!dryRun) {
                await site.copyToUrl(srcUrl, dstUrl);
                info(reporter, `copied from ${src.url} to ${dst}`, { eid });
            } else {
                info(reporter, `[dryRun] copied from ${src.url} to ${dst}`, { eid });
            }


        } catch (err) {
            error(reporter, err.message, err, { eid });
            // log( err );
        }
    }

    return site;
}
