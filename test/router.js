(function(QUnit) {

  var router = null;
  var location = null;
  var lastRoute = null;
  var lastArgs = [];

  var onRoute = function(routerParam, route, args) {
    lastRoute = route;
    lastArgs = args;
  };

  var Location = function(href) {
    this.replace(href);
  };

  _.extend(Location.prototype, {

    parser: document.createElement('a'),

    replace: function(href) {
      this.parser.href = href;
      _.extend(this, _.pick(this.parser,
        'href',
        'hash',
        'host',
        'search',
        'fragment',
        'pathname',
        'protocol'
     ));

      // In IE, anchor.pathname does not contain a leading slash though
      // window.location.pathname does.
      if (!/^\//.test(this.pathname)) this.pathname = '/' + this.pathname;
    },

    toString: function() {
      return this.href;
    }

  });

  QUnit.module('Skeletor.Router', {

    beforeEach: function() {
      location = new Location('http://example.com');
      Skeletor.history = _.extend(new Skeletor.History, {location: location});
      router = new Router({testing: 101});
      Skeletor.history.interval = 9;
      Skeletor.history.start({pushState: false});
      lastRoute = null;
      lastArgs = [];
      Skeletor.history.on('route', onRoute);
    },

    afterEach: function() {
      Skeletor.history.stop();
      Skeletor.history.off('route', onRoute);
    }

  });

  var ExternalObject = {
    value: 'unset',

    routingFunction: function(value) {
      this.value = value;
    }
  };
  ExternalObject.routingFunction = _.bind(ExternalObject.routingFunction, ExternalObject);

  var Router = Skeletor.Router.extend({

    count: 0,

    routes: {
      'noCallback': 'noCallback',
      'counter': 'counter',
      'search/:query': 'search',
      'search/:query/p:page': 'search',
      'charñ': 'charUTF',
      'char%C3%B1': 'charEscaped',
      'contacts': 'contacts',
      'contacts/new': 'newContact',
      'contacts/:id': 'loadContact',
      'route-event/:arg': 'routeEvent',
      'optional(/:item)': 'optionalItem',
      'named/optional/(y:z)': 'namedOptional',
      'splat/*args/end': 'splat',
      ':repo/compare/*from...*to': 'github',
      'decode/:named/*splat': 'decode',
      '*first/complex-*part/*rest': 'complex',
      'query/:entity': 'query',
      'function/:value': ExternalObject.routingFunction,
      '*anything': 'anything'
    },

    preinitialize: function(options) {
      this.testpreinit = 'foo';
    },

    initialize: function(options) {
      this.testing = options.testing;
      this.route('implicit', 'implicit');
    },

    counter: function() {
      this.count++;
    },

    implicit: function() {
      this.count++;
    },

    search: function(query, page) {
      this.query = query;
      this.page = page;
    },

    charUTF: function() {
      this.charType = 'UTF';
    },

    charEscaped: function() {
      this.charType = 'escaped';
    },

    contacts: function() {
      this.contact = 'index';
    },

    newContact: function() {
      this.contact = 'new';
    },

    loadContact: function() {
      this.contact = 'load';
    },

    optionalItem: function(arg) {
      this.arg = arg !== void 0 ? arg : null;
    },

    splat: function(args) {
      this.args = args;
    },

    github: function(repo, from, to) {
      this.repo = repo;
      this.from = from;
      this.to = to;
    },

    complex: function(first, part, rest) {
      this.first = first;
      this.part = part;
      this.rest = rest;
    },

    query: function(entity, args) {
      this.entity    = entity;
      this.queryArgs = args;
    },

    anything: function(whatever) {
      this.anything = whatever;
    },

    namedOptional: function(z) {
      this.z = z;
    },

    decode: function(named, path) {
      this.named = named;
      this.path = path;
    },

    routeEvent: function(arg) {
    }

  });

  QUnit.test('initialize', function(assert) {
    assert.expect(1);
    assert.equal(router.testing, 101);
  });

  QUnit.test('preinitialize', function(assert) {
    assert.expect(1);
    assert.equal(router.testpreinit, 'foo');
  });

  QUnit.test('routes (simple)', function(assert) {
    assert.expect(4);
    location.replace('http://example.com#search/news');
    Skeletor.history.checkUrl();
    assert.equal(router.query, 'news');
    assert.equal(router.page, void 0);
    assert.equal(lastRoute, 'search');
    assert.equal(lastArgs[0], 'news');
  });

  QUnit.test('routes (simple, but unicode)', function(assert) {
    assert.expect(4);
    location.replace('http://example.com#search/тест');
    Skeletor.history.checkUrl();
    assert.equal(router.query, 'тест');
    assert.equal(router.page, void 0);
    assert.equal(lastRoute, 'search');
    assert.equal(lastArgs[0], 'тест');
  });

  QUnit.test('routes (two part)', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#search/nyc/p10');
    Skeletor.history.checkUrl();
    assert.equal(router.query, 'nyc');
    assert.equal(router.page, '10');
  });

  QUnit.test('routes via navigate', function(assert) {
    assert.expect(2);
    Skeletor.history.navigate('search/manhattan/p20', {trigger: true});
    assert.equal(router.query, 'manhattan');
    assert.equal(router.page, '20');
  });

  QUnit.test('routes via navigate with params', function(assert) {
    assert.expect(1);
    Skeletor.history.navigate('query/test?a=b', {trigger: true});
    assert.equal(router.queryArgs, 'a=b');
  });

  QUnit.test('routes via navigate for backwards-compatibility', function(assert) {
    assert.expect(2);
    Skeletor.history.navigate('search/manhattan/p20', true);
    assert.equal(router.query, 'manhattan');
    assert.equal(router.page, '20');
  });

  QUnit.test('reports matched route via nagivate', function(assert) {
    assert.expect(1);
    assert.ok(Skeletor.history.navigate('search/manhattan/p20', true));
  });

  QUnit.test('route precedence via navigate', function(assert) {
    assert.expect(6);

    // Check both 0.9.x and backwards-compatibility options
    _.each([{trigger: true}, true], function(options) {
      Skeletor.history.navigate('contacts', options);
      assert.equal(router.contact, 'index');
      Skeletor.history.navigate('contacts/new', options);
      assert.equal(router.contact, 'new');
      Skeletor.history.navigate('contacts/foo', options);
      assert.equal(router.contact, 'load');
    });
  });

  QUnit.test('loadUrl is not called for identical routes.', function(assert) {
    assert.expect(0);
    Skeletor.history.loadUrl = function() { assert.ok(false); };
    location.replace('http://example.com#route');
    Skeletor.history.navigate('route');
    Skeletor.history.navigate('/route');
    Skeletor.history.navigate('/route');
  });

  QUnit.test('use implicit callback if none provided', function(assert) {
    assert.expect(1);
    router.count = 0;
    router.navigate('implicit', {trigger: true});
    assert.equal(router.count, 1);
  });

  QUnit.test('routes via navigate with {replace: true}', function(assert) {
    assert.expect(1);
    location.replace('http://example.com#start_here');
    Skeletor.history.checkUrl();
    location.replace = function(href) {
      assert.strictEqual(href, new Location('http://example.com#end_here').href);
    };
    Skeletor.history.navigate('end_here', {replace: true});
  });

  QUnit.test('routes (splats)', function(assert) {
    assert.expect(1);
    location.replace('http://example.com#splat/long-list/of/splatted_99args/end');
    Skeletor.history.checkUrl();
    assert.equal(router.args, 'long-list/of/splatted_99args');
  });

  QUnit.test('routes (github)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#backbone/compare/1.0...braddunbar:with/slash');
    Skeletor.history.checkUrl();
    assert.equal(router.repo, 'backbone');
    assert.equal(router.from, '1.0');
    assert.equal(router.to, 'braddunbar:with/slash');
  });

  QUnit.test('routes (optional)', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#optional');
    Skeletor.history.checkUrl();
    assert.ok(!router.arg);
    location.replace('http://example.com#optional/thing');
    Skeletor.history.checkUrl();
    assert.equal(router.arg, 'thing');
  });

  QUnit.test('routes (complex)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#one/two/three/complex-part/four/five/six/seven');
    Skeletor.history.checkUrl();
    assert.equal(router.first, 'one/two/three');
    assert.equal(router.part, 'part');
    assert.equal(router.rest, 'four/five/six/seven');
  });

  QUnit.test('routes (query)', function(assert) {
    assert.expect(5);
    location.replace('http://example.com#query/mandel?a=b&c=d');
    Skeletor.history.checkUrl();
    assert.equal(router.entity, 'mandel');
    assert.equal(router.queryArgs, 'a=b&c=d');
    assert.equal(lastRoute, 'query');
    assert.equal(lastArgs[0], 'mandel');
    assert.equal(lastArgs[1], 'a=b&c=d');
  });

  QUnit.test('routes (anything)', function(assert) {
    assert.expect(1);
    location.replace('http://example.com#doesnt-match-a-route');
    Skeletor.history.checkUrl();
    assert.equal(router.anything, 'doesnt-match-a-route');
  });

  QUnit.test('routes (function)', function(assert) {
    assert.expect(3);
    router.on('route', function(name) {
      assert.ok(name === '');
    });
    assert.equal(ExternalObject.value, 'unset');
    location.replace('http://example.com#function/set');
    Skeletor.history.checkUrl();
    assert.equal(ExternalObject.value, 'set');
  });

  QUnit.test('Decode named parameters, not splats.', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#decode/a%2Fb/c%2Fd/e');
    Skeletor.history.checkUrl();
    assert.strictEqual(router.named, 'a/b');
    assert.strictEqual(router.path, 'c/d/e');
  });

  QUnit.test('fires event when router doesn\'t have callback on it', function(assert) {
    assert.expect(1);
    router.on('route:noCallback', function() { assert.ok(true); });
    location.replace('http://example.com#noCallback');
    Skeletor.history.checkUrl();
  });

  QUnit.test('No events are triggered if #execute returns false.', function(assert) {
    assert.expect(1);
    var MyRouter = Skeletor.Router.extend({

      routes: {
        foo: function() {
          assert.ok(true);
        }
      },

      execute: function(callback, args) {
        callback.apply(this, args);
        return false;
      }

    });

    var myRouter = new MyRouter;

    myRouter.on('route route:foo', function() {
      assert.ok(false);
    });

    Skeletor.history.on('route', function() {
      assert.ok(false);
    });

    location.replace('http://example.com#foo');
    Skeletor.history.checkUrl();
  });

  QUnit.test('#933, #908 - leading slash', function(assert) {
    assert.expect(2);
    location.replace('http://example.com/root/foo');

    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({root: '/root', hashChange: false, silent: true});
    assert.strictEqual(Skeletor.history.getFragment(), 'foo');

    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({root: '/root/', hashChange: false, silent: true});
    assert.strictEqual(Skeletor.history.getFragment(), 'foo');
  });

  QUnit.test('#967 - Route callback gets passed encoded values.', function(assert) {
    assert.expect(3);
    var route = 'has%2Fslash/complex-has%23hash/has%20space';
    Skeletor.history.navigate(route, {trigger: true});
    assert.strictEqual(router.first, 'has/slash');
    assert.strictEqual(router.part, 'has#hash');
    assert.strictEqual(router.rest, 'has space');
  });

  QUnit.test('correctly handles URLs with % (#868)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#search/fat%3A1.5%25');
    Skeletor.history.checkUrl();
    location.replace('http://example.com#search/fat');
    Skeletor.history.checkUrl();
    assert.equal(router.query, 'fat');
    assert.equal(router.page, void 0);
    assert.equal(lastRoute, 'search');
  });

  QUnit.test('#2666 - Hashes with UTF8 in them.', function(assert) {
    assert.expect(2);
    Skeletor.history.navigate('charñ', {trigger: true});
    assert.equal(router.charType, 'UTF');
    Skeletor.history.navigate('char%C3%B1', {trigger: true});
    assert.equal(router.charType, 'UTF');
  });

  QUnit.test('#1185 - Use pathname when hashChange is not wanted.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/path/name#hash');
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({hashChange: false});
    var fragment = Skeletor.history.getFragment();
    assert.strictEqual(fragment, location.pathname.replace(/^\//, ''));
  });

  QUnit.test('#1206 - Strip leading slash before location.assign.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root/');
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({hashChange: false, root: '/root/'});
    location.assign = function(pathname) {
      assert.strictEqual(pathname, '/root/fragment');
    };
    Skeletor.history.navigate('/fragment');
  });

  QUnit.test('#1387 - Root fragment without trailing slash.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root');
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({hashChange: false, root: '/root/', silent: true});
    assert.strictEqual(Skeletor.history.getFragment(), '');
  });

  QUnit.test('#1366 - History does not prepend root to fragment.', function(assert) {
    assert.expect(2);
    Skeletor.history.stop();
    location.replace('http://example.com/root/');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root/x');
        }
      }
    });
    Skeletor.history.start({
      root: '/root/',
      pushState: true,
      hashChange: false
    });
    Skeletor.history.navigate('x');
    assert.strictEqual(Skeletor.history.fragment, 'x');
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root/fragment');
        }
      }
    });
    Skeletor.history.start({
      pushState: true,
      root: '/root',
      hashChange: false
    });
    Skeletor.history.navigate('fragment');
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root#fragment');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/fragment');
        }
      }
    });
    Skeletor.history.start({
      pushState: true,
      root: '/root'
    });
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root');
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.loadUrl = function() { assert.ok(true); };
    Skeletor.history.start({
      pushState: true,
      root: '/root'
    });
  });

  QUnit.test('Normalize root - leading slash.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() {}
      }
    });
    Skeletor.history.start({root: 'root'});
    assert.strictEqual(Skeletor.history.root, '/root/');
  });

  QUnit.test('Transition from hashChange to pushState.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root#x/y');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/x/y');
        }
      }
    });
    Skeletor.history.start({
      root: 'root',
      pushState: true
    });
  });

  QUnit.test('#1619: Router: Normalize empty root', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() {}
      }
    });
    Skeletor.history.start({root: ''});
    assert.strictEqual(Skeletor.history.root, '/');
  });

  QUnit.test('#1619: Router: nagivate with empty root', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/fragment');
        }
      }
    });
    Skeletor.history.start({
      pushState: true,
      root: '',
      hashChange: false
    });
    Skeletor.history.navigate('fragment');
  });

  QUnit.test('Transition from pushState to hashChange.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root/x/y?a=b');
    location.replace = function(url) {
      assert.strictEqual(url, '/root#x/y?a=b');
    };
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: null,
        replaceState: null
      }
    });
    Skeletor.history.start({
      root: 'root',
      pushState: true
    });
  });

  QUnit.test('#1695 - hashChange to pushState with search.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root#x/y?a=b');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/x/y?a=b');
        }
      }
    });
    Skeletor.history.start({
      root: 'root',
      pushState: true
    });
  });

  QUnit.test('#1746 - Router allows empty route.', function(assert) {
    assert.expect(1);
    var MyRouter = Skeletor.Router.extend({
      routes: {'': 'empty'},
      empty: function() {},
      route: function(route) {
        assert.strictEqual(route, '');
      }
    });
    new MyRouter;
  });

  QUnit.test('#1794 - Trailing space in fragments.', function(assert) {
    assert.expect(1);
    var history = new Skeletor.History;
    assert.strictEqual(history.getFragment('fragment   '), 'fragment');
  });

  QUnit.test('#1820 - Leading slash and trailing space.', function(assert) {
    assert.expect(1);
    var history = new Skeletor.History;
    assert.strictEqual(history.getFragment('/fragment '), 'fragment');
  });

  QUnit.test('#1980 - Optional parameters.', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#named/optional/y');
    Skeletor.history.checkUrl();
    assert.strictEqual(router.z, undefined);
    location.replace('http://example.com#named/optional/y123');
    Skeletor.history.checkUrl();
    assert.strictEqual(router.z, '123');
  });

  QUnit.test('#2062 - Trigger "route" event on router instance.', function(assert) {
    assert.expect(2);
    router.on('route', function(name, args) {
      assert.strictEqual(name, 'routeEvent');
      assert.deepEqual(args, ['x', null]);
    });
    location.replace('http://example.com#route-event/x');
    Skeletor.history.checkUrl();
  });

  QUnit.test('#2255 - Extend routes by making routes a function.', function(assert) {
    assert.expect(1);
    var RouterBase = Skeletor.Router.extend({
      routes: function() {
        return {
          home: 'root',
          index: 'index.html'
        };
      }
    });

    var RouterExtended = RouterBase.extend({
      routes: function() {
        var _super = RouterExtended.__super__.routes;
        return _.extend(_super(), {show: 'show', search: 'search'});
      }
    });

    var myRouter = new RouterExtended();
    assert.deepEqual({home: 'root', index: 'index.html', show: 'show', search: 'search'}, myRouter.routes);
  });

  QUnit.test('#2538 - hashChange to pushState only if both requested.', function(assert) {
    assert.expect(0);
    Skeletor.history.stop();
    location.replace('http://example.com/root?a=b#x/y');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() { assert.ok(false); }
      }
    });
    Skeletor.history.start({
      root: 'root',
      pushState: true,
      hashChange: false
    });
  });

  QUnit.test('No hash fallback.', function(assert) {
    assert.expect(0);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() {}
      }
    });

    var MyRouter = Skeletor.Router.extend({
      routes: {
        hash: function() { assert.ok(false); }
      }
    });
    var myRouter = new MyRouter;

    location.replace('http://example.com/');
    Skeletor.history.start({
      pushState: true,
      hashChange: false
    });
    location.replace('http://example.com/nomatch#hash');
    Skeletor.history.checkUrl();
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root');
        }
      }
    });
    location.replace('http://example.com/root/path');
    Skeletor.history.start({pushState: true, hashChange: false, root: 'root'});
    Skeletor.history.navigate('');
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/');
        }
      }
    });
    location.replace('http://example.com/path');
    Skeletor.history.start({pushState: true, hashChange: false});
    Skeletor.history.navigate('');
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root?x=1');
        }
      }
    });
    location.replace('http://example.com/root/path');
    Skeletor.history.start({pushState: true, hashChange: false, root: 'root'});
    Skeletor.history.navigate('?x=1');
  });

  QUnit.test('#2765 - Fragment matching sans query/hash.', function(assert) {
    assert.expect(2);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/path?query#hash');
        }
      }
    });

    var MyRouter = Skeletor.Router.extend({
      routes: {
        path: function() { assert.ok(true); }
      }
    });
    var myRouter = new MyRouter;

    location.replace('http://example.com/');
    Skeletor.history.start({pushState: true, hashChange: false});
    Skeletor.history.navigate('path?query#hash', true);
  });

  QUnit.test('Do not decode the search params.', function(assert) {
    assert.expect(1);
    var MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y%3Fz');
        }
      }
    });
    var myRouter = new MyRouter;
    Skeletor.history.navigate('path?x=y%3Fz', true);
  });

  QUnit.test('Navigate to a hash url.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({pushState: true});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y');
        }
      }
    });
    var myRouter = new MyRouter;
    location.replace('http://example.com/path?x=y#hash');
    Skeletor.history.checkUrl();
  });

  QUnit.test('#navigate to a hash url.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    Skeletor.history.start({pushState: true});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y');
        }
      }
    });
    var myRouter = new MyRouter;
    Skeletor.history.navigate('path?x=y#hash', true);
  });

  QUnit.test('unicode pathname', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/myyjä');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        myyjä: function() {
          assert.ok(true);
        }
      }
    });
    new MyRouter;
    Skeletor.history.start({pushState: true});
  });

  QUnit.test('unicode pathname with % in a parameter', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/myyjä/foo%20%25%3F%2f%40%25%20bar');
    location.pathname = '/myyj%C3%A4/foo%20%25%3F%2f%40%25%20bar';
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        'myyjä/:query': function(query) {
          assert.strictEqual(query, 'foo %?/@% bar');
        }
      }
    });
    new MyRouter;
    Skeletor.history.start({pushState: true});
  });

  QUnit.test('newline in route', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/stuff%0Anonsense?param=foo%0Abar');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        'stuff\nnonsense': function() {
          assert.ok(true);
        }
      }
    });
    new MyRouter;
    Skeletor.history.start({pushState: true});
  });

  QUnit.test('Router#execute receives callback, args, name.', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#foo/123/bar?x=y');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {'foo/:id/bar': 'foo'},
      foo: function() {},
      execute: function(callback, args, name) {
        assert.strictEqual(callback, this.foo);
        assert.deepEqual(args, ['123', 'x=y']);
        assert.strictEqual(name, 'foo');
      }
    });
    var myRouter = new MyRouter;
    Skeletor.history.start();
  });

  QUnit.test('pushState to hashChange with only search params.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com?a=b');
    location.replace = function(url) {
      assert.strictEqual(url, '/#?a=b');
    };
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: null
    });
    Skeletor.history.start({pushState: true});
  });

  QUnit.test('#3123 - History#navigate decodes before comparison.', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/shop/search?keyword=short%20dress');
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: function() { assert.ok(false); },
        replaceState: function() { assert.ok(false); }
      }
    });
    Skeletor.history.start({pushState: true});
    Skeletor.history.navigate('shop/search?keyword=short%20dress', true);
    assert.strictEqual(Skeletor.history.fragment, 'shop/search?keyword=short dress');
  });

  QUnit.test('#3175 - Urls in the params', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com#login?a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var myRouter = new Skeletor.Router;
    myRouter.route('login', function(params) {
      assert.strictEqual(params, 'a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
    });
    Skeletor.history.start();
  });

  QUnit.test('#3358 - pushState to hashChange transition with search params', function(assert) {
    assert.expect(1);
    Skeletor.history.stop();
    location.replace('http://example.com/root?foo=bar');
    location.replace = function(url) {
      assert.strictEqual(url, '/root#?foo=bar');
    };
    Skeletor.history = _.extend(new Skeletor.History, {
      location: location,
      history: {
        pushState: undefined,
        replaceState: undefined
      }
    });
    Skeletor.history.start({root: '/root', pushState: true});
  });

  QUnit.test('Paths that don\'t match the root should not match no root', function(assert) {
    assert.expect(0);
    location.replace('http://example.com/foo');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        foo: function() {
          assert.ok(false, 'should not match unless root matches');
        }
      }
    });
    var myRouter = new MyRouter;
    Skeletor.history.start({root: 'root', pushState: true});
  });

  QUnit.test('Paths that don\'t match the root should not match roots of the same length', function(assert) {
    assert.expect(0);
    location.replace('http://example.com/xxxx/foo');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {
        foo: function() {
          assert.ok(false, 'should not match unless root matches');
        }
      }
    });
    var myRouter = new MyRouter;
    Skeletor.history.start({root: 'root', pushState: true});
  });

  QUnit.test('roots with regex characters', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/x+y.z/foo');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {foo: function() { assert.ok(true); }}
    });
    var myRouter = new MyRouter;
    Skeletor.history.start({root: 'x+y.z', pushState: true});
  });

  QUnit.test('roots with unicode characters', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/®ooτ/foo');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {foo: function() { assert.ok(true); }}
    });
    var myRouter = new MyRouter;
    Skeletor.history.start({root: '®ooτ', pushState: true});
  });

  QUnit.test('roots without slash', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/®ooτ');
    Skeletor.history.stop();
    Skeletor.history = _.extend(new Skeletor.History, {location: location});
    var MyRouter = Skeletor.Router.extend({
      routes: {'': function() { assert.ok(true); }}
    });
    var myRouter = new MyRouter;
    Skeletor.history.start({root: '®ooτ', pushState: true});
  });

  QUnit.test('#4025 - navigate updates URL hash as is', function(assert) {
    assert.expect(1);
    var route = 'search/has%20space';
    Skeletor.history.navigate(route);
    assert.strictEqual(location.hash, '#' + route);
  });

})(QUnit);
