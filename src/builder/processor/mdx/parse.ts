import Path from 'path';
import { 
    ChangeSetOp,
    Entity, EntityId,
    Component, setEntityId,
    QueryableEntitySet
} from '../../../es';
import { getDependencyEntityIds, getUrlComponent, insertDependency, selectEntitiesByMime } from '../../query';
import { setLocation, info, debug, error, warn } from '../../reporter';
import { Site } from '../../site';


import { ClientCodeDetails, DependencyType, ProcessOptions, SiteIndex, TranspileOptions, TranspileProps, TranspileResult } from '../../types';
import { transformJSX } from '../../transpile';
import { applyImports, buildProps } from '../js/util';
import { parseEntity } from '../../config';
import { createErrorComponent, isUrlInternal, resolveImport, resolveUrlPath } from '../../util';
import { parseFrontmatter, transformMdx } from './transform';

const Label = '/processor/mdx/parse';
const log = (...args) => console.log(`[${Label}]`, ...args);



/**
 * Parses the frontmatter of MDX
 */
 export async function process(site: Site, options: ProcessOptions = {}) {
    const es = site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    // select mdx entities
    let ents = await selectEntitiesByMime(es, ['text/mdx'], options);

    let output: Component[] = [];

    for (const e of ents) {
        const srcUrl = e.Src?.url;

        try {
            await processEntity(site, e, options);
            
            info(reporter, `${e.Src?.url}`, { eid: e.id });

        } catch (err) {
            output.push( createErrorComponent(es, e, err, {from:Label}) );
            error(reporter, `error ${srcUrl}`, err, { eid: e.id });
        }

    }

    await es.add(output);


    return site;
}


async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<Entity> {
    const { es } = site;
    const siteRef = site.getRef();

    let props = await buildProps(site, e);
    const { data } = props;

    if (data === undefined) {
        return e;
    }

    let meta = e.Meta?.meta ?? {};
    let config = {};

    function onConfig( incoming: any ){
        config = {...config, ...incoming };
    }

    await parseFrontmatter(data, {onConfig} );

    meta = {...meta, ...config};

    // log('parsed', meta);

    return await parseEntity(es, meta, { add: true, e, siteRef });
}