'use strict';

// const Ghost = require('./ghost/core/index');  
const Ghost = require('ghost');
const Express = require('express');  
const app = Express();  
// const Ghost = require('./src/ghost_middleware');
const Path = require('path');

app.get('/nuts', function (req, res) {
  res.send('Hello World!');
});


function registerHelpers( ghostServer ){
    // hints from https://zackehh.com/safely-creating-custom-handlebars-helpers/
    // http://jegtnes.co.uk/blog/how-to-serve-different-assets-in-production-environments-with-ghost/

    // important that we use the same express-hbs module as ghost is using
    const HBS = require('ghost/node_modules/express-hbs');
    const Jsonpointer = require('jsonpointer');
    
    // a general purpose config helper which returns the value of config from a jsonpointer
    // or works on a block op
    HBS.registerHelper("config", function(path, options){
        const result = Jsonpointer.get( ghostServer.config.get(), path );
        if( !options.fn ){
            return result;
        }
        return result ? options.fn(this) : options.inverse(this);    
    })
}


Ghost({ config: __dirname + '/etc/ghost-config.js' })
    .then( ghostServer => {  
        registerHelpers( ghostServer );
        app.use( ghostServer.rootApp );
        ghostServer.start( app );
        // console.log( ghostServer.config );
    });
//*/
