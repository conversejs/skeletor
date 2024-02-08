export type Options = Record<string, any>;
export type Attributes = Record<string, any>;
export type Storage = import('./storage.js').default;
export type CollectionOptions = Record<string, any>;
declare const Collection_base: {
    new (...args: any[]): {
        on(name: string, callback: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any, context: any): any;
        _events: any; /**
         * Create a new **Collection**, perhaps to contain a specific type of `model`.
         * If a `comparator` is specified, the Collection will maintain
         * its models in sort order, as they're added and removed.
         * @param {Model[]} [models]
         * @param {CollectionOptions} [options]
         */
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: Collection, options: Record<string, any>) => any): any;
        trigger(name: string, ...args: any[]): any;
    };
} & ObjectConstructor;
/**
 * @typedef {Record.<string, any>} Options
 * @typedef {Record.<string, any>} Attributes
 *
 * @typedef {import('./storage.js').default} Storage
 *
 * @typedef {Record.<string, any>} CollectionOptions
 * @property {Model} [model]
 * @property {Function} [comparator]
 */
/**
 * If models tend to represent a single row of data, a Collection is
 * more analogous to a table full of data ... or a small slice or page of that
 * table, or a collection of rows that belong together for a particular reason
 * -- all of the messages in this particular folder, all of the documents
 * belonging to this particular author, and so on. Collections maintain
 * indexes of their models, both in order, and for lookup by `id`.
 */
