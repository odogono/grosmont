import Yaml from 'yaml';
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';

/**
 * 
 * @param options 
 */
export function configPlugin(options) {
    return (tree, file, ...rest) => {
        unistVisit(tree, { type: 'yaml' }, (node, index, parent) => {

            const config = (node as any).value;
            // TODO : convert this into a javascript call
            try {
                let parsed = Yaml.parse(config);

                // const {enabled, ...rest} = parsed;
                // console.log('[configPlugin]', parsed, options);
                if (options.page) {
                    parsed = { ...options.page, ...parsed };
                }

                (node as any).type = 'export';
                // (node as any).value = 'export const frontMatter = ' + JSON.stringify(parsed) + ';';
                (node as any).value = 'export const page = ' + JSON.stringify(parsed) + ';';

            } catch (e) {
                console.error("Parsing error on line " + e.line + ", column " + e.column +
                    ": " + e.message);
            }
        })
        unistRemove(tree, 'frontMatter');
    }
};