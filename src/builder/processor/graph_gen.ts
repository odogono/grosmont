import Fs from 'fs-extra';
import Mime from 'mime-types';
import Path from 'path';
import { spawn } from 'child_process';
import Which from 'which';


import {
    Component,
    getComponentEntityId,
    setEntityId,
    toComponentId,
    getDefId,
} from "../../es";

import { Site } from "../site";
import { ProcessOptions } from "../types";
import { info, setLocation } from '../reporter';
import { BitField } from '@odgn/utils/bitfield';

import { process as generateGraph } from '../../util/graphviz';


const Label = '/processor/graph_gen';
const log = (...args) => console.log(`[${Label}]`, ...args);


export interface GraphGenOptions extends ProcessOptions {
    type: 'svg' | 'png';
    path: string;
    showDeps?: boolean;
    srcOnly?: boolean;
    dstOnly?: boolean;
    include?: BitField;
}


export async function process(site: Site, options: GraphGenOptions) {
    const { es } = site;
    const { reporter, type, path } = options;

    let dot = await generateGraph(site, { showDeps: false, ...options });

    log('writing to', path);

    // dot -Tpng es.graph.dot -o es.graph.png

    await execute( path, type, dot );

    return site;
}



async function execute(outputPath: string, type: ('svg' | 'png'), dot: string) {
    let parameters = [];
    let out = '';
    let err = '';

    parameters.push('-T' + type);


    parameters.push('-o' + outputPath);

    let outcallback = (data) => {
        out += data;
    };

    let cmdPath;

    try {
        cmdPath = Which.sync('dot', {});

    } catch (err) {
        log('error', err);
        throw err;
    }

    log('running', cmdPath );

    let graphviz = spawn(cmdPath, parameters);
    graphviz.stdout.on('data', outcallback);
    graphviz.stderr.on('data', (data) => {
        err += data;
    });

    graphviz.on('exit', (code) => {
        if (code !== 0) {
            log('exit error', code, out, err );
            // if (errback) {
            //     errback(code, out, err);
            // }
        } else {
            // if (typeof name_or_callback == 'function') name_or_callback(rendered);
            // else if (errback) errback(code, out, err)
            // log('ok good', code, out);
        }
    });
    graphviz.stdin.write(dot);
    graphviz.stdin.end();

}