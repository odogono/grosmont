import Path from 'path';
import Fs from 'fs-extra';

import { Entity } from "odgn-entity/src/entity";
import { EntitySet, EntitySetMem } from "odgn-entity/src/entity_set";
import { printAll } from "../ecs";
import { fileUriToAbsolute } from './read_dir_meta';

export async function process(es: EntitySet) {
    // select entities which have a file uri extension of scss
    let entities:Entity[] = await selectFileByExt( es, 'scss' );

    // log('scss entities');
    // printAll( es, entities );

    let modified:Entity[] = [];

    for( const e of entities ){
        const filePath = await fileUriToAbsolute( es, e );
        let data = await Fs.readFile(filePath, 'utf8');

        e.Scss = { data };
        modified.push(e);
    }

    entities = await selectFileByExt(es, 'css');

    for( const e of entities ){
        const filePath = await fileUriToAbsolute( es, e );
        let data = await Fs.readFile(filePath, 'utf8');

        e.Css = { data };
        modified.push(e);
    }

    entities = await selectFileByExt(es, 'mdx');

    for( const e of entities ){
        const filePath = await fileUriToAbsolute( es, e );
        let data = await Fs.readFile(filePath, 'utf8');

        e.Mdx = { data };
        modified.push(e);
    }

    entities = await selectFileByExt(es, 'html');

    for( const e of entities ){
        const filePath = await fileUriToAbsolute( es, e );
        let data = await Fs.readFile(filePath, 'utf8');

        e.Html = { data };
        modified.push(e);
    }

    // log('added', es.entChanges );
    es = await es.add(modified, {debug:true});

    // log('added', modified );

    return es;
}


export async function selectFileByExt( es:EntitySet, ext:string ): Promise<Entity[]> {
    const query = `[
        /component/file#uri !ca ~r/\\.${ext}$/ ==
        @c
    ] select`;

    const stmt = es.prepare(query);

    return await stmt.getEntities();
}




const log = (...args) => console.log('[ReadFileScss]', ...args);