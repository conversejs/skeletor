/**
 * Node.js entry point for @converse/skeletor.
 * Re-exports everything from the browser entry and additionally
 * exports the NodeSQLiteStorage LocalForage implementation.
 */
import PersistentStorage from './storage';
import { NodeSQLiteStorage } from './drivers/nodeSQLiteStorage';

// Register the SQLite driver so `new PersistentStorage(id, 'node')` resolves it.
// The browser builds leave this unset, keeping the node-only driver out of
// their bundles entirely.
PersistentStorage.nodeStorage = NodeSQLiteStorage;

export * from './index';
export { default } from './index';
export { NodeSQLiteStorage };
