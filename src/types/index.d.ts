export default skeletor;
declare namespace skeletor {
    let VERSION: string;
    function noConflict(): {
        Collection: typeof Collection;
        EventEmitter: typeof EventEmitter;
        Model: typeof Model;
        sync: typeof sync;
    };
}
import { Collection } from './collection.js';
import EventEmitter from './eventemitter.js';
import { Model } from './model.js';
import Storage from './storage.js';
import { sync } from './helpers.js';
export { Collection, EventEmitter, Model, Storage, sync };
//# sourceMappingURL=index.d.ts.map