import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addSrc, beforeEach, process } from '../../helpers';
import { buildProcessors, OutputES, RawProcessorEntry, renderToOutput } from '../../../src/builder';

const test = suite('/processor/js/jsx');
const log = (...args) => console.log(`[${test.name}]`, ...args);



test.before.each(beforeEach);



test('imports scss', async ({es,site,options}) => {

    // importing css into a jsx means that it has access to
    // the styles

    await addSrc(site, 'file:///styles/main.scss', `h1 { color: blue; }`);

    await addSrc(site, 'file:///pages/main.jsx', `
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

    const process = await buildProcessors( site, '/test', spec );
    await process(site,options);
    
    let e = await site.getEntityBySrc('file:///pages/main.jsx');
    assert.equal(e.Output.data, `<div><style>h1{color:#00f}</style>Hello World</div>`);
});


test('pass ref', async ({es,site,options}) => {

    await addSrc(site, 'file:///title.jsx', `

    export default ({e}) => (
        <h1>{e?.Title?.title}</h1>
    )
    `);

    await addSrc(site, 'file:///main.mdx', `
---
title: Hello World
---
import { e } from '@site';
import Title from './title';

<Title e={e} />
    `);

    await process(site,options);

    let e = await site.getEntityBySrc('file:///main.mdx');

    assert.equal( e.Output.data, `<h1>Hello World</h1>`);
});



test.run();