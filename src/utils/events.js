import once from 'lodash-es/once.js';
import keys from 'lodash-es/keys.js';

// Regular expression used to split event strings.
const eventSplitter = /\s+/;

/**
 * Iterates over the standard `event, callback` (as well as the fancy multiple
 * space-separated events `"change blur", callback` and jQuery-style event
 * maps `{event: callback}`).
 */
export function eventsApi(iteratee, events, name, callback, opts) {
  let i = 0,
    names;
  if (name && typeof name === 'object') {
    // Handle event maps.
    if (callback !== undefined && 'context' in opts && opts.context === undefined) opts.context = callback;
    for (names = keys(name); i < names.length; i++) {
      events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
    }
  } else if (name && eventSplitter.test(name)) {
    // Handle space-separated event names by delegating them individually.
    for (names = name.split(eventSplitter); i < names.length; i++) {
      events = iteratee(events, names[i], callback, opts);
    }
  } else {
    // Finally, standard events.
    events = iteratee(events, name, callback, opts);
  }
  return events;
}

// The reducing API that adds a callback to the `events` object.
export function onApi(events, name, callback, options) {
  if (callback) {
    const handlers = events[name] || (events[name] = []);
    const context = options.context,
      ctx = options.ctx,
      listening = options.listening;
    if (listening) listening.count++;

    handlers.push({ callback, context, ctx: context || ctx, listening });
  }
  return events;
}

/**
 * An try-catch guarded #on function, to prevent poisoning the global
 * `_listening` variable.
 * @param {any} obj
 * @param {string} name
 * @param {Function} callback
 * @param {any} context
 */
export function tryCatchOn(obj, name, callback, context) {
  try {
    obj.on(name, callback, context);
  } catch (e) {
    return e;
  }
}

/**
 * The reducing API that removes a callback from the `events` object.
 */
export function offApi(events, name, callback, options) {
  if (!events) return;

  const context = options.context,
    listeners = options.listeners;
  let i = 0,
    names;

  // Delete all event listeners and "drop" events.
  if (!name && !context && !callback) {
    for (names = keys(listeners); i < names.length; i++) {
      listeners[names[i]].cleanup();
    }
    return;
  }

  names = name ? [name] : keys(events);
  for (; i < names.length; i++) {
    name = names[i];
    const handlers = events[name];

    // Bail out if there are no events stored.
    if (!handlers) {
      break;
    }

    // Find any remaining events.
    const remaining = [];
    for (let j = 0; j < handlers.length; j++) {
      const handler = handlers[j];
      if (
        (callback && callback !== handler.callback && callback !== handler.callback._callback) ||
        (context && context !== handler.context)
      ) {
        remaining.push(handler);
      } else {
        const listening = handler.listening;
        if (listening) listening.stop(name, callback);
      }
    }

    // Replace events if there are any remaining.  Otherwise, clean up.
    if (remaining.length) {
      events[name] = remaining;
    } else {
      delete events[name];
    }
  }

  return events;
}

/**
 * Reduces the event callbacks into a map of `{event: onceWrapper}`.
 * `offer` unbinds the `onceWrapper` after it has been called.
 */
export function onceMap(map, name, callback, offer) {
  if (callback) {
    const _once = (map[name] = once(function () {
      offer(name, _once);
      callback.apply(this, arguments);
    }));
    _once._callback = callback;
  }
  return map;
}

/** Handles triggering the appropriate event callbacks. */
export function triggerApi(objEvents, name, callback, args) {
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
function triggerEvents(events, args) {
  let ev,
    i = -1;
  const l = events.length,
    a1 = args[0],
    a2 = args[1],
    a3 = args[2];
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
