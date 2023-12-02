
/**
 * @typedef {import('lit-html').TemplateResult} TemplateResult
 */
import uniqueId from 'lodash-es/uniqueId.js';
import { render } from 'lit-html';
import EventEmitter from './eventemitter.js';

// Cached regex to split keys for `delegate`.
const delegateEventSplitter = /^(\S+)\s*(.*)$/;

class ElementView extends EventEmitter(HTMLElement) {

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

  set events (events) {
    this._declarativeEvents = events;
  }

  get events() {
    return this._declarativeEvents;
  }

  /**
   * @param {Options} options
   */
  constructor(options={}) {
    super();

    // Will be assigned to from Events
    this.stopListening = null;

    // Creating a View creates its initial element outside of the DOM,
    // if an existing element is not provided...
    this.cid = uniqueId('view');
    this._declarativeEvents = {};
    this._domEvents = [];

    const { model, collection, events } = options;

    Object.assign(this, { model: model, collection, events });
  }

  createRenderRoot() {
    // Render without the shadow DOM
    return this;
  }

  connectedCallback() {
    if (!this._initialized) {
      this.preinitialize.apply(this, arguments);
      this.initialize.apply(this, arguments);
      this._initialized = true;
    }
    this.delegateEvents();
  }

  disconnectedCallback() {
    this.undelegateEvents();
    this.stopListening?.();
  }

  /**
   * preinitialize is an empty function by default. You can override it with a function
   * or object.  preinitialize will run before any instantiation logic is run in the View
   * eslint-disable-next-line class-methods-use-this
   */
  preinitialize() {}

  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   */
  initialize() {}

  beforeRender() {}
  afterRender() {}

  /**
   * **render** is the core function that your view should override, in order
   * to populate its element (`this.el`), with the appropriate HTML. The
   * convention is for **render** to always return `this`.
   */
  render() {
    this.beforeRender();
    render(this.toHTML(), this);
    this.afterRender();
    return this;
  }

  /**
   * @returns {string|TemplateResult}
   */
  toHTML() {
    return '';
  }

  /**
   * Set callbacks, where `this.events` is a hash of
   *
   * *{"event selector": "callback"}*
   *
   *     {
   *       'mousedown .title':  'edit',
   *       'click .button':     'save',
   *       'click .open':       function(e) { ... }
   *     }
   *
   * pairs. Callbacks will be bound to the view, with `this` set properly.
   * Uses event delegation for efficiency.
   * Omitting the selector binds the event to `this.el`.
   */
  delegateEvents() {
    if (!this.events) {
      return this;
    }
    this.undelegateEvents();
    for (const key in this.events) {
      let method = this.events[key];
      if (typeof method !== 'function') method = this[method];
      if (!method) continue;
      const match = key.match(delegateEventSplitter);
      this.delegate(match[1], match[2], method.bind(this));
    }
    return this;
  }

  /**
   * Make a event delegation handler for the given `eventName` and `selector`
   * and attach it to `this.el`.
   * If selector is empty, the listener will be bound to `this.el`. If not, a
   * new handler that will recursively traverse up the event target's DOM
   * hierarchy looking for a node that matches the selector. If one is found,
   * the event's `delegateTarget` property is set to it and the return the
   * result of calling bound `listener` with the parameters given to the
   * handler.
   * @param {string} eventName
   * @param {string} selector
   * @param {(ev: Event) => any} listener
   */
  delegate(eventName, selector, listener) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const root = this;
    if (!root) {
      return this;
    }
    if (typeof selector === 'function') {
      listener = selector;
      selector = null;
    }
    // Given that `focus` and `blur` events do not bubble, do not delegate these events
    if (['focus', 'blur'].indexOf(eventName) !== -1) {
      const els = this.querySelectorAll(selector);
      for (let i = 0, len = els.length; i < len; i++) {
        const item = els[i];
        item.addEventListener(eventName, listener, false);
        this._domEvents.push({ el: item, eventName: eventName, handler: listener });
      }
      return listener;
    }

    const handler = selector
      ? function (e) {
          let node = e.target || e.srcElement;
          for (; node && node != root; node = node.parentNode) {
            if (node.matches(selector)) {
              e.delegateTarget = node;
              listener(e);
            }
          }
        }
      : listener;

    this.addEventListener(eventName, handler, false);
    this._domEvents.push({ el: this, eventName: eventName, handler: handler, listener: listener, selector: selector });
    return this;
  }

  /**
   * Clears all callbacks previously bound to the view by `delegateEvents`.
   * You usually don't need to use this, but may wish to if you have multiple
   * Backbone views attached to the same DOM element.
   */
  undelegateEvents() {
    if (this) {
      for (let i = 0, len = this._domEvents.length; i < len; i++) {
        const item = this._domEvents[i];
        item.el.removeEventListener(item.eventName, item.handler, false);
      }
      this._domEvents.length = 0;
    }
    return this;
  }

  /**
   * A finer-grained `undelegateEvents` for removing a single delegated event.
   * `selector` and `listener` are both optional.
   * @param {string} eventName
   * @param {string} selector
   * @param {(ev: Event) => any} listener
   */
  undelegate(eventName, selector, listener) {
    if (typeof selector === 'function') {
      listener = selector;
      selector = null;
    }
    if (this) {
      const handlers = this._domEvents.slice();
      let i = handlers.length;
      while (i--) {
        const item = handlers[i];
        const match =
          item.eventName === eventName &&
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

export default ElementView;
