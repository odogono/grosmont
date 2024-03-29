
import traverse from "@babel/traverse";



import { Entity, Component, setEntityId, } from '../../../es';
import { selectJsx } from '../../query';
import { Site } from '../../site';

import { ProcessOptions } from '../../types';
import { createErrorComponent, isUrlInternal, resolveImport } from '../../util';

import { applyImports } from '../js/util';
import { setLocation, info, error, debug, warn } from '../../reporter';
import { generateFromAST, parseJSX, transformJSX } from "../../transpile";

const Label = '/processor/jsx/eval';
const log = (...args) => console.log(`[${Label}]`, ...args);



/**
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    let ents = await selectJsx(es, { ...options, siteRef: site.getRef() });
    let output = [];

    for (const e of ents) {


        let coms = await processEntity(site, e, options);
        output = output.concat(coms);

        info(reporter, `${e.Src?.url}`, { eid: e.id });
    }

    // info(reporter, `processed ${ents.length}` );

    await es.add(output);

    info(reporter, `processed ${ents.length}`);

    return site;
}

async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<Component[]> {
    const { es } = site;
    const { reporter } = options;
    const { url: base } = e.Src;
    let imports = [];

    function resolveImportLocal(path: string, specifiers?: string[]) {
        if (!isUrlInternal(path)) {
            return;
        }
        let entry = resolveImport(site, path, base);
        // log('[resolveImportLocal]', path, entry);
        if (entry !== undefined) {
            const [eid, url, mime, srcUrl, dstUrl] = entry;
            let remove = (mime === 'text/css' || mime === 'text/scss');
            imports.push([eid, url, mime, specifiers]);
            // imports.push(entry);
            // log('[resolveImportLocal]', url, mime, remove);
            return [url, remove];
        } else {
            warn(reporter, `import ${path} not resolved`, { eid: e.id });
        }
    }

    // gather the import dependencies
    let data = e.Jsx?.data ?? await site.getEntityData(e);


    try {

        let { js } = transform(data, resolveImportLocal);

        const jsCom = setEntityId(es.createComponent('/component/js', { data: js }), e.id);
        // const jsxCom = setEntityId(es.createComponent('/component/jsx', { data: jsx }), e.id);

        await applyImports(site, e.id, imports, options);

        return [jsCom];

    } catch (err) {
        // log('error', err.stack);
        error(reporter, 'error', err, { eid: e.id });
        log('error', data);
        return [createErrorComponent(es, e, err, { from: Label })];
    }


}


function transform(jsx: string, resolve: Function) {

    let ast = parseJSX(jsx);

    let changed = false;

    traverse(ast, {
        ImportDeclaration(path) {
            // log('[transform]', {path, parent, key, index} );
            let resolved = resolve(path.node.source.value);
            if (resolved !== undefined) {
                const [url, remove] = resolved;
                path.node.source.value = url;
                if (remove) {
                    path.remove();
                }
                changed = true;
            }
        }
    });

    if (changed) {
        jsx = generateFromAST(ast);
    }

    let js = transformJSX(jsx, true);
    // jsx = transformJSX( jsx, true );

    return { js };
}

