'use strict';
const { src, dest, parallel, series, watch } = require('gulp');

const browsersync = require("browser-sync").create();
const cache = require('gulp-cached');
const fs = require('fs');
const handlebars = require('gulp-compile-handlebars');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const htmlmin = require('gulp-htmlmin');
const imagemin = require('gulp-imagemin');
const inlinesource = require('gulp-inline-source');
const jshint = require('gulp-jshint');
const layouts = require('handlebars-layouts');
const helper = require('handlebars-helper-repeat');
const plumber = require('gulp-plumber');
const reload = browserSync.reload;
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const sass = require('gulp-sass');
const scsslint = require('gulp-scss-lint');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const yaml = require('js-yaml');
const rimraf = require('rimraf');
const runSequence = require('run-sequence');
const path = require('path');
const notify = require('gulp-notify');
const vendor = require('gulp-concat');
const mainBowerFiles = require('main-bower-files');

handlebars.Handlebars.registerHelper(layouts(handlebars.Handlebars));
handlebars.Handlebars.registerHelper('repeat', helper);

// See https://github.com/austinpray/asset-builder
var manifest = require('asset-builder')('./src/assets/manifest.json');

// `path` - Paths to base asset directories. With trailing slashes.
// - `path.source` - Path to the source files. Default: `assets/`
// - `path.dist` - Path to the build directory. Default: `dist/`
var paths = manifest.paths;

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
var revManifest = paths.dist + 'assets.json';


function scss() {
  return src('./src/assets/sass/*.scss')    
    .pipe(plumber())
    .pipe(sass({
      outputStyle: 'compressed',
    }))
    .pipe(rename({suffix: '.min'}))
    .pipe(postcss([ autoprefixer(), cssnano() ])) // PostCSS plugins
    .pipe(dest(paths.dist + 'css'))
    .pipe(browsersync.stream());
}

function css() {
  return src('./src/assets/css/*.css')
    .pipe(plumber())
    .pipe(dest(paths.dist + 'css'))
    .pipe(browsersync.stream());
}

function images() {
  return src(globs.images)
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
    }))
    .pipe(dest(paths.dist + 'img'))
    .pipe(browsersync.stream());

}


function fonts() {
  return src('./src/assets/fonts/*')
    .pipe(plumber())
    .pipe(dest(paths.dist + 'fonts'))
    .pipe(browsersync.stream());
}

function email() {
  return src('./src/mail/**/**')
    .pipe(plumber())
    .pipe(dest('./dist/mail'))
    .pipe(browsersync.stream());
}

function template() {
  const templateData = yaml.safeLoad(fs.readFileSync('data.yml', 'utf-8'));
  const options = {
    ignorePartials: true, //ignores the unknown footer2 partial in the handlebars template, defaults to false
    batch: ['./src/partials/'],
    helpers: {
      capitals: function(str) {
        return str.toUpperCase();
      },
    },
  };
  return src('./src/templates/**/*.hbs')
    .pipe(plumber())
    .pipe(handlebars(templateData, options))
    .pipe(rename(function(path) {
      path.extname = '.html';
    }))
    .pipe(dest('./dist/'))
    .pipe(browsersync.stream());
}

function scripts() {
  return src('src/assets/js/*.js')
    .pipe(rename({suffix: '.min'}))  
    .pipe(plumber()) 
    .pipe(uglify())
    .pipe(dest(paths.dist + 'js'))
    .pipe(browsersync.stream());
}
function plugins() {
  return src(mainBowerFiles('**/*.js'))
    .pipe(vendor('scripts.min.js'))
    .pipe(dest(paths.dist + 'js'))
    .pipe(browsersync.stream());
}

function clean(cb) {
  return rimraf('./dist/', cb);
}

var cbString = new Date().getTime();
function cacheBustTask(){
    return src(['index.html'])
        .pipe(replace(/cb=\d+/, 'cb=' + cbString))
        .pipe(dest('.'));
}

// BrowserSync
function browserSync(done) {
  browsersync.init({

    injectChanges: true,

    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false,
    },
    server: {
      baseDir: "./dist/"
    },
    port: 3000
  });
  done();
}

// BrowserSync Reload
function browserSyncReload(done) {
  browsersync.reload();
  done();
}


// Watch files
function watchFiles() {
  watch("src/assets/css/**/*", series(css, browserSyncReload));
  watch([
    "src/assets/sass/**/*"
  ],
    series(scss, browserSyncReload)
  );
  watch([
    "src/assets/js/**/*",
  ],
    series(plugins, scripts, browserSyncReload)
  );
  watch(
    [
      "src/templates/**/*",
      "src/partials/**/*"
    ],
    series(template, browserSyncReload)
  );
  watch("src/assets/fonts/**/*", series(fonts, browserSyncReload));
  watch("src/assets/img/**/*", series(images, browserSyncReload));
}


// define complex tasks
const js = series(plugins, scripts);
const build = series(clean, parallel(css, scss, images, template, js, fonts, email));
const serve = parallel(watchFiles, browserSync);

exports.fonts = fonts;
exports.images = images;
exports.css = css;
exports.scss = scss;
exports.email = email;
exports.clean = clean;
exports.js = js;
exports.build = build;
exports.serve = serve;
exports.default = build;