import { printAll } from 'odgn-entity/src/util/print';
import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { addSrc, beforeEach, createSite, process, rootPath } from '../../helpers';

const test = suite('/processor/mdx/svg');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each(beforeEach);

test('renders svg inline', async ({site,es, options}) => {

    await parseEntity( site, `
    src: file:///static/castle.svg
    data: "<svg height='55' viewBox='0 0 333.33269 333.33269'><path d='M192.92 157.3v-18.76h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-56.25h18.75V44.8H91.67v18.75H72.92V44.8H54.17v18.75H35.42V44.8H16.67v56.25h18.75v187.5h93.84c-.1-56.25 18.66-75 37.4-75 18.76 0 37.5 18.75 37.59 75h93.67v-187.5h18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v56.25h18.75v56.25h-15v-18.75h-18.75v18.75h-15z'/></svg>"
    `);

    let e = await addSrc(site, 'file:///pages/main.mdx', `
# My home

<svg src={'file:///static/castle.svg'} inline="true" alt="alt text"></svg>
    `);

    await process(site, options);
    
    // await printAll(es);
    
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>My home</h1><svg height="55" viewBox="0 0 333.33269 333.33269"><path d="M192.92 157.3v-18.76h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-56.25h18.75V44.8H91.67v18.75H72.92V44.8H54.17v18.75H35.42V44.8H16.67v56.25h18.75v187.5h93.84c-.1-56.25 18.66-75 37.4-75 18.76 0 37.5 18.75 37.59 75h93.67v-187.5h18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v56.25h18.75v56.25h-15v-18.75h-18.75v18.75h-15z"></path></svg>`);
});

test('renders svg link', async ({site,es, options}) => {

    await parseEntity( site, `
    src: file:///static/castle.svg
    dst: file:///castle.svg
    data: "<svg height='55' viewBox='0 0 333.33269 333.33269'><path d='M192.92 157.3v-18.76h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-18.75h-18.75v18.75h-15v-56.25h18.75V44.8H91.67v18.75H72.92V44.8H54.17v18.75H35.42V44.8H16.67v56.25h18.75v187.5h93.84c-.1-56.25 18.66-75 37.4-75 18.76 0 37.5 18.75 37.59 75h93.67v-187.5h18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v18.75h-18.75V44.8h-18.75v56.25h18.75v56.25h-15v-18.75h-18.75v18.75h-15z'/></svg>"
    `);

    let e = await addSrc(site, 'file:///pages/main.mdx', `
# My home

<svg src={'file:///static/castle.svg'} inline="false" alt="alt text"></svg>
    `);
    await process(site, options);
    
    // await printAll(es);
    
    e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<h1>My home</h1><svg src="/castle.svg" inline="false" alt="alt text"></svg>`);
});


test.run();