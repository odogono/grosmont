import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../src/builder/config';

import { addSrc, beforeEach, printAll, process } from '../helpers';


const test = suite('/processor/meta_config');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each(beforeEach);



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

  let e = await parseEntity(site, text);

  assert.equal(e.Title.title, 'BBC News');

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

  let e = await parseEntity(site, text);

  assert.equal(e.Title.title, 'BBC News');


  // console.log('\n\n---\n');
  // printAll( es );
});



test('lists of entities', async ({ es, site }) => {

  // the ! suffix indicates that this is the primary key
  let data = `
- url!: http://foo.com/a
  title: FooA

- url!: http://foo.com/b
  title: FooB
  tags: [ links, article ]
  `;

  await addSrc(site, 'file:///links.e.yaml', data);

  await process(site);
  await process(site);

  // check that in fact only one entity was added

  const stmt = es.prepare(`[
    /component/url#url !ca "http://foo.com/a" ==
    /component/url !bf
    @c
  ] select`);
  let coms = await stmt.getResult();

  assert.equal(coms.length, 1);

  await printAll(es);
});

test.run();