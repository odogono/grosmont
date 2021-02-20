import { suite } from 'uvu';
import Path from 'path';
import { Site } from '../../src/builder/site';
import { parse } from '../../src/builder/config';
import { Entity, EntityId } from 'odgn-entity/src/entity';
import { process as buildDstIndex } from '../../src/builder/processor/dst_index';
import { process as write } from '../../src/builder/processor/write';
import { printAll } from 'odgn-entity/src/util/print';


const log = (...args) => console.log('[TestProcMeta]', ...args);

const printES = async (es) => {
    console.log('\n\n---\n');
    printAll( es );
}

const rootPath = Path.resolve(__dirname, "../../");
const test = suite('processor/dst_index');


test.before.each(async (tcx) => {
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/test/fixtures/dist/`;
    tcx.site = await Site.create({ idgen, name: 'test', dst });
    
    // tcx.siteEntity = tcx.site.getEntity();
    tcx.es = tcx.site.es;
});



test('writes', async ({site,es}) => {

    await parse( site, `
    id: 1999
    dst: /styles/
    `);

    let e = await parse( site, `
    id: 2001
    text: css-data-here
    dst: main.css
    /component/upd:
        op: 1
    `);

    await addDirDep(site, 2001, 1999 );

    await buildDstIndex(site);

    await write(site);

    // const dst = await getDstUrl(es, 2001);

    // log( dst );

    printES(es);
});


test.run();


async function addDirDep( site:Site, src:EntityId, dst:EntityId ){
    await parse( site, `
    /component/dep:
        src: ${src}
        dst: ${dst}
        type: dir
    `);
}