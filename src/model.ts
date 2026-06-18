import {
  getResolveablePromise,
  getStorage,
  getSyncMethod,
  urlError,
  warnBrowserStorageDeprecation,
  wrapError,
} from './helpers';
import { scheduleAutoSave, cancelAutoSave, ensureUnloadListener } from './autosync';
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
import PersistentStorage from './storage';

// Import types
import type { Collection } from './collection';
import {
  ComputedProperties,
  ComputedProperty,
  EventCallback,
  ModelAttributes,
  ObjectWithId,
  SyncOperation,
  ModelOptions,
  Options,
} from './types';

/**
 * @public
 * **Models** are the basic data object in the framework --
 * frequently representing a row in a table in a database on your server.
 * A discrete chunk of data and a bunch of useful, related methods for
 * performing computations and transformations on that data.
 */
export class Model<T extends ModelAttributes = ModelAttributes> extends EventEmitterObject {
  #computedCache?: Record<string, any>;
  #computedDefs?: Record<string, ComputedProperty<this>>;
  #state: 'constructing' | 'hydrating' | 'ready' = 'constructing';
  _storage?: PersistentStorage;
  _changing = false;
  _pending: boolean | ModelOptions = false;
  _previousAttributes?: T;
  _url: string = '';
  _urlRoot: string;
  attrs: T;
  attributes: T;
  changed: Partial<T> = {};
  cid: string;
  collection?: Collection;
  id: string | number;
  initialized?: Promise<void>;
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

    this.#initComputed();

    this.attrs = new Proxy(this.attributes as T, {
      get: (_target, key) => {
        if (typeof key !== 'symbol' && this.#computedCache && (key as string) in this.#computedCache) {
          return this.#computedCache[key as string];
        }
        return (this.attributes as any)[key];
      },
      set: (_target, key, value) => {
        this.set(key as string, value);
        return true;
      },
    });

    this.initialize.apply(this, arguments as any);

    // Reset changed after initial set
    this.changed = {};

