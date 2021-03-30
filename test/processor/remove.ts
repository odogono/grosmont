import { suite } from 'uvu';
import assert from 'uvu/assert';

import { parseEntity } from '../../src/builder/config';
import { getDstUrl } from '../../src/builder/query';
import { ChangeSetOp } from '../../src/es';
import { build, buildProcessors, RawProcessorEntry } from '../../src/builder';
import { addFile, beforeEach, printAll } from '../helpers';
import { Level, setLevel } from '../../src/builder/reporter';


const test = suite('/processor/remove');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);
test.before.each( beforeEach );


test('remove from deps', async ({es, site, options}) => {


    await addFile(site, 'file:///pages/', {upd:ChangeSetOp.Remove} );
    await addFile(site, 'file:///pages/about.mdx', {dst:'about.html'});
    await addFile(site, 'file:///pages/projects.mdx', {dst:'projects.html'});


    const spec:RawProcessorEntry[] = [
        [ '/processor/build_dir_deps' ],
        [ '/query#applyUpdatesToDependencies'],
        [ '/processor/build_src_index' ],
        [ '/processor/build_dst_index' ],
        
        [ '/processor/remove'],
    ];

    setLevel(site.reporter, Level.DEBUG );
    const process = await buildProcessors( site, spec );

    await process( site, {...options, dryRun:true} );


});


test.run();