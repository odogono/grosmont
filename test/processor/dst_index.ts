import { suite } from 'uvu';
import { parseEntity } from '../../src/builder/config';
import assert from 'uvu/assert';
import { process as buildDstIndex } from '../../src/builder/processor/build_dst_index';
import { ChangeSetOp } from '../../src/es';
import { addDirDep, addSrc, beforeEach, printAll, process } from '../helpers';
import { resolveSiteUrl } from '../../src/builder/util';
import { create as createBitField } from '@odgn/utils/bitfield';
import { getDstUrl } from '../../src/builder/query';
import { buildProcessors, RawProcessorEntry } from '../../src/builder';

const test = suite('/processor/build_dst_index');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each(beforeEach);




test('build an index', async ({ site, es, options }) => {

    await parseEntity(site, `
    id: 1999
    dst: /styles/
    `);

    await parseEntity(site, `
    id: 2001
    text: css-data-here
    dst: main.css
    `);

    await addDirDep(site, 2001, 1999);

    await buildDstIndex(site, options);

    assert.equal(site.getDstIndex().getEid('/styles/main.css'), 2001 );
});


test('resolve a url', async ({ site, es, options }) => {

    await addSrc(site, 'file:///main.mdx', '# Main', { dst: '/index.html' });
    await addSrc(site, 'file:///about.mdx', '# About', { dst: '/about.html' });
    await addSrc(site, 'file:///pages/projects.mdx', '# Projects', { dst: '/pages/projects/index.html' });

    await process(site, options);

    // await printAll( es );

    assert.equal(
        resolveSiteUrl(site, '/about.html', 'file:///main.mdx'),
        ['file:///about.mdx', '/about.html', 1003, 'text/mdx', createBF(147526)]
    );

    assert.equal(
        resolveSiteUrl(site, '/index', 'file:///main.mdx'),
        ['file:///main.mdx', '/index.html', 1002, 'text/mdx', createBF(147526)]
    );
});



test('dst urls with missing extensions', async ({ site, es, options }) => {
    await addSrc(site, 'file:///main.mdx', '# Main', { dst: '/index' });
    await addSrc(site, 'file:///styles.scss', 'body{ color: red }', { dst: '/styles' });

    await process(site, options);

    // await printAll(es);

    assert.equal( await site.getEntityDstUrl(1002), '/index.html' );
    assert.equal( await site.getEntityDstUrl(1003), '/styles.css' );
})


test('files with dst from dir', async ({ site, es, options}) => {
    await parseEntity( site, `
    src: file:///dir.e.yaml
    dst: pages/
    `);

    await parseEntity( site, `
    src: file:///about.mdx
    data: "# About"
    `);

    await process(site, options);

    // await printAll( es );

    assert.equal( await getDstUrl(es, 1003), '/pages/about.html' );

    assert.equal( await site.getEntityDstUrl(1003), '/pages/about.html' );

    // log( site.getDstIndex() );
})


test('keeps track of removed files', async ({site,es,options}) => {

    await addSrc( site, 'file:///main.mdx', '', {dst: '/main.html', upd:ChangeSetOp.Remove} );

    const spec:RawProcessorEntry[] = [
        [ '/processor/build_src_index' ],
        [ '/processor/build_dst_index'],
    ];
    const process = await buildProcessors( site, '/test', spec );
    await process( site );

    // await process(site, options);

    // await printAll( es );

    // log( site.getDstIndex() );

    assert.equal( site.getDstIndex().getByEid(1002, true), 
        ['/main.html', ChangeSetOp.Remove] );

});


function createBF(value: number) {
    let bf = createBitField();
    bf.values = [value];
    return bf;
}


test.run();
