import { suite } from 'uvu';
import Path from 'path';
import Process from 'process';
import Fs from 'fs-extra';
import { printAll, printEntity, Site } from '../../src/builder/ecs';
import { 
    process as scanFiles,
    selectDirByUri 
} from '../../src/builder/processor/file';
import { process as resolveFileDeps, 
    selectDependencies,
    selectDirDependencies 
} from '../../src/builder/processor/file_deps';
import { process as readDirMeta, selectMetaDisabled } from '../../src/builder/processor/read_dir_meta';
import { process as removeMetaDisabled } from '../../src/builder/processor/remove_disabled';
import { Entity, EntityId } from 'odgn-entity/src/entity';

const log = (...args) => console.log('[TestProcSite]', ...args);

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/file');

test('scans', async () => {
    
    let id = 1000;
    const idgen = () => ++id;

    let ctx = new Site({idgen});

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
    // await resolveFileDeps( ctx.es );
    
    // reads directory meta
    await readDirMeta( ctx.es );
    
    // remove disabled
    await removeMetaDisabled( ctx.es );

    
    
    printAll( ctx.es );
    // printAll( ctx.es, await ctx.es.queryEntities('[/component/dep !bf @c] select') );
});





test.run();