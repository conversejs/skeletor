/**
 * Iterates over the standard `event, callback` (as well as the fancy multiple
 * space-separated events `"change blur", callback` and jQuery-style event
 * maps `{event: callback}`).
 */
export function eventsApi(iteratee: any, events: any, name: any, callback: any, opts: any): any;
export function onApi(events: any, name: any, callback: any, options: any): any;
/**
 * An try-catch guarded #on function, to prevent poisoning the global
 * `_listening` variable.
 * @param {any} obj
 * @param {string} name
 * @param {Function} callback
 * @param {any} context
 */
export function tryCatchOn(obj: any, name: string, callback: Function, context: any): any;
/**
 * The reducing API that removes a callback from the `events` object.
 */
export function offApi(events: any, name: any, callback: any, options: any): any;
/**
 * Reduces the event callbacks into a map of `{event: onceWrapper}`.
 * `offer` unbinds the `onceWrapper` after it has been called.
 */
export function onceMap(map: any, name: any, callback: any, offer: any): any;
/** Handles triggering the appropriate event callbacks. */
export function triggerApi(objEvents: any, name: any, callback: any, args: any): any;
//# sourceMappingURL=events.d.ts.map