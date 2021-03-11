import Path from 'path';

import { Site, SiteOptions } from '../src/builder/site';
import { buildSrcIndex, FindEntityOptions } from '../src/builder/query';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { EntityId } from 'odgn-entity/src/entity';
import { Level } from '../src/builder/reporter';

export const rootPath = Path.resolve(__dirname, "../");


export async function createSite(options:SiteOptions = {}){
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    return await Site.create({ idgen, name: 'test', es, dst, level: Level.FATAL, ...options });
}

export async function beforeEach(tcx) {
    tcx.site = await createSite();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter:tcx.site.reporter } as FindEntityOptions;
}

