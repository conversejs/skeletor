import { clone, each, extend, range, times } from 'lodash';
import { Collection } from '../src/collection';
import { getSyncMethod, sync } from '../src/helpers.js';
import { Model } from '../src/model.js';
import { assert } from 'chai';
import Storage from '../src/storage.js';
import root from 'window-or-global';

describe('Storage using localStorage', function () {
  const attributes = {
    string: 'String',
    string2: 'String 2',
    number: 1337,
  };

  const onError = function (model, resp, options) {
    throw new Error(resp);
  };

  describe('on a Collection', function () {
    beforeEach(() => localStorage.clear());

    class TestModel extends Model {
      // eslint-disable-next-line class-methods-use-this
      defaults() {
        return attributes;
      }
    }

    const TestCollection = Collection.extend({
      model: TestModel,
      browserStorage: new Storage('collectionStore', 'local'),
    });

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
        const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
        assert.equal(collection.length, 1);
      });

      it('should have a populated model', async function () {
        const collection = new TestCollection();
        const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
        assert.equal(collection.length, 1);
        assert.deepEqual(model.toJSON(), extend(clone(attributes), { 'id': model.id }));
      });

      it('should have assigned an `id` to the model', async function () {
        const collection = new TestCollection();
        const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
        await model.collection.browserStorage.storeInitialized;
        assert.isDefined(model.id);
      });

      it('should be saved to the localstorage', async function () {
        const collection = new TestCollection();
        const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
        await model.collection.browserStorage.storeInitialized;
        assert.isNotNull(root.localStorage.getItem('localforage/collectionStore' + '-' + model.id));
      });
    });

    describe('get (by `id`)', function () {
      beforeEach(() => localStorage.clear());

      it('should find the model with its `id`', async function () {
        const collection = new TestCollection();
        const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
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
          const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
          model.save({ 'string': 'String 0' });
          collection.fetch();

          assert.equal(model.get('string'), 'String 0');
        });

        describe('with a new `id`', function () {
          beforeEach(() => localStorage.clear());

          it('should have a new `id`', async function () {
            const collection = new TestCollection();
            const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
            model.save({ 'id': 1 });
            collection.fetch();

            assert.equal(model.id, 1);
          });

          it('should have kept its old properties', async function () {
            const collection = new TestCollection();
            const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
            model.save({ 'id': 1 });
            collection.fetch();

            const withId = clone(attributes);
            withId.id = 1;
            assert.deepEqual(model.toJSON(), withId);
          });

          it('should be saved in localstorage by new id', async function () {
            const collection = new TestCollection();
            const model = await new Promise((resolve, reject) => collection.create({}, { 'success': resolve }));
            model.save({ 'id': 1 });
            await new Promise((resolve, reject) => collection.fetch({ 'success': resolve }));
            assert.isNotNull(root.localStorage.getItem('localforage/collectionStore-1'));
          });
        });
      });

      describe('destroy', function () {
        beforeEach(() => localStorage.clear());

        it('should remove all items from the collection and its store', async function () {
          const collection = new TestCollection();
          await Promise.all(
            range(5).map((i) => new Promise((resolve, reject) => collection.create({}, { 'success': resolve }))),
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
            constructor() {
              super();
              this.idAttribute = '_id';
            }

            // eslint-disable-next-line class-methods-use-this
            defaults() {
              return attributes;
            }
          }

          const TestCollection = Collection.extend({
            model: TestModel,
            browserStorage: new Storage('collection2Store', 'local'),
          });

          const collection = new TestCollection();
          const model = await new Promise((resolve) => collection.create({}, { 'success': resolve }));
          assert.equal(collection.first().id, collection.first().get('_id'));
        });
      });
    });
  });

  describe('on a Model', function () {
    beforeEach(() => localStorage.clear());

    class TestModel extends Model {
      constructor() {
        super();
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
        await new Promise((resolve, reject) => model.save(null, { 'success': resolve }));
        model.fetch();
        assert.isDefined(model.id);
      });

      it('should be saved to the localstorage', async function () {
        const model = new TestModel();
        await new Promise((resolve, reject) => model.save(null, { 'success': resolve }));
        assert.isNotNull(root.localStorage.getItem('localforage/modelStore' + '-' + model.id));
      });

      describe('with new attributes', function () {
        it('should persist the changes', async function () {
          const model = new TestModel();
          await new Promise((resolve, reject) => model.save({ number: 42 }, { 'success': resolve }));
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
        await new Promise((resolve, reject) => model.save(null, { 'success': resolve }));
        const store = model.browserStorage.store;
        let item = await store.getItem(model.browserStorage.getItemName(model.id));
        assert.isNotNull(item);
        await new Promise((resolve, reject) => model.destroy({ 'success': resolve }));
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
      const TestCollection = Collection.extend();
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
