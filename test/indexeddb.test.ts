/* eslint-disable class-methods-use-this */
import * as localForage from 'localforage';
import { Collection } from '../src/collection';
import { Model } from '../src/model.js';
import { expect } from 'chai';
import Storage from '../src/storage.js';

describe('Collection using IndexedDB', function () {
  class TestCollection extends Collection {
    get browserStorage() {
      return new Storage('Collection', 'indexed');
    }
    get model() {
      return Model;
    }
  }

  it('saves to localForage', async function () {
    const collection = new TestCollection();
    await new Promise((resolve, reject) => collection.fetch({ success: () => resolve() }));
    const model = await new Promise((resolve, reject) =>
      collection.create({ 'hello': 'world!' }, { 'success': resolve }),
    );
    const id = model.get('id');
    expect(id).to.be.a('string');
    expect(model.get('hello')).to.equal('world!');
  });

  it('removes from localForage', async function () {
    const collection = new TestCollection();
    const model = await new Promise((resolve, reject) =>
      collection.create({ 'hello': 'world!' }, { 'success': resolve }),
    );
    const store = model.collection.browserStorage;
    const stored_model = await localForage.getItem(store.getItemName(model.id));
    expect(stored_model).to.deep.equal(model.attributes);
    expect(collection.length).to.equal(1);

    const stored_collection = await localForage.getItem(store.name);
    await new Promise((resolve, reject) => collection.get(model.id).destroy({ 'success': resolve }));
    expect(collection.length).to.equal(0);
    expect(await localForage.getItem(store.getItemName(model.id))).to.be.null;

    // expect collection references to be reset
    const stored_collection2 = await localForage.getItem(store.name);
    expect(stored_collection2.length).to.equal(stored_collection.length - 1);
  });
});

describe('Model using IndexedDB', function () {
  class TestModel extends Model {
    constructor() {
      super();
      this.browserStorage = new Storage('Model', 'indexed');
    }
  }

  describe('Model flow', function () {
    it('saves to localForage', async function () {
      let model = new TestModel();
      try {
        model = await new Promise((resolve, reject) => model.save({ 'hello': 'world!' }, { 'success': resolve }));
      } catch (e) {
        console.error(e);
      }
      expect(model.id).to.be.a('string');
      expect(model.get('hello')).to.equal('world!');
    });

    it('fetches from localForage', async function () {
      const model = new TestModel();
      await new Promise((resolve, reject) => model.save({ 'hello': 'world!' }, { 'success': resolve }));
      await new Promise((resolve, reject) => model.fetch({ success: resolve }));
      expect(model.attributes).to.deep.equal({
        id: model.id,
        hello: 'world!',
      });
    });

    it('updates to localForage', async function () {
      const model = new TestModel();
      await new Promise((resolve, reject) => model.save({ 'hello': 'world!' }, { 'success': resolve }));
      expect(model.get('hello')).to.equal('world!');
      await new Promise((resolve, reject) => model.save({ 'hello': 'you!' }, { 'success': resolve }));
      expect(model.get('hello')).to.equal('you!');
      await new Promise((resolve, reject) => model.fetch({ success: resolve }));
      expect(model.get('hello')).to.equal('you!');
    });

    it('removes from localForage', async function () {
      const model = new TestModel();
      await new Promise((resolve, reject) => model.save({ 'hello': 'world!' }, { 'success': resolve }));
      const fetched_model = await new Promise((resolve, reject) => model.destroy({ 'success': resolve }));
      expect(model).to.deep.equal(fetched_model);
      const result = await new Promise((resolve, reject) =>
        model.fetch({ 'success': () => resolve('success'), 'error': () => resolve('error') }),
      );
      expect(result).to.equal('error');
    });
  });
});
