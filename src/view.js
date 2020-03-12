//     Backbone.js 1.4.0
//     (c) 2010-2019 Jeremy Ashkenas and DocumentCloud
//     Backbone may be freely distributed under the MIT license.

// View
// ----

// Views are almost more convention than they are actual code. A View
// is simply a JavaScript object that represents a logical chunk of UI in the
// DOM. This might be a single item, an entire list, a sidebar or panel, or
// even the surrounding frame which wraps your whole app. Defining a chunk of
// UI as a **View** allows you to define your DOM events declaratively, without
// having to worry about render order ... and makes it easy for the view to
// react to specific changes in the state of your models.

import { Events } from './events.js';
import { addMethodsToObject, inherits, sync, urlError, wrapError } from './helpers.js';
import { isFunction, extend, isElement, pick, result, uniqueId } from "lodash";
import { render} from 'lit-html';

const paddedLt = /^\s*</;

// Caches a local reference to `Element.prototype` for faster access.
const ElementProto = (typeof Element !== 'undefined' && Element.prototype) || {};

const indexOf = function(array, item) {
  for (let i = 0, len = array.length; i < len; i++) if (array[i] === item) return i;
  return -1;
}

// Find the right `Element#matches` for IE>=9 and modern browsers.
const matchesSelector = ElementProto.matches ||
    ElementProto.webkitMatchesSelector ||
    ElementProto.mozMatchesSelector ||
    ElementProto.msMatchesSelector ||
    ElementProto.oMatchesSelector ||
    // Make our own `Element#matches` for IE8
    function(selector) {
      // Use querySelectorAll to find all elements matching the selector,
      // then check if the given element is included in that list.
      // Executing the query on the parentNode reduces the resulting nodeList,
      // (document doesn't have a parentNode).
      const nodeList = (this.parentNode || document).querySelectorAll(selector) || [];
      return ~indexOf(nodeList, this);
    };


// Creating a View creates its initial element outside of the DOM,
// if an existing element is not provided...
export const View = function(options) {
  this.cid = uniqueId('view');
  this._domEvents = [];
  this.preinitialize.apply(this, arguments);
  extend(this, pick(options, viewOptions));
  this._ensureElement();
  this.initialize.apply(this, arguments);
};

View.extend = inherits;

// Cached regex to split keys for `delegate`.
const delegateEventSplitter = /^(\S+)\s*(.*)$/;

// List of view options to be set as properties.
const viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

