import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';

import { addSrc, beforeEach, process } from '../../helpers';
import { buildProcessors, OutputES, RawProcessorEntry, renderToOutput } from '../../../src/builder';
import { printAll } from 'odgn-entity/src/util/print';

const test = suite('processor/js/render');
const log = (...args) => console.log(`[${test.name}]`, ...args);

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


test.before.each(beforeEach);



test('rendering an entity with arguments', async ({ es, site, options }) => {

    await addSrc(site, 'file:///pages/main.jsx', `

    export default ({message}) => {        
        return <div>Message is {message}</div>
    }
    `);

    let e = await site.getEntityBySrc('file:///pages/main.jsx');

    // await printAll(es);

    const process = await buildProcessors(site, '/test', spec);

    const props = {
        message: 'Hello World'
    };

    const output = await renderToOutput(site, process, e.id, props);
    // await process(site,options);


    assert.equal(output.data, `<div>Message is Hello World</div>`);
});



test('resolving dst urls', async ({ es, site, options }) => {

    const process = await buildProcessors(site, '/test', spec);

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
                @eid
            ] select \`;

            let urls = (await runQuery(q))
                .map( eid => resolveUrl(eid) )
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


test('direct render entities', async ({ es, site, options }) => {

    const process = await buildProcessors(site, '/test', spec);

    await addSrc( site, 'file:///pages/main.tsx', `

    import { useState } from 'react';
    import { site, log, processEntities, useServerEffect, resolveUrl, runQuery } from '@site';

    export default () => {
        const [data, setData] = useState('hi there');
        let result = [];

        useServerEffect( async () => {

            const q = \`
            [
                [/component/src /component/mdx] !bf @eid
                /component/src !bf
                @eid
            ] select \`;

            const eids = await runQuery(q);

            const dids = ['/component/output', '/component/title'];
            const ents = await processEntities( eids, dids, {applyLayout:false} );

            let links = ents.map( (e,i) => {
                let title = e.Title?.title;
                let url = resolveUrl( e.id );
                return <a key={'l'+i} href={url}>{title}</a>
            });
                
            setData( links );
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

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.tsx');

    // log( e.Output.data );
    assert.equal( e.Output.data,
        `<div>Links are: <a href="/alpha.html">Alpha</a><a href="/beta.html">Beta</a></div>` );
})


test.run();

