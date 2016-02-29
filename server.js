'use strict';

// const Ghost = require('./ghost/core/index');  
const Ghost = require('ghost');
const Express = require('express');  
const app = Express();  
const Path = require('path');
const _ = require('underscore');

app.get('/nuts', function (req, res) {
  res.send('Hello World!');
});


function registerHelpers( ghostServer ){
    // hints from https://zackehh.com/safely-creating-custom-handlebars-helpers/
    // http://jegtnes.co.uk/blog/how-to-serve-different-assets-in-production-environments-with-ghost/

    // important that we use the same express-hbs module as ghost is using
    const HBS = require('express-hbs');
    const Jsonpointer = require('jsonpointer');
    
    // a general purpose config helper which returns the value of config from a jsonpointer
    // or works on a block op
    HBS.registerHelper("config", function(path, options){
        const result = Jsonpointer.get( ghostServer.config.get(), path );
        if( !options.fn ){
            return result;
        }
        
        if( Array.isArray(result) ){
            console.log(path, result, options);
            var buffer = "";
            for( var ii=0,len=result.length;ii<len;ii++ ){
                buffer += options.fn( result[ii] );
            }
            return buffer;    
        }

        return result ? options.fn(this) : options.inverse(this);
    })
    HBS.registerHelper("tmpl", function(expression, options){
        let template = HBS.compile(expression);
        return template( this, options );
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
