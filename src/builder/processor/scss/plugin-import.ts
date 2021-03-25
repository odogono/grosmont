import PostCSS from 'postcss';
import { removeQuotes } from "../../util";

const Label = '/processor/scss/import';
const log = (...args) => console.log(`[${Label}]`, ...args);

export interface PostCSSImportUrlOptions {
    recursive?: boolean;
    resolveSrc?: (src: string, dst: string) => Promise<string>,
}

const defaults = {
    recursive: true,
};

const space = PostCSS.list.space;
const urlRegexp = /url\(["']?.+?['"]?\)/g;


/**
 * A PostCSS plugin to inline remote url references
 * 
 * Based on https://raw.githubusercontent.com/unlight/postcss-import-url/master/index.js
 * 
 * @param options 
 * @returns 
 */
export default function postcssImportUrl(options: PostCSSImportUrlOptions = {}) {
    options = { ...defaults, ...options };
    const resolveSrc = options.resolveSrc;

    async function importUrl(tree, _, parentRemoteFile) {
        parentRemoteFile = parentRemoteFile || tree.source.input.file;
        const imports = [];
        tree.walkAtRules('import', (atRule) => {
            const params = space(atRule.params);

            let remoteFile = cleanupRemoteFile(params[0]);


            imports.push(new Promise(async (resolve, reject) => {

                const data = await resolveSrc(remoteFile, parentRemoteFile);
                // log(remoteFile, parentRemoteFile);
                // log('resolved data', remoteFile, ' : ', data);

                let newNode = PostCSS.parse(data);
                const mediaQueries = params.slice(1).join(' ');
                if (mediaQueries) {
                    const mediaNode = PostCSS.atRule({
                        name: 'media',
                        params: mediaQueries,
                        source: atRule.source,
                    });
                    mediaNode.append(newNode);
                    newNode = mediaNode as any;
                } else {
                    newNode.source = atRule.source;
                }

                const tree = await importUrl(newNode, null, parentRemoteFile);
                atRule.replaceWith( tree );

                return resolve(true);
            }));
        });
        await Promise.all(imports);
        return tree;
    }

    return {
        postcssPlugin: 'postcss-import-grosmont-url',
        Once: importUrl,
    };
}

postcssImportUrl.postcss = true;

function cleanupRemoteFile(value) {
    let matches = value.match(/^url\((?:\"|\')?(\S+)(?:\"|\')\)/);
    if (matches) {
        return matches[1];
    }

    return removeQuotes(value);
}