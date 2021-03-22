import Path from 'path';
import Eval from 'eval';
import { transformModulesToCJS } from './transpile';


export interface EvalOptions {
    require?: (path, fullPath) => any;
    context?: any;
    scope?: any;
}

/**
 * 
 * @param code 
 * @param path 
 */
export function evalCode(code: string, path: string, options: EvalOptions = {}) {
    let { context, scope: inScope } = options;

    // path = path + '.mjs';
    // console.log('[evalCode]', path, code );

    context = {
        useServerEffect: () => { },
        ...context
    }


    // log('[evalCode]', path, context.useServerEffect.toString() );

    const requireManual = (requirePath) => {

        if (requirePath === '@odgn/grosmont' || requirePath === '@site') {
            // console.log('[evalCode]', 'context', {context});
            return context;
        }

        const fullPath = Path.resolve(Path.dirname(path), requirePath);

        let result;
        if (options.require) {
            result = options.require(requirePath, fullPath);
        }


        if (result === undefined) {
            result = require(requirePath);
        }
        // console.log('[evalCode]', requirePath, result);
        return result;
    }

    const scope = {
        require: requireManual,
        console: console,
        setTimeout,
        ...inScope
    }

    
    // eval doesn't like es6 import/exports...
    code = transformModulesToCJS( code );
    

    let out = Eval(code, path, scope);

    const { default: component, ...rest } = out;

    return { ...rest, component };
}
