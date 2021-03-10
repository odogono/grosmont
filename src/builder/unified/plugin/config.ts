import Toml from 'toml';
import Yaml from 'yaml';
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';


export interface ConfigProps {
    onConfig: (config:any) => any;
}

/**
 * 
 * @param options 
 */
export function configPlugin( {onConfig}:ConfigProps ) {
    return (tree, vFile) => {
        // console.log('uhh', vFile);
        unistVisit(tree, { type: 'yaml' }, (node, index, parent) => {
            // console.log('uhh', node);

            const config = (node as any).value;
            // TODO : convert this into a javascript call
            try {
                let parsed = Yaml.parse(config);

                onConfig(parsed);

                // const {enabled, ...rest} = parsed;
                // if (options.page) {
                //     parsed = { ...options.page, ...parsed };
                // }
                // console.log('[configPlugin]', parsed);

                // (node as any).type = 'export';
                // (node as any).value = 'export const frontMatter = ' + JSON.stringify(parsed) + ';';
                // (node as any).value = 'export const page = ' + JSON.stringify(parsed) + ';';

                // console.log('[configPlugin]', (node as any).value);

            } catch (e) {
                console.error("Parsing error on line " + e.line + ", column " + e.column +
                    ": " + e.message);
            }
        })
        unistRemove(tree, 'frontMatter');
    }
};