import { suite } from 'uvu';
import assert from 'uvu/assert';

import { parseEntity } from '../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { beforeEach } from '../helpers';
import { Site } from '../../src/builder/site';
import { RawProcessorEntry, buildProcessors } from '../../src/builder';

const log = (...args) => console.log('[/test/deps/layout]', ...args);


const test = suite('/deps/layout');
test.before.each(beforeEach);

test('layout', async ({ es, site, options }) => {

    

    await parseEntity(site, `
    src: file:///layout/main.mdx
    isRenderable: false
    data: "<html>{children}</html>"
    `)

    await parseEntity( site, `
    src: file:///pages/
    layout: ../layout/main.mdx
    `);

    await parseEntity( site, `
    src: file:///pages/weeknotes/first.mdx
    data: "# First Week"
    `);


    const spec:RawProcessorEntry[] = [
        [ '/processor/build_src_index' ],
        [ '/processor/mark#mdx' ],
        [ '/processor/build_dir_deps', 0, {createMissingParents:true}],
        // applies parent layout tags to their children
        [ '/processor/apply_tags', 0, {type:'layout'} ],
        [ '/processor/mdx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render', 0, {applyLayout:false}],
    ];

    const process = await buildProcessors( site, spec );

    await process(site);

    // await printAll(es);
    
    let e = await site.getEntityBySrc('file:///pages/weeknotes/first.mdx');
    assert.equal( e.Output.data, '<h1>First Week</h1>' );
});


test.run();


async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    await parseEntity( site.es, `
    /component/dep:
        src: ${src}
        dst: ${dst}
        type: dir
    `);
}