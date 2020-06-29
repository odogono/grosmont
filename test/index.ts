import { assert } from 'chai';
import Path from 'path';
import Fs, { pathExists } from 'fs-extra';
import {processPages} from '../src/builder';
import {BuildContext, getPageMeta} from '../src/builder/context';
import {Test} from '../src/components/test';
import { truncate } from '../src/util/string';

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
        // const filename = 'misc/2018/jan.mdx';
        // const filename = 'styles/master.css';
        // const filename = 'styles/layout.css';
        const filename = 'index.mdx';

        let ctx = new BuildContext(path, outPath);

        ctx = await processPages( path, outPath, filename );
        ctx = await processPages( path, outPath );

        // debug(ctx);
    })

    // it.only('gets parent directory', () => {
    //     let path = '/Users/alex/work/opendoorgonorth.com/pages/main';
    //     let parent = Path.resolve(path, '..');

    //     console.log('path', path);
    //     console.log('parent', parent);
    // })
});



function debug(ctx: BuildContext) {
    console.log('> pages');
    for (const page of ctx.pages) {
        let { code, jsx, content, meta, ...rest } = page as any;
        meta = getPageMeta(ctx, page);
        let out:any = {meta,...rest};
        if( content != null ){ out.content = truncate(content) }
        if( code != null ){ out.code = truncate(code) }
        if( jsx != null ){ out.jsx = truncate(jsx) }
        console.dir(out);
    }
    return ctx;
}