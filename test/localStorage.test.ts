import { assert } from 'chai';
import root from 'window-or-global';
import { clone, extend, range } from 'lodash';
import { Collection } from '../src/collection';
import { getStorage, getSyncMethod, sync } from '../src/helpers';
import { resetForTesting, flushPending, scheduleAutoSave } from '../src/autosync';
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
            range(5).map(() => new Promise((resolve) => collection.create({}, { 'success': resolve }))),
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
    get autoSync() {
      return true;
    }
    get autoSyncDelay() {
      return 0;
    }
    initialize() {
      this.storage = new Storage('autoModel', 'local');
    }
  }

  it('auto-saves on set() without explicit save()', async function () {
    const model = new AutoModel({ id: 'auto-1', name: 'Alice' });
    await model.hydrated;
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
    await model.hydrated;
    model.attrs.name = 'Carol';
    await flushPending({ wait: true });
    const raw = root.localStorage.getItem('localforage/autoModel-auto-2');
    assert.isNotNull(raw);
    const stored = JSON.parse(raw);
    assert.equal(stored.name, 'Carol');
  });

  it('does not auto-save when noAutoSave option is passed', async function () {
    const model = new AutoModel({ id: 'auto-3', name: 'Alice' });
    await model.hydrated;
    model.set('name', 'Suppressed', { noAutoSave: true });
    await flushPending({ wait: true });
    const raw = root.localStorage.getItem('localforage/autoModel-auto-3');
    assert.isNull(raw, 'should not have been persisted');
  });

  it('auto-hydrates on construction', async function () {
    // Seed storage via the auto-save mechanism (same path as the other auto-save tests)
    const seed = new AutoModel({ id: 'auto-4' });
    await seed.hydrated;
    seed.set('name', 'Seeded');
    await flushPending({ wait: true });

    // Construct a new instance with the same id — should hydrate from storage
    const loaded = new AutoModel({ id: 'auto-4' });
    await loaded.hydrated;
    assert.equal(loaded.get('name'), 'Seeded');
  });

  it('set() throws when called on an autoSync model during hydration', async function () {
    // Storage configured + a non-new id puts the model into the 'hydrating'
    // state synchronously on construction, before `hydrated` resolves.
    // Mutating now would clobber whatever is still being read from storage.
    const model = new AutoModel({ id: 'guard-1' });
    assert.throws(
      () => model.set('name', 'Mallory'),
      /before hydration resolved/,
      'mutating during hydration must throw to avoid clobbering the stored state',
    );
    await model.hydrated; // let hydration settle so it doesn't leak into the next test
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
    await model.hydrated;
  });

  it('getStorage() sees storage set via deprecated browserStorage accessor', function () {
    const model = new Model();
    const store = new Storage('alias-test', 'in_memory');
    model.browserStorage = store;
    assert.equal(getStorage(model), store, 'getStorage finds storage set via browserStorage');
    assert.equal(model.storage, store, 'storage reflects browserStorage set');
  });

  it('hydrated is undefined when autoSync is off', function () {
    const model = new Model({ id: 'no-auto', name: 'Alice' });
    assert.isUndefined(model.hydrated, 'hydrated should be undefined for non-autoSync models');
  });

  it('hydrated rejects when hydration fails', async function () {
    class BrokenModel extends Model {
      get autoSync() {
        return true;
      }
      get autoSyncDelay() {
        return 0;
      }
      initialize() {
        this.storage = new Storage('brokenModel', 'local');
      }
      sync(_method: any, _model: any, options: any) {
        options.error('simulated failure');
      }
    }
    const model = new BrokenModel({ id: 'fail-1' });
    try {
      await model.hydrated;
      assert.fail('hydrated should have rejected');
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
    await seed.hydrated;
    await new Promise((resolve) => seed.create({ id: 'c1', name: 'Alice' }, { success: resolve }));
    await new Promise((resolve) => seed.create({ id: 'c2', name: 'Bob' }, { success: resolve }));
    await seed.storage.storeInitialized;

    // A brand-new collection on the same store should hydrate both models.
    const loaded = new AutoCollection();
    await loaded.hydrated;
    assert.equal(loaded.length, 2, 'both models should be hydrated');
    assert.equal(loaded.get('c1').get('name'), 'Alice');
    assert.equal(loaded.get('c2').get('name'), 'Bob');
  });

  it('collection hydrated resolves on an empty store (first run)', async function () {
    const coll = new AutoCollection();
    // findAll() returns [] for an unseeded store, so hydration succeeds. A
    // missing model record likewise resolves (to null) rather than erroring.
    await coll.hydrated;
    assert.equal(coll.length, 0);
  });

  it('collection hydrated is a resolved promise when autoSync is on but no storage is set', async function () {
    class NoStorageCollection extends Collection {
      get autoSync() {
        return true;
      }
    }
    const coll = new NoStorageCollection();
    assert.instanceOf(coll.hydrated, Promise, 'hydrated should be a Promise when autoSync is on');
    await coll.hydrated; // resolves immediately, nothing to hydrate
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

describe('sync promise contract', function () {
  beforeEach(() => localStorage.clear());
  afterEach(() => resetForTesting());

  /** Resolves with the reason `p` rejected with; fails the test if `p` resolves. */
  async function rejectionOf(p: Promise<unknown>): Promise<any> {
    const outcome: { rejected: boolean; reason?: any } = await p.then(
      () => ({ rejected: false }),
      (reason) => ({ rejected: true, reason }),
    );
    assert.isTrue(outcome.rejected, 'expected the promise to reject');
    return outcome.reason;
  }

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
    assert.equal(await rejectionOf(model.fetch({ promise: true })), 'boom');
  });

  it('Collection fetch({ promise: true }) rejects on error (previously hung forever)', async function () {
    class FailCollection extends Collection {
      sync(_method: any, _c: any, options: any) {
        options.error('kaput');
      }
    }
    const coll = new FailCollection();
    assert.equal(await rejectionOf(coll.fetch({ promise: true })), 'kaput');
  });

  it('Model fetch({ promise: true }) resolves with null on a missing record (read miss)', async function () {
    // The record was never stored, so the read misses. A miss is a normal
    // empty state and must resolve (not reject), keeping the initial attributes.
    class Defaulted extends Model {
      defaults() {
        return { name: 'Default' };
      }
    }
    const model = new Defaulted({ id: 'miss-1' });
    model.storage = new Storage('missRead', 'local');
    const resp = await model.fetch({ promise: true });
    assert.isNull(resp, 'a read miss resolves with null rather than rejecting');
    assert.equal(model.get('name'), 'Default', 'the initial attributes are preserved on a miss');
  });

  it('Model fetch({ success, error }) calls success (not error) on a missing record', async function () {
    // Both fetch forms must agree: a read miss fires `success(null)`, never the
    // `error` callback / `'error'` event.
    const model = new Model<ModelAttributes>({ id: 'miss-2' });
    model.storage = new Storage('missReadCb', 'local');
    let successResp: any = 'unset';
    let errorCalled = false;
    let eventErrored = false;
    model.on('error', () => (eventErrored = true));
    await new Promise<void>((resolve) => {
      model.fetch({
        success: (_m: any, resp: any) => {
          successResp = resp;
          resolve();
        },
        error: () => {
          errorCalled = true;
          resolve();
        },
      });
    });
    assert.isFalse(errorCalled, 'the error callback must not fire on a read miss');
    assert.isFalse(eventErrored, "the 'error' event must not fire on a read miss");
    assert.isNull(successResp, 'success receives null for a missing record');
  });

  it('Model save({ promise: true }) rejects with an Error (not a string) on a storage failure', async function () {
    // A genuine storage failure must still reject — and with a real Error.
    const driver: any = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.reject(new Error('quota exceeded')),
      removeItem: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
      length: () => Promise.resolve(0),
    };
    const model = new Model<ModelAttributes>({ id: 'save-fail-1' });
    model.storage = new Storage('saveFail', driver);
    const e = await rejectionOf(model.save({ name: 'X' }, { promise: true }));
    assert.instanceOf(e, Error, 'the rejection reason is a real Error, not a string');
    assert.equal((e as Error).message, 'quota exceeded');
  });

  it('Model fetch({ promise: true }) resolves when sync resolves its promise (no options.success call)', async function () {
    // A sync that returns a resolved promise instead of invoking
    // options.success used to leave the fetch promise pending forever.
    class PromiseSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.resolve({ name: 'Bob', age: 42 });
      }
    }
    const model = new PromiseSyncModel({ id: 'fp-3' });
    const ret = model.fetch({ promise: true });
    assert.instanceOf(ret, Promise, 'fetch returns a Promise when promise:true');
    const resp = (await ret) as any;
    assert.equal(model.get('name'), 'Bob', 'the resolved value is merged into the model');
    assert.equal(model.get('age'), 42);
    assert.equal(resp.name, 'Bob', 'fetch promise resolves with the response');
  });

  it('Collection fetch({ promise: true }) resolves when sync resolves its promise (no options.success call)', async function () {
    class PromiseSyncCollection extends Collection {
      sync(_method: any, _c: any, _options: any) {
        return Promise.resolve([
          { id: 'a', name: 'Ann' },
          { id: 'b', name: 'Ben' },
        ]);
      }
    }
    const coll = new PromiseSyncCollection();
    const ret = coll.fetch({ promise: true });
    assert.instanceOf(ret, Promise, 'fetch returns a Promise when promise:true');
    await ret;
    assert.lengthOf(coll.models, 2, 'the resolved value populates the collection');
    assert.equal(coll.get('a').get('name'), 'Ann');
  });

  it('Model save({ promise: true }) rejects when sync rejects its promise (previously hung forever)', async function () {
    // A sync that rejects its promise instead of invoking options.error used to
    // leave the save promise pending forever (and the rejection unhandled),
    // where the same override on fetch already rejected. Both now agree.
    class RejectSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.reject(new Error('boom'));
      }
    }
    const model = new RejectSyncModel({ id: 'sp-1' });
    const ret = model.save({ name: 'X' }, { promise: true });
    assert.instanceOf(ret, Promise, 'save returns a Promise when promise:true');
    const e = await rejectionOf(ret);
    assert.instanceOf(e, Error);
    assert.equal((e as Error).message, 'boom');
  });

  it('Model save({ promise: true }) resolves when sync resolves its promise (no options.success call)', async function () {
    class PromiseSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.resolve({ name: 'Bob' });
      }
    }
    const model = new PromiseSyncModel({ id: 'sp-2' });
    await model.save({ age: 1 }, { promise: true });
    assert.equal(model.get('name'), 'Bob', 'the resolved value is merged into the model');
  });

  it('Model save({ promise: true }) waits for the callback when sync returns a non-thenable', async function () {
    // A Backbone-style sync that returns nothing and invokes options.success
    // later must settle the promise through that callback. Bridging the
    // `undefined` return value would resolve the promise on the next microtask,
    // commit `wait: true` attrs before the backend agreed, and fire 'sync' twice.
    let respond: () => void;
    class CallbackSyncModel extends Model {
      sync(_method: any, _model: any, options: any) {
        respond = () => options.success({ name: 'Cal' });
      }
    }
    const model = new CallbackSyncModel({ id: 'sp-3' });
    let syncCount = 0;
    model.on('sync', () => syncCount++);
    const ret = model.save({ age: 2 }, { promise: true, wait: true });
    let isSettled = false;
    ret.then(
      () => (isSettled = true),
      () => (isSettled = true),
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.isFalse(isSettled, 'the promise must not settle before the callback runs');
    assert.isUndefined(model.get('age'), 'wait: true must not commit attrs before the callback runs');
    assert.equal(syncCount, 0, "'sync' must not fire before the callback runs");
    respond();
    await ret;
    assert.equal(model.get('name'), 'Cal');
    assert.equal(model.get('age'), 2);
    assert.equal(syncCount, 1, "'sync' fires exactly once");
  });

  it('Model fetch({ promise: true }) waits for the callback when sync returns a non-thenable', async function () {
    let respond: () => void;
    class CallbackSyncModel extends Model {
      sync(_method: any, _model: any, options: any) {
        respond = () => options.success({ name: 'Fay' });
      }
    }
    const model = new CallbackSyncModel({ id: 'fp-3' });
    const ret = model.fetch({ promise: true });
    let isSettled = false;
    ret.then(
      () => (isSettled = true),
      () => (isSettled = true),
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.isFalse(isSettled, 'the promise must not settle before the callback runs');
    respond();
    await ret;
    assert.equal(model.get('name'), 'Fay');
  });

  it('Collection fetch({ promise: true }) waits for the callback when sync returns a non-thenable', async function () {
    let respond: () => void;
    class CallbackSyncCollection extends Collection {
      sync(_method: any, _model: any, options: any) {
        respond = () => options.success([{ id: 'c1', name: 'Col' }]);
      }
    }
    const coll = new CallbackSyncCollection();
    const ret = coll.fetch({ promise: true });
    let isSettled = false;
    ret.then(
      () => (isSettled = true),
      () => (isSettled = true),
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.isFalse(isSettled, 'the promise must not settle before the callback runs');
    respond();
    await ret;
    assert.equal(coll.get('c1').get('name'), 'Col');
  });

  it('Collection create({ promise: true }) rejects when the save sync rejects its promise', async function () {
    // create() delegates to model.save() and wires its own promise through the
    // model's callbacks; a rejected sync promise must settle create's promise
    // rather than go unhandled.
    class RejectSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.reject(new Error('nope'));
      }
    }
    class RejectSyncCollection extends Collection {
      get model() {
        return RejectSyncModel as any;
      }
    }
    const coll = new RejectSyncCollection();
    const ret = coll.create({ id: 'cc-1' }, { promise: true, wait: true });
    assert.instanceOf(ret, Promise, 'create returns a Promise when promise:true');
    const e = await rejectionOf(ret);
    assert.instanceOf(e, Error);
    assert.equal((e as Error).message, 'nope');
  });

  it('Collection create({ promise: true }) resolves when the save sync resolves its promise (no options.success call)', async function () {
    // Mirrors the Model save case: create() used to force `promise: false` onto
    // save(), which disabled save's resolve bridge, so a sync that resolved
    // without calling options.success left create's promise pending forever.
    class PromiseSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.resolve({ name: 'Bob' });
      }
    }
    class PromiseSyncCollection extends Collection {
      get model() {
        return PromiseSyncModel as any;
      }
    }
    const coll = new PromiseSyncCollection();
    const ret = coll.create({ id: 'cc-2' }, { promise: true, wait: true });
    assert.instanceOf(ret, Promise, 'create returns a Promise when promise:true');
    const created = await ret;
    assert.instanceOf(created, PromiseSyncModel, 'the promise resolves with the created model');
    assert.equal(created.get('name'), 'Bob', 'the resolved value is merged into the model');
    assert.strictEqual(coll.get('cc-2'), created, 'wait: true adds the model once the sync settles');
  });

  it('Model save({ promise: true }) rejects when a `sync` listener throws under a sync that resolves its promise', async function () {
    // The bridge delivers the resolved value to options.success, which fires
    // 'sync'. A throw there used to escape the bridge's fulfilment handler,
    // leaving the save promise pending and the throw unhandled.
    class PromiseSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.resolve({ name: 'Bob' });
      }
    }
    const model = new PromiseSyncModel({ id: 'sp-4' });
    model.on('sync', () => {
      throw new Error('listener boom');
    });
    const e = await rejectionOf(model.save({ age: 1 }, { promise: true }));
    assert.instanceOf(e, Error);
    assert.equal((e as Error).message, 'listener boom');
    assert.equal(model.get('name'), 'Bob', 'the response was merged before the listener threw');
  });

  it('Model fetch({ promise: true }) rejects when a `sync` listener throws under a sync that resolves its promise', async function () {
    class PromiseSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.resolve({ name: 'Fay' });
      }
    }
    const model = new PromiseSyncModel({ id: 'fp-4' });
    model.on('sync', () => {
      throw new Error('listener boom');
    });
    const e = await rejectionOf(model.fetch({ promise: true }));
    assert.equal((e as Error).message, 'listener boom');
  });

  it('Collection fetch({ promise: true }) rejects when a `sync` listener throws', async function () {
    // 'sync' fires before the promise resolves (as on Model), so a throwing
    // listener rejects the promise instead of being lost.
    class AsyncCallbackCollection extends Collection {
      async sync(_method: any, _c: any, options: any) {
        await Promise.resolve();
        options.success([{ id: 'c1' }]);
      }
    }
    const coll = new AsyncCallbackCollection();
    coll.on('sync', () => {
      throw new Error('listener boom');
    });
    const e = await rejectionOf(coll.fetch({ promise: true }));
    assert.equal((e as Error).message, 'listener boom');
    assert.lengthOf(coll.models, 1, 'the response was applied before the listener threw');
  });

  it('Model save({ promise: true }) runs the error callback and fires `error` when sync rejects its promise', async function () {
    // The bridge used to reject the promise directly, skipping both.
    class RejectSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.reject(new Error('boom'));
      }
    }
    const model = new RejectSyncModel({ id: 'sp-5' });
    const callbackArgs: any[][] = [];
    const eventArgs: any[][] = [];
    model.on('error', (...args: any[]) => eventArgs.push(args));
    const e = await rejectionOf(
      model.save({ name: 'X' }, { promise: true, error: (...args: any[]) => callbackArgs.push(args) }),
    );
    assert.equal((e as Error).message, 'boom');
    assert.lengthOf(callbackArgs, 1, 'the error callback ran once');
    assert.strictEqual(callbackArgs[0][0], model);
    assert.strictEqual(callbackArgs[0][1], e);
    assert.lengthOf(eventArgs, 1, "'error' fired once");
    assert.strictEqual(eventArgs[0][0], model);
    assert.strictEqual(eventArgs[0][1], e);
  });

  it('Model fetch({ promise: true }) runs the error callback and fires `error` when sync rejects its promise', async function () {
    class RejectSyncModel extends Model {
      sync(_method: any, _model: any, _options: any) {
        return Promise.reject(new Error('boom'));
      }
    }
    const model = new RejectSyncModel({ id: 'fp-5' });
    let callbackCount = 0;
    let eventCount = 0;
    model.on('error', () => eventCount++);
    const e = await rejectionOf(model.fetch({ promise: true, error: () => callbackCount++ }));
    assert.equal((e as Error).message, 'boom');
    assert.equal(callbackCount, 1, 'the error callback ran once');
    assert.equal(eventCount, 1, "'error' fired once");
  });

  it('Model save({ promise: true }) rejects with the validation error when the server attributes are invalid', async function () {
    // success() bails out when set() rejects the server attributes; the promise
    // used to stay pending for good. It now rejects with `validationError`.
    class ValidatingModel extends Model {
      validate(attrs: any) {
        if (attrs.name === 'bad') return 'name is bad';
      }
      sync(_method: any, _model: any, options: any) {
        options.success({ name: 'bad' });
      }
    }
    const model = new ValidatingModel({ id: 'sp-6', name: 'ok' });
    let invalidCount = 0;
    let syncCount = 0;
    model.on('invalid', () => invalidCount++);
    model.on('sync', () => syncCount++);
    const e = await rejectionOf(model.save({ age: 1 }, { promise: true }));
    assert.equal(e, 'name is bad');
    assert.equal(model.validationError, 'name is bad');
    assert.equal(model.get('name'), 'ok', 'the invalid server attributes are not applied');
    assert.equal(invalidCount, 1, "'invalid' fired once");
    assert.equal(syncCount, 0, "'sync' must not fire for a rejected response");
  });

  it('Model fetch({ promise: true, validate: true }) rejects with the validation error when the fetched attributes are invalid', async function () {
    class ValidatingModel extends Model {
      validate(attrs: any) {
        if (attrs.name === 'bad') return 'name is bad';
      }
      sync(_method: any, _model: any, options: any) {
        options.success({ name: 'bad' });
      }
    }
    const model = new ValidatingModel({ id: 'fp-6', name: 'ok' });
    const e = await rejectionOf(model.fetch({ promise: true, validate: true }));
    assert.equal(e, 'name is bad');
    assert.equal(model.get('name'), 'ok', 'the invalid fetched attributes are not applied');
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
    // id present but nothing stored → the read misses, which now resolves
    // (rather than erroring), keeping the initial attributes.
    const model = new AutoM({ id: 'never-saved', name: 'Initial' });
    await model.hydrated;
    assert.equal(model.get('name'), 'Initial', 'initial attributes preserved on first run');
  });

  it('destroy() awaits an in-flight auto-save so a late write cannot resurrect the record', async function () {
    // A custom driver that pauses inside setItem lets us hold an auto-save
    // mid-write, then destroy the model, and observe the operation ordering.
    const store: Record<string, any> = {};
    const order: string[] = [];
    let releaseSave: () => void;
    const savePaused = new Promise<void>((resolve) => (releaseSave = resolve));
    let saveEntered: () => void;
    const saveStarted = new Promise<void>((resolve) => (saveEntered = resolve));

    const driver: any = {
      getItem(k: string) {
        return Promise.resolve(k in store ? store[k] : null);
      },
      async setItem(k: string, v: any) {
        order.push('set');
        saveEntered();
        await savePaused; // keep the auto-save in-flight until released
        store[k] = v;
        order.push('set:done');
        return v;
      },
      removeItem(k: string) {
        order.push('remove');
        delete store[k];
        return Promise.resolve();
      },
      keys() {
        return Promise.resolve(Object.keys(store));
      },
      length() {
        return Promise.resolve(Object.keys(store).length);
      },
    };

    class AutoSaveModel extends Model {
      get autoSync() {
        return true;
      }
      get autoSyncDelay() {
        return 0;
      }
      initialize() {
        this.storage = new Storage('destroyRace', driver);
      }
    }

    const model = new AutoSaveModel({ id: 'race-1' });
    await model.hydrated;

    // Mutate to schedule an auto-save, then force its debounce timer to fire so
    // the write is genuinely in-flight (paused inside setItem).
    model.set({ name: 'Bob' });
    flushPending();
    await saveStarted;
    assert.deepEqual(order, ['set'], 'the auto-save write is in-flight');

    // Destroy while the save is still in-flight. The delete must NOT run until
    // the save settles, otherwise the late write resurrects the record.
    const destroyed = model.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let an un-sequenced delete run
    assert.notInclude(order, 'remove', 'delete must wait for the in-flight save');

    releaseSave();
    await destroyed;

    assert.deepEqual(order, ['set', 'set:done', 'remove'], 'delete is sequenced after the in-flight save');
    assert.notProperty(store, 'destroyRace-race-1', 'the in-flight save must not resurrect the record');
  });

  it('destroy() drops a collected model from the persisted collection index even when the delete is deferred', async function () {
    // Same in-flight-save race as above, but with the model in a collection.
    // The optimistic removal nulls `model.collection` before the deferred
    // delete runs, so `destroy()` must hand the captured collection to the
    // storage layer; otherwise the destroyed id is left dangling in the
    // persisted index.
    const store: Record<string, any> = {};
    const order: string[] = [];
    let pauseNext = false; // arm the single racing write
    let releaseSave: () => void;
    const savePaused = new Promise<void>((resolve) => (releaseSave = resolve));
    let saveEntered: () => void;
    const saveStarted = new Promise<void>((resolve) => (saveEntered = resolve));

    const driver: any = {
      getItem(k: string) {
        return Promise.resolve(k in store ? store[k] : null);
      },
      async setItem(k: string, v: any) {
        if (pauseNext) {
          pauseNext = false; // one-shot: only the racing item write pauses
          order.push('set');
          saveEntered();
          await savePaused; // keep the auto-save in-flight until released
          order.push('set:done');
        }
        store[k] = v;
        return v;
      },
      removeItem(k: string) {
        order.push('remove');
        delete store[k];
        return Promise.resolve();
      },
      keys() {
        return Promise.resolve(Object.keys(store));
      },
      length() {
        return Promise.resolve(Object.keys(store).length);
      },
    };

    class AutoSaveModel extends Model {
      get autoSync() {
        return true;
      }
      get autoSyncDelay() {
        return 0;
      }
      initialize() {
        this.storage = new Storage('destroyRace', driver);
      }
    }

    const collection = new Collection();
    const model = new AutoSaveModel({ id: 'race-1' });
    await model.hydrated;
    collection.add(model);

    // Pre-populate the persisted collection index so a broken (un-threaded)
    // delete would leave the destroyed id dangling in it.
    model.set({ name: 'Alice' });
    await flushPending({ wait: true });
    assert.include(store['destroyRace'], 'destroyRace-race-1', 'index references the model before the race');
    assert.property(store, 'destroyRace-race-1', 'item persisted before the race');

    // Arm and start a racing auto-save, held mid-write.
    pauseNext = true;
    model.set({ name: 'Bob' });
    flushPending();
    await saveStarted;
    assert.deepEqual(order, ['set'], 'the auto-save write is in-flight');

    // Destroy while the save is in-flight. The optimistic removal nulls
    // `model.collection`, so only the collection captured by destroy() can
    // drive the index cleanup.
    const destroyed = model.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let an un-sequenced delete run
    assert.notInclude(order, 'remove', 'delete must wait for the in-flight save');
    assert.equal(collection.length, 0, 'model optimistically removed from its collection');
    assert.notExists(model.collection, 'optimistic removal nulled model.collection');

    releaseSave();
    await destroyed;

    assert.deepEqual(order, ['set', 'set:done', 'remove'], 'delete is sequenced after the in-flight save');
    assert.notProperty(store, 'destroyRace-race-1', 'the in-flight save must not resurrect the item');
    assert.notInclude(
      store['destroyRace'],
      'destroyRace-race-1',
      'the destroyed id is dropped from the persisted collection index',
    );
  });

  it('flushPending() initiates a batched write synchronously so the unload flush is not lost', async function () {
    // With batched writes a save buffers into the storage-level debounce and
    // only reaches the driver ~50ms later. The synchronous unload flush must
    // force that write out *now*, which requires the save to have buffered
    // synchronously within the flush — not after awaiting storeInitialized.
    const store: Record<string, any> = {};
    const setItemsCalls: string[][] = [];

    const driver: any = {
      getItem(k: string) {
        return Promise.resolve(k in store ? store[k] : null);
      },
      getItems(keys: string[]) {
        const out: Record<string, any> = {};
        keys.forEach((k) => {
          if (k in store) out[k] = store[k];
        });
        return Promise.resolve(out);
      },
      setItems(items: Record<string, any>) {
        setItemsCalls.push(Object.keys(items));
        Object.assign(store, items);
        return Promise.resolve(items);
      },
      setItem(k: string, v: any) {
        store[k] = v;
        return Promise.resolve(v);
      },
      removeItem(k: string) {
        delete store[k];
        return Promise.resolve();
      },
      keys() {
        return Promise.resolve(Object.keys(store));
      },
      length() {
        return Promise.resolve(Object.keys(store).length);
      },
    };

    class BatchedModel extends Model {
      get autoSync() {
        return true;
      }
      initialize() {
        // Third arg enables batched (debounced) writes.
        this.storage = new Storage('batchedFlush', driver, true);
      }
    }

    const model = new BatchedModel({ id: 'b-1' });
    await model.hydrated;

    model.set({ name: 'Bob' });
    // The autosync debounce timer has not fired, so nothing is written yet.
    assert.lengthOf(setItemsCalls, 0, 'nothing written before the flush');

    // Synchronous unload-style flush (wait: false). The write must be issued
    // to the driver before this returns, not parked in the debounce buffer.
    flushPending({ storage: Storage });

    assert.lengthOf(setItemsCalls, 1, 'the pending write is initiated synchronously by the flush');
    assert.include(setItemsCalls[0], 'batchedFlush-b-1', 'the model item is part of the flushed batch');
    assert.deepEqual(store['batchedFlush-b-1'], { id: 'b-1', name: 'Bob' }, 'the buffered attributes were persisted');
  });

  it('surfaces an auto-save rejection that bypasses options.error on the model error event', async function () {
    // localSync routes storage failures through options.error (-> the model's
    // `error` event) and then resolves, so they never reach fireRun's catch. A
    // custom sync that *rejects* (or a throwing success handler) does — and it
    // must still be observable, not merely logged to the console.
    const model = new Model();
    const boom = new Error('boom');
    let captured: any;
    model.on('error', (_m: any, e: any) => (captured = e));

    scheduleAutoSave(model, () => Promise.reject(boom), 0);
    flushPending();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the rejection settle

    assert.equal(captured, boom, 'the rejected auto-save is emitted on the model error event');
  });

  it('emits the auto-save error event exactly once for a storage-layer failure', async function () {
    // A storage failure is handled inside localSync (options.error -> `error`
    // event) and the save promise resolves, so fireRun's catch must NOT fire a
    // second `error` event.
    const driver: any = {
      getItem(k: string) {
        return Promise.resolve(k === 'failSave-f-1' ? { id: 'f-1' } : null);
      },
      setItem() {
        return Promise.reject(new Error('quota'));
      },
      removeItem() {
        return Promise.resolve();
      },
      keys() {
        return Promise.resolve(['failSave-f-1']);
      },
      length() {
        return Promise.resolve(1);
      },
    };

    class FailingModel extends Model {
      get autoSync() {
        return true;
      }
      get autoSyncDelay() {
        return 0;
      }
      initialize() {
        this.storage = new Storage('failSave', driver);
      }
    }

    const model = new FailingModel({ id: 'f-1' });
    await model.hydrated;

    let errorCount = 0;
    model.on('error', () => errorCount++);

    model.set({ name: 'X' });
    await flushPending({ wait: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(errorCount, 1, 'a storage failure surfaces once (via options.error), not twice');
  });
});
