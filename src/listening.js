import { eventsApi,  offApi } from './utils/events.js';

/**
 * A listening class that tracks and cleans up memory bindings
 * when all callbacks have been offed.
 */
class Listening {

  /** @typedef {import('./eventemitter.js').default} EventEmitter */

  /**
   * @param {EventEmitter} listener
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
