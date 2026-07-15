# Changelog

## Unreleased

- Switch TypeScript `moduleResolution` to `bundler` and add `types` conditions to the `exports` map.

## 3.1.4 (2026-06-23)

- Fix the `autoSync` hydration promise clobbering a consumer's own `initialized` promise.
  The promise that resolves once hydration is complete is now exposed as `hydrated` (on both
  `Model` and `Collection`) instead of `initialized`. The old name collided with the common
  convention (used by Converse.js) of setting a `model.initialized` promise inside
  `initialize()` to track a consumer's own async setup.

  Skeletor no longer sets or reads `initialized`. Await `model.hydrated` / `collection.hydrated`
  to know when hydration is complete. If you used the autoSync `initialized` promise added
  in 3.1.0, rename those reads to `hydrated`.

## 3.1.3 (2026-06-23)

- Fix a regression (since 3.1.0) where a missing record on a `read` was treated as an error.
  `model.fetch({ promise: true })` rejected with the bare string `'Record Not Found'` on a
  first-run read of a non-existent record (and the `error` callback / `'error'` event fired),
  where previously 3.0.x had resolved. A read miss is a normal empty state, so it now
  resolves with `null` on both the callback (`success`) and promise forms.

  **Behaviour change:** a read miss no longer fires the `error` callback or the `'error'` event,
  it fires `success(null)` instead.

- Storage-layer `sync` failures now surface a real `Error` (with a stack) through the `error`
  callback / rejected promise instead of a bare string. The internal `Model#hydrate`
  `'Record Not Found'` string-match workaround is removed accordingly.

## 3.1.2 (2026-06-22)

- Fix the published package missing its `dist/` directory. `dist/` is gitignored and nothing built
  it during the publish lifecycle, so `npm publish` could ship a tarball without the compiled
  bundles that `main`/`module`/`exports` point at (3.1.1 was published this way and is unusable).
  Add a `prepack` script that runs the build, so `npm pack` and `npm publish` always include a
  freshly built `dist/`.

## 3.1.1 (2026-06-22)

- Fix browser builds failing to resolve `./drivers/nodeSQLiteStorage`. The node-only SQLite
  storage driver is now registered by the `@converse/skeletor/node` entry point instead of
  being pulled in via a dynamic `import()` from the shared storage module. The browser bundles
  (`skeletor.esm.js`, `skeletor.js`, `skeletor.min.js`) no longer contain a reference to a file
  that isn't published, which broke downstream bundlers.

## 3.1.0 (2026-06-22)

- Add an ESM build
- **Rename `browserStorage` → `storage`** on `Model` and `Collection`
- Add `BrowserStorage` as a deprecated export alias for `PersistentStorage`
- Add `autoSync` opt-in for transparent local persistence:
  - Declare `get autoSync() { return true; }` on a model or collection to enable.
  - **Auto-hydrate**: the model/collection loads its stored state on construction. `await model.initialized` resolves when done.
  - **Auto-save** (models only): any `set()` (including `attrs.x = y`) that produces changes schedules a debounced save. Pass `{ noAutoSave: true }` to opt out per-call
  - **Flush on unload**: when `autoSync` is used in a browser, Skeletor lazily registers `pagehide`/`visibilitychange` listeners that make a best-effort flush of pending writes when the tab is hidden/closing.
  - **Destroy/save ordering**: `destroy()` now sequences its delete after any auto-save that has already fired and is still in flight, so a late write can no longer land after the delete and resurrect the record.
  - **Error reporting**: a failed auto-save emits an `error` event on the model. Storage-layer failures surface through `sync`'s `error` callback (as before), and rejections that bypass it are emitted on the same event.
  - Override `get autoSyncDelay()` to tune the debounce window (default: 100 ms).
