export namespace Events {
    function on(name: any, callback: any, context: any): this;
    function listenTo(obj: any, name: any, callback: any): this;
    function off(name: any, callback: any, context: any): this;
    function stopListening(obj: any, name: any, callback: any): this;
    function once(name: any, callback: any, context: any): this;
    function listenToOnce(obj: any, name: any, callback: any): this;
    function trigger(name: any, ...args: any[]): typeof Events;
}
