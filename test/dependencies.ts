import { suite } from 'uvu';
import Path from 'path';
import Fs from 'fs-extra';
import assert from 'uvu/assert';

import { Site } from '../src/builder/site';
import { process as buildDeps } from '../src/builder/processor/build_dir_deps';

import { Entity, EntityId } from 'odgn-entity/src/entity';
import { getDependencyParents, getDependencyChildren, FindEntityOptions } from '../src/builder/query';
import { EntitySet, EntitySetMem } from 'odgn-entity/src/entity_set';


const log = (...args) => console.log('[TestFile]', ...args);


const rootPath = Path.resolve(__dirname, "../");
const test = suite('depdendencies');

let id = 1000;
const idgen = () => ++id;

interface TestProps {
    es: EntitySet;
    site: Site;
    e: Entity;
}

test.before.each(async (tcx) => {

    const configPath = `file://${rootPath}/test/fixtures/rootB/site.yaml`;

    // log( configPath );

    const site = await Site.create({ idgen, configPath, rootPath });

    tcx.site = site;
    tcx.es = site.es;
    tcx.e = site.getEntity();
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});


test('get dependency parents', async ({ es, site, options }) => {
    await loadRootB(site);

    let eids = await getDependencyParents(site.es, 1015, 'dir');
    
    assert.equal(eids, [1004, 1003, 1008, 1009, 1012]);
    
    eids = await getDependencyParents(site.es, 1004, 'dir');
    assert.equal(eids, []);
})

test('get dependency children', async ({ es, site }) => {
    await loadRootB(site);

    let eids = await getDependencyChildren(site.es, 1009, 'dir');

    assert.equal(eids, [1010, 1011, 1012, 1013, 1014, 1015, 1016]);

    eids = await getDependencyChildren(site.es, 1016, 'dir');
    assert.equal(eids, []);

    eids = await getDependencyChildren(site.es, 1012, 'dir');
    assert.equal(eids, [1015, 1016]);

    eids = await getDependencyChildren(site.es, 1004, 'dir');
    assert.equal(eids, [1002,1003,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016]);
    eids = await getDependencyChildren(site.es, 1004, 'dir', 1);
    assert.equal(eids, [1002,1003,1005]);
});


test.run();







async function loadRootB(site: Site) {
    id = 1100;
    const insts = Fs.readFileSync(Path.join(rootPath, '/test/fixtures/root.b.insts'), 'utf-8');
    const stmt = site.es.prepare(insts)
    await stmt.run();

    await buildDeps(site, {siteRef:site.getRef()});
}