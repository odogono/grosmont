
export const defs = [
    {
        url: '/component/src',
        properties: [
            { name: 'url', type: 'string' },
            { name: 'mime', type: 'string' },
        ]
    },
    {
        url: '/component/dst',
        properties: [
            { name: 'url', type: 'string' },
            { name: 'mime', type: 'string' },
        ]
    },
    {
        url: '/component/url',
        properties: [
            { name: 'url', type: 'string' },
        ]
    },
    {
        url: '/component/uuid',
        properties: [
            { name: 'uuid', type: 'string' },
        ]
    },
    {
        url: '/component/status',
        properties: [
            {
                name: 'status', type: 'string',
                enum: ['active', 'inactive', 'pending', 'deleted']
            },
        ]
    },
    {
        url: '/component/data',
        properties: [
            { name: 'data', type: 'string' /* base64 encoded */ },
            { name: 'mime', type: 'string' },
        ]
    },
    // timestamps
    // btime - birthtime - the creation date
    // mtime - the last time the file was modified
    {
        url: '/component/ftimes',
        properties: [
            { name: 'btime', type: 'datetime' },
            { name: 'mtime', type: 'datetime' },
        ]
    },
    {
        url: '/component/title',
        properties: [
            { name: 'title', type: 'string' },
            { name: 'summary', type: 'string' }
        ]
    },
    {
        url: '/component/meta',
        properties: [
            { name: 'meta', type: 'json' }
        ]
    },
    {
        // a static file which gets copied from src to dst
        url: '/component/static',
        properties: []
    },

    {
        url: '/component/tag',
        properties: [
            { name: 'slug', type: 'string' },
        ]
    },


    {
        // dependency
        url: '/component/dep',
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
        url: '/component/site',
        properties: [
            { name: 'name', type: 'string' }
        ]
    },
    {
        url: '/component/site_ref',
        properties: [
            { name: 'ref', type: 'entity' }
        ]
    },
    {
        url: '/component/patterns',
        properties: [
            { name: 'include', type: 'json' },
            { name: 'exclude', type: 'json' }
        ]
    },

    {
        // 
        url: '/component/scss',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        url: '/component/mdx',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        url: '/component/jsx',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        url: '/component/js',
        properties: [
            { name: 'data', type: 'string' }
        ]
    },
    {
        url: '/component/error',
        properties: [
            { name: 'message' },
            { name: 'from' },
            { name: 'stack' },
        ]
    },

    {
        url: '/component/output',
        properties: [
            { name: 'data', type: 'string' },
            { name: 'mime', type: 'string' }
        ]
    },

    {
        url: '/component/upd',
        properties: [
            { name: 'op', type: 'integer' } // ChangeSetOp
        ]
    },
    {
        url: '/component/date',
        properties: [
            { name: 'date', type: 'datetime' }
        ]
    },
    {
        url: '/component/date_range',
        properties: [
            { name: 'date_start', type: 'datetime' },
            { name: 'date_end', type: 'datetime' }
        ]
    },
    {
        url: '/component/client_code',
        properties: [
            { name: 'imports', type: 'json' },
            { name: 'components', type: 'json' },
        ]
    },
    {
        url: '/component/thumbnail',
        properties: [
            { name: 'url', type: 'string' }
        ]
    },
    {
        url: '/component/pageable',
        properties: [
            { name: 'pageSize', type: 'number' },
            { name: 'orderBy', type: 'string' }
        ]
    }
];

