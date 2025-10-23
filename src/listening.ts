import { eventsApi, onApi, offApi } from './utils/events';
import type {
  EventCallback,
  IEventEmitter,
  EventCallbackMap,
  EventsApiOptions,
  ListeningType,
} from './types';

/**
 * A listening class that tracks and cleans up memory bindings
 * when all callbacks have been offed.
 */
class Listening implements ListeningType {
  id: string;
  listener: IEventEmitter;
  obj: any;
  interop: boolean;
  count: number;
  _events?: EventCallbackMap;

  constructor(listener: IEventEmitter, obj: any) {
    this.id = listener._listenId!;
    this.listener = listener;
    this.obj = obj;
    this.interop = true;
    this.count = 0;
    this._events = undefined;
  }

  start(name: string | EventCallbackMap, callback: EventCallback, context: any, _listening: ListeningType): this {
    const options: EventsApiOptions = {
      context: this.obj,
      ctx: context,
      listening: _listening,
    };

    this._events = eventsApi(onApi, this._events || {}, name, callback, options) as EventCallbackMap;

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
   */
  stop(name: string | EventCallbackMap, callback: EventCallback): void {
    let cleanup: boolean;
    if (this.interop) {
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: undefined,
        listeners: undefined,
      }) as EventCallbackMap;
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
  cleanup(): void {
    if (this.listener._listeningTo) {
      delete this.listener._listeningTo[this.obj._listenId!];
    }
    if (!this.interop && this.obj._listeners) {
      delete this.obj._listeners[this.id];
    }
  }
}

export default Listening;
