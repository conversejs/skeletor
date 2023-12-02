export default ElementView;
export type TemplateResult = import('lit-html').TemplateResult;
declare const ElementView_base: {
    new (...args: any[]): {
        on(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context: any): any;
        _events: any;
        _listeners: {};
        listenTo(obj: any, name: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        _listeningTo: {};
        _listenId: any;
        off(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context?: any): any;
        stopListening(obj?: any, name?: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        once(name: string, callback: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any, context: any): any;
        listenToOnce(obj: any, name: string, callback?: (event: any, model: import("./model.js").Model, collection: import("./collection.js").Collection, options?: Record<string, any>) => any): any;
        trigger(name: string, ...args: any[]): any;
    };
} & {
    new (): HTMLElement;
    prototype: HTMLElement;
};
declare class ElementView extends ElementView_base {
    /**
     * @param {Options} options
     */
    constructor(options?: Record<string, any>);
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
    set events(arg: {});
    get events(): {};
    _declarativeEvents: {};
    stopListening: any;
    cid: any;
    _domEvents: any[];
    createRenderRoot(): this;
    connectedCallback(...args: any[]): void;
    _initialized: boolean;
    disconnectedCallback(): void;
    /**
     * preinitialize is an empty function by default. You can override it with a function
     * or object.  preinitialize will run before any instantiation logic is run in the View
     * eslint-disable-next-line class-methods-use-this
     */
    preinitialize(): void;
    /**
     * Initialize is an empty function by default. Override it with your own
     * initialization logic.
     */
    initialize(): void;
    beforeRender(): void;
    afterRender(): void;
    /**
     * **render** is the core function that your view should override, in order
     * to populate its element (`this.el`), with the appropriate HTML. The
     * convention is for **render** to always return `this`.
     */
    render(): this;
    /**
     * @returns {string|TemplateResult}
     */
    toHTML(): string | TemplateResult;
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
    delegateEvents(): this;
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
    delegate(eventName: string, selector: string, listener: (ev: Event) => any): this | ((ev: Event) => any);
    /**
     * Clears all callbacks previously bound to the view by `delegateEvents`.
     * You usually don't need to use this, but may wish to if you have multiple
     * Backbone views attached to the same DOM element.
     */
    undelegateEvents(): this;
    /**
     * A finer-grained `undelegateEvents` for removing a single delegated event.
     * `selector` and `listener` are both optional.
     * @param {string} eventName
     * @param {string} selector
     * @param {(ev: Event) => any} listener
     */
    undelegate(eventName: string, selector: string, listener: (ev: Event) => any): this;
}
//# sourceMappingURL=element.d.ts.map