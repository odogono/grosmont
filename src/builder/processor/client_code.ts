import { rollup, OutputOptions } from 'rollup';
const { babel } = require('@rollup/plugin-babel');
import Virtual from '@rollup/plugin-virtual';
const CommonJS = require('@rollup/plugin-commonjs');
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

import { Component, getComponentEntityId, setEntityId } from "odgn-entity/src/component";
import { EntitySet } from "odgn-entity/src/entity_set";
import { selectClientCode } from "../query";
import { setLocation } from "../reporter";
import { Site } from "../site";
import { ProcessOptions } from "../types";
import { transformJSX } from '../transpile';

const Label = '/processor/client_code';
const log = (...args) => console.log(`[${Label}]`, ...args);

/**
 * Generates a /component/js from /component/client_code
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const { es } = site;
    const { reporter } = options;
    setLocation(reporter, Label);

    let coms = await selectClientCode(es, options);

    let add: Component[] = [];

    const jsDid = es.resolveComponentDefId('/component/output');

    // log( 'com', coms );
    for (const com of coms) {

        const eid = getComponentEntityId(com);
        const { imports, components } = com;

        let buffer = [];
        buffer.push('import React from "react"');
        buffer.push('import ReactDOM from "react-dom";');

        buffer = buffer.concat(imports);

        let ids = [];
        for (const [id, fn] of Object.entries(components)) {
            ids.push(id);
            buffer.push(fn);
        }

        buffer.push('let comEl;');

        for (const id of ids) {
            buffer.push(`comEl = document.getElementById("client-code-${id}");`);
            buffer.push(`ReactDOM.render( <StrictMode><Component${id} /></StrictMode>, comEl);`);
        }

        let data = buffer.join('\n');

        data = await build(data);

        add.push(setEntityId(es.createComponent(jsDid, { data }), eid));

    }

    await es.add(add);

    return site;
}


async function build(data: string) {
    const inputConfig = {
        input: 'entry.jsx',
        external: ['react', 'react-dom'],
        plugins: [
            babel({ presets: ["@babel/preset-react"], babelHelpers: 'bundled' }),
            localResolve({
                'entry.jsx': data
            }),
            CommonJS(),
            nodeResolve(),
            // terser(),
        ]
    };

    const outputConfig: OutputOptions = {
        format: 'iife',
        globals: { 'react': 'React', 'react-dom': 'ReactDOM' }
    };

    // log('[build]', data);

    try {



        const bundle = await rollup(inputConfig);

        const { output } = await bundle.generate(outputConfig);

        // log('[build]', output);

        await bundle.close();

        return output[0].code;

    } catch (err) {
        log('[build]', 'error', err );
    }

    return data;
}


// // https://rollupjs.org/guide/en/#a-simple-example
// https://github.com/baleada/rollup-plugin-virtual/blob/main/src/index.js
// the rollup virtual plugin prefixes names with null, so that plugins ignore - which is
// undesirable
function localResolve(resolveMap: any) {
    return {
        name: 'localResolve', // this name will show up in warnings and errors
        resolveId(source) {
            // log('[resolveId]', source);
            if (resolveMap[source]) {
                return source;
            }
            // if (source === 'virtual-module') {
            //     return source; // this signals that rollup should not ask other plugins or check the file system to find this id
            // }
            return null; // other ids should be handled as usually
        },
        load(id) {
            if (resolveMap[id]) {
                return resolveMap[id];
                // return 'export default "This is virtual!"'; // the source code for "virtual-module"
            }
            return null; // other ids should be handled as usually
        }
    };
}