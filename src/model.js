//     Backbone.js 1.4.0
//     (c) 2010-2019 Jeremy Ashkenas and DocumentCloud
//     Backbone may be freely distributed under the MIT license.

// Model
// -----
// **Models** are the basic data object in the framework --
// frequently representing a row in a table in a database on your server.
// A discrete chunk of data and a bunch of useful, related methods for
// performing computations and transformations on that data.

// Create a new model with the specified attributes. A client id (`cid`)
// is automatically generated and assigned for you.

import { getResolveablePromise, getSyncMethod, urlError, wrapError } from './helpers.js';
import { Events } from './events.js';
import clone from 'lodash-es/clone.js';
import defaults from 'lodash-es/defaults.js';
import defer from 'lodash-es/defer.js';
import escape from 'lodash-es/escape.js';
import extend from 'lodash-es/extend.js';
import has from 'lodash-es/has.js';
import invert from 'lodash-es/invert.js';
import isEmpty from 'lodash-es/isEmpty.js';
import isEqual from 'lodash-es/isEqual.js';
import iteratee from 'lodash-es/iteratee.js';
import omit from 'lodash-es/omit.js';
import pick from 'lodash-es/pick.js';
import result from 'lodash-es/result.js';
import uniqueId from 'lodash-es/uniqueId.js';
import EventEmitter from 'eventemitter.js';

class Model extends EventEmitter {
  constructor(attributes, options) {
    super();
    let attrs = attributes || {};
    options || (options = {});
    this.preinitialize.apply(this, arguments);
    this.cid = uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    const default_attrs = result(this, 'defaults');
    attrs = defaults(extend({}, default_attrs, attrs), default_attrs);
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);

    // A hash of attributes whose current and previous value differ.
    this.changed = null;

    // The value returned during the last failed validation.
    this.validationError = null;

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    this.idAttribute = 'id';

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    this.cidPrefix = 'c';

