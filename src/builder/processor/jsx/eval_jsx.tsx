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
import { getDependencies, getDependencyEntities, selectJsx } from '../../query';
import { Site } from '../../site';
import { parse as parseConfig } from '../../config';
import { ProcessOptions } from '../../types';
import { parseJS } from './resolve_imports';
import { parseEntityUri } from '../../util';
import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { parseUri, toInteger } from '@odgn/utils';

import { process as resolveImports } from './resolve_imports';
import { buildProps } from '../mdx/util';
import { setEntityId,  } from 'odgn-entity/src/component';
import { setLocation, info, error, debug } from '../../reporter';

const Label = '/processor/jsx/eval';
const log = (...args) => console.log(`[${Label}]`, ...args);



/**
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options:ProcessOptions = {}){
    const es = options.es ?? site.es;
    const { reporter } = options;
    setLocation(reporter, Label);

    let ents = await selectJsx(es, {...options, siteRef:site.getRef()});
    let output = [];

    // log( ents );

    for (const e of ents) {

        try {

            // gather the import dependencies
            // let importData = await buildImportData(site, e, options);
            let data = await site.getEntityData(e);

            // let props = await buildProps(site, e);

            let js = transformJSX(data);
            // let {Component,requires, ...meta} = evalCode(code, props.path, {site, importData});

            const jsCom = setEntityId(es.createComponent('/component/js', { data: js }), e.id);

            output.push( jsCom );
            // await parseConfig(site, meta, undefined, {add:false, e} );

        } catch( err ){
            let ee = es.createComponent('/component/error', { message: err.message, from: Label });
            output.push( setEntityId(ee, e.id) );
            error(reporter, 'error', err, { eid: e.id });
            log('error', err);
        }
        
        // output.push(e);

    }

    await es.add(output);

    return site;
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


function transformJSX(jsx: string) {
    const plugins = [
        ["module-resolver", {
            "root": ["."],
            // alias
        }]
    ]
    const {code,...other} = Babel.transform(jsx, { presets, plugins });

    // log('[transformJSX]', other);
    return code;
}

