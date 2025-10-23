// Copyright 2014 Mozilla
// Copyright 2015 Thodoris Greasidis
// Copyright 2018-2025 JC Brand
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

import executeCallback from 'localforage/src/utils/executeCallback';
import getCallback from 'localforage/src/utils/getCallback';
import normalizeKey from 'localforage/src/utils/normalizeKey';
import serializer from 'localforage/src/utils/serializer';

const serialize = serializer['serialize'];
const deserialize = serializer['deserialize'];

interface DbInfo {
  keyPrefix: string;
  serializer: {
    serialize: typeof serialize;
    deserialize: typeof deserialize;
  };
  [key: string]: any;
}

interface LocalForageOptions {
  name: string;
  storeName: string;
  [key: string]: any;
}

interface IteratorCallback<T, U> {
  (value: T, key: string, iterationNumber: number): U;
}

function isSessionStorageValid(): boolean {
  try {
    if (sessionStorage && 'setItem' in sessionStorage) {
      return true;
    }
  } catch (e) {
    console.log(e);
  }
  return false;
}

function _getKeyPrefix(options: LocalForageOptions, defaultConfig: LocalForageOptions): string {
  let keyPrefix = options.name + '/';

  if (options.storeName !== defaultConfig.storeName) {
    keyPrefix += options.storeName + '/';
  }
  return keyPrefix;
}

const dbInfo: DbInfo = {
  keyPrefix: '',
  serializer: {
    serialize: serialize,
    deserialize: deserialize,
  },
};

function _initStorage(this: any, options: LocalForageOptions): void {
  dbInfo.keyPrefix = _getKeyPrefix(options, this._defaultConfig);
  if (options) {
    for (const i in options) {
      dbInfo[i] = options[i];
    }
  }
}

// Remove all keys from the datastore, effectively destroying all data in
// the app's key/value store!
function clear(callback?: (err: any) => void): Promise<void> {
  const promise = this.ready().then(function () {
    const keyPrefix = dbInfo.keyPrefix;

    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.indexOf(keyPrefix) === 0) {
        sessionStorage.removeItem(key);
      }
    }
  });

  executeCallback(promise, callback);
  return promise;
}

function getItem<T>(key: string, callback?: (err: any, value: T | null) => void): Promise<T | null> {
  key = normalizeKey(key);

  const promise = this.ready().then(function (): T | null {
    const result = sessionStorage.getItem(dbInfo.keyPrefix + key);
    // If a result was found, parse it from the serialized
    // string into a JS object. If result isn't truthy, the key
    // is likely undefined and we'll pass it straight to the
    // callback.
    if (result) {
      return dbInfo.serializer.deserialize(result) as T;
    }
    return null;
  });

  executeCallback(promise, callback);
  return promise;
}

function iterate<T, U>(
  iterator: IteratorCallback<T, U>,
  callback?: (err: any, result: U | undefined) => void
): Promise<U | undefined> {
  const self = this;

  const promise = self.ready().then(function (): U | undefined {
    const keyPrefix = dbInfo.keyPrefix;
    const keyPrefixLength = keyPrefix.length;
    const length = sessionStorage.length;
    let iterationNumber = 1;

    for (let i = 0; i < length; i++) {
      const key = sessionStorage.key(i);
      if (!key || key.indexOf(keyPrefix) !== 0) {
        continue;
      }

      // If a result was found, parse it from the serialized
      // string into a JS object. If result isn't truthy, the
      // key is likely undefined and we'll pass it straight
      // to the iterator.
      const item = sessionStorage.getItem(key);
      const value = item ? dbInfo.serializer.deserialize(item) : item;

      const result = iterator(value as T, key.substring(keyPrefixLength), iterationNumber++);
      if (result !== void 0) {
        return result;
      }
    }
    return;
  });

  executeCallback(promise, callback);
  return promise;
}

// Same as sessionStorage's key() method, except takes a callback.
function key(n: number, callback?: (err: any, key: string | null) => void): Promise<string | null> {
  const self = this;
  const promise = self.ready().then(function (): string | null {
    let result: string | null;
    try {
      result = sessionStorage.key(n);
    } catch (error) {
      result = null;
    }

    // Remove the prefix from the key, if a key is found.
    if (result) {
      result = result.substring(dbInfo.keyPrefix.length);
    }

    return result;
  });

  executeCallback(promise, callback);
  return promise;
}

function keys(callback?: (err: any, keys: string[]) => void): Promise<string[]> {
  const self = this;
  const promise = self.ready().then(function (): string[] {
    const length = sessionStorage.length;
    const keys: string[] = [];

    for (let i = 0; i < length; i++) {
      const itemKey = sessionStorage.key(i);
      if (itemKey && itemKey.indexOf(dbInfo.keyPrefix) === 0) {
        keys.push(itemKey.substring(dbInfo.keyPrefix.length));
      }
    }
    return keys;
  });

  executeCallback(promise, callback);
  return promise;
}

// Supply the number of keys in the datastore to the callback function.
function length(callback?: (err: any, numberOfKeys: number) => void): Promise<number> {
  const self = this;
  const promise = self.keys().then(function (keys: string[]) {
    return keys.length;
  });

  executeCallback(promise, callback);
  return promise;
}

function removeItem(key: string, callback?: (err: any) => void): Promise<void> {
  key = normalizeKey(key);
  const promise = this.ready().then(function () {
    sessionStorage.removeItem(dbInfo.keyPrefix + key);
  });
  executeCallback(promise, callback);
  return promise;
}

async function setItem<T>(key: string, value: T, callback?: (err: any, value: T) => void): Promise<T> {
  key = normalizeKey(key);
  await this.ready();

  value = value ?? (null as unknown as T);
  const originalValue = value;

  return new Promise<T>((resolve, reject) => {
    dbInfo.serializer.serialize(value, (serializedValue: string, error: any) => {
      if (error) {
        reject(error);
        executeCallback(Promise.reject(error), callback);
        return;
      }

      try {
        sessionStorage.setItem(dbInfo.keyPrefix + key, serializedValue);
        resolve(originalValue);
        executeCallback(Promise.resolve(originalValue), callback);
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          console.error('Your sessionStorage capacity is used up.');
        }
        reject(e);
        executeCallback(Promise.reject(e), callback);
      }
    });
  });
}

function dropInstance(options: any, callback?: (err: any) => void): Promise<void> {
  callback = getCallback.apply(this, arguments as any);

  options = (typeof options !== 'function' && options) || {};
  if (!options.name) {
    const currentConfig = this.config();
    options.name = options.name || currentConfig.name;
    options.storeName = options.storeName || currentConfig.storeName;
  }

  const self = this;
  let promise: Promise<void>;
  if (!options.name) {
    promise = Promise.reject(new Error('Invalid arguments'));
  } else {
    promise = new Promise<string>(function (resolve) {
      if (!options.storeName) {
        resolve(`${options.name}/`);
      } else {
        resolve(_getKeyPrefix(options, self._defaultConfig));
      }
    }).then(function (keyPrefix: string) {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.indexOf(keyPrefix) === 0) {
          sessionStorage.removeItem(key);
        }
      }
    });
  }

  executeCallback(promise, callback);
  return promise;
}

const sessionStorageWrapper = {
  _driver: 'sessionStorageWrapper',
  _initStorage: _initStorage,
  _support: isSessionStorageValid(),
  iterate,
  getItem,
  setItem,
  removeItem,
  clear,
  length,
  key,
  keys,
  dropInstance,
};

export default sessionStorageWrapper;
