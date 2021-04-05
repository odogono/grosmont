import Path from 'path';
import { isDate } from "@odgn/utils";
import { Site, SiteOptions } from '../src/builder/site';
import { buildSrcIndex, FindEntityOptions } from '../src/builder/query';
import { Level } from '../src/builder/reporter';

import { build } from '../src/builder';
import { parseEntity } from '../src/builder/config';
import { Entity, EntityId, EntitySetSQL, printAll } from '../src/es';
import { DependencyType, ProcessOptions } from '../src/builder/types';
export { Entity, EntityId, EntitySetSQL, printAll } from '../src/es';

// export { build as process };


export const rootPath = Path.resolve(__dirname, "../");


export function process(site:Site, options:ProcessOptions = {} ){
    return build(site, '/test', { onlyUpdated:false, ...options, dryRun:true} );
}

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



export async function addSrc(site: Site, url: string, data: string, additional:any = {}): Promise<Entity> {
    let e = await site.getEntityBySrc(url);
    let add = e === undefined;

    e = await parseEntity( site, {
        src: url,
        data,
        ...additional}, { add, e } );

    if( !add ){
        return await site.update(e);
    }
    return e;
}

export async function addFile(site:Site, url:string, additional:any = {}): Promise<Entity> {
    let e = await site.getEntityBySrc(url);
    let add = e === undefined;

    e = await parseEntity( site, {
        src: url,
        ...additional}, { add, e } );

    if( !add ){
        return await site.update(e);
    }
    return e;
}

export async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    return addDep( site, src, dst, 'dir');
}

export async function addDep( site:Site, src:EntityId, dst:EntityId, type:DependencyType = 'import' ){
    return parseEntity( site, `
        /component/dep: { "src": ${src}, "dst": ${dst}, "type": "${type}" }`);
}



export function createFileEntity(site: Site, url: string,
    btime?: Date | string, mtime?: Date | string): Entity {
    
        const { es } = site;
    let e = es.createEntity();
    e.Src = { url };
    e.SiteRef = { ref: site.getRef() };
    btime = btime ?? new Date();
    mtime = mtime ?? btime;

    if (isDate(btime)) {
        btime = (btime as Date).toISOString();
    }
    if (isDate(mtime)) {
        mtime = (mtime as Date).toISOString();
    }

    e.Ftimes = { btime, mtime };
    return e;
}