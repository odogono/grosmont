import { hash } from "@odgn/utils";
import React, { useContext } from "react";

const log = (...args) => console.log(`[ServerEffect]`, ...args);




export const ServerEffect = React.createContext({ 
    requests: new Map<string,any>(), 
    isActive: true, 
    key:'', 
    count:0 
});

/**
 * 
 */
export const serverEffectValue = { 
    requests: new Map<string,any>(), 
    isActive: true, 
    key:'', 
    count:0 
};

/**
 * 
 * @param key 
 */
export function beginServerEffects(key:string){
    serverEffectValue.isActive = true;
    serverEffectValue.requests = new Map<string,any>();
    serverEffectValue.key = key;// hash(key,true) as string;
    serverEffectValue.count = 0;
}


/**
 * 
 * @param key 
 */
export async function endServerEffects(key:string){
    if( serverEffectValue.isActive === false ){
        return;
    }

    
    for( const [key,effect] of serverEffectValue.requests ){
        // log('[endServerEffects] key', key );

        let result = await effect();
        serverEffectValue.requests.set(key,result);
    }

    serverEffectValue.isActive = false;

    // log('[endServerEffects]', key, serverEffectValue.requests );
}

/**
 * 
 * @param param0 
 */
export function ServerEffectProvider({ children }) {
    return <ServerEffect.Provider value={serverEffectValue}>
        {children}
    </ServerEffect.Provider>
}

/**
 * 
 * https://medium.com/swlh/how-to-use-useeffect-on-server-side-654932c51b13
 * @param effect 
 * @param initial 
 */
export function useServerEffect(effect, initial = undefined){
    const context = useContext(ServerEffect);
    const key = `${context.key}-${(++context.count)}`;

    // log('[useServerEffect]', key, {context});

    if( context.isActive ){
        context.requests.set(key, effect);
        // context.requests.push( effect );
        return initial;
    }

    return context.requests.get(key);
}