import { suite } from 'uvu';
import Path from 'path';
import Process from 'process';
import Fs from 'fs-extra';
import { printAll, Site } from '../../src/builder/ecs';
import { process as scanFiles } from '../../src/builder/processor/file';
import { process as resolveFileDeps } from '../../src/builder/processor/file_deps';
import { process as readDirMeta } from '../../src/builder/processor/read_dir_meta';


const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');

test('scans', async () => {
    let ctx = new Site();

    await ctx.init();

    
    const path = rootPath;
    // const path = Path.join(rootPath, 'test', 'fixtures', 'rootA' );

    let e = ctx.es.createEntity();
    e.Site = { name:'test site' };
    e.Dir = { uri: `file://${Process.cwd()}` };
    e.Patterns = {
        include: [ './test/fixtures/rootA/**/*' ],
        // include: [ 'static/**/*' ],
        // exclude: [ '.DS_Store', '**/*.jpg' ]
    }
    
    await ctx.es.add( e );


    // scan for file/dir entities
    await scanFiles( ctx.es );
    
    // add dependencies for files to directories
    await resolveFileDeps( ctx.es );
    
    // reads directory meta
    // await readDirMeta( ctx.es );
    
    // read any metadata files in said directories
    
    printAll( ctx.es );


    // dependency
    // src -> dst

});





test.run();