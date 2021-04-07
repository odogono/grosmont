import {select} from 'unist-util-select';

const log = (...args) => console.log('[/plugin/title]', ...args);

export interface ConfigProps {
    onConfig?: (config:any, override:boolean) => any;
}

/**
 * 
 * @param options 
 */
export function titlePlugin( { onConfig }: ConfigProps ) {
    return (tree, vFile) => {
        let config:any = {};
        
        const firstHeading = select('heading[depth=1] > text', tree);

        if( firstHeading ){
            config.title = firstHeading.value;
        }

        if( firstHeading ){
            const summary = select('heading[depth=1] + paragraph > text', tree);

            if( summary ){
                config.summary = summary.value;
            }

        }

        if( onConfig && Object.keys(config).length > 0 ){
            onConfig( config, false );
        }
    }
};
