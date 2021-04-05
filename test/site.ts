
import { printAll } from 'odgn-entity/src/util/print';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { buildProcessors, OutputES, RawProcessorEntry } from '../src/builder';

import { parseEntity } from '../src/builder/config';
import { beforeEach } from './helpers';

const log = (...args) => console.log('[/test/site]', ...args);
const test = suite('/site');
test.before.each(beforeEach);


test('process', async ({ es, site, options }) => {

    await parseEntity( site, `
    src: file:///pages/index.mdx
    data: "# Hello World"
    `);


    const spec:RawProcessorEntry[] = [
        [ '/processor/build_src_index' ],
        [ '/processor/mark#mdx' ],
        [ '/processor/build_dir_deps', 0, {createMissingParents:true}],
        // applies parent layout tags to their children
        [ '/processor/apply_tags', 0, {type:'layout'} ],
        [ '/processor/mdx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render'],
    ];

    const bf = es.resolveComponentDefIds('/component/output');
    const pes = new OutputES( es, bf );

    const process = await buildProcessors( site, '/test', spec );

    await process(site, {es:pes});

    await printAll(es);

    log( pes.components );

});




test.run();