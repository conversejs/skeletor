import clone from 'lodash-es/clone';
import countBy from 'lodash-es/countBy';
import groupBy from 'lodash-es/groupBy';
import isFunction from 'lodash-es/isFunction';
import isString from 'lodash-es/isString';
import keyBy from 'lodash-es/keyBy';
import sortBy from 'lodash-es/sortBy';
import { EventEmitterObject } from './eventemitter';
import type Storage from './storage';
import { getResolveablePromise, getSyncMethod, wrapError } from './helpers';
import { Model } from './model';
import {
  CollectionOptions,
  Comparator,
  ModelAttributes,
  ModelOptions,
  ObjectWithId,
  Options,
  SyncOperation,
} from './types';

// Default options for `Collection#set`.
const setOptions = { add: true, remove: true, merge: true };
const addOptions = { add: true, remove: false };

/**
 * @public
 * If models tend to represent a single row of data, a Collection is
 * more analogous to a table full of data ... or a small slice or page of that
 * table, or a collection of rows that belong together for a particular reason
 * -- all of the messages in this particular folder, all of the documents
 * belonging to this particular author, and so on. Collections maintain
 * indexes of their models, both in order, and for lookup by `id`.
 */
export class Collection<T extends Model = Model> extends EventEmitterObject {
  [key: symbol]: () => CollectionIterator<T>;
  _browserStorage?: Storage;
  _comparator?: Comparator<T>;
  _url: string = '';
  models: T[];
  protected _byId: Record<string, T>;
  protected _model?: new (attributes?: Partial<ModelAttributes>, options?: ModelOptions) => T;

  /**
   * Create a new **Collection**, perhaps to contain a specific type of `model`.
   * If a `comparator` is specified, the Collection will maintain
   * its models in sort order, as they're added and removed.
   */
  constructor(models?: T[] | ModelAttributes[] | T | ModelAttributes, options?: CollectionOptions<T>) {
    super();
    options = options || {};
    this.preinitialize.apply(this, arguments as any);
    if (options.model) this._model = options.model;
    if (options.comparator !== undefined) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments as any);
    if (models) this.reset(models, Object.assign({ silent: true }, options));

