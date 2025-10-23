/**
 * IndexedDB, localStorage and sessionStorage adapter
 */
import * as memoryDriver from 'localforage-driver-memory';
import cloneDeep from 'lodash-es/cloneDeep';
import isString from 'lodash-es/isString';
import localForage from 'localforage';
import mergebounce from 'mergebounce';
import sessionStorageWrapper from './drivers/sessionStorage';
import { extendPrototype as extendPrototypeWithSetItems } from 'localforage-setitems';
import { extendPrototype as extendPrototypeWithGetItems } from '@converse/localforage-getitems/dist/localforage-getitems.es6';
import { guid } from './helpers';
import type { Model } from './model';
import type { Collection } from './collection';
import type { SyncOptions, SyncOperation } from './types';

const IN_MEMORY = memoryDriver._driver;
localForage.defineDriver(memoryDriver);
extendPrototypeWithSetItems(localForage);
extendPrototypeWithGetItems(localForage);

/**
 * @public
 */
export interface LocalForageWithExtensions {
  setItem(key: string, value: any): Promise<any>;
  getItem(key: string): Promise<any>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
  key(keyIndex: number): Promise<string>;
  keys(): Promise<string[]>;
  setItems?(items: Record<string, any>): Promise<void>;
  getItems?(keys: string[]): Promise<Record<string, any>>;
  debouncedSetItems?: {
    (items: Record<string, any>): Promise<void>;
    flush?: () => void;
  };
}

/**
 * @public
 */
class Storage {
  storeInitialized: Promise<void>;
  store: LocalForageWithExtensions;
  name: string;

  constructor(
    id: string,
    type: 'local' | 'session' | 'indexed' | 'in_memory' | LocalForageWithExtensions,
    batchedWrites = false
  ) {
    if (type === 'local' && !window.localStorage) {
      throw new Error('Skeletor.storage: Environment does not support localStorage.');
    } else if (type === 'session' && !window.sessionStorage) {
      throw new Error('Skeletor.storage: Environment does not support sessionStorage.');
    }
    if (isString(type)) {
      this.storeInitialized = this.initStore(type as 'local' | 'session' | 'indexed' | 'in_memory', batchedWrites);
    } else {
      this.store = type;
      if (batchedWrites) {
        this.store.debouncedSetItems = mergebounce((items: Record<string, any>) => this.store.setItems!(items), 50, {
          'promise': true,
        });
      }
      this.storeInitialized = Promise.resolve();
    }
    this.name = id;
  }

  /**
   * @param type - The storage type: 'local', 'session', 'indexed', or 'in_memory'
   * @param batchedWrites - Whether to enable batched writes
   */
  async initStore(type: 'local' | 'session' | 'indexed' | 'in_memory', batchedWrites: boolean): Promise<void> {
    if (type === 'session') {
      await localForage.setDriver(sessionStorageWrapper._driver);
    } else if (type === 'local') {
      await localForage.config({ 'driver': localForage.LOCALSTORAGE });
    } else if (type === 'in_memory') {
      await localForage.config({ 'driver': IN_MEMORY });
    } else if (type !== 'indexed') {
      throw new Error('Skeletor.storage: No storage type was specified');
    }
    this.store = localForage as LocalForageWithExtensions;
    if (batchedWrites) {
      this.store.debouncedSetItems = mergebounce((items: Record<string, any>) => this.store.setItems!(items), 50, {
        'promise': true,
      });
    }
  }

  flush(): void {
    if (this.store.debouncedSetItems && typeof this.store.debouncedSetItems.flush === 'function') {
      this.store.debouncedSetItems.flush();
    }
  }

  async clear(): Promise<void> {
    await this.store.removeItem(this.name).catch((e) => console.error(e));
    const re = new RegExp(`^${this.name}-`);
    const keys = await this.store.keys();
    const removed_keys = keys.filter((k) => re.test(k));
    await Promise.all(removed_keys.map((k) => this.store.removeItem(k).catch((e) => console.error(e))));
  }

  sync() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;