- Complete the `fetch({ promise: true })` contract: `Model.fetch` now supports the `promise` option (previously ignored), and the promise returned by both `Model.fetch` and `Collection.fetch` now **rejects** on error instead of hanging forever.
- Add `PersistentStorage.flushAll()` static method to flush all registered storage instances.
- Add `getStorage(obj)` helper export — returns the configured storage for a model/collection, checking both `storage` and `browserStorage` (preserves compat with subclasses that still override `get browserStorage()`).
- Add computed properties to `Model`. Declare a `computed` getter returning `{ key: { deps, fn } }` definitions.
  Values are cached, recalculated when deps change, and fire `change:key` events.
  Accessible via `model.get('key')` and `model.attrs.key`.
- Add `attrs` proxy property on `Model` for ergonomic reactive attribute access:
  `model.attrs.name` reads, `model.attrs.name = 'Bob'` writes (fires change events).
- Add `subscribe()` method to `EventEmitter`, `Model`, and `Collection`, returning an unsubscribe function.
  Compatible with React's `useSyncExternalStore` and other store-style APIs.
  `Model.subscribe(callback)` receives `(model, changed)` on any attribute change.
  `Collection.subscribe(callback)` fires once per operation (on `update`, `reset`, or `sort` events).

## 3.0.0 (2025-12-13)

- `Collection.prototype.create` no longer returns a boolean (but `null` instead)
- `Storage` is now exported as `BrowserStorage`

## 2.0.0 (2025-12-13)

### Breaking changes

- `Model.prototype.set` no longer returns a boolean when validation fails (but `null` instead)
- Loosened the `reduce` and `reduceRight` type signatures on the `Collection`

## 1.0.0 (2025-12-13)

- Rewrite as TypeScript

### Breaking changes:

- Removed the `clone()` method on `Model`.
- Removed the old `View` type
- Removed `ElementView`
- Removed the old `Events` constructor function and instead added the `EventsEmitter` mixin class.
- Removed the `Router` and `History` classes.
- All other types (`Model`, `Collection`) are now ES6 classes.

## 0.0.9 (2025-03-04)

- Fix a race condition when setting a localForage driver
- Refactor the sync method to properly call the `fetch` API

## 0.0.8 (2023-02-14)

- Use the released version of `@converse/localforage-getitems`
- Update 3rd party dependencies

## 0.0.7 (2022-04-08)

- Move code that needs to be bundled to `dependencies` from `devDependencies`
- Update localForage-getItems to fix a build issue on Windows

## 0.0.6 (2022-04-08)

- Use the `getAll` IndexedDB function, which should result in a significant speedup
- Update various 3rd party dependencies.

## 0.0.5 (2021-07-08)

- #13 Import the default export of localforage
- Don't expect a collection's `model` attribute to have a `prototype`. It might be an arrow function, in which case it doesn't.
- Update to mergebounce 0.1.0

## 0.0.4 (2021-05-12)

- Upgrade to lit 2.0.0-rc.2

## 0.0.3 (2021-04-28)

- Create the `ElementView`, which is like a Backbone View but extends
  `HTMLElement` and is therefore also a custom element or web component.
  /home/kalie/src/converse.prosody/src/converse.js/src/headless/core.js: \* @property {object} converse.env.\_ - The instance of [lodash-es](http://lodash.com) used by Converse.
- Allow writes to the client-side store to be batched (via [mergebounce](https://github.com/conversejs/mergebounce)).
  This is particularly useful for IndexedDB, which has a very slow writing speed.
  To enabled batched writes, pass in `true` for the 3rd parameter of the
  `Storage` constructor.

## 0.0.2 (2020-09-18)

Initial fork from Backbone

- Removes the dependency on jQuery
- Instead of the `render` method Views can have a `toHTML` method which must return a
  [lit-html](https://lit-html.polymer-project.org/) `TemplateResult`.
- Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
- Imports lodash methods individually to allow for tree-shaking
- Uses the native browser API instead of lodash
- Drops support for older browsers (including IE) and uses ES6+ language features
- Splits models, views and collections into separate modules
- Adds a new `ElementView` class, which is a like a Backbone View, but doubles
  as an instance of HTMLElement and can be used to register a custom element or
  web-component.
