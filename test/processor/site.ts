import { suite } from 'uvu';
import Path from 'path';
import Fs from 'fs-extra';
import { printAll, Site } from '../../src/builder/ecs';
import { process as scanFiles } from '../../src/builder/processor/file';
import { process as readDirMeta } from '../../src/builder/processor/read_dir_meta';


const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');

test('scans', async () => {
    let ctx = new Site();

    await ctx.init();

    
    const path = Path.join(rootPath, 'test', 'fixtures', 'rootA' );

    let e = ctx.es.createEntity();
    e.Site = { name:'test site' };
    e.Dir = { path: `file://${path}` };
    e.Patterns = {
        include: [ 'static/**/*' ],
        exclude: [ '.DS_Store', '**/*.jpg' ]
    }
    
    await ctx.es.add( e );


    // scan for file/dir entities
    await scanFiles( ctx.es );

    // reads directory meta
    // await readDirMeta( ctx.es );

    // read any metadata files in said directories

    printAll( ctx.es );

});





test.run();