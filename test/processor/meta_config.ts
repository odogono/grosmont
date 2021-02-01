import { suite } from 'uvu';
import Path from 'path';
import { printAll, Site } from '../../src/builder/ecs';
import { process as assignMime } from '../../src/builder/processor/assign_mime';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as renderMdx } from '../../src/builder/processor/mdx';
import { parse as parseMeta } from '../../src/builder/processor/meta';
import { process as slugifyTitle } from '../../src/builder/processor/slugify_title';
import { process as mdxPreprocess } from '../../src/builder/processor/mdx/parse';
import { process as mdxResolveMeta } from '../../src/builder/processor/mdx/resolve_meta';
import { process as mdxRender } from '../../src/builder/processor/mdx/render';

import assert from 'uvu/assert';
import { Entity } from 'odgn-entity/src/entity';

const log = (...args) => console.log('[TestProcMeta]', ...args);

const printES = (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/meta');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const target = `file://${rootPath}/dist/`;
    tcx.site = new Site({ idgen, name: 'test', target });
    await tcx.site.init();
    // tcx.siteEntity = tcx.site.getSite();
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
    log('err')

    let e = await parseMeta( site, text );

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

//     e = await parseMeta( site, text );

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
    log('err')

    let e = await parseMeta( site, text, 'yaml' );

    assert.equal( e.Title.title, 'BBC News');


    // console.log('\n\n---\n');
    // printAll( es );
});


test.run();