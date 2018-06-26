'use strict';

var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
var cache = require('gulp-cached');
var cssnano = require('gulp-cssnano');
var fs = require('fs');
var gulp = require('gulp');
var handlebars = require('gulp-compile-handlebars');
var htmlmin = require('gulp-htmlmin');
var imagemin = require('gulp-imagemin');
var inlinesource = require('gulp-inline-source');
var jscs = require('gulp-jscs');
var jshint = require('gulp-jshint');
var layouts = require('handlebars-layouts');
var helper = require('handlebars-helper-repeat');
var plumber = require('gulp-plumber');
var reload = browserSync.reload;
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var scsslint = require('gulp-scss-lint');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var yaml = require('js-yaml');
var rimraf = require('rimraf');
var runSequence = require('run-sequence');
var path = require('path');
var notify = require('gulp-notify');
var vendor = require('gulp-concat-vendor');
var mainBowerFiles = require('main-bower-files');

handlebars.Handlebars.registerHelper(layouts(handlebars.Handlebars));
handlebars.Handlebars.registerHelper('repeat', helper);

// See https://github.com/austinpray/asset-builder
var manifest = require('asset-builder')('./src/assets/manifest.json');

// `path` - Paths to base asset directories. With trailing slashes.
// - `path.source` - Path to the source files. Default: `assets/`
// - `path.dist` - Path to the build directory. Default: `dist/`
var path = manifest.paths;

// `config` - Store arbitrary configuration values here.
var config = manifest.config || {};

// `globs` - These ultimately end up in their respective `gulp.src`.
// - `globs.js` - Array of asset-builder JS dependency objects. Example:
//   ```
//   {type: 'js', name: 'main.js', globs: []}
//   ```
// - `globs.css` - Array of asset-builder CSS dependency objects. Example:
//   ```
//   {type: 'css', name: 'main.css', globs: []}
//   ```
// - `globs.fonts` - Array of font path globs.
// - `globs.images` - Array of image path globs.
// - `globs.bower` - Array of all the main Bower files.
var globs = manifest.globs;

// `project` - paths to first-party assets.
// - `project.js` - Array of first-party JS assets.
// - `project.css` - Array of first-party CSS assets.
var project = manifest.getProjectGlobs();

// Path to the compiled assets manifest in the dist directory
var revManifest = path.dist + 'assets.json';

gulp.task('sass:lint', function() {
  gulp.src('./src/assets/sass/*.scss')
    .pipe(plumber())
    .pipe(scsslint());
});

gulp.task('sass:build', function() {
  gulp.src('./src/assets/sass/**/style.scss')
    .pipe(rename({suffix: '.min'}))
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass({
      outputStyle: 'compressed',
      errLogToConsole: false,
      onError: function(err) {
          return notify().write(err);
      }
    }))
    .pipe(autoprefixer())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./dist/assets/css/'))
    .pipe(notify({ message: 'Styles task complete' }));
});

gulp.task('sass:optimized', function() {
  return gulp.src('./src/assets/sass/**/style.scss')
    .pipe(rename({suffix: '.min'}))
    .pipe(plumber())
    .pipe(sass({
      outputStyle: 'compressed',
    }))
    .pipe(autoprefixer())
    .pipe(cssnano({compatibility: 'ie8'}))
    .pipe(gulp.dest('dist/assets/css/'));
});

gulp.task('sass', ['sass:lint', 'sass:build']);

gulp.task('js:build', function() {
  return gulp.src('src/assets/js/*.js')
    .pipe(rename({suffix: '.min'}))
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('dist/assets/js'));
});

gulp.task('js:lint', function() {
  return gulp.src(['./src/assets/js/*.js', '!./src/assets/js/lib/*.js', 'Gulpfile.js'])
    .pipe(plumber())
      .pipe(jscs())
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('scripts:build', function() {
    return gulp.src(mainBowerFiles('**/*.js'))
        .pipe(vendor('scripts.min.js'))
        .pipe(gulp.dest('./dist/assets/js'));  
});
/*
gulp.task('scripts:build', function() {
    gulp.src('./src/assets/js/lib/*')
        .pipe(vendor('scripts.min.js'))
        .pipe(gulp.dest('./dist/assets/js'));  
});
*/

gulp.task('js', ['js:lint', 'js:build', 'scripts:build']);

gulp.task('images', function() {
   return gulp.src(globs.images)
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
    }))
    .pipe(gulp.dest(path.dist + 'img'));
});

gulp.task('images:optimized', function() {
  return gulp.src(globs.images)
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
      multipass: true,
    }))
    .pipe(gulp.dest(path.dist + 'img'));
});

gulp.task('css', function() {
  return gulp.src('src/assets/css/*.css')
    .pipe(plumber())
    .pipe(gulp.dest('./dist/assets/css'));
});

gulp.task('fonts', function() {
  //return gulp.src('src/assets/fonts/*')
  return gulp.src(globs.fonts)
    .pipe(plumber())
    //.pipe(gulp.dest('./dist/assets/fonts'));
    .pipe(gulp.dest(path.dist + 'fonts'));
});

gulp.task('templates', function() {
  var templateData = yaml.safeLoad(fs.readFileSync('data.yml', 'utf-8'));
  var options = {
    ignorePartials: true, //ignores the unknown footer2 partial in the handlebars template, defaults to false
    batch: ['./src/partials/'],
    helpers: {
      capitals: function(str) {
        return str.toUpperCase();
      },
    },
  };

  return gulp.src('./src/templates/**/*.hbs')
    .pipe(plumber())
    .pipe(handlebars(templateData, options))
    .pipe(rename(function(path) {
      path.extname = '.html';
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('templates:optimized', ['templates'], function() {
  return gulp.src('./dist/**/*.html')
    .pipe(inlinesource())
    .pipe(replace(/\.\.\//g, ''))
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
    }))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('clean', function(cb) {
  return rimraf('./dist/', cb);
});

gulp.task('watch', function() {
  gulp.watch(['src/templates/**/*.hbs', 'src/templates/*.hbs', 'src/partials/**/*.hbs'], ['templates'], reload);
  gulp.watch(['src/assets/sass/*.scss', 'src/assets/sass/**/*.scss'], ['sass'], reload);
  gulp.watch(['src/assets/img/*', 'src/assets/img/**/*'], ['images'], reload);
  gulp.watch(['src/assets/fonts/*', 'src/assets/fonts/**/*'], ['fonts'], reload);
  gulp.watch(['src/assets/css/*', 'src/assets/css/**/*'], ['css'], reload);
  gulp.watch(['src/assets/js/*.js', 'src/assets/js/**/*.js', 'Gulpfile.js', 'bower.json'], ['js'], reload);
  
});

gulp.task('build', function (cb) {
  return runSequence('clean', ['sass', 'css', 'images', 'fonts', 'js', 'templates'], cb);
});

gulp.task('build:optimized', function(cb) {
  return runSequence('clean',
    ['sass:optimized', 'css', 'images:optimized', 'fonts', 'js', 'templates:optimized'],
    cb);
});

// use default task to launch Browsersync and watch JS files
gulp.task('serve', ['build'], function() {

  // Serve files from the root of this project
  browserSync.init(['./dist/**/*'], {
    injectChanges: true,

    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false,
    },
    server: {
      baseDir: './dist',
    }
  });

  // add browserSync.reload to the tasks array to make
  // all browsers reload after tasks are complete.
  gulp.start(['watch']);
});
