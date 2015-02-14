var del = require('del'),
	gulp = require('gulp'),
	gutil = require('gulp-util'),
	less = require('gulp-less'),
	plumber = require('gulp-plumber'),
	shell = require('gulp-shell'),
	browserify = require('browserify'),
	brfs = require('brfs'),
	watchify = require('watchify'),
	webpack = require('webpack'),
	source = require('vinyl-source-stream'),
	merge = require('merge-stream'),
	chalk = require('chalk');

/**
 * Check that a compatible version of gulp is available in the project
 */

function fatal(err) {
	var msg = '\n\n';
	if (Array.isArray(err)) {
		err.forEach(function(i) {
			msg += i + '\n\n';
		});
	} else {
		msg += (err || 'Fatal error, bailing.') + '\n\n';
	}
	console.log(msg);
	process.exit(1);
}

try {
	var projectGulpVersion = require(module.parent.paths[0] + '/gulp/package.json').version;
} catch(e) {
	// If we can't find gulp in the parent project, it's a fatal problem.
	fatal(
		'You do not seem to have Gulp installed in your project.',
		'Please add gulp ^' + packageGulpVersion + ' to your package.json, npm install and try again.'
	);
}
try {
	// Check to make sure the local gulp and the project gulp match.
	var packageGulpVersion = require('./node_modules/gulp/package.json').version;
	if (semver.satisfies(projectGulpVersion, '^' + packageGulpVersion)) {
		fatal(
			'You do not have the correct version of Gulp installed in your project.',
			'Please add gulp ^' + packageGulpVersion + ' to your package.json, npm install and try again.'
		);
	}
} catch(e) {
	// Assume gulp has been loaded from ../node_modules and it matches the requirements.
}

/**
 * This package exports a function that binds tasks to a gulp instance
 */

module.exports = function(gulp, context) {

	/**
	* Clean
	*/

	gulp.task('clean', function() {
		del(['./www/*']);
	});


	/**
	* Preview Server
	*/

	gulp.task('serve', function() {
		var express = require('express');
		var app = express();
		
		app.use(express.static('./www'));
		
		var server = app.listen(process.env.PORT || 8000, function() {
			console.log('Local Server ready on port %d', server.address().port);
		});
	});


	/**
	* Build
	*/

	gulp.task('less', function() {
		return gulp.src('src/css/app.less')
		.pipe(less())
		.pipe(gulp.dest('www/css'));
	});

	gulp.task('html', function() {
		return gulp.src('src/index.html')
		.pipe(gulp.dest('www'));
	});

	gulp.task('images', function() {
		return gulp.src('src/img/**')
		.pipe(gulp.dest('www/img'));
	});

	gulp.task('fonts', function() {
		return gulp.src('src/fonts/**')
		.pipe(gulp.dest('www/fonts'));
	});

	function doBundle(target, name, dest) {
		return target.bundle()
		.on('error', function(e) {
			gutil.log('Browserify Error', e);
		})
		.pipe(source(name))
		.pipe(gulp.dest(dest));
	}

	function watchBundle(target, name, dest) {
		return watchify(target)
		.on('update', function (scriptIds) {
			scriptIds = scriptIds
			.filter(function(i) { return i.substr(0,2) !== './' })
			.map(function(i) { return chalk.blue(i.replace(__dirname, '')) });
			if (scriptIds.length > 1) {
				gutil.log(scriptIds.length + ' Scripts updated:\n* ' + scriptIds.join('\n* ') + '\nrebuilding...');
			} else {
				gutil.log(scriptIds[0] + ' updated, rebuilding...');
			}
			doBundle(target, name, dest);
		})
		.on('time', function (time) {
			gutil.log(chalk.green(name + ' built in ' + (Math.round(time / 10) / 100) + 's'));
		});
	}

	function buildApp(watch,callback) {
		
		var opts = {};
        // opts.context = context;

		opts.entry = './src/js/app.js';
		opts.output = {
			filename : './www/js/app.js'
		};

        opts.module = {};

        opts.module.postLoaders = [
            {
                loader: "transform/cacheable?brfs"
            }
        ]

        opts.node = {
            fs: "empty",
            events: "empty"
        };

        opts.devtool = "#inline-source-map";

	    opts.module.loaders = [ 
            { 
                test: /\.js$/, 
                loader: 'jsx-loader' 
            },

            { 
            	test: /\.json$/, 
            	loader: 'json' 
            }
        ];

        opts.externals =[{
            xmlhttprequest: '{XMLHttpRequest:XMLHttpRequest}'
        }];

		var compiler = webpack(opts);


        if (watch) {
            compiler.watch(300, function(err,stats) {
                if(err) throw new gutil.PluginError("webpack", err);
                gutil.log("[webpack]", stats.toString({
                    // output options
                }));
    		});
        } else {
            compiler.run(300, function(err,stats) {
                if(err) throw new gutil.PluginError("webpack", err);
                gutil.log("[webpack]", stats.toString({
                    // output options
                }));
                callback();
            });
        }
		
	}

	gulp.task('scripts', function(callback) {
		return buildApp(false,callback);
	});

	gulp.task('watch-scripts', function(callback) {
		return buildApp(true,callback);
	});

	gulp.task('build', ['html', 'images', 'fonts', 'less', 'scripts']);

	gulp.task('watch', ['html', 'images', 'fonts', 'less', 'watch-scripts'], function() {
		gulp.watch(['src/index.html'], ['html']);
		gulp.watch(['src/css/**/*.less'], ['less']);
		gulp.watch(['src/img/**/*.*'], ['images']);
		gulp.watch(['src/fonts/**/*.*'], ['fonts']);
	});

	gulp.task('dev', ['watch', 'serve']);

	/**
	* Cordova
	*/

	gulp.task('prepare', ['html', 'images', 'fonts', 'less', 'scripts'], function() {
		return gulp.src('')
		.pipe(plumber())
		.pipe(shell(['cordova prepare'], { cwd: __dirname }));
	});

	gulp.task('android', ['prepare'], function() {
		return gulp.src('')
		.pipe(plumber())
		.pipe(shell(['cordova run android'], { cwd: __dirname }));
	});
	
}
