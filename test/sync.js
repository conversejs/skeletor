(function(QUnit) {

  const Library = Skeletor.Collection.extend({
    url: () => '/library'
  });
  let library;

  const attrs = {
    title: 'The Tempest',
    author: 'Bill Shakespeare',
    length: 123
  };

  QUnit.module('Skeletor.sync', {

    beforeEach: function(assert) {
      sinon.stub(window, 'fetch').callsFake(() => {});
      library = new Library();
      library.create(attrs, {wait: false});
    },

    afterEach: function(assert) {
      window.fetch.restore()
    }

  });

  QUnit.test('read', function(assert) {
    assert.expect(4);
    library.fetch();
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library');
    assert.equal(ajaxSettings.type, 'GET');
    assert.equal(ajaxSettings.dataType, 'json');
    assert.ok(_.isEmpty(ajaxSettings.data));
  });

  QUnit.test('passing data', function(assert) {
    assert.expect(3);
    library.fetch({data: {a: 'a', one: 1}});
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library');
    assert.equal(ajaxSettings.data.a, 'a');
    assert.equal(ajaxSettings.data.one, 1);
  });

  QUnit.test('create', function(assert) {
    assert.expect(6);
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library');
    assert.equal(ajaxSettings.type, 'POST');
    assert.equal(ajaxSettings.dataType, 'json');
    const data = JSON.parse(ajaxSettings.data);
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'Bill Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update', function(assert) {
    assert.expect(7);
    library.first().save({id: '1-the-tempest', author: 'William Shakespeare'});
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library/1-the-tempest');
    assert.equal(ajaxSettings.type, 'PUT');
    assert.equal(ajaxSettings.dataType, 'json');
    const data = JSON.parse(ajaxSettings.data);
    assert.equal(data.id, '1-the-tempest');
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'William Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('read model', function(assert) {
    assert.expect(3);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'});
    library.first().fetch();
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(ajaxSettings.type, 'GET');
    assert.ok(_.isEmpty(ajaxSettings.data));
  });

  QUnit.test('destroy', function(assert) {
    assert.expect(3);
    library.first().save({id: '2-the-tempest', author: 'Tim Shakespeare'});
    library.first().destroy({wait: true});
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/library/2-the-tempest');
    assert.equal(ajaxSettings.type, 'DELETE');
    assert.equal(ajaxSettings.data, null);
  });

  QUnit.test('urlError', function(assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    assert.raises(function() {
      model.fetch();
    });
    model.fetch({url: '/one/two'});
    const ajaxSettings = window.fetch.lastCall.args[0];
    assert.equal(ajaxSettings.url, '/one/two');
  });

  QUnit.test('#1052 - `options` is optional.', function(assert) {
    assert.expect(0);
    const model = new Skeletor.Model();
    model.url = '/test';
    Skeletor.sync('create', model);
  });

  QUnit.test('Call provided error callback on error.', function(assert) {
    assert.expect(1);
    const model = new Skeletor.Model();
    model.url = '/test';
    Skeletor.sync('read', model, {
      error: () => assert.ok(true)
    });
    window.fetch.lastCall.args[0].error();
  });

  QUnit.test('#2928 - Pass along `textStatus` and `errorThrown`.', function(assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    model.url = '/test';
    model.on('error', function(m, xhr, options) {
      assert.strictEqual(options.textStatus, 'textStatus');
      assert.strictEqual(options.errorThrown, 'errorThrown');
    });
    model.fetch();
    window.fetch.lastCall.args[0].error({}, 'textStatus', 'errorThrown');
  });

})(QUnit);
