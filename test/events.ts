// QUnit is loaded globally via karma.conf.js
import * as _ from 'lodash-es';
import * as Skeletor from '../src/index';
import { EventCallbackMap } from '../src/types';

(function () {
  class Foo extends Skeletor.EventEmitter(Object) {
    counter: number;
    constructor() {
      super();
      this.counter = 0;
    }
  }

  class FooWith2Counters extends Skeletor.EventEmitter(Object) {
    counterA: number;
    counterB: number;
    constructor() {
      super();
      this.counterA = 0;
      this.counterB = 0;
    }
  }

  QUnit.module('Skeletor.EventEmitter');

  QUnit.test('on and trigger', function (assert) {
    assert.expect(2);

    const foo = new Foo();
    foo.on('event', function () {
      foo.counter += 1;
    });
    foo.trigger('event');
    assert.equal(foo.counter, 1, 'counter should be incremented.');
    foo.trigger('event');
    foo.trigger('event');
    foo.trigger('event');
    foo.trigger('event');
    assert.equal(foo.counter, 5, 'counter should be incremented five times.');
  });

  QUnit.test('binding and triggering multiple events', function (assert) {
    assert.expect(4);

    const foo = new Foo();
    foo.on('a b c', function () {
      foo.counter += 1;
    });

    foo.trigger('a');
    assert.equal(foo.counter, 1);

    foo.trigger('a b');
    assert.equal(foo.counter, 3);

    foo.trigger('c');
    assert.equal(foo.counter, 4);

    foo.off('a c');
    foo.trigger('a b c');
    assert.equal(foo.counter, 5);
  });

  QUnit.test('binding and triggering with event maps', function (assert) {
    class Foo extends Skeletor.EventEmitter(Object) {
      counter: number;
      constructor() {
        super();
        this.counter = 0;
      }

      increment() {
        this.counter += 1;
      }
    }

    const foo = new Foo();

    foo.on(
      {
        a: foo.increment,
        b: foo.increment,
        c: foo.increment,
      },
      foo
    );

    foo.trigger('a');
    assert.equal(foo.counter, 1);

    foo.trigger('a b');
    assert.equal(foo.counter, 3);

    foo.trigger('c');
    assert.equal(foo.counter, 4);

    foo.off(
      {
        a: foo.increment,
        c: foo.increment,
      },
      foo
    );
    foo.trigger('a b c');
    assert.equal(foo.counter, 5);
  });

  QUnit.test('binding and triggering multiple event names with event maps', function (assert) {
    class Foo extends Skeletor.EventEmitter(Object) {
      counter: number;
      constructor() {
        super();
        this.counter = 0;
      }

      increment() {
        this.counter += 1;
      }
    }

    const foo = new Foo();

    foo.on({
      'a b c': foo.increment,
    });

    foo.trigger('a');
    assert.equal(foo.counter, 1);

    foo.trigger('a b');
    assert.equal(foo.counter, 3);

    foo.trigger('c');
    assert.equal(foo.counter, 4);

    foo.off({
      'a c': foo.increment,
    });
    foo.trigger('a b c');
    assert.equal(foo.counter, 5);
  });

  QUnit.test('binding and trigger with event maps context', function (assert) {
    assert.expect(2);

    const context = {};
    const foo = new Foo();

    foo
      .on(
        {
          a: function () {
            assert.strictEqual(this, context, 'defaults `context` to `callback` param');
          },
        },
        context
      )
      .trigger('a');

    foo
      .off()
      .on(
        {
          a: function () {
            assert.strictEqual(this, context, 'will not override explicit `context` param');
          },
        },
        this,
        context
      )
      .trigger('a');
  });

  QUnit.test('listenTo and stopListening', function (assert) {
    assert.expect(1);
    const a = new Foo();
    const b = new Foo();
    a.listenTo(b, 'all', function () {
      assert.ok(true);
    });
    b.trigger('anything');
    a.listenTo(b, 'all', function () {
      assert.ok(false);
    });
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo and stopListening with event maps', function (assert) {
    assert.expect(4);
    const a = new Foo();
    const b = new Foo();
    const cb = function () {
      assert.ok(true);
    };
    a.listenTo(b, { event: cb } as EventCallbackMap);
    b.trigger('event');
    a.listenTo(b, { event2: cb } as EventCallbackMap);
    b.on('event2', cb);
    a.stopListening(b, { event2: cb } as EventCallbackMap);
    b.trigger('event event2');
    a.stopListening();
    b.trigger('event event2');
  });

  QUnit.test('stopListening with omitted args', function (assert) {
    assert.expect(2);
    const a = new Foo();
    const b = new Foo();
    const cb = () => assert.ok(true);
    a.listenTo(b, 'event', cb);
    b.on('event', cb);
    a.listenTo(b, 'event2', cb);
    a.stopListening(null, { event: cb });
    b.trigger('event event2');
    b.off();
    a.listenTo(b, 'event event2', cb);
    a.stopListening(null, 'event');
    a.stopListening();
    b.trigger('event2');
  });

  QUnit.test('listenToOnce', function (assert) {
    assert.expect(2);
    // Same as the previous test, but we use once rather than having to explicitly unbind
    const foo = new FooWith2Counters();
    const incrA = function () {
      foo.counterA += 1;
      foo.trigger('event');
    };
    const incrB = function () {
      foo.counterB += 1;
    };
    foo.listenToOnce(foo, 'event', incrA);
    foo.listenToOnce(foo, 'event', incrB);
    foo.trigger('event');
    assert.equal(foo.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(foo.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('listenToOnce and stopListening', function (assert) {
    assert.expect(1);
    const a = new Foo();
    const b = new Foo();
    a.listenToOnce(b, 'all', () => assert.ok(true));
    b.trigger('anything');
    b.trigger('anything');
    a.listenToOnce(b, 'all', () => assert.ok(false));
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo, listenToOnce and stopListening', function (assert) {
    assert.expect(1);
    const a = new Foo();
    const b = new Foo();
    a.listenToOnce(b, 'all', () => assert.ok(true));
    b.trigger('anything');
    b.trigger('anything');
    a.listenTo(b, 'all', () => assert.ok(false));
    a.stopListening();
    b.trigger('anything');
  });

  QUnit.test('listenTo and stopListening with event maps', function (assert) {
    assert.expect(1);
    const a = new Foo();
    const b = new Foo();
    a.listenTo(b, {
      change: function () {
        assert.ok(true);
      },
    });
    b.trigger('change');
    a.listenTo(b, {
      change: function () {
        assert.ok(false);
      },
    });
    a.stopListening();
    b.trigger('change');
  });

  QUnit.test('listenTo yourself', function (assert) {
    assert.expect(1);
    const e = new Foo();
    e.listenTo(e, 'e', function () {
      assert.ok(true);
    });
    e.trigger('e');
  });

  QUnit.test('listenTo yourself cleans yourself up with stopListening', function (assert) {
    assert.expect(1);
    const e = new Foo();
    e.listenTo(e, 'foo', function () {
      assert.ok(true);
    });
    e.trigger('foo');
    e.stopListening();
    e.trigger('foo');
  });

  QUnit.test('stopListening cleans up references', function (assert) {
    assert.expect(12);
    const a = new Foo();
    const b = new Foo();
    const fn = function () {};
    b.on('event', fn);
    a.listenTo(b, 'event', fn).stopListening();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b, 'event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn).stopListening(b, 'event', fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('stopListening cleans up references from listenToOnce', function (assert) {
    assert.expect(12);
    const a = new Foo();
    const b = new Foo();
    const fn = function () {};
    b.on('event', fn);
    a.listenToOnce(b, 'event', fn).stopListening();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b, 'event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
    a.listenToOnce(b, 'event', fn).stopListening(b, 'event', fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._events.event), 1);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('listenTo and off cleaning up references', function (assert) {
    assert.expect(8);
    const a = new Foo();
    const b = new Foo();
    const fn = function () {};
    a.listenTo(b, 'event', fn);
    b.off();
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off('event');
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off(null, fn);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
    a.listenTo(b, 'event', fn);
    b.off(null, null, a);
    assert.equal(_.size(a._listeningTo), 0);
    assert.equal(_.size(b._listeners), 0);
  });

  QUnit.test('listenTo and stopListening cleaning up references', function (assert) {
    assert.expect(2);
    const a = new Foo();
    const b = new Foo();
    a.listenTo(b, 'all', function () {
      assert.ok(true);
    });
    b.trigger('anything');
    a.listenTo(b, 'other', function () {
      assert.ok(false);
    });
    a.stopListening(b, 'other');
    a.stopListening(b, 'all');
    assert.equal(_.size(a._listeningTo), 0);
  });

  QUnit.test('listenToOnce without context cleans up references after the event has fired', function (assert) {
    assert.expect(2);
    const a = new Foo();
    const b = new Foo();
    a.listenToOnce(b, 'all', function () {
      assert.ok(true);
    });
    b.trigger('anything');
    assert.equal(_.size(a._listeningTo), 0);
  });

  QUnit.test('listenToOnce with event maps cleans up references', function (assert) {
    assert.expect(2);
    const a = new Foo();
    const b = new Foo();
    a.listenToOnce(b, {
      one: () => assert.ok(true),
      two: () => assert.ok(false),
    });
    b.trigger('one');
    assert.equal(_.size(a._listeningTo), 1);
  });

  QUnit.test('listenToOnce with event maps binds the correct `this`', function (assert) {
    assert.expect(1);
    const a = new Foo();
    const b = new Foo();
    a.listenToOnce(b, {
      one: function () { assert.ok(this === a) },
      two: function () { assert.ok(false) },
    });
    b.trigger('one');
  });

  QUnit.test("listenTo with empty callback doesn't throw an error", function (assert) {
    assert.expect(1);
    const e = new Foo();
    e.listenTo(e, 'foo', null);
    e.trigger('foo');
    assert.ok(true);
  });

  QUnit.test('trigger all for each event', function (assert) {
    assert.expect(3);
    let a, b;
    const obj = new Foo();
    obj
      .on('all', function (event) {
        obj.counter++;
        if (event === 'a') a = true;
        if (event === 'b') b = true;
      })
      .trigger('a b');
    assert.ok(a);
    assert.ok(b);
    assert.equal(obj.counter, 2);
  });

  QUnit.test('on, then unbind all functions', function (assert) {
    assert.expect(1);
    const obj = new Foo();
    const callback = function () {
      obj.counter += 1;
    };
    obj.on('event', callback);
    obj.trigger('event');
    obj.off('event');
    obj.trigger('event');
    assert.equal(obj.counter, 1, 'counter should have only been incremented once.');
  });

  QUnit.test('bind two callbacks, unbind only one', function (assert) {
    assert.expect(2);
    const obj = new FooWith2Counters();
    const callback = function () {
      obj.counterA += 1;
    };
    obj.on('event', callback);
    obj.on('event', function () {
      obj.counterB += 1;
    });
    obj.trigger('event');
    obj.off('event', callback);
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 2, 'counterB should have been incremented twice.');
  });

  QUnit.test('unbind a callback in the midst of it firing', function (assert) {
    assert.expect(1);
    const obj = new Foo();
    const callback = function () {
      obj.counter += 1;
      obj.off('event', callback);
    };
    obj.on('event', callback);
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    assert.equal(obj.counter, 1, 'the callback should have been unbound.');
  });

  QUnit.test('two binds that unbind themeselves', function (assert) {
    assert.expect(2);
    const obj = new FooWith2Counters();
    const incrA = function () {
      obj.counterA += 1;
      obj.off('event', incrA);
    };
    const incrB = function () {
      obj.counterB += 1;
      obj.off('event', incrB);
    };
    obj.on('event', incrA);
    obj.on('event', incrB);
    obj.trigger('event');
    obj.trigger('event');
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('bind a callback with a default context when none supplied', function (assert) {
    assert.expect(1);

    // eslint-disable-next-line prefer-const
    let obj;

    class Foo extends Skeletor.EventEmitter(Object) {
      assertTrue() {
        assert.equal(this, obj, '`this` was bound to the callback');
      }
    }

    obj = new Foo();
    obj.once('event', obj.assertTrue);
    obj.trigger('event');
  });

  QUnit.test('bind a callback with a supplied context', function (assert) {
    assert.expect(1);
    const TestClass = function (): void {
      return this;
    };
    TestClass.prototype.assertTrue = function () {
      assert.ok(true, '`this` was bound to the callback');
    };

    const obj = new Foo();
    obj.on(
      'event',
      function () {
        this.assertTrue();
      },
      new TestClass()
    );
    obj.trigger('event');
  });

  QUnit.test('nested trigger with unbind', function (assert) {
    assert.expect(1);
    const obj = new Foo();
    const incr1 = function () {
      obj.counter += 1;
      obj.off('event', incr1);
      obj.trigger('event');
    };
    const incr2 = function () {
      obj.counter += 1;
    };
    obj.on('event', incr1);
    obj.on('event', incr2);
    obj.trigger('event');
    assert.equal(obj.counter, 3, 'counter should have been incremented three times');
  });

  QUnit.test('callback list is not altered during trigger', function (assert) {
    assert.expect(2);
    let counter = 0;
    const obj = new Foo();
    const incr = function () {
      counter++;
    };
    const incrOn = function () {
      obj.on('event all', incr);
    };
    const incrOff = function () {
      obj.off('event all', incr);
    };

    obj.on('event all', incrOn).trigger('event');
    assert.equal(counter, 0, 'on does not alter callback list');

    obj.off().on('event', incrOff).on('event all', incr).trigger('event');
    assert.equal(counter, 2, 'off does not alter callback list');
  });

  QUnit.test("#1282 - 'all' callback list is retrieved after each event.", function (assert) {
    assert.expect(1);
    var counter = 0;
    const obj = new Foo();
    const incr = function () {
      counter++;
    };
    obj
      .on('x', function () {
        obj.on('y', incr).on('all', incr);
      })
      .trigger('x y');
    assert.strictEqual(counter, 2);
  });

  QUnit.test(
    'if callback is truthy but not a function, `on` should throw an error just like jQuery',
    function (assert) {
      assert.expect(1);
      const view = new Foo().on('test', 'noop');
      assert.raises(function () {
        view.trigger('test');
      });
    }
  );

  QUnit.test('remove all events for a specific context', function (assert) {
    assert.expect(4);
    const obj = new Foo();
    obj.on('x y all', () => assert.ok(true));
    obj.on('x y all', () => assert.ok(false), obj);
    obj.off(null, null, obj);
    obj.trigger('x y');
  });

  QUnit.test('remove all events for a specific callback', function (assert) {
    assert.expect(4);
    const obj = new Foo();
    const success = () => assert.ok(true);
    const fail = () => assert.ok(false);
    obj.on('x y all', success);
    obj.on('x y all', fail);
    obj.off(null, fail);
    obj.trigger('x y');
  });

  QUnit.test('#1310 - off does not skip consecutive events', function (assert) {
    assert.expect(0);
    const obj = new Foo();
    obj.on('event', () => assert.ok(false), obj);
    obj.on('event', () => assert.ok(false), obj);
    obj.off(null, null, obj);
    obj.trigger('event');
  });

  QUnit.test('once', function (assert) {
    assert.expect(2);
    // Same as the previous test, but we use once rather than having to explicitly unbind
    const obj = new FooWith2Counters();
    const incrA = function () {
      obj.counterA += 1;
      obj.trigger('event');
    };
    const incrB = function () {
      obj.counterB += 1;
    };
    obj.once('event', incrA);
    obj.once('event', incrB);
    obj.trigger('event');
    assert.equal(obj.counterA, 1, 'counterA should have only been incremented once.');
    assert.equal(obj.counterB, 1, 'counterB should have only been incremented once.');
  });

  QUnit.test('once variant one', function (assert) {
    assert.expect(3);
    const f = function () {
      assert.ok(true);
    };
    const a = new Foo().once('event', f);
    const b = new Foo().on('event', f);
    a.trigger('event');
    b.trigger('event');
    b.trigger('event');
  });

  QUnit.test('once variant two', function (assert) {
    assert.expect(3);
    const f = function () {
      assert.ok(true);
    };
    const obj = new Foo();

    obj.once('event', f).on('event', f).trigger('event').trigger('event');
  });

  QUnit.test('once with off', function (assert) {
    assert.expect(0);
    const f = function () {
      assert.ok(true);
    };
    const obj = new Foo();

    obj.once('event', f);
    obj.off('event', f);
    obj.trigger('event');
  });

  QUnit.test('once with event maps', function (assert) {
    const obj = new Foo();

    const increment = function () {
      this.counter += 1;
    };

    obj.once(
      {
        a: increment,
        b: increment,
        c: increment,
      },
      obj
    );

    obj.trigger('a');
    assert.equal(obj.counter, 1);

    obj.trigger('a b');
    assert.equal(obj.counter, 2);

    obj.trigger('c');
    assert.equal(obj.counter, 3);

    obj.trigger('a b c');
    assert.equal(obj.counter, 3);
  });

  QUnit.test('bind a callback with a supplied context using once with object notation', function (assert) {
    assert.expect(1);
    const context = {};
    const obj = new Foo();

    obj
      .once(
        {
          a: function () {
            assert.strictEqual(this, context, 'defaults `context` to `callback` param');
          },
        },
        context
      )
      .trigger('a');
  });

  QUnit.test('once with off only by context', function (assert) {
    assert.expect(0);
    const context = {};
    const obj = new Foo();
    obj.once(
      'event',
      function () {
        assert.ok(false);
      },
      context
    );
    obj.off(null, null, context);
    obj.trigger('event');
  });

  QUnit.test('once with asynchronous events', function (assert) {
    const done = assert.async();
    assert.expect(1);
    const func = _.debounce(() => {
      assert.ok(true);
      done();
    }, 50);
    const obj = new Foo().once('async', func);

    obj.trigger('async');
    obj.trigger('async');
  });

  QUnit.test('once with multiple events.', function (assert) {
    assert.expect(2);
    const obj = new Foo();
    obj.once('x y', () => assert.ok(true));
    obj.trigger('x y');
  });

  QUnit.test('Off during iteration with once.', function (assert) {
    assert.expect(2);
    const obj = new Foo();
    const f = function () {
      this.off('event', f);
    };
    obj.on('event', f);
    obj.once('event', function () {});
    obj.on('event', function () {
      assert.ok(true);
    });

    obj.trigger('event');
    obj.trigger('event');
  });

  QUnit.test('listenToOnce without a callback is a noop', function (assert) {
    assert.expect(0);
    const obj = new Foo();
    obj.listenToOnce(obj, 'event').trigger('event');
  });

  QUnit.test('event functions are chainable', function (assert) {
    const obj = new Foo();
    const obj2 = new Foo();
    const fn = function () {};
    assert.equal(obj, obj.trigger('noeventssetyet'));
    assert.equal(obj, obj.off('noeventssetyet'));
    assert.equal(obj, obj.stopListening('noeventssetyet'));
    assert.equal(obj, obj.on('a', fn));
    assert.equal(obj, obj.once('c', fn));
    assert.equal(obj, obj.trigger('a'));
    assert.equal(obj, obj.listenTo(obj2, 'a', fn));
    assert.equal(obj, obj.listenToOnce(obj2, 'b', fn));
    assert.equal(obj, obj.off('a c'));
    assert.equal(obj, obj.stopListening(obj2, 'a'));
    assert.equal(obj, obj.stopListening());
  });

  QUnit.test('#3448 - listenToOnce with space-separated events', function (assert) {
    assert.expect(2);
    const one = new Foo();
    const two = new Foo();
    let count = 1;
    one.listenToOnce(two, 'x y', function (n) {
      assert.ok(n === count++);
    });
    two.trigger('x', 1);
    two.trigger('x', 1);
    two.trigger('y', 2);
    two.trigger('y', 2);
  });

  QUnit.test('#3611 - listenTo is compatible with non-Skeletor event libraries', function (assert) {
    const obj = new Foo();
    const other = {
      events: {},
      on: function (name, callback) {
        this.events[name] = callback;
      },
      trigger: function (name) {
        this.events[name]();
      },
    };

    obj.listenTo(other, 'test', () => assert.ok(true));
    other.trigger('test');
  });

  QUnit.test('#3611 - stopListening is compatible with non-Skeletor event libraries', function (assert) {
    const obj = new Foo();
    const other = {
      events: {},
      on: function (name, callback) {
        this.events[name] = callback;
      },
      off: function () {
        this.events = {};
      },
      trigger: function (name) {
        const fn = this.events[name];
        if (fn) fn();
      },
    };

    obj.listenTo(other, 'test', () => assert.ok(false));
    obj.stopListening(other);
    other.trigger('test');
    assert.equal(_.size(obj._listeningTo), 0);
  });
})();
