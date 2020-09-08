import extend from "lodash-es/extend.js";
import isElement from "lodash-es/isElement.js";
import isFunction from "lodash-es/isFunction.js";
import pick from "lodash-es/pick.js";
import result from "lodash-es/result.js";
import uniqueId from "lodash-es/uniqueId.js";
import { Events } from './events.js';
import { inherits, NotImplementedError } from './helpers.js';
import { render } from 'lit-html';


const paddedLt = /^\s*</;

// Caches a local reference to `Element.prototype` for faster access.
const ElementProto = (typeof Element !== 'undefined' && Element.prototype) || {};

// Cached regex to split keys for `delegate`.
const delegateEventSplitter = /^(\S+)\s*(.*)$/;

// List of view options to be set as properties.
const viewOptions = ['model', 'collection', 'events'];


export class ElementView extends HTMLElement {

  constructor(options) {
    super();
    // Creating a View creates its initial element outside of the DOM,
    // if an existing element is not provided...
    this.cid = uniqueId('view');
    this._domEvents = [];
    this.preinitialize.apply(this, arguments);
    extend(this, pick(options, viewOptions));
    this.initialize.apply(this, arguments);
  }

  get events () { // eslint-disable-line class-methods-use-this
      return null;
  }

  // preinitialize is an empty function by default. You can override it with a function
  // or object.  preinitialize will run before any instantiation logic is run in the View
  preinitialize () {  // eslint-disable-line class-methods-use-this
  }

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize() {}  // eslint-disable-line class-methods-use-this

  // **render** is the core function that your view should override, in order
  // to populate its element (`this.el`), with the appropriate HTML. The
  // convention is for **render** to always return `this`.
  render() {
    isFunction(this.beforeRender) && this.beforeRender();
    isFunction(this.toHTML) && render(this.toHTML(), this.el);
    isFunction(this.afterRender) && this.afterRender();
    return this;
  }

  // Remove this view by taking the element out of the DOM, and removing any
  // applicable Backbone.Events listeners.
  remove() {
    this._removeElement();
    this.stopListening();
    return this;
  }

  // Remove this view's element from the document and all event listeners
  // attached to it. Exposed for subclasses using an alternative DOM
  // manipulation API.
  _removeElement() {
    this.undelegateEvents();
    this.el.parentNode?.removeChild(this.el);
  }

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
  delegateEvents() {
    if (!this.events) {
      return this;
    }
    this.undelegateEvents();
    for (const key in this.events) {
      let method = this.events[key];
      if (!isFunction(method)) method = this[method];
      if (!method) continue;
      const match = key.match(delegateEventSplitter);
      this.delegate(match[1], match[2], method.bind(this));
    }
    return this;
  }

  // Make a event delegation handler for the given `eventName` and `selector`
  // and attach it to `this.el`.
  // If selector is empty, the listener will be bound to `this.el`. If not, a
  // new handler that will recursively traverse up the event target's DOM
  // hierarchy looking for a node that matches the selector. If one is found,
  // the event's `delegateTarget` property is set to it and the return the
  // result of calling bound `listener` with the parameters given to the
  // handler.
  delegate(eventName, selector, listener) {
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
        if (node.matches(selector)) {
          e.delegateTarget = node;
          listener(e);
        }
      }
    } : listener;

    this.el.addEventListener(eventName, handler, false);
    this._domEvents.push({el: this.el, eventName: eventName, handler: handler, listener: listener, selector: selector});
    return this;
  }

  // Clears all callbacks previously bound to the view by `delegateEvents`.
  // You usually don't need to use this, but may wish to if you have multiple
  // Backbone views attached to the same DOM element.
  undelegateEvents() {
    if (this.el) {
      for (let i = 0, len = this._domEvents.length; i < len; i++) {
        const item = this._domEvents[i];
        item.el.removeEventListener(item.eventName, item.handler, false);
      }
      this._domEvents.length = 0;
    }
    return this;
  }

  // A finer-grained `undelegateEvents` for removing a single delegated event.
  // `selector` and `listener` are both optional.
  undelegate(eventName, selector, listener) {
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
  }
}

// Set up all inheritable **View** properties and methods.
Object.assign(ElementView.prototype, Events);
