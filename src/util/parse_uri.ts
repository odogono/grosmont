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
