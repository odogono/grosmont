import 'stateful-hooks';
import { suite } from 'uvu';
import assert from 'uvu/assert';

import { addSrc, beforeEach, process} from '../../helpers';

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

    await addSrc(site, 'file:///pages/main.mdx', `
import 'https://unpkg.com/react@17/umd/react.development.js';

<ScriptLinks />

    <ClientCode element="root">
        import Hello from '../components/hello';
        <h1><Hello /></h1>
    </ClientCode>
    
    `);

    await process(site, {...options, beautify:true});

    // console.log('\n\n');
    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    // log( e.Output.data );
    assert.equal(e.Output.data,
`<script crossorigin="anonymous" src="https://unpkg.com/react@17/umd/react.development.js"></script>
<script crossorigin="anonymous" src="/code.1004.js"></script>
<div id="client-code-7d8c94f9"></div>`);

});



test('layout script links', async ({es, site, options}) => {
    await addSrc(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
    <ScriptLinks />
</html>`);

    await addSrc(site, 'file:///index.mdx', `
---
layout: /layout/main
dst: /index.html
---
import 'https://unpkg.com/react@17/umd/react.development.js';

# Index
    `);

    await process(site, {...options, beautify:true} );

    let e = await site.getEntityByDst('/index.html');

    assert.equal(e.Output.data, `<html lang="en">

<body>
    <h1>Index</h1>
</body>
<script crossorigin="anonymous" src="https://unpkg.com/react@17/umd/react.development.js"></script>

</html>`);

});


test.run();
