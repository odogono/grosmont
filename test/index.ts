import { assert } from 'chai';
import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import {processPages} from '../src/builder';
import {BuildContext} from '../src/builder/context';
import {Test} from '../src/components/test';

describe('Pipeline', () => {

    it('creates from values', async () => {
        const root = Path.resolve(__dirname, "../");
        // const filename = 'pages/index.mdx';
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve( root, 'dist' );

        // processPages( path, outPath, 'index.mdx' );
        processPages( path, outPath );
    });

    it.only('returns a pages dependencies', async () => {
        const root = Path.resolve(__dirname, "../");
        const path = Path.resolve(root, 'pages');
        let outPath = Path.resolve( root, 'dist' );
        const filename = 'misc/2018/jan.mdx';

        let ctx = new BuildContext(path, outPath);
        // ctx = await findDependencies(ctx, filename );

        ctx = await processPages( path, outPath );
        // processPages( path, outPath, filename );

        console.log(ctx.pages);
    })

    // it.only('gets parent directory', () => {
    //     let path = '/Users/alex/work/opendoorgonorth.com/pages/main';
    //     let parent = Path.resolve(path, '..');

    //     console.log('path', path);
    //     console.log('parent', parent);
    // })
});

