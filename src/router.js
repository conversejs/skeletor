import History from './history.js';
import keys from 'lodash-es/keys.js';
import result from 'lodash-es/result.js';
import EventEmitter from './eventemitter.js';

// Cached regular expressions for matching named param parts and splatted
// parts of route strings.
const optionalParam = /\((.*?)\)/g;
const namedParam = /(\(\?)?:\w+/g;
const splatParam = /\*\w+/g;
const escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;

class Router extends EventEmitter {
  constructor(options = {}) {
    super();
    this.history = options.history || new History();
    this.preinitialize.apply(this, arguments);
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  }

  /**
   * preinitialize is an empty function by default. You can override it with a function
   * or object.  preinitialize will run before any instantiation logic is run in the Router.
   */
  preinitialize() {}

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  initialize() {}

  /**
   * Manually bind a single named route to a callback. For example:
   *
   *     this.route('search/:query/p:num', 'search', function(query, num) {
   *       ...
   *     });
   *
   * @param {RegExp|string} route
   * @param {string|Function} name
   * @param {Function} [callback]
   */
  route(route, name, callback) {
    const routeRegex = (route instanceof RegExp) ? route : this._routeToRegExp(route);
    if (typeof name === 'function') {
      callback = name;
      name = '';
    }
    if (!callback) callback = this[name];
    this.history.route(routeRegex, (fragment) => {
      const args = this._extractParameters(routeRegex, fragment);
      if (this.execute(callback, args, /** @type {string} */(name)) !== false) {
        this.trigger.apply(this, ['route:' + name].concat(args));
        this.trigger('route', name, args);
        this.history.trigger('route', this, name, args);
      }
    });
    return this;
  }

  /**
   * Execute a route handler with the provided parameters.  This is an
   * excellent place to do pre-route setup or post-route cleanup.
   * @param {Function} callback
   * @param {any[]} args
   * @param {string} [name]
   * @returns {boolean|void}
   */
  execute(callback, args, name) {
    if (callback) callback.apply(this, args);
  }

  /**
   * Simple proxy to `history` to save a fragment into the history.
   * @param {string} fragment
   * @param {Record<string, any>} [options]
   */
  navigate(fragment, options) {
    this.history.navigate(fragment, options);
    return this;
  }

  /*
   * Bind all defined routes to `history`. We have to reverse the
   * order of the routes here to support behavior where the most general
   * routes can be defined at the bottom of the route map.
   */
  _bindRoutes() {
    if (!this.routes) return;
    this.routes = result(this, 'routes');
    let route;
    const routes = keys(this.routes);
    while ((route = routes.pop()) != null) {
      this.route(route, this.routes[route]);
    }
  }

  /**
   * Convert a route string into a regular expression, suitable for matching
   * against the current location hash.
   * @param {string} route
   */
  _routeToRegExp(route) {
    route = route
      .replace(escapeRegExp, '\\$&')
      .replace(optionalParam, '(?:$1)?')
      .replace(namedParam, function (match, optional) {
        return optional ? match : '([^/?]+)';
      })
      .replace(splatParam, '([^?]*?)');
    return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
  }

  /**
   * Given a route, and a URL fragment that it matches, return the array of
   * extracted decoded parameters. Empty or unmatched parameters will be
   * treated as `null` to normalize cross-browser behavior.
   * @param {RegExp} route
   * @param {string} fragment
   */
  _extractParameters(route, fragment) {
    const params = route.exec(fragment).slice(1);
    return params.map(function (param, i) {
      // Don't decode the search params.
      if (i === params.length - 1) return param || null;
      return param ? decodeURIComponent(param) : null;
    });
  }
}

export default Router;
