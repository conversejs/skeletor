import { clone, uniq } from 'lodash';
import { Model } from '../src/model.js';
import { Collection } from '../src/collection';
import { expect } from 'chai';
import Storage from '../src/storage.js';
import root from 'window-or-global';

const attributes = {
  string: 'String',
  string2: 'String 2',
  number: 1337,
};

class SavedModel extends Model {
  constructor() {
    super();
    this.browserStorage = new Storage('SavedModel', 'session');
    this.urlRoot = '/test/';
  }

  // eslint-disable-next-line class-methods-use-this
  defaults() {
    return attributes;
  }
}

class AjaxModel extends Model {
  // eslint-disable-next-line class-methods-use-this
  defaults() {
    return attributes;
  }
}

const SavedCollection = Collection.extend({
  model: AjaxModel,
  browserStorage: new Storage('SavedCollection', 'session'),
});

describe('Storage Model using sessionStorage', function () {
  beforeEach(() => sessionStorage.clear());

  it('is saved with the given name', async function () {
    const mySavedModel = new SavedModel({ 'id': 10 });
    await new Promise((resolve, reject) => mySavedModel.save(null, { 'success': resolve }));
    const item = root.sessionStorage.getItem('localforage/SavedModel-10');
    const parsed = JSON.parse(item);
    expect(parsed.id).to.equal(10);
    expect(parsed.string).to.equal('String');
    expect(parsed.string2).to.equal('String 2');
    expect(parsed.number).to.equal(1337);
  });

  it('can be converted to JSON', function () {
    const mySavedModel = new SavedModel({ 'id': 10 });
    mySavedModel.save();
    expect(mySavedModel.toJSON()).to.eql({
      string: 'String',
      id: 10,
      number: 1337,
      string2: 'String 2',
    });
  });

  describe('once saved', function () {
    beforeEach(() => sessionStorage.clear());

    it('can be fetched from sessionStorage', function () {
      const newModel = new SavedModel({ 'id': 10 });
      newModel.fetch();
      expect(newModel.get('string')).to.equal('String');
      expect(newModel.get('string2')).to.equal('String 2');
      expect(newModel.get('number')).to.equal(1337);
    });

    it('passes fetch calls to success', function (done) {
      const mySavedModel = new SavedModel({ 'id': 10 });
      mySavedModel.save();
      mySavedModel.fetch({
        success(model, response, options) {
          expect(model).to.equal(mySavedModel);
          done();
        },
      });
    });

    it('can be updated', async function () {
      const mySavedModel = new SavedModel({ 'id': 10 });
      await new Promise((resolve, reject) =>
        mySavedModel.save({ 'string': 'New String', 'number2': 1234 }, { 'success': resolve }),
      );
      expect(mySavedModel.pick('string', 'number2')).to.eql({
        'string': 'New String',
        'number2': 1234,
      });
    });

    it('persists its update to sessionStorage', async function () {
      const mySavedModel = new SavedModel({ 'id': 10 });
      await new Promise((resolve, reject) =>
        mySavedModel.save({ 'string': 'New String', 'number2': 1234 }, { 'success': resolve }),
      );
      const item = root.sessionStorage.getItem(`localforage/SavedModel-${mySavedModel.id}`);
      expect(item).to.be.a('string');
      const parsed = JSON.parse(item);
      expect(parsed).to.deep.equal({
        id: 10,
        string: 'New String',
        string2: 'String 2',
        number: 1337,
        number2: 1234,
      });
    });

    it('saves to sessionStorage with patch', async function () {
      const mySavedModel = new SavedModel({ 'id': 10 });
      await new Promise((success) => mySavedModel.save(null, { success }));
      await new Promise((success) =>
        mySavedModel.save({ 'string': 'New String', 'number2': 1234 }, { 'patch': true, success }),
      );
      const item = root.sessionStorage.getItem(`localforage/SavedModel-${mySavedModel.id}`);
      expect(item).to.be.a('string');
      const parsed = JSON.parse(item);
      expect(parsed).to.deep.equal({
        string: 'New String',
        string2: 'String 2',
        id: 10,
        number: 1337,
        number2: 1234,
      });
    });

    it('can be destroyed', async function () {
      const mySavedModel = new SavedModel({ 'id': 10 });
      await new Promise((resolve, reject) => mySavedModel.destroy({ 'success': resolve }));
      const item = root.sessionStorage.getItem('localforage/SavedModel-10');
      expect(item).to.be.null;
    });
  });

  describe('with storage updated from elsewhere', function () {
    beforeEach(() => sessionStorage.clear());

    it('will re-fetch new data', async function () {
      const newModel = new SavedModel({ 'id': 10 });
      await new Promise((resolve, reject) => newModel.save({ 'string': 'String' }, { 'success': resolve }));
      await new Promise((resolve, reject) => newModel.fetch({ 'success': resolve }));
      expect(newModel.get('string')).to.equal('String');

      const mySavedModel = new SavedModel({ 'id': 10 });
      await new Promise((resolve, reject) =>
        mySavedModel.save({ 'string': 'Brand new string' }, { 'success': resolve }),
      );
      await new Promise((resolve, reject) => newModel.fetch({ 'success': resolve }));
      expect(newModel.get('string')).to.equal('Brand new string');
    });
  });

  describe('with a different idAttribute', function () {
    beforeEach(() => sessionStorage.clear());

    class DifferentIdAttribute extends Model {
      constructor() {
        super();
        this.browserStorage = new Storage('DifferentId', 'session');
        this.idAttribute = 'number';
      }

      // eslint-disable-next-line class-methods-use-this
      defaults() {
        return attributes;
      }
    }

    it('can be saved with the new value', async function () {
      const mySavedModel = new DifferentIdAttribute(attributes);
      await new Promise((resolve, reject) => mySavedModel.save(null, { 'success': resolve }));
      const item = root.sessionStorage.getItem('localforage/DifferentId-1337');
      const parsed = JSON.parse(item);

      expect(item).to.be.a('string');
      expect(parsed.string).to.be.a('string');
    });

    it('can be fetched with the new value', async function () {
      const mySavedModel = new DifferentIdAttribute(attributes);
      root.sessionStorage.setItem('localforage/DifferentId-1337', JSON.stringify(attributes));
      const newModel = new DifferentIdAttribute({ 'number': 1337 });
      await new Promise((resolve, reject) => newModel.fetch({ 'success': resolve }));
      expect(newModel.id).to.equal(1337);
      expect(newModel.get('string')).to.be.a('string');
    });
  });

  describe('New sessionStorage model', function () {
    beforeEach(() => sessionStorage.clear());

    it('creates a new item in sessionStorage', async function () {
      const mySavedModel = new SavedModel();
      await new Promise((resolve, reject) => mySavedModel.save({ 'data': 'value' }, { 'success': resolve }));
      const item = root.sessionStorage.getItem(`localforage/SavedModel-${mySavedModel.id}`);
      const parsed = JSON.parse(item);
      expect(parsed).to.eql(mySavedModel.attributes);
    });
  });
});

