import clone from 'lodash-es/clone';
import countBy from 'lodash-es/countBy';
import eq from 'lodash-es/eq';
import groupBy from 'lodash-es/groupBy';
import isFunction from 'lodash-es/isFunction';
import isString from 'lodash-es/isString';
import keyBy from 'lodash-es/keyBy';
import matches from 'lodash-es/matches';
import sortBy from 'lodash-es/sortBy';
import { EventEmitterObject } from './eventemitter';
import PersistentStorage from './storage';
import {
  bridgeSyncToPromise,
  getResolveablePromise,
  getStorage,
  getSyncMethod,
  warnBrowserStorageDeprecation,
  wrapError,
} from './helpers';
import { ensureUnloadListener } from './autosync';
import { Model } from './model';
import {
  CollectionOptions,
  Comparator,
  EventCallback,
  FetchOrCreateOptions,
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
 * Normalizes the predicate forms accepted by the query methods into one
 * `(model) => value` function. A function is used as-is, a string reads that
 * attribute, and an attributes object becomes a lodash `matches` matcher.
 *
 * The matcher is built here, once per scan. Calling `Model#matches` per model
 * instead rebuilds the match data for every model visited, which made
 * `findWhere` an order of magnitude slower than a hand-written predicate.
 */
function toModelPredicate<T extends Model>(
  pred: ((model: T) => any) | string | Partial<ModelAttributes>,
): (model: T) => any {
  if (isFunction(pred)) return pred as (model: T) => any;
  if (isString(pred)) return (m: T) => m.get(pred);
  const matcher = matches(pred);
  return (m: T) => matcher(m.attributes);
}

/**
 * Defines one index of a collection: either the name of an attribute, or a
 * function returning the key (or an array of keys) to file the model under.
 * Only primitive keys are indexed. `null`, `undefined` and objects are skipped.
 */
export type IndexSpec<T extends Model = Model> = string | ((model: T) => unknown);

/** A built index: the models filed under each key, and the keys of each model. */
interface CollectionIndex<T extends Model> {
  spec: IndexSpec<T>;
  buckets: Map<unknown, Set<T>>;
  keys: Map<T, unknown[]>;
}

const NO_KEYS: unknown[] = [];

function isIndexable(key: unknown): boolean {
  return key != null && typeof key !== 'object' && typeof key !== 'function';
}

/** The keys a model belongs under, for the given index definition. */
function indexKeys<T extends Model>(spec: IndexSpec<T>, model: T): unknown[] {
  if (isString(spec)) {
    // Through `get`, so that a computed property can be indexed too.
    const value = model.get(spec);
    return isIndexable(value) ? [value] : NO_KEYS;
  }
  const value = spec(model);
  if (Array.isArray(value)) {
    const keys = value.filter(isIndexable);
    return keys.length > 1 ? [...new Set(keys)] : keys;
  }
  return isIndexable(value) ? [value] : NO_KEYS;
}

function unindexModel<T extends Model>(index: CollectionIndex<T>, model: T): void {
  const keys = index.keys.get(model);
  if (!keys) return;
  index.keys.delete(model);
  for (const key of keys) {
    const bucket = index.buckets.get(key);
    if (bucket?.delete(model) && !bucket.size) index.buckets.delete(key);
  }
}

/**
 * File a model under its current keys. The keys it was filed under before are
 * remembered per model, so it can be moved or removed whatever its attributes
 * have become since.
 */
function indexModel<T extends Model>(index: CollectionIndex<T>, model: T): void {
  const keys = indexKeys(index.spec, model);
  const prev = index.keys.get(model);
  if (prev) {
    if (prev.length === keys.length && prev.every((key, i) => key === keys[i])) return;
    unindexModel(index, model);
  }
  if (!keys.length) return;
  index.keys.set(model, keys);
  for (const key of keys) {
    const bucket = index.buckets.get(key);
    if (bucket) bucket.add(model);
    else index.buckets.set(key, new Set([model]));
  }
}

/**
 * Load the collection's members from storage. A module-level function rather
 * than a `#private` method so the published declarations carry no private
 * members, which TypeScript 6 rejects in anonymously extended classes (TS4094).
 */
async function hydrate(collection: Collection<any>): Promise<void> {
  ensureUnloadListener(PersistentStorage);
  // An empty store is a normal first-run state: findAll() returns [] and a
  // missing model record resolves to null, so hydration resolves rather
  // than rejecting.
  await collection.fetch({ fromStorage: true, promise: true });
}

/**
 * `model` and `comparator` are declared on an interface merged with the class
 * rather than on the class itself, so that subclasses may override them either
 * as instance properties (`model = Contact`) or as accessors (`get model()`).
 * TypeScript rejects the one form overriding the other (TS2610, TS2611) only
 * when the base member is declared on a class.
 */
export interface Collection<T extends Model = Model> {
  /**
   * The model class to instantiate when raw attributes are added. Defaults to
   * `Model` when unset. Typed loosely so that model classes whose constructors
   * take required or narrower attributes and options fit.
   */
  model: new (attributes?: any, options?: any) => T;
  comparator: Comparator<T>;
  /**
   * Extra lookup indexes, by name. Each is either an attribute name or a
   * function returning the key or keys to file a model under:
   *
   *     indexes = {
   *       nick: 'nick',
   *       ids: (m) => [m.get('msgid'), m.get('origin_id')],
   *     };
   *
   * Query them with `getBy` and `getAllBy`. `where` and `findWhere` use an
   * attribute index by themselves when the query has that attribute.
   *
   * An attribute index may also name a computed property.
   *
   * An index is built on its first lookup and kept current from then on, as
   * models are added, removed and changed, silently or not. A changed model
   * is refiled before its change events fire.
   */
  indexes?: Record<string, IndexSpec<T>>;
}

/**
 * @public
 * If models tend to represent a single row of data, a Collection is
 * more analogous to a table full of data ... or a small slice or page of that
 * table, or a collection of rows that belong together for a particular reason
 * -- all of the messages in this particular folder, all of the documents
 * belonging to this particular author, and so on. Collections maintain
 * indexes of their models, both in order, and for lookup by `id`.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- see the interface above
export class Collection<T extends Model = Model> extends EventEmitterObject {
  [key: symbol]: () => CollectionIterator<T>;
  _storage?: PersistentStorage;
  _url: string = '';
  hydrated?: Promise<void>;
  models: T[];
  /** The models, by id. */
  protected _byId: Record<string, T>;
  /** The models, by cid. Kept apart from `_byId`, so that an id such as `c1` can't collide with a cid. */
  protected _byCid: Record<string, T>;
  /** The id each model is filed under in `_byId`, by cid. */
  protected _idByCid: Record<string, string | number>;
  /** The indexes built so far, by name. See `indexes`. */
  protected _indexes?: Map<string, CollectionIndex<T>>;

  /**
   * Create a new **Collection**, perhaps to contain a specific type of `model`.
   * If a `comparator` is specified, the Collection will maintain
   * its models in sort order, as they're added and removed.
   */
  constructor(models?: T[] | ModelAttributes[] | T | ModelAttributes, options?: CollectionOptions<T>) {
    super();
    options = options || {};
    this.preinitialize.apply(this, arguments as any);
    if (options.model) this.model = options.model;
    if (options.comparator !== undefined) this.comparator = options.comparator;
    if (options.indexes) this.indexes = options.indexes;
    this._reset();
    this.initialize.apply(this, arguments as any);
    if (models) this.reset(models, Object.assign({ silent: true }, options));

    this[Symbol.iterator] = this.values;
    // When autoSync is on, `hydrated` is always a Promise so callers can
    // uniformly `await collection.hydrated`; it resolves immediately when
    // there's no storage to hydrate from.
    if (this.autoSync) {
      this.hydrated = getStorage(this) ? hydrate(this) : Promise.resolve();
    }
  }

  /**
   * The canonical storage accessor. Set to a `PersistentStorage` instance
   * to enable local persistence for this collection.
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
   * Override to return `true` to automatically load the collection from
   * storage on construction. Await `hydrated` to know when hydration
   * is complete.
   *
   * Note: collection `autoSync` is hydrate-only. Unlike `Model`, it does
   * **not** schedule auto-saves when the collection changes (`add`/`remove`/
   * `reset`). Persisting members is each model's responsibility — enable
   * `autoSync` on the contained model class and every model writes its own
   * record. A collection-level write would be redundant with that.
   */
  get autoSync(): boolean {
    return false;
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
            }),
          );
        });
      }),
    );
    await getStorage(this)?.clear();
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
    this._indexes = undefined;
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
    return this.models.filter(toModelPredicate(callback), thisArg);
  }

  every(pred: ((attrs: ModelAttributes) => boolean) | Options): boolean {
    if (isFunction(pred)) {
      return this.models.every((m) => (pred as (attrs: ModelAttributes) => boolean)(m.attributes));
    }
    return this.models.every(toModelPredicate(pred));
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
      return this.models.some((m) => (pred as (attrs: ModelAttributes) => boolean)(m.attributes));
    }
    return this.models.some(toModelPredicate(pred));
  }

  sortBy(iteratee: string | ((model: T) => any) | Partial<ModelAttributes>): T[] {
    return sortBy(this.models, toModelPredicate(iteratee));
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
    return countBy(this.models, toModelPredicate(f));
  }

  groupBy(pred: string | ((model: T) => string | number) | Partial<ModelAttributes>): Record<string, T[]> {
    return groupBy(this.models, toModelPredicate(pred));
  }

  indexOf(model: T, fromIndex?: number): number {
    return this.models.indexOf(model, fromIndex);
  }

  findLastIndex(pred: ((model: T) => boolean) | string | Partial<ModelAttributes>, fromIndex?: number): number {
    return this.models.findLastIndex(toModelPredicate(pred), fromIndex);
  }

  lastIndexOf(model: T, fromIndex?: number): number {
    return this.models.lastIndexOf(model, fromIndex);
  }

  findIndex(pred: ((model: T) => boolean) | string | Partial<ModelAttributes>): number {
    return this.models.findIndex(toModelPredicate(pred));
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
    return this.models.map(toModelPredicate(cb), thisArg);
  }

  reduce<U = T>(callback: (accumulator: U, model: T, index: number, array: T[]) => U, initialValue?: U): U | T {
    return this.models.reduce(callback, initialValue || this.models[0]);
  }

  reduceRight<U = T>(callback: (accumulator: U, model: T, index: number, array: T[]) => U, initialValue?: U): U | T {
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
    if (typeof obj !== 'object') return this._byId[obj] || this._byCid[obj];
    const id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
    return (id != null && this._byId[id as string]) || (obj.cid != null ? this._byCid[obj.cid] : undefined);
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
    const candidates = this._indexedCandidates(attrs);
    if (candidates) {
      // The candidates are still matched against the query, for its other
      // attributes.
      const keys = Object.keys(attrs);
      let predicate: (model: T) => any;
      if (keys.length === 1) {
        // Skips building a lodash matcher, which costs more than the lookup.
        const key = keys[0];
        const value = attrs[key];
        predicate = (m) => eq(m.attributes[key], value);
      } else {
        predicate = toModelPredicate<T>(attrs);
      }
      return first ? candidates.find(predicate) : candidates.filter(predicate);
    }
    return this[first ? 'find' : 'filter'](attrs);
  }

  /**
   * Return the first model, in collection order, filed under `key` in the
   * index called `name`. See `indexes`.
   */
  getBy(name: string, key: unknown): T | undefined {
    const bucket = this._getIndex(name).buckets.get(key);
    if (!bucket) return undefined;
    if (bucket.size === 1) return bucket.values().next().value;
    return this.models.find((m) => bucket.has(m));
  }

  /**
   * Return all models, in collection order, filed under `key` in the index
   * called `name`. See `indexes`.
   */
  getAllBy(name: string, key: unknown): T[] {
    const bucket = this._getIndex(name).buckets.get(key);
    if (!bucket) return [];
    if (bucket.size === 1) return [...bucket];
    return this.models.filter((m) => bucket.has(m));
  }

  /**
   * Return the index called `name`, building it from the current models if
   * this is its first use.
   */
  protected _getIndex(name: string): CollectionIndex<T> {
    let index = this._indexes?.get(name);
    if (!index) {
      const indexes = this.indexes;
      const spec = indexes && Object.prototype.hasOwnProperty.call(indexes, name) ? indexes[name] : undefined;
      if (spec == null) throw new Error(`Collection has no index called "${name}"`);
      index = { spec, buckets: new Map(), keys: new Map() };
      for (let i = 0; i < this.models.length; i++) indexModel(index, this.models[i]);
      (this._indexes ??= new Map()).set(name, index);
    }
    return index;
  }

  /**
   * Called on a member model's `write` event, which fires before its change
   * events and also when they are silenced. Refiles it under its id, which
   * `modelId` may derive from any attribute, and in the built indexes.
   */
  protected _onModelWrite(model: T, changes: string[]): void {
    const id = this.modelId(model.attributes);
    const prevId = this._idByCid[model.cid];
    if (prevId !== id) {
      if (prevId != null && this._byId[prevId] === model) delete this._byId[prevId];
      if (id != null) {
        this._byId[id] = model;
        this._idByCid[model.cid] = id;
      } else {
        delete this._idByCid[model.cid];
      }
    }
    this._indexes?.forEach((index) => {
      if (!isString(index.spec) || changes.includes(index.spec)) indexModel(index, model);
    });
  }

  /** Drop a model from the built indexes. */
  protected _unindex(model: T): void {
    this._indexes?.forEach((index) => unindexModel(index, model));
    delete this._idByCid[model.cid];
  }

  /**
   * The models an attribute index narrows an attributes query down to, or
   * `undefined` when no index applies and the whole collection must be scanned.
   */
  protected _indexedCandidates(attrs: unknown): T[] | undefined {
    const indexes = this.indexes;
    if (!indexes || attrs == null || typeof attrs !== 'object') return undefined;
    for (const name of Object.keys(indexes)) {
      const spec = indexes[name];
      if (isString(spec) && Object.prototype.hasOwnProperty.call(attrs, spec) && isIndexable(attrs[spec])) {
        return this.getAllBy(name, attrs[spec]);
      }
    }
    return undefined;
  }

  /**
   * Return the first model with matching attributes. Useful for simple cases
   * of `find`.
   */
  findWhere(attrs: ModelAttributes): T | undefined {
    return this.where(attrs, true) as T | undefined;
  }

  find(predicate: ((model: T) => boolean) | Partial<ModelAttributes> | string, fromIndex?: number): T | undefined {
    return this.models.find(toModelPredicate(predicate), fromIndex);
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
    const promise = options.promise ? getResolveablePromise() : undefined;

    options.success = function (resp: any) {
      const method = options.reset ? 'reset' : 'set';
      // fromStorage prevents individual model set() calls from triggering auto-save on reads
      collection[method](resp, Object.assign({}, options, { fromStorage: true }));
      if (success) success.call(options.context, collection, resp, options);
      // Fire 'sync' before resolving, as `Model.fetch`/`save` do, so a throwing
      // listener rejects the promise instead of being lost.
      collection.trigger('sync', collection, resp, options);
      promise && promise.resolve();
    };
    wrapError(this, options, promise);

    // With `promise`, the sync's outcome is bridged to it however the sync
    // reports it: through the callbacks, or through the promise it returns.
    const result = bridgeSyncToPromise(options, promise, () => this.sync('read', this, options));
    return promise ?? result;
  }

  /**
   * Create a new instance of a model in this collection. Add the model to the
   * collection immediately, unless `wait: true` is passed, in which case we
   * wait for the server to agree.
   */
  create(model: T | ModelAttributes, options?: FetchOrCreateOptions): Promise<T> | T {
    options = options ? clone(options) : {};
    const wait = options.wait;
    const return_promise = options.promise;
    const promise = return_promise && getResolveablePromise();

    // `_prepareModel` reports attributes that fail validation by firing
    // `'invalid'` and returning null. With `promise`, capture that error so a
    // rejected promise is handed back rather than `null`.
    let validationError: any;
    const captureInvalid = (_c: unknown, err: any) => (validationError = err);
    if (return_promise) this.on('invalid', captureInvalid);
    const preparedModel = this._prepareModel(model, options);
    if (return_promise) this.off('invalid', captureInvalid);
    if (!preparedModel) {
      if (!return_promise) return null;
      promise.reject(validationError);
      return promise;
    }

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

    // `options.promise` is passed through, so `save` installs its own bridge
    // from the sync's returned promise to its callbacks: a sync that resolves
    // without calling them still reaches the wired `options.success` above,
    // which resolves our promise with the model. Only a rejection that bypassed
    // the callbacks (a rejecting sync, or a throwing `'sync'`/`'error'`
    // listener) still needs bridging to ours.
    const result = preparedModel.save(null, options);
    if (return_promise) {
      Promise.resolve(result).catch((e) => promise.reject(e));
      return promise;
    } else {
      return preparedModel;
    }
  }

  /**
   * Subscribe to collection changes (add, remove, reset, sort, update).
   * Returns an unsubscribe function.
   *
   * `collection.subscribe(callback)` — fires once per operation on add/remove/reset/sort (via `update`, `reset`, `sort` events).
   * `collection.subscribe(event, callback)` — subscribe to a specific event (base EventEmitter form).
   *
   * Compatible with React's `useSyncExternalStore` and other store-style APIs.
   */
  subscribe(event: string, callback: EventCallback, context?: unknown): () => void;
  subscribe(callback: (collection: this) => void): () => void;
  subscribe(
    eventOrCallback: string | ((collection: this) => void),
    callback?: EventCallback,
    context?: unknown,
  ): () => void {
    if (typeof eventOrCallback === 'function') {
      const cb = () => (eventOrCallback as (collection: this) => void)(this);
      this.on('update reset sort', cb);
      return () => this.off('update reset sort', cb);
    }
    return super.subscribe(eventOrCallback, callback, context);
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
    return attrs[(this.model ?? Model).prototype?.idAttribute || 'id'];
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
    // Without a prototype, so that ids such as `constructor` or `__proto__`
    // don't resolve to inherited members.
    this._byId = Object.create(null);
    this._byCid = Object.create(null);
    this._idByCid = Object.create(null);
    // Dropped rather than emptied: each is rebuilt on its next lookup.
    this._indexes = undefined;
  }

  createModel(attrs: ModelAttributes, options?: Options): T {
    const Klass = this.model ?? Model;
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
      delete this._byCid[model.cid];
      const id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      this._unindex(model);

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
    this._byCid[model.cid] = model;
    const id = this.modelId(model.attributes);
    if (id != null) {
      this._byId[id as string] = model;
      this._idByCid[model.cid] = id;
    }
    this._indexes?.forEach((index) => indexModel(index, model));
    model.on('all', this._onModelEvent, this);
  }

  /**
   * Internal method to sever a model's ties to a collection.
   */
  _removeReference(model: T, _options?: Options): void {
    delete this._byCid[model.cid];
    const id = this.modelId(model.attributes);
    if (id != null) delete this._byId[id as string];
    this._unindex(model);
    if (this === model.collection) delete model.collection;
    model.off('all', this._onModelEvent, this);
  }

  /**
   * Internal method called every time a model in the set fires an event.
   * A written model is refiled, a destroyed model is removed, and all events
   * proxy through. "add" and "remove" events that originate in other
   * collections are ignored.
   */
  _onModelEvent(event: string, model: T, collection: Collection<T>, options?: Options): void {
    if (model) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      // Only while it is a member: a model being removed still fires events
      // until it is unbound, and must not be filed again.
      if (event === 'write' && this._byCid[model.cid] === model) {
        this._onModelWrite(model, collection as unknown as string[]);
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
