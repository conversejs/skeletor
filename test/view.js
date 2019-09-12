(function(QUnit) {

  let view;

  QUnit.module('Skeletor.View', {

    beforeEach: function() {
      document.querySelector('#qunit-fixture').insertAdjacentHTML(
        'beforeEnd',
        '<div id="testElement"><h1>Test</h1></div>'
     );

      view = new Skeletor.View({
        id: 'test-view',
        className: 'test-view',
        other: 'non-special-option'
      });
    },

    afterEach: function() {
      const el = document.querySelector('#testElement');
      el.parentElement.removeChild(el);
      const view_el = document.querySelector('#test-view');
      view_el && view_el.parentElement.removeChild(view_el);
    }

  });

  QUnit.test('constructor', function(assert) {
    assert.expect(3);
    assert.equal(view.el.id, 'test-view');
    assert.equal(view.el.className, 'test-view');
    assert.equal(view.el.other, undefined);
  });

  QUnit.test('$', function(assert) {
    assert.expect(2);
    var myView = new Skeletor.View();
    myView.setElement('<p><a><b>test</b></a></p>');
    var result = myView.$('a b');

    assert.strictEqual(result[0].innerHTML, 'test');
    assert.ok(result.length === +result.length);
  });

  QUnit.test('initialize', function(assert) {
    assert.expect(1);
    var View = Skeletor.View.extend({
      initialize: function() {
        this.one = 1;
      }
    });

    assert.strictEqual(new View().one, 1);
  });

  QUnit.test('preinitialize', function(assert) {
    assert.expect(1);
    var View = Skeletor.View.extend({
      preinitialize: function() {
        this.one = 1;
      }
    });

    assert.strictEqual(new View().one, 1);
  });

  QUnit.test('preinitialize occurs before the view is set up', function(assert) {
    assert.expect(2);
    var View = Skeletor.View.extend({
      preinitialize: function() {
        assert.equal(this.el, undefined);
      }
    });
    var _view = new View({});
    assert.notEqual(_view.el, undefined);
  });

  QUnit.test('render', function(assert) {
    assert.expect(1);
    var myView = new Skeletor.View();
    assert.equal(myView.render(), myView, '#render returns the view instance');
  });

  QUnit.test('delegateEvents', function(assert) {
    assert.expect(6);
    let counter1 = 0, counter2 = 0;

    const myView = new Skeletor.View({el: '#testElement'});
    myView.increment = () => counter1++;
    myView.el.addEventListener('click', () => counter2++);

    const events = {'click h1': 'increment'};

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(counter1, 1);
    assert.equal(counter2, 1);

    myView.el.querySelector('h1').click();
    assert.equal(counter1, 2);
    assert.equal(counter2, 2);

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(counter1, 3);
    assert.equal(counter2, 3);
  });

  QUnit.test('delegate', function(assert) {
    assert.expect(3);
    const myView = new Skeletor.View({el: '#testElement'});
    myView.delegate('click', 'h1', () => assert.ok(true));
    myView.delegate('click', () => assert.ok(true));
    myView.el.querySelector('h1').click();
    assert.equal(myView.delegate(), myView, '#delegate returns the view instance');
  });

  QUnit.test('delegateEvents allows functions for callbacks', function(assert) {
    assert.expect(3);
    const myView = new Skeletor.View({el: '#testElement'});
    myView.counter = 0;
    const events = {
      click: () => myView.counter++
    };

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(myView.counter, 1);

    myView.el.querySelector('h1').click();
    assert.equal(myView.counter, 2);

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(myView.counter, 3);
  });

  QUnit.test('delegateEvents ignore undefined methods', function(assert) {
    assert.expect(0);
    var myView = new Skeletor.View({el: '<p></p>'});
    myView.delegateEvents({click: 'undefinedMethod'});
    myView.el.click();
  });

  QUnit.test('undelegateEvents', function(assert) {
    assert.expect(7);
    let counter1 = 0, counter2 = 0;

    const myView = new Skeletor.View({el: '#testElement'});
    myView.increment = function() { counter1++; };
    myView.el.addEventListener('click', () => counter2++);

    const events = {'click h1': 'increment'};

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(counter1, 1);
    assert.equal(counter2, 1);

    myView.undelegateEvents();
    myView.el.querySelector('h1').click();
    assert.equal(counter1, 1);
    assert.equal(counter2, 2);

    myView.delegateEvents(events);
    myView.el.querySelector('h1').click();
    assert.equal(counter1, 2);
    assert.equal(counter2, 3);

    assert.equal(myView.undelegateEvents(), myView, '#undelegateEvents returns the view instance');
  });

  QUnit.test('undelegate', function(assert) {
    assert.expect(1);
    var myView = new Skeletor.View({el: '#testElement'});
    myView.delegate('click', function() { assert.ok(false); });
    myView.delegate('click', 'h1', function() { assert.ok(false); });
    myView.undelegate('click');
    myView.el.querySelector('h1').click();
    myView.el.click();
    assert.equal(myView.undelegate(), myView, '#undelegate returns the view instance');
  });

  QUnit.test('undelegate with passed handler', function(assert) {
    assert.expect(1);
    const myView = new Skeletor.View({el: '#testElement'});
    const listener = () => assert.ok(false);
    myView.delegate('click', listener);
    myView.delegate('click', function() { assert.ok(true); });
    myView.undelegate('click', listener);
    myView.el.click();
  });

  QUnit.test('undelegate with selector', function(assert) {
    assert.expect(2);
    const myView = new Skeletor.View({el: '#testElement'});
    myView.delegate('click', () => assert.ok(true));
    myView.delegate('click', 'h1', () => assert.ok(false));
    myView.undelegate('click', 'h1');
    myView.el.querySelector('h1').click();
    myView.el.click();
  });

  QUnit.test('undelegate with handler and selector', function(assert) {
    assert.expect(2);
    const myView = new Skeletor.View({el: '#testElement'});
    myView.delegate('click', () => assert.ok(true));
    const handler = () => assert.ok(false);
    myView.delegate('click', 'h1', handler);
    myView.undelegate('click', 'h1', handler);
    myView.el.querySelector('h1').click();
    myView.el.click();
  });

  QUnit.test('tagName can be provided as a string', function(assert) {
    assert.expect(1);
    var View = Skeletor.View.extend({
      tagName: 'span'
    });

    assert.equal(new View().el.tagName, 'SPAN');
  });

  QUnit.test('tagName can be provided as a function', function(assert) {
    assert.expect(1);
    const View = Skeletor.View.extend({
      tagName: () => 'p'
    });
    assert.ok(new View().el.matches('p'));
  });

  QUnit.test('_ensureElement with DOM node el', function(assert) {
    assert.expect(1);
    var View = Skeletor.View.extend({
      el: document.body
    });

    assert.equal(new View().el, document.body);
  });

  QUnit.test('_ensureElement with string el', function(assert) {
    assert.expect(3);
    var View = Skeletor.View.extend({
      el: 'body'
    });
    assert.strictEqual(new View().el, document.body);

    View = Skeletor.View.extend({
      el: '#testElement > h1'
    });
    assert.strictEqual(new View().el, document.querySelector('#testElement > h1'));

    View = Skeletor.View.extend({
      el: '#nonexistent'
    });
    assert.ok(!new View().el);
  });

  QUnit.test('with className and id functions', function(assert) {
    assert.expect(2);
    var View = Skeletor.View.extend({
      className: function() {
        return 'className';
      },
      id: function() {
        return 'id';
      }
    });

    assert.strictEqual(new View().el.className, 'className');
    assert.strictEqual(new View().el.id, 'id');
  });

  QUnit.test('with attributes', function(assert) {
    assert.expect(2);
    var View = Skeletor.View.extend({
      attributes: {
        'id': 'id',
        'class': 'class'
      }
    });

    assert.strictEqual(new View().el.className, 'class');
    assert.strictEqual(new View().el.id, 'id');
  });

  QUnit.test('with attributes as a function', function(assert) {
    assert.expect(1);
    var View = Skeletor.View.extend({
      attributes: function() {
        return {'class': 'dynamic'};
      }
    });

    assert.strictEqual(new View().el.className, 'dynamic');
  });

  QUnit.test('should default to className/id properties', function(assert) {
    assert.expect(4);
    const View = Skeletor.View.extend({
      className: 'backboneClass',
      id: 'backboneId',
      attributes: {
        'class': 'attributeClass',
        'id': 'attributeId'
      }
    });
    const myView = new View();
    assert.strictEqual(myView.el.className, 'backboneClass');
    assert.strictEqual(myView.el.id, 'backboneId');
    assert.strictEqual(myView.el.getAttribute('class'), 'backboneClass');
    assert.strictEqual(myView.el.getAttribute('id'), 'backboneId');
  });

  QUnit.test('multiple views per element', function(assert) {
    assert.expect(3);
    let count = 0;
    const el = document.createElement('p');

    const View = Skeletor.View.extend({
      el: el,
      events: {
        click: function() {
          count++;
        }
      }
    });

    const view1 = new View();
    el.click();
    assert.equal(1, count);

    const view2 = new View();
    el.click();
    assert.equal(3, count);

    view1.delegateEvents();
    el.click();
    assert.equal(5, count);
  });

  QUnit.test('custom events', function(assert) {
    assert.expect(2);
    const View = Skeletor.View.extend({
      el: document.querySelector('body'),
      events: {
        'fake$event': () => assert.ok(true)
      }
    });
    const myView = new View();
    const event = new Event('fake$event')
    const body = document.querySelector('body');
    body.dispatchEvent(event);
    body.dispatchEvent(event);
    myView.undelegateEvents();
    body.dispatchEvent(event);
  });

  QUnit.test('#1048 - setElement uses provided object.', function(assert) {
    assert.expect(2);
    let el = document.querySelector('body');
    const myView = new Skeletor.View({el: el});
    assert.ok(myView.el === el);
    const new_el = document.createElement('div');
    myView.setElement(el = new_el);
    assert.ok(myView.el === new_el);
  });

  QUnit.test('#986 - Undelegate before changing element.', function(assert) {
    assert.expect(1);
    const button1 = document.createElement('button');
    const button2 = document.createElement('button');
    const View = Skeletor.View.extend({
      events: {
        click: function(e) {
          assert.ok(myView.el === e.target);
        }
      }
    });

    const myView = new View({el: button1});
    myView.setElement(button2);
    button1.click();
    button2.click();
  });

  QUnit.test('#1172 - Clone attributes object', function(assert) {
    assert.expect(2);
    var View = Skeletor.View.extend({
      attributes: {foo: 'bar'}
    });

    var view1 = new View({id: 'foo'});
    assert.strictEqual(view1.el.id, 'foo');

    var view2 = new View();
    assert.ok(!view2.el.id);
  });

  QUnit.test('views stopListening', function(assert) {
    assert.expect(0);
    var View = Skeletor.View.extend({
      initialize: function() {
        this.listenTo(this.model, 'all x', function() { assert.ok(false); });
        this.listenTo(this.collection, 'all x', function() { assert.ok(false); });
      }
    });

    var myView = new View({
      model: new Skeletor.Model(),
      collection: new Skeletor.Collection()
    });

    myView.stopListening();
    myView.model.trigger('x');
    myView.collection.trigger('x');
  });

  QUnit.test('Provide function for el.', function(assert) {
    assert.expect(2);
    const View = Skeletor.View.extend({
      el: () => '<p><a></a></p>'
    });
    const myView = new View();
    assert.ok(myView.el.matches('p'));
    assert.ok(myView.el.querySelectorAll('a').length);
  });

  QUnit.test('events passed in options', function(assert) {
    assert.expect(1);
    let counter = 0;

    const View = Skeletor.View.extend({
      el: '#testElement',
      increment: function() {
        counter++;
      }
    });

    const myView = new View({
      events: {
        'click h1': 'increment'
      }
    });

    myView.el.querySelector('h1').click();
    myView.el.querySelector('h1').click();
    assert.equal(counter, 2);
  });

  QUnit.test('remove', function(assert) {
    assert.expect(2);
    var myView = new Skeletor.View();
    document.body.appendChild(view.el);

    myView.delegate('click', function() { assert.ok(false); });
    myView.listenTo(myView, 'all x', function() { assert.ok(false); });

    assert.equal(myView.remove(), myView, '#remove returns the view instance');
    myView.el.click();
    myView.trigger('x');

    // In IE8 and below, parentNode still exists but is not document.body.
    assert.notEqual(myView.el.parentNode, document.body);
  });

  QUnit.test('setElement', function(assert) {
    assert.expect(2);
    const myView = new Skeletor.View({
      events: {
        click: () => assert.ok(false)
      }
    });
    myView.events = {
      click: () => assert.ok(true)
    };
    const oldEl = myView.el;
    myView.setElement(document.createElement('div'));
    oldEl.click();
    myView.el.click();
    assert.notEqual(oldEl, myView.el);
  });

})(QUnit);
