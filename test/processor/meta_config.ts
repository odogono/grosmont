import { suite } from 'uvu';
import assert from 'uvu/assert';
import { parseEntity } from '../../src/builder/config';

import { beforeEach } from '../helpers';


const test = suite('/processor/meta_config');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test.before.each( beforeEach );



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

    let e = await parseEntity( site, text );

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
    
    let e = await parseEntity( site, text );

    assert.equal( e.Title.title, 'BBC News');


    // console.log('\n\n---\n');
    // printAll( es );
});


test.run();