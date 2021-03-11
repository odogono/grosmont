import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const test = suite('/processor/mdx/image');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each(beforeEach);

test('renders image', async ({site,es, options}) => {

    await parseEntity( site, `
    src: file:///static/image.jpg
    dst: image.jpg
    `);

    let e = await addMdx(site, 'file:///pages/main.mdx', `
# My home

<img src={'file:///static/image.jpg'} alt="Image alt" />

    `);

    await process(site, options);
    
    // await printAll(es);
    
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>My home</h1><img src="/image.jpg" alt="Image alt"/>`);
});


test.run();
