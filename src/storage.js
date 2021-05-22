/**
 * IndexedDB, localStorage and sessionStorage adapter
 */
import mergebounce from 'mergebounce';
import localForage from "localforage/src/localforage";
import * as memoryDriver from 'localforage-driver-memory';
import cloneDeep from 'lodash-es/cloneDeep.js';
import isString from 'lodash-es/isString.js';
import sessionStorageWrapper from "./drivers/sessionStorage.js";
import { extendPrototype } from 'localforage-setitems';

const IN_MEMORY = memoryDriver._driver
localForage.defineDriver(memoryDriver);
extendPrototype(localForage);

function S4() {
    // Generate four random hex digits.
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

function guid() {
    // Generate a pseudo-GUID by concatenating random hexadecimal.
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}


class Storage {

    constructor (id, type, batchedWrites=false) {
        if (type === 'local' && !window.localStorage ) {
            throw new Error("Skeletor.storage: Environment does not support localStorage.");
        } else if (type === 'session' && !window.sessionStorage ) {
            throw new Error("Skeletor.storage: Environment does not support sessionStorage.");
        }
        if (isString(type)) {
            this.storeInitialized = this.initStore(type, batchedWrites);
        } else {
            this.store = type;
            if (batchedWrites) {
                this.store.debouncedSetItems = mergebounce(
                    items => this.store.setItems(items),
                    50,
                    {'promise': true}
                );
            }
            this.storeInitialized = Promise.resolve();
        }
        this.name = id;
    }

    async initStore (type, batchedWrites) {
        if (type === 'session') {
            localForage.setDriver(sessionStorageWrapper._driver);
        } else if (type === 'local') {
            await localForage.config({'driver': localForage.LOCALSTORAGE});
        } else if (type === 'in_memory') {
            localForage.config({'driver': IN_MEMORY});
        } else if (type !== 'indexed') {
            throw new Error("Skeletor.storage: No storage type was specified");
        }
        this.store = localForage;
        if (batchedWrites) {
            this.store.debouncedSetItems = mergebounce(
                items => this.store.setItems(items),
                50,
                {'promise': true}
            );
        }
    }

    flush () {
        return this.store.debouncedSetItems?.flush();
    }

    async clear () {
        await this.store.removeItem(this.name).catch(e => console.error(e));
        const re = new RegExp(`^${this.name}-`);
        const keys = await this.store.keys();
        const removed_keys = keys.filter(k => re.test(k));
        await Promise.all(removed_keys.map(k => this.store.removeItem(k).catch(e => console.error(e))));
    }

    sync (name) {
        const that = this;

        async function localSync (method, model, options) {
            let resp, errorMessage, promise, new_attributes;

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
                    case "read":
                        if (model.id !== undefined) {
                            resp = await that.find(model);
                        } else {
                            resp = await that.findAll();
                        }
                        break;
                    case "create":
                        resp = await that.create(model, options);
                        break;
                    case 'patch':
                    case "update":
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
                        promise = that.update(model, options);
                        if (options.wait) {
                            model.attributes = original_attributes;
                        }
                        resp = await promise;
                        break;
                    case "delete":
                        resp = await that.destroy(model, collection);
                        break;
                }
            } catch (error) {
                if (error.code === 22 && that.getStorageSize() === 0) {
                    errorMessage = "Private browsing is unsupported";
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
                    const data = (method === "read") ? resp : null;
                    options.success(data, options);
                }
            } else {
                errorMessage = errorMessage ? errorMessage : "Record Not Found";
                if (options && options.error) {
                    options.error(errorMessage);
                }
            }
        }
        localSync.__name__ = 'localSync';
        return localSync;
    }

    removeCollectionReference (model, collection) {
        if (!collection) {
            return;
        }
        const ids = collection
            .filter(m => (m.id !== model.id))
            .map(m => this.getItemName(m.id));

        return this.store.setItem(this.name, ids);
    }

    addCollectionReference (model, collection) {
        if (!collection) {
            return;
        }
        const ids = collection.map(m => this.getItemName(m.id));
        const new_id = this.getItemName(model.id);
        if (!ids.includes(new_id)) {
            ids.push(new_id);
        }
        return this.store.setItem(this.name, ids);
    }

    getCollectionReferenceData (model) {
        if (!model.collection) {
            return {};
        }
        const ids = model.collection.map(m => this.getItemName(m.id));
        const new_id = this.getItemName(model.id);
        if (!ids.includes(new_id)) {
            ids.push(new_id);
        }
        const result = {};
        result[this.name] = ids;
        return result;
    }

    async save (model) {
        if (this.store.setItems) {
            const items = {}
            items[this.getItemName(model.id)] = model.toJSON();
            Object.assign(items, this.getCollectionReferenceData(model));
            return (this.store.debouncedSetItems) ?
                this.store.debouncedSetItems(items) :
                this.store.setItems(items);
        } else {
            const key = this.getItemName(model.id);
            const data = await this.store.setItem(key, model.toJSON());
            await this.addCollectionReference(model, model.collection);
            return data;
        }
    }

    create (model, options) {
        /* Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
         * have an id of it's own.
         */
        if (!model.id) {
            model.id = guid();
            model.set(model.idAttribute, model.id, options);
        }
        return this.save(model);
    }

    update (model) {
        return this.save(model);
    }

    find (model) {
        return this.store.getItem(this.getItemName(model.id));
    }

    async findAll () {
        /* Return the array of all models currently in storage.
         */
        const data = await this.store.getItem(this.name);
        if (data && data.length) {
            return Promise.all(data.map(item => this.store.getItem(item)));
        }
        return [];
    }

    async destroy (model, collection) {
        await this.flush();
        await this.store.removeItem(this.getItemName(model.id));
        await this.removeCollectionReference(model, collection);
        return model;
    }

    getStorageSize () {
        return this.store.length;
    }

    getItemName (id) {
        return this.name+"-"+id;
    }
}

Storage.sessionStorageInitialized = localForage.defineDriver(sessionStorageWrapper);
Storage.localForage = localForage;
export default Storage;
