import * as sinon from 'sinon';
import * as Skeletor from '../src/index';

(function (QUnit) {
  class Library extends Skeletor.Collection {
    get url() {
      return '/library';
    }
  }
  let library: Library;

  const attrs = {
    title: 'The Tempest',
    author: 'Bill Shakespeare',
    length: 123,
  };

  /** Make the stubbed `fetch` answer every request with a fresh Response built by `make`. */
  function respondWith(make: () => Response) {
    (window.fetch as sinon.SinonStub).callsFake(() => Promise.resolve(make()));
  }

  function lastRequest(): { url: string; init: RequestInit } {
    const call = (window.fetch as sinon.SinonStub).lastCall;
    return { url: call.args[0], init: call.args[1] };
  }

  QUnit.module('Skeletor.sync', {
    beforeEach() {
      sinon.stub(window, 'fetch').callsFake((_i: RequestInfo | URL) => Promise.resolve(new Response()));
      library = new Library();
      library.create(attrs, { wait: false });
    },

    afterEach() {
      (window.fetch as any).restore();
    },
  });

  QUnit.test('read', function (assert) {
    assert.expect(3);
    library.fetch();
    const { url, init } = lastRequest();
    assert.equal(url, '/library');
    assert.equal(init.method, 'GET');
    assert.strictEqual(init.body, undefined, 'a GET request carries no body');
  });

  QUnit.test('passing data', function (assert) {
    assert.expect(2);
    library.fetch({ data: { a: 'a', one: 1 } });
    const { url, init } = lastRequest();
    assert.equal(url, '/library?a=a&one=1', 'GET data is sent as query parameters');
    assert.strictEqual(init.body, undefined);
  });

  QUnit.test('create', function (assert) {
    assert.expect(5);
    const { url, init } = lastRequest();
    assert.equal(url, '/library');
    assert.equal(init.method, 'POST');
    const data = JSON.parse(init.body as string);
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'Bill Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('update', function (assert) {
    assert.expect(6);
    library.first().save({ id: '1-the-tempest', author: 'William Shakespeare' });
    const { url, init } = lastRequest();
    assert.equal(url, '/library/1-the-tempest');
    assert.equal(init.method, 'PUT');
    const data = JSON.parse(init.body as string);
    assert.equal(data.id, '1-the-tempest');
    assert.equal(data.title, 'The Tempest');
    assert.equal(data.author, 'William Shakespeare');
    assert.equal(data.length, 123);
  });

  QUnit.test('read model', function (assert) {
    assert.expect(3);
    library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
    library.first().fetch();
    const { url, init } = lastRequest();
    assert.equal(url, '/library/2-the-tempest');
    assert.equal(init.method, 'GET');
    assert.strictEqual(init.body, undefined, 'a GET request carries no body');
  });

  QUnit.test('destroy', function (assert) {
    assert.expect(3);
    library.first().save({ id: '2-the-tempest', author: 'Tim Shakespeare' });
    library.first().destroy({ wait: true });
    const { url, init } = lastRequest();
    assert.equal(url, '/library/2-the-tempest');
    assert.equal(init.method, 'DELETE');
    assert.strictEqual(init.body, undefined, 'a DELETE request carries no body');
  });

  QUnit.test('urlError', function (assert) {
    assert.expect(2);
    const model = new Skeletor.Model();
    assert.raises(function () {
      model.fetch();
    });
    model.fetch({ url: '/one/two' });
    assert.equal(lastRequest().url, '/one/two');
  });

  QUnit.test('#1052 - `options` is optional.', function (assert) {
    assert.expect(0);
    const model = new Skeletor.Model();
    model.url = '/test';
    Skeletor.sync('create', model);
  });

  QUnit.test('success receives the parsed JSON body and the promise resolves with it', async function (assert) {
    assert.expect(3);
    respondWith(() => new Response(JSON.stringify({ id: 7, title: 'Hamlet' }), { status: 200 }));
    const model = new Skeletor.Model();
    model.url = '/test';
    let received: any;
    const resolved = await Skeletor.sync('read', model, { success: (resp) => (received = resp) });
    assert.equal(lastRequest().url, '/test');
    assert.deepEqual(received, { id: 7, title: 'Hamlet' });
    assert.deepEqual(resolved, { id: 7, title: 'Hamlet' });
  });

  QUnit.test('an empty 2xx body resolves with null', async function (assert) {
    assert.expect(2);
    respondWith(() => new Response(null, { status: 204 }));
    const model = new Skeletor.Model();
    model.url = '/test';
    let received: any = 'unset';
    const resolved = await Skeletor.sync('delete', model, { success: (resp) => (received = resp) });
    assert.strictEqual(received, null);
    assert.strictEqual(resolved, null);
  });

  QUnit.test('a non-2xx response calls error with an HTTPError and rejects with it', async function (assert) {
    assert.expect(6);
    respondWith(() => new Response('nope', { status: 500, statusText: 'Server Error' }));
    const model = new Skeletor.Model();
    model.url = '/test';
    let successCalled = false;
    let errored: any;
    let rejected: any;
    try {
      await Skeletor.sync('read', model, { success: () => (successCalled = true), error: (e) => (errored = e) });
    } catch (e) {
      rejected = e;
    }
    assert.notOk(successCalled, 'success is not called');
    assert.ok(errored instanceof Skeletor.HTTPError);
    assert.strictEqual(rejected, errored, 'the promise rejects with the same error');
    assert.equal(errored.status, 500);
    assert.equal(errored.response.status, 500);
    assert.equal(errored.message, 'GET /test failed with HTTP 500 Server Error');
  });

  QUnit.test('a network failure calls error and rejects', async function (assert) {
    assert.expect(2);
    const failure = new TypeError('Failed to fetch');
    (window.fetch as sinon.SinonStub).callsFake(() => Promise.reject(failure));
    const model = new Skeletor.Model();
    model.url = '/test';
    let errored: any;
    let rejected: any;
    try {
      await Skeletor.sync('read', model, { error: (e) => (errored = e) });
    } catch (e) {
      rejected = e;
    }
    assert.strictEqual(errored, failure);
    assert.strictEqual(rejected, failure);
  });

  QUnit.test('Model fetch({ promise: true }) merges the JSON body and resolves with it', async function (assert) {
    assert.expect(2);
    respondWith(() => new Response(JSON.stringify({ id: 7, title: 'Hamlet' }), { status: 200 }));
    const model = new Skeletor.Model<any>({ id: 7 });
    model.url = '/test/7';
    const resp = await model.fetch({ promise: true });
    assert.equal(model.get('title'), 'Hamlet');
    assert.deepEqual(resp, { id: 7, title: 'Hamlet' });
  });

  QUnit.test(
    'Model save({ promise: true, wait: true }) rejects on a 500 and leaves the model untouched',
    async function (assert) {
      assert.expect(5);
      respondWith(() => new Response('', { status: 500 }));
      const model = new Skeletor.Model({ id: 7, title: 'Hamlet' });
      model.url = '/test/7';
      let syncCount = 0;
      let errorCount = 0;
      model.on('sync', () => syncCount++);
      model.on('error', () => errorCount++);
      let rejected: any;
      try {
        await model.save({ title: 'Lear' }, { promise: true, wait: true });
      } catch (e) {
        rejected = e;
      }
      assert.ok(rejected instanceof Skeletor.HTTPError);
      assert.equal(model.get('title'), 'Hamlet', 'wait: true attrs are not committed on failure');
      assert.deepEqual(
        Object.keys(model.attributes).sort(),
        ['id', 'title'],
        'no Response properties leak into the attributes',
      );
      assert.equal(syncCount, 0, "'sync' does not fire");
      assert.equal(errorCount, 1, "'error' fires once");
    },
  );
})(QUnit);