describe('browserStorage Collection using sessionStorage', function () {
  beforeEach(() => sessionStorage.clear());

  it('saves to sessionStorage', function () {
    const mySavedCollection = new SavedCollection();
    mySavedCollection.create(attributes);
    expect(mySavedCollection.length).to.equal(1);
  });

  it('saves to sessionStorage when wait=true', async function () {
    const mySavedCollection = new SavedCollection();
    await new Promise((success) => mySavedCollection.create(attributes, { 'wait': true, success }));
    expect(mySavedCollection.length).to.equal(1);
    const attrs2 = { string: 'String' };
    await new Promise((success) => mySavedCollection.create(attrs2, { 'wait': true, success }));
    expect(mySavedCollection.length).to.equal(2);
    await new Promise((success) => mySavedCollection.fetch({ success }));
    expect(mySavedCollection.length).to.equal(2);
  });

  it('cannot duplicate id in sessionStorage', async function () {
    const item = clone(attributes);
    item.id = 5;
    const newCollection = new SavedCollection([item]);
    await new Promise((resolve, reject) => newCollection.create(item, { 'success': resolve }));
    await new Promise((resolve, reject) => newCollection.create(item, { 'success': resolve }));
    const localItem = root.sessionStorage.getItem('localforage/SavedCollection-5');
    expect(newCollection.length).to.equal(1);
    expect(JSON.parse(localItem).id).to.equal(5);
  });

  describe('pulling from sessionStorage', function () {
    beforeEach(() => sessionStorage.clear());

    it('saves into the sessionStorage', async function () {
      const mySavedCollection = new SavedCollection();
      const model = await new Promise((resolve, reject) =>
        mySavedCollection.create(attributes, { 'success': resolve }),
      );
      const item = root.sessionStorage.getItem(`localforage/SavedCollection-${model.id}`);
      expect(item).to.be.a('string');
    });

    it('saves the right data', async function () {
      const mySavedCollection = new SavedCollection();
      const model = await new Promise((resolve, reject) =>
        mySavedCollection.create(attributes, { 'success': resolve }),
      );
      const item = root.sessionStorage.getItem(`localforage/SavedCollection-${model.id}`);
      const parsed = JSON.parse(item);
      expect(parsed.id).to.equal(model.id);
      expect(parsed.string).to.equal('String');
    });

    it('reads from sessionStorage', async function () {
      const mySavedCollection = new SavedCollection();
      let model = await new Promise((resolve, reject) => mySavedCollection.create(attributes, { 'success': resolve }));
      const newCollection = new SavedCollection();
      model = await new Promise((resolve, reject) => newCollection.fetch({ 'success': resolve }));
      expect(newCollection.length).to.equal(1);
      const newModel = newCollection.at(0);
      expect(newModel.get('string')).to.equal('String');
    });

    it('destroys models and removes from collection', async function () {
      const mySavedCollection = new SavedCollection();
      const model = await new Promise((resolve, reject) =>
        mySavedCollection.create(attributes, { 'success': resolve }),
      );
      const item = root.sessionStorage.getItem(`localforage/SavedCollection-${model.id}`);
      const parsed = JSON.parse(item);
      const newModel = mySavedCollection.get(parsed.id);
      await new Promise((resolve, reject) => newModel.destroy({ 'success': resolve }));
      const removed = root.sessionStorage.getItem(`localforage/SavedCollection-${parsed.id}`);
      expect(removed).to.be.null;
      expect(mySavedCollection.length).to.equal(0);
    });
  });

  describe('will fetch from sessionStorage if updated separately', function () {
    beforeEach(() => sessionStorage.clear());

    it('fetches the items from the original collection', async function () {
      const mySavedCollection = new SavedCollection();
      await new Promise((resolve, reject) => mySavedCollection.create(attributes, { 'success': resolve }));
      const newCollection = new SavedCollection();
      await new Promise((resolve, reject) => newCollection.fetch({ 'success': resolve }));
      expect(newCollection.length).to.equal(1);
    });

    it('will update future changes', async function () {
      const mySavedCollection = new SavedCollection();
      const newAttributes = clone(attributes);
      mySavedCollection.create(newAttributes);
      await new Promise((resolve, reject) => mySavedCollection.create(newAttributes, { 'success': resolve }));

      const newCollection = new SavedCollection();
      await new Promise((resolve, reject) => newCollection.fetch({ 'success': resolve }));
      expect(newCollection.length).to.equal(2);
    });
  });
});
