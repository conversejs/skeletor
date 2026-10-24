# Changelog

## 4.0.0 (2026-10-24)

- Attribute-object queries on a collection (`findWhere`, `where`, and `find`, `filter`, `some`,
  `every`, `map`, `sortBy`, `countBy`, `groupBy`, `findIndex` and `findLastIndex` when given an
  object) now build their lodash matcher once per scan instead of once per model visited. Each
  per-model build deep-cloned the attributes object and walked its keys, which made `findWhere`
  roughly 8 to 13 times slower than `find` with a hand-written predicate on a few thousand models.
  Matching semantics are unchanged: still lodash's partial, deep comparison, so nested lookups
  such as `where({ FORM_TYPE: { type: 'hidden' } })` keep working. One alignment: `find` and
  `filter` given a string now read that attribute through `Model.get`, like the other query
  methods already did, instead of resolving it as a lodash property path over the raw attributes.

- `Model.matches` no longer deep-clones its argument on every call (it uses lodash's `isMatch`)
  and its signature now admits the predicate function it has always accepted at runtime. The
  undocumented lodash string and `[key, value]` shorthand forms are no longer supported.

- Fix `Model.save({ promise: true })` hanging forever, and leaking an unhandled rejection, when
  its `sync` settles the returned promise instead of invoking the `success`/`error` callbacks
  (a rejecting custom `sync`, or a throwing `'sync'`/`'error'` listener). `save` now bridges that
  promise to the one it hands back, the way `fetch` already did. `Collection.create({ promise: true })`,
  which delegates to `save`, is fixed the same way.

- Fix `fetch({ promise: true })` on a Model or Collection settling early when a callback-style `sync`
  returns a non-thenable (nothing, or an XHR) and invokes `success`/`error` later. The bridge from the
  `sync` return value to the returned promise now only engages for a thenable, so such a `sync` settles
  the promise through its callbacks. The same guard applies to `save({ promise: true })`.

- The `{ promise: true }` paths of `fetch` and `save` now share one bridge from the `sync` outcome
  to the returned promise, with two behaviour changes: a `sync` that rejects its promise without
  calling the callbacks now also runs the `error` callback and fires the `'error'` event, and a
  `'sync'`/`'error'` listener (or `success`/`error` callback) that throws now rejects the promise
  instead of leaving it pending with an unhandled rejection. `Collection.fetch` fires `'sync'` before
  resolving, as `Model.fetch`/`save` already did, so a throwing listener rejects there too.

- Fix `save({ promise: true })` and `fetch({ promise: true, validate: true })` leaving the promise
  pending when the attributes returned by `sync` fail validation. The promise now rejects with
  `validationError`; the `'invalid'` event fires as before.

- `save({ promise: true })` now returns a promise rejected with `validationError`, instead of `false`,
  when the attributes passed to it fail validation; `create({ promise: true })` likewise returns a
  rejected promise instead of `null`. The callback forms still return `false`/`null`.

- The default HTTP `sync` now honours both the callback and the promise contracts. It never invoked
  `success`/`error` (it passed them to `fetch()` as init options, which ignores them), sent an empty
  body on GET (which the Fetch API rejects outright), and resolved with the raw `Response`, which the
  promise bridge then merged into the model as attributes. It now sends `data` as query parameters on
  GET and as a JSON body otherwise, passes a parsed 2xx JSON body (`null` when empty) to `success` and
  resolves with it, and on a non-2xx response or a network failure calls `error` with, and rejects
  with, the error: an `HTTPError` (new export, carrying `status` and `response`) for the former.

## 3.1.6 (2026-08-06)

- The `'node'` store type can now be told where to put its database files, via the new
  `PersistentStorage.nodeStorageDir`. The driver has always taken a `storageDir` argument,
  but nothing could reach it through the string store type, so `new PersistentStorage(id, 'node')`
  was stuck with the driver's default. That default is relative, so it resolves against
  `process.cwd()` and an app started from two directories keeps two separate sets of state.
  Set an absolute path (`$XDG_STATE_HOME/<app>`, say) to pin it. The default is unchanged.

- Ship a separate `dist/skeletor.node.d.ts` for the `@converse/skeletor/node` entry point.
  Both entry points pointed their `types` at the browser rollup.

## 3.1.5 (2026-07-22)

- Fix every write through the Node.js SQLite driver failing with `Record Not Found` while
  the data was in fact stored.
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
