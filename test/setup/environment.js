(function(QUnit) {
  var sync = Skeletor.sync;
  var ajax = Skeletor.ajax;
  var emulateHTTP = Skeletor.emulateHTTP;
  var emulateJSON = Skeletor.emulateJSON;
  var history = window.history;
  var pushState = history.pushState;
  var replaceState = history.replaceState;

  QUnit.config.noglobals = true;

  QUnit.testStart(function() {
    var env = QUnit.config.current.testEnvironment;

    // We never want to actually call these during tests.
    history.pushState = history.replaceState = function() {};

    // Capture ajax settings for comparison.
    Skeletor.ajax = function(settings) {
      env.ajaxSettings = settings;
    };

    // Capture the arguments to Skeletor.sync for comparison.
    Skeletor.sync = function (method, model, options) {
      env.syncArgs = {
        method: method,
        model: model,
        options: options
      };
      sync.apply(this, arguments);
    };

  });

  QUnit.testDone(function() {
    Skeletor.sync = sync;
    Skeletor.ajax = ajax;
    Skeletor.emulateHTTP = emulateHTTP;
    Skeletor.emulateJSON = emulateJSON;
    history.pushState = pushState;
    history.replaceState = replaceState;
  });

})(QUnit);
