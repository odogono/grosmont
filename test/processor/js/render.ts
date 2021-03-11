import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, beforeEach, createSite, process, rootPath } from '../helpers';
import { buildProcessors, OutputES, RawProcessorEntry, renderToOutput } from '../../../src/builder';

const test = suite('processor/js/render');
const log = (...args) => console.log(`[${test.name}]`, ...args);



test.before.each(beforeEach);



test('rendering an entity with arguments', async ({es,site,options}) => {

    await addMdx(site, 'file:///pages/main.jsx', `

    export default ({message}) => {        
        return <div>Message is {message}</div>
    }
    `);

    const spec:RawProcessorEntry[] = [
        [ '/processor/build_src_index' ],
        [ '/processor/mark#jsx' ],
        [ '/processor/jsx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render'],
    ];

    let e = await site.getEntityBySrc('file:///pages/main.jsx');

    // await printAll(es);

    const process = await buildProcessors( site, spec );

    const props = {
        message: 'Hello World'
    };

    const output = await renderToOutput( site, process, e.id, props );
    // await process(site,options);
    

    assert.equal(output.data, `<div>Message is Hello World</div>`);
});


test.run();