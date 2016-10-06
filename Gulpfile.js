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


handlebars.Handlebars.registerHelper(layouts(handlebars.Handlebars));

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

gulp.task('js:lint', function() {
  return gulp.src(['./src/assets/js/*.js', '!./src/assets/js/lib/*.js', 'Gulpfile.js'])
    .pipe(plumber())
      .pipe(jscs())
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('scripts:build', function() {
    gulp.src(['./src/assets/js/lib/*','./src/assets/js/*.js'])
        .pipe(vendor('scripts.min.js'))
        .pipe(gulp.dest('./dist/assets/js'));
});

gulp.task('js', ['js:lint', 'scripts:build']);

gulp.task('images', function() {
  return gulp.src('src/assets/img/*')
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
    }))
    .pipe(gulp.dest('./dist/assets/img'));
});

gulp.task('images:optimized', function() {
  return gulp.src('src/assets/img/**/*')
    .pipe(plumber())
    .pipe(imagemin({
      progressive: true,
      multipass: true,
    }))
    .pipe(gulp.dest('./dist/assets/img'));
});

gulp.task('css', function() {
  return gulp.src('src/assets/css/*.css')
    .pipe(plumber())
    .pipe(gulp.dest('./dist/assets/css'));
});

gulp.task('fonts', function() {
  return gulp.src('src/assets/fonts/*')
    .pipe(plumber())
    .pipe(gulp.dest('./dist/assets/fonts'));
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
  gulp.watch(['./src/templates/**/*.hbs', './src/templates/*.hbs', './src/partials/**/*.hbs', './src/partials/*.hbs'], ['templates'], reload);
  gulp.watch(['./src/assets/sass/**/*.scss', './src/assets/sass/*.scss', './src/assets/css/*.css']], ['sass'], reload);
  gulp.watch(['./src/assets/img/**/*', './src/assets/img/*' ], ['images'], reload);
  gulp.watch(['./src/assets/fonts/**/*', './src/assets/fonts/*' ], ['fonts'], reload);
  gulp.watch(['./src/assets/js/**/*.js', './src/assets/js/*.js', 'Gulpfile.js'], ['js'], reload);
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
