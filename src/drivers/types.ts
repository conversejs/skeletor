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
  setItems?(items: Record<string, any>): Promise<void>;
  getItems?(keys: string[]): Promise<Record<string, any>>;
  debouncedSetItems?: {
    (items: Record<string, any>): Promise<void>;
    flush?: () => void;
  };
}

/**
 * @public
 */
export type StoreType = 'local' | 'session' | 'indexed' | 'in_memory' | 'node';
