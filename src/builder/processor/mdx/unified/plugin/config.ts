import Toml from 'toml';
import Yaml from 'yaml';
import unistVisit from 'unist-util-visit';
import unistRemove from 'unist-util-remove';


export interface ConfigProps {
    onConfig?: (config: any, override: boolean) => any;
}

/**
 * 
 * @param options 
 */
export function configPlugin({ onConfig }: ConfigProps) {
    return (tree, vFile) => {

        unistVisit(tree, { type: 'yaml' }, (node, index, parent) => {

            const config = (node as any).value;

            try {
                let parsed = Yaml.parse(config);

                if( onConfig ){
                    onConfig(parsed, true);
                }

            } catch (e) {
                console.error("Parsing error on line " + e.line + ", column " + e.column +
                    ": " + e.message);
            }
        })
        unistRemove(tree, 'frontMatter');
    }
};