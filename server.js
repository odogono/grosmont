'use strict';

// const Ghost = require('./ghost/core/index');  
const Ghost = require('ghost');
const Express = require('express');  
const app = Express();  
// var redirects = require('./redirects.json');

Ghost({ config: __dirname + '/etc/ghost-config.js' })
    .then( ghostServer => {  
        app.use( ghostServer.rootApp );
        ghostServer.start( app );
    });