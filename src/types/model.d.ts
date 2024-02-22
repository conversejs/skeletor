export type Collection = import('./collection.js').Collection;
export type Attributes = Record<string, any>;
export type Options = Record<string, any>;
export type ModelOptions = Record<string, any>;
declare const Model_base: {
    new (...args: any[]): {
        /**
         * @typedef {import('./collection.js').Collection} Collection
         * @typedef {Record.<string, any>} Attributes
         *
         * @typedef {Record.<string, any>} Options
         * @property {boolean} [validate]
         *
         * @typedef {Record.<string, any>} ModelOptions
         * @property {Collection} [collection]
         * @property {boolean} [parse]
         * @property {boolean} [unset]
         * @property {boolean} [silent]
         */
        /**
         * **Models** are the basic data object in the framework --
         * frequently representing a row in a table in a database on your server.
         * A discrete chunk of data and a bunch of useful, related methods for
         * performing computations and transformations on that data.
         */
        on(name: string, callback: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: Model, collection: import("./collection.js").Collection, options: Record<string, any>) => any): any;
        trigger(name: string, ...args: any[]): any;
    };
} & ObjectConstructor;
/**
 * @typedef {import('./collection.js').Collection} Collection
 * @typedef {Record.<string, any>} Attributes
 *
 * @typedef {Record.<string, any>} Options
 * @property {boolean} [validate]
 *
 * @typedef {Record.<string, any>} ModelOptions
 * @property {Collection} [collection]
 * @property {boolean} [parse]
 * @property {boolean} [unset]
 * @property {boolean} [silent]
 */
/**
 * **Models** are the basic data object in the framework --
 * frequently representing a row in a table in a database on your server.
 * A discrete chunk of data and a bunch of useful, related methods for
 * performing computations and transformations on that data.
 */
