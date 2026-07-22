import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSQLiteStorage } from '../src/drivers/nodeSQLiteStorage';
import PersistentStorage from '../src/storage';
import { Model } from '../src/model';
import type { StorageDriver } from '../src/drivers/types';
import { expect } from 'chai';

const TEST_DIR = path.join('.skeletor-test-storage');

describe('Node SQLite Storage', function () {
  const stores: NodeSQLiteStorage[] = [];
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(TEST_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    for (const s of stores) {
      try {
        s.close();
      } catch {
        /* ignore close errors */
      }
    }
    stores.length = 0;
    // SQLite may keep file handles open briefly after close(); retry deletion
    if (fs.existsSync(TEST_DIR)) {
      // eslint-disable-next-line no-await-in-loop
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.rmSync(TEST_DIR, { recursive: true, force: true });
          break;
        } catch {
          // Wait and retry - WAL files may still be locked
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }
  });

  function createStore(name: string, inMemory = true) {
    const s = new NodeSQLiteStorage(name, testDir, inMemory);
    stores.push(s);
    return s;
  }

  describe('Basic CRUD', function () {
    it('should set and get an item', async function () {
      const store = createStore('test-crud');
      await store.setItem('key1', 'value1');
      const result = await store.getItem('key1');
      expect(result).to.equal('value1');
    });

    it('should return null for non-existent key', async function () {
      const store = createStore('test-null');
      const result = await store.getItem('nonexistent');
      expect(result).to.be.null;
    });

    it('should remove an item', async function () {
      const store = createStore('test-remove');
      await store.setItem('key1', 'value1');
      await store.removeItem('key1');
      const result = await store.getItem('key1');
      expect(result).to.be.null;
    });
  });

  describe('setItems', function () {
    it('should write multiple items in one call', async function () {
      const store = createStore('test-setitems');
      await store.setItems({ a: 1, b: 2, c: 3 });

      expect(await store.getItem('a')).to.equal(1);
      expect(await store.getItem('b')).to.equal(2);
      expect(await store.getItem('c')).to.equal(3);
    });

    it('should overwrite existing keys', async function () {
      const store = createStore('test-setitems-overwrite');
      await store.setItem('a', 'old');
      await store.setItems({ a: 'new', b: 'also-new' });

      expect(await store.getItem('a')).to.equal('new');
      expect(await store.getItem('b')).to.equal('also-new');
    });

    it('should round-trip objects', async function () {
      const store = createStore('test-setitems-objects');
      const obj = { x: 1, y: [1, 2, 3] };
      await store.setItems({ obj });

      expect(await store.getItem('obj')).to.deep.equal(obj);
    });

    it('should resolve with the items that were written', async function () {
      const store = createStore('test-setitems-resolves');
      const items = { a: 1, b: { nested: true } };

      expect(await store.setItems(items)).to.deep.equal(items);
    });

    it('should be atomic - partial failure rolls back all writes', async function () {
      const store = createStore('test-setitems-atomic');
      await store.setItem('existing', 'data');

      const circular: any = {};
      circular.self = circular;

      try {
        await store.setItems({ good: 'value', bad: circular });
        expect.fail('should have thrown');
      } catch (e) {
        const result = await store.getItem('good');
        expect(result).to.be.null;
        expect(await store.getItem('existing')).to.equal('data');
      }
    });
  });

  describe('getItems', function () {
    it('should retrieve multiple items by keys', async function () {
      const store = createStore('test-getitems');
      await store.setItem('a', 1);
      await store.setItem('b', 2);
      await store.setItem('c', 3);

      const result = await store.getItems(['a', 'c']);
      expect(result).to.deep.equal({ a: 1, c: 3 });
    });

    it('should return empty object for no keys', async function () {
      const store = createStore('test-getitems-empty');
      const result = await store.getItems([]);
      expect(result).to.deep.equal({});
    });

    it('should skip missing keys', async function () {
      const store = createStore('test-getitems-missing');
      await store.setItem('a', 1);

      const result = await store.getItems(['a', 'missing']);
      expect(result).to.deep.equal({ a: 1 });
    });
  });

  describe('Keys & length', function () {
    it('should return all keys', async function () {
      const store = createStore('test-keys');
      await store.setItem('a', 1);
      await store.setItem('b', 2);
      await store.setItem('c', 3);

      const keys = await store.keys();
      expect(keys).to.have.length(3);
      expect(keys).to.include('a');
      expect(keys).to.include('b');
      expect(keys).to.include('c');
    });

    it('should return correct length', async function () {
      const store = createStore('test-length');
      await store.setItem('a', 1);
      await store.setItem('b', 2);

      const length = await store.length();
      expect(length).to.equal(2);
    });

    it('should return key by index', async function () {
      const store = createStore('test-key-index');
      await store.setItem('first', 1);
      await store.setItem('second', 2);

      const keys = await store.keys();
      const key0 = await store.key(0);
      expect(key0).to.equal(keys[0]);
    });
  });

  describe('Clear', function () {
    it('should clear all items', async function () {
      const store = createStore('test-clear');
      await store.setItem('a', 1);
      await store.setItem('b', 2);
      await store.clear();

      const length = await store.length();
      expect(length).to.equal(0);
    });
  });

  describe('Iterate', function () {
    it('should iterate over all items', async function () {
      const store = createStore('test-iterate');
      await store.setItem('x', 10);
      await store.setItem('y', 20);
      await store.setItem('z', 30);

      const results: Array<{ key: string; value: number }> = [];
      const keys = await store.keys();
      for (const key of keys) {
        // eslint-disable-next-line no-await-in-loop
        const value = await store.getItem<number>(key);
        results.push({ key, value: value! });
      }

      expect(results).to.have.length(3);
      expect(results.map((r) => r.key)).to.include('x');
      expect(results.map((r) => r.key)).to.include('y');
      expect(results.map((r) => r.key)).to.include('z');
    });
  });

  describe('Serialization', function () {
    it('should round-trip objects', async function () {
      const store = createStore('test-serialize');
      const obj = { name: 'test', nested: { value: 42 }, arr: [1, 2, 3] };
      await store.setItem('obj', obj);
      const result = await store.getItem('obj');
      expect(result).to.deep.equal(obj);
    });

    it('should round-trip arrays', async function () {
      const store = createStore('test-array');
      const arr = [1, 'two', { three: 3 }];
      await store.setItem('arr', arr);
      const result = await store.getItem('arr');
      expect(result).to.deep.equal(arr);
    });

    it('should round-trip dates as ISO strings', async function () {
      const store = createStore('test-date');
      const date = new Date('2024-01-01T00:00:00.000Z');
      await store.setItem('date', date);
      const result = await store.getItem('date');
      expect(result).to.equal('2024-01-01T00:00:00.000Z');
    });

    it('should handle null values', async function () {
      const store = createStore('test-null-value');
      await store.setItem('k', null);
      const result = await store.getItem('k');
      expect(result).to.be.null;
    });

    it('should handle undefined values as null', async function () {
      const store = createStore('test-undefined');
      await store.setItem('k', undefined);
      const result = await store.getItem('k');
      expect(result).to.be.null;
    });
  });

  describe('Multiple instances', function () {
    it('should not interfere with each other', async function () {
      const store1 = createStore('instance1');
      const store2 = createStore('instance2');

      await store1.setItem('key', 'value1');
      await store2.setItem('key', 'value2');

      const result1 = await store1.getItem('key');
      const result2 = await store2.getItem('key');

      expect(result1).to.equal('value1');
      expect(result2).to.equal('value2');
    });
  });

  describe('Special characters in keys', function () {
    it('should handle keys with slashes', async function () {
      const store = createStore('test-special');
      await store.setItem('path/to/resource', 'value');
      const result = await store.getItem('path/to/resource');
      expect(result).to.equal('value');
    });

    it('should handle keys with spaces', async function () {
      const store = createStore('test-spaces');
      await store.setItem('key with spaces', 'value');
      const result = await store.getItem('key with spaces');
      expect(result).to.equal('value');
    });
  });

  describe('Path traversal prevention', function () {
    it('should not create files outside the base directory for a traversal name', async function () {
      const store = createStore('../../outside', false);
      await store.setItem('k', 'v');
      const escaped = path.resolve(TEST_DIR, '../../outside');
      expect(fs.existsSync(escaped)).to.be.false;
      // Sanitized file should exist inside the expected directory
      const sanitizedFile = path.join(testDir, '.._.._outside.db');
      expect(fs.existsSync(sanitizedFile)).to.be.true;
    });

    it('should sanitize a name with null bytes', async function () {
      const store = createStore('store\x00name', false);
      await store.setItem('k', 'v');
      const result = await store.getItem('k');
      expect(result).to.equal('v');
      // Sanitized file should exist inside the expected directory
      const sanitizedFile = path.join(testDir, 'storename.db');
      expect(fs.existsSync(sanitizedFile)).to.be.true;
    });
  });

  describe('Filesystem persistence', function () {
    it('should create actual .db file on disk when inMemory=false', async function () {
      const storeName = 'test-disk-store';
      const store = createStore(storeName, false);
      await store.setItem('foo', 'bar');

      // Verify file exists with sanitized name
      const expectedFile = path.join(testDir, `${storeName}.db`);
      expect(fs.existsSync(expectedFile)).to.be.true;

      // Verify we can read back data
      const value = await store.getItem('foo');
      expect(value).to.equal('bar');
    });

    it('should create parent directories if they do not exist', async function () {
      const nestedDir = path.join(testDir, 'nested', 'subdir');
      const store = new NodeSQLiteStorage('nested-store', nestedDir, false);
      stores.push(store);

      await store.setItem('test', 'data');

      const expectedFile = path.join(nestedDir, 'nested-store.db');
      expect(fs.existsSync(expectedFile)).to.be.true;
    });

    it('should persist data across separate instances pointing to same file', async function () {
      const storeName = 'persistence-test';
      const store1 = new NodeSQLiteStorage(storeName, testDir, false);
      stores.push(store1);

      await store1.setItem('persistent', 'data123');
      await store1.setItem('another', 'value');
      store1.close();

      // Create a new instance pointing to same file
      const store2 = new NodeSQLiteStorage(storeName, testDir, false);
      stores.push(store2);

      expect(await store2.getItem('persistent')).to.equal('data123');
      expect(await store2.getItem('another')).to.equal('value');
    });

    it('should sanitize store names to safe filenames', async function () {
      const unsafeName = 'my/store\\name.db';
      const store = new NodeSQLiteStorage(unsafeName, testDir, false);
      stores.push(store);

      await store.setItem('key', 'value');

      // Should create my_store_name.db.db (sanitized + .db extension)
      const expectedFile = path.join(testDir, 'my_store_name.db.db');
      expect(fs.existsSync(expectedFile)).to.be.true;

      // Verify data stored and retrievable
      const value = await store.getItem('key');
      expect(value).to.equal('value');
    });

    it('should handle multiple stores in same directory', async function () {
      const storeA = new NodeSQLiteStorage('store-a', testDir, false);
      const storeB = new NodeSQLiteStorage('store-b', testDir, false);
      stores.push(storeA, storeB);

      await storeA.setItem('key', 'value-a');
      await storeB.setItem('key', 'value-b');

      expect(await storeA.getItem('key')).to.equal('value-a');
      expect(await storeB.getItem('key')).to.equal('value-b');

      // Verify separate files exist
      expect(fs.existsSync(path.join(testDir, 'store-a.db'))).to.be.true;
      expect(fs.existsSync(path.join(testDir, 'store-b.db'))).to.be.true;
    });
  });

  describe('Error handling', function () {
    it('should preserve original error when transaction fails', async function () {
      const store = createStore('error-handling-test');
      await store.setItem('valid', 'data');

      const circular: any = {};
      circular.self = circular;

      // This will fail in serializeSync with circular reference
      // The transaction should roll back, preserving original data
      try {
        await store.setItems({ good: 'value', bad: circular });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        // The error should be about circular reference
        expect((e as Error).message).to.match(/circular|cyclic|stringify/i);
      }

      // Original data should still exist (transaction rolled back)
      const value = await store.getItem('valid');
      expect(value).to.equal('data');
    });
  });

  describe('Concurrency', function () {
    it('should handle concurrent writes to the same key', async function () {
      const store = createStore('test-concurrent');

      // Three concurrent writes - with SQLite busy_timeout, they serialize
      // Execution order is non-deterministic but one should succeed
      await Promise.all([store.setItem('key', 'first'), store.setItem('key', 'second'), store.setItem('key', 'third')]);

      const final = await store.getItem('key');
      // Verify a write succeeded (data integrity maintained during concurrency)
      expect(final).to.be.oneOf(['first', 'second', 'third']);
    });

    it('should handle concurrent reads and writes without errors', async function () {
      const store = createStore('test-concurrent-rw');
      await store.setItem('key', 'initial');

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(store.setItem('key', `value-${i}`));
        promises.push(store.getItem('key'));
      }

      await Promise.all(promises);

      const final = await store.getItem<string>('key');
      expect(final).to.be.a('string');
      // After concurrent writes, final value should be one of the written values
      expect(final).to.match(/^value-\d+$/);
      const num = parseInt(final.split('-')[1], 10);
      expect(num).to.be.at.least(0).and.at.most(9);
    });
  });

  describe('Model persistence', function () {
    it('saves and fetches a model through the SQLite driver', async function () {
      const store = createStore('test-model-roundtrip');

      class SQLiteModel extends Model {
        initialize() {
          this.storage = new PersistentStorage('roundtrip', store);
        }
      }

      const model = new SQLiteModel({ id: 'm-1' });

      let syncError: Error | undefined;
      model.on('error', (_m: Model, e: Error) => (syncError = e));
      await model.save({ name: 'Bob' }, { promise: true });
      expect(syncError, `save errored: ${syncError?.message}`).to.be.undefined;

      expect(await store.getItem('roundtrip-m-1')).to.deep.equal({ id: 'm-1', name: 'Bob' });

      const fetched = new SQLiteModel({ id: 'm-1' });
      await fetched.fetch({ promise: true });
      expect(fetched.get('name')).to.equal('Bob');
    });

    it('treats a write as successful when the driver resolves nothing', async function () {
      // Drivers aren't obliged to resolve a write with anything. Success is the
      // absence of a thrown error, so an empty resolve must not be reported as
      // 'Record Not Found'.
      const store: Record<string, any> = {};
      const driver: StorageDriver = {
        ready: () => Promise.resolve(),
        getItem: (k: string) => Promise.resolve(k in store ? store[k] : null),
        getItems: (keys: string[]) => {
          const out: Record<string, any> = {};
          keys.forEach((k) => {
            if (k in store) out[k] = store[k];
          });
          return Promise.resolve(out);
        },
        setItem: (k: string, v: any) => {
          store[k] = v;
          return Promise.resolve(v);
        },
        setItems: (items: Record<string, any>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        removeItem: (k: string) => {
          delete store[k];
          return Promise.resolve();
        },
        clear: () => Promise.resolve(),
        keys: () => Promise.resolve(Object.keys(store)),
        key: (n: number) => Promise.resolve(Object.keys(store)[n] ?? null),
        length: () => Promise.resolve(Object.keys(store).length),
      };

      class VoidWriteModel extends Model {
        initialize() {
          this.storage = new PersistentStorage('voidwrite', driver);
        }
      }

      const model = new VoidWriteModel({ id: 'v-1' });
      let syncError: Error | undefined;
      model.on('error', (_m: Model, e: Error) => (syncError = e));
      await model.save({ name: 'Bob' }, { promise: true });
      expect(syncError, `save errored: ${syncError?.message}`).to.be.undefined;

      expect(store['voidwrite-v-1']).to.deep.equal({ id: 'v-1', name: 'Bob' });
    });
  });

  describe("'node' store type", function () {
    beforeEach(() => {
      // What `@converse/skeletor/node` does on import. The test imports
      // `src/storage` directly, so the driver isn't registered for us.
      PersistentStorage.nodeStorage = NodeSQLiteStorage;
    });

    afterEach(() => {
      PersistentStorage.nodeStorage = null;
      PersistentStorage.nodeStorageDir = null;
    });

    it('writes to `nodeStorageDir` instead of the cwd-relative default', async function () {
      PersistentStorage.nodeStorageDir = testDir;

      const storage = new PersistentStorage('bydir', 'node');
      await storage.storeInitialized;
      stores.push(storage.store as NodeSQLiteStorage);

      await storage.store.setItem('bydir-1', { id: '1' });

      expect(fs.existsSync(path.join(testDir, 'bydir.db'))).to.be.true;
      expect(fs.existsSync(path.join('.skeletor-storage', 'bydir.db'))).to.be.false;
    });

    it('persists a model through the store type into that directory', async function () {
      PersistentStorage.nodeStorageDir = testDir;

      class DirModel extends Model {
        initialize() {
          this.storage = new PersistentStorage('bytype', 'node');
        }
      }

      const model = new DirModel({ id: 'd-1' });
      let syncError: Error | undefined;
      model.on('error', (_m: Model, e: Error) => (syncError = e));
      await model.save({ name: 'Bob' }, { promise: true });
      expect(syncError, `save errored: ${syncError?.message}`).to.be.undefined;
      stores.push((model.storage as PersistentStorage).store as NodeSQLiteStorage);

      const fetched = new DirModel({ id: 'd-1' });
      await fetched.fetch({ promise: true });
      expect(fetched.get('name')).to.equal('Bob');
      stores.push((fetched.storage as PersistentStorage).store as NodeSQLiteStorage);

      expect(fs.existsSync(path.join(testDir, 'bytype.db'))).to.be.true;
    });
  });
});
