import { DatabaseSync, type StatementSync } from 'node:sqlite';
import fsMod from 'node:fs';
import pathMod from 'node:path';
import { normalizeKey, serializeSync, deserialize, sanitizePathSegment } from './helpers';
import { StorageDriver } from './types';

const DEFAULT_BASE_DIR = '.skeletor-storage';

/**
 * SQLite-backed implementation of StorageDriver.
 * Uses a single table with key/value columns, storing values as JSON strings.
 */
export class NodeSQLiteStorage implements StorageDriver {
  private db: DatabaseSync;
  private stmt: {
    insert: StatementSync;
    select: StatementSync;
    delete: StatementSync;
    clear: StatementSync;
    count: StatementSync;
    keyByIndex: StatementSync;
    keys: StatementSync;
    getItems: StatementSync;
  };

  ready(): Promise<void> {
    return Promise.resolve();
  }

  debouncedSetItems?: {
    (items: Record<string, any>): Promise<void>;
    flush?: () => void;
  };

  constructor(name: string, storageDir?: string, inMemory?: boolean) {
    if (inMemory) {
      this.db = new DatabaseSync(':memory:');
    } else {
      const safeName = sanitizePathSegment(name);
      const baseDir = storageDir || DEFAULT_BASE_DIR;
      const dbFilePath = pathMod.join(baseDir, `${safeName}.db`);

      // Ensure parent directory exists
      const dir = pathMod.dirname(dbFilePath);
      if (!fsMod.existsSync(dir)) {
        fsMod.mkdirSync(dir, { recursive: true });
      }

      this.db = new DatabaseSync(dbFilePath);
    }
    // Use DELETE journal mode (default, no separate WAL files)
    this.db.exec('PRAGMA journal_mode=DELETE');
    // Enable busy timeout
    this.db.exec('PRAGMA busy_timeout=5000');

    // Create the kv table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT
    `);

    // Prepare all statements once
    this.stmt = {
      insert: this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)'),
      select: this.db.prepare('SELECT value FROM kv WHERE key = ?'),
      delete: this.db.prepare('DELETE FROM kv WHERE key = ?'),
      clear: this.db.prepare('DELETE FROM kv'),
      count: this.db.prepare('SELECT COUNT(*) as count FROM kv'),
      keyByIndex: this.db.prepare('SELECT key FROM kv ORDER BY key LIMIT 1 OFFSET ?'),
      keys: this.db.prepare('SELECT key FROM kv ORDER BY key'),
      getItems: this.db.prepare('SELECT key, value FROM kv WHERE key IN (SELECT value FROM json_each(?))'),
    };
  }

  setItem(key: string, value: any): Promise<any> {
    key = normalizeKey(key);
    const coerced = value ?? null;
    this.stmt.insert.run(key, serializeSync(coerced));
    return Promise.resolve(value);
  }

  getItem<T>(key: string): Promise<T | null> {
    key = normalizeKey(key);
    const row = this.stmt.select.get(key) as { value: string } | undefined;
    if (!row) {
      return Promise.resolve(null);
    }
    return Promise.resolve(deserialize<T>(row.value));
  }

  removeItem(key: string): Promise<void> {
    key = normalizeKey(key);
    this.stmt.delete.run(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.stmt.clear.run();
    return Promise.resolve();
  }

  length(): Promise<number> {
    const row = this.stmt.count.get() as { count: number };
    return Promise.resolve(row.count);
  }

  key(n: number): Promise<string | null> {
    const row = this.stmt.keyByIndex.get(n) as { key: string } | undefined;
    return Promise.resolve(row ? row.key : null);
  }

  keys(): Promise<string[]> {
    const rows = this.stmt.keys.all() as Array<{ key: string }>;
    return Promise.resolve(rows.map((r) => r.key));
  }

  setItems(items: Record<string, any>): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, value] of Object.entries(items)) {
        const normalizedKey = normalizeKey(key);
        const coerced = value ?? null;
        this.stmt.insert.run(normalizedKey, serializeSync(coerced));
      }
      this.db.exec('COMMIT');
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        // If ROLLBACK fails, attach it as cause to the original error
        // This preserves the root cause while providing full context
        if (e instanceof Error && rollbackError instanceof Error) {
          (e as Error & { cause?: Error }).cause = rollbackError;
        }
      }
      throw e;
    }
    return Promise.resolve();
  }

  getItems(keys: string[]): Promise<Record<string, any>> {
    if (keys.length === 0) {
      return Promise.resolve({});
    }
    const keysJson = JSON.stringify(keys);
    const rows = this.stmt.getItems.all(keysJson) as Array<{ key: string; value: string }>;
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = deserialize(row.value);
    }
    return Promise.resolve(result);
  }

  /**
   * Close the database connection. Useful for cleanup in tests.
   */
  close(): void {
    this.db.close();
  }
}
