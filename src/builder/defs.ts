
export const defs = [

    {
        uri: '/component/file',
        properties: [
            { name: 'uri', type: 'string' },
            { name: 'path', type: 'string' },
            { name: 'ext', type: 'string' }
        ]
    },
    {
        uri: '/component/dir',
        properties: [
            { name: 'uri', type: 'string' },
            { name: 'path', type: 'string' }
        ]
    },
    {
        uri: '/component/stat',
        properties: [
            { name: 'ctime', type: 'datetime' },
            { name: 'mtime', type: 'datetime' },
        ]
    },
    {
        uri: '/component/source',
        properties: [
            { name: 'uri', type:'string' },
            { name: 'data', type:'string' },
        ]
    },
    {
        uri: '/component/target',
        properties: [
            {name:'uri', type:'string'},
            {name:'path', type:'string'},
            {name:'filename', type:'string'},
            {name:'content', type:'string', persist:false},
            {name:'minify', type:'boolean'}
        ]
    },
    {
        uri: '/component/title',
        properties: [ 
            { name: 'title', type: 'string' },
            { name: 'description', type: 'string' } 
        ]
    },
    {
        uri: '/component/meta',
        properties: [
            { name: 'meta', type: 'json' }
        ]
    },
    {
        uri: '/component/layout',
        properties: [
            { name: 'path', type: 'string' },
            { name: 'e', type: 'entity' },
        ]
    },
    {
        uri: '/component/requires',
        properties: [
            { name: 'requires', type: 'json' }
        ]
    },
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
    {
        uri: '/component/renderable',
        properties: []
    },
    
    {
        uri: '/component/css_links',
        properties: [
            // list of eids for /component/css
            {name:'eids', type:'json'},
            // list of css paths to be resolved late
            {name:'paths', type:'json'},
        ]
    },
    {
        uri: '/component/page_css',
        properties: [
            {name:'url', type:'string'},
            {name:'link', type:'entity', descr:'references the entity which the url points to'}
        ]
    },
    {
        // a static file which gets copied from src to dst
        uri: '/component/static',
        properties: []
    },
    {
        uri: '/component/tags',
        properties: [
            // list of eids to /component/tag
            {name:'tags', type:'json'}
        ]
    },
    {
        uri: '/component/links',
        properties: [
            // [ /page_link eid ]
            {name:'links', type:'json'}
        ]
    },
    {
        uri: '/component/tag',
        properties: [
            {name:'name', type:'string'},
        ]
    },
    // {
    //     // external link url       
    //     uri: '/component/link',
    //     properties: [
    //         {name:'url', type:'string'},
    //     ]
    // },
    {
        // e 1:1-> /links 1:m-> /page_link
        uri: '/component/page_link',
        descr: "an entity with a link",
        properties: [
            {name:'page_url', type:'string'},
            // the absolute url - for page/css this is relative to root
            {name:'url', type:'string'},
            {name:'text', type:'string'},
            {name:'type', type:'string', enum:['ext','css','page']},
            // {name:'link', type:'entity'},
            {name:'link', type:'entity', descr:'references the entity which the url points to'}
        ]
    },


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
            {name: 'type', type:'string'}
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
            {name:'data', type:'string'},
            {name:'jsx', type:'string'},
            {name:'code', type:'string'},
            {name:'component', type:'any', persist:false},
            {name:'writeJS', type:'boolean'},
            {name:'writeAST', type:'boolean'},
            {name:'writeJSX', type:'boolean'},
        ]
    },
    {
        // marks a page as being css
        uri: '/component/css',
        properties: [
            {name:'data', type:'string'},
            {name:'css', type:'string'}
        ]
    },
    {
        uri: '/component/text',
        properties: [
            {name: 'data', type:'string'},
            {name: 'mime', type:'string'}
        ]
    }
];