    async function localSync(method: SyncOperation, model: Model, options: SyncOptions) {
      let resp: any, errorMessage: string | undefined, promise: Promise<any>, new_attributes: any;

      // We get the collection (and if necessary the model attribute.
      // Waiting for storeInitialized will cause another iteration of
      // the event loop, after which the collection reference will
      // be removed from the model.
      const collection = model.collection;
      if (['patch', 'update'].includes(method)) {
        new_attributes = cloneDeep(model.attributes);
      }
      await that.storeInitialized;
      try {
        const original_attributes = model.attributes;
        switch (method) {
          case 'read':
            if (model.id !== undefined) {
              resp = await that.find(model);
            } else {
              resp = await that.findAll();
            }
            break;
          case 'create':
            resp = await that.create(model, options);
            break;
          case 'patch':
          case 'update':
            if (options.wait) {
              // When `wait` is set to true, Skeletor waits until
              // confirmation of storage before setting the values on
              // the model.
              // However, the new attributes needs to be sent, so it
              // sets them manually on the model and then removes
              // them after calling `sync`.
              // Because our `sync` method is asynchronous and we
              // wait for `storeInitialized`, the attributes are
              // already restored once we get here, so we need to do
              // the attributes dance again.
              model.attributes = new_attributes;
            }
            promise = that.update(model);
            if (options.wait) {
              model.attributes = original_attributes;
            }
            resp = await promise;
            break;
          case 'delete':
            resp = await that.destroy(model, collection);
            break;
        }
      } catch (error: any) {
        const storageSize = await that.getStorageSize();
        if (error.code === 22 && storageSize === 0) {
          errorMessage = 'Private browsing is unsupported';
        } else {
          errorMessage = error.message;
        }
      }

      if (resp) {
        if (options && options.success) {
          // When storing, we don't pass back the response (which is
          // the set attributes returned from localforage because
          // Skeletor sets them again on the model and due to the async
          // nature of localforage it can cause stale attributes to be
          // set on a model after it's been updated in the meantime.
          const data = method === 'read' ? resp : null;
          options.success(data, options);
        }
      } else {
        errorMessage = errorMessage ? errorMessage : 'Record Not Found';
        if (options && options.error) {
          options.error(errorMessage);
        }
      }
    }
    (localSync as any).__name__ = 'localSync';
    return localSync;
  }

  removeCollectionReference(model: Model, collection: Collection | undefined): Promise<any> | undefined {
    if (!collection) {
      return;
    }
    const ids = collection.filter((m) => m.id !== model.id).map((m) => this.getItemName(m.id!));

    return this.store.setItem(this.name, ids);
  }

  addCollectionReference(model: Model, collection: Collection | undefined): Promise<any> | undefined {
    if (!collection) {
      return;
    }
    const ids = collection.map((m) => this.getItemName(m.id!));
    const new_id = this.getItemName(model.id!);
    if (!ids.includes(new_id)) {
      ids.push(new_id);
    }
    return this.store.setItem(this.name, ids);
  }

  getCollectionReferenceData(model: Model): Record<string, string[]> {
    if (!model.collection) {
      return {};
    }
    const ids = model.collection.map((m) => this.getItemName(m.id!));
    const new_id = this.getItemName(model.id!);
    if (!ids.includes(new_id)) {
      ids.push(new_id);
    }
    const result: Record<string, string[]> = {};
    result[this.name] = ids;
    return result;
  }

  async save(model: Model): Promise<any> {
    if (this.store.setItems) {
      const items: Record<string, any> = {};
      items[this.getItemName(model.id!)] = model.toJSON();
      Object.assign(items, this.getCollectionReferenceData(model));
      return this.store.debouncedSetItems ? this.store.debouncedSetItems(items) : this.store.setItems!(items);
    } else {
      const key = this.getItemName(model.id!);
      const data = await this.store.setItem(key, model.toJSON());
      await this.addCollectionReference(model, model.collection);
      return data;
    }
  }

  create(model: Model, options: SyncOptions): Promise<any> {
    /* Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
     * have an id of it's own.
     */
    if (!model.id) {
      model.id = guid();
      model.set(model.idAttribute, model.id, options);
    }
    return this.save(model);
  }

  update(model: Model): Promise<any> {
    return this.save(model);
  }

  find(model: Model): Promise<any> {
    return this.store.getItem(this.getItemName(model.id!));
  }

  async findAll(): Promise<any[]> {
    /* Return the array of all models currently in storage.
     */
    const keys = (await this.store.getItem(this.name)) as string[] | null;
    if (keys?.length) {
      const items = await this.store.getItems!(keys);
      return Object.values(items);
    }
    return [];
  }

  async destroy(model: Model, collection: Collection | undefined): Promise<Model> {
    await this.flush();
    await this.store.removeItem(this.getItemName(model.id!));
    await this.removeCollectionReference(model, collection);
    return model;
  }

  async getStorageSize(): Promise<number> {
    return await this.store.length();
  }

  getItemName(id: string | number): string {
    return this.name + '-' + id;
  }
}

(Storage as any).sessionStorageInitialized = localForage.defineDriver(sessionStorageWrapper);
(Storage as any).localForage = localForage;
export default Storage;
