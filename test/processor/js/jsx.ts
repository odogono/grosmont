import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll, printEntity } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, addScss, beforeEach, createSite, process, rootPath } from '../helpers';
import { buildProcessors, OutputES, RawProcessorEntry, renderToOutput } from '../../../src/builder';

const test = suite('/processor/js/jsx');
const log = (...args) => console.log(`[${test.name}]`, ...args);



test.before.each(beforeEach);



test('imports scss', async ({es,site,options}) => {

    // importing css into a jsx means that it has access to
    // the styles

    await addScss(site, 'file:///styles/main.scss', `h1 { color: blue; }`);

    await addMdx(site, 'file:///pages/main.jsx', `
    import '../styles/main';

    export default ({InlineCSS}) => {
        return <div><InlineCSS />Hello World</div>
    }
    `);


    const spec:RawProcessorEntry[] = [
        [ '/processor/mark#jsx' ],
        [ '/processor/mark#scss' ],
        [ '/processor/build_src_index' ],
        [ '/processor/scss'],
        [ '/processor/jsx/eval'],
        [ '/processor/js/eval'],
        [ '/processor/js/render'],
    ];

    const process = await buildProcessors( site, spec );
    await process(site,options);
    
    let e = await site.getEntityBySrc('file:///pages/main.jsx');
    assert.equal(e.Output.data, `<div><style>h1{color:#00f}</style>Hello World</div>`);
});


test.run();