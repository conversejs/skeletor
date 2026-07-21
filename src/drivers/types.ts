/**
 * Storage driver interface for key-value persistence.
 * @public
 */
export interface StorageDriver {
  ready(): Promise<void>;
  setItem(key: string, value: any): Promise<any>;
  getItem(key: string): Promise<any>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
  key(keyIndex: number): Promise<string | null>;
  keys(): Promise<string[]>;
  /**
   * Write several items in one go. A successful write is signalled by the
   * promise settling, not by what it resolves with: drivers may resolve with
   * the written items (localForage does) or with nothing, and callers must
   * treat both as success.
   */
  setItems?(items: Record<string, any>): Promise<Record<string, any> | void>;
  getItems?(keys: string[]): Promise<Record<string, any>>;
  debouncedSetItems?: {
    (items: Record<string, any>): Promise<Record<string, any> | void>;
    flush?: () => void;
  };
}

/**
 * @public
 */
export type StoreType = 'local' | 'session' | 'indexed' | 'in_memory' | 'node';
