import { getResolveablePromise, getSyncMethod, urlError, wrapError } from './helpers';
import clone from 'lodash-es/clone';
import defaults from 'lodash-es/defaults';
import defer from 'lodash-es/defer';
import has from 'lodash-es/has';
import invert from 'lodash-es/invert';
import isEmpty from 'lodash-es/isEmpty';
import isEqual from 'lodash-es/isEqual';
import iteratee from 'lodash-es/iteratee';
import omit from 'lodash-es/omit';
import pick from 'lodash-es/pick';
import result from 'lodash-es/result';
import uniqueId from 'lodash-es/uniqueId';
import { EventEmitterObject } from './eventemitter';

// Import types
import type { Collection } from './collection';
import type Storage from './storage';
import { ModelAttributes, ObjectWithId, SyncOperation, ModelOptions, Options } from './types';

/**
 * @public
 * **Models** are the basic data object in the framework --
 * frequently representing a row in a table in a database on your server.
 * A discrete chunk of data and a bunch of useful, related methods for
 * performing computations and transformations on that data.
 */
export class Model<T extends ModelAttributes = ModelAttributes> extends EventEmitterObject {
  _browserStorage?: Storage;
  _changing = false;
  _pending: boolean | ModelOptions = false;
  _previousAttributes?: T;
  _url: string = '';
  _urlRoot: string;
  attributes: T;
  changed: Partial<T> = {};
  cid: string;
  collection?: Collection;
  id: string | number;
  validationError: string | number | null = null;

  /**
   * Create a new model with the specified attributes. A client id (`cid`)
   * is automatically generated and assigned for you.
   */
  constructor(attributes?: Partial<T>, options?: ModelOptions) {
    super();
    let attrs: Partial<T> = attributes || ({} as Partial<T>);
    options = options || {};

    this.preinitialize.apply(this, arguments as any);
    this.cid = uniqueId(this.cidPrefix);
    this.attributes = {} as T;

    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || ({} as Partial<T>);

    const default_attrs = result(this, 'defaults');
    attrs = defaults(Object.assign({}, default_attrs, attrs), default_attrs);

    this.set(attrs, options);

    this.initialize.apply(this, arguments as any);

    // Reset changed after initial set
    this.changed = {};
  }

  set browserStorage(storage: Storage) {
    this._browserStorage = storage;
  }

  get browserStorage(): Storage | undefined {
    return this._browserStorage;
  }

  /**
   * The default name for the JSON `id` attribute is `"id"`. MongoDB and
   * CouchDB users may want to set this to `"_id"` (by overriding this getter
   * in a subclass).
   */
  get idAttribute(): string {
    return 'id';
  }

  /**
   * The prefix is used to create the client id which is used to identify models locally.
   * You may want to override this if you're experiencing name clashes with model ids.
   */
  get cidPrefix(): string {
    return 'c';
  }

  /**
   * preinitialize is an empty function by default. You can override it with a function
   * or object.  preinitialize will run before any instantiation logic is run in the Model.
   */
  preinitialize(...args: any[]): void {}

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  initialize(attrs?: Partial<T>, options?: ModelOptions): void {}

  validate(attrs: Partial<T> | ObjectWithId, options?: ModelOptions): string | number | null | void {
    return null;
  }

  /**
   * Return a hash of defaults for the model's attributes.
   */
  defaults(): Partial<T> {
    return {} as Partial<T>;
  }

  /**
   * Return a copy of the model's `attributes` object.
   */
  toJSON(): T {
    return clone(this.attributes);
  }

  /**
   * Override this if you need custom syncing semantics for *this* particular model.
   */
  sync(method: SyncOperation, model: Model<any>, options: Options): any {
    return getSyncMethod(model)(method, model, options);
  }

  /**
   * Get the value of an attribute.
   */
  get<K extends keyof T>(attr: K): T[K] {
    return this.attributes[attr];
  }

  keys(): string[] {
    return Object.keys(this.attributes);
  }

  values(): T[keyof T][] {
    return Object.values(this.attributes);
  }

  pairs(): [keyof T, T[keyof T]][] {
    return this.entries();
  }

  entries(): [keyof T, T[keyof T]][] {
    return Object.entries(this.attributes) as [keyof T, T[keyof T]][];
  }

  invert(): Record<string, keyof T> {
    return invert(this.attributes);
  }

