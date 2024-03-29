import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../../src/builder/config';
import { addSrc, printAll, beforeEach, process } from '../../helpers';

const test = suite('/processor/mdx/code_blocks');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);



test.before.each(beforeEach);



test('generate code blocks', async ({ es, site, options }) => {
  await addSrc(site, 'file:///test.mdx', `
    ${'```'}javascript
    function test() {
      console.log('notice the blank line before this function?');
    }
    ${'```'}
    `);

  await process(site);

  let e = await site.getEntityBySrc('file:///test.mdx');

  assert.ok(e.Output.data.startsWith('<pre>'));
});



test.run();

