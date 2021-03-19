import { isDate } from "@odgn/utils";
import { EntitySet } from "odgn-entity/src/entity_set";
import { Site } from "../../../src/builder/site";




export function createFileEntity(site: Site, url: string,
    ctime?: Date | string, mtime?: Date | string) {
    
        const { es } = site;
    let e = es.createEntity();
    e.Src = { url };
    e.SiteRef = { ref: site.getRef() };
    ctime = ctime ?? new Date();
    mtime = mtime ?? ctime;

    if (isDate(ctime)) {
        ctime = (ctime as Date).toISOString();
    }
    if (isDate(mtime)) {
        mtime = (mtime as Date).toISOString();
    }

    e.Times = { ctime, mtime };
    return e;
}