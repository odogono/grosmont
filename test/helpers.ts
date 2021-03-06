import { suite } from 'uvu';
import Path from 'path';
import Beautify from 'js-beautify';
import { Site, SiteOptions } from '../src/builder/site';
import { process as buildDirDeps } from '../src/builder/processor/build_dir_deps';
import { process as renderScss } from '../src/builder/processor/scss';
import { process as assignTitle } from '../src/builder/processor/assign_title';

import { process as applyTags } from '../src/builder/processor/apply_tags';
import { process as buildDstIndex } from '../src/builder/processor/dst_index';

import { process as mark } from '../src/builder/processor/mark';
import { process as evalMdx } from '../src/builder/processor/mdx/eval_mdx';
import { process as evalJs } from '../src/builder/processor/mdx/eval_js';
import { process as evalJsx } from '../src/builder/processor/jsx/eval_jsx';
import { process as renderJs } from '../src/builder/processor/mdx/render_js';
import { process as resolveMeta } from '../src/builder/processor/mdx/resolve_meta';

import { buildSrcIndex, FindEntityOptions } from '../src/builder/query';

import { parse } from '../src/builder/config';

import assert from 'uvu/assert';
import { printAll } from 'odgn-entity/src/util/print';
import { ChangeSetOp } from 'odgn-entity/src/entity_set/change_set';
import { EntitySetSQL } from 'odgn-entity/src/entity_set_sql';
import { ProcessOptions } from '../src/builder/types';
import { EntityId } from 'odgn-entity/src/entity';
import { Level } from '../src/builder/reporter';

export const rootPath = Path.resolve(__dirname, "../");


export async function createSite(options:SiteOptions = {}){
    let id = 1000;
    let idgen = () => ++id;

    const dst = `file://${rootPath}/dist/`;
    const testDB = { uuid: 'TEST-1', isMemory: true, idgen };
    const es = new EntitySetSQL({ ...testDB });

    return await Site.create({ idgen, name: 'test', es, dst, level: Level.WARN, ...options });
}

export async function beforeEach(tcx) {
    tcx.site = await createSite();
    tcx.es = tcx.site.es;
    tcx.options = { siteRef: tcx.site.getRef() as EntityId, reporter:tcx.site.reporter } as FindEntityOptions;
}

