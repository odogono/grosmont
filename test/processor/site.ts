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
import { process as readFileData } from '../../src/builder/processor/read_file_css';
import { process as renderScss } from '../../src/builder/processor/scss';
import { process as clearTargets } from '../../src/builder/processor/clear_target';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { EntitySetMem } from 'odgn-entity/src/entity_set';

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
    e.Dir = { uri: `file://${Process.cwd()}/` };
    e.Target = { uri: `file://${Process.cwd()}/dist/` };
    e.Patterns = {
        include: [ './test/fixtures/rootA/**/*' ],
        // include: [ 'static/**/*' ],
        // exclude: [ '.DS_Store', '**/*.jpg' ]
    }
    
    await Fs.emptyDir( Path.join( Process.cwd(), 'dist') );

    await ctx.es.add( e );

    

    // scan for file/dir entities
    await scanFiles( ctx.es );
    
    // add dependencies for files to directories
    await resolveFileDeps( ctx.es );
    
    // reads directory meta
    await readDirMeta( ctx.es );
    
    // console.log('\n---\n');
    // printAll( ctx.es );

    // remove disabled
    await removeMetaDisabled( ctx.es ) as EntitySetMem;

    // read css/scss/mdx/html files
    await readFileData(ctx.es);

    // parse mdx data into meta, links, ...

    
    // await clearTargets( ctx.es, e );


    // process scss
    await renderScss( ctx.es );


    // copy static

    
    console.log('\n---\n');
    printAll( ctx.es );


    // get the dest dir for a given entity

    // const deps = await selectDirDependencies( ctx.es, 1013 );

    // log('deps', deps);
    // const result = await getDestDir( 1013 );

    // console.log( ctx.es.entities );
    // printAll( ctx.es, await ctx.es.queryEntities('[/component/dep !bf @c] select') );
});





test.run();