    this[Symbol.iterator] = this.values;
  }

  get comparator(): Comparator<T> {
    return this._comparator;
  }

  set comparator(c: Comparator<T>) {
    this._comparator = c;
  }

  set browserStorage(storage: Storage) {
    this._browserStorage = storage;
  }

  get browserStorage(): Storage | undefined {
    return this._browserStorage;
  }

  /**
   * The default model for a collection is just a **Model**.
   * This should be overridden in most cases.
   */
  get model(): new (attributes?: Partial<ModelAttributes>, options?: ModelOptions) => T | Model {
    return this._model ?? Model;
  }

  set model(model: new (attributes?: Partial<ModelAttributes>, options?: ModelOptions) => T) {
    this._model = model;
  }

  get length(): number {
    return this.models.length;
  }

  get url(): string {
    return this._url;
  }

  set url(url: string) {
    this._url = url;
  }

  /**
   * preinitialize is an empty function by default. You can override it with a function
   * or object.  preinitialize will run before any instantiation logic is run in the Collection.
   */
  preinitialize(..._args: any[]): void {}

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  initialize(..._args: any[]): void {}

  /**
   * The JSON representation of a Collection is an array of the
   * models' attributes.
   */
  toJSON(): any[] {
    return this.map(function (model) {
      return model.toJSON();
    });
  }

  sync(method: SyncOperation, model: Model | Collection<any>, options?: Options): any {
    return getSyncMethod(this)(method, model, options);
  }

  /**
   * Add a model, or list of models to the set. `models` may be
   * Models or raw JavaScript objects to be converted to Models, or any
   * combination of the two.
   */
  add(models: T[] | T | ModelAttributes | ModelAttributes[], options?: Options): T | T[] {
    return this.set(models, Object.assign({ merge: false }, options, addOptions));
  }

  /**
   * Remove a model, or a list of models from the set.
   */
  remove(models: T | ObjectWithId | (T | ObjectWithId)[], options?: Options): T | T[] {
    options = Object.assign({}, options);
    const singular = !Array.isArray(models);
    const modelsArray = singular ? [models] : (models as T[]).slice();
    const removed = this._removeModels(modelsArray, options);
    if (!options.silent && removed.length) {
      options.changes = { added: [], merged: [], removed: removed };
      this.trigger('update', this, options);
    }
    return singular ? removed[0] : removed;
  }

  /**
   * Update a collection by `set`-ing a new list of models, adding new ones,
   * removing models that are no longer present, and merging models that
   * already exist in the collection, as necessary. Similar to **Model#set**,
   * the core operation for updating the data contained by the collection.
   */
  set(models: T[] | T | ModelAttributes | ModelAttributes[], options?: Options): T | T[] {
    if (models == null) return;

    options = Object.assign({}, setOptions, options);
    if (options.parse && !this._isModel(models)) {
      models = this.parse(models, options) || [];
    }

    const singular = !Array.isArray(models);
    models = singular ? [models] : (models as T[] | ModelAttributes[]).slice();

    let at = options.at;
    if (at != null) at = +at;
    if (at > this.length) at = this.length;
    if (at < 0) at += this.length + 1;

    const set = [];
    const toAdd = [];
    const toMerge = [];
    const toRemove = [];
    const modelMap = {};

    const add = options.add;
    const merge = options.merge;
    const remove = options.remove;

    let sort = false;
    const sortable = this.comparator && at == null && options.sort !== false;
    const sortAttr = isString(this.comparator) ? this.comparator : null;

    // Turn bare objects into model references, and prevent invalid models
    // from being added.
    let model: T, i: number;
    for (i = 0; i < models.length; i++) {
      model = models[i];

      // If a duplicate is found, prevent it from being added and
      // optionally merge it into the existing model.
      const existing = this.get(model);
      if (existing) {
        if (merge && model !== existing) {
          let attrs = this._isModel(model) ? model.attributes : model;
          if (options.parse) attrs = existing.parse(attrs, options) as Partial<ModelAttributes>;
          existing.set(attrs, options);
          toMerge.push(existing);

          if (sortable && !sort) sort = existing.hasChanged(sortAttr as string);
        }
        if (!modelMap[existing.cid]) {
          modelMap[existing.cid] = true;
          set.push(existing);
        }
        models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
      } else if (add) {
        model = models[i] = this._prepareModel(model, options);
        if (model) {
          toAdd.push(model);
          this._addReference(model, options);
          modelMap[model.cid] = true;
          set.push(model);
        }
      }
    }

    // Remove stale models.
    if (remove) {
      for (i = 0; i < this.length; i++) {
        model = this.models[i];
        if (!modelMap[model.cid]) toRemove.push(model);
      }
      if (toRemove.length) this._removeModels(toRemove, options);
    }

    // See if sorting is needed, update `length` and splice in new models.
    let orderChanged = false;
    const replace = !sortable && add && remove;

    if (set.length && replace) {
      orderChanged = this.length !== set.length || this.models.some((m, idx) => m !== set[idx]);
      this.models.length = 0;
      this.models.splice(0, 0, ...set);
    } else if (toAdd.length) {
      if (sortable) sort = true;
      let idx = at == null ? this.length : at;
      idx = Math.min(Math.max(idx, 0), this.models.length);
      this.models.splice(idx, 0, ...toAdd);
    }

    // Silently sort the collection if appropriate.
    if (sort) this.sort({ silent: true });

    // Unless silenced, it's time to fire all appropriate add/sort/update events.
    if (!options.silent) {
      for (i = 0; i < toAdd.length; i++) {
        if (at != null) options.index = at + i;
        model = toAdd[i];
        model.trigger('add', model, this, options);
      }
      if (sort || orderChanged) this.trigger('sort', this, options);
      if (toAdd.length || toRemove.length || toMerge.length) {
        options.changes = {
          added: toAdd,
          removed: toRemove,
          merged: toMerge,
        };
        this.trigger('update', this, options);
      }
    }

    // Return the added (or merged) model (or models).
    return singular ? models[0] : (models as T);
  }

  async clearStore(options: Options = {}, filter: (model: T) => boolean = () => true): Promise<void> {
    await Promise.all(
      this.models.filter(filter).map((m) => {
        return new Promise<void>((resolve) => {
          m.destroy(
            Object.assign(options, {
              'success': resolve,
              'error': (_m: T, e: any) => {
                console.error(e);
                resolve();
              },
            })
          );
        });
      })
    );
    await this.browserStorage?.clear();
    this.reset();
  }

  /**
   * When you have more items than you want to add or remove individually,
   * you can reset the entire set with a new list of models, without firing
   * any granular `add` or `remove` events. Fires `reset` when finished.
   * Useful for bulk operations and optimizations.
   */
  reset(models?: T[] | T | ModelAttributes | ModelAttributes[], options?: Options): T | T[] {
    options = options ? clone(options) : {};
    for (let i = 0; i < this.models.length; i++) {
      this._removeReference(this.models[i], options);
    }
    options.previousModels = this.models;
    this._reset();
    models = this.add(models, Object.assign({ silent: true }, options));
    if (!options.silent) this.trigger('reset', this, options);
    return models as T | T[];
  }

  /**
   * Add a model to the end of the collection.
   */
  push(model: T | ModelAttributes, options?: Options): T {
    return this.add(model, Object.assign({ at: this.length }, options)) as T;
  }

  /**
   * Remove a model from the end of the collection.
   */
  pop(options?: Options): T | undefined {
    const model = this.at(this.length - 1);
    return this.remove(model, options) as T | undefined;
  }

  /**
   * Add a model to the beginning of the collection.
   */
  unshift(model: T | ModelAttributes, options?: Options): T {
    return this.add(model, Object.assign({ at: 0 }, options)) as T;
  }

  /**
   * Remove a model from the beginning of the collection.
   */
  shift(options?: Options): T | undefined {
    const model = this.at(0);
    return this.remove(model, options) as T | undefined;
  }

  /** Slice out a sub-array of models from the collection. */
  slice(start?: number, end?: number): T[] {
    return this.models.slice(start, end);
  }

  filter(callback: ((model: T) => boolean) | string | Partial<ModelAttributes>, thisArg?: any): T[] {
    return this.models.filter(
      isFunction(callback)
        ? (callback as (model: T) => boolean)
        : (m) => m.matches(callback as Partial<ModelAttributes>),
      thisArg
    );
  }

  every(pred: ((attrs: ModelAttributes) => boolean) | Options): boolean {
    if (isFunction(pred)) {
      return this.models.map((m) => m.attributes).every(pred as (attrs: ModelAttributes) => boolean);
    } else {
      return this.models.every((m) => m.matches(pred));
    }
  }

  difference(values: T[]): T[] {
    return this.models.filter((m) => !values.includes(m));
  }

  max(): number {
    return Math.max.apply(Math, this.models as any);
  }

  min(): number {
    return Math.min.apply(Math, this.models as any);
  }

  drop(n: number = 1): T[] {
    return this.models.slice(n);
  }

  some(pred: ((attrs: ModelAttributes) => boolean) | Options): boolean {
    if (isFunction(pred)) {
      return this.models.map((m) => m.attributes).some(pred as (attrs: ModelAttributes) => boolean);
    } else {
      return this.models.some((m) => m.matches(pred));
    }
  }

  sortBy(iteratee: string | ((model: T) => any)): T[] {
    return sortBy(
      this.models,
      isFunction(iteratee)
        ? iteratee
        : (m: T) => (isString(iteratee) ? m.get(iteratee as string) : m.matches(iteratee as Partial<ModelAttributes>))
    );
  }

  isEmpty(): boolean {
    return !this.models.length;
  }

  keyBy(iteratee: string | ((model: T) => string)): Record<string, T> {
    return keyBy(this.models, iteratee);
  }

  each(callback: (model: T, index: number, array: T[]) => void, thisArg?: any): void {
    return this.forEach(callback, thisArg);
  }

  forEach(callback: (model: T, index: number, array: T[]) => void, thisArg?: any): void {
    return this.models.forEach(callback, thisArg);
  }

  includes(item: T): boolean {
    return this.models.includes(item);
  }

  size(): number {
    return this.models.length;
  }

  countBy(f: string | ((model: T) => string) | Partial<ModelAttributes>): Record<string, number> {
    return countBy(this.models, isFunction(f) ? f : (m) => (isString(f) ? m.get(f) : m.matches(f)));
  }

  groupBy(pred: string | ((model: T) => string)): Record<string, T[]> {
    return groupBy(this.models, isFunction(pred) ? pred : (m) => (isString(pred) ? m.get(pred) : m.matches(pred)));
  }

  indexOf(model: T, fromIndex?: number): number {
    return this.models.indexOf(model, fromIndex);
  }

  findLastIndex(pred: ((model: T) => boolean) | string | Partial<ModelAttributes>, fromIndex?: number): number {
    return this.models.findLastIndex(
      isFunction(pred)
        ? (pred as (model: T) => boolean)
        : (m) => (isString(pred) ? m.get(pred as string) : m.matches(pred as Partial<ModelAttributes>)),
      fromIndex
    );
  }

  lastIndexOf(model: T, fromIndex?: number): number {
    return this.models.lastIndexOf(model, fromIndex);
  }

  findIndex(pred: ((model: T) => boolean) | string | Partial<ModelAttributes>): number {
    return this.models.findIndex(
      isFunction(pred)
        ? (pred as (model: T) => boolean)
        : (m) => (isString(pred) ? m.get(pred as string) : m.matches(pred as Partial<ModelAttributes>))
    );
  }

  last(): T | undefined {
    const length = this.models == null ? 0 : this.models.length;
    return length ? this.models[length - 1] : undefined;
  }

  head(): T | undefined {
    return this.models[0];
  }

  first(): T | undefined {
    return this.head();
  }

  map<U>(cb: string | ((model: T) => U) | Partial<ModelAttributes>, thisArg?: any): U[] {
    return this.models.map(
      isFunction(cb)
        ? (cb as (model: T) => U)
        : (m) => (isString(cb) ? m.get(cb as string) : m.matches(cb as Partial<ModelAttributes>)),
      thisArg
    );
  }

  reduce(callback: (accumulator: T, model: T, index: number, array: T[]) => T, initialValue: T): T {
    return this.models.reduce(callback, initialValue || this.models[0]);
  }

  reduceRight(callback: (accumulator: T, model: T, index: number, array: T[]) => T, initialValue: T): T {
    return this.models.reduceRight(callback, initialValue || this.models[0]);
  }

  toArray(): T[] {
    return Array.from(this.models);
  }

  /**
   * Get a model from the set by id, cid, model object with id or cid
   * properties, or an attributes object that is transformed through modelId.
   */
  get(obj?: string | number | ModelAttributes | T | null): T | undefined {
    if (obj == null) return undefined;
    return (
      this._byId[obj as string] ||
      this._byId[this.modelId(this._isModel(obj) ? (obj as T).attributes : (obj as ModelAttributes)) as string] ||
      ((obj as T).cid && this._byId[(obj as T).cid])
    );
  }

  /**
   * Returns `true` if the model is in the collection.
   */
  has(obj: string | number | ModelAttributes | T | null): boolean {
    return this.get(obj) != null;
  }

  /**
   * Get the model at the given index.
   */
  at(index: number): T | undefined {
    if (index < 0) index += this.length;
    return this.models[index];
  }

  /**
   * Return models with matching attributes. Useful for simple cases of
   * `filter`.
   */
  where(attrs: ModelAttributes | Partial<ModelAttributes>, first?: boolean): T[] | T | undefined {
    return this[first ? 'find' : 'filter'](attrs);
  }

  /**
   * Return the first model with matching attributes. Useful for simple cases
   * of `find`.
   */
  findWhere(attrs: ModelAttributes): T | undefined {
    return this.where(attrs, true) as T | undefined;
  }

  find(predicate: ((model: T) => boolean) | Partial<ModelAttributes> | string, fromIndex?: number): T | undefined {
    const pred = isFunction(predicate)
      ? (predicate as (model: T) => boolean)
      : (m: T) => m.matches(predicate as Partial<ModelAttributes>);
    return this.models.find(pred, fromIndex);
  }

  /**
   * Force the collection to re-sort itself. You don't need to call this under
   * normal circumstances, as the set will maintain sort order as each item
   * is added.
   */
  sort(options?: Options): this {
    let comparator = this.comparator;
    if (!comparator) throw new Error('Cannot sort a set without a comparator');
    options = options || {};

    const length = isFunction(comparator) ? comparator.length : 0;
    if (isFunction(comparator)) comparator = (comparator as (a: T, b: T) => number).bind(this);

    // Run sort based on type of `comparator`.
    if (length === 1 || isString(comparator)) {
      this.models = this.sortBy(comparator as string | ((model: T) => any));
    } else {
      this.models.sort(comparator as (a: T, b: T) => number);
    }
    if (!options.silent) this.trigger('sort', this, options);
    return this;
  }

  /**
   * Pluck an attribute from each model in the collection.
   */
  pluck(attr: string): any[] {
    return this.map(attr + '');
  }

  /**
   * Fetch the default set of models for this collection, resetting the
   * collection when they arrive. If `reset: true` is passed, the response
   * data will be passed through the `reset` method instead of `set`.
   */
  fetch(options?: Options): Promise<any> | any {
    options = Object.assign({ parse: true }, options);
    const success = options.success;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const collection = this;
    const promise = options.promise && getResolveablePromise();
    options.success = function (resp: any) {
      const method = options.reset ? 'reset' : 'set';
      collection[method](resp, options);
      if (success) success.call(options.context, collection, resp, options);
      promise && promise.resolve();
      collection.trigger('sync', collection, resp, options);
    };
    wrapError(this, options);
    return promise ? promise : this.sync('read', this, options);
  }

  /**
   * Create a new instance of a model in this collection. Add the model to the
   * collection immediately, unless `wait: true` is passed, in which case we
   * wait for the server to agree.
   */
  create(model: T | ModelAttributes, options?: Options): Promise<T> | T | false {
    options = options ? clone(options) : {};
    const wait = options.wait;
    const return_promise = options.promise;
    const promise = return_promise && getResolveablePromise();

    const preparedModel = this._prepareModel(model, options);
    if (!preparedModel) return false;
    if (!wait) this.add(preparedModel, options);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const collection = this;
    const success = options.success;
    const error = options.error;
    options.success = function (m: T, resp: any, callbackOpts: Options) {
      if (wait) {
        collection.add(m, callbackOpts);
      }
      if (success) {
        success.call(callbackOpts.context, m, resp, callbackOpts);
      }
      if (return_promise) {
        promise.resolve(m);
      }
    };
    options.error = function (model: T, e: any, options: Options) {
      error && error.call(options.context, model, e, options);
      return_promise && promise.reject(e);
    };

    preparedModel.save(null, Object.assign(options, { 'promise': false }));
    if (return_promise) {
      return promise;
    } else {
      return preparedModel;
    }
  }

  /**
   * **parse** converts a response into a list of models to be added to the
   * collection. The default implementation is just to pass it through.
   */
  parse(resp: any, _options?: Options): any {
    return resp;
  }

  /**
   * Define how to uniquely identify models in the collection.
   */
  modelId(attrs: ModelAttributes): string | number | undefined {
    return attrs[this.model.prototype?.idAttribute || 'id'];
  }

  /** Get an iterator of all models in this collection. */
  values(): CollectionIterator<T> {
    return new CollectionIterator(this, ITERATOR_VALUES);
  }

  /**
   * @public
   * Enable for...of iteration over the collection.
   */
  [Symbol.iterator] = this.values;

  /** Get an iterator of all model IDs in this collection. */
  keys(): CollectionIterator<T> {
    return new CollectionIterator(this, ITERATOR_KEYS);
  }

  /** Get an iterator of all [ID, model] tuples in this collection. */
  entries(): CollectionIterator<T> {
    return new CollectionIterator(this, ITERATOR_KEYSVALUES);
  }

  /**
   * Private method to reset all internal state. Called when the collection
   * is first initialized or reset.
   */
  _reset(): void {
    this.models = [];
    this._byId = {};
  }

  createModel(attrs: ModelAttributes, options?: Options): T {
    const Klass = this.model;
    return new Klass(attrs, options) as T;
  }

  /**
   * Prepare a hash of attributes (or other model) to be added to this
   * collection.
   */
  _prepareModel(attrs: ModelAttributes | T, options?: Options): T | null {
    if (this._isModel(attrs)) {
      if (!(attrs as T).collection) (attrs as T).collection = this;
      return attrs as T;
    }
    options = options ? clone(options) : {};
    options.collection = this;
    const model = this.createModel(attrs as ModelAttributes, options);
    if (!model.validationError) return model;
    this.trigger('invalid', this, model.validationError, options);
    return null;
  }

  /**
   * Internal method called by both remove and set.
   */
  _removeModels(models: (T | ObjectWithId)[], options?: Options): T[] {
    const removed: T[] = [];
    for (let i = 0; i < models.length; i++) {
      const model = this.get(models[i]);
      if (!model) continue;

      const index = this.indexOf(model);
      this.models.splice(index, 1);

      // Remove references before triggering 'remove' event to prevent an
      // infinite loop. #3693
      delete this._byId[model.cid];
      const id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];

      if (!options?.silent) {
        options = options || {};
        options.index = index;
        model.trigger('remove', model, this, options);
      }

      removed.push(model);
      this._removeReference(model, options);
    }
    return removed;
  }

  /**
   * Method for checking whether an object should be considered a model for
   * the purposes of adding to the collection.
   */
  _isModel(model: any): model is T {
    return model instanceof Model;
  }

  /**
   * Internal method to create a model's ties to a collection.
   */
  _addReference(model: T, _options?: Options): void {
    this._byId[model.cid] = model;
    const id = this.modelId(model.attributes);
    if (id != null) this._byId[id as string] = model;
    model.on('all', this._onModelEvent, this);
  }

  /**
   * Internal method to sever a model's ties to a collection.
   */
  _removeReference(model: T, _options?: Options): void {
    delete this._byId[model.cid];
    const id = this.modelId(model.attributes);
    if (id != null) delete this._byId[id as string];
    if (this === model.collection) delete model.collection;
    model.off('all', this._onModelEvent, this);
  }

  /**
   * Internal method called every time a model in the set fires an event.
   * Sets need to update their indexes when models change ids. All other
   * events simply proxy through. "add" and "remove" events that originate
   * in other collections are ignored.
   */
  _onModelEvent(event: string, model: T, collection: Collection<T>, options?: Options): void {
    if (model) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (event === 'change') {
        const prevId = this.modelId(model.previousAttributes());
        const id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId as string];
          if (id != null) this._byId[id as string] = model;
        }
      }
    }
    this.trigger.apply(this, arguments as any);
  }
}

