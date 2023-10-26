export default Listening;
/**
 * A listening class that tracks and cleans up memory bindings
 * when all callbacks have been offed.
 */
declare class Listening {
    /** @typedef {import('./eventemitter.js').default} EventEmitter */
    /**
     * @param {any} listener
     * @param {any} obj
     */
    constructor(listener: any, obj: any);
    id: any;
    listener: any;
    obj: any;
    interop: boolean;
    count: number;
    _events: any;
    /**
     * @param {string} name
     * @param {Function} callback
     * @param {any} context
     * @param {Listening} _listening
     */
    start(name: string, callback: Function, context: any, _listening: Listening): this;
    /**
     * Stop's listening to a callback (or several).
     * Uses an optimized counter if the listenee uses Backbone.Events.
     * Otherwise, falls back to manual tracking to support events
     * library interop.
     * @param {string} name
     * @param {Function} callback
     */
    stop(name: string, callback: Function): void;
    /**
     * Cleans up memory bindings between the listener and the listenee.
     */
    cleanup(): void;
}
//# sourceMappingURL=listening.d.ts.map