  pick<K extends keyof T>(...args: K[]): Pick<T, K> {
    if (args.length === 1 && Array.isArray(args[0])) {
      args = args[0] as K[];
    }
    return pick(this.attributes, args) as Pick<T, K>;
  }

  omit<K extends keyof T>(...args: K[]): Omit<T, K> {
    if (args.length === 1 && Array.isArray(args[0])) {
      args = args[0] as K[];
    }
    return omit(this.attributes, args) as Omit<T, K>;
  }

  isEmpty(): boolean {
    return isEmpty(this.attributes);
  }

  /**
   * Returns `true` if the attribute contains a value that is not null
   * or undefined.
   */
  has(attr: keyof T): boolean {
    return this.get(attr) != null;
  }

  /**
   * Special-cased proxy to lodash's `matches` method.
   */
  matches(attrs: Partial<T>): boolean {
    return !!iteratee(attrs)(this.attributes);
  }

  /**
   * Set a hash of model attributes on the object, firing `"change"`. This is
   * the core primitive operation of a model, updating the data and notifying
   * anyone who needs to know about the change in state. The heart of the beast.
   */
  set(key: string | Partial<T> | ObjectWithId, val?: any, options?: ModelOptions): this {
    if (key == null) return this;

    // Handle both `"key", value` and `{key: value}` -style arguments.
    let attrs: Partial<T> | ObjectWithId;
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      attrs = {} as Partial<T>;
      attrs[key as keyof T] = val;
    }

    options = options || {};

    // Run validation.
    if (!this._validate(attrs, options)) return null;

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
      val = attrs[attr as keyof (T | ObjectWithId)];
      if (!isEqual(current[attr as keyof T], val)) changes.push(attr);
      if (!isEqual(prev[attr as keyof T], val)) {
        changed[attr as keyof T] = val;
      } else {
        delete changed[attr as keyof T];
      }
      unset ? delete current[attr as keyof T] : (current[attr as keyof T] = val);
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

    if (changing) return this;

    if (!silent) {
      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      while (this._pending) {
        options = this._pending as ModelOptions;
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
  unset(attr: keyof T, options?: ModelOptions): this {
    return this.set(attr as string, undefined, Object.assign({}, options, { unset: true }));
  }

  /**
   * Clear all attributes on the model, firing `"change"`.
   */
  clear(options?: ModelOptions): this {
    const attrs: Partial<T> = {};
    for (const key in this.attributes) attrs[key as keyof T] = undefined;
    return this.set(attrs, Object.assign({}, options, { unset: true }));
  }

  /**
   * Determine if the model has changed since the last `"change"` event.
   * If you specify an attribute name, determine if that attribute has changed.
   */
  hasChanged(attr?: keyof T): boolean {
    if (attr == null) return !isEmpty(this.changed);
    return has(this.changed, attr as string);
  }

  /**
   * Return an object containing all the attributes that have changed, or
   * false if there are no changed attributes. Useful for determining what
   * parts of a view need to be updated and/or what attributes need to be
   * persisted to the server. Unset attributes will be set to undefined.
   * You can also pass an attributes object to diff against the model,
   * determining if there *would be* a change.
   */
  changedAttributes(diff?: Partial<T>): Partial<T> | false {
    if (!diff) {
      return this.hasChanged() ? clone(this.changed) : false;
    }

    const old = this._changing ? this._previousAttributes : this.attributes;
    const changed: Partial<T> = {};
    let hasChanged = false;
    for (const attr in diff) {
      const val = diff[attr as keyof T];
      if (isEqual(old[attr as keyof T], val)) continue;
      changed[attr as keyof T] = val;
      hasChanged = true;
    }
    return hasChanged ? changed : false;
  }

  /**
   * Get the previous value of an attribute, recorded at the time the last
   * `"change"` event was fired.
   */
  previous<K extends keyof T>(attr: K): T[K] | null {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  }

  /**
   * Get all of the attributes of the model at the time of the previous
   * `"change"` event.
   */
  previousAttributes(): T | undefined {
    return this._previousAttributes ? clone(this._previousAttributes) : undefined;
  }

  /**
   * Fetch the model from the server, merging the response with the model's
   * local attributes. Any changed attributes will trigger a "change" event.
   */
  fetch(options: Options = {}): any {
    options = Object.assign({ parse: true }, options);

    const success = options.success;

    options.success = (resp: any) => {
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
   */
  save(key?: string | null | Partial<T>, val?: any, options?: ModelOptions): any {
    // Handle both `"key", value` and `{key: value}` -style arguments.
    let attrs: Partial<T> | undefined;
    if (key == null || typeof key === 'object') {
      attrs = key as Partial<T>;
      options = val as ModelOptions;
    } else {
      attrs = {} as Partial<T>;
      attrs[key as keyof T] = val;
    }

    options = Object.assign({ validate: true, parse: true }, options);
    const wait = options.wait;
    const return_promise = options.promise;
    const promise = return_promise && getResolveablePromise();

    // If we're not waiting and attributes exist, save acts as
    // `set(attr).save(null, opts)` with validation. Otherwise, check if
    // the model will be valid when the attributes, if any, are set.
    if (attrs && !wait) {
      if (!this.set(attrs, options)) return false;
    } else if (!this._validate(attrs || {}, options)) {
      return false;
    }

    // After a successful server-side save, the client is (optionally)
    // updated with the server-side state.
    const success = options.success;
    const error = options.error;
    const attributes = this.attributes;

    options.success = (resp: any) => {
      // Ensure attributes are restored during synchronous saves.
      this.attributes = attributes;
      let serverAttrs = options.parse ? this.parse(resp, options) : resp;
      if (wait) serverAttrs = Object.assign({}, attrs, serverAttrs);
      if (serverAttrs && !this.set(serverAttrs, options)) return false;
      if (success) success.call(options.context, this, resp, options);
      this.trigger('sync', this, resp, options);
      return_promise && promise.resolve();
    };

    options.error = (model: this, e: any, options: Options) => {
      error && error.call(options.context, model, e, options);
      return_promise && promise.reject(e);
    };

    wrapError(this, options);

    // Set temporary attributes if `{wait: true}` to properly find new ids.
    if (attrs && wait) this.attributes = Object.assign({}, attributes, attrs);

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
   */
  destroy(options?: ModelOptions): any {
    options = options ? clone(options) : {};
    const success = options.success;
    const wait = options.wait;

    const destroy = () => {
      this.stopListening();
      this.trigger('destroy', this, this.collection, options);
    };

    options.success = (resp: any) => {
      if (wait) destroy();
      if (success) success.call(options.context, this, resp, options);
      if (!this.isNew()) this.trigger('sync', this, resp, options);
    };

    let xhr: any = false;
    if (this.isNew()) {
      defer(options.success);
    } else {
      wrapError(this, options);
      xhr = this.sync('delete', this, options);
    }
    if (!wait) destroy();
    return xhr;
  }

  get urlRoot(): string {
    return this._urlRoot;
  }

  set urlRoot(root: string) {
    this._urlRoot = root;
  }

  /**
   * Default URL for the model's representation on the server -- if you're
   * using Backbone's restful methods, override this to change the endpoint
   * that will be called.
   */
  get url(): string {
    if (this._url) return this._url;

    const base = result(this, 'urlRoot') || result(this.collection, 'url') || urlError();
    if (this.isNew()) return base as string;
    const id = this.get(this.idAttribute);
    return (base as string).replace(/[^\/]$/, '$&/') + encodeURIComponent(String(id));
  }

  set url(url: string) {
    this._url = url;
  }

  /**
   * **parse** converts a response into the hash of attributes to be `set` on
   * the model. The default implementation is just to pass the response along.
   */
  parse(resp: any, options?: ModelOptions): Partial<T> | null | void {
    return resp;
  }

  /**
   * A model is new if it has never been saved to the server, and lacks an id.
   */
  isNew(): boolean {
    return !this.has(this.idAttribute);
  }

  /**
   * Check if the model is currently in a valid state.
   */
  isValid(options?: ModelOptions): boolean {
    return this._validate({}, Object.assign({}, options, { validate: true }));
  }

  /**
   * Run validation against the next complete set of model attributes,
   * returning `true` if all is well. Otherwise, fire an `"invalid"` event.
   */
  _validate(attrs: Partial<T> | ObjectWithId, options?: ModelOptions): boolean {
    if (!options?.validate || !this.validate) return true;
    attrs = Object.assign({}, this.attributes, attrs);
    const error = (this.validationError = this.validate(attrs, options) || null);
    if (!error) return true;
    this.trigger('invalid', this, error, Object.assign(options, { validationError: error }));
    return false;
  }
}
