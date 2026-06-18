// (c) 2010-2019 Jeremy Ashkenas and DocumentCloud
// (c) 2018-2025 JC Brand
import create from 'lodash-es/create';
import extend from 'lodash-es/extend';
import has from 'lodash-es/has';
import result from 'lodash-es/result';
import { Model } from './model';
import { Collection } from './collection';
import { type SyncOptions, SyncOperation } from './types';
import type PersistentStorage from './storage';

/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
export class NotImplementedError extends Error {}

function S4(): string {
  // Generate four random hex digits.
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

export function guid(): string {
  // Generate a pseudo-GUID by concatenating random hexadecimal.
  return S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4();
}

// Helpers
// -------

// Helper function to correctly set up the prototype chain for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
//
export function inherits<T extends new (...args: any[]) => any>(
  protoProps: Record<string, any> | null,
  staticProps?: Record<string, any>,
): T {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const parent = this;
  let child: T;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function (this: any, ...args: any[]) {
      return parent.apply(this, args);
    } as unknown as T;
  }

  // Add static properties to the constructor function, if supplied.
  extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.
  child.prototype = create(parent.prototype, protoProps);
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed
  // later.
  (child as any).__super__ = parent.prototype;

  return child;
}

interface PromiseWrapper {
  isResolved: boolean;
  isPending: boolean;
  isRejected: boolean;
  resolve: ((value?: any) => void) | null;
  reject: ((reason?: any) => void) | null;
}

type ResolveablePromise = Promise<any> & PromiseWrapper;

export function getResolveablePromise(): ResolveablePromise {
  const wrapper: PromiseWrapper = {
    isResolved: false,
    isPending: true,
    isRejected: false,
    resolve: null,
    reject: null,
  };

  const promise = new Promise((resolve, reject) => {
    wrapper.resolve = resolve;
    wrapper.reject = reject;
  }) as ResolveablePromise;

  Object.assign(promise, wrapper);
  // This `then` only mirrors settlement into the state flags. It must NOT
  // rethrow on rejection: the derived promise is discarded, so rethrowing would
  // surface as an unhandled rejection whenever the promise is rejected. The real
  // consumer still awaits `promise` itself, which rejects normally.
  promise.then(
    function () {
      promise.isResolved = true;
      promise.isPending = false;
      promise.isRejected = false;
    },
    function () {
      promise.isResolved = false;
      promise.isPending = false;
      promise.isRejected = true;
    },
  );
  return promise;
}

// Throw an error when a URL is needed, and none is supplied.
export function urlError(): never {
  throw new Error('A "url" property or function must be specified');
}

// Wrap an optional error callback with a fallback error event. When a
// `promise` is supplied (the `{ promise: true }` fetch/save path), the error is
// also forwarded to `promise.reject` so the returned promise settles on failure.
export function wrapError(
  model: Model<any> | Collection<any>,
  options: any,
  promise?: ResolveablePromise,
): void {
  const error = options.error;
  options.error = function (resp: any) {
    if (error) error.call(options.context, model, resp, options);
    model.trigger('error', model, resp, options);
    promise && promise.reject && promise.reject(resp);
  };
}

// Map from CRUD to HTTP for our default `sync` implementation.
const methodMap: Record<string, string> = {
  create: 'POST',
  update: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  read: 'GET',
};

// Tracks the classes we've already warned about, so the `browserStorage`
// deprecation notice is logged at most once per class rather than once per
// instance (a collection can resolve storage once per contained model).
const warnedBrowserStorage = new WeakSet<object>();

/**
 * Emit a one-time-per-class deprecation warning nudging downstream code from
 * the `browserStorage` alias to the canonical `storage` accessor.
 */
export function warnBrowserStorageDeprecation(obj: Model<any> | Collection<any>): void {
  const ctor = obj?.constructor;
  if (!ctor || warnedBrowserStorage.has(ctor)) return;
  warnedBrowserStorage.add(ctor);
  const name = (ctor as { name?: string }).name;
  console.warn(
    `Skeletor: \`browserStorage\` is deprecated and will be removed in a future major version; ` +
      `use \`storage\` instead${name ? ` (on \`${name}\`)` : ''}.`,
  );
}

/**
 * Return the PersistentStorage instance configured on `obj`, checking both
 * the canonical `storage` accessor and the deprecated `browserStorage` alias
 * so that subclasses that still override `get browserStorage()` continue to work.
 * @public
 */
export function getStorage(obj: Model<any> | Collection<any> | null | undefined): PersistentStorage | undefined {
  if (!obj) return undefined;
  const storage = result(obj, 'storage') as PersistentStorage | undefined;
  if (storage != null) return storage;
  // Fall back to the deprecated alias; warn only when it actually supplies the
  // store, so storage-less models/collections don't trip the notice.
  const legacy = result(obj, 'browserStorage') as PersistentStorage | undefined;
  if (legacy != null) warnBrowserStorageDeprecation(obj);
  return legacy;
}

export function getSyncMethod(model: Model | Collection<any>): typeof sync & { __name__?: string } {
  const store = getStorage(model) || getStorage((model as Model).collection);
  return store ? store.sync() : sync;
}

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
 */
/**
 * @public
 */
export function sync(method: SyncOperation, model: Model | Collection<any>, options: SyncOptions = {}): Promise<any> {
  let data = options.data;

  // Ensure that we have the appropriate request data.
  if (data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
    data = options.attrs || model.toJSON();
  }

  const type = methodMap[method];
  const params: RequestInit & { success?: any; error?: any } = {
    method: type,
    body: data ? JSON.stringify(data) : '',
    headers: {
      'Content-Type': 'application/json',
    },
    success: options.success,
    error: options.error,
  };

  const url = options.url || result(model, 'url') || urlError();
  const xhr = fetch(url, params);
  if (options) {
    options.xhr = xhr;
  }
  model.trigger('request', model, xhr, { ...params, xhr });
  return xhr;
}