    this.validate = null;
  }

  /**
   * preinitialize is an empty function by default. You can override it with a function
   * or object.  preinitialize will run before any instantiation logic is run in the Model.
   */
  // eslint-disable-next-line class-methods-use-this
  preinitialize() {}

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  // eslint-disable-next-line class-methods-use-this
  initialize() {}

  /**
   * Return a copy of the model's `attributes` object.
   */
  toJSON() {
    return clone(this.attributes);
  }

  /**
   * Override this if you need custom syncing semantics for *this* particular model.
   * @param {'create'|'update'|'patch'|'delete'|'read'} method
   * @param {Model} model
   * @param {Object} options
   */
  // eslint-disable-next-line class-methods-use-this
  sync(method, model, options) {
    return getSyncMethod(model)(method, model, options);
  }

  /**
   * Get the value of an attribute.
   */
  get(attr) {
    return this.attributes[attr];
  }

  keys() {
    return Object.keys(this.attributes);
  }

  values() {
    return Object.values(this.attributes);
  }

  pairs() {
    return this.entries();
  }

  entries() {
    return Object.entries(this.attributes);
  }

  invert() {
    return invert(this.attributes);
  }

  pick(...args) {
    if (args.length === 1 && Array.isArray(args[0])) {
      args = args[0];
    }
    return pick(this.attributes, args);
  }

  omit(...args) {
    if (args.length === 1 && Array.isArray(args[0])) {
      args = args[0];
    }
    return omit(this.attributes, args);
  }

  isEmpty() {
    return isEmpty(this.attributes);
  }

  /**
   * Get the HTML-escaped value of an attribute.
   */
  escape(attr) {
    return escape(this.get(attr));
  }

  /**
   * Returns `true` if the attribute contains a value that is not null
   * or undefined.
   */
  has(attr) {
    return this.get(attr) != null;
  }

  /**
   * Special-cased proxy to lodash's `matches` method.
   */
  matches(attrs) {
    return !!iteratee(attrs, this)(this.attributes);
  }

  /**
   * Set a hash of model attributes on the object, firing `"change"`. This is
   * the core primitive operation of a model, updating the data and notifying
   * anyone who needs to know about the change in state. The heart of the beast.
   */
  set(key, val, options) {
    if (key == null) return this;

    // Handle both `"key", value` and `{key: value}` -style arguments.
    let attrs;
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }

    options || (options = {});

    // Run validation.
    if (!this._validate(attrs, options)) return false;

    // Extract attributes and options.
    const unset = options.unset;
    const silent = options.silent;
    const changes = [];
    const changing = this._changing;
    this._changing = true;

    if (!changing) {
      this._previousAttributes = clone(this.attributes);
      this.changed = {};
    }

    const current = this.attributes;
    const changed = this.changed;
    const prev = this._previousAttributes;

    // For each `set` attribute, update or delete the current value.
    for (const attr in attrs) {
      val = attrs[attr];
      if (!isEqual(current[attr], val)) changes.push(attr);
      if (!isEqual(prev[attr], val)) {
        changed[attr] = val;
      } else {
        delete changed[attr];
      }
      unset ? delete current[attr] : (current[attr] = val);
    }

    // Update the `id`.
    if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

    // Trigger all relevant attribute changes.
    if (!silent) {
      if (changes.length) this._pending = options;
      for (let i = 0; i < changes.length; i++) {
        this.trigger('change:' + changes[i], this, current[changes[i]], options);
      }
    }

    // You might be wondering why there's a `while` loop here. Changes can
    // be recursively nested within `"change"` events.
    if (changing) return this;
    if (!silent) {
      while (this._pending) {
        options = this._pending;
        this._pending = false;
        this.trigger('change', this, options);
      }
    }
    this._pending = false;
    this._changing = false;
    return this;
  }

  /**
   * Remove an attribute from the model, firing `"change"`. `unset` is a noop
   * if the attribute doesn't exist.
   */
  unset(attr, options) {
    return this.set(attr, undefined, extend({}, options, { unset: true }));
  }

  /**
   * Clear all attributes on the model, firing `"change"`.
   */
  clear(options) {
    const attrs = {};
    for (const key in this.attributes) attrs[key] = undefined;
    return this.set(attrs, extend({}, options, { unset: true }));
  }

  /**
   * Determine if the model has changed since the last `"change"` event.
   * If you specify an attribute name, determine if that attribute has changed.
   */
  hasChanged(attr) {
    if (attr == null) return !isEmpty(this.changed);
    return has(this.changed, attr);
  }

  /**
   * Return an object containing all the attributes that have changed, or
   * false if there are no changed attributes. Useful for determining what
   * parts of a view need to be updated and/or what attributes need to be
   * persisted to the server. Unset attributes will be set to undefined.
   * You can also pass an attributes object to diff against the model,
   * determining if there *would be* a change.
   */
  changedAttributes(diff) {
    if (!diff) return this.hasChanged() ? clone(this.changed) : false;
    const old = this._changing ? this._previousAttributes : this.attributes;
    const changed = {};
    let hasChanged;
    for (const attr in diff) {
      const val = diff[attr];
      if (isEqual(old[attr], val)) continue;
      changed[attr] = val;
      hasChanged = true;
    }
    return hasChanged ? changed : false;
  }

  /**
   * Get the previous value of an attribute, recorded at the time the last
   * `"change"` event was fired.
   */
  previous(attr) {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  }

  /**
   * Get all of the attributes of the model at the time of the previous
   * `"change"` event.
   */
  previousAttributes() {
    return clone(this._previousAttributes);
  }

  /**
   * Fetch the model from the server, merging the response with the model's
   * local attributes. Any changed attributes will trigger a "change" event.
   */
  fetch(options) {
    options = extend({ parse: true }, options);

    const success = options.success;

    options.success = (resp) => {
      const serverAttrs = options.parse ? this.parse(resp, options) : resp;
      if (!this.set(serverAttrs, options)) return false;
      if (success) success.call(options.context, this, resp, options);
      this.trigger('sync', this, resp, options);
    };

    wrapError(this, options);
    return this.sync('read', this, options);
  }

  /**
   * Set a hash of model attributes, and sync the model to the server.
   * If the server returns an attributes hash that differs, the model's
   * state will be `set` again.
   * @param {string} key
   * @param {any} key
   * @param {Object.<string, any>} [options]
   */
  save(key, val, options) {
    // Handle both `"key", value` and `{key: value}` -style arguments.
    let attrs;
    if (key == null || typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }

    options = extend({ validate: true, parse: true }, options);
    const wait = options.wait;
    const return_promise = options.promise;
    const promise = return_promise && getResolveablePromise();

    // If we're not waiting and attributes exist, save acts as
    // `set(attr).save(null, opts)` with validation. Otherwise, check if
    // the model will be valid when the attributes, if any, are set.
    if (attrs && !wait) {
      if (!this.set(attrs, options)) return false;
    } else if (!this._validate(attrs, options)) {
      return false;
    }

    // After a successful server-side save, the client is (optionally)
    // updated with the server-side state.
    const success = options.success;
    const error = options.error;
    const attributes = this.attributes;

    options.success = (resp) => {
      // Ensure attributes are restored during synchronous saves.
      this.attributes = attributes;
      let serverAttrs = options.parse ? this.parse(resp, options) : resp;
      if (wait) serverAttrs = extend({}, attrs, serverAttrs);
      if (serverAttrs && !this.set(serverAttrs, options)) return false;
      if (success) success.call(options.context, this, resp, options);
      this.trigger('sync', this, resp, options);
      return_promise && promise.resolve();
    };

    options.error = (model, e, options) => {
      error && error.call(options.context, model, e, options);
      return_promise && promise.reject(e);
    };

    wrapError(this, options);

    // Set temporary attributes if `{wait: true}` to properly find new ids.
    if (attrs && wait) this.attributes = extend({}, attributes, attrs);

    const method = this.isNew() ? 'create' : options.patch ? 'patch' : 'update';
    if (method === 'patch' && !options.attrs) options.attrs = attrs;
    const xhr = this.sync(method, this, options);

    // Restore attributes.
    this.attributes = attributes;

    if (return_promise) {
      return promise;
    } else {
      return xhr;
    }
  }

  /**
   * Destroy this model on the server if it was already persisted.
   * Optimistically removes the model from its collection, if it has one.
   * If `wait: true` is passed, waits for the server to respond before removal.
   * @param {Object.<string, any>} [options]
   */
  destroy(options) {
    options = options ? clone(options) : {};
    const success = options.success;
    const wait = options.wait;

    const destroy = () => {
      this.stopListening();
      this.trigger('destroy', this, this.collection, options);
    };

    options.success = (resp) => {
      if (wait) destroy();
      if (success) success.call(options.context, this, resp, options);
      if (!this.isNew()) this.trigger('sync', this, resp, options);
    };

    let xhr = false;
    if (this.isNew()) {
      defer(options.success);
    } else {
      wrapError(this, options);
      xhr = this.sync('delete', this, options);
    }
    if (!wait) destroy();
    return xhr;
  }

  /**
   * Default URL for the model's representation on the server -- if you're
   * using Backbone's restful methods, override this to change the endpoint
   * that will be called.
   */
  url() {
    const base = result(this, 'urlRoot') || result(this.collection, 'url') || urlError();
    if (this.isNew()) return base;
    const id = this.get(this.idAttribute);
    return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
  }

  /**
   * **parse** converts a response into the hash of attributes to be `set` on
   * the model. The default implementation is just to pass the response along.
   */
  // eslint-disable-next-line class-methods-use-this
  parse(resp, options) {
    return resp;
  }

  /**
   * A model is new if it has never been saved to the server, and lacks an id.
   */
  isNew() {
    return !this.has(this.idAttribute);
  }

  /**
   * Check if the model is currently in a valid state.
   */
  isValid(options) {
    return this._validate({}, extend({}, options, { validate: true }));
  }

  /**
   * Run validation against the next complete set of model attributes,
   * returning `true` if all is well. Otherwise, fire an `"invalid"` event.
   */
  _validate(attrs, options) {
    if (!options.validate || !this.validate) return true;
    attrs = extend({}, this.attributes, attrs);
    const error = (this.validationError = this.validate(attrs, options) || null);
    if (!error) return true;
    this.trigger('invalid', this, error, extend(options, { validationError: error }));
    return false;
  }
}

// Attach all inheritable methods to the Model prototype.
Object.assign(Model.prototype, Events);

export { Model };
