import traverse from "@babel/traverse";
import { ProcessOptions } from '../../types';
import { Site } from '../../site';
import { getDependencyEntityIds, insertDependency, selectSrcByMime } from '../../query';
import { getComponentEntityId, setEntityId } from 'odgn-entity/src/component';
import { EntityId } from 'odgn-entity/src/entity';
import { createErrorComponent, resolveUrlPath } from '../../util';
import { generateFromAST, parseJSX } from '../../transpile';

const Label = '/processor/jsx';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface ParseJSOptions {
    resolveImport?: (path) => string | undefined;
    require?: (path: string, fullPath: string) => any;
}

export interface ParseJSResult {

}


const presets = [
    // ["latest-node", { "target": "current" }],
    ["@babel/preset-env", {
        "exclude": [
            "@babel/plugin-transform-spread"
        ],
        "targets": { "node": "current" }
    }],
    "@babel/preset-react",
    "@babel/preset-typescript"
];


/**
 * Rewrites import statements from JSX code into entity references if appropriate
 * 
 * @param site 
 * @param options 
 */
export async function process(site: Site, options: ProcessOptions = {}) {
    const es = options.es ?? site.es;

    // let ents = await selectJsx(es, { ...options, siteRef: site.getRef() });
    let src = await selectSrcByMime(es, ['text/jsx'], { ...options, siteRef: site.getRef() });
    
    const did = es.getByUri('/component/data');

    // log('ents', src);

    let coms = [];

    let removeEids = new Set<EntityId>();

    for (const srcCom of src) {

        const srcUrl = srcCom.url;
        const eid = getComponentEntityId(srcCom);

        try {
            // let props = await buildProps(site, e);
            let data = await site.getEntityData(eid);

            let imports = [];

            // get a list of existing css dependencies
            const depIds = await getDependencyEntityIds(es, eid, 'import');

            removeEids = new Set([...removeEids, ...depIds]);

            let ast = parseJSX(data);

            traverse(ast, {
                ImportDeclaration(path) {
                    let importPath = path.node.source.value;
                    let resolvedEid = resolvePath(site, importPath, srcUrl);
                    if (resolvedEid !== undefined) {
                        const val = `e://${resolvedEid}/component/jsx#component`;
                        imports.push([resolvedEid, val]);
                        // importEids.push(resolvedEid);
                        path.node.source.value = val;
                    }
                }
            });


            let code = generateFromAST(ast);
            
            if (code) {
                let dataCom = es.createComponent(did, { data: code });
                dataCom = setEntityId(dataCom, eid);

                coms.push(dataCom);
            }


            // insert import dependencies
            for (const [impEid, url] of imports) {
                let urlCom = es.createComponent('/component/url', { url });
                // add a import dependency
                let depId = await insertDependency(es, eid, impEid, 'import', [urlCom]);

                if (removeEids.has(depId)) {
                    removeEids.delete(depId);
                }
            }

        } catch (err) {
            await es.add( createErrorComponent(es, eid, err, {from:Label}) );
            throw err;
        }
    }

    await es.add(coms);

    // remove dependencies that don't exist anymore
    await es.removeEntity(Array.from(removeEids));

    return site;
}


function resolvePath(site: Site, path: string, base: string): EntityId {
    const srcIndex = site.getIndex('/index/srcUrl');
    if (srcIndex === undefined) {
        throw new Error('/index/srcUrl not present');
    }
    path = resolveUrlPath(path, base);
    let eid = srcIndex.getEid(path);
    if (eid !== undefined) {
        return eid;
    }
    return undefined;
}


// export async function parseJS(content: string, options: ParseJSOptions): Promise<ParseJSResult> {

//     let ast = babelParser(content, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

//     // log( ast );

//     traverse(ast, {
//         ImportDeclaration(path) {
//             log('import', path.node.source.value);
//         }
//     })

//     return {};

//     // let { resolveImport } = options;
//     // let links = new Map<string, any>();
//     // let ast;

//     // // if (imgs === undefined) {
//     // //     imgs = new Map<string, PageImg>();
//     // // }

//     // // remark-mdx has a really bad time with html comments even
//     // // if they are removed with the removeCommentPlugin, so a brute
//     // // force replace is neccesary here until i can figure it out
//     // content = content.replace(/<!--(.*?)-->/, '');

//     // let output = await unified()
//     //     .use(parse)
//     //     // .use(stringify)
//     //     .use(frontmatter)
//     //     .use(emoji)
//     //     .use(configPlugin, { page: {} })
//     //     .use(removeCommentPlugin)
//     //     .use(() => console.dir)
//     //     // .use(imgProc, { imgs })
//     //     // .use(linkProc, { links, applyLinks })
//     //     // take a snap of the AST
//     //     .use(() => tree => { ast = JSON.stringify(tree, null, '\t') })
//     //     // .use(mdx)
//     //     // .use(mdxjs)
//     //     .use(titlePlugin)
//     //     .use(importCSSPlugin, { resolve: resolveImport })
//     //     // .use(squeeze)
//     //     // .use(mdxAstToMdxHast)
//     //     // .use(mdxHastToJsx)
//     //     // .use(() => console.dir)
//     //     // .use( () => console.log('💦doh') )
//     //     .process(content);
//     // // console.log( output.toString());

//     // // log( 'ast', ast ); throw 'stop';

//     // // return ['/* @jsx mdx */\n' + output.toString(), links, ast];

//     // return {
//     //     // jsx: '/* @jsx mdx */\n' + output.toString(),
//     //     // links,
//     //     ast,
//     //     // imgs
//     // };
// }