/* global module */
const path = require('path');


module.exports = function(config) {
  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',
    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    // XXX: change this to ['mocha'] and uncomment the skeletor tests to run
    // the storage tests.
    frameworks: ['qunit', 'mocha'],

    // list of files / patterns to load in the browser
    files: [
        'node_modules/lodash/lodash.js',
        'node_modules/sinon/pkg/sinon.js',
        'test/vendor/json2.js',
        'dist/skeletor.js',
        'test/indexeddb.test.js',
        'test/localStorage.test.js',
        'test/sessionStorage.test.js',

        'test/setup/dom-setup.js',
        'test/collection.js',
        'test/events.js',
        'test/model.js',
        'test/noconflict.js',
        'test/router.js',
        'test/sync.js',
        'test/view.js',
    ],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/indexeddb.test.js': ['webpack'],
      'test/localStorage.test.js': ['webpack'],
      'test/sessionStorage.test.js': ['webpack']
    },
    webpack: {
      mode: 'development',
      devtool: 'inline-source-map',
      module: {
         rules: [{
           test: /\.js$/,
           exclude: /(node_modules|test)/
         }]
      },
      output: {
        path: path.resolve('test'),
        filename: '[name].out.js',
        chunkFilename: '[id].[chunkHash].js'
      }
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],
    client: {
      mocha: {
        reporter: 'html',
        ui: 'bdd'
      }
    },

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
}
