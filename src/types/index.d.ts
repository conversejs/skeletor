export default skeletor;
declare namespace skeletor {
    let VERSION: string;
    function noConflict(): {
        Collection: typeof Collection;
        ElementView: typeof ElementView;
        EventEmitter: typeof EventEmitter;
        Model: typeof Model;
        sync: typeof sync;
    };
}
import { Collection } from './collection.js';
import ElementView from './element.js';
import EventEmitter from './eventemitter.js';
import { Model } from './model.js';
import Storage from './storage.js';
import { sync } from './helpers.js';
export { Collection, ElementView, EventEmitter, Model, Storage, sync };
//# sourceMappingURL=index.d.ts.map