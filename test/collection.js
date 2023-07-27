/* eslint-disable class-methods-use-this */

(function (QUnit) {
  let a, b, c, d, e, col, otherCol;

  QUnit.module('Skeletor.Collection', {
    beforeEach(assert) {
      a = new Skeletor.Model({ id: 3, label: 'a' });
      b = new Skeletor.Model({ id: 2, label: 'b' });
      c = new Skeletor.Model({ id: 1, label: 'c' });
      d = new Skeletor.Model({ id: 0, label: 'd' });
      e = null;
      col = new Skeletor.Collection([a, b, c, d]);
      otherCol = new Skeletor.Collection();
      sinon.stub(window, 'fetch').callsFake(() => {});
    },

    afterEach() {
      window.fetch.restore();
    },
  });

  QUnit.test('new and sort', function (assert) {
    assert.expect(6);
    let counter = 0;
    col.on('sort', function () {
      counter++;
    });
    assert.deepEqual(col.pluck('label'), ['a', 'b', 'c', 'd']);
    col.comparator = function (m1, m2) {
      return m1.id > m2.id ? -1 : 1;
    };
    col.sort();
    assert.equal(counter, 1);
    assert.deepEqual(col.pluck('label'), ['a', 'b', 'c', 'd']);
    col.comparator = function (model) {
      return model.id;
    };
    col.sort();
    assert.equal(counter, 2);
    assert.deepEqual(col.pluck('label'), ['d', 'c', 'b', 'a']);
    assert.equal(col.length, 4);
  });

  QUnit.test('String comparator.', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 3 }, { id: 1 }, { id: 2 }], { comparator: 'id' });
    assert.deepEqual(collection.pluck('id'), [1, 2, 3]);
  });

  QUnit.test('new and parse', function (assert) {
    assert.expect(3);
    class Collection extends Skeletor.Collection {
      parse(data) {
        return _.filter(data, function (datum) {
          return datum.a % 2 === 0;
        });
      }
    }
    const models = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }];
    const collection = new Collection(models, { parse: true });
    assert.strictEqual(collection.length, 2);
    assert.strictEqual(collection.first().get('a'), 2);
    assert.strictEqual(collection.last().get('a'), 4);
  });

  QUnit.test('get', function (assert) {
    assert.expect(4);
    assert.equal(col.get(0), d);
    assert.equal(col.get(2), b);
    assert.equal(col.get({ id: 1 }), c);
    assert.equal(col.get(col.first().cid), col.first());
  });

  QUnit.test('get with non-default ids', function (assert) {
    assert.expect(4);
    class MongoModel extends Skeletor.Model {
      get idAttribute() {
        return '_id';
      }
    }

    const model = new MongoModel({ _id: 100 });
    const collection = new Skeletor.Collection([model], { model: MongoModel });
    assert.equal(collection.get(100), model);
    assert.equal(collection.get(model.cid), model);
    assert.equal(collection.get(model), model);
    assert.equal(collection.get(101), undefined);
  });

  QUnit.test('has', function (assert) {
    assert.expect(15);
    assert.ok(col.has(a));
    assert.ok(col.has(b));
    assert.ok(col.has(c));
    assert.ok(col.has(d));
    assert.ok(col.has(a.id));
    assert.ok(col.has(b.id));
    assert.ok(col.has(c.id));
    assert.ok(col.has(d.id));
    assert.ok(col.has(a.cid));
    assert.ok(col.has(b.cid));
    assert.ok(col.has(c.cid));
    assert.ok(col.has(d.cid));
    const outsider = new Skeletor.Model({ id: 4 });
    assert.notOk(col.has(outsider));
    assert.notOk(col.has(outsider.id));
    assert.notOk(col.has(outsider.cid));
  });

  QUnit.test('update index when id changes', function (assert) {
    assert.expect(4);
    const collection = new Skeletor.Collection();
    collection.add([
      { id: 0, name: 'one' },
      { id: 1, name: 'two' },
    ]);
    const one = collection.get(0);
    assert.equal(one.get('name'), 'one');
    collection.on('change:name', function (model) {
      assert.ok(this.get(model));
    });
    one.set({ name: 'dalmatians', id: 101 });
    assert.equal(collection.get(0), null);
    assert.equal(collection.get(101).get('name'), 'dalmatians');
  });

  QUnit.test('at', function (assert) {
    assert.expect(2);
    assert.equal(col.at(2), c);
    assert.equal(col.at(-2), c);
  });

  QUnit.test('pluck', function (assert) {
    assert.expect(1);
    assert.equal(col.pluck('label').join(' '), 'a b c d');
  });

  QUnit.test('add', function (assert) {
    assert.expect(14);
    let added, opts, secondAdded;
    added = opts = secondAdded = null;
    e = new Skeletor.Model({ id: 10, label: 'e' });
    otherCol.add(e);
    otherCol.on('add', function () {
      secondAdded = true;
    });
    col.on('add', function (model, collection, options) {
      added = model.get('label');
      opts = options;
    });
    col.add(e, { amazing: true });
    assert.equal(added, 'e');
    assert.equal(col.length, 5);
    assert.equal(col.last(), e);
    assert.equal(otherCol.length, 1);
    assert.equal(secondAdded, null);
    assert.ok(opts.amazing);

    const f = new Skeletor.Model({ id: 20, label: 'f' });
    const g = new Skeletor.Model({ id: 21, label: 'g' });
    const h = new Skeletor.Model({ id: 22, label: 'h' });
    const atCol = new Skeletor.Collection([f, g, h]);
    assert.equal(atCol.length, 3);
    atCol.add(e, { at: 1 });
    assert.equal(atCol.length, 4);
    assert.equal(atCol.at(1), e);
    assert.equal(atCol.last(), h);

    const coll = new Skeletor.Collection(new Array(2));
    let addCount = 0;
    coll.on('add', function () {
      addCount += 1;
    });
    coll.add([undefined, f, g]);
    assert.equal(coll.length, 5);
    assert.equal(addCount, 3);
    coll.add(new Array(4));
    assert.equal(coll.length, 9);
    assert.equal(addCount, 7);
  });

  QUnit.test('add multiple models', function (assert) {
    assert.expect(6);
    const collection = new Skeletor.Collection([{ at: 0 }, { at: 1 }, { at: 9 }]);
    collection.add([{ at: 2 }, { at: 3 }, { at: 4 }, { at: 5 }, { at: 6 }, { at: 7 }, { at: 8 }], { at: 2 });
    for (let i = 0; i <= 5; i++) {
      assert.equal(collection.at(i).get('at'), i);
    }
  });

  QUnit.test('add; at should have preference over comparator', function (assert) {
    assert.expect(1);
    class Col extends Skeletor.Collection {
      comparator(m1, m2) {
        return m1.id > m2.id ? -1 : 1;
      }
    }

    const collection = new Col([{ id: 2 }, { id: 3 }]);
    collection.add(new Skeletor.Model({ id: 1 }), { at: 1 });

    assert.equal(collection.pluck('id').join(' '), '3 1 2');
  });

  QUnit.test('add; at should add to the end if the index is out of bounds', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 2 }, { id: 3 }]);
    collection.add(new Skeletor.Model({ id: 1 }), { at: 5 });

    assert.equal(collection.pluck('id').join(' '), '2 3 1');
  });

  QUnit.test("can't add model to collection twice", function (assert) {
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }, { id: 1 }, { id: 2 }, { id: 3 }]);
    assert.equal(collection.pluck('id').join(' '), '1 2 3');
  });

  QUnit.test("can't add different model with same id to collection twice", function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    collection.unshift({ id: 101 });
    collection.add({ id: 101 });
    assert.equal(collection.length, 1);
  });

  QUnit.test('merge in duplicate models with {merge: true}', function (assert) {
    assert.expect(3);
    const collection = new Skeletor.Collection();
    collection.add([
      { id: 1, name: 'Moe' },
      { id: 2, name: 'Curly' },
      { id: 3, name: 'Larry' },
    ]);
    collection.add({ id: 1, name: 'Moses' });
    assert.equal(collection.first().get('name'), 'Moe');
    collection.add({ id: 1, name: 'Moses' }, { merge: true });
    assert.equal(collection.first().get('name'), 'Moses');
    collection.add({ id: 1, name: 'Tim' }, { merge: true, silent: true });
    assert.equal(collection.first().get('name'), 'Tim');
  });

  QUnit.test('add model to multiple collections', function (assert) {
    assert.expect(10);
    let counter = 0;
    const m = new Skeletor.Model({ id: 10, label: 'm' });
    m.on('add', function (model, collection) {
      counter++;
      assert.equal(m, model);
      if (counter > 1) {
        assert.equal(collection, col2);
      } else {
        assert.equal(collection, col1);
      }
    });
    const col1 = new Skeletor.Collection([]);
    col1.on('add', function (model, collection) {
      assert.equal(m, model);
      assert.equal(col1, collection);
    });
    const col2 = new Skeletor.Collection([]);
    col2.on('add', function (model, collection) {
      assert.equal(m, model);
      assert.equal(col2, collection);
    });
    col1.add(m);
    assert.equal(m.collection, col1);
    col2.add(m);
    assert.equal(m.collection, col1);
  });

  QUnit.test('add model with parse', function (assert) {
    assert.expect(1);

    class Model extends Skeletor.Model {
      parse(obj) {
        obj.value += 1;
        return obj;
      }
    }

    class Col extends Skeletor.Collection {
      get model() {
        return Model;
      }
    }
    const collection = new Col();
    collection.add({ value: 1 }, { parse: true });
    assert.equal(collection.at(0).get('value'), 2);
  });

  QUnit.test('add with parse and merge', function (assert) {
    const collection = new Skeletor.Collection();
    collection.parse = function (attrs) {
      return _.map(attrs, function (model) {
        if (model.model) return model.model;
        return model;
      });
    };
    collection.add({ id: 1 });
    collection.add({ model: { id: 1, name: 'Alf' } }, { parse: true, merge: true });
    assert.equal(collection.first().get('name'), 'Alf');
  });

  QUnit.test('add model to collection with sort()-style comparator', function (assert) {
    assert.expect(3);
    const collection = new Skeletor.Collection();
    collection.comparator = function (m1, m2) {
      return m1.get('name') < m2.get('name') ? -1 : 1;
    };
    const tom = new Skeletor.Model({ name: 'Tom' });
    const rob = new Skeletor.Model({ name: 'Rob' });
    const tim = new Skeletor.Model({ name: 'Tim' });
    collection.add(tom);
    collection.add(rob);
    collection.add(tim);
    assert.equal(collection.indexOf(rob), 0);
    assert.equal(collection.indexOf(tim), 1);
    assert.equal(collection.indexOf(tom), 2);
  });

  QUnit.test('comparator that depends on `this`', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection();
    collection.negative = function (num) {
      return -num;
    };
    collection.comparator = function (model) {
      return this.negative(model.id);
    };
    collection.add([{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.deepEqual(collection.pluck('id'), [3, 2, 1]);
    collection.comparator = function (m1, m2) {
      return this.negative(m2.id) - this.negative(m1.id);
    };
    collection.sort();
    assert.deepEqual(collection.pluck('id'), [1, 2, 3]);
  });

  QUnit.test('remove', function (assert) {
    assert.expect(12);
    let removed = null;
    let result = null;
    col.on('remove', function (model, collection, options) {
      removed = model.get('label');
      assert.equal(options.index, 3);
      assert.equal(collection.get(model), undefined, '#3693: model cannot be fetched from collection');
    });
    result = col.remove(d);
    assert.equal(removed, 'd');
    assert.strictEqual(result, d);
    //if we try to remove d again, it's not going to actually get removed
    result = col.remove(d);
    assert.strictEqual(result, undefined);
    assert.equal(col.length, 3);
    assert.equal(col.first(), a);
    col.off();
    result = col.remove([c, d]);
    assert.equal(result.length, 1, 'only returns removed models');
    assert.equal(result[0], c, 'only returns removed models');
    result = col.remove([c, b]);
    assert.equal(result.length, 1, 'only returns removed models');
    assert.equal(result[0], b, 'only returns removed models');
    result = col.remove([]);
    assert.deepEqual(result, [], 'returns empty array when nothing removed');
  });

  QUnit.test('add and remove return values', function (assert) {
    assert.expect(13);

    class Even extends Skeletor.Model {
      validate(attrs) {
        if (attrs.id % 2 !== 0) return 'odd';
      }
    }
    const collection = new Skeletor.Collection();
    collection.model = Even;

    let list = collection.add([{ id: 2 }, { id: 4 }], { validate: true });
    assert.equal(list.length, 2);
    assert.ok(list[0] instanceof Skeletor.Model);
    assert.equal(list[1], collection.last());
    assert.equal(list[1].get('id'), 4);

    list = collection.add([{ id: 3 }, { id: 6 }], { validate: true });
    assert.equal(collection.length, 3);
    assert.equal(list[0], false);
    assert.equal(list[1].get('id'), 6);

    let result = collection.add({ id: 6 });
    assert.equal(result.cid, list[1].cid);

    result = collection.remove({ id: 6 });
    assert.equal(collection.length, 2);
    assert.equal(result.id, 6);

    list = collection.remove([{ id: 2 }, { id: 8 }]);
    assert.equal(collection.length, 1);
    assert.equal(list[0].get('id'), 2);
    assert.equal(list[1], null);
  });

  QUnit.test('shift and pop', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection([{ a: 'a' }, { b: 'b' }, { c: 'c' }]);
    assert.equal(collection.shift().get('a'), 'a');
    assert.equal(collection.pop().get('c'), 'c');
  });

  QUnit.test('slice', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection([{ a: 'a' }, { b: 'b' }, { c: 'c' }]);
    const array = collection.slice(1, 3);
    assert.equal(array.length, 2);
    assert.equal(array[0].get('b'), 'b');
  });

  QUnit.test('events are unbound on remove', function (assert) {
    assert.expect(3);
    let counter = 0;
    const dj = new Skeletor.Model();
    const emcees = new Skeletor.Collection([dj]);
    emcees.on('change', function () {
      counter++;
    });
    dj.set({ name: 'Kool' });
    assert.equal(counter, 1);
    emcees.reset([]);
    assert.equal(dj.collection, undefined);
    dj.set({ name: 'Shadow' });
    assert.equal(counter, 1);
  });

  QUnit.test('remove in multiple collections', function (assert) {
    assert.expect(7);
    const modelData = {
      id: 5,
      title: 'Othello',
    };
    let passed = false;
    const m1 = new Skeletor.Model(modelData);
    const m2 = new Skeletor.Model(modelData);
    m2.on('remove', function () {
      passed = true;
    });
    const col1 = new Skeletor.Collection([m1]);
    const col2 = new Skeletor.Collection([m2]);
    assert.notEqual(m1, m2);
    assert.ok(col1.length === 1);
    assert.ok(col2.length === 1);
    col1.remove(m1);
    assert.equal(passed, false);
    assert.ok(col1.length === 0);
    col2.remove(m1);
    assert.ok(col2.length === 0);
    assert.equal(passed, true);
  });

  QUnit.test('remove same model in multiple collection', function (assert) {
    assert.expect(16);
    let counter = 0;
    const m = new Skeletor.Model({ id: 5, title: 'Othello' });
    m.on('remove', function (model, collection) {
      counter++;
      assert.equal(m, model);
      if (counter > 1) {
        assert.equal(collection, col1);
      } else {
        assert.equal(collection, col2);
      }
    });
    const col1 = new Skeletor.Collection([m]);
    col1.on('remove', function (model, collection) {
      assert.equal(m, model);
      assert.equal(col1, collection);
    });
    const col2 = new Skeletor.Collection([m]);
    col2.on('remove', function (model, collection) {
      assert.equal(m, model);
      assert.equal(col2, collection);
    });
    assert.equal(col1, m.collection);
    col2.remove(m);
    assert.ok(col2.length === 0);
    assert.ok(col1.length === 1);
    assert.equal(counter, 1);
    assert.equal(col1, m.collection);
    col1.remove(m);
    assert.equal(null, m.collection);
    assert.ok(col1.length === 0);
    assert.equal(counter, 2);
  });

  QUnit.test('model destroy removes from all collections', function (assert) {
    assert.expect(3);
    const m = new Skeletor.Model({ id: 5, title: 'Othello' });
    m.sync = function (method, model, options) {
      options.success();
    };
    const col1 = new Skeletor.Collection([m]);
    const col2 = new Skeletor.Collection([m]);
    m.destroy();
    assert.ok(col1.length === 0);
    assert.ok(col2.length === 0);
    assert.equal(undefined, m.collection);
  });

  QUnit.test('Collection: non-persisted model destroy removes from all collections', function (assert) {
    assert.expect(3);
    const m = new Skeletor.Model({ title: 'Othello' });
    m.sync = function (method, model, options) {
      throw 'should not be called';
    };
    const col1 = new Skeletor.Collection([m]);
    const col2 = new Skeletor.Collection([m]);
    m.destroy();
    assert.ok(col1.length === 0);
    assert.ok(col2.length === 0);
    assert.equal(undefined, m.collection);
  });

  QUnit.test('fetch', function (assert) {
    assert.expect(5);
    const collection = new Skeletor.Collection();
    collection.url = '/test';
    sinon.spy(collection, 'sync');
    collection.fetch();
    assert.ok(collection.sync.callCount === 1);
    assert.ok(collection.sync.lastCall.args[0] === 'read');
    assert.ok(collection.sync.lastCall.args[1] == collection);
    assert.ok(collection.sync.lastCall.args[2].parse === true);
    collection.fetch({ parse: false });
    assert.ok(collection.sync.lastCall.args[2].parse === false);
  });

  QUnit.test('fetch with an error response triggers an error event', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    collection.on('error', () => assert.ok(true));
    collection.sync = (method, model, options) => options.error();
    collection.fetch();
  });

  QUnit.test('#3283 - fetch with an error response calls error with context', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    const obj = {};
    const options = {
      context: obj,
      error() {
        assert.equal(this, obj);
      },
    };
    collection.sync = function (method, model, opts) {
      opts.error.call(opts.context);
    };
    collection.fetch(options);
  });

  QUnit.test('ensure fetch only parses once', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    let counter = 0;
    collection.parse = (models) => {
      counter++;
      return models;
    };
    collection.url = '/test';
    sinon.spy(collection, 'sync');
    collection.fetch();
    collection.sync.lastCall.args[2].success([]);
    assert.equal(counter, 1);
    collection.sync.restore();
  });

  QUnit.test('create', function (assert) {
    assert.expect(5);
    const collection = new Skeletor.Collection();
    sinon.spy(Skeletor.Model.prototype, 'sync');
    collection.url = '/test';
    const model = collection.create({ label: 'f' }, { wait: true });
    assert.equal(Skeletor.Model.prototype.sync.callCount, 1);
    assert.equal(Skeletor.Model.prototype.sync.lastCall.args[0], 'create');
    assert.equal(Skeletor.Model.prototype.sync.lastCall.args[1], model);
    assert.equal(model.get('label'), 'f');
    assert.equal(model.collection, collection);
    Skeletor.Model.prototype.sync.restore();
  });

  QUnit.test('create with validate:true enforces validation', function (assert) {
    assert.expect(3);
    class ValidatingModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      validate(attrs) {
        return 'fail';
      }
    }
    class ValidatingCollection extends Skeletor.Collection {
      // eslint-disable-next-line class-methods-use-this
      get model() {
        return ValidatingModel;
      }
    }
    const collection = new ValidatingCollection();
    collection.on('invalid', function (coll, error, options) {
      assert.equal(error, 'fail');
      assert.equal(options.validationError, 'fail');
    });
    assert.equal(collection.create({ foo: 'bar' }, { validate: true }), false);
  });

  QUnit.test('create will pass extra options to success callback', function (assert) {
    assert.expect(1);
    class Model extends Skeletor.Model {
      sync(method, model, options) {
        _.extend(options, { specialSync: true });
        return Skeletor.Model.prototype.sync.call(this, method, model, options);
      }
    }

    class Collection extends Skeletor.Collection {
      // eslint-disable-next-line class-methods-use-this
      get model() {
        return Model;
      }
      // eslint-disable-next-line class-methods-use-this
      get url() {
        return '/test';
      }
    }

    const collection = new Collection();
    const success = (model, response, options) =>
      assert.ok(options.specialSync, 'Options were passed correctly to callback');

    collection.create({}, { success: success });
    window.fetch.lastCall.args[1].success();
  });

  QUnit.test('create with wait:true should not call collection.parse', function (assert) {
    assert.expect(0);
    class Collection extends Skeletor.Collection {
      // eslint-disable-next-line class-methods-use-this
      get url() {
        return '/test';
      }
      // eslint-disable-next-line class-methods-use-this
      parse() {
        assert.ok(false);
      }
    }
    const collection = new Collection();
    collection.create({}, { wait: true });
    window.fetch.lastCall.args[1].success();
  });

  QUnit.test('a failing create returns model with errors', function (assert) {
    class ValidatingModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      validate(attrs) {
        return 'fail';
      }
    }
    class ValidatingCollection extends Skeletor.Collection {
      // eslint-disable-next-line class-methods-use-this
      get model() {
        return ValidatingModel;
      }
    }
    const collection = new ValidatingCollection();
    const m = collection.create({ foo: 'bar' });
    assert.equal(m.validationError, 'fail');
    assert.equal(collection.length, 1);
  });

  QUnit.test('initialize', function (assert) {
    assert.expect(1);
    class Collection extends Skeletor.Collection {
      initialize() {
        this.one = 1;
      }
    }
    const coll = new Collection();
    assert.equal(coll.one, 1);
  });

  QUnit.test('preinitialize', function (assert) {
    assert.expect(1);
    class Collection extends Skeletor.Collection {
      preinitialize() {
        this.one = 1;
      }
    }
    const coll = new Collection();
    assert.equal(coll.one, 1);
  });

  QUnit.test('preinitialize occurs before the collection is set up', function (assert) {
    assert.expect(2);
    class Collection extends Skeletor.Collection {
      preinitialize() {
        assert.notEqual(this.model, FooModel);
      }
    }
    class FooModel extends Skeletor.Model {
      constructor() {
        super();
        this.id = 'foo';
      }
    }
    const coll = new Collection(
      {},
      {
        model: FooModel,
      },
    );
    assert.equal(coll.model, FooModel);
  });

  QUnit.test('toJSON', function (assert) {
    assert.expect(1);
    assert.equal(
      JSON.stringify(col),
      '[{"id":3,"label":"a"},{"id":2,"label":"b"},{"id":1,"label":"c"},{"id":0,"label":"d"}]',
    );
  });

  QUnit.test('where and findWhere', function (assert) {
    assert.expect(8);
    const model = new Skeletor.Model({ a: 1 });
    const coll = new Skeletor.Collection([model, { a: 1 }, { a: 1, b: 2 }, { a: 2, b: 2 }, { a: 3 }]);
    assert.equal(coll.where({ a: 1 }).length, 3);
    assert.equal(coll.where({ a: 2 }).length, 1);
    assert.equal(coll.where({ a: 3 }).length, 1);
    assert.equal(coll.where({ b: 1 }).length, 0);
    assert.equal(coll.where({ b: 2 }).length, 2);
    assert.equal(coll.where({ a: 1, b: 2 }).length, 1);
    assert.equal(coll.findWhere({ a: 1 }), model);
    assert.equal(coll.findWhere({ a: 4 }), undefined);
  });

  QUnit.test('Lodash methods', function (assert) {
    assert.expect(16);
    assert.equal(col.map((model) => model.get('label')).join(' '), 'a b c d');
    assert.equal(
      col.some((model) => model.id === 100),
      false,
    );
    assert.equal(
      col.some((model) => model.id === 0),
      true,
    );
    assert.equal(col.reduce((m1, m2) => (m1.id > m2.id ? m1 : m2)).id, 3);
    assert.equal(col.reduceRight((m1, m2) => (m1.id > m2.id ? m1 : m2)).id, 3);
    assert.equal(col.indexOf(b), 1);
    assert.equal(col.size(), 4);
    assert.equal(col.drop().length, 3);
    assert.ok(!col.drop().includes(a));
    assert.ok(col.drop().includes(d));
    assert.ok(!col.isEmpty());

    assert.deepEqual(col.difference([c, d]), [a, b]);

    const first = col.first();
    assert.deepEqual(col.groupBy((model) => model.id)[first.id], [first]);
    assert.deepEqual(
      col.countBy((model) => model.id),
      { 0: 1, 1: 1, 2: 1, 3: 1 },
    );
    assert.deepEqual(col.sortBy((model) => model.id)[0], col.at(3));
    assert.ok(col.keyBy('id')[first.id] === first);
  });

  QUnit.test('Underscore methods with object-style and property-style iteratee', function (assert) {
    assert.expect(20);
    const model = new Skeletor.Model({ a: 4, b: 1, e: 3 });
    const coll = new Skeletor.Collection([{ a: 1, b: 1 }, { a: 2, b: 1, c: 1 }, { a: 3, b: 1 }, model]);
    assert.equal(coll.find({ a: 0 }), undefined);
    assert.deepEqual(coll.find({ a: 4 }), model);
    assert.equal(coll.find('d'), undefined);
    assert.deepEqual(coll.find('e'), model);
    assert.equal(coll.filter({ a: 0 }), false);
    assert.deepEqual(coll.filter({ a: 4 }), [model]);
    assert.equal(coll.some({ a: 0 }), false);
    assert.equal(coll.some({ a: 1 }), true);
    assert.equal(coll.every({ a: 0 }), false);
    assert.equal(coll.every({ b: 1 }), true);
    assert.deepEqual(coll.map({ a: 2 }), [false, true, false, false]);
    assert.deepEqual(coll.map('a'), [1, 2, 3, 4]);
    assert.deepEqual(coll.sortBy('a')[3], model);
    assert.deepEqual(coll.sortBy('e')[0], model);
    assert.deepEqual(coll.countBy({ a: 4 }), { 'false': 3, 'true': 1 });
    assert.deepEqual(coll.countBy('d'), { 'undefined': 4 });
    assert.equal(coll.findIndex({ b: 1 }), 0);
    assert.equal(coll.findIndex({ b: 9 }), -1);
    assert.equal(coll.findLastIndex({ b: 1 }), 3);
    assert.equal(coll.findLastIndex({ b: 9 }), -1);
  });

  QUnit.test('reset', function (assert) {
    assert.expect(16);

    let resetCount = 0;
    const models = col.models;
    col.on('reset', function () {
      resetCount += 1;
    });
    col.reset([]);
    assert.equal(resetCount, 1);
    assert.equal(col.length, 0);
    assert.equal(col.last(), null);
    col.reset(models);
    assert.equal(resetCount, 2);
    assert.equal(col.length, 4);
    assert.equal(col.last(), d);
    col.reset(models.map((m) => m.attributes));
    assert.equal(resetCount, 3);
    assert.equal(col.length, 4);
    assert.ok(col.last() !== d);
    assert.ok(_.isEqual(col.last().attributes, d.attributes));
    col.reset();
    assert.equal(col.length, 0);
    assert.equal(resetCount, 4);

    const f = new Skeletor.Model({ id: 20, label: 'f' });
    col.reset([undefined, f]);
    assert.equal(col.length, 2);
    assert.equal(resetCount, 5);

    col.reset(new Array(4));
    assert.equal(col.length, 4);
    assert.equal(resetCount, 6);
  });

  QUnit.test('reset with different values', function (assert) {
    const collection = new Skeletor.Collection({ id: 1 });
    collection.reset({ id: 1, a: 1 });
    assert.equal(collection.get(1).get('a'), 1);
  });

  QUnit.test('same references in reset', function (assert) {
    const model = new Skeletor.Model({ id: 1 });
    const collection = new Skeletor.Collection({ id: 1 });
    collection.reset(model);
    assert.equal(collection.get(1), model);
  });

  QUnit.test('reset passes caller options', function (assert) {
    assert.expect(3);
    class Model extends Skeletor.Model {
      initialize(attrs, options) {
        this.modelParameter = options.modelParameter;
      }
    }

    class Col extends Skeletor.Collection {
      get model() {
        return Model;
      }
    }

    const collection = new Col();
    collection.reset(
      [
        { astring: 'green', anumber: 1 },
        { astring: 'blue', anumber: 2 },
      ],
      { modelParameter: 'model parameter' },
    );
    assert.equal(collection.length, 2);
    collection.each(function (model) {
      assert.equal(model.modelParameter, 'model parameter');
    });
  });

  QUnit.test('reset does not alter options by reference', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection([{ id: 1 }]);
    const origOpts = {};
    collection.on('reset', function (coll, opts) {
      assert.equal(origOpts.previousModels, undefined);
      assert.equal(opts.previousModels[0].id, 1);
    });
    collection.reset([], origOpts);
  });

  QUnit.test('trigger custom events on models', function (assert) {
    assert.expect(1);
    let fired = null;
    a.on('custom', function () {
      fired = true;
    });
    a.trigger('custom');
    assert.equal(fired, true);
  });

  QUnit.test('add does not alter arguments', function (assert) {
    assert.expect(2);
    const attrs = {};
    const models = [attrs];
    new Skeletor.Collection().add(models);
    assert.equal(models.length, 1);
    assert.ok(attrs === models[0]);
  });

  QUnit.test('#714: access `model.collection` in a brand new model.', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection();
    collection.url = '/test';
    class Model extends Skeletor.Model {
      set(attrs) {
        assert.equal(attrs.prop, 'value');
        assert.equal(this.collection, collection);
        return this;
      }
    }
    collection.model = Model;
    collection.create({ prop: 'value' });
  });

  QUnit.test('#574, remove its own reference to the .models array.', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]);
    assert.equal(collection.length, 6);
    collection.remove(collection.models);
    assert.equal(collection.length, 0);
  });

  QUnit.test('#861, adding models to a collection which do not pass validation, with validate:true', function (assert) {
    assert.expect(2);
    class Model extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      validate(attrs) {
        if (attrs.id === 3) return "id can't be 3";
      }
    }

    class Collection extends Skeletor.Collection {
      get model() {
        return Model;
      }
    }

    const collection = new Collection();
    collection.on('invalid', function () {
      assert.ok(true);
    });

    collection.add([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }], { validate: true });
    assert.deepEqual(collection.pluck('id'), [1, 2, 4, 5, 6]);
  });

  QUnit.test('Invalid models are discarded with validate:true.', function (assert) {
    assert.expect(5);

    class CollectionModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      validate(attrs) {
        if (!attrs.valid) return 'invalid';
      }
    }

    class Collection extends Skeletor.Collection {
      get model() {
        return CollectionModel;
      }
    }

    const collection = new Collection();

    collection.on('test', function () {
      assert.ok(true);
    });

    const model = new CollectionModel({ id: 1, valid: true });
    collection.add([model, { id: 2 }], { validate: true });
    model.trigger('test');
    assert.ok(collection.get(model.cid));
    assert.ok(collection.get(1));
    assert.ok(!collection.get(2));
    assert.equal(collection.length, 1);
  });

  QUnit.test('multiple copies of the same model', function (assert) {
    assert.expect(3);
    const collection = new Skeletor.Collection();
    const model = new Skeletor.Model();
    collection.add([model, model]);
    assert.equal(collection.length, 1);
    collection.add([{ id: 1 }, { id: 1 }]);
    assert.equal(collection.length, 2);
    assert.equal(collection.last().id, 1);
  });

  QUnit.test('#964 - collection.get return inconsistent', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection();
    assert.ok(collection.get(null) === undefined);
    assert.ok(collection.get() === undefined);
  });

  QUnit.test('#1112 - passing options.model sets collection.model', function (assert) {
    assert.expect(2);
    class Model extends Skeletor.Model {}
    const collection = new Skeletor.Collection([{ id: 1 }], { model: Model });
    assert.ok(collection.model === Model);
    assert.ok(collection.at(0) instanceof Model);
  });

  QUnit.test('null and undefined are invalid ids.', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model({ id: 1 });
    const collection = new Skeletor.Collection([model]);
    model.set({ id: null });
    assert.ok(!collection.get('null'));
    model.set({ id: 1 });
    model.set({ id: undefined });
    assert.ok(!collection.get('undefined'));
  });

  QUnit.test('falsy comparator', function (assert) {
    assert.expect(4);
    class Col extends Skeletor.Collection {
      comparator(model) {
        return model.id;
      }
    }
    const collection = new Col();
    const colFalse = new Col(null, { comparator: false });
    const colNull = new Col(null, { comparator: null });
    const colUndefined = new Col(null, { comparator: undefined });
    assert.ok(collection.comparator);
    assert.ok(!colFalse.comparator);
    assert.ok(!colNull.comparator);
    assert.ok(colUndefined.comparator);
  });

  QUnit.test('#1355 - `options` is passed to success callbacks', function (assert) {
    assert.expect(2);
    const m = new Skeletor.Model({ x: 1 });
    const collection = new Skeletor.Collection();
    const opts = {
      opts: true,
      success(coll, resp, options) {
        assert.ok(options.opts);
      },
    };
    collection.sync = m.sync = function (method, coll, options) {
      options.success({});
    };
    collection.fetch(opts);
    collection.create(m, opts);
  });

  QUnit.test("#1412 - Trigger 'request' and 'sync' events.", function (assert) {
    assert.expect(4);
    const collection = new Skeletor.Collection();
    collection.url = '/test';

    collection.on('request', function (obj, xhr, options) {
      assert.ok(obj === collection, "collection has correct 'request' event after fetching");
    });
    collection.on('sync', function (obj, response, options) {
      assert.ok(obj === collection, "collection has correct 'sync' event after fetching");
    });
    collection.fetch();
    window.fetch.lastCall.args[1].success();
    collection.off();

    collection.on('request', function (obj, xhr, options) {
      assert.ok(obj === collection.get(1), "collection has correct 'request' event after one of its models save");
    });
    collection.on('sync', function (obj, response, options) {
      assert.ok(obj === collection.get(1), "collection has correct 'sync' event after one of its models save");
    });
    collection.create({ id: 1 });
    window.fetch.lastCall.args[1].success();
    collection.off();
  });

  QUnit.test('#3283 - fetch, create calls success with context', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection();
    collection.url = '/test';
    const obj = {};
    const options = {
      context: obj,
      success() {
        assert.equal(this, obj);
      },
    };
    collection.fetch(options);
    window.fetch.lastCall.args[1].success();
    collection.create({ id: 1 }, options);
    window.fetch.lastCall.args[1].success();
  });

  QUnit.test('#1447 - create with wait adds model.', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    const model = new Skeletor.Model();
    model.sync = function (method, m, options) {
      options.success();
    };
    collection.on('add', function () {
      assert.ok(true);
    });
    collection.create(model, { wait: true });
  });

  QUnit.test('#1448 - add sorts collection after merge.', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([
      { id: 1, x: 1 },
      { id: 2, x: 2 },
    ]);
    collection.comparator = function (model) {
      return model.get('x');
    };
    collection.add({ id: 1, x: 3 }, { merge: true });
    assert.deepEqual(collection.pluck('id'), [2, 1]);
  });

  QUnit.test('#1655 - groupBy can be used with a string argument.', function (assert) {
    assert.expect(3);
    const collection = new Skeletor.Collection([{ x: 1 }, { x: 2 }]);
    const grouped = collection.groupBy('x');
    assert.strictEqual(_.keys(grouped).length, 2);
    assert.strictEqual(grouped[1][0].get('x'), 1);
    assert.strictEqual(grouped[2][0].get('x'), 2);
  });

  QUnit.test('#1655 - sortBy can be used with a string argument.', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ x: 3 }, { x: 1 }, { x: 2 }]);
    const values = _.map(collection.sortBy('x'), function (model) {
      return model.get('x');
    });
    assert.deepEqual(values, [1, 2, 3]);
  });

  QUnit.test('#1604 - Removal during iteration.', function (assert) {
    assert.expect(0);
    const collection = new Skeletor.Collection([{}, {}]);
    collection.on('add', function () {
      collection.at(0).destroy();
    });
    collection.add({}, { at: 0 });
  });

  QUnit.test('#1638 - `sort` during `add` triggers correctly.', function (assert) {
    const collection = new Skeletor.Collection();
    collection.comparator = function (model) {
      return model.get('x');
    };
    const added = [];
    collection.on('add', function (model) {
      model.set({ x: 3 });
      collection.sort();
      added.push(model.id);
    });
    collection.add([
      { id: 1, x: 1 },
      { id: 2, x: 2 },
    ]);
    assert.deepEqual(added, [1, 2]);
  });

  QUnit.test('fetch parses models by default', function (assert) {
    assert.expect(1);
    const model = {};

    class CollectionModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      parse(resp) {
        assert.strictEqual(resp, model);
      }
    }

    class Collection extends Skeletor.Collection {
      get url() {
        return 'test';
      }
      get model() {
        return CollectionModel;
      }
    }
    new Collection().fetch();
    window.fetch.lastCall.args[1].success([model]);
  });

  QUnit.test("`sort` shouldn't always fire on `add`", function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }, { id: 3 }], {
      comparator: 'id',
    });
    collection.sort = () => assert.ok(true);
    collection.add([]);
    collection.add({ id: 1 });
    collection.add([{ id: 2 }, { id: 3 }]);
    collection.add({ id: 4 });
  });

  QUnit.test('#1407 parse option on constructor parses collection and models', function (assert) {
    assert.expect(2);
    const model = {
      namespace: [{ id: 1 }, { id: 2 }],
    };

    class CollectionModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      parse(m) {
        m.name = 'test';
        return m;
      }
    }

    class Collection extends Skeletor.Collection {
      get model() {
        return CollectionModel;
      }
      parse(m) {
        return m.namespace;
      }
    }
    const collection = new Collection(model, { parse: true });

    assert.equal(collection.length, 2);
    assert.equal(collection.at(0).get('name'), 'test');
  });

  QUnit.test('#1407 parse option on reset parses collection and models', function (assert) {
    assert.expect(2);
    const model = {
      namespace: [{ id: 1 }, { id: 2 }],
    };

    class CModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      parse(m) {
        m.name = 'test';
        return m;
      }
    }

    class Collection extends Skeletor.Collection {
      get model() {
        return CModel;
      }
      parse(m) {
        return m.namespace;
      }
    }
    const collection = new Collection();
    collection.reset(model, { parse: true });

    assert.equal(collection.length, 2);
    assert.equal(collection.at(0).get('name'), 'test');
  });

  QUnit.test('Reset includes previous models in triggered event.', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    const collection = new Skeletor.Collection([model]);
    collection.on('reset', function (coll, options) {
      assert.deepEqual(options.previousModels, [model]);
    });
    collection.reset([]);
  });

  QUnit.test('set', function (assert) {
    const m1 = new Skeletor.Model();
    const m2 = new Skeletor.Model({ id: 2 });
    const m3 = new Skeletor.Model();
    const collection = new Skeletor.Collection([m1, m2]);

    // Test add/change/remove events
    collection.on('add', function (model) {
      assert.strictEqual(model, m3);
    });
    collection.on('change', function (model) {
      assert.strictEqual(model, m2);
    });
    collection.on('remove', function (model) {
      assert.strictEqual(model, m1);
    });

    // remove: false doesn't remove any models
    collection.set([], { remove: false });
    assert.strictEqual(collection.length, 2);

    // add: false doesn't add any models
    collection.set([m1, m2, m3], { add: false });
    assert.strictEqual(collection.length, 2);

    // merge: false doesn't change any models
    collection.set([m1, { id: 2, a: 1 }], { merge: false });
    assert.strictEqual(m2.get('a'), undefined);

    // add: false, remove: false only merges existing models
    collection.set([m1, { id: 2, a: 0 }, m3, { id: 4 }], { add: false, remove: false });
    assert.strictEqual(collection.length, 2);
    assert.strictEqual(m2.get('a'), 0);

    // default options add/remove/merge as appropriate
    collection.set([{ id: 2, a: 1 }, m3]);
    assert.strictEqual(collection.length, 2);
    assert.strictEqual(m2.get('a'), 1);

    // Test removing models not passing an argument
    collection.off('remove').on('remove', function (model) {
      assert.ok(model === m2 || model === m3);
    });
    collection.set([]);
    assert.strictEqual(collection.length, 0);

    // Test null models on set doesn't clear collection
    collection.off();
    collection.set([{ id: 1 }]);
    collection.set();
    assert.strictEqual(collection.length, 1);
  });

  QUnit.test('set with only cids', function (assert) {
    assert.expect(3);
    const m1 = new Skeletor.Model();
    const m2 = new Skeletor.Model();
    const collection = new Skeletor.Collection();
    collection.set([m1, m2]);
    assert.equal(collection.length, 2);
    collection.set([m1]);
    assert.equal(collection.length, 1);
    collection.set([m1, m1, m1, m2, m2], { remove: false });
    assert.equal(collection.length, 2);
  });

  QUnit.test('set with only idAttribute', function (assert) {
    assert.expect(3);
    const m1 = { _id: 1 };
    const m2 = { _id: 2 };

    class CModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      get idAttribute() {
        return '_id';
      }
    }

    class Col extends Skeletor.Collection {
      get model() {
        return CModel;
      }
    }
    const collection = new Col();
    collection.set([m1, m2]);
    assert.equal(collection.length, 2);
    collection.set([m1]);
    assert.equal(collection.length, 1);
    collection.set([m1, m1, m1, m2, m2], { remove: false });
    assert.equal(collection.length, 2);
  });

  QUnit.test('set + merge with default values defined', function (assert) {
    class Model extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      defaults() {
        return {
          key: 'value',
        };
      }
    }
    const m = new Model({ id: 1 });
    const collection = new Skeletor.Collection([m], { model: Model });
    assert.equal(collection.first().get('key'), 'value');

    collection.set({ id: 1, key: 'other' });
    assert.equal(collection.first().get('key'), 'other');

    collection.set({ id: 1, other: 'value' });
    assert.equal(collection.first().get('key'), 'other');
    assert.equal(collection.length, 1);
  });

  QUnit.test('merge without mutation', function (assert) {
    class Model extends Skeletor.Model {
      initialize(attrs, options) {
        if (attrs.child) {
          this.set('child', new Model(attrs.child, options), options);
        }
      }
    }
    class Collection extends Skeletor.Collection {
      get model() {
        return Model;
      }
    }
    const data = [{ id: 1, child: { id: 2 } }];
    const collection = new Collection(data);
    assert.equal(collection.first().id, 1);
    collection.set(data);
    assert.equal(collection.first().id, 1);
    collection.set([{ id: 2, child: { id: 2 } }].concat(data));
    assert.deepEqual(collection.pluck('id'), [2, 1]);
  });

  QUnit.test('`set` and model level `parse`', function (assert) {
    class Model extends Skeletor.Model {}
    class Collection extends Skeletor.Collection {
      get model() {
        return Model;
      }
      parse(res) {
        return _.map(res.models, 'model');
      }
    }
    const model = new Model({ id: 1 });
    const collection = new Collection(model);
    collection.set({ models: [{ model: { id: 1 } }, { model: { id: 2 } }] }, { parse: true });
    assert.equal(collection.first(), model);
  });

  QUnit.test('`set` data is only parsed once', function (assert) {
    const collection = new Skeletor.Collection();

    class CModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      parse(data) {
        assert.equal(data.parsed, undefined);
        data.parsed = true;
        return data;
      }
    }

    collection.model = CModel;
    collection.set({}, { parse: true });
  });

  QUnit.test('`set` matches input order in the absence of a comparator', function (assert) {
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    collection.set([{ id: 3 }, { id: 2 }, { id: 1 }]);
    assert.deepEqual(collection.models, [three, two, one]);
    collection.set([{ id: 1 }, { id: 2 }]);
    assert.deepEqual(collection.models, [one, two]);
    collection.set([two, three, one]);
    assert.deepEqual(collection.models, [two, three, one]);
    collection.set([{ id: 1 }, { id: 2 }], { remove: false });
    assert.deepEqual(collection.models, [two, three, one]);
    collection.set([{ id: 1 }, { id: 2 }, { id: 3 }], { merge: false });
    assert.deepEqual(collection.models, [one, two, three]);
    collection.set([three, two, one, { id: 4 }], { add: false });
    assert.deepEqual(collection.models, [one, two, three]);
  });

  QUnit.test('#1894 - Push should not trigger a sort', function (assert) {
    assert.expect(0);
    class Collection extends Skeletor.Collection {
      get comparator() {
        return 'id';
      }
      sort() {
        assert.ok(false);
      }
    }
    new Collection().push({ id: 1 });
  });

  QUnit.test('#2428 - push duplicate models, return the correct one', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    const model1 = collection.push({ id: 101 });
    const model2 = collection.push({ id: 101 });
    assert.ok(model2.cid === model1.cid);
  });

  QUnit.test('`set` with non-normal id', function (assert) {
    class CModel extends Skeletor.Model {
      // eslint-disable-next-line class-methods-use-this
      get idAttribute() {
        return '_id';
      }
    }

    class Collection extends Skeletor.Collection {
      get model() {
        return CModel;
      }
    }
    const collection = new Collection({ _id: 1 });
    collection.set([{ _id: 1, a: 1 }], { add: false });
    assert.equal(collection.first().get('a'), 1);
  });

  QUnit.test('#1894 - `sort` can optionally be turned off', function (assert) {
    assert.expect(0);
    class Collection extends Skeletor.Collection {
      get comparator() {
        return 'id';
      }
      sort() {
        assert.ok(false);
      }
    }
    new Collection().add({ id: 1 }, { sort: false });
  });

  QUnit.test('#1915 - `parse` data in the right order in `set`', function (assert) {
    class Col extends Skeletor.Collection {
      parse(data) {
        assert.strictEqual(data.status, 'ok');
        return data.data;
      }
    }
    const collection = new Col();
    const res = { status: 'ok', data: [{ id: 1 }] };
    collection.set(res, { parse: true });
  });

  QUnit.test('#1939 - `parse` is passed `options`', function (assert) {
    window.fetch.restore();
    sinon.stub(window, 'fetch').callsFake((url, params) => {
      _.defer(params.success, []);
      return { someHeader: 'headerValue' };
    });

    const done = assert.async();
    assert.expect(1);
    class Col extends Skeletor.Collection {
      get url() {
        return '/';
      }
      parse(data, options) {
        assert.strictEqual(options.xhr.someHeader, 'headerValue');
        return data;
      }
    }
    const collection = new Col();
    collection.fetch({
      success() {
        done();
      },
    });
  });

  QUnit.test('fetch will pass extra options to success callback', function (assert) {
    assert.expect(1);
    class SpecialSyncCollection extends Skeletor.Collection {
      get url() {
        return '/test';
      }
      sync(method, collection, options) {
        _.extend(options, { specialSync: true });
        return Skeletor.Collection.prototype.sync.call(this, method, collection, options);
      }
    }

    const collection = new SpecialSyncCollection();

    const onSuccess = function (coll, resp, options) {
      assert.ok(options.specialSync, 'Options were passed correctly to callback');
    };

    collection.fetch({ success: onSuccess });
    window.fetch.lastCall.args[1].success();
  });

  QUnit.test('`add` only `sort`s when necessary', function (assert) {
    assert.expect(2);
    class Col extends Skeletor.Collection {
      get comparator() {
        return 'a';
      }
    }
    const collection = new Col([{ id: 1 }, { id: 2 }, { id: 3 }]);
    collection.on('sort', function () {
      assert.ok(true);
    });
    collection.add({ id: 4 }); // do sort, new model
    collection.add({ id: 1, a: 1 }, { merge: true }); // do sort, comparator change
    collection.add({ id: 1, b: 1 }, { merge: true }); // don't sort, no comparator change
    collection.add({ id: 1, a: 1 }, { merge: true }); // don't sort, no comparator change
    collection.add(collection.models); // don't sort, nothing new
    collection.add(collection.models, { merge: true }); // don't sort
  });

  QUnit.test('`add` only `sort`s when necessary with comparator function', function (assert) {
    assert.expect(3);

    class Col extends Skeletor.Collection {
      comparator(m1, m2) {
        return m1.get('a') > m2.get('a') ? 1 : m1.get('a') < m2.get('a') ? -1 : 0;
      }
    }
    const collection = new Col([{ id: 1 }, { id: 2 }, { id: 3 }]);
    collection.on('sort', function () {
      assert.ok(true);
    });
    collection.add({ id: 4 }); // do sort, new model
    collection.add({ id: 1, a: 1 }, { merge: true }); // do sort, model change
    collection.add({ id: 1, b: 1 }, { merge: true }); // do sort, model change
    collection.add({ id: 1, a: 1 }, { merge: true }); // don't sort, no model change
    collection.add(collection.models); // don't sort, nothing new
    collection.add(collection.models, { merge: true }); // don't sort
  });

  QUnit.test('Attach options to collection.', function (assert) {
    assert.expect(2);
    const Model = Skeletor.Model;
    const comparator = function () {};

    const collection = new Skeletor.Collection([], {
      model: Model,
      comparator: comparator,
    });

    assert.ok(collection.model === Model);
    assert.ok(collection.comparator === comparator);
  });

  QUnit.test('Pass falsey for `models` for empty Col with `options`', function (assert) {
    assert.expect(9);
    const opts = { a: 1, b: 2 };
    _.forEach([undefined, null, false], function (falsey) {
      class Collection extends Skeletor.Collection {
        initialize(models, options) {
          assert.strictEqual(models, falsey);
          assert.strictEqual(options, opts);
        }
      }

      const collection = new Collection(falsey, opts);
      assert.strictEqual(collection.length, 0);
    });
  });

  QUnit.test('`add` overrides `set` flags', function (assert) {
    const collection = new Skeletor.Collection();
    collection.once('add', function (model, coll, options) {
      coll.add({ id: 2 }, options);
    });
    collection.set({ id: 1 });
    assert.equal(collection.length, 2);
  });

  QUnit.test('#2606 - Collection#create, success arguments', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    collection.url = 'test';
    collection.create(
      {},
      {
        success(model, resp, options) {
          assert.strictEqual(resp, 'response');
        },
      },
    );
    window.fetch.lastCall.args[1].success('response');
  });

  QUnit.test('#2612 - nested `parse` works with `Collection#set`', function (assert) {
    class Job extends Skeletor.Model {
      get items() {
        if (!this._items) {
          this._items = new Items();
        }
        return this._items;
      }

      parse(attrs) {
        this.items.set(attrs.items, { parse: true });
        return _.omit(attrs, 'items');
      }
    }

    class Item extends Skeletor.Model {
      get subItems() {
        if (!this._subItems) {
          this._subItems = new Items();
        }
        return this._subItems;
      }
      parse(attrs) {
        this.subItems.set(attrs.subItems, { parse: true });
        return _.omit(attrs, 'subItems');
      }
    }

    class Items extends Skeletor.Collection {
      get model() {
        return Item;
      }
    }

    const data = {
      name: 'JobName',
      id: 1,
      items: [
        {
          id: 1,
          name: 'Sub1',
          subItems: [
            { id: 1, subName: 'One' },
            { id: 2, subName: 'Two' },
          ],
        },
        {
          id: 2,
          name: 'Sub2',
          subItems: [
            { id: 3, subName: 'Three' },
            { id: 4, subName: 'Four' },
          ],
        },
      ],
    };

    const newData = {
      name: 'NewJobName',
      id: 1,
      items: [
        {
          id: 1,
          name: 'NewSub1',
          subItems: [
            { id: 1, subName: 'NewOne' },
            { id: 2, subName: 'NewTwo' },
          ],
        },
        {
          id: 2,
          name: 'NewSub2',
          subItems: [
            { id: 3, subName: 'NewThree' },
            { id: 4, subName: 'NewFour' },
          ],
        },
      ],
    };

    const job = new Job(data, { parse: true });
    assert.equal(job.get('name'), 'JobName');
    assert.equal(job.items.at(0).get('name'), 'Sub1');
    assert.equal(job.items.length, 2);
    assert.equal(job.items.get(1).subItems.get(1).get('subName'), 'One');
    assert.equal(job.items.get(2).subItems.get(3).get('subName'), 'Three');
    job.set(job.parse(newData, { parse: true }));
    assert.equal(job.get('name'), 'NewJobName');
    assert.equal(job.items.at(0).get('name'), 'NewSub1');
    assert.equal(job.items.length, 2);
    assert.equal(job.items.get(1).subItems.get(1).get('subName'), 'NewOne');
    assert.equal(job.items.get(2).subItems.get(3).get('subName'), 'NewThree');
  });

  QUnit.test('_addReference binds all collection events & adds to the lookup hashes', function (assert) {
    assert.expect(8);

    const calls = { add: 0, remove: 0 };

    class Collection extends Skeletor.Collection {
      _addReference(model) {
        Skeletor.Collection.prototype._addReference.apply(this, arguments);
        calls.add++;
        assert.equal(model, this._byId[model.id]);
        assert.equal(model, this._byId[model.cid]);
        assert.equal(model._events.all.length, 1);
      }

      _removeReference(model) {
        Skeletor.Collection.prototype._removeReference.apply(this, arguments);
        calls.remove++;
        assert.equal(this._byId[model.id], undefined);
        assert.equal(this._byId[model.cid], undefined);
        assert.equal(model.collection, undefined);
      }
    }

    const collection = new Collection();
    const model = collection.add({ id: 1 });
    collection.remove(model);

    assert.equal(calls.add, 1);
    assert.equal(calls.remove, 1);
  });

  QUnit.test('Do not allow duplicate models to be `add`ed or `set`', function (assert) {
    const collection = new Skeletor.Collection();

    collection.add([{ id: 1 }, { id: 1 }]);
    assert.equal(collection.length, 1);
    assert.equal(collection.models.length, 1);

    collection.set([{ id: 1 }, { id: 1 }]);
    assert.equal(collection.length, 1);
    assert.equal(collection.models.length, 1);
  });

  QUnit.test('#3020: #set with {add: false} should not throw.', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection();
    collection.set([{ id: 1 }], { add: false });
    assert.strictEqual(collection.length, 0);
    assert.strictEqual(collection.models.length, 0);
  });

  QUnit.test('create with wait, model instance, #3028', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    const model = new Skeletor.Model({ id: 1 });
    model.sync = function () {
      assert.equal(this.collection, collection);
    };
    collection.create(model, { wait: true });
  });

  QUnit.test('modelId', function (assert) {
    class Stooge extends Skeletor.Model {}
    class StoogeCollection extends Skeletor.Collection {
      get model() {
        return Stooge;
      }
    }

    // Default to using `Collection::model::idAttribute`.
    assert.equal(StoogeCollection.prototype.modelId({ id: 1 }), 1);

    class Foo extends Skeletor.Model {
      get idAttribute() {
        return '_id';
      }
    }
    class FooCollection extends Skeletor.Collection {
      get model() {
        return Foo;
      }
    }
    assert.equal(FooCollection.prototype.modelId({ _id: 1 }), 1);
  });

  QUnit.test('Polymorphic models work with "simple" constructors', function (assert) {
    class A extends Skeletor.Model {}
    class B extends Skeletor.Model {}

    class C extends Skeletor.Collection {
      createModel(attrs) {
        return attrs.type === 'a' ? new A(attrs) : new B(attrs);
      }
    }

    const collection = new C([
      { id: 1, type: 'a' },
      { id: 2, type: 'b' },
    ]);

    assert.equal(collection.length, 2);
    assert.ok(collection.at(0) instanceof A);
    assert.equal(collection.at(0).id, 1);
    assert.ok(collection.at(1) instanceof B);
    assert.equal(collection.at(1).id, 2);
  });

  QUnit.test('Collection with polymorphic models receives default id from modelId', function (assert) {
    assert.expect(6);
    // When the polymorphic models use 'id' for the idAttribute, all is fine.
    class C1 extends Skeletor.Collection {
      createModel(attrs) {
        return new Skeletor.Model(attrs);
      }
    }
    const c1 = new C1({ id: 1 });
    assert.equal(c1.get(1).id, 1);
    assert.equal(c1.modelId({ id: 1 }), 1);

    // If the polymorphic models define their own idAttribute,
    // the modelId method should be overridden, for the reason below.
    class M extends Skeletor.Model {
      get idAttribute() {
        return '_id';
      }
    }
    class C2 extends Skeletor.Collection {
      createModel(attrs) {
        return new M(attrs);
      }
    }
    const c2 = new C2({ _id: 1 });
    assert.equal(c2.get(1), undefined);
    assert.equal(c2.modelId(c2.at(0).attributes), undefined);
    const m = new M({ _id: 2 });
    c2.add(m);
    assert.equal(c2.get(2), undefined);
    assert.equal(c2.modelId(m.attributes), undefined);
  });

  QUnit.test('Collection implements Iterable, values is default iterator function', function (assert) {
    const $$iterator = typeof Symbol === 'function' && Symbol.iterator;
    // This test only applies to environments which define Symbol.iterator.
    if (!$$iterator) {
      assert.expect(0);
      return;
    }
    assert.expect(2);
    const collection = new Skeletor.Collection([]);
    assert.strictEqual(collection[$$iterator], collection.values);
    const iterator = collection[$$iterator]();
    assert.deepEqual(iterator.next(), { value: undefined, done: true });
  });

  QUnit.test('Collection.values iterates models in sorted order', function (assert) {
    assert.expect(4);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    const iterator = collection.values();
    assert.strictEqual(iterator.next().value, one);
    assert.strictEqual(iterator.next().value, two);
    assert.strictEqual(iterator.next().value, three);
    assert.strictEqual(iterator.next().value, undefined);
  });

  QUnit.test('Collection.keys iterates ids in sorted order', function (assert) {
    assert.expect(4);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    const iterator = collection.keys();
    assert.strictEqual(iterator.next().value, 1);
    assert.strictEqual(iterator.next().value, 2);
    assert.strictEqual(iterator.next().value, 3);
    assert.strictEqual(iterator.next().value, undefined);
  });

  QUnit.test('Collection.entries iterates ids and models in sorted order', function (assert) {
    assert.expect(4);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    const iterator = collection.entries();
    assert.deepEqual(iterator.next().value, [1, one]);
    assert.deepEqual(iterator.next().value, [2, two]);
    assert.deepEqual(iterator.next().value, [3, three]);
    assert.strictEqual(iterator.next().value, undefined);
  });

  QUnit.test('#3039 #3951: adding at index fires with correct at', function (assert) {
    assert.expect(4);
    const collection = new Skeletor.Collection([{ val: 0 }, { val: 4 }]);
    collection.on('add', function (model, coll, options) {
      assert.equal(model.get('val'), options.index);
    });
    collection.add([{ val: 1 }, { val: 2 }, { val: 3 }], { at: 1 });
    collection.add({ val: 5 }, { at: 10 });
  });

  QUnit.test('#3039: index is not sent when at is not specified', function (assert) {
    assert.expect(2);
    const collection = new Skeletor.Collection([{ at: 0 }]);
    collection.on('add', function (model, coll, options) {
      assert.equal(undefined, options.index);
    });
    collection.add([{ at: 1 }, { at: 2 }]);
  });

  QUnit.test('#3199 - Order changing should trigger a sort', function (assert) {
    assert.expect(1);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    collection.on('sort', function () {
      assert.ok(true);
    });
    collection.set([{ id: 3 }, { id: 2 }, { id: 1 }]);
  });

  QUnit.test('#3199 - Adding a model should trigger a sort', function (assert) {
    assert.expect(1);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    collection.on('sort', function () {
      assert.ok(true);
    });
    collection.set([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 0 }]);
  });

  QUnit.test('#3199 - Order not changing should not trigger a sort', function (assert) {
    assert.expect(0);
    const one = new Skeletor.Model({ id: 1 });
    const two = new Skeletor.Model({ id: 2 });
    const three = new Skeletor.Model({ id: 3 });
    const collection = new Skeletor.Collection([one, two, three]);
    collection.on('sort', function () {
      assert.ok(false);
    });
    collection.set([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  QUnit.test('add supports negative indexes', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }]);
    collection.add([{ id: 2 }, { id: 3 }], { at: -1 });
    collection.add([{ id: 2.5 }], { at: -2 });
    collection.add([{ id: 0.5 }], { at: -6 });
    assert.equal(collection.pluck('id').join(','), '0.5,1,2,2.5,3');
  });

  QUnit.test('#set accepts options.at as a string', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }]);
    collection.add([{ id: 3 }], { at: '1' });
    assert.deepEqual(collection.pluck('id'), [1, 3, 2]);
  });

  QUnit.test('adding multiple models triggers `update` event once', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection();
    collection.on('update', function () {
      assert.ok(true);
    });
    collection.add([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  QUnit.test('removing models triggers `update` event once', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);
    collection.on('update', function () {
      assert.ok(true);
    });
    collection.remove([{ id: 1 }, { id: 2 }]);
  });

  QUnit.test('remove does not trigger `update` when nothing removed', function (assert) {
    assert.expect(0);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }]);
    collection.on('update', function () {
      assert.ok(false);
    });
    collection.remove([{ id: 3 }]);
  });

  QUnit.test('set triggers `set` event once', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }]);
    collection.on('update', function () {
      assert.ok(true);
    });
    collection.set([{ id: 1 }, { id: 3 }]);
  });

  QUnit.test('set does not trigger `update` event when nothing added nor removed', function (assert) {
    const collection = new Skeletor.Collection([{ id: 1 }, { id: 2 }]);
    collection.on('update', function (coll, options) {
      assert.equal(options.changes.added.length, 0);
      assert.equal(options.changes.removed.length, 0);
      assert.equal(options.changes.merged.length, 2);
    });
    collection.set([{ id: 1 }, { id: 2 }]);
  });

  QUnit.test('#3662 - triggering change without model will not error', function (assert) {
    assert.expect(1);
    const collection = new Skeletor.Collection([{ id: 1 }]);
    const model = collection.first();
    collection.on('change', function (m) {
      assert.equal(m, undefined);
    });
    model.trigger('change');
  });

  QUnit.test('#3871 - falsy parse result creates empty collection', function (assert) {
    class Col extends Skeletor.Collection {
      parse(data, options) {}
    }
    const collection = new Col();
    collection.set('', { parse: true });
    assert.equal(collection.length, 0);
  });

  QUnit.test("#3711 - remove's `update` event returns one removed model", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const collection = new Skeletor.Collection([model]);
    collection.on('update', function (context, options) {
      const changed = options.changes;
      assert.deepEqual(changed.added, []);
      assert.deepEqual(changed.merged, []);
      assert.strictEqual(changed.removed[0], model);
    });
    collection.remove(model);
  });

  QUnit.test("#3711 - remove's `update` event returns multiple removed models", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const collection = new Skeletor.Collection([model, model2]);
    collection.on('update', function (context, options) {
      const changed = options.changes;
      assert.deepEqual(changed.added, []);
      assert.deepEqual(changed.merged, []);
      assert.ok(changed.removed.length === 2);

      assert.ok(_.indexOf(changed.removed, model) > -1 && _.indexOf(changed.removed, model2) > -1);
    });
    collection.remove([model, model2]);
  });

  QUnit.test("#3711 - set's `update` event returns one added model", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const collection = new Skeletor.Collection();
    collection.on('update', function (context, options) {
      const addedModels = options.changes.added;
      assert.ok(addedModels.length === 1);
      assert.strictEqual(addedModels[0], model);
    });
    collection.set(model);
  });

  QUnit.test("#3711 - set's `update` event returns multiple added models", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const collection = new Skeletor.Collection();
    collection.on('update', function (context, options) {
      const addedModels = options.changes.added;
      assert.ok(addedModels.length === 2);
      assert.strictEqual(addedModels[0], model);
      assert.strictEqual(addedModels[1], model2);
    });
    collection.set([model, model2]);
  });

  QUnit.test("#3711 - set's `update` event returns one removed model", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const model3 = new Skeletor.Model({ id: 3, title: 'My Last Post' });
    const collection = new Skeletor.Collection([model]);
    collection.on('update', function (context, options) {
      const changed = options.changes;
      assert.equal(changed.added.length, 2);
      assert.equal(changed.merged.length, 0);
      assert.ok(changed.removed.length === 1);
      assert.strictEqual(changed.removed[0], model);
    });
    collection.set([model2, model3]);
  });

  QUnit.test("#3711 - set's `update` event returns multiple removed models", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const model3 = new Skeletor.Model({ id: 3, title: 'My Last Post' });
    const collection = new Skeletor.Collection([model, model2]);
    collection.on('update', function (context, options) {
      const removedModels = options.changes.removed;
      assert.ok(removedModels.length === 2);
      assert.strictEqual(removedModels[0], model);
      assert.strictEqual(removedModels[1], model2);
    });
    collection.set([model3]);
  });

  QUnit.test("#3711 - set's `update` event returns one merged model", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const model2Update = new Skeletor.Model({ id: 2, title: 'Second Post V2' });
    const collection = new Skeletor.Collection([model, model2]);
    collection.on('update', function (context, options) {
      const mergedModels = options.changes.merged;
      assert.ok(mergedModels.length === 1);
      assert.strictEqual(mergedModels[0].get('title'), model2Update.get('title'));
    });
    collection.set([model2Update]);
  });

  QUnit.test("#3711 - set's `update` event returns multiple merged models", function (assert) {
    const model = new Skeletor.Model({ id: 1, title: 'First Post' });
    const modelUpdate = new Skeletor.Model({ id: 1, title: 'First Post V2' });
    const model2 = new Skeletor.Model({ id: 2, title: 'Second Post' });
    const model2Update = new Skeletor.Model({ id: 2, title: 'Second Post V2' });
    const collection = new Skeletor.Collection([model, model2]);
    collection.on('update', function (context, options) {
      const mergedModels = options.changes.merged;
      assert.ok(mergedModels.length === 2);
      assert.strictEqual(mergedModels[0].get('title'), model2Update.get('title'));
      assert.strictEqual(mergedModels[1].get('title'), modelUpdate.get('title'));
    });
    collection.set([model2Update, modelUpdate]);
  });

  QUnit.test(
    "#3711 - set's `update` event should not be triggered adding a model which already exists exactly alike",
    function (assert) {
      let fired = false;
      const model = new Skeletor.Model({ id: 1, title: 'First Post' });
      const collection = new Skeletor.Collection([model]);
      collection.on('update', function (context, options) {
        fired = true;
      });
      collection.set([model]);
      assert.equal(fired, false);
    },
  );

  QUnit.test('get models with `attributes` key', function (assert) {
    const model = { id: 1, attributes: {} };
    const collection = new Skeletor.Collection([model]);
    assert.ok(collection.get(model));
  });
})(QUnit);
