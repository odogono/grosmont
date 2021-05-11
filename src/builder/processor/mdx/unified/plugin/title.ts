import { select } from 'unist-util-select';

const log = (...args) => console.log('[/plugin/title]', ...args);

export interface ConfigProps {
    onConfig?: (config: any, override: boolean) => any;
}

/**
 * 
 * @param options 
 */
export function titlePlugin({ onConfig }: ConfigProps) {
    return (tree, vFile) => {
        let config: any = {};


        const firstHeading = select('heading[depth=1] > text', tree);

        // log('heading', firstHeading );

        if (firstHeading) {
            config.title = firstHeading.value;
        }

        // if( firstHeading ){
        // const summary = select('heading[depth=1] + paragraph', tree);

        // log('summary', summary?.value, summary, tree.children);

        let foundHeading = false;
        for( const node of tree.children ){
            if( !foundHeading && (node.type === 'heading' && node.depth === 1) ){
                foundHeading = true;
                continue;
            }
            if( !foundHeading ){
                continue;
            }
            
            if( node.type === 'paragraph' && node.children[0]?.type === 'text' ){
                config.summary = node.children[0].value;
                break;
            }

            // log('examine:', node);
        }

        // if (summary) {
        //     config.summary = summary.value;
        // }

        // }

        if (onConfig && Object.keys(config).length > 0) {
            onConfig(config, false);
        }
    }
};
