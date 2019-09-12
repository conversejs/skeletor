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
      if (!(/^\//).test(this.pathname)) this.pathname = '/' + this.pathname;
    },

    toString: function() {
      return this.href;
    }

  });

  QUnit.module('Skeletor.Router', {

    beforeEach: function() {
      location = new Location('http://example.com');
      const history = _.extend(new Skeletor.History(), {location: location});
      history.interval = 9;
      history.start({pushState: false});
      router = new Router({testing: 101, history});
      lastRoute = null;
      lastArgs = [];
      router.history.on('route', onRoute);
    },

    afterEach: function() {
      router.history.stop();
      router.history.off('route', onRoute);
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
      this.arg = arg !== undefined ? arg : null;
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
    router.history.checkUrl();
    assert.equal(router.query, 'news');
    assert.equal(router.page, undefined);
    assert.equal(lastRoute, 'search');
    assert.equal(lastArgs[0], 'news');
  });

  QUnit.test('routes (simple, but unicode)', function(assert) {
    assert.expect(4);
    location.replace('http://example.com#search/тест');
    router.history.checkUrl();
    assert.equal(router.query, 'тест');
    assert.equal(router.page, undefined);
    assert.equal(lastRoute, 'search');
    assert.equal(lastArgs[0], 'тест');
  });

  QUnit.test('routes (two part)', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#search/nyc/p10');
    router.history.checkUrl();
    assert.equal(router.query, 'nyc');
    assert.equal(router.page, '10');
  });

  QUnit.test('routes via navigate', function(assert) {
    assert.expect(2);
    router.history.navigate('search/manhattan/p20', {trigger: true});
    assert.equal(router.query, 'manhattan');
    assert.equal(router.page, '20');
  });

  QUnit.test('routes via navigate with params', function(assert) {
    assert.expect(1);
    router.history.navigate('query/test?a=b', {trigger: true});
    assert.equal(router.queryArgs, 'a=b');
  });

  QUnit.test('routes via navigate for backwards-compatibility', function(assert) {
    assert.expect(2);
    router.history.navigate('search/manhattan/p20', true);
    assert.equal(router.query, 'manhattan');
    assert.equal(router.page, '20');
  });

  QUnit.test('reports matched route via nagivate', function(assert) {
    assert.expect(1);
    assert.ok(router.history.navigate('search/manhattan/p20', true));
  });

  QUnit.test('route precedence via navigate', function(assert) {
    assert.expect(6);

    // Check both 0.9.x and backwards-compatibility options
    _.each([{trigger: true}, true], function(options) {
      router.history.navigate('contacts', options);
      assert.equal(router.contact, 'index');
      router.history.navigate('contacts/new', options);
      assert.equal(router.contact, 'new');
      router.history.navigate('contacts/foo', options);
      assert.equal(router.contact, 'load');
    });
  });

  QUnit.test('loadUrl is not called for identical routes.', function(assert) {
    assert.expect(0);
    router.history.loadUrl = function() { assert.ok(false); };
    location.replace('http://example.com#route');
    router.history.navigate('route');
    router.history.navigate('/route');
    router.history.navigate('/route');
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
    router.history.checkUrl();
    location.replace = function(href) {
      assert.strictEqual(href, new Location('http://example.com#end_here').href);
    };
    router.history.navigate('end_here', {replace: true});
  });

  QUnit.test('routes (splats)', function(assert) {
    assert.expect(1);
    location.replace('http://example.com#splat/long-list/of/splatted_99args/end');
    router.history.checkUrl();
    assert.equal(router.args, 'long-list/of/splatted_99args');
  });

  QUnit.test('routes (github)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#backbone/compare/1.0...braddunbar:with/slash');
    router.history.checkUrl();
    assert.equal(router.repo, 'backbone');
    assert.equal(router.from, '1.0');
    assert.equal(router.to, 'braddunbar:with/slash');
  });

  QUnit.test('routes (optional)', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#optional');
    router.history.checkUrl();
    assert.ok(!router.arg);
    location.replace('http://example.com#optional/thing');
    router.history.checkUrl();
    assert.equal(router.arg, 'thing');
  });

  QUnit.test('routes (complex)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#one/two/three/complex-part/four/five/six/seven');
    router.history.checkUrl();
    assert.equal(router.first, 'one/two/three');
    assert.equal(router.part, 'part');
    assert.equal(router.rest, 'four/five/six/seven');
  });

  QUnit.test('routes (query)', function(assert) {
    assert.expect(5);
    location.replace('http://example.com#query/mandel?a=b&c=d');
    router.history.checkUrl();
    assert.equal(router.entity, 'mandel');
    assert.equal(router.queryArgs, 'a=b&c=d');
    assert.equal(lastRoute, 'query');
    assert.equal(lastArgs[0], 'mandel');
    assert.equal(lastArgs[1], 'a=b&c=d');
  });

  QUnit.test('routes (anything)', function(assert) {
    assert.expect(1);
    location.replace('http://example.com#doesnt-match-a-route');
    router.history.checkUrl();
    assert.equal(router.anything, 'doesnt-match-a-route');
  });

  QUnit.test('routes (function)', function(assert) {
    assert.expect(3);
    router.on('route', function(name) {
      assert.ok(name === '');
    });
    assert.equal(ExternalObject.value, 'unset');
    location.replace('http://example.com#function/set');
    router.history.checkUrl();
    assert.equal(ExternalObject.value, 'set');
  });

  QUnit.test('Decode named parameters, not splats.', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#decode/a%2Fb/c%2Fd/e');
    router.history.checkUrl();
    assert.strictEqual(router.named, 'a/b');
    assert.strictEqual(router.path, 'c/d/e');
  });

  QUnit.test('fires event when router doesn\'t have callback on it', function(assert) {
    assert.expect(1);
    router.on('route:noCallback', function() { assert.ok(true); });
    location.replace('http://example.com#noCallback');
    router.history.checkUrl();
  });

  QUnit.test('No events are triggered if #execute returns false.', function(assert) {
    assert.expect(1);
    const MyRouter = Skeletor.Router.extend({
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

    const history = _.extend(router.history, {location: location});
    const myRouter = new MyRouter({history});

    myRouter.on('route route:foo', function() {
      assert.ok(false);
    });

    myRouter.history.on('route', function() {
      assert.ok(false);
    });

    location.replace('http://example.com#foo');
    myRouter.history.checkUrl();
  });

  QUnit.test('#933, #908 - leading slash', function(assert) {
    assert.expect(2);
    location.replace('http://example.com/root/foo');

    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.start({root: '/root', hashChange: false, silent: true});
    assert.strictEqual(router.history.getFragment(), 'foo');

    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.start({root: '/root/', hashChange: false, silent: true});
    assert.strictEqual(router.history.getFragment(), 'foo');
  });

  QUnit.test('#967 - Route callback gets passed encoded values.', function(assert) {
    assert.expect(3);
    var route = 'has%2Fslash/complex-has%23hash/has%20space';
    router.history.navigate(route, {trigger: true});
    assert.strictEqual(router.first, 'has/slash');
    assert.strictEqual(router.part, 'has#hash');
    assert.strictEqual(router.rest, 'has space');
  });

  QUnit.test('correctly handles URLs with % (#868)', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#search/fat%3A1.5%25');
    router.history.checkUrl();
    location.replace('http://example.com#search/fat');
    router.history.checkUrl();
    assert.equal(router.query, 'fat');
    assert.equal(router.page, undefined);
    assert.equal(lastRoute, 'search');
  });

  QUnit.test('#2666 - Hashes with UTF8 in them.', function(assert) {
    assert.expect(2);
    router.history.navigate('charñ', {trigger: true});
    assert.equal(router.charType, 'UTF');
    router.history.navigate('char%C3%B1', {trigger: true});
    assert.equal(router.charType, 'UTF');
  });

  QUnit.test('#1185 - Use pathname when hashChange is not wanted.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/path/name#hash');
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.start({hashChange: false});
    var fragment = router.history.getFragment();
    assert.strictEqual(fragment, location.pathname.replace(/^\//, ''));
  });

  QUnit.test('#1206 - Strip leading slash before location.assign.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root/');
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.start({hashChange: false, root: '/root/'});
    location.assign = function(pathname) {
      assert.strictEqual(pathname, '/root/fragment');
    };
    router.history.navigate('/fragment');
  });

  QUnit.test('#1387 - Root fragment without trailing slash.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root');
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.start({hashChange: false, root: '/root/', silent: true});
    assert.strictEqual(router.history.getFragment(), '');
  });

  QUnit.test('#1366 - History does not prepend root to fragment.', function(assert) {
    assert.expect(2);
    router.history.stop();
    location.replace('http://example.com/root/');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root/x');
        }
      }
    });
    router.history.start({
      root: '/root/',
      pushState: true,
      hashChange: false
    });
    router.history.navigate('x');
    assert.strictEqual(router.history.fragment, 'x');
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root/fragment');
        }
      }
    });
    router.history.start({
      pushState: true,
      root: '/root',
      hashChange: false
    });
    router.history.navigate('fragment');
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root#fragment');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/fragment');
        }
      }
    });
    router.history.start({
      pushState: true,
      root: '/root'
    });
  });

  QUnit.test('Normalize root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root');
    router.history = _.extend(new Skeletor.History(), {location: location});
    router.history.loadUrl = function() { assert.ok(true); };
    router.history.start({
      pushState: true,
      root: '/root'
    });
  });

  QUnit.test('Normalize root - leading slash.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() {}
      }
    });
    router.history.start({root: 'root'});
    assert.strictEqual(router.history.root, '/root/');
  });

  QUnit.test('Transition from hashChange to pushState.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root#x/y');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/x/y');
        }
      }
    });
    router.history.start({
      root: 'root',
      pushState: true
    });
  });

  QUnit.test('#1619: Router: Normalize empty root', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() {}
      }
    });
    router.history.start({root: ''});
    assert.strictEqual(router.history.root, '/');
  });

  QUnit.test('#1619: Router: nagivate with empty root', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/fragment');
        }
      }
    });
    router.history.start({
      pushState: true,
      root: '',
      hashChange: false
    });
    router.history.navigate('fragment');
  });

  QUnit.test('Transition from pushState to hashChange.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root/x/y?a=b');
    location.replace = function(url) {
      assert.strictEqual(url, '/root#x/y?a=b');
    };
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: null,
        replaceState: null
      }
    });
    router.history.start({
      root: 'root',
      pushState: true
    });
  });

  QUnit.test('#1695 - hashChange to pushState with search.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root#x/y?a=b');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function(state, title, url) {
          assert.strictEqual(url, '/root/x/y?a=b');
        }
      }
    });
    router.history.start({
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
    new MyRouter();
  });

  QUnit.test('#1794 - Trailing space in fragments.', function(assert) {
    assert.expect(1);
    var history = new Skeletor.History();
    assert.strictEqual(history.getFragment('fragment   '), 'fragment');
  });

  QUnit.test('#1820 - Leading slash and trailing space.', function(assert) {
    assert.expect(1);
    var history = new Skeletor.History();
    assert.strictEqual(history.getFragment('/fragment '), 'fragment');
  });

  QUnit.test('#1980 - Optional parameters.', function(assert) {
    assert.expect(2);
    location.replace('http://example.com#named/optional/y');
    router.history.checkUrl();
    assert.strictEqual(router.z, undefined);
    location.replace('http://example.com#named/optional/y123');
    router.history.checkUrl();
    assert.strictEqual(router.z, '123');
  });

  QUnit.test('#2062 - Trigger "route" event on router instance.', function(assert) {
    assert.expect(2);
    router.on('route', function(name, args) {
      assert.strictEqual(name, 'routeEvent');
      assert.deepEqual(args, ['x', null]);
    });
    location.replace('http://example.com#route-event/x');
    router.history.checkUrl();
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
    router.history.stop();
    location.replace('http://example.com/root?a=b#x/y');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() {},
        replaceState: function() { assert.ok(false); }
      }
    });
    router.history.start({
      root: 'root',
      pushState: true,
      hashChange: false
    });
  });

  QUnit.test('No hash fallback.', function(assert) {
    assert.expect(0);
    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {
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
    var myRouter = new MyRouter();

    location.replace('http://example.com/');
    router.history.start({
      pushState: true,
      hashChange: false
    });
    location.replace('http://example.com/nomatch#hash');
    router.history.checkUrl();
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root');
        }
      }
    });
    location.replace('http://example.com/root/path');
    router.history.start({pushState: true, hashChange: false, root: 'root'});
    router.history.navigate('');
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/');
        }
      }
    });
    location.replace('http://example.com/path');
    router.history.start({pushState: true, hashChange: false});
    router.history.navigate('');
  });

  QUnit.test('#2656 - No trailing slash on root.', function(assert) {
    assert.expect(1);
    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/root?x=1');
        }
      }
    });
    location.replace('http://example.com/root/path');
    router.history.start({pushState: true, hashChange: false, root: 'root'});
    router.history.navigate('?x=1');
  });

  QUnit.test('#2765 - Fragment matching sans query/hash.', function(assert) {
    assert.expect(2);
    router.history.stop();
    const history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function(state, title, url) {
          assert.strictEqual(url, '/path?query#hash');
        }
      }
    });
    const MyRouter = Skeletor.Router.extend({
      routes: {
        path: function() { assert.ok(true); }
      }
    });
    const myRouter = new MyRouter({history});

    location.replace('http://example.com/');
    myRouter.history.start({pushState: true, hashChange: false});
    myRouter.history.navigate('path?query#hash', true);
  });

  QUnit.test('Do not decode the search params.', function(assert) {
    assert.expect(1);
    const MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y%3Fz');
        }
      }
    });
    const myRouter = new MyRouter({history: router.history});
    myRouter.history.navigate('path?x=y%3Fz', true);
  });

  QUnit.test('Navigate to a hash url.', function(assert) {
    assert.expect(1);
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y');
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    history.start({pushState: true});
    const myRouter = new MyRouter({history});
    location.replace('http://example.com/path?x=y#hash');
    myRouter.history.checkUrl();
  });

  QUnit.test('#navigate to a hash url.', function(assert) {
    assert.expect(1);
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        path: function(params) {
          assert.strictEqual(params, 'x=y');
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    history.start({pushState: true});
    const myRouter = new MyRouter({history});
    myRouter.history.navigate('path?x=y#hash', true);
  });

  QUnit.test('unicode pathname', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/myyjä');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        myyjä: function() {
          assert.ok(true);
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({pushState: true});
  });

  QUnit.test('unicode pathname with % in a parameter', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/myyjä/foo%20%25%3F%2f%40%25%20bar');
    location.pathname = '/myyj%C3%A4/foo%20%25%3F%2f%40%25%20bar';
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        'myyjä/:query': function(query) {
          assert.strictEqual(query, 'foo %?/@% bar');
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({pushState: true});
  });

  QUnit.test('newline in route', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/stuff%0Anonsense?param=foo%0Abar');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        'stuff\nnonsense': function() {
          assert.ok(true);
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({pushState: true});
  });

  QUnit.test('Router#execute receives callback, args, name.', function(assert) {
    assert.expect(3);
    location.replace('http://example.com#foo/123/bar?x=y');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {'foo/:id/bar': 'foo'},
      foo: function() {},
      execute: function(callback, args, name) {
        assert.strictEqual(callback, this.foo);
        assert.deepEqual(args, ['123', 'x=y']);
        assert.strictEqual(name, 'foo');
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start();
  });

  QUnit.test('pushState to hashChange with only search params.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com?a=b');
    location.replace = function(url) {
      assert.strictEqual(url, '/#?a=b');
    };
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: null
    });
    router.history.start({pushState: true});
  });

  QUnit.test('#3123 - History#navigate decodes before comparison.', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/shop/search?keyword=short%20dress');
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: function() { assert.ok(false); },
        replaceState: function() { assert.ok(false); }
      }
    });
    router.history.start({pushState: true});
    router.history.navigate('shop/search?keyword=short%20dress', true);
    assert.strictEqual(router.history.fragment, 'shop/search?keyword=short dress');
  });

  QUnit.test('#3175 - Urls in the params', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com#login?a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new Skeletor.Router({history});
    myRouter.route('login', function(params) {
      assert.strictEqual(params, 'a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
    });
    myRouter.history.start();
  });

  QUnit.test('#3358 - pushState to hashChange transition with search params', function(assert) {
    assert.expect(1);
    router.history.stop();
    location.replace('http://example.com/root?foo=bar');
    location.replace = function(url) {
      assert.strictEqual(url, '/root#?foo=bar');
    };
    router.history = _.extend(new Skeletor.History(), {
      location: location,
      history: {
        pushState: undefined,
        replaceState: undefined
      }
    });
    router.history.start({root: '/root', pushState: true});
  });

  QUnit.test('Paths that don\'t match the root should not match no root', function(assert) {
    assert.expect(0);
    location.replace('http://example.com/foo');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {
        foo: function() {
          assert.ok(false, 'should not match unless root matches');
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({root: 'root', pushState: true});
  });

  QUnit.test('Paths that don\'t match the root should not match roots of the same length', function(assert) {
    assert.expect(0);
    location.replace('http://example.com/xxxx/foo');
    router.history.stop();
    router.history = _.extend(new Skeletor.History(), {location: location});
    const MyRouter = Skeletor.Router.extend({
      routes: {
        foo: function() {
          assert.ok(false, 'should not match unless root matches');
        }
      }
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({root: 'root', pushState: true});
  });

  QUnit.test('roots with regex characters', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/x+y.z/foo');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {foo: function() { assert.ok(true); }}
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({root: 'x+y.z', pushState: true});
  });

  QUnit.test('roots with unicode characters', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/®ooτ/foo');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {foo: function() { assert.ok(true); }}
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({root: '®ooτ', pushState: true});
  });

  QUnit.test('roots without slash', function(assert) {
    assert.expect(1);
    location.replace('http://example.com/®ooτ');
    router.history.stop();
    const MyRouter = Skeletor.Router.extend({
      routes: {'': function() { assert.ok(true); }}
    });
    const history = _.extend(new Skeletor.History(), {location: location});
    const myRouter = new MyRouter({history});
    myRouter.history.start({root: '®ooτ', pushState: true});
  });

  QUnit.test('#4025 - navigate updates URL hash as is', function(assert) {
    assert.expect(1);
    const route = 'search/has%20space';
    router.history.navigate(route);
    assert.strictEqual(location.hash, '#' + route);
  });

})(QUnit);
