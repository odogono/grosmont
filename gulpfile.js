'use strict';

var Gulp = require('gulp');
var Livereload = require('gulp-livereload');
var Nodemon = require('gulp-nodemon');
var Path = require('path');
var Source = require('vinyl-source-stream');
var Util = require('util');

var Autoprefixer = require('gulp-autoprefixer');
var Sass = require('gulp-sass');
var Sourcemaps = require('gulp-sourcemaps');

var themePath = Path.join( __dirname, 'content', 'themes','odgn-crossing-ghost');
var scssPath = Path.join( themePath, 'assets', 'scss');
var cssPath = Path.join(themePath,'assets','css');


Gulp.task('sass', function () {
  Gulp.src( Path.join(scssPath, 'style.scss') )
    .pipe(Sourcemaps.init())
    .pipe(Sass({outputStyle: 'expanded'}))
    .pipe(Autoprefixer())
    .pipe(Sourcemaps.write('.'))
    .pipe(Gulp.dest(cssPath));
});



Gulp.task('watch', function() {
    // var watcher = Gulp.watch( 'src/client/**/*.js', ['build.client'] );
    // Gulp.watch( 'src/shared/**/*.js', ['build.client'] );
    // watcher.on('change', function(event) {
    //   console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
    // });

    Gulp.watch(  Path.join(scssPath, '*.scss'), ['sass'])
        .on('change', function(evt){
            console.log('styles %s was %s, running tasks...', evt.path, evt.type);
            setTimeout( function(){ Livereload.reload(); });
        })

    // Gulp.watch( 'web/scss/**/*.scss', ['build.styles'])
    //     .on('change', function(evt){
    //         console.log('styles %s was %s, running tasks...', evt.path, evt.type);
    //     })
});

Gulp.task('serve', function (cb) {
    // NOTE - tiny-lr is not yet npm3 compatible
    // var lrPath = Path.join(__dirname, 'node_modules/livereload-js/dist/livereload.js')
    Livereload.listen({quiet:false});
    // console.log('serve: started')
    Nodemon({
        script  : 'server.js',
        ext: 'js css',
        // execMap: {
        //     "js": "babel-node"
        // },
        env: {
          'NODE_ENV': 'development'
        },
        watch: [ 'server.js', 'src', 'etc/ghost-config.js', Path.join(themePath,'*.hbs') ]
        //...add nodeArgs: ['--debug=5858'] to debug 
        //..or nodeArgs: ['--debug-brk=5858'] to debug at server start
    })
    .on('restart', function () {
        // use a timeout to give the server time to come back up
        // - a pity this has to happen really!
        setTimeout(function(){
            Livereload.reload();
        },2500)
    });
});


// Gulp.task('default', ['build.styles', 'serve', 'watch']);
Gulp.task('default', ['serve', 'watch']);