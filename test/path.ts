import { suite } from 'uvu';
import assert from 'uvu/assert';
import { resolveUrlPath } from '../src/builder/util';


const test = suite('paths');

const log = (...args) => console.log('[TestPath]', ...args);

test('resolve path', () => {


    assert.equal(
        resolveUrlPath('./components/header.jsx', 'file:///index.mdx'),
        'file:///components/header.jsx' );
    
        assert.equal(
        resolveUrlPath('header.jsx', 'file:///index.mdx'),
        'file:///header.jsx' );
    
    assert.equal(
        resolveUrlPath('./header.jsx', 'file:///index.mdx'),
        'file:///header.jsx' );
    
    assert.equal(
        resolveUrlPath('../components/header.jsx', 'file:///pages/index.mdx'),
        'file:///components/header.jsx' );
    
    assert.equal(
        resolveUrlPath('../components/header.jsx', 'file:///pages/blog/index.mdx'),
        'file:///pages/components/header.jsx' );
    
    assert.equal(
        resolveUrlPath('file:///components/header.jsx', 'file:///pages/blog/index.mdx'),
        'file:///components/header.jsx' );
    
});



test.run();