import Path from 'path';
import Mime from 'mime-types';


import { Entity } from "odgn-entity/src/entity";
import { EntitySet } from "odgn-entity/src/entity_set";
import { Site } from '../site';
import { applyMeta } from '../util';
import { ProcessOptions } from '../types';
import { selectFiles } from '../query';
import { setLocation, info } from '../reporter';

const log = (...args) => console.log('[ProcAssignMime]', ...args);


/**
 * Examines /component/src#url and assigns a mime type based on
 * the extension
 * 
 * @param es 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const { es } = site;
    const { reporter } = options;
    const siteEntity = site.getSite();
    setLocation(reporter, '/processor/assign_mime');

    const files = await selectFiles(es, options);
    let updates: Entity[] = [];

    for (const e of files) {
        const url = e.Src.url;
        const ext = Path.extname(url);

        let mime = mimeFromExtension(ext);

        if (mime === false) {
            continue;
        }

        // convert from src type to dest type
        mime = mapToTargetMime(mime);

        let eu = applyMeta(e, { mime });

        // log('lookup', url, mime, eu.Meta );

        updates.push(eu);

        info(reporter, `assign ${mime} to ${url}`, {eid:e.id});

        // const dst = await selectTargetPath( es, id );

        // log('index', id, src, `(${mime}) -> ${dst}`);
    }

    await es.add(updates);
    return es;
}






function mimeFromExtension(ext: string) {
    return Mime.lookup(ext);
}

export function extensionFromMime(mime: string) {
    return Mime.extension(mime);
}

function mapToTargetMime(mime: string) {
    switch (mime) {
        case 'text/x-scss':
            return 'text/css';
        case 'text/mdx':
            return 'text/html';
        default:
            return mime;
    }
}