import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';

import { addSrc, beforeEach, process } from '../../helpers';
import { buildProcessors, OutputES, RawProcessorEntry, renderToOutput } from '../../../src/builder';
import { printAll } from 'odgn-entity/src/util/print';

const test = suite('processor/js/render');
const log = (...args) => console.log(`[${test.name}]`, ...args);



test.before.each(beforeEach);



test('rendering an entity with arguments', async ({ es, site, options }) => {

    await addSrc(site, 'file:///pages/main.jsx', `

    export default ({message}) => {        
        return <div>Message is {message}</div>
    }
    `);

    const spec: RawProcessorEntry[] = [
        ['/processor/build_src_index'],
        ['/processor/mark#jsx'],
        ['/processor/jsx/eval'],
        ['/processor/js/eval'],
        ['/processor/js/render'],
    ];

    let e = await site.getEntityBySrc('file:///pages/main.jsx');

    // await printAll(es);

    const process = await buildProcessors(site, spec);

    const props = {
        message: 'Hello World'
    };

    const output = await renderToOutput(site, process, e.id, props);
    // await process(site,options);


    assert.equal(output.data, `<div>Message is Hello World</div>`);
});



test('resolving dst urls', async ({ es, site, options }) => {

    const spec: RawProcessorEntry[] = [
        ['/processor/build_src_index'],
        ['/processor/mark#jsx'],
        ['/processor/mark#mdx'],
        ['/processor/mdx/eval'],
        ['/processor/jsx/eval'],
        ['/processor/js/eval'],
        ['/processor/build_dst_index'],
        ['/processor/js/render'],
    ];

    const process = await buildProcessors(site, spec);

    await addSrc( site, 'file:///pages/main.tsx', `

    import { useState } from 'react';
    import { site, log, useServerEffect, resolveUrl, runQuery } from '@site';

    export default () => {
        const [data, setData] = useState('hi there');
        let result = [];

        useServerEffect( async () => {

            const q = \`
            [
                [/component/src /component/mdx] !bf @eid
                /component/src !bf
                @c
            ] select 
            /url pluck! \`;

            let urls = (await runQuery(q))
                .map( u => resolveUrl(u) )
                .map( (url,i) => <a key={'l'+i} href={url}>url</a> );

            setData( urls );
        });

        return <div>Links are: {data}</div>;
    }`);

    await addSrc( site, 'file:///pages/alpha.mdx', `
    # Alpha
    `, {dst:'/alpha.html'})
    await addSrc( site, 'file:///pages/beta.mdx', `
    # Beta
    `, {dst:'/beta.html'});

    
    await process(site, options);

    let e = await site.getEntityBySrc('file:///pages/main.tsx');
    assert.equal( e.Output.data,
        `<div>Links are: <a href="/alpha.html">url</a><a href="/beta.html">url</a></div>` );
})


test.run();

