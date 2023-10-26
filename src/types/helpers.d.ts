export function guid(): string;
export function inherits(protoProps: any, staticProps: any): any;
export function getResolveablePromise(): Promise<any> & {
    isResolved: boolean;
    isPending: boolean;
    isRejected: boolean;
    resolve: Function;
    reject: Function;
};
export function urlError(): void;
export function wrapError(model: any, options: any): void;
/**
 * @typedef {import('./model.js').Model} Model
 * @typedef {import('./collection.js').Collection} Collection
 */
/**
 * @param {Model | Collection} model
 */
export function getSyncMethod(model: Model | Collection): any;
/**
 * @typedef {Object} SyncOptions
 * @property {string} [url]
 * @property {any} [data]
 * @property {any} [attrs]
 * @property {Function} [success]
 * @property {Function} [error]
 * @property {any} [xhr]
 */
/**
 * Override this function to change the manner in which Backbone persists
 * models to the server. You will be passed the type of request, and the
 * model in question. By default makes a `fetch()` API call
 * to the model's `url()`.
 *
 * Some possible customizations could be:
 *
 * - Use `setTimeout` to batch rapid-fire updates into a single request.
 * - Persist models via WebSockets instead of Ajax.
 * - Persist models to browser storage
 *
 * @param {'create'|'update'|'patch'} method
 * @param {import('./model.js').Model} model
 * @param {SyncOptions} [options]
 */
export function sync(method: 'create' | 'update' | 'patch', model: import('./model.js').Model, options?: SyncOptions): Promise<Response>;
/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
export class NotImplementedError extends Error {
}
export type Model = import('./model.js').Model;
export type Collection = import('./collection.js').Collection;
export type SyncOptions = {
    url?: string;
    data?: any;
    attrs?: any;
    success?: Function;
    error?: Function;
    xhr?: any;
};
//# sourceMappingURL=helpers.d.ts.map