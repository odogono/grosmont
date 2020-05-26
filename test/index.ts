import { assert } from 'chai';
import Path from 'path';
import Fs from 'fs-extra';
// import {transpile} from '../src/transpile';
import {transpile} from '../src/preact';
import Beautify from 'js-beautify';
import Klaw from 'klaw';

describe('Pipleline', () => {

    it('creates from values', async () => {
        const root = Path.resolve(__dirname, "../");
        const filename = 'pages/index.mdx';
        const path = Path.resolve(root, filename);

        // try {
            // const out = await transpile(path);
        // const out = await transpileAlt(Path.resolve(root, 'usr/footer.mdx'));

        // console.log("Transpiled:");
        // console.log(Beautify.html(out) );

        processPages( 'pages', 'dist' );
    });

});



async function processPages( pagesPath:string, outPath:string ){
    const root = Path.resolve(__dirname, "../");
    pagesPath = Path.resolve( root, pagesPath );
    outPath = Path.resolve( root, outPath );

    await Fs.emptyDir(outPath);

    for await( const file of Klaw(pagesPath) ){
        if( file.stats.isDirectory() ){
            continue;
        }
        if( Path.extname(file.path) !== '.mdx' ){
            continue;
        }

        let pagePath = Path.relative(pagesPath,file.path)

        // change extension
        let outPagePath = pagePath.replace(/\.[^/.]+$/, "") + '.html';

        try {
            outPagePath = Path.resolve(outPath, outPagePath);
            console.log( pagePath, outPagePath );
            // console.log(file.stats.ctime, file.stats.mtime);

            const {html,...rest} = await transpile({
                render: true,
                path:file.path, 
                relativePath:pagePath
            });

            console.log( {...rest, html} );

            if( html === undefined ){
                continue;
            }

            await writeHTML(outPagePath, html);
            
        } catch( err ){
            console.error('[processPages]', err );
        }
    }
}

async function writeHTML( path:string, html:string ){
    await Fs.ensureDir( Path.dirname(path) );
    await Fs.writeFile( path, Beautify.html(html) );
}