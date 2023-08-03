//     (c) 2010-2019 Jeremy Ashkenas and DocumentCloud

import create from 'lodash-es/create.js';
import extend from 'lodash-es/extend.js';
import has from 'lodash-es/has.js';
import result from 'lodash-es/result.js';

/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
export class NotImplementedError extends Error {}

function S4() {
  // Generate four random hex digits.
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

export function guid() {
  // Generate a pseudo-GUID by concatenating random hexadecimal.
  return S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4();
}

// Helpers
// -------

// Helper function to correctly set up the prototype chain for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
//
export function inherits(protoProps, staticProps) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const parent = this;
  let child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function () {
      return parent.apply(this, arguments);
    };
  }

  // Add static properties to the constructor function, if supplied.
  extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.
  child.prototype = create(parent.prototype, protoProps);
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
}

export function getResolveablePromise() {
  /**
   * @typedef {Object} PromiseWrapper
   * @property {boolean} isResolved
   * @property {boolean} isPending
   * @property {boolean} isRejected
   * @property {Function} resolve
   * @property {Function} reject
   */

  /** @type {PromiseWrapper} */
  const wrapper = {
    isResolved: false,
    isPending: true,
    isRejected: false,
    resolve: null,
    reject: null,
  };

  /**
   * @typedef {Promise & PromiseWrapper} ResolveablePromise
   */

  const promise = /** @type {ResolveablePromise} */ (
    new Promise((resolve, reject) => {
      wrapper.resolve = resolve;
      wrapper.reject = reject;
    })
  );
  Object.assign(promise, wrapper);
  promise.then(
    function (v) {
      promise.isResolved = true;
      promise.isPending = false;
      promise.isRejected = false;
      return v;
    },
    function (e) {
      promise.isResolved = false;
      promise.isPending = false;
      promise.isRejected = true;
      throw e;
    },
  );
  return promise;
}

// Throw an error when a URL is needed, and none is supplied.
export function urlError() {
  throw new Error('A "url" property or function must be specified');
}

// Wrap an optional error callback with a fallback error event.
export function wrapError(model, options) {
  const error = options.error;
  options.error = function (resp) {
    if (error) error.call(options.context, model, resp, options);
    model.trigger('error', model, resp, options);
  };
}

// Map from CRUD to HTTP for our default `sync` implementation.
const methodMap = {
  create: 'POST',
  update: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  read: 'GET',
};

/**
 * @typedef {import('./model.js').Model} Model
 * @typedef {import('./collection.js').Collection} Collection
 */


/**
 * @param {Model | Collection} model
 */
export function getSyncMethod(model) {
  const store = result(model, 'browserStorage') || result(/** @type {Model} */(model).collection, 'browserStorage');
  return store ? store.sync() : sync;
}

/**
 * @typedef {Object} SyncOptions
 * @property {string} [url]
 * @property {any} [data]
 * @property {any} [attrs]
 * @property {Function} [success]
 * @property {Function} [error]
 * @property {any} [xhr]
 */

/**
 * Override this function to change the manner in which Backbone persists
 * models to the server. You will be passed the type of request, and the
 * model in question. By default makes a `fetch()` API call
 * to the model's `url()`.
 *
 * Some possible customizations could be:
 *
 * - Use `setTimeout` to batch rapid-fire updates into a single request.
 * - Persist models via WebSockets instead of Ajax.
 * - Persist models to browser storage
 *
 * @param {'create'|'update'|'patch'} method
 * @param {import('./model.js').Model} model
 * @param {SyncOptions} [options]
 */
export function sync(method, model, options = {}) {
  let data = options.data;

  // Ensure that we have the appropriate request data.
  if (data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
    data = options.attrs || model.toJSON();
  }

  const type = methodMap[method];
  const params = {
    method: type,
    body: data ? JSON.stringify(data) : '',
    success: options.success,
    error: options.error,
  };

  const url = options.url || result(model, 'url') || urlError();
  const xhr = (options.xhr = fetch(url, params));
  model.trigger('request', model, xhr, { ...params, xhr });
  return xhr;
}
