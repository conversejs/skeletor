/**
 * @copyright 2010-2019 Jeremy Ashkenas and DocumentCloud
 * @copyright 2023 JC Brand
 */
import isEmpty from 'lodash-es/isEmpty.js';
import keys from 'lodash-es/keys.js';
import uniqueId from 'lodash-es/uniqueId.js';
import Listening from './listening.js';
import { eventsApi, onApi, offApi, onceMap, tryCatchOn, triggerApi } from './utils/events.js';

// A private global variable to share between listeners and listenees.
let _listening;

/**
 * @function
 * @template {new(...args: any[]) => {}} ClassConstructor
 * @param {ClassConstructor} Base
 */
export function EventEmitter(Base) {
  return class EventEmitter extends Base {
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
    on(name, callback, context) {
      this._events = eventsApi(onApi, this._events || {}, name, callback, {
        context: context,
        ctx: this,
        listening: _listening,
      });

      if (_listening) {
        const listeners = this._listeners || (this._listeners = {});
        listeners[_listening.id] = _listening;
        // Allow the listening to use a counter, instead of tracking
        // callbacks for library interop
        _listening.interop = false;
      }

      return this;
    }

    /**
     * Inversion-of-control versions of `on`. Tell *this* object to listen to
     * an event in another object... keeping track of what it's listening to
     * for easier unbinding later.
     * @param {any} obj
     * @param {string} name
     * @param {EventCallback} [callback]
     * @return {EventEmitter}
     */
    listenTo(obj, name, callback) {
      if (!obj) return this;
      const id = obj._listenId || (obj._listenId = uniqueId('l'));
      const listeningTo = this._listeningTo || (this._listeningTo = {});
      let listening = (_listening = listeningTo[id]);

      // This object is not listening to any other events on `obj` yet.
      // Setup the necessary references to track the listening callbacks.
      if (!listening) {
        this._listenId || (this._listenId = uniqueId('l'));
        listening = _listening = listeningTo[id] = new Listening(this, obj);
      }

      // Bind callbacks on obj.
      const error = tryCatchOn(obj, name, callback, this);
      _listening = undefined;

      if (error) throw error;
      // If the target obj is not Backbone.Events, track events manually.
      if (listening.interop) listening.start(name, callback, this, _listening);

      return this;
    }

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
    off(name, callback, context) {
      if (!this._events) return this;
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: context,
        listeners: this._listeners,
      });

      return this;
    }

    /**
     * Tell this object to stop listening to either specific events ... or
     * to every object it's currently listening to.
     * @param {any} [obj]
     * @param {string} [name]
     * @param {EventCallback} [callback]
     * @return {EventEmitter}
     */
    stopListening(obj, name, callback) {
      const listeningTo = this._listeningTo;
      if (!listeningTo) return this;

      const ids = obj ? [obj._listenId] : keys(listeningTo);
      for (let i = 0; i < ids.length; i++) {
        const listening = listeningTo[ids[i]];

        // If listening doesn't exist, this object is not currently
        // listening to obj. Break out early.
        if (!listening) break;

        listening.obj.off(name, callback, this);
        if (listening.interop) listening.stop(name, callback);
      }
      if (isEmpty(listeningTo)) this._listeningTo = undefined;

      return this;
    }

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
    once(name, callback, context) {
      // Map the event into a `{event: once}` object.
      const events = eventsApi(onceMap, {}, name, callback, this.off.bind(this));
      if (typeof name === 'string' && (context === null || context === undefined)) callback = undefined;
      return this.on(events, callback, context);
    }

    /**
     * Inversion-of-control versions of `once`.
     * @param {any} obj
     * @param {string} name
     * @param {EventCallback} [callback]
     * @return {EventEmitter}
     */
    listenToOnce(obj, name, callback) {
      // Map the event into a `{event: once}` object.
      const events = eventsApi(onceMap, {}, name, callback, this.stopListening.bind(this, obj));
      return this.listenTo(obj, events);
    }

    /**
     * Trigger one or many events, firing all bound callbacks. Callbacks are
     * passed the same arguments as `trigger` is, apart from the event name
     * (unless you're listening on `"all"`, which will cause your callback to
     * receive the true name of the event as the first argument).
     * @param {string} name
     * @return {EventEmitter}
     */
    trigger(name, ...args) {
      if (!this._events) return this;

      eventsApi(triggerApi, this._events, name, undefined, args);
      return this;
    }
  };
}

export default EventEmitter;
