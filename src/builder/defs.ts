
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
        uri: '/component/mime',
        properties: [
            { name: 'type', type: 'string' },
        ]
    },
    {
        uri: '/component/status',
        properties: [
            { name: 'status', type: 'string', 
                enum:[ 'active', 'inactive', 'pending', 'deleted'] },
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
    {
        uri: '/component/times',
        properties: [
            { name: 'ctime', type: 'datetime' },
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
    // DEPRECATED - dependencies are used instead
    // {
    //     uri: '/component/layout',
    //     properties: [
    //         { name: 'path', type: 'string' },
    //         { name: 'e', type: 'entity' },
    //     ]
    // },
    // {
    //     uri: '/component/requires',
    //     properties: [
    //         { name: 'requires', type: 'json' }
    //     ]
    // },
    // {
    //     uri: '/component/build',
    //     properties: [
    //         {name: 'isResolved', type:'boolean' }
    //     ]
    // },
    {
        uri: '/component/enabled',
        properties: [
            { name: 'is', type: 'boolean'}
        ]
    },
    // {
    //     uri: '/component/renderable',
    //     properties: []
    // },
    
    // DEPRECATED - use dependencies
    // {
    //     uri: '/component/css_links',
    //     properties: [
    //         // list of eids for /component/css
    //         {name:'eids', type:'json'},
    //         // list of css paths to be resolved late
    //         {name:'paths', type:'json'},
    //     ]
    // },
    // DEPRECATED
    // {
    //     uri: '/component/page_css',
    //     properties: [
    //         {name:'url', type:'string'},
    //         {name:'link', type:'entity', descr:'references the entity which the url points to'}
    //     ]
    // },
    {
        // a static file which gets copied from src to dst
        uri: '/component/static',
        properties: []
    },

    // DEPRECATED - use dependencies
    // {
    //     uri: '/component/tags',
    //     properties: [
    //         // list of eids to /component/tag
    //         {name:'tags', type:'json'}
    //     ]
    // },
    // DEPRECATED - use dependencies
    // {
    //     uri: '/component/links',
    //     properties: [
    //         // [ /page_link eid ]
    //         {name:'links', type:'json'}
    //     ]
    // },
    
    {
        uri: '/component/tag',
        properties: [
            {name:'slug', type:'string'},
        ]
    },
    // {
    //     // external link url       
    //     uri: '/component/link',
    //     properties: [
    //         {name:'url', type:'string'},
    //     ]
    // },

    // DEPRECATED - use dependencies
    // {
    //     // e 1:1-> /links 1:m-> /page_link
    //     uri: '/component/page_link',
    //     descr: "an entity with a link",
    //     properties: [
    //         {name:'page_url', type:'string'},
    //         // the absolute url - for page/css this is relative to root
    //         {name:'url', type:'string'},
    //         {name:'text', type:'string'},
    //         {name:'type', type:'string', enum:['ext','css','page']},
    //         // {name:'link', type:'entity'},
    //         {name:'link', type:'entity', descr:'references the entity which the url points to'}
    //     ]
    // },


    {
        // dependency
        uri: '/component/dep',
        properties: [
            // src/dependent entity
            {name: 'src', type:'entity'},
            // dst/dependency entity 
            {name: 'dst', type:'entity'},

            // the type of dependency - page/link/image/etc
            // a dir dependency means that the src belongs to the parent dir
            {name: 'type', type:'string', enum:[ 'link', 'css', 'dir' ]}
        ]
    },


    {
        // 
        uri: '/component/site',
        properties: [
            {name: 'name', type:'string' }
        ]
    },
    {
        uri: '/component/site_ref',
        properties: [
            {name: 'ref', type:'entity'}
        ]
    },
    {
        uri: '/component/patterns',
        properties: [
            {name: 'include', type:'json'},
            {name: 'exclude', type:'json'}
        ]
    },

    {
        // 
        uri: '/component/scss',
        properties: [
            {name: 'data', type:'string' }
        ]
    },
    {
        uri: '/component/mdx',
        properties: [
            {name:'data', type:'string'}
        ]
    },
    {
        uri: '/component/jsx',
        properties: [
            {name:'data', type:'string'}
        ]
    },
    {
        uri: '/component/js',
        properties: [
            {name:'data', type:'string'}
        ]
    },
    {
        uri: '/component/error',
        properties: [
            {name:'message'}
        ]
    },
    // {
    //     // DEPRECATED marks a page as being css
    //     uri: '/component/css',
    //     properties: [
    //         {name:'data', type:'string'},
    //         {name:'css', type:'string'}
    //     ]
    // },
    // {
    //     uri: '/component/text',
    //     properties: [
    //         {name: 'data', type:'string'},
    //         {name: 'mime', type:'string'}
    //     ]
    // },

    {
        uri: '/component/output',
        properties: [
            {name: 'data', type:'string'},
            {name: 'mime', type:'string'}
        ]
    },

    {
        uri: '/component/upd',
        properties: [
            {name: 'op', type:'integer'} // ChangeSetOp
        ]
    },
    {
        uri: '/component/date',
        properties: [
            {name: 'date', type: 'datetime'}
        ]
    }
];