export class Model extends Model_base {
    /**
     * Create a new model with the specified attributes. A client id (`cid`)
     * is automatically generated and assigned for you.
     * @param {Attributes} [attributes]
     * @param {ModelOptions} [options]
     */
    constructor(attributes?: Attributes, options?: ModelOptions, ...args: any[]);
    cid: any;
    attributes: {};
    validationError: string;
    collection: any;
    changed: {};
    /**
     * @param {Storage} storage
     */
    set browserStorage(arg: Storage);
    /**
     * @returns {Storage} storage
     */
    get browserStorage(): Storage;
    _browserStorage: Storage;
    /**
     * The default name for the JSON `id` attribute is `"id"`. MongoDB and
     * CouchDB users may want to set this to `"_id"` (by overriding this getter
     * in a subclass).
     */
    get idAttribute(): string;
    /**
     * The prefix is used to create the client id which is used to identify models locally.
     * You may want to override this if you're experiencing name clashes with model ids.
     */
    get cidPrefix(): string;
    /**
     * preinitialize is an empty function by default. You can override it with a function
     * or object.  preinitialize will run before any instantiation logic is run in the Model.
     */
    preinitialize(): void;
    /**
     * Initialize is an empty function by default. Override it with your own
     * initialization logic.
     */
    initialize(): void;
    /**
     * @param {object} attrs
     * @param {object} [options]
     * @returns {string} The validation error message
     */
    validate(attrs: object, options?: object): string;
    /**
     * Return a copy of the model's `attributes` object.
     */
    toJSON(): any;
    /**
     * Override this if you need custom syncing semantics for *this* particular model.
     * @param {'create'|'update'|'patch'|'delete'|'read'} method
     * @param {Model} model
     * @param {Options} options
     */
    sync(method: 'create' | 'update' | 'patch' | 'delete' | 'read', model: Model, options: Options): any;
    /**
     * Get the value of an attribute.
     * @param {string} attr
     */
    get(attr: string): any;
    keys(): string[];
    values(): any[];
    pairs(): [string, any][];
    entries(): [string, any][];
    invert(): any;
    pick(...args: any[]): any;
    omit(...args: any[]): any;
    isEmpty(): any;
    /**
     * Returns `true` if the attribute contains a value that is not null
     * or undefined.
     * @param {string} attr
     */
    has(attr: string): boolean;
    /**
     * Special-cased proxy to lodash's `matches` method.
     * @param {Attributes} attrs
     */
    matches(attrs: Attributes): boolean;
    /**
     * Set a hash of model attributes on the object, firing `"change"`. This is
     * the core primitive operation of a model, updating the data and notifying
     * anyone who needs to know about the change in state. The heart of the beast.
     * @param {string|Object} key
     * @param {string|Object} [val]
     * @param {Options} [options]
     */
    set(key: string | any, val?: string | any, options?: Options): false | this;
    _changing: boolean;
    _previousAttributes: any;
    id: any;
    _pending: boolean | Options;
    /**
     * Remove an attribute from the model, firing `"change"`. `unset` is a noop
     * if the attribute doesn't exist.
     * @param {string} attr
     * @param {Options} [options]
     */
    unset(attr: string, options?: Options): false | this;
    /**
     * Clear all attributes on the model, firing `"change"`.
     * @param {Options} options
     */
    clear(options: Options): false | this;
    /**
     * Determine if the model has changed since the last `"change"` event.
     * If you specify an attribute name, determine if that attribute has changed.
     * @param {string} [attr]
     */
    hasChanged(attr?: string): any;
    /**
     * Return an object containing all the attributes that have changed, or
     * false if there are no changed attributes. Useful for determining what
     * parts of a view need to be updated and/or what attributes need to be
     * persisted to the server. Unset attributes will be set to undefined.
     * You can also pass an attributes object to diff against the model,
     * determining if there *would be* a change.
     * @param {Object} diff
     */
    changedAttributes(diff: any): any;
    /**
     * Get the previous value of an attribute, recorded at the time the last
     * `"change"` event was fired.
     * @param {string} [attr]
     */
    previous(attr?: string): any;
    /**
     * Get all of the attributes of the model at the time of the previous
     * `"change"` event.
     */
    previousAttributes(): any;
    /**
     * Fetch the model from the server, merging the response with the model's
     * local attributes. Any changed attributes will trigger a "change" event.
     * @param {Options} [options={}]
     */
    fetch(options?: Options): any;
    /**
     * Set a hash of model attributes, and sync the model to the server.
     * If the server returns an attributes hash that differs, the model's
     * state will be `set` again.
     * @param {string|Attributes} [key]
     * @param {boolean|number|string|Options} [val]
     * @param {Options} [options]
     */
    save(key?: string | Attributes, val?: boolean | number | string | Options, options?: Options): any;
    /**
     * Destroy this model on the server if it was already persisted.
     * Optimistically removes the model from its collection, if it has one.
     * If `wait: true` is passed, waits for the server to respond before removal.
     * @param {Options} [options]
     */
    destroy(options?: Options): boolean;
    /**
     * Default URL for the model's representation on the server -- if you're
     * using Backbone's restful methods, override this to change the endpoint
     * that will be called.
     */
    url(): any;
    /**
     * **parse** converts a response into the hash of attributes to be `set` on
     * the model. The default implementation is just to pass the response along.
     * @param {Options} resp
     * @param {Options} [options]
     */
    parse(resp: Options, options?: Options): Options;
    /**
     * A model is new if it has never been saved to the server, and lacks an id.
     */
    isNew(): boolean;
    /**
     * Check if the model is currently in a valid state.
     * @param {Options} [options]
     */
    isValid(options?: Options): boolean;
    /**
     * Run validation against the next complete set of model attributes,
     * returning `true` if all is well. Otherwise, fire an `"invalid"` event.
     * @param {Attributes} attrs
     * @param {Options} [options]
     */
    _validate(attrs: Attributes, options?: Options): boolean;
}
export {};
//# sourceMappingURL=model.d.ts.map