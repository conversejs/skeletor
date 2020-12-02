// Copyright 2014 Mozilla
// Copyright 2015 Thodoris Greasidis
// Copyright 2018 JC Brand
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import executeCallback from "localforage/src/utils/executeCallback";
import getCallback from "localforage/src/utils/getCallback";
import { Promise } from "window-or-global";

function isNoStorageValid() {
  return true;
}
function _getKeyPrefix(options, defaultConfig) {
    let keyPrefix = options.name + '/';

    if (options.storeName !== defaultConfig.storeName) {
        keyPrefix += options.storeName + '/';
    }
    return keyPrefix;
}

const dbInfo = {};

function _initStorage(options) {
  dbInfo.keyPrefix = _getKeyPrefix(options, this._defaultConfig);
  if (options) {
    for (const i in options) { // eslint-disable-line guard-for-in
      dbInfo[i] = options[i];
    }
  }
}

function clear(callback) {
  const promise = Promise.resolve();
  executeCallback(promise, callback);
  return promise;
}

function getItem(key, callback) {
  const promise = this.ready().then(function () {
    return undefined;
  });
  executeCallback(promise, callback);
  return promise;
}

function iterate(iterator, callback) {
  const promise = Promise.resolve();
  executeCallback(promise, callback);
  return promise;
}

function key(n, callback) {
  const self = this;
  const promise = self.ready().then(function () {
    return null;
  });

  executeCallback(promise, callback);
  return promise;
}

function keys(callback) {
  const self = this;
  const promise = self.ready().then(function () {
    return [];
  });

  executeCallback(promise, callback);
  return promise;
}

function length(callback) {
  const self = this;
  const promise = self.keys().then(function (keys) {
    return keys.length;
  });

  executeCallback(promise, callback);
  return promise;
}

function removeItem(key, callback) {
  const promise = Promise.resolve();
  executeCallback(promise, callback);
  return promise;
}

function setItem(key, value, callback) {
  const promise = Promise.resolve(value);
  executeCallback(promise, callback);
  return promise;
}

function dropInstance(options, callback) {
  callback = getCallback.apply(this, arguments);

  options = (typeof options !== "function" && options) || {};
  if (!options.name) {
    const currentConfig = this.config();
    options.name = options.name || currentConfig.name;
    options.storeName = options.storeName || currentConfig.storeName;
  }

  const self = this;
  let promise;
  if (!options.name) {
    promise = Promise.reject(new Error("Invalid arguments"));
  } else {
    promise = Promise.resolve();
  }

  executeCallback(promise, callback);
  return promise;
}

const noStorageWrapper = {
  _driver: "noStorageWrapper",
  _initStorage: _initStorage,
  _support: isNoStorageValid(),
  iterate: iterate,
  getItem: getItem,
  setItem: setItem,
  removeItem: removeItem,
  clear: clear,
  length: length,
  key: key,
  keys: keys,
  dropInstance: dropInstance,
};

export default noStorageWrapper;