// This "enum" defines the three possible kinds of values which can be emitted
// by a CollectionIterator that correspond to the values(), keys() and entries()
// methods on Collection, respectively.
const ITERATOR_VALUES = 1;
const ITERATOR_KEYS = 2;
const ITERATOR_KEYSVALUES = 3;

/**
 * @public
 */
export class CollectionIterator<T extends Model> {
  private _collection: Collection<T> | undefined;
  private _kind: number;
  private _index: number;

  /**
   * A CollectionIterator implements JavaScript's Iterator protocol, allowing the
   * use of `for of` loops in modern browsers and interoperation between
   * Collection and other JavaScript functions and third-party libraries
   * which can operate on Iterables.
   */
  constructor(collection: Collection<T>, kind: number) {
    this._collection = collection;
    this._kind = kind;
    this._index = 0;
  }

  next(): IteratorResult<any> {
    if (this._collection) {
      // Only continue iterating if the iterated collection is long enough.
      if (this._index < this._collection.length) {
        const model = this._collection.at(this._index);
        this._index++;

        if (!model) {
          return { value: undefined, done: true };
        }

        // Construct a value depending on what kind of values should be iterated.
        let value: T | string | number | [string | number, T];
        if (this._kind === ITERATOR_VALUES) {
          value = model;
        } else {
          const id = this._collection.modelId(model.attributes);
          if (this._kind === ITERATOR_KEYS) {
            value = id;
          } else {
            // ITERATOR_KEYSVALUES
            value = [id, model];
          }
        }
        return { value, done: false };
      }

      // Once exhausted, remove the reference to the collection so future
      // calls to the next method always return done.
      this._collection = undefined;
    }

    return { value: undefined, done: true };
  }

  [Symbol.iterator](): IterableIterator<any> {
    return this;
  }
}
