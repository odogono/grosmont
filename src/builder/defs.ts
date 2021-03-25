
export const defs = [
    {
        uri: '/component/src',
        properties: [
            { name: 'url', type: 'string' },
            { name: 'mime', type: 'string' },
        ]
    },
    {
        uri: '/component/dst',
        properties: [
            { name: 'url', type: 'string' },
            { name: 'mime', type: 'string' },
        ]
    },
    {
        uri: '/component/url',
        properties: [
            { name: 'url', type: 'string' },
        ]
    },
    {
        uri: '/component/uuid',
        properties: [
            { name: 'uuid', type: 'string' },
        ]
    },
    {
        uri: '/component/status',
        properties: [
            {
                name: 'status', type: 'string',
                enum: ['active', 'inactive', 'pending', 'deleted']
            },
        ]
    },
    {
        uri: '/component/data',
        properties: [
            { name: 'data', type: 'string' /* base64 encoded */ },
            { name: 'mime', type: 'string' },
        ]
    },
    // timestamps
    // btime - birthtime - the creation date
    // mtime - the last time the file was modified
    {
        uri: '/component/ftimes',
        properties: [
            { name: 'btime', type: 'datetime' },
            { name: 'mtime', type: 'datetime' },
        ]
    },
    {
        uri: '/component/title',
        properties: [
            { name: 'title', type: 'string' },
            { name: 'summary', type: 'string' }
        ]
    },
    {
        uri: '/component/meta',
        properties: [
            { name: 'meta', type: 'json' }
        ]
    },
    {
        // a static file which gets copied from src to dst
        uri: '/component/static',
        properties: []
    },

    {
        uri: '/component/tag',
        properties: [
            { name: 'slug', type: 'string' },
        ]
    },
    

    {
        // dependency
        uri: '/component/dep',
        properties: [
            // src/dependent entity
            { name: 'src', type: 'entity' },
            // dst/dependency entity 
            { name: 'dst', type: 'entity' },

            // the type of dependency - page/link/image/etc
            // a dir dependency means that the src belongs to the parent dir
            { name: 'type', type: 'string', enum: ['link', 'css', 'dir'] }
        ]
    },


    {
        // 
        uri: '/component/site',
        properties: [
            { name: 'name', type: 'string' }
        ]
    },
    {
        uri: '/component/site_ref',
        properties: [
            { name: 'ref', type: 'entity' }
        ]
    },
    {
        uri: '/component/patterns',
        properties: [
            { name: 'include', type: 'json' },
            { name: 'exclude', type: 'json' }
        ]
    },

    {
        // 
        uri: '/component/scss',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        uri: '/component/mdx',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        uri: '/component/jsx',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        uri: '/component/js',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        uri: '/component/error',
        properties: [
            { name: 'message' },
            { name: 'from' },
            { name: 'stack' },
        ]
    },

    {
        uri: '/component/output',
        properties: [
            { name: 'data', type: 'string' },
            { name: 'mime', type: 'string' }
        ]
    },

    {
        uri: '/component/upd',
        properties: [
            { name: 'op', type: 'integer' } // ChangeSetOp
        ]
    },
    {
        uri: '/component/date',
        properties: [
            { name: 'date', type: 'datetime' }
        ]
    },
    {
        uri: '/component/date_range',
        properties: [
            { name: 'date_start', type: 'datetime' },
            { name: 'date_end', type: 'datetime' }
        ]
    },
    {
        uri: '/component/client_code',
        properties: [
            { name: 'imports', type:'json' },
            { name: 'components', type:'json' },
        ]
    }
];

