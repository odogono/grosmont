import { suite } from 'uvu';
import assert from 'uvu/assert';
import { FindEntityOptions } from '../../../src/builder/query';
import { parse } from '../../../src/builder/config';

import { printAll } from 'odgn-entity/src/util/print';
import { EntityId } from 'odgn-entity/src/entity';
import { addMdx, beforeEach, createSite, process, rootPath } from './helpers';

const log = (...args) => console.log('[TestProcMDX]', ...args);


const test = suite('processor/mdx/master');



test.before.each(beforeEach);




test('master page', async ({ es, site, options }) => {

    // if an mdx references a layout, then render the mdx
    // inside of the layout
    await addMdx(site, 'file:///layout/main.mdx', `
---
isRenderable: false
---

<html lang="en">
    <body>{children}</body>
</html>`);

    
await addMdx(site, 'file:///pages/main.mdx', `
---
layout: /layout/main
---
Hello _world_
    `);
    
    await process(site, options);

    // await printAll(es);

    let e = await site.getEntityBySrc('file:///pages/main.mdx');

    assert.equal(e.Output.data,
        `<html lang="en"><body><p>Hello <em>world</em></p></body></html>`);


});



test.run();

