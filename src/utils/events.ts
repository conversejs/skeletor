import once from 'lodash-es/once';
import keys from 'lodash-es/keys';
import type {
  EventCallback,
  EventHandler,
  EventMap,
  EventsCallbackMap,
  Events,
  EventsApiOptions,
  IterateeFunction,
  OffApiOptions,
  OfferFunction,
  EventsHandlersMap,
} from '../types';

// Regular expression used to split event strings.
const eventSplitter = /\s+/;

/**
 * Iterates over the standard `event, callback` (as well as the fancy multiple
 * space-separated events `"change blur", callback` and jQuery-style event
 * maps `{event: callback}`).
 */
export function eventsApi(
  iteratee: IterateeFunction,
  events: Events | EventsCallbackMap | EventsHandlersMap,
  name: string | EventMap | null,
  callback: EventCallback | null,
  opts: EventsApiOptions | OffApiOptions | any[]
): Events | EventsCallbackMap | EventsHandlersMap {
  let i = 0;
  let names: string[];
  if (name && typeof name === 'object') {
    // Handle event maps.
    if (callback !== undefined && 'context' in opts && opts.context === undefined) {
      opts.context = callback;
    }
    for (names = keys(name); i < names.length; i++) {
      events = eventsApi(iteratee, events, names[i], (name as EventMap)[names[i]], opts);
    }
    return events;
  } else if (name && typeof name === 'string' && eventSplitter.test(name)) {
    // Handle space-separated event names by delegating them individually.
    for (names = name.split(eventSplitter); i < names.length; i++) {
      const result = iteratee(events, names[i], callback, opts);
      if (result !== undefined) {
        events = result as Events | EventsCallbackMap;
      }
    }
    return events;
  } else if (typeof name === 'string') {
    // Finally, standard events.
    const result = iteratee(events, name, callback, opts);
    return result !== undefined ? result as Events | EventsCallbackMap : events;
  }
  return events;
}

// The reducing API that adds a callback to the `events` object.
export function onApi(events: Events, name: string, callback: EventCallback | null, options: EventsApiOptions): Events {
  if (callback) {
    const handlers = events[name] || (events[name] = []);
    const context = options.context;
    const ctx = options.ctx;
    const listening = options.listening;
    if (listening) listening.count++;

    handlers.push({ callback, context, ctx: context || ctx, listening });
  }
  return events;
}

/**
 * An try-catch guarded #on function, to prevent poisoning the global
 * `_listening` variable.
 */
export function tryCatchOn(obj: any, name: string | EventMap, callback: EventCallback, context: any): any {
  try {
    obj.on(name, callback, context);
  } catch (e) {
    return e;
  }
}

/**
 * The reducing API that removes a callback from the `events` object.
 */
export function offApi(
  events: Events,
  name: string | null,
  callback: EventCallback | null,
  options: OffApiOptions
): Events | void {
  if (!events) return;

  const context = options.context;
  const listeners = options.listeners;
  let i = 0;
  let names: string[];

  // Delete all event listeners and "drop" events.
  if (!name && !context && !callback) {
    if (listeners) {
      for (names = keys(listeners); i < names.length; i++) {
        listeners[names[i]].cleanup();
      }
    }
    return;
  }

  names = name ? [name] : keys(events);
  for (; i < names.length; i++) {
    const currentName = names[i];
    const handlers = events[currentName];

    // Bail out if there are no events stored.
    if (!handlers) {
      continue;
    }

    // Find any remaining events.
    const remaining: EventHandler[] = [];
    for (let j = 0; j < handlers.length; j++) {
      const handler = handlers[j];
      if (
        (callback && callback !== handler.callback && callback !== (handler.callback as any)._callback) ||
        (context && context !== handler.context)
      ) {
        remaining.push(handler);
      } else {
        const listening = handler.listening;
        if (listening) listening.stop(currentName, callback!);
      }
    }

    // Replace events if there are any remaining.  Otherwise, clean up.
    if (remaining.length) {
      events[currentName] = remaining;
    } else {
      delete events[currentName];
    }
  }

  return events;
}

/**
 * Reduces the event callbacks into a map of `{event: onceWrapper}`.
 * `offer` unbinds the `onceWrapper` after it has been called.
 */
export function onceMap(
  map: EventsCallbackMap,
  name: string,
  callback: EventCallback | null,
  offer: OfferFunction
): { [name: string]: EventCallback } {
  if (callback) {
    const _once = once(function (this: any, ...args: any[]) {
      offer(name, _once);
      callback.apply(this, args);
    }) as EventCallback & { _callback?: EventCallback };
    map[name] = _once;
    _once._callback = callback;
  }
  return map;
}

/** Handles triggering the appropriate event callbacks. */
export function triggerApi(
  objEvents: EventsHandlersMap | null,
  name: string,
  _callback: EventCallback | null,
  args: any[]
): EventsHandlersMap | null {
  if (objEvents) {
    const events = objEvents[name];
    let allEvents = objEvents.all;
    if (events && allEvents) allEvents = allEvents.slice();
    if (events) triggerEvents(events, args);
    if (allEvents) triggerEvents(allEvents, [name].concat(args));
  }
  return objEvents;
}

/**
 * A difficult-to-believe, but optimized internal dispatch function for
 * triggering events. Tries to keep the usual cases speedy (most internal
 * Backbone events have 3 arguments).
 */
function triggerEvents(events: EventHandler[], args: any[]): void {
  let ev: EventHandler;
  let i = -1;
  const l = events.length;
  const a1 = args[0];
  const a2 = args[1];
  const a3 = args[2];
  switch (args.length) {
    case 0:
      while (++i < l) (ev = events[i]).callback.call(ev.ctx);
      return;
    case 1:
      while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1);
      return;
    case 2:
      while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2);
      return;
    case 3:
      while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
      return;
    default:
      while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
      return;
  }
}
