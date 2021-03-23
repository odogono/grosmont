import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parseEntity } from '../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as buildDstIndex } from '../../src/builder/processor/build_dst_index';
import { process as write } from '../../src/builder/processor/write';
import { printAll } from 'odgn-entity/src/util/print';
import { FindEntityOptions } from '../../src/builder/query';
import { addDirDep } from '../helpers';


const rootPath = Path.resolve(__dirname, "../../");
const test = suite('/processor/write');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);

test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/test/fixtures/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId } as FindEntityOptions;
});



test('writes', async ({site,es, options}) => {

    await parseEntity( site, `
    id: 1999
    dst: /styles/
    `);

    let e = await parseEntity( site, `
    id: 2001
    data: css-data-here
    dst: main.css
    /component/upd:
        op: 1
    `);

    await addDirDep(site, 2001, 1999 );

    await buildDstIndex(site, options);

    await write(site, options);

    // const dst = await getDstUrl(es, 2001);

    // log( dst );

    // printES(es);
});


test.run();