    // When autoSync is on, `initialized` is always a Promise so callers can
    // uniformly `await model.initialized`. It only hydrates from storage when
    // there's something to load (storage configured and the model isn't new);
    // otherwise it's already ready and resolves immediately.
    if (this.autoSync) {
      if (getStorage(this) && !this.isNew()) {
        this.#state = 'hydrating';
        this.initialized = this.#hydrate();
      } else {
        this.#state = 'ready';
        this.initialized = Promise.resolve();
      }
    } else {
      this.#state = 'ready';
    }
  }

  /**
   * The canonical storage accessor. Set to a `PersistentStorage` instance
   * to enable local persistence for this model.
   */
  get storage(): PersistentStorage | undefined {
    return this._storage;
  }

  set storage(s: PersistentStorage) {
    this._storage = s;
    PersistentStorage.register(s);
  }

  /**
   * @deprecated Use `storage` instead.
   */
  get browserStorage(): PersistentStorage | undefined {
    return this._storage;
  }

  set browserStorage(s: PersistentStorage) {
    warnBrowserStorageDeprecation(this);
    this.storage = s;
  }

  /**
   * Override to enable automatic persistence. When true, any `set()` call
   * that changes attributes will schedule a debounced save to `storage`, and
   * the model will auto-hydrate from storage on construction.
   */
  get autoSync(): boolean {
    return false;
  }

  /**
   * Debounce delay (ms) for auto-save writes. Override to tune.
   */
  get autoSyncDelay(): number {
    return 100;
  }

  async #hydrate(): Promise<void> {
    ensureUnloadListener(PersistentStorage);
    try {
      await this.fetch({ fromStorage: true, promise: true });
    } catch (e) {
      // 'Record Not Found' is a normal first-run state (nothing stored yet);
      // keep the initial attributes and resolve. Re-throw anything else.
      if (e !== 'Record Not Found') throw e;
    } finally {
      this.#state = 'ready';
    }
  }

  #doAutoSave(): unknown {
    return this.save(null, { noAutoSave: true });
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
   * Declare computed properties. Override in subclasses to define properties
   * that derive their value from other attributes. Each entry specifies the
   * attribute keys it depends on (`deps`) and a function (`fn`) that receives
   * the model and returns the computed value. The value is cached and
   * recalculated automatically when any dep changes, firing a `change:key`
   * event.
   */
  get computed(): ComputedProperties<this> {
    return {};
  }

  #updateComputed(key: string, def: ComputedProperty<this>, silent: boolean, options: ModelOptions): void {
    const newVal = def.fn(this);
    if (!isEqual(this.#computedCache[key], newVal)) {
      this.#computedCache[key] = newVal;
      if (!silent) {
        (this.changed as any)[key] = newVal;
        this.trigger('change:' + key, this, newVal, options);
      }
    }
  }

  #initComputed(): void {
    const defs = result(this, 'computed') as ComputedProperties<this>;
    if (!defs || isEmpty(defs)) return;
    this.#computedDefs = defs;
    this.#computedCache = {};
    for (const [key, def] of Object.entries(defs)) {
      this.#computedCache[key] = def.fn(this);
    }
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
   * Get the value of an attribute, or a computed property.
   */
  get<K extends keyof T>(attr: K): T[K] {
    if (this.#computedCache && (attr as string) in this.#computedCache) {
      return this.#computedCache[attr as string];
    }
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

    // Guard must come after arg normalization: when called as set(obj, opts),
    // fromStorage lives in `val` (second arg), not `options` (third arg).
    if (this.autoSync && this.#state === 'hydrating' && !options.fromStorage) {
      throw new Error(
        `Skeletor: set() called on an autoSync model before initialized resolved. Await model.initialized first.`
      );
    }

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

    // Recalculate computed properties whose deps changed.
    if (changes.length && this.#computedDefs) {
      for (const [key, def] of Object.entries(this.#computedDefs)) {
        if (def.deps.some((dep) => changes.includes(dep))) {
          this.#updateComputed(key, def, silent, options);
        }
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

    // Auto-save: schedule a debounced write when autoSync is on and there
    // were actual changes that originated from application code (not a
    // storage read or an explicit noAutoSave call).
    if (
      this.#state === 'ready' &&
      this.autoSync &&
      getStorage(this) &&
      changes.length &&
      !options.fromStorage &&
      !options.noAutoSave
    ) {
      scheduleAutoSave(this, () => this.#doAutoSave(), this.autoSyncDelay);
    }

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
    const promise = options.promise ? getResolveablePromise() : undefined;

    // Tracks whether sync invoked one of the callbacks. A sync may instead
    // settle its returned promise; the `.then`/`.catch` below bridges that to
    // the callbacks so the fetch promise never hangs. The flag is set
    // synchronously inside each callback (before sync's promise resolves), so
    // it's reliable by the time those handlers run.
    let settled = false;

    options.success = (resp: any) => {
      settled = true;
      const serverAttrs = options.parse ? this.parse(resp, options) : resp;
      // fromStorage prevents the set() from triggering auto-save on reads
      if (!this.set(serverAttrs, Object.assign({}, options, { fromStorage: true }))) return false;
      if (success) success.call(options.context, this, resp, options);
      this.trigger('sync', this, resp, options);
      promise && promise.resolve(resp);
    };

    wrapError(this, options, promise);
    if (promise) {
      const onError = options.error;
      options.error = (resp: any) => {
        settled = true;
        onError(resp);
      };
    }

    const result = this.sync('read', this, options);
    if (promise) {
      Promise.resolve(result).then(
        // A sync that resolves its promise without invoking options.success:
        // treat the resolved value as the response, so the model is still
        // merged and the promise settles instead of hanging.
        (value) => {
          if (!settled) options.success(value);
        },
        // A sync that rejects instead of invoking options.error; settling
        // twice is a harmless no-op.
        (e) => promise.reject(e),
      );
      return promise;
    }
    return result;
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
    cancelAutoSave(this);
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
   * Subscribe to model changes. Returns an unsubscribe function.
   *
   * `model.subscribe(callback)` — fires on any attribute change, receives `(model, changed)`.
   * `model.subscribe(event, callback)` — subscribe to a specific event (base EventEmitter form).
   *
   * Compatible with React's `useSyncExternalStore` and other store-style APIs.
   */
  subscribe(event: string, callback: EventCallback, context?: unknown): () => void;
  subscribe(callback: (model: this, changed: Partial<T>) => void): () => void;
  subscribe(
    eventOrCallback: string | ((model: this, changed: Partial<T>) => void),
    callback?: EventCallback,
    context?: unknown,
  ): () => void {
    if (typeof eventOrCallback === 'function') {
      const cb = (model: this) => (eventOrCallback as (model: this, changed: Partial<T>) => void)(model, this.changed);
      this.on('change', cb);
      return () => this.off('change', cb);
    }
    return super.subscribe(eventOrCallback, callback, context);
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
