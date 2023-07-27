/* eslint-disable class-methods-use-this */
(function (QUnit) {
  class Library extends Skeletor.Collection {
    get url() {
      return '/library';
    }
  }
  let library;

  const attrs = {
    title: 'The Tempest',
    author: 'Bill Shakespeare',
    length: 123,
  };

  QUnit.module('Skeletor.sync', {
    beforeEach: function (assert) {
      sinon.stub(window, 'fetch').callsFake(() => {});
      library = new Library();
      library.create(attrs, { wait: false });
    },

    afterEach: function (assert) {
      window.fetch.restore();
    },
  });

  QUnit.test('read', function (assert) {
    assert.expect(3);
    library.fetch();
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library');
    assert.equal(ajaxSettings.method, 'GET');
    assert.ok(_.isEmpty(ajaxSettings.body));
  });

  QUnit.test('passing data', function (assert) {
    library.fetch({ data: { a: 'a', one: 1 } });
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library');
    console.log(ajaxSettings);
    const body = JSON.parse(ajaxSettings.body);
    assert.equal(body.a, 'a');
    assert.equal(body.one, 1);
  });

  QUnit.test('create', function (assert) {
    assert.expect(5);
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library');
    assert.equal(ajaxSettings.method, 'POST');
    const data = JSON.parse(ajaxSettings.body);
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'Bill Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update', function (assert) {
    assert.expect(6);
    library.first().save({ id: '1-the-tempest', author: 'William Shakespeare' });
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library/1-the-tempest');
    assert.equal(ajaxSettings.method, 'PUT');
    const data = JSON.parse(ajaxSettings.body);
    assert.equal(data.id, '1-the-tempest');
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'William Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('read model', function (assert) {
    assert.expect(3);
    library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
    library.first().fetch();
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library/2-the-tempest');
    assert.equal(ajaxSettings.method, 'GET');
    assert.ok(_.isEmpty(ajaxSettings.body));
  });

  QUnit.test('destroy', function (assert) {
    assert.expect(3);
    library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
    library.first().destroy({ wait: true });
    const url = window.fetch.lastCall.args[0];
    const ajaxSettings = window.fetch.lastCall.args[1];
    assert.equal(url, '/library/2-the-tempest');
    assert.equal(ajaxSettings.method, 'DELETE');
    assert.equal(ajaxSettings.body, '');
  });

  QUnit.test('urlError', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    assert.raises(function () {
      model.fetch();
    });
    model.fetch({ url: '/one/two' });
    const url = window.fetch.lastCall.args[0];
    assert.equal(url, '/one/two');
  });

  QUnit.test('#1052 - `options` is optional.', function (assert) {
    assert.expect(0);
    const model = new Skeletor.Model();
    model.url = '/test';
    Skeletor.sync('create', model);
  });

  QUnit.test('Call provided error callback on error.', function (assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.url = '/test';
    Skeletor.sync('read', model, {
      error: () => assert.ok(true),
    });
    window.fetch.lastCall.args[1].error();
  });
})(QUnit);
