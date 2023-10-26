import { eventsApi, onApi, offApi } from './utils/events.js';

/**
 * A listening class that tracks and cleans up memory bindings
 * when all callbacks have been offed.
 */
class Listening {

  /** @typedef {import('./eventemitter.js').default} EventEmitter */

  /**
   * @param {any} listener
   * @param {any} obj
   */
  constructor(listener, obj) {
    this.id = listener._listenId;
    this.listener = listener;
    this.obj = obj;
    this.interop = true;
    this.count = 0;
    this._events = undefined;
  }

  /**
   * @param {string} name
   * @param {Function} callback
   * @param {any} context
   * @param {Listening} _listening
   */
  start(name, callback, context, _listening) {
    this._events = eventsApi(onApi, this._events || {}, name, callback, {
      context: this.obj,
      ctx: context,
      listening: _listening,
    });

    if (_listening) {
      const listeners = this.obj._listeners || (this.obj._listeners = {});
      listeners[this.id] = this;

      // Allow the listening to use a counter, instead of tracking
      // callbacks for library interop
      this.interop = false;
    }

    return this;
  }

  /**
   * Stop's listening to a callback (or several).
   * Uses an optimized counter if the listenee uses Backbone.Events.
   * Otherwise, falls back to manual tracking to support events
   * library interop.
   * @param {string} name
   * @param {Function} callback
   */
  stop(name, callback) {
    let cleanup;
    if (this.interop) {
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: undefined,
        listeners: undefined,
      });
      cleanup = !this._events;
    } else {
      this.count--;
      cleanup = this.count === 0;
    }
    if (cleanup) this.cleanup();
  }

  /**
   * Cleans up memory bindings between the listener and the listenee.
   */
  cleanup() {
    delete this.listener._listeningTo[this.obj._listenId];
    if (!this.interop) delete this.obj._listeners[this.id];
  }
}

export default Listening;
