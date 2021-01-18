// interface Options {
//     strictMode: boolean;
//     key: string[];
//     q: {
//         name: string;
//         parser: RegExp;
//     };
//     parser: {
//         strict: RegExp;
//         loose: RegExp;
//     };
// }

import { stringify } from "odgn-entity/src/util/json";
import { isString } from "./is";
import { toBoolean } from "./to";

export interface UriStructure {
    source: string;
    protocol: string;
    authority: string;
    userInfo: string;
    user: string;
    password: string;
    host: string;
    port: number;
    relative: string;
    path: string;
    directory: string;
    file: string;
    query: string;
    anchor: string;
    queryKey: any;
}

/**
 * parseUri 1.2.2
 * (c) Steven Levithan <stevenlevithan.com>
 * MIT License
 * http://blog.stevenlevithan.com/archives/parseuri
 */
export function parseUri(str: string): UriStructure {
    const o = parseUri.options;
    const m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str);
    const uri = {};
    let ii = 14;

    while (ii--) {
        uri[o.key[ii]] = (m ? m[ii] : '') || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, ($0, $1, $2) => {
        // NOTE AV : added decode here
        if ($1) { uri[o.q.name][$1] = decodeURIComponent($2); }
    });

    return uri as UriStructure;
}

parseUri.options = {
    
    key: [
        'source',
        'protocol',
        'authority',
        'userInfo',
        'user',
        'password',
        'host',
        'port',
        'relative',
        'path',
        'directory',
        'file',
        'query',
        'anchor'
    ],
    parser: {
        // eslint-disable-next-line
        loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
        // eslint-disable-next-line
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/
    },
    q: {
        name: 'queryKey',
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    strictMode: false,
};





export interface BuildUrlOptions {
    ignoreEmptyValues?: boolean;
}

/**
 * 
 * @param {*} action 
 * @param {*} qs 
 */
export function buildUrl(action:string, qs = {}, options:BuildUrlOptions = {}) : string {
    const ignoreEmptyValues = toBoolean( options.ignoreEmptyValues );

    const queryString = buildQueryString(qs, ignoreEmptyValues);

    if (queryString) {
        return `${action}?${queryString}`;
    } else {
        return action;
    }
}


export function buildQueryString( qs = {}, ignoreEmptyValues:boolean = false ) : string {
    // const esc = encodeURIComponent;

    // let queryString = Object.keys(qs)
    //     .map(k => `${esc(k)}=${esc(qs[k])}`)
    //     .join('&');
    
    // return queryString;

    let queryStringList = Object.keys(qs)
    .filter( k => ignoreEmptyValues ? qs[k] !== undefined : true )
    .map( key => {
        let val = qs[key];
        if ( isString(val)) {
            val = encodeURIComponent(val);
        } else {
            val = encodeURIComponent( stringify(val) );
        }
        return { key, val };
    });

    queryStringList.sort( (a,b) => {
        if( a.key > b.key ){
            return 1;
        }
        if( a.key < b.key ){
            return -1;
        }
        return 0;
    })

    return queryStringList.map(pair => `${pair.key}=${pair.val}`).join('&');
}