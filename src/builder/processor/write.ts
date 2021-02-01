import { Site } from "../site";



/**
 * Entities which have a fully qualified /component/dst and 
 * some form of content are written out
 * 
 * @param es 
 */
export async function process(site: Site) {
    const es = site.es;

    return site;
}