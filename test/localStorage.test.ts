import { assert } from 'chai';
import root from 'window-or-global';
import { clone, extend, range } from 'lodash';
import { Collection } from '../src/collection';
import { getStorage, getSyncMethod, sync } from '../src/helpers';
import { resetForTesting, flushPending } from '../src/autosync';
import { Model } from '../src/model';
import Storage from '../src/storage';
import { ModelAttributes } from 'src/types';

describe('Storage using localStorage', function () {
  const attributes = {
    string: 'String',
    string2: 'String 2',
    number: 1337,
  };

  describe('on a Collection', function () {
    beforeEach(() => localStorage.clear());

    class TestModel extends Model {
      defaults() {
        return attributes;
      }
    }

    class TestCollection extends Collection {
      get model() {
        return TestModel;
      }
      get browserStorage() {
        return new Storage('collectionStore', 'local');
      }
    }

    it('should use `localSync`', function () {
      const collection = new TestCollection();
      collection.fetch();
      const method = getSyncMethod(collection);
      assert.equal(method.__name__, 'localSync');
    });

    it('should initially be empty', function () {
      const collection = new TestCollection();
      collection.fetch();
      assert.equal(collection.length, 0);
    });

    describe('create', function () {
      beforeEach(() => localStorage.clear());

      it('should have 1 model', async function () {
        const collection = new TestCollection();
        (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
        assert.equal(collection.length, 1);
      });

      it('should have a populated model', async function () {
        const collection = new TestCollection();
        const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
        assert.equal(collection.length, 1);
        assert.deepEqual(model.toJSON(), extend(clone(attributes), { 'id': model.id }));
      });

      it('should have assigned an `id` to the model', async function () {
        const collection = new TestCollection();
        const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
        await model.collection.browserStorage.storeInitialized;
        assert.isDefined(model.id);
      });

      it('should be saved to the localstorage', async function () {
        const collection = new TestCollection();
        const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
        await model.collection.browserStorage.storeInitialized;
        assert.isNotNull(root.localStorage.getItem('localforage/collectionStore' + '-' + model.id));
      });
    });

    describe('get (by `id`)', function () {
      beforeEach(() => localStorage.clear());

      it('should find the model with its `id`', async function () {
        const collection = new TestCollection();
        const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
        await model.collection.browserStorage.storeInitialized;
        assert.deepEqual(collection.get(model.id), model);
      });
    });

    describe('instances', function () {
      beforeEach(() => localStorage.clear());

      describe('when saved', function () {
        beforeEach(() => localStorage.clear());

        it('should persist the changes', async function () {
          const collection = new TestCollection();
          const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
          model.save({ 'string': 'String 0' });
          collection.fetch();

          assert.equal(model.get('string'), 'String 0');
        });

        describe('with a new `id`', function () {
          beforeEach(() => localStorage.clear());

          it('should have a new `id`', async function () {
            const collection = new TestCollection();
            const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
            model.save({ 'id': 1 });
            collection.fetch();

            assert.equal(model.id, 1);
          });

          it('should have kept its old properties', async function () {
            const collection = new TestCollection();
            const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
            model.save({ 'id': 1 });
            collection.fetch();

            const withId = clone(attributes) as ModelAttributes;
            withId.id = 1;
            assert.deepEqual(model.toJSON(), withId);
          });

          it('should be saved in localstorage by new id', async function () {
            const collection = new TestCollection();
            const model = (await new Promise((resolve) => collection.create({}, { 'success': resolve }))) as Model;
            model.save({ 'id': 1 });
            await new Promise((resolve) => collection.fetch({ 'success': resolve }));
            assert.isNotNull(root.localStorage.getItem('localforage/collectionStore-1'));
          });
        });
      });

      describe('destroy', function () {
        beforeEach(() => localStorage.clear());

        it('should remove all items from the collection and its store', async function () {
          const collection = new TestCollection();
          await Promise.all(
            range(5).map(() => new Promise((resolve) => collection.create({}, { 'success': resolve })))
          );
          assert.equal(collection.length, 5);
          while (collection.length) {
            collection.at(0).destroy();
          }
          const beforeFetchLength = collection.length;
          collection.fetch();
          const afterFetchLength = collection.length;

          assert.equal(beforeFetchLength, 0);
          assert.equal(afterFetchLength, 0);
        });
      });

      describe('with a different `idAttribute`', function () {
        it('should use the custom `idAttribute`', async function () {
          class TestModel extends Model {
            get idAttribute() {
              return '_id';
            }

            defaults() {
              return attributes;
            }
          }

          class TestCollection extends Collection {
            get model() {
              return TestModel;
            }
            get browserStorage() {
              return new Storage('collection2Store', 'local');
            }
          }

          const collection = new TestCollection();
          await new Promise((resolve) => collection.create({}, { 'success': resolve }));
          assert.equal(collection.first().id, collection.first().get('_id'));
        });
      });
    });
  });

  describe('on a Model', function () {
    beforeEach(() => localStorage.clear());

    class TestModel extends Model {
      constructor(attributes?: ModelAttributes) {
        super(attributes);
        this.browserStorage = new Storage('modelStore', 'local');
      }

      // eslint-disable-next-line class-methods-use-this
      defaults() {
        return attributes;
      }
    }

    it('should use `localSync`', function () {
      const model = new TestModel();
      assert.equal(getSyncMethod(model).__name__, 'localSync');
    });

    describe('fetch', function () {
      beforeEach(() => localStorage.clear());

      it('should fire sync event on fetch', function (done) {
        const model = new TestModel(attributes);
        model.on('sync', () => done());
        model.fetch();
      });
    });

    describe('save', function () {
      beforeEach(() => localStorage.clear());

      it('should have assigned an `id` to the model', async function () {
        const model = new TestModel();
        await new Promise((resolve) => model.save(null, { 'success': resolve }));
        model.fetch();
        assert.isDefined(model.id);
      });

      it('should be saved to the localstorage', async function () {
        const model = new TestModel();
        await new Promise((resolve) => model.save(null, { 'success': resolve }));
        assert.isNotNull(root.localStorage.getItem('localforage/modelStore' + '-' + model.id));
      });

      describe('with new attributes', function () {
        it('should persist the changes', async function () {
          const model = new TestModel();
          await new Promise((resolve) => model.save({ number: 42 }, { 'success': resolve }));
          model.fetch();
          assert.deepEqual(model.toJSON(), extend(clone(attributes), { id: model.id, number: 42 }));
        });
      });

      describe('fires events', function () {
        it('should fire sync event on save', function (done) {
          const model = new TestModel();
          model.on('sync', () => done());
          model.save({ foo: 'baz' });
        });
      });
    });

    describe('destroy', function () {
      it('should have removed the instance from the store', async function () {
        const model = new TestModel();
        await new Promise((resolve) => model.save(null, { 'success': resolve }));
        const store = model.browserStorage.store;
        let item = await store.getItem(model.browserStorage.getItemName(model.id));
        assert.isNotNull(item);
        await new Promise((resolve) => model.destroy({ 'success': resolve }));
        item = await store.getItem(model.browserStorage.getItemName(model.id));
        assert.isNull(item);
      });
    });
  });
});

describe('Without browserStorage', function () {
  beforeEach(() => localStorage.clear());

  describe('on a Collection', function () {
    it('should use `ajaxSync`', function () {
      class TestCollection extends Collection {}
      const collection = new TestCollection();
      const method = getSyncMethod(collection);
      assert.equal(method, sync);
    });
  });

  describe('on a Model', function () {
    it('should use `ajaxSync`', function () {
      const model = new Model();
      const method = getSyncMethod(model);
      assert.equal(method, sync);
    });
  });
});

describe('autoSync', function () {
  beforeEach(() => localStorage.clear());
  afterEach(() => resetForTesting());

  class AutoModel extends Model {
    get autoSync() { return true; }
    get autoSyncDelay() { return 0; }
    initialize() {
      this.storage = new Storage('autoModel', 'local');
    }
  }

  it('auto-saves on set() without explicit save()', async function () {
    const model = new AutoModel({ id: 'auto-1', name: 'Alice' });
    await model.initialized;
    model.set('name', 'Bob');
    // wait for debounce (delay=0) + tick
    await flushPending({ wait: true });
    const raw = root.localStorage.getItem('localforage/autoModel-auto-1');
    assert.isNotNull(raw, 'item should be stored');
    const stored = JSON.parse(raw);
    assert.equal(stored.name, 'Bob');
  });

  it('auto-saves via attrs proxy', async function () {
    const model = new AutoModel({ id: 'auto-2', name: 'Alice' });
    await model.initialized;
    model.attrs.name = 'Carol';
    await flushPending({ wait: true });
    const raw = root.localStorage.getItem('localforage/autoModel-auto-2');
    assert.isNotNull(raw);
    const stored = JSON.parse(raw);
    assert.equal(stored.name, 'Carol');
  });

  it('does not auto-save when noAutoSave option is passed', async function () {
    const model = new AutoModel({ id: 'auto-3', name: 'Alice' });
    await model.initialized;
    model.set('name', 'Suppressed', { noAutoSave: true });
    await flushPending({ wait: true });
    const raw = root.localStorage.getItem('localforage/autoModel-auto-3');
    assert.isNull(raw, 'should not have been persisted');
  });

  it('auto-hydrates on construction', async function () {
    // Seed storage via the auto-save mechanism (same path as the other auto-save tests)
    const seed = new AutoModel({ id: 'auto-4' });
    await seed.initialized;
    seed.set('name', 'Seeded');
    await flushPending({ wait: true });

    // Construct a new instance with the same id — should hydrate from storage
    const loaded = new AutoModel({ id: 'auto-4' });
    await loaded.initialized;
    assert.equal(loaded.get('name'), 'Seeded');
  });

  it('set() throws when called on an autoSync model during hydration', async function () {
    // Storage configured + a non-new id puts the model into the 'hydrating'
    // state synchronously on construction, before `initialized` resolves.
    // Mutating now would clobber whatever is still being read from storage.
    const model = new AutoModel({ id: 'guard-1' });
    assert.throws(
      () => model.set('name', 'Mallory'),
      /before initialized resolved/,
      'mutating during hydration must throw to avoid clobbering the stored state',
    );
    await model.initialized; // let hydration settle so it doesn't leak into the next test
  });

  it('set(attrs, { fromStorage: true }) is allowed during hydration (arg-order regression)', async function () {
    // The guard runs *after* argument normalization on purpose: in the
    // set(object, options) form, `fromStorage` arrives as the second argument,
    // not the third. A guard placed before normalization would read the (empty)
    // third argument and wrongly throw here. This pins that ordering — it's the
    // path hydration itself uses to merge the stored attributes back in.
    const model = new AutoModel({ id: 'guard-2' });
    assert.doesNotThrow(() => model.set({ name: 'Storage' }, { fromStorage: true }));
    assert.equal(model.get('name'), 'Storage', 'the fromStorage set ran to completion');
    await model.initialized;
  });

  it('getStorage() sees storage set via deprecated browserStorage accessor', function () {
    const model = new Model();
    const store = new Storage('alias-test', 'in_memory');
    model.browserStorage = store;
    assert.equal(getStorage(model), store, 'getStorage finds storage set via browserStorage');
    assert.equal(model.storage, store, 'storage reflects browserStorage set');
  });

  it('initialized is undefined when autoSync is off', function () {
    const model = new Model({ id: 'no-auto', name: 'Alice' });
    assert.isUndefined(model.initialized, 'initialized should be undefined for non-autoSync models');
  });

  it('initialized rejects when hydration fails', async function () {
    class BrokenModel extends Model {
      get autoSync() { return true; }
      get autoSyncDelay() { return 0; }
      initialize() {
        this.storage = new Storage('brokenModel', 'local');
      }
      sync(_method: any, _model: any, options: any) {
        options.error('simulated failure');
      }
    }
    const model = new BrokenModel({ id: 'fail-1' });
    try {
      await model.initialized;
      assert.fail('initialized should have rejected');
    } catch (e) {
      assert.equal(e, 'simulated failure');
    }
    // Model should still be usable after failed hydration
    model.set('name', 'recovered');
    assert.equal(model.get('name'), 'recovered');
  });

  class CollModel extends Model {
    defaults() {
      return {};
    }
  }

  class AutoCollection extends Collection {
    get autoSync() {
      return true;
    }
    get model() {
      return CollModel;
    }
    initialize() {
      this.storage = new Storage('autoColl', 'local');
    }
  }

  it('collection auto-hydrates its stored models on construction', async function () {
    // Seed: create models through a collection sharing the same store. `create`
    // adds each model to the collection and persists it (plus the id-list under
    // the collection key) so a fresh instance can read them back.
    const seed = new AutoCollection();
    await seed.initialized;
    await new Promise((resolve) => seed.create({ id: 'c1', name: 'Alice' }, { success: resolve }));
    await new Promise((resolve) => seed.create({ id: 'c2', name: 'Bob' }, { success: resolve }));
    await seed.storage.storeInitialized;

    // A brand-new collection on the same store should hydrate both models.
    const loaded = new AutoCollection();
    await loaded.initialized;
    assert.equal(loaded.length, 2, 'both models should be hydrated');
    assert.equal(loaded.get('c1').get('name'), 'Alice');
    assert.equal(loaded.get('c2').get('name'), 'Bob');
  });

  it('collection initialized resolves on an empty store (first run)', async function () {
    const coll = new AutoCollection();
    // findAll() returns [] for an unseeded store, so hydration succeeds rather
    // than rejecting the way a model fetch-by-id would ('Record Not Found').
    await coll.initialized;
    assert.equal(coll.length, 0);
  });

  it('collection initialized is a resolved promise when autoSync is on but no storage is set', async function () {
    class NoStorageCollection extends Collection {
      get autoSync() {
        return true;
      }
    }
    const coll = new NoStorageCollection();
    assert.instanceOf(coll.initialized, Promise, 'initialized should be a Promise when autoSync is on');
    await coll.initialized; // resolves immediately, nothing to hydrate
    assert.equal(coll.length, 0);
  });
});

describe('browserStorage deprecation warning', function () {
  let warnings: string[];
  let originalWarn: typeof console.warn;

  beforeEach(function () {
    warnings = [];
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
  });

  afterEach(function () {
    console.warn = originalWarn;
  });

  it('warns when storage is assigned via the browserStorage setter', function () {
    // A fresh class so the per-class dedup hasn't been tripped by other tests.
    class AliasModel extends Model {}
    const model = new AliasModel();
    model.browserStorage = new Storage('alias-warn-set', 'in_memory');
    assert.lengthOf(warnings, 1, 'assignment via browserStorage emits one warning');
    assert.match(warnings[0], /browserStorage.*deprecated.*storage/);
  });

  it('warns at most once per class', function () {
    class AliasModel extends Model {}
    new AliasModel().browserStorage = new Storage('alias-warn-a', 'in_memory');
    new AliasModel().browserStorage = new Storage('alias-warn-b', 'in_memory');
    assert.lengthOf(warnings, 1, 'the warning is deduplicated to once per class');
  });

  it('warns when getStorage() resolves a browserStorage override', function () {
    class OverrideCollection extends Collection {
      get browserStorage() {
        return new Storage('alias-warn-override', 'in_memory');
      }
    }
    const collection = new OverrideCollection();
    assert.isOk(getStorage(collection), 'storage resolves via the override');
    assert.lengthOf(warnings, 1, 'using the override path warns');
  });

  it('does not warn for a model or collection without storage', function () {
    class PlainModel extends Model {}
    assert.isUndefined(getStorage(new PlainModel()), 'no storage configured');
    assert.lengthOf(warnings, 0, 'storage-less objects must not trip the notice');
  });
});

describe('fetch promise contract', function () {
  beforeEach(() => localStorage.clear());
  afterEach(() => resetForTesting());

  it('Model fetch({ promise: true }) resolves on a successful read', async function () {
    // Seed a record, then read it back with a fresh model.
    const seed = new Model({ id: 'fp-1', name: 'Alice' });
    seed.storage = new Storage('fetchProm', 'local');
    await new Promise((resolve) => seed.save(null, { success: resolve }));

    const model = new Model<ModelAttributes>({ id: 'fp-1' });
    model.storage = new Storage('fetchProm', 'local');
    const ret = model.fetch({ promise: true });
    assert.instanceOf(ret, Promise, 'fetch returns a Promise when promise:true');
    await ret;
    assert.equal(model.get('name'), 'Alice');
  });

  it('Model fetch({ promise: true }) rejects with the error value on failure', async function () {
    class FailModel extends Model {
      sync(_method: any, _model: any, options: any) {
        options.error('boom');
      }
    }
    const model = new FailModel({ id: 'fp-2' });
    try {
      await model.fetch({ promise: true });
      assert.fail('fetch promise should have rejected');
    } catch (e) {
      assert.equal(e, 'boom');
    }
  });

  it('Collection fetch({ promise: true }) rejects on error (previously hung forever)', async function () {
    class FailCollection extends Collection {
      sync(_method: any, _c: any, options: any) {
        options.error('kaput');
      }
    }
    const coll = new FailCollection();
    try {
      await coll.fetch({ promise: true });
      assert.fail('fetch promise should have rejected');
    } catch (e) {
      assert.equal(e, 'kaput');
    }
  });

  it('Model autoSync hydration tolerates an empty store (first run)', async function () {
    class AutoM extends Model {
      get autoSync() {
        return true;
      }
      get autoSyncDelay() {
        return 0;
      }
      initialize() {
        this.storage = new Storage('firstRun', 'local');
      }
    }
    // id present but nothing stored → fetch produces 'Record Not Found', which
    // hydration must swallow rather than reject, keeping the initial attributes.
    const model = new AutoM({ id: 'never-saved', name: 'Initial' });
    await model.initialized;
    assert.equal(model.get('name'), 'Initial', 'initial attributes preserved on first run');
  });
});
