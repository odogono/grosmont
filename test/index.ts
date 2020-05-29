import { assert } from 'chai';
import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import {processPages} from '../src/build';
import {Test} from '../src/components/test';

describe('Pipleline', () => {

    it('creates from values', async () => {
        const root = Path.resolve(__dirname, "../");
        // const filename = 'pages/index.mdx';
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve( root, 'dist' );

        // processPages( path, outPath, 'index.mdx' );
        processPages( path, outPath );
    });

    // it.only('gets parent directory', () => {
    //     let path = '/Users/alex/work/opendoorgonorth.com/pages/main';
    //     let parent = Path.resolve(path, '..');

    //     console.log('path', path);
    //     console.log('parent', parent);
    // })
});

