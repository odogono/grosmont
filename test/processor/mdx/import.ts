import { suite } from 'uvu';
import assert from 'uvu/assert';
import { addMdx, beforeEach, process } from '../../helpers';


const test = suite('/processor/mdx/import');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);

test.before.each(beforeEach);



test('import jsx', async ({ es, site, options }) => {

    await addMdx(site, 'file:///message.jsx', `export default () => "Hello World";`);

    // note - important that import has no leading space
    await addMdx(site, 'file:///pages/main.mdx', `
---
comment: nothing much!
---
import Message from 'file:///message.jsx';

Message: <Message />
`);


    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<p>Message: Hello World</p>`);

    // console.log('\n\n---\n');
});

test('import without ext', async ({ es, site, options }) => {

    await addMdx(site, 'file:///message.jsx', `export default () => "Hello World";`);
    await addMdx(site, 'file:///pages/main.mdx', `
import Message from '../message';

Message: <Message />
`);

    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<p>Message: Hello World</p>`);
});










test.run();
