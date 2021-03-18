import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';

import { addMdx, addSrc, beforeEach, createSite, process, rootPath } from '../helpers';

const test = suite('processor/js/client');
const log = (...args) => console.log(`[${suite.name}]`, ...args);
test.before.each(beforeEach);




test('use', async ({ es, site, options }) => {

    await addSrc(site, 'file:///components/world.jsx', `
    export default () => {
        return <div>World</div>
    }`);
    await addSrc(site, 'file:///components/hello.jsx', `
    import World from './world';
    export default () => {
        return <div>Hello <World /></div>
    }`);

    await addMdx(site, 'file:///pages/main.mdx', `
import 'https://unpkg.com/react@17/umd/react.development.js';

<ScriptLinks />

    <ClientCode element="root">
        import Hello from '../components/hello';
        <h1><Hello /></h1>
    </ClientCode>
    
    `);

    await process(site, options);

    // console.log('\n\n');
    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    // log( e.Output.data );
    assert.equal(e.Output.data,
        `<script crossorigin="anonymous" src="/code.1004.js"></script><script crossorigin="anonymous" src="https://unpkg.com/react@17/umd/react.development.js"></script><div id="client-code-7d8c94f9"></div>`);

});



test.run();