export class Collection extends Collection_base {
    /**
     * Create a new **Collection**, perhaps to contain a specific type of `model`.
     * If a `comparator` is specified, the Collection will maintain
     * its models in sort order, as they're added and removed.
     * @param {Model[]} [models]
     * @param {CollectionOptions} [options]
     */
    constructor(models?: Model[], options?: CollectionOptions, ...args: any[]);
    _model: any;
    comparator: any;
    /**
     * @param {Storage} storage
     */
    set browserStorage(arg: import("./storage.js").default);
    /**
     * @returns {Storage} storage
     */
    get browserStorage(): import("./storage.js").default;
    _browserStorage: import("./storage.js").default;
    /**
     * @param {Model} model
     */
    set model(arg: typeof Model);
    /**
     * The default model for a collection is just a **Model**.
     * This should be overridden in most cases.
     * @returns {typeof Model}
     */
    get model(): typeof Model;
    get length(): any;
    /**
     * preinitialize is an empty function by default. You can override it with a function
     * or object.  preinitialize will run before any instantiation logic is run in the Collection.
     */
    preinitialize(): void;
    /**
     * Initialize is an empty function by default. Override it with your own
     * initialization logic.
     */
    initialize(): void;
    /**
     * The JSON representation of a Collection is an array of the
     * models' attributes.
     *@param {Options} options
     */
    toJSON(options: Options): any;
    /**
     *@param {string} method
     *@param {Model|Collection} model
     *@param {Options} options
     */
    sync(method: string, model: Model | Collection, options: Options): any;
    /**
     * Add a model, or list of models to the set. `models` may be
     * Models or raw JavaScript objects to be converted to Models, or any
     * combination of the two.
     *@param {Model[]|Model|Attributes|Attributes[]} models
     *@param {Options} options
     */
    add(models: Model[] | Model | Attributes | Attributes[], options: Options): any;
    /**
     * Remove a model, or a list of models from the set.
     * @param {Model|Model[]} models
     * @param {Options} options
     */
    remove(models: Model | Model[], options: Options): any;
    /**
     * Update a collection by `set`-ing a new list of models, adding new ones,
     * removing models that are no longer present, and merging models that
     * already exist in the collection, as necessary. Similar to **Model#set**,
     * the core operation for updating the data contained by the collection.
     *@param {Model[]|Model|Attributes|Attributes[]} models
     * @param {Options} options
     */
    set(models: Model[] | Model | Attributes | Attributes[], options: Options): any;
    clearStore(options?: {}, filter?: (o: any) => any): Promise<void>;
    /**
     * When you have more items than you want to add or remove individually,
     * you can reset the entire set with a new list of models, without firing
     * any granular `add` or `remove` events. Fires `reset` when finished.
     * Useful for bulk operations and optimizations.
     * @param {Model|Model[]} [models]
     * @param {Options} [options]
     */
    reset(models?: Model | Model[], options?: Options): Model | Model[];
    /**
     * Add a model to the end of the collection.
     * @param {Model} model
     * @param {Options} [options]
     */
    push(model: Model, options?: Options): any;
    /**
     * Remove a model from the end of the collection.
     * @param {Options} [options]
     */
    pop(options?: Options): any;
    /**
     * Add a model to the beginning of the collection.
     * @param {Model} model
     * @param {Options} [options]
     */
    unshift(model: Model, options?: Options): any;
    /**
     * Remove a model from the beginning of the collection.
     * @param {Options} [options]
     */
    shift(options?: Options): any;
    /** Slice out a sub-array of models from the collection. */
    slice(...args: any[]): any;
    /**
     * @param {Function|Object} callback
     * @param {any} thisArg
     */
    filter(callback: Function | any, thisArg: any): any;
    /**
     * @param {Function} pred
     */
    every(pred: Function): any;
    /**
     * @param {Model[]} values
     */
    difference(values: Model[]): any;
    max(): any;
    min(): any;
    drop(n?: number): any;
    /**
     * @param {Function|Object} pred
     */
    some(pred: Function | any): any;
    sortBy(iteratee: any): any;
    isEmpty(): boolean;
    keyBy(iteratee: any): any;
    each(callback: any, thisArg: any): any;
    forEach(callback: any, thisArg: any): any;
    includes(item: any): any;
    size(): any;
    countBy(f: any): any;
    groupBy(pred: any): any;
    /**
     * @param {number} fromIndex
     */
    indexOf(fromIndex: number): any;
    /**
     * @param {Function|string|RegExp} pred
     * @param {number} fromIndex
     */
    findLastIndex(pred: Function | string | RegExp, fromIndex: number): any;
    /**
     * @param {number} fromIndex
     */
    lastIndexOf(fromIndex: number): any;
    /**
     * @param {Function|string|RegExp} pred
     */
    findIndex(pred: Function | string | RegExp): any;
    last(): any;
    head(): any;
    first(): any;
    map(cb: any, thisArg: any): any;
    reduce(callback: any, initialValue: any): any;
    reduceRight(callback: any, initialValue: any): any;
    toArray(): any[];
    /**
     * Get a model from the set by id, cid, model object with id or cid
     * properties, or an attributes object that is transformed through modelId.
     * @param {string|number|Object|Model} obj
     */
    get(obj: string | number | any | Model): any;
    /**
     * Returns `true` if the model is in the collection.
     * @param {string|number|Object|Model} obj
     */
    has(obj: string | number | any | Model): boolean;
    /**
     * Get the model at the given index.
     * @param {number} index
     */
    at(index: number): any;
    /**
     * Return models with matching attributes. Useful for simple cases of
     * `filter`.
     * @param {Attributes} attrs
     * @param {boolean} [first]
     */
    where(attrs: Attributes, first?: boolean): any;
    /**
     * Return the first model with matching attributes. Useful for simple cases
     * of `find`.
     * @param {Attributes} attrs
     */
    findWhere(attrs: Attributes): any;
    /**
     * @param {Attributes} predicate
     * @param {number} [fromIndex]
     */
    find(predicate: Attributes, fromIndex?: number): any;
    /**
     * Force the collection to re-sort itself. You don't need to call this under
     * normal circumstances, as the set will maintain sort order as each item
     * is added.
     * @param {Options} [options]
     */
    sort(options?: Options): this;
    models: any;
    /**
     * Pluck an attribute from each model in the collection.
     * @param {string} attr
     */
    pluck(attr: string): any;
    /**
     * Fetch the default set of models for this collection, resetting the
     * collection when they arrive. If `reset: true` is passed, the response
     * data will be passed through the `reset` method instead of `set`.
     * @param {Options} options
     */
    fetch(options: Options): any;
    /**
     * Create a new instance of a model in this collection. Add the model to the
     * collection immediately, unless `wait: true` is passed, in which case we
     * wait for the server to agree.
     * @param {Model|Attributes} model
     * @param {Options} [options]
     */
    create(model: Model | Attributes, options?: Options): false | Model | (Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: Function;
        reject: Function;
    }) | Attributes;
    /**
     * **parse** converts a response into a list of models to be added to the
     * collection. The default implementation is just to pass it through.
     * @param {Object} resp
     * @param {Options} [options]
     */
    parse(resp: any, options?: Options): any;
    /**
     * Define how to uniquely identify models in the collection.
     * @param {Attributes} attrs
     */
    modelId(attrs: Attributes): any;
    /** Get an iterator of all models in this collection. */
    values(): CollectionIterator;
    /** Get an iterator of all model IDs in this collection. */
    keys(): CollectionIterator;
    /** Get an iterator of all [ID, model] tuples in this collection. */
    entries(): CollectionIterator;
    /**
     * Private method to reset all internal state. Called when the collection
     * is first initialized or reset.
     */
    _reset(): void;
    _byId: {};
    /**
     * @param {Attributes} attrs
     * @param {Options} [options]
     */
    createModel(attrs: Attributes, options?: Options): Model;
    /**
     * Prepare a hash of attributes (or other model) to be added to this
     * collection.
     * @param {Attributes|Model} attrs
     * @param {Options} [options]
     * @return {Model}
     */
    _prepareModel(attrs: Attributes | Model, options?: Options): Model;
    /**
     * Internal method called by both remove and set.
     * @param {Model[]} models
     * @param {Options} [options]
     */
    _removeModels(models: Model[], options?: Options): any[];
    /**
     * Method for checking whether an object should be considered a model for
     * the purposes of adding to the collection.
     * @param {any} model
     */
    _isModel(model: any): boolean;
    /**
     * Internal method to create a model's ties to a collection.
     * @param {Model} model
     * @param {Options} [options]
     */
    _addReference(model: Model, options?: Options): void;
    /**
     * Internal method to sever a model's ties to a collection.
     * @private
     * @param {Model} model
     * @param {Options} [options]
     */
    private _removeReference;
    /**
     * Internal method called every time a model in the set fires an event.
     * Sets need to update their indexes when models change ids. All other
     * events simply proxy through. "add" and "remove" events that originate
     * in other collections are ignored.
     * @private
     * @param {any} event
     * @param {Model} model
     * @param {Collection} collection
     * @param {Options} [options]
     */
    private _onModelEvent;
    [Symbol.iterator]: () => CollectionIterator;
}
import { Model } from './model.js';
declare class CollectionIterator {
    /**
     * A CollectionIterator implements JavaScript's Iterator protocol, allowing the
     * use of `for of` loops in modern browsers and interoperation between
     * Collection and other JavaScript functions and third-party libraries
     * which can operate on Iterables.
     * @param {Collection} collection
     * @param {Number} kind
     */
    constructor(collection: Collection, kind: number);
    _collection: Collection;
    _kind: number;
    _index: number;
    next(): {
        value: any;
        done: boolean;
    };
    [Symbol.iterator](): this;
}
export {};
//# sourceMappingURL=collection.d.ts.map