import { suite } from 'uvu';
import { parseEntity } from '../../src/builder/config';

import { getDstUrl } from '../../src/builder/query';
import { process, beforeEach } from './helpers';


const test = suite('/processor/meta');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);

test.before.each( beforeEach );

test('selects src by extension', async ({site,es, options}) => {

    await parseEntity( site, `
    src: file:///pages/
    `);

    await parseEntity( site, `
    src: file:///pages/dir.e.yaml
    dst: /pages/
    `);

    await parseEntity( site, `
    src: file:///pages/beta.mdx
    dst: beta.html
    `);

    process(site);
    
    const e = await site.getEntityBySrc( 'file:///pages/beta.mdx' );

    const dst = await getDstUrl(es, e.id);

    // log('dst', dst);

    // let coms = await selectSrcByExt( es, ['jpeg', 'html'], options);

    // assert.equal( coms.map(c=>c.url), ['file:///alpha.JPEG', 'file:///beta.html'] );
    
    // coms = await selectSrcByExt( es, ['html'], options);
});


test.run();