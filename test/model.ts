import * as _ from 'lodash-es';
import * as sinon from 'sinon';
import * as Skeletor from '../src/index';
import { ModelAttributes, ModelOptions } from 'src/types';

// Make Skeletor available globally for tests
(window as any).Skeletor = Skeletor;

(function () {
  class ProxyModel extends Skeletor.Model {}
  class Klass extends Skeletor.Collection {
    get url() {
      return this._url || '/collection';
    }

    set url(url: string) {
      this._url = url;
    }
  }

  let doc: ProxyModel;
  let collection: Skeletor.Collection;

  QUnit.module('Skeletor.Model', {
    beforeEach() {
      sinon.stub(window, 'fetch').callsFake((_i: RequestInfo | URL) => Promise.resolve(new Response()));

      doc = new ProxyModel({
        id: '1-the-tempest',
        title: 'The Tempest',
        author: 'Bill Shakespeare',
        length: 123,
      });
      collection = new Klass();
      collection.add(doc);
    },

    afterEach() {
      (window.fetch as any).restore();
    },
  });

  QUnit.test('initialize', function (assert) {
    assert.expect(3);
    class Model extends Skeletor.Model {
      one: number;
      initialize() {
        this.one = 1;
        assert.equal(this.collection, collection);
      }
    }
    const model = new Model({}, { collection: collection });
    assert.equal((model as any).one, 1);
    assert.equal(model.collection, collection);
  });

  QUnit.test('Object.prototype properties are overridden by attributes', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model({ hasOwnProperty: true });
    assert.equal(model.get('hasOwnProperty'), true);
  });

  QUnit.test('initialize with attributes and options', function (assert) {
    assert.expect(1);
    class Model extends Skeletor.Model {
      one: number;
      initialize(_attributes?: any, options?: any) {
        this.one = options.one;
      }
    }
    const model = new Model({}, { one: 1 });
    assert.equal((model as any).one, 1);
  });

  QUnit.test('initialize with parsed attributes', function (assert) {
    assert.expect(1);
    class Model extends Skeletor.Model {
      parse(attrs: any) {
        attrs.value += 1;
        return attrs;
      }
    }
    const model = new Model({ value: 1 }, { parse: true });
    assert.equal(model.get('value'), 2);
  });

  QUnit.test('preinitialize', function (assert) {
    assert.expect(2);
    class Model extends Skeletor.Model {
      one: number;
      preinitialize() {
        this.one = 1;
      }
    }
    const model = new Model({}, { collection: collection });
    assert.equal((model as any).one, 1);
    assert.equal(model.collection, collection);
  });

  QUnit.test('preinitialize occurs before the model is set up', function (assert) {
    assert.expect(6);
    class Model extends Skeletor.Model {
      preinitialize() {
        assert.equal(this.collection, undefined);
        assert.equal(this.cid, undefined);
        assert.equal(this.id, undefined);
      }
    }
    const model = new Model({ id: 'foo' }, { collection: collection });
    assert.equal(model.collection, collection);
    assert.equal(model.id, 'foo');
    assert.notEqual(model.cid, undefined);
  });

  QUnit.test('parse can return null', function (assert) {
    assert.expect(1);
    class Model extends Skeletor.Model {
      parse(attrs: any) {
        attrs.value += 1;
        return null;
      }
    }
    const model = new Model({ value: 1 }, { parse: true });
    assert.equal(JSON.stringify(model.toJSON()), '{}');
  });

  QUnit.test('url', function (assert) {
    assert.expect(3);
    doc.urlRoot = null;
    assert.equal(doc.url, '/collection/1-the-tempest');
    doc.collection.url = '/collection/';
    assert.equal(doc.url, '/collection/1-the-tempest');
    doc.collection = null;
    assert.raises(() => doc.url);
    doc.collection = collection;
  });

  QUnit.test('url when using urlRoot, and uri encoding', function (assert) {
    assert.expect(2);
    class Model extends Skeletor.Model {
      get urlRoot() {
        return '/collection';
      }
    }
    const model = new Model();
    assert.equal(model.url, '/collection');
    model.set({ id: '+1+' });
    assert.equal(model.url, '/collection/%2B1%2B');
  });

  QUnit.test('url when using urlRoot as a function to determine urlRoot at runtime', function (assert) {
    assert.expect(2);
    class Model extends Skeletor.Model {
      get urlRoot() {
        return '/nested/' + this.get('parentId') + '/collection';
      }
    }

    const model = new Model({ parentId: 1 });
    assert.equal(model.url, '/nested/1/collection');
    model.set({ id: 2 });
    assert.equal(model.url, '/nested/1/collection/2');
  });

  QUnit.test('underscore methods', function (assert) {
    assert.expect(5);
    const model = new Skeletor.Model({ foo: 'a', bar: 'b', baz: 'c' });
    assert.deepEqual(model.keys(), ['foo', 'bar', 'baz']);
    assert.deepEqual(model.values(), ['a', 'b', 'c']);
    assert.deepEqual(model.invert(), { a: 'foo', b: 'bar', c: 'baz' });
    assert.deepEqual(model.pick('foo', 'baz'), { foo: 'a', baz: 'c' });
    assert.deepEqual(model.omit('foo', 'bar'), { baz: 'c' });
  });

  QUnit.test('isNew', function (assert) {
    assert.expect(6);
    let a = new Skeletor.Model({ foo: 1, bar: 2, baz: 3 } as ModelAttributes);
    assert.ok(a.isNew(), 'it should be new');
    a = new Skeletor.Model({ foo: 1, bar: 2, baz: 3, id: -5 } as ModelAttributes);
    assert.ok(!a.isNew(), 'any defined ID is legal, negative or positive');
    a = new Skeletor.Model({ foo: 1, bar: 2, baz: 3, id: 0 } as ModelAttributes);
    assert.ok(!a.isNew(), 'any defined ID is legal, including zero');
    assert.ok(new Skeletor.Model().isNew(), 'is true when there is no id');
    assert.ok(!new Skeletor.Model({ id: 2 }).isNew(), 'is false for a positive integer');
    assert.ok(!new Skeletor.Model({ id: -5 }).isNew(), 'is false for a negative integer');
  });

  QUnit.test('get', function (assert) {
    assert.expect(2);
    assert.equal(doc.get('title'), 'The Tempest');
    assert.equal(doc.get('author'), 'Bill Shakespeare');
  });

  QUnit.test('has', function (assert) {
    assert.expect(10);
    var model = new Skeletor.Model();

    assert.strictEqual(model.has('name'), false);

    model.set({
      '0': 0,
      '1': 1,
      'true': true,
      'false': false,
      'empty': '',
      'name': 'name',
      'null': null,
      'undefined': undefined,
    });

    assert.strictEqual(model.has('0'), true);
    assert.strictEqual(model.has('1'), true);
    assert.strictEqual(model.has('true'), true);
    assert.strictEqual(model.has('false'), true);
    assert.strictEqual(model.has('empty'), true);
    assert.strictEqual(model.has('name'), true);

    model.unset('name');

    assert.strictEqual(model.has('name'), false);
    assert.strictEqual(model.has('null'), false);
    assert.strictEqual(model.has('undefined'), false);
  });

  QUnit.test('matches', function (assert) {
    assert.expect(4);
    var model = new Skeletor.Model();

    assert.strictEqual(model.matches({ name: 'Jonas', cool: true }), false);

    model.set({ name: 'Jonas', cool: true });

    assert.strictEqual(model.matches({ name: 'Jonas' }), true);
    assert.strictEqual(model.matches({ name: 'Jonas', cool: true }), true);
    assert.strictEqual(model.matches({ name: 'Jonas', cool: false }), false);
  });

  QUnit.test('matches with predicate', function (assert) {
    var model = new Skeletor.Model({ a: 0 });

    assert.strictEqual(
      model.matches(function (attr: any) {
        return attr.a > 1 && attr.b != null;
      } as any),
      false
    );

    model.set({ a: 3, b: true } as any);

    assert.strictEqual(
      model.matches(function (attr: any) {
        return attr.a > 1 && attr.b != null;
      } as any),
      true
    );
  });

  QUnit.test('set and unset', function (assert) {
    assert.expect(8);
    var a = new Skeletor.Model({ id: 'id', foo: 1, bar: 2, baz: 3 });
    var changeCount = 0;
    a.on('change:foo', function () {
      changeCount += 1;
    });
    a.set({ foo: 2 });
    assert.equal(a.get('foo'), 2, 'Foo should have changed.');
    assert.equal(changeCount, 1, 'Change count should have incremented.');
    // set with value that is not new shouldn't fire change event
    a.set({ foo: 2 });
    assert.equal(a.get('foo'), 2, 'Foo should NOT have changed, still 2');
    assert.equal(changeCount, 1, 'Change count should NOT have incremented.');

    a.validate = function (attrs: any) {
      assert.equal(attrs.foo, undefined, 'validate:true passed while unsetting');
    };
    a.unset('foo', { validate: true });
    assert.equal(a.get('foo'), undefined, 'Foo should have changed');
    delete (a as any).validate;
    assert.equal(changeCount, 2, 'Change count should have incremented for unset.');

    a.unset('id');
    assert.equal(a.id, undefined, 'Unsetting the id should remove the id property.');
  });

  QUnit.test('#2030 - set with failed validate, followed by another set triggers change', function (assert) {
    var attr = 0,
      main = 0,
      error = 0;

    class Model extends Skeletor.Model {
      validate(attrs: any) {
        if (attrs.x > 1) {
          error++;
          return 'this is an error';
        }
      }
    }
    var model = new Model({ x: 0 });
    model.on('change:x', function () {
      attr++;
    });
    model.on('change', function () {
      main++;
    });
    model.set({ x: 2 }, { validate: true });
    model.set({ x: 1 }, { validate: true });
    assert.deepEqual([attr, main, error], [1, 1, 1]);
  });

  QUnit.test('set triggers changes in the correct order', function (assert) {
    var value = null;
    var model = new Skeletor.Model();
    model.on('last', function () {
      value = 'last';
    });
    model.on('first', function () {
      value = 'first';
    });
    model.trigger('first');
    model.trigger('last');
    assert.equal(value, 'last');
  });

  QUnit.test('set falsy values in the correct order', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model({ result: 'result' } as ModelAttributes);
    model.on('change', function () {
      assert.equal(model.changed.result, undefined);
      assert.equal(model.previous('result'), false);
    });
    model.set({ result: undefined }, { silent: true });
    model.set({ result: null }, { silent: true });
    model.set({ result: false }, { silent: true });
    model.set({ result: undefined });
  });

  QUnit.test('nested set triggers with the correct options', function (assert) {
    var model = new Skeletor.Model();
    var o1 = {};
    var o2 = {};
    var o3 = {};
    model.on('change', function (__: any, options: any) {
      switch (model.get('a')) {
        case 1:
          assert.equal(options, o1);
          return model.set('a', 2, o2);
        case 2:
          assert.equal(options, o2);
          return model.set('a', 3, o3);
        case 3:
          assert.equal(options, o3);
      }
    });
    model.set('a', 1, o1);
  });

  QUnit.test('multiple unsets', function (assert) {
    assert.expect(1);
    var i = 0;
    var counter = function () {
      i++;
    };
    var model = new Skeletor.Model({ a: 1 });
    model.on('change:a', counter);
    model.set({ a: 2 });
    model.unset('a');
    model.unset('a');
    assert.equal(i, 2, 'Unset does not fire an event for missing attributes.');
  });

  QUnit.test('unset and changedAttributes', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model({ a: 1 });
    model.on('change', function () {
      const changedAttrs = model.changedAttributes();
      if (changedAttrs) {
        assert.ok('a' in changedAttrs, 'changedAttributes should contain unset properties');
      } else {
        assert.ok(false, 'changedAttributes should not be false');
      }
    });
    model.unset('a');
  });

  QUnit.test('using a non-default id attribute.', function (assert) {
    assert.expect(5);
    class MongoModel extends Skeletor.Model {
      get idAttribute() {
        return '_id';
      }
    }

    const model = new MongoModel({ id: 'eye-dee', _id: 25, title: 'Model' });
    assert.equal(model.get('id'), 'eye-dee');
    assert.equal(model.id, 25);
    assert.equal(model.isNew(), false);
    model.unset('_id');
    assert.equal(model.id, undefined);
    assert.equal(model.isNew(), true);
  });

  QUnit.test('setting an alternative cid prefix', function (assert) {
    assert.expect(4);
    class Model extends Skeletor.Model {
      get cidPrefix() {
        return 'm';
      }
    }
    let model = new Model();

    assert.equal(model.cid.charAt(0), 'm');

    model = new Skeletor.Model();
    assert.equal(model.cid.charAt(0), 'c');

    class Collection extends Skeletor.Collection {
      get model() {
        return Model as any;
      }
    }
    const col = new Collection([{ id: 'c5' }, { id: 'c6' }, { id: 'c7' }]);

    assert.equal(col.get('c6').cid.charAt(0), 'm');
    col.set([{ id: 'c6', value: 'test' }], {
      merge: true,
      add: true,
      remove: false,
    });
    assert.ok(col.get('c6').has('value'));
  });

  QUnit.test('set an empty string', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model({ name: 'Model' });
    model.set({ name: '' });
    assert.equal(model.get('name'), '');
  });

  QUnit.test('setting an object', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model({
      custom: { foo: 1 },
    });
    model.on('change', function () {
      assert.ok(1);
    });
    model.set({
      custom: { foo: 1 }, // no change should be fired
    });
    model.set({
      custom: { foo: 2 }, // change event should be fired
    });
  });

  QUnit.test('clear', function (assert) {
    assert.expect(3);
    let changed: boolean;
    const model = new Skeletor.Model({ id: 1, name: 'Model' });
    model.on('change:name', function () {
      changed = true;
    });
    model.on('change', function () {
      const changedAttrs = model.changedAttributes() as Partial<ModelAttributes>;
      assert.ok('name' in changedAttrs);
    });
    model.clear();
    assert.equal(changed, true);
    assert.equal(model.get('name'), undefined);
  });

  QUnit.test('defaults', function (assert) {
    assert.expect(9);
    class Defaulted extends Skeletor.Model {
      defaults() {
        return {
          one: 1,
          two: 2,
        };
      }
    }
    let model: Skeletor.Model = new Defaulted({ two: undefined });
    assert.equal(model.get('one'), 1);
    assert.equal(model.get('two'), 2);
    model = new Defaulted({ two: 3 });
    assert.equal(model.get('one'), 1);
    assert.equal(model.get('two'), 3);

    class Defaulted2 extends Skeletor.Model {
      defaults() {
        return {
          one: 3,
          two: 4,
        };
      }
    }

    model = new Defaulted2({ two: undefined });
    assert.equal(model.get('one'), 3);
    assert.equal(model.get('two'), 4);

    class Defaulted3 extends Skeletor.Model {
      defaults() {
        return {
          hasOwnProperty: true,
        };
      }
    }
    model = new Defaulted3();
    assert.equal(model.get('hasOwnProperty'), true);
    model = new Defaulted3({ hasOwnProperty: undefined });
    assert.equal(model.get('hasOwnProperty'), true);
    model = new Defaulted3({ hasOwnProperty: false });
    assert.equal(model.get('hasOwnProperty'), false);
  });

  QUnit.test('change, hasChanged, changedAttributes, previous, previousAttributes', function (assert) {
    assert.expect(9);
    var model = new Skeletor.Model({ name: 'Tim', age: 10 });
    assert.deepEqual(model.changedAttributes(), false);
    model.on('change', function () {
      assert.ok(model.hasChanged('name'), 'name changed');
      assert.ok(!model.hasChanged('age'), 'age did not');
      assert.ok(_.isEqual(model.changedAttributes(), { name: 'Rob' }), 'changedAttributes returns the changed attrs');
      assert.equal(model.previous('name'), 'Tim');
      assert.ok(_.isEqual(model.previousAttributes(), { name: 'Tim', age: 10 }), 'previousAttributes is correct');
    });
    assert.equal(model.hasChanged(), false);
    assert.equal(model.hasChanged(undefined), false);
    model.set({ name: 'Rob' });
    assert.equal(model.get('name'), 'Rob');
  });

  QUnit.test('changedAttributes', function (assert) {
    assert.expect(3);
    const model = new Skeletor.Model({ a: 'a', b: 'b' });
    assert.deepEqual(model.changedAttributes(), false);
    assert.equal(model.changedAttributes({ a: 'a' }), false);
    assert.equal((model.changedAttributes({ a: 'b' }) as any).a, 'b');
  });

  QUnit.test('change with options', function (assert) {
    assert.expect(2);
    let value: string = '';
    const model = new Skeletor.Model({ name: 'Rob' });
    model.on('change', function (m: Skeletor.Model, options: ModelOptions) {
      value = options.prefix + m.get('name');
    });
    model.set({ name: 'Bob' }, { prefix: 'Mr. ' });
    assert.equal(value, 'Mr. Bob');
    model.set({ name: 'Sue' }, { prefix: 'Ms. ' });
    assert.equal(value, 'Ms. Sue');
  });

  QUnit.test('change after initialize', function (assert) {
    assert.expect(1);
    var changed = 0;
    var attrs = { id: 1, label: 'c' };
    var obj = new Skeletor.Model(attrs);
    obj.on('change', function () {
      changed += 1;
    });
    obj.set(attrs);
    assert.equal(changed, 0);
  });

  QUnit.test('save within change event', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model({ firstName: 'Roger', lastName: 'Penrose' });
    model.url = '/test';
    model.on('change', function () {
      const syncSpy = sinon.spy(model, 'sync');
      model.save();
      const syncArgs = syncSpy.lastCall.args;
      assert.ok(_.isEqual(syncArgs[1], model));
      syncSpy.restore();
    });
    model.set({ lastName: 'Hicks' });
  });

  QUnit.test('validate after save', function (assert) {
    assert.expect(2);
    let lastError;
    const model = new Skeletor.Model();
    model.validate = function (attrs) {
      if (attrs.admin) return "Can't change admin status.";
    };
    model.sync = function (_method, _m, options) {
      options.success.call(this, { admin: true });
    };
    model.on('invalid', function (_m, error) {
      lastError = error;
    });
    model.save(null);

    assert.equal(lastError, "Can't change admin status.");
    assert.equal(model.validationError, "Can't change admin status.");
  });

  QUnit.test('save', function (assert) {
    const syncSpy = sinon.spy(doc, 'sync');
    assert.expect(2);
    doc.save({ title: 'Henry V' });
    const syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'update');
    assert.ok(_.isEqual(syncArgs[1], doc));
    syncSpy.restore();
  });

  QUnit.test('save and return promise', async function (assert) {
    const done = assert.async();
    const syncSpy = sinon.spy(doc, 'sync');
    assert.expect(3);
    const promise = doc.save({ title: 'Henry V' }, { 'promise': true, 'wait': true });
    assert.equal((promise as any).isResolved, false);
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    ajaxSettings.success();
    await promise;
    const syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'update');
    assert.ok(_.isEqual(syncArgs[1], doc));
    syncSpy.restore();
    done();
  });

  QUnit.test('save, fetch, destroy triggers error event when an error occurs', function (assert) {
    assert.expect(3);
    var model = new Skeletor.Model();
    model.on('error', () => assert.ok(true));
    model.sync = (_method, _m, options) => options.error();
    model.save({ data: 2, id: 1 });
    model.fetch();
    model.destroy();
  });

  QUnit.test('#3283 - save, fetch, destroy calls success with context', function (assert) {
    assert.expect(3);
    const model = new Skeletor.Model();
    const obj = {};
    const options = {
      context: obj,
      success() {
        assert.equal(this, obj);
      },
    };
    model.sync = (_method, _m, opts) => opts.success.call(opts.context);
    model.save({ data: 2, id: 1 }, options);
    model.fetch(options);
    model.destroy(options);
  });

  QUnit.test('#3283 - save, fetch, destroy calls error with context', function (assert) {
    assert.expect(3);
    const model = new Skeletor.Model();
    var obj = {};
    var options = {
      context: obj,
      error() {
        assert.equal(this, obj);
      },
    };
    model.sync = (_method, _m, opts) => opts.error.call(opts.context);
    model.save({ data: 2, id: 1 }, options);
    model.fetch(options);
    model.destroy(options);
  });

  QUnit.test('#3470 - save and fetch with parse false', function (assert) {
    assert.expect(2);
    let i = 0;
    const model = new Skeletor.Model();
    model.parse = () => assert.ok(false);
    model.sync = (_method, _m, options) => options.success({ i: ++i });
    model.fetch({ parse: false });
    assert.equal(model.get('i'), i);
    model.save(null, { parse: false });
    assert.equal(model.get('i'), i);
  });

  QUnit.test('save with PATCH', function (assert) {
    const syncSpy = sinon.spy(doc, 'sync');
    doc.clear();
    doc.set({ id: 1, a: 1, b: 2, c: 3, d: 4 });
    doc.save();
    let syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'update');
    assert.equal(syncArgs[2].attrs, undefined);

    doc.save({ b: 2, d: 4 }, { patch: true });
    syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'patch');
    assert.equal(_.size(syncArgs[2].attrs), 2);
    assert.equal(syncArgs[2].attrs.d, 4);
    assert.equal(syncArgs[2].attrs.a, undefined);
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    assert.equal(ajaxSettings.body, '{"b":2,"d":4}');
    syncSpy.restore();
  });

  QUnit.test('save with PATCH and different attrs', function (assert) {
    const syncSpy = sinon.spy(doc, 'sync');
    doc.clear();
    doc.save({ b: 2, d: 4 }, { patch: true, attrs: { B: 1, D: 3 } });
    const syncArgs = syncSpy.lastCall.args;
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    assert.equal(syncArgs[2].attrs.D, 3);
    assert.equal(syncArgs[2].attrs.d, undefined);
    assert.equal(ajaxSettings.body, '{"B":1,"D":3}');
    assert.deepEqual(doc.attributes, { b: 2, d: 4 });
    syncSpy.restore();
  });

  QUnit.test('save in positional style', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.sync = (_method, _m, options) => options.success();
    model.save('title', 'Twelfth Night');
    assert.equal(model.get('title'), 'Twelfth Night');
  });

  QUnit.test('save with non-object success response', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    model.sync = function (method, m, options) {
      options.success('', options);
      options.success(null, options);
    };
    model.save(
      { testing: 'empty' },
      {
        success(m) {
          assert.deepEqual(m.attributes, { testing: 'empty' });
        },
      }
    );
  });

  QUnit.test('save with wait and supplied id', function (assert) {
    class Model extends Skeletor.Model {
      get urlRoot() {
        return '/collection';
      }
    }
    const model = new Model();
    model.save({ id: 42 }, { wait: true });
    const url = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[0];
    assert.equal(url, '/collection/42');
  });

  QUnit.test('save will pass extra options to success callback', function (assert) {
    assert.expect(1);
    class SpecialSyncModel extends Skeletor.Model {
      get urlRoot() {
        return '/test';
      }
      sync(method, m, options) {
        _.extend(options, { specialSync: true });
        return Skeletor.Model.prototype.sync.call(this, method, m, options);
      }
    }

    const model = new SpecialSyncModel();
    const onSuccess = function (m, response, options) {
      assert.ok((options as any).specialSync, 'Options were passed correctly to callback');
    };
    model.save(null, { success: onSuccess });
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    ajaxSettings.success();
  });

  QUnit.test('fetch', function (assert) {
    assert.expect(2);
    const syncSpy = sinon.spy(doc, 'sync');
    doc.fetch();
    const syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'read');
    assert.ok(_.isEqual(syncArgs[1], doc));
    syncSpy.restore();
  });

  QUnit.test('fetch will pass extra options to success callback', function (assert) {
    assert.expect(1);
    class SpecialSyncModel extends Skeletor.Model {
      get urlRoot() {
        return '/test';
      }
      sync(method, m, options) {
        _.extend(options, { specialSync: true });
        return Skeletor.Model.prototype.sync.call(this, method, m, options);
      }
    }

    const model = new SpecialSyncModel();
    const onSuccess = function (m, response, options) {
      assert.ok((options as any).specialSync, 'Options were passed correctly to callback');
    };
    model.fetch({ success: onSuccess });
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    ajaxSettings.success();
  });

  QUnit.test('destroy', function (assert) {
    assert.expect(3);
    const syncSpy = sinon.spy(doc, 'sync');
    doc.destroy();
    const syncArgs = syncSpy.lastCall.args;
    assert.equal(syncArgs[0], 'delete');
    assert.ok(_.isEqual(syncArgs[1], doc));
    const newModel = new Skeletor.Model();
    assert.equal(newModel.destroy(), false);
    syncSpy.restore();
  });

  QUnit.test('destroy will pass extra options to success callback', function (assert) {
    assert.expect(1);

    class SpecialSyncModel extends Skeletor.Model {
      get urlRoot() {
        return '/test';
      }

      sync(method, m, options) {
        Object.assign(options, { specialSync: true });
        return super.sync(method, m, options);
      }
    }

    const model = new SpecialSyncModel({ id: 'id' });
    const onSuccess = function (m, response, options) {
      assert.ok((options as any).specialSync, 'Options were passed correctly to callback');
    };
    model.destroy({ success: onSuccess });
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];
    ajaxSettings.success();
  });

  QUnit.test('non-persisted destroy', function (assert) {
    assert.expect(1);
    const a = new Skeletor.Model({ foo: 1, bar: 2, baz: 3 });
    a.sync = function () {
      throw 'should not be called';
    };
    a.destroy();
    assert.ok(true, 'non-persisted model should not call sync');
  });

  QUnit.test('validate', function (assert) {
    let lastError;
    const model = new Skeletor.Model();
    model.validate = function (attrs) {
      if (attrs.admin !== this.get('admin')) {
        return "Can't change admin status.";
      } else {
        return null;
      }
    };
    model.on('invalid', function (m, error) {
      lastError = error;
    });
    let result = model.set({ a: 100 });
    assert.equal(result, model);
    assert.equal(model.get('a'), 100);
    assert.equal(lastError, undefined);
    result = model.set({ admin: true });
    assert.equal(model.get('admin'), true);
    result = model.set({ a: 200, admin: false }, { validate: true });
    assert.equal(lastError, "Can't change admin status.");
    assert.equal(result, false);
    assert.equal(model.get('a'), 100);
  });

  QUnit.test('validate on unset and clear', function (assert) {
    assert.expect(6);
    let error;
    const model = new Skeletor.Model({ name: 'One' });
    model.validate = function (attrs) {
      if (!attrs.name) {
        error = true;
        return 'No thanks.';
      }
    };
    model.set({ name: 'Two' });
    assert.equal(model.get('name'), 'Two');
    assert.equal(error, undefined);
    model.unset('name', { validate: true });
    assert.equal(error, true);
    assert.equal(model.get('name'), 'Two');
    model.clear({ validate: true });
    assert.equal(model.get('name'), 'Two');
    delete model.validate;
    model.clear();
    assert.equal(model.get('name'), undefined);
  });

  QUnit.test('validate with error callback', function (assert) {
    assert.expect(8);
    var lastError, boundError;
    var model = new Skeletor.Model();
    model.validate = function (attrs) {
      if (attrs.admin) return "Can't change admin status.";
    };
    model.on('invalid', function (m, error) {
      boundError = true;
    });
    var result = model.set({ a: 100 }, { validate: true });
    assert.equal(result, model);
    assert.equal(model.get('a'), 100);
    assert.equal(model.validationError, null);
    assert.equal(boundError, undefined);
    result = model.set({ a: 200, admin: true }, { validate: true });
    assert.equal(result, false);
    assert.equal(model.get('a'), 100);
    assert.equal(model.validationError, "Can't change admin status.");
    assert.equal(boundError, true);
  });

  QUnit.test('defaults always extend attrs (#459)', function (assert) {
    assert.expect(2);
    class Defaulted extends Skeletor.Model {
      defaults() {
        return { one: 1 };
      }

      initialize(attrs: any, opts: any) {
        assert.equal(this.attributes.one, 1);
      }
    }
    var providedattrs = new Defaulted({});
    var emptyattrs = new Defaulted();
  });

  QUnit.test("Nested change events don't clobber previous attributes", function (assert) {
    assert.expect(4);
    new Skeletor.Model()
      .on('change:state', function (m, newState) {
        assert.equal(m.previous('state'), undefined);
        assert.equal(newState, 'hello');
        // Fire a nested change event.
        m.set({ other: 'whatever' });
      })
      .on('change:state', function (m, newState) {
        assert.equal(m.previous('state'), undefined);
        assert.equal(newState, 'hello');
      })
      .set({ state: 'hello' });
  });

  QUnit.test('hasChanged/set should use same comparison', function (assert) {
    assert.expect(2);
    var changed = 0,
      model = new Skeletor.Model({ a: null });
    model
      .on('change', function () {
        assert.ok(this.hasChanged('a'));
      })
      .on('change:a', function () {
        changed++;
      })
      .set({ a: undefined });
    assert.equal(changed, 1);
  });

  QUnit.test('#582, #425, change:attribute callbacks should fire after all changes have occurred', function (assert) {
    assert.expect(9);
    var model = new Skeletor.Model();

    var assertion = function () {
      assert.equal(model.get('a'), 'a');
      assert.equal(model.get('b'), 'b');
      assert.equal(model.get('c'), 'c');
    };

    model.on('change:a', assertion);
    model.on('change:b', assertion);
    model.on('change:c', assertion);

    model.set({ a: 'a', b: 'b', c: 'c' });
  });

  QUnit.test('#871, set with attributes property', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model();
    model.set({ attributes: true });
    assert.ok(model.has('attributes'));
  });

  QUnit.test('set value regardless of equality/change', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model({ x: [] });
    var a = [];
    model.set({ x: a });
    assert.ok(model.get('x') === a);
  });

  QUnit.test('set same value does not trigger change', function (assert) {
    assert.expect(0);
    var model = new Skeletor.Model({ x: 1 });
    model.on('change change:x', function () {
      assert.ok(false);
    });
    model.set({ x: 1 });
    model.set({ x: 1 });
  });

  QUnit.test('unset does not fire a change for undefined attributes', function (assert) {
    assert.expect(0);
    var model = new Skeletor.Model({ x: undefined });
    model.on('change:x', function () {
      assert.ok(false);
    });
    model.unset('x');
  });

  QUnit.test('set: undefined values', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model({ x: undefined });
    assert.ok('x' in model.attributes);
  });

  QUnit.test('hasChanged works outside of change events, and true within', function (assert) {
    assert.expect(6);
    var model = new Skeletor.Model({ x: 1 });
    model.on('change:x', function () {
      assert.ok(model.hasChanged('x'));
      assert.equal(model.get('x'), 1);
    });
    model.set({ x: 2 }, { silent: true });
    assert.ok(model.hasChanged());
    assert.equal(model.hasChanged('x'), true);
    model.set({ x: 1 });
    assert.ok(model.hasChanged());
    assert.equal(model.hasChanged('x'), true);
  });

  QUnit.test('hasChanged gets cleared on the following set', function (assert) {
    assert.expect(4);
    var model = new Skeletor.Model();
    model.set({ x: 1 });
    assert.ok(model.hasChanged());
    model.set({ x: 1 });
    assert.ok(!model.hasChanged());
    model.set({ x: 2 });
    assert.ok(model.hasChanged());
    model.set({});
    assert.ok(!model.hasChanged());
  });

  QUnit.test('save with `wait` succeeds without `validate`', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    const syncSpy = sinon.spy(model, 'sync');
    (model as Skeletor.Model).url = '/test';
    model.save({ x: 1 }, { wait: true });
    const syncArgs = syncSpy.lastCall.args;
    assert.ok(syncArgs[1] === model);
    syncSpy.restore();
  });

  QUnit.test("save without `wait` doesn't set invalid attributes", function (assert) {
    var model = new Skeletor.Model();
    model.url = '/test';
    model.validate = function () {
      return 1;
    };
    model.save({ a: 1 });
    assert.equal(model.get('a'), undefined);
  });

  QUnit.test("save doesn't validate twice", function (assert) {
    var model = new Skeletor.Model();
    model.url = '/test';
    var times = 0;
    model.sync = function () {};
    model.validate = function () {
      ++times;
    };
    model.save({});
    assert.equal(times, 1);
  });

  QUnit.test('`hasChanged` for falsey keys', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    model.set({ x: true }, { silent: true });
    assert.ok(!model.hasChanged(0));
    assert.ok(!model.hasChanged(''));
  });

  QUnit.test('`previous` for falsey keys', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model({ '0': true, '': true });
    model.set({ '0': false, '': false }, { silent: true });
    assert.equal(model.previous('0'), true);
    assert.equal(model.previous(''), true);
  });

  QUnit.test('`save` with `wait` sends correct attributes', function (assert) {
    assert.expect(5);
    let changed = 0;
    const model = new Skeletor.Model({ x: 1, y: 2 });
    model.url = '/test';
    model.on('change:x', () => changed++);
    model.save({ x: 3 }, { wait: true });
    const ajaxSettings = (window.fetch as any).getCall((window.fetch as any).callCount - 1).args[1];

    assert.deepEqual(JSON.parse(ajaxSettings.body), { x: 3, y: 2 });
    assert.equal(model.get('x'), 1);
    assert.equal(changed, 0);
    ajaxSettings.success({});
    assert.equal(model.get('x'), 3);
    assert.equal(changed, 1);
  });

  QUnit.test("a failed `save` with `wait` doesn't leave attributes behind", function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.url = '/test';
    model.save({ x: 1 }, { wait: true });
    assert.equal(model.get('x'), undefined);
  });

  QUnit.test(
    '#1030 - `save` with `wait` results in correct attributes if success is called during sync',
    function (assert) {
      assert.expect(2);
      const model = new Skeletor.Model({ x: 1, y: 2 });
      model.sync = function (method, m, options) {
        options.success();
      };
      model.on('change:x', function () {
        assert.ok(true);
      });
      model.save({ x: 3 }, { wait: true });
      assert.equal(model.get('x'), 3);
    }
  );

  QUnit.test('save with wait validates attributes', function (assert) {
    const model = new Skeletor.Model();
    model.url = '/test';
    model.validate = function () {
      assert.ok(true);
    };
    model.save({ x: 1 }, { wait: true });
  });

  QUnit.test('save turns on parse flag', function (assert) {
    class Model extends Skeletor.Model {
      sync(method, m, options) {
        assert.ok(options.parse);
      }
    }
    const model = new Model();
    model.sync = function (method, m, options) {
      assert.ok(options.parse);
    };
    model.save();
  });

  QUnit.test("nested `set` during `'change:attr'`", function (assert) {
    assert.expect(2);
    let events = [];
    const model = new Skeletor.Model();
    model.on('all', function (event) {
      events.push(event);
    });
    model.on('change', function () {
      model.set({ z: true }, { silent: true });
    });
    model.on('change:x', function () {
      model.set({ y: true });
    });
    model.set({ x: true });
    assert.deepEqual(events, ['change:y', 'change:x', 'change']);
    events = [];
    model.set({ z: true });
    assert.deepEqual(events, []);
  });

  QUnit.test('nested `change` only fires once', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.on('change', function () {
      assert.ok(true);
      model.set({ x: true });
    });
    model.set({ x: true });
  });

  QUnit.test("nested `set` during `'change'`", function (assert) {
    assert.expect(6);
    let count = 0;
    const model = new Skeletor.Model();
    model.on('change', function () {
      switch (count++) {
        case 0:
          assert.deepEqual(this.changedAttributes(), { x: true });
          assert.equal(model.previous('x'), undefined);
          model.set({ y: true });
          break;
        case 1:
          assert.deepEqual(this.changedAttributes(), { x: true, y: true });
          assert.equal(model.previous('x'), undefined);
          model.set({ z: true });
          break;
        case 2:
          assert.deepEqual(this.changedAttributes(), { x: true, y: true, z: true });
          assert.equal(model.previous('y'), undefined);
          break;
        default:
          assert.ok(false);
      }
    });
    model.set({ x: true });
  });

  QUnit.test('nested `change` with silent', function (assert) {
    assert.expect(3);
    let count = 0;
    const model = new Skeletor.Model();
    model.on('change:y', function () {
      assert.ok(false);
    });
    model.on('change', function () {
      switch (count++) {
        case 0:
          assert.deepEqual(this.changedAttributes(), { x: true });
          model.set({ y: true }, { silent: true });
          model.set({ z: true });
          break;
        case 1:
          assert.deepEqual(this.changedAttributes(), { x: true, y: true, z: true });
          break;
        case 2:
          assert.deepEqual(this.changedAttributes(), { z: false });
          break;
        default:
          assert.ok(false);
      }
    });
    model.set({ x: true });
    model.set({ z: false });
  });

  QUnit.test('nested `change:attr` with silent', function (assert) {
    assert.expect(0);
    const model = new Skeletor.Model();
    model.on('change:y', function () {
      assert.ok(false);
    });
    model.on('change', function () {
      model.set({ y: true }, { silent: true });
      model.set({ z: true });
    });
    model.set({ x: true });
  });

  QUnit.test('multiple nested changes with silent', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.on('change:x', function () {
      model.set({ y: 1 }, { silent: true });
      model.set({ y: 2 });
    });
    model.on('change:y', function (m, val) {
      assert.equal(val, 2);
    });
    model.set({ x: true });
  });

  QUnit.test('multiple nested changes with silent', function (assert) {
    assert.expect(1);
    const changes = [];
    const model = new Skeletor.Model();
    model.on('change:b', function (m, val) {
      changes.push(val);
    });
    model.on('change', function () {
      model.set({ b: 1 });
    });
    model.set({ b: 0 });
    assert.deepEqual(changes, [0, 1]);
  });

  QUnit.test('basic silent change semantics', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.set({ x: 1 });
    model.on('change', function () {
      assert.ok(true);
    });
    model.set({ x: 2 }, { silent: true });
    model.set({ x: 1 });
  });

  QUnit.test('nested set multiple times', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.on('change:b', function () {
      assert.ok(true);
    });
    model.on('change:a', function () {
      model.set({ b: true });
      model.set({ b: true });
    });
    model.set({ a: true });
  });

  QUnit.test('#1122 - clear does not alter options.', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    const options = {} as ModelOptions;
    model.clear(options);
    assert.ok(!options.unset);
  });

  QUnit.test('#1122 - unset does not alter options.', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    const options = {} as ModelOptions;
    model.unset('x', options);
    assert.ok(!options.unset);
  });

  QUnit.test('#1355 - `options` is passed to success callbacks', function (assert) {
    assert.expect(3);
    const model = new Skeletor.Model();
    const opts = {
      success(m, resp, options) {
        assert.ok(options);
      },
    };
    model.sync = function (method, m, options) {
      options.success();
    };
    model.save({ id: 1 }, opts);
    model.fetch(opts);
    model.destroy(opts);
  });

  QUnit.test("#1412 - Trigger 'sync' event.", function (assert) {
    assert.expect(3);
    const model = new Skeletor.Model({ id: 1 });
    model.sync = function (method, m, options) {
      options.success();
    };
    model.on('sync', function () {
      assert.ok(true);
    });
    model.fetch();
    model.save();
    model.destroy();
  });

  QUnit.test('#1365 - Destroy: New models execute success callback.', function (assert) {
    const done = assert.async();
    assert.expect(2);
    new Skeletor.Model()
      .on('sync', function () {
        assert.ok(false);
      })
      .on('destroy', function () {
        assert.ok(true);
      })
      .destroy({
        success() {
          assert.ok(true);
          done();
        },
      });
  });

  QUnit.test('#1433 - Save: An invalid model cannot be persisted.', function (assert) {
    assert.expect(1);
    var model = new Skeletor.Model();
    model.validate = function () {
      return 'invalid';
    };
    model.sync = function () {
      assert.ok(false);
    };
    assert.strictEqual(model.save(), false);
  });

  QUnit.test("#1377 - Save without attrs triggers 'error'.", function (assert) {
    assert.expect(1);

    class Model extends Skeletor.Model {
      constructor(attributes?: ModelAttributes, options?: ModelOptions) {
        super(attributes, options);
        this.url = '/test/';
      }
      sync(method, m, options) {
        options.success();
      }
      validate() {
        return 'invalid';
      }
    }

    const model = new Model({ id: 1 });
    model.on('invalid', () => assert.ok(true));
    model.save();
  });

  QUnit.test('#1545 - `undefined` can be passed to a model constructor without coersion', function (assert) {
    class Model extends Skeletor.Model {
      defaults() {
        return {
          one: 1,
        };
      }
      initialize(attrs, opts) {
        assert.equal(attrs, undefined);
      }
    }
    new Model(); // Empty attrs
    new Model(undefined); // Undefined attrs
  });

  QUnit.test('#1478 - Model `save` does not trigger change on unchanged attributes', function (assert) {
    const done = assert.async();
    assert.expect(0);
    class Model extends Skeletor.Model {
      sync(method, m, options) {
        setTimeout(function () {
          options.success();
          done();
        }, 0);
      }
    }

    new Model({ x: true })
      .on('change:x', function () {
        assert.ok(false);
      })
      .save(null, { wait: true });
  });

  QUnit.test(
    '#1664 - Changing from one value, silently to another, back to original triggers a change.',
    function (assert) {
      assert.expect(1);
      const model = new Skeletor.Model({ x: 1 });
      model.on('change:x', function () {
        assert.ok(true);
      });
      model.set({ x: 2 }, { silent: true });
      model.set({ x: 3 }, { silent: true });
      model.set({ x: 1 });
    }
  );

  QUnit.test('#1664 - multiple silent changes nested inside a change event', function (assert) {
    assert.expect(2);
    const changes = [];
    const model = new Skeletor.Model();
    model.on('change', function () {
      model.set({ a: 'c' }, { silent: true });
      model.set({ b: 2 }, { silent: true });
      model.unset('c', { silent: true });
    });
    model.on('change:a change:b change:c', function (m, val) {
      changes.push(val);
    });
    model.set({ a: 'a', b: 1, c: 'item' });
    assert.deepEqual(changes, ['a', 1, 'item']);
    assert.deepEqual(model.attributes, { a: 'c', b: 2 });
  });

  QUnit.test('#1791 - `attributes` is available for `parse`', function (assert) {
    class Model extends Skeletor.Model {
      parse() {
        this.has('a');
      } // shouldn't throw an error
    }
    new Model(null, { parse: true });
    assert.expect(0);
  });

  QUnit.test('silent changes in last `change` event back to original triggers change', function (assert) {
    assert.expect(2);
    const changes = [];
    const model = new Skeletor.Model();
    model.on('change:a change:b change:c', function (m, val) {
      changes.push(val);
    });
    model.on('change', function () {
      model.set({ a: 'c' }, { silent: true });
    });
    model.set({ a: 'a' });
    assert.deepEqual(changes, ['a']);
    model.set({ a: 'a' });
    assert.deepEqual(changes, ['a', 'a']);
  });

  QUnit.test('#1943 change calculations should use _.isEqual', function (assert) {
    const model = new Skeletor.Model({ a: { key: 'value' } });
    model.set('a', { key: 'value' }, { silent: true });
    assert.equal(model.changedAttributes(), false);
  });

  QUnit.test('#1964 - final `change` event is always fired, regardless of interim changes', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.on('change:property', function () {
      model.set('property', 'bar');
    });
    model.on('change', function () {
      assert.ok(true);
    });
    model.set('property', 'foo');
  });

  QUnit.test('isValid', function (assert) {
    const model = new Skeletor.Model({ valid: true });
    model.validate = function (attrs) {
      if (!attrs.valid) return 'invalid';
    };
    assert.equal(model.isValid(), true);
    assert.equal(model.set({ valid: false }, { validate: true }), false);
    assert.equal(model.isValid(), true);
    model.set({ valid: false });
    assert.equal(model.isValid(), false);
    assert.ok(!model.set('valid', false, { validate: true }));
  });

  QUnit.test('#1179 - isValid returns true in the absence of validate.', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.validate = () => null;
    assert.ok(model.isValid());
  });

  QUnit.test(
    '#1961 - Creating a model with {validate:true} will call validate and use the error callback',
    function (assert) {
      class Model extends Skeletor.Model {
        validate(attrs) {
          if (attrs.id === 1) return "This shouldn't happen";
        }
      }
      const model = new Model({ id: 1 }, { validate: true });
      assert.equal(model.validationError, "This shouldn't happen");
    }
  );

  QUnit.test('toJSON receives attrs during save(..., {wait: true})', function (assert) {
    assert.expect(1);
    class Model extends Skeletor.Model {
      constructor(attributes?: ModelAttributes, options?: ModelOptions) {
        super(attributes, options);
        this.url = '/test';
      }
      toJSON() {
        assert.strictEqual(this.attributes.x, 1);
        return _.clone(this.attributes);
      }
    }
    const model = new Model();
    model.save({ x: 1 }, { wait: true });
  });

  QUnit.test('#2034 - nested set with silent only triggers one change', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.on('change', function () {
      model.set({ b: true }, { silent: true });
      assert.ok(true);
    });
    model.set({ a: true });
  });

  QUnit.test('#3778 - id will only be updated if it is set', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model({ id: 1 } as ModelAttributes);
    model.id = 2;
    model.set({ foo: 'bar' });
    assert.equal(model.id, 2);
    model.set({ id: 3 });
    assert.equal(model.id, 3);
  });
})();
