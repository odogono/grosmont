import Path from 'path';
import Fs from 'fs-extra';
const _eval = require('eval');
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as Babel from "@babel/core";
import babelGenerate from '@babel/generator';
import traverse from "@babel/traverse";

import { parse as babelParser } from '@babel/parser';

import { Entity } from 'odgn-entity/src/entity';
import { getDependencies, getDependencyEntities, getDependencyEntityIds, insertDependency, selectJsx } from '../../query';
import { Site } from '../../site';
import { parse as parseConfig } from '../../config';
import { ProcessOptions } from '../../types';
import { parseJS } from './resolve_imports';
import { createErrorComponent, parseEntityUri } from '../../util';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { parseUri, toInteger } from '@odgn/utils';

import { process as resolveImports } from './resolve_imports';
import { buildProps, resolveImport } from '../mdx/util';
import { Component, setEntityId, } from 'odgn-entity/src/component';
import { setLocation, info, error, debug, warn } from '../../reporter';

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

    // log( ents );



    for (const e of ents) {


        let coms = await processEntity(site, e, options);
        output = output.concat(coms);

        info(reporter, ``, { eid: e.id });

        // output.push(e);
    }

    await es.add(output);

    return site;
}

async function processEntity(site: Site, e: Entity, options: ProcessOptions): Promise<Component[]> {
    const { es } = site;
    const { reporter } = options;
    const { url: base } = e.Src;
    let imports = [];

    const resolveImportLocal = (path: string, mimes?: string[]) => {
        let entry = resolveImport(site, path, base);
        // log('[resolveImportLocal]', path, entry);
        if (entry !== undefined) {
            const [eid, url, mime] = entry;
            let remove = (mime === 'text/css' || mime === 'text/scss');
            imports.push(entry);
            return [url, remove];
        } else {
            warn(reporter, `import ${path} not resolved`, {eid:e.id});
        }
    }

    try {

        // gather the import dependencies
        // let importData = await buildImportData(site, e, options);
        let data = await site.getEntityData(e);

        // let props = await buildProps(site, e);

        let js = transformJSX(data, resolveImportLocal);
        // let {Component,requires, ...meta} = evalCode(code, props.path, {site, importData});

        const jsCom = setEntityId(es.createComponent('/component/js', { data: js }), e.id);

        // log('out js', js);

        await applyImports(site, e, imports, options);

        return [jsCom];
        // output.push( jsCom );
        // await parseConfig(site, meta, undefined, {add:false, e} );

    } catch (err) {
        error(reporter, 'error', err, { eid: e.id });
        return [ createErrorComponent(es, e, err, {from:Label}) ];
    }


}

async function applyImports(site: Site, e: Entity, imports, options: ProcessOptions) {
    const { es } = site;
    const existingIds = new Set(await getDependencyEntityIds(es, e.id, 'import'));

    // log('[applyImports]', imports);

    for (let [importEid, url] of imports) {
        let urlCom = es.createComponent('/component/url', { url });
        let depId = await insertDependency(es, e.id, importEid, 'import', [urlCom]);

        if (existingIds.has(depId)) {
            existingIds.delete(depId);
        }
    }

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(existingIds));

    return e;
}


const presets = [
    ["@babel/preset-env", {
        "exclude": [
            "@babel/plugin-transform-spread"
        ],
        "targets": { "node": "current" }
    }],
    "@babel/preset-react"
];


function transformJSX(jsx: string, resolveImport: Function) {
    const plugins = [
        ["module-resolver", {
            "root": ["."],
            // alias
        }]
    ]
    
    let ast = babelParser(jsx, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    
    traverse(ast, {
        ImportDeclaration(path) {
            let resolved = resolveImport(path.node.source.value);
            if (resolved !== undefined) {
                const [url, remove] = resolved;
                path.node.source.value = url;
            }
        }
    });
    
    let generateResult = babelGenerate(ast);
    if (generateResult) {
        jsx = generateResult.code;
    }
    
    let { code, ...other } = Babel.transform(jsx, { presets, plugins });

    // log('[transformJSX]', other);
    return code;
}