// Set up all inheritable **View** properties and methods.
extend(View.prototype, Events, {

  // The default `tagName` of a View's element is `"div"`.
  tagName: 'div',

  $: function(selector) {
    return this.el.querySelectorAll(selector);
  },

  // preinitialize is an empty function by default. You can override it with a function
  // or object.  preinitialize will run before any instantiation logic is run in the View
  preinitialize: function(){},

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // **render** is the core function that your view should override, in order
  // to populate its element (`this.el`), with the appropriate HTML. The
  // convention is for **render** to always return `this`.
  render: function() {
    isFunction(this.beforeRender) && this.beforeRender();
    isFunction(this.toHTML) && render(this.toHTML(), this.el);
    isFunction(this.afterRender) && this.afterRender();
    return this;
  },

  // Remove this view by taking the element out of the DOM, and removing any
  // applicable Backbone.Events listeners.
  remove: function() {
    this._removeElement();
    this.stopListening();
    return this;
  },

  // Remove this view's element from the document and all event listeners
  // attached to it. Exposed for subclasses using an alternative DOM
  // manipulation API.
  _removeElement: function() {
    this.undelegateEvents();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  },

  // Change the view's element (`this.el` property) and re-delegate the
  // view's events on the new element.
  setElement: function(element) {
    this.undelegateEvents();
    this._setElement(element);
    this.delegateEvents();
    return this;
  },

  // Apply the `element` to the view. `element` can be a CSS selector,
  // a string of HTML, or an Element node. If passed a NodeList or CSS
  // selector, uses just the first match.
  _setElement: function(element) {
    if (typeof element == 'string') {
      if (paddedLt.test(element)) {
        const el = document.createElement('div');
        el.innerHTML = element;
        this.el = el.firstChild;
      } else {
        this.el = document.querySelector(element);
      }
    } else if (element && !isElement(element) && element.length) {
      this.el = element[0];
    } else {
      this.el = element;
    }
  },

  // Set callbacks, where `this.events` is a hash of
  //
  // *{"event selector": "callback"}*
  //
  //     {
  //       'mousedown .title':  'edit',
  //       'click .button':     'save',
  //       'click .open':       function(e) { ... }
  //     }
  //
  // pairs. Callbacks will be bound to the view, with `this` set properly.
  // Uses event delegation for efficiency.
  // Omitting the selector binds the event to `this.el`.
  delegateEvents: function(events) {
    events || (events = result(this, 'events'));
    if (!events) return this;
    this.undelegateEvents();
    for (const key in events) {
      let method = events[key];
      if (!isFunction(method)) method = this[method];
      if (!method) continue;
      const match = key.match(delegateEventSplitter);
      this.delegate(match[1], match[2], method.bind(this));
    }
    return this;
  },

  // Make a event delegation handler for the given `eventName` and `selector`
  // and attach it to `this.el`.
  // If selector is empty, the listener will be bound to `this.el`. If not, a
  // new handler that will recursively traverse up the event target's DOM
  // hierarchy looking for a node that matches the selector. If one is found,
  // the event's `delegateTarget` property is set to it and the return the
  // result of calling bound `listener` with the parameters given to the
  // handler.
  delegate: function(eventName, selector, listener) {
    const root = this.el;
    if (!root) {
      return this;
    }
    if (typeof selector === 'function') {
      listener = selector;
      selector = null;
    }
    // Given that `focus` and `blur` events do not bubble, do not delegate these events
    if (['focus', 'blur'].indexOf(eventName) !== -1) {
      const els = this.el.querySelectorAll(selector);
      for (let i = 0, len = els.length; i < len; i++) {
        const item = els[i];
        item.addEventListener(eventName, listener, false);
        this._domEvents.push({el: item, eventName: eventName, handler: listener});
      }
      return listener;
    }

    const handler = selector ? function (e) {
      let node = e.target || e.srcElement;
      for (; node && node != root; node = node.parentNode) {
        if (matchesSelector.call(node, selector)) {
          e.delegateTarget = node;
          listener(e);
        }
      }
    } : listener;

    this.el.addEventListener(eventName, handler, false);
    this._domEvents.push({el: this.el, eventName: eventName, handler: handler, listener: listener, selector: selector});
    return this;
  },

  // Clears all callbacks previously bound to the view by `delegateEvents`.
  // You usually don't need to use this, but may wish to if you have multiple
  // Backbone views attached to the same DOM element.
  undelegateEvents: function() {
    if (this.el) {
      for (let i = 0, len = this._domEvents.length; i < len; i++) {
        const item = this._domEvents[i];
        item.el.removeEventListener(item.eventName, item.handler, false);
      }
      this._domEvents.length = 0;
    }
    return this;
  },

  // A finer-grained `undelegateEvents` for removing a single delegated event.
  // `selector` and `listener` are both optional.
  undelegate: function(eventName, selector, listener) {
    if (typeof selector === 'function') {
      listener = selector;
      selector = null;
    }
    if (this.el) {
      const handlers = this._domEvents.slice();
      let i = handlers.length;
      while (i--) {
        const item = handlers[i];
        const match = item.eventName === eventName &&
            (listener ? item.listener === listener : true) &&
            (selector ? item.selector === selector : true);

        if (!match) {
          continue;
        }
        item.el.removeEventListener(item.eventName, item.handler, false);
        this._domEvents.splice(i, 1);
      }
    }
    return this;
  },

  // Produces a DOM element to be assigned to your view. Exposed for
  // subclasses using an alternative DOM manipulation API.
  _createElement: function(tagName) {
    return document.createElement(tagName);
  },

  // Ensure that the View has a DOM element to render into.
  // If `this.el` is a string, pass it through `$()`, take the first
  // matching element, and re-assign it to `el`. Otherwise, create
  // an element from the `id`, `className` and `tagName` properties.
  _ensureElement: function() {
    if (!this.el) {
      const attrs = extend({}, result(this, 'attributes'));
      if (this.id) attrs.id = result(this, 'id');
      if (this.className) attrs['class'] = result(this, 'className');
      this.setElement(this._createElement(result(this, 'tagName')));
      this._setAttributes(attrs);
    } else {
      this.setElement(result(this, 'el'));
    }
  },

  // Set attributes from a hash on this view's element.  Exposed for
  // subclasses using an alternative DOM manipulation API.
  _setAttributes: function(attrs) {
    for (const attr in attrs) {
      attr in this.el ? this.el[attr] = attrs[attr] : this.el.setAttribute(attr, attrs[attr]);
    }
  },
});
