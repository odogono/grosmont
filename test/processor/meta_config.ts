import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parse as parse } from '../../src/builder/config';

import assert from 'uvu/assert';
import { Entity } from 'odgn-entity/src/entity';
import { printAll } from 'odgn-entity/src/util/print';

const log = (...args) => console.log('[TestProcMeta]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/meta');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
});



test('target path for file', async ({ es, site }) => {

    let text = `
comment: a title and url

# pk (reserved) is a way of identifying an existing entity
pk: /component/url#/url

/component/url:
  url: https://www.bbc.co.uk/news

/component/title:
  title: BBC News
    `;

    let e = await parse( site, text );

    assert.equal( e.Title.title, 'BBC News');

//     text = `
// comment = "a title and url"

// id = 1234

// # pk (reserved) is a way of identifying an existing entity
// pk = "/component/url#/url"

// ["/component/url"]
// url = "https://www.bbc.co.uk/news"

// ["/component/title"]
// title = "BBC News Home Page"
//     `;

//     e = await parse( site, text );

    // console.log('\n\n---\n');
    // printAll( es );
});


test('target path for file (yaml)', async ({ es, site }) => {

    let text = `
comment: a title and url

# pk (reserved) is a way of identifying an existing entity
pk: /component/url#/url

/component/url:
  url: https://www.bbc.co.uk/news

/component/title:
  title: BBC News

    `;
    
    let e = await parse( site, text, 'yaml' );

    assert.equal( e.Title.title, 'BBC News');


    // console.log('\n\n---\n');
    // printAll( es );
});


test.run();