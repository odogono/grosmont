
export const defs = [

    {
        uri: '/component/file',
        properties: [
            { name: 'path', type: 'string' },
            { name: 'ext', type: 'string' },
            { name: 'createdAt', type: 'datetime' },
            { name: 'modifiedAt', type: 'datetime' },
        ]
    },
    {
        uri: '/component/target',
        properties: [
            {name:'path', type:'string'},
            {name:'content', type:'string', persist:false},
            {name:'minify', type:'boolean'},
            {name:'writeJS', type:'boolean'},
            {name:'writeAST', type:'boolean'},
            {name:'writeJSX', type:'boolean'},
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
            { name: 'data', type: 'json' }
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
    {
        uri: '/component/build',
        properties: [
            {name: 'isResolved', type:'boolean' }
        ]
    },
    {
        uri: '/component/enabled',
        properties: []
    },
    {
        uri: '/component/renderable',
        properties: []
    },
    {
        uri: '/component/mdx',
        properties: [
            {name:'jsx', type:'string'},
            {name:'code', type:'string'},
            {name:'component', type:'any', persist:false},
        ]
    },
    {
        // marks a page as being css
        uri: '/component/css',
        properties: [
            {name:'css', type:'string'}
            
        ]
    },
    {
        uri: '/component/css_links',
        properties: [
            // list of eids for /component/css
            {name:'links', type:'json'},
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
        uri: '/component/html',
        properties: [

        ]
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
    }

];

