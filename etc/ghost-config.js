// # Ghost Configuration
// Setup your Ghost install for various [environments](http://support.ghost.org/config/#about-environments).

// Ghost runs in `development` mode by default. Full documentation can be found at http://support.ghost.org/config/
var Path = require('path');

var ContentDir = process.env.GHOST_CONTENT_DIR || '/var/local/ghost/content';
var config;


// TODO: host specific config should be moved out
if ( require('os').hostname() == 'leiden.local' ){
    ContentDir = './content';
}

console.log('host ' + require('os').hostname() );
console.log('ghost content dir ' + ContentDir);

config = {
    // ### Production
    // When running Ghost in the wild, use the production environment.
    // Configure your URL and mail settings here
    production: {
        url: 'http://opendoorgonorth.com',
        mail: {},
        database: {
            client: 'sqlite3',
            connection: {
                filename: Path.join(ContentDir, '/data/ghost.db')
            },
            debug: false
        },

        server: {
            host: '0.0.0.0',
            port: '2368'
        },
        mail: {
            transport: 'SMTP',
            options: {
                service: 'Mailgun',
                auth: {
                    user: 'postmaster@mail.doorgonorth.com', // mailgun username
                    pass: '4vpf4bsxqvz3'  // mailgun password
                }
            },
            from: '"OpenDoorGoNorth" <odgn@mail.doorgonorth.com>',
        },
        // #### Paths
        // Specify where your content directory lives
        paths: {
            contentPath: ContentDir
        },
        footer_links:[
            { name: "Twitter", href:"https://twitter.com/odogono" },
            { name: "RSS", href:"{{@blog.url}}/rss/" } 
        ],
        disqus_shortname: ""
    },

    // ### Development **(default)**
    development: {
        // The url to use when providing links to the site, E.g. in RSS and email.
        // Change this to your Ghost blog's published URL.
        url: 'http://localhost:2368',

        // Example mail config
        // Visit http://support.ghost.org/mail for instructions
        // ```
         mail: {
             transport: 'SMTP',
             options: {
                 service: 'Mailgun',
                 auth: {
                     user: 'postmaster@mail.doorgonorth.com', // mailgun username
                     pass: '4vpf4bsxqvz3'  // mailgun password
                 }
             },
             from: '"OpenDoorGoNorth" <odgn@mail.doorgonorth.com>',
         },
        // ```

        // #### Database
        // Ghost supports sqlite3 (default), MySQL & PostgreSQL
        database: {
            client: 'sqlite3',
            connection: {
                filename: Path.join( ContentDir, '/data/ghost.db')
            },
            debug: false
        },
        // #### Server
        // Can be host & port (default), or socket
        server: {
            // Host to be passed to node's `net.Server#listen()`
            host: '0.0.0.0',
            // Port to be passed to node's `net.Server#listen()`, for iisnode set this to `process.env.PORT`
            port: '2368',

            livereload: true
        },
        // #### Paths
        // Specify where your content directory lives
        paths: {
            contentPath: ContentDir
        },
        footer_links:[
            { name: "Twitter", href:"https://twitter.com/odogono" },
            { name: "RSS", href:"{{@blog.url}}/rss/" } 
        ],
        disqus_shortname: ""
    },

    // **Developers only need to edit below here**

    // ### Testing
    // Used when developing Ghost to run tests and check the health of Ghost
    // Uses a different port number
    testing: {
        url: 'http://0.0.0.0:2369',
        database: {
            client: 'sqlite3',
            connection: {
                filename: Path.join( ContentDir, '/data/ghost-test.db')
            }
        },
        server: {
            host: '0.0.0.0',
            port: '2369'
        },
        logging: false
    }
};

module.exports = config;
