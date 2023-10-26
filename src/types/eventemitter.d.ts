/**
 * @function
 * @template {new(...args: any[]) => {}} ClassConstructor
 * @param {ClassConstructor} Base
 */
export function EventEmitter<ClassConstructor extends new (...args: any[]) => {}>(Base: ClassConstructor): {
    new (...args: any[]): {
        /**
         * @typedef {import('./model.js').Model} Model
         * @typedef {import('./collection.js').Collection} Collection
         * @typedef {Record.<string, any>} Options
         *
         * @callback EventCallback
         * @param {any} event
         * @param {Model} model
         * @param {Collection} collection
         * @param {Options} [options]
         */
        /**
         * Bind an event to a `callback` function. Passing `"all"` will bind
         * the callback to all events fired.
         * @param {string} name
         * @param {EventCallback} callback
         * @param {any} context
         * @return {EventEmitter}
         */
        on(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        /**
         * Inversion-of-control versions of `on`. Tell *this* object to listen to
         * an event in another object... keeping track of what it's listening to
         * for easier unbinding later.
         * @param {any} obj
         * @param {string} name
         * @param {EventCallback} [callback]
         * @return {EventEmitter}
         */
        listenTo(obj: any, name: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        /**
         * Remove one or many callbacks. If `context` is null, removes all
         * callbacks with that function. If `callback` is null, removes all
         * callbacks for the event. If `name` is null, removes all bound
         * callbacks for all events.
         * @param {string} name
         * @param {EventCallback} callback
         * @param {any} [context]
         * @return {EventEmitter}
         */
        off(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context?: any): any;
        /**
         * Tell this object to stop listening to either specific events ... or
         * to every object it's currently listening to.
         * @param {any} [obj]
         * @param {string} [name]
         * @param {EventCallback} [callback]
         * @return {EventEmitter}
         */
        stopListening(obj?: any, name?: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        /**
         * Bind an event to only be triggered a single time. After the first time
         * the callback is invoked, its listener will be removed. If multiple events
         * are passed in using the space-separated syntax, the handler will fire
         * once for each event, not once for a combination of all events.
         * @param {string} name
         * @param {EventCallback} callback
         * @param {any} context
         * @return {EventEmitter}
         */
        once(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context: any): any;
        /**
         * Inversion-of-control versions of `once`.
         * @param {any} obj
         * @param {string} name
         * @param {EventCallback} [callback]
         * @return {EventEmitter}
         */
        listenToOnce(obj: any, name: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        /**
         * Trigger one or many events, firing all bound callbacks. Callbacks are
         * passed the same arguments as `trigger` is, apart from the event name
         * (unless you're listening on `"all"`, which will cause your callback to
         * receive the true name of the event as the first argument).
         * @param {string} name
         * @return {EventEmitter}
         */
        trigger(name: string, ...args: any[]): any;
    };
} & ClassConstructor;
export default EventEmitter;
//# sourceMappingURL=eventemitter.d.ts.map