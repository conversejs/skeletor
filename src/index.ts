/* global global */
import EventEmitter from './eventemitter';
import Storage from './storage';
import { Collection } from './collection';
import { Model } from './model';
import { sync } from './helpers';

interface SkeletorType {
  Collection: typeof Collection;
  EventEmitter: typeof EventEmitter;
  Model: typeof Model;
  sync: typeof sync;
  VERSION?: string;
  noConflict?: () => SkeletorType;
}

const skeletor: SkeletorType = {
  Collection,
  EventEmitter,
  Model,
  sync,
};

// Establish the root object, `window` (`self`) in the browser, or `global` on the server.
// We use `self` instead of `window` for `WebWorker` support.
const root =
  (typeof self == 'object' && self.self === self && self) ||
  (typeof global == 'object' && global.global === global && global);

// Current version of the library. Keep in sync with `package.json`.
skeletor.VERSION = '0.0.1';

// Save the previous value of the `Skeletor` variable, so that it can be
// restored later on, if `noConflict` is used.
const previousSkeletor = root.Skeletor;

// Runs Skeletor.js in *noConflict* mode, returning the `Skeletor` variable
// to its previous owner. Returns a reference to this Skeletor object.
skeletor.noConflict = function () {
  root.Skeletor = previousSkeletor;
  return this;
};

root.Skeletor = skeletor;
export default skeletor;

export {
  Collection,
  EventEmitter,
  Model,
  Storage,
  sync,
}
