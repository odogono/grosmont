import {select} from 'unist-util-select';


export interface ConfigProps {
    onConfig: (config:any) => any;
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

        if( Object.keys(config).length > 0 ){
            onConfig( config );
        }
    }
};


const log = (...args) => console.log('[titlePlugin]', ...args);