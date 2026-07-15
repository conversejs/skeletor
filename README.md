<p align="center">
  <img src="images/skeletor-logo.svg" alt="Skeletor" width="120" height="120">
</p>

<h1 align="center">Skeletor</h1>

<p align="center">
  <a href="https://chat.conversejs.org/#converse/room?jid=discuss@conference.conversejs.org"><img alt="XMPP Chat" src="https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org"></a>
  <a href="https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml"><img alt="CI Tests" src="https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml/badge.svg"></a>
</p>

Skeletor is a lightweight, TypeScript-first reactive data library.

It lets you define typed models and react to changes with events or subscriptions,
while persisting to IndexedDB, localStorage, sessionStorage, SQLite (Node) or a REST API.

Skeletor is a modernized rewrite of [Backbone](http://backbonejs.org)'s Models and Collections,
without jQuery, without Underscore, and without Views or Routing. If you know Backbone, everything
transfers directly. If you don't, there's nothing to unlearn.

Skeletor powers [Converse.js](https://conversejs.org), a full-featured open-source XMPP chat client.

## Why Skeletor?

- **Reactive models** — set an attribute, get a `change` event. Subscribe with a callback and an unsubscribe function. Works with any UI layer.
- **Direct attribute access** — `model.attrs.name = 'Bob'` fires change events, no boilerplate needed.
- **Computed properties** — declare derived values with explicit dependencies; they cache, recalculate, and fire `change` events automatically.
- **Store-style subscriptions** — `subscribe()` returns an unsubscribe function, compatible with React's `useSyncExternalStore` and similar APIs.
- **Built-in persistence** — IndexedDB, localStorage, sessionStorage, SQLite (Node), and REST out of the box.
- **TypeScript-first** — full type definitions, generic model attributes, typed computed properties.
- **No jQuery, no Underscore** — native browser APIs and [lodash-es](https://lodash.com) with individual imports for tree-shaking.
- **Works anywhere** — browser, Node.js (22+), Web Workers. ESM + CJS builds included.
- **Backbone-compatible** — `get`, `set`, events, collections: all there. Drop-in replacement for Backbone's data layer.

## Installation

```
npm install @converse/skeletor
```

## Quick Start

### Model

```ts
import { Model } from '@converse/skeletor';

interface UserAttrs {
  firstName: string;
  lastName: string;
  active: boolean;
}

class User extends Model<UserAttrs> {
  get defaults() {
    return { firstName: '', lastName: '', active: false };
  }

  get computed() {
    return {
      fullName: {
        deps: ['firstName', 'lastName'],
        fn: (model: User) => `${model.get('firstName')} ${model.get('lastName')}`,
      },
    };
  }
}

const user = new User({ firstName: 'Alice', lastName: 'Smith' });

// Read — three equivalent ways
user.get('firstName'); // → 'Alice'
user.attrs.firstName; // → 'Alice'
user.get('fullName'); // → 'Alice Smith'  (computed — cached, never persisted)

// Write — fires change events
user.attrs.firstName = 'Bob'; // triggers 'change:firstName' and 'change:fullName'
user.set('active', true); // triggers 'change:active'

// React to changes
user.on('change:fullName', (model, value) => {
  console.log('Name is now', value);
});

// Store-style subscription (returns unsubscribe function)
const unsub = user.subscribe((model, changed) => {
  console.log('Changed attrs:', changed);
});
unsub(); // clean up
```

### Collection

```ts
import { Model, Collection } from '@converse/skeletor';

class User extends Model {}

class Users extends Collection {
  get model() {
    return User;
  }
  get url() {
    return '/api/users';
  }
}

const users = new Users([
  { id: 1, name: 'Alice', active: true },
  { id: 2, name: 'Bob', active: false },
]);

users.add({ id: 3, name: 'Carol', active: true });

const active = users.filter((u) => u.get('active'));
const names = users.pluck('name'); // → ['Alice', 'Bob', 'Carol']

// Subscribe to structural changes (fires once per operation, not per model)
const unsub = users.subscribe((collection) => {
  console.log('collection changed, length:', collection.length);
});

// Load from the server
await users.fetch();
```

### Local Persistence

Skeletor can persist models and collections to IndexedDB, localStorage, sessionStorage, or SQLite (Node.js) with no extra packages.

#### Manual persistence

The traditional Backbone-style API: set storage once, call `save()`/`fetch()` explicitly.

```ts
import { Model, PersistentStorage } from '@converse/skeletor';

class Settings extends Model {
  initialize() {
    this.storage = new PersistentStorage('app-settings', 'local');
  }
}

const settings = new Settings({ id: 'main' });
await settings.fetch(); // load from localStorage
settings.set('theme', 'dark');
await settings.save(); // write to localStorage
```

#### Automatic persistence (`autoSync`)

Opt in once, then every write persists automatically — no `save()` calls needed.

```ts
import { Model, PersistentStorage } from '@converse/skeletor';

class Settings extends Model {
  get autoSync() {
    return true;
  }

  initialize() {
    this.storage = new PersistentStorage('app-settings', 'local');
  }
}

const settings = new Settings({ id: 'main' });
await settings.hydrated; // resolves when prior data has been loaded

settings.attrs.theme = 'dark'; // persisted automatically (debounced)
settings.set('lang', 'en'); // also auto-saved

// Pass { noAutoSave: true } to suppress persistence for a specific set() call
settings.set('transient', true, { noAutoSave: true });
```

Pending writes are debounced (see `autoSyncDelay`, default 100ms) and flushed when the
page is hidden (`visibilitychange`) or unloaded (`pagehide`).

When `autoSync` is off, `hydrated` is `undefined`, but `await model.hydrated` is still safe
(awaiting `undefined` is a no-op), so code can await it uniformly.

On a `Collection`, `autoSync` is **hydrate-only**: the collection loads its stored
state on construction but does not auto-save on `add`/`remove`/`reset`. To persist
the contents, enable `autoSync` on the contained model class — each model then
writes its own record.

Supported backends: `'local'` (localStorage), `'session'` (sessionStorage), `'indexed'` (IndexedDB), `'memory'`, `'node'` (SQLite, Node 22+).

> [!NOTE]
> **Durability on unload is best-effort, not guaranteed.** The flush on
> `visibilitychange`/`pagehide` is synchronous, but the underlying write may not be:
>
> - With **synchronous** backends (`'local'`, `'session'`) the flush completes before
>   the page tears down, so the last write is safe.
> - With **asynchronous** backends (`'indexed'`) the flush only _starts_ the write; the
>   browser can kill the page before an IndexedDB transaction commits, losing the most
>   recent debounced change. The browser gives no primitive to await a write during
>   unload, so this is inherent rather than a bug.
>
> `visibilitychange → hidden` fires earlier and far more reliably than `pagehide`
> (especially on mobile, where backgrounded tabs are killed without `pagehide`), so it
> is the real save point. To shrink the loss window further with an async backend, lower
> `autoSyncDelay`. If a write must never be lost, call `await model.save()` explicitly
> rather than relying on the unload flush.

### Events

```ts
import { EventEmitter } from '@converse/skeletor';

class Store extends EventEmitter {}

const store = new Store();
store.on('update', (data) => console.log('Updated:', data));
store.trigger('update', { key: 'value' });

// Listen to another object's events (auto-cleaned up with stopListening)
const view = new EventEmitter();
view.listenTo(store, 'update', (data) => console.log('View saw:', data));
view.stopListening(); // removes all listeners set up via listenTo

// subscribe() returns an unsubscribe function
const unsub = store.subscribe('update', (data) => console.log(data));
unsub();
```

### Integration with React

`subscribe()` is directly compatible with React's `useSyncExternalStore`:

```ts
import { useSyncExternalStore } from 'react';

function UserName({ user }) {
  const attrs = useSyncExternalStore(
    (cb) => user.subscribe(cb),  // subscribe — returns unsub
    () => user.toJSON()          // getSnapshot
  );
  return <span>{attrs.firstName}</span>;
}
```

## Features at a Glance

| Export              | What it provides                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Model`             | `get`/`set`, `attrs` proxy, `computed` properties, change tracking, validation, server sync                                            |
| `Collection`        | Full array API plus `where`, `findWhere`, `pluck`, `groupBy`, `keyBy`, `countBy`, `sortBy`                                             |
| `EventEmitter`      | `on`/`off`/`trigger`/`once`, `listenTo`/`stopListening`, `subscribe()` returning an unsubscribe function                               |
| `PersistentStorage` | IndexedDB, localStorage, sessionStorage, SQLite (Node), and in-memory backends. `autoSync` for transparent auto-save and auto-hydrate. |
| `sync`              | Low-level Fetch-based HTTP function (override for custom transports)                                                                   |

## Design philosophy

Skeletor is a **headless data layer**, not an application-state framework. It owns your _domain model_ (typed models
and collections, their relationships, persistence, and server sync) and stays out of your view layer.
Bind it to whatever renders your UI: [Lit](https://lit.dev), React (via [`useSyncExternalStore`](#integration-with-react)), or plain DOM.

That scope is deliberate. Skeletor isn't trying to compete with signal libraries, Zustand, or Redux for general UI state.
What it's uniquely good at is giving a real, long-lived application a _typed, persistent, promise-capable_ data layer it
can adopt **incrementally** (above all an existing Backbone codebase that can't afford a rewrite).

Principles that follow from that:

- **Incremental over big-bang.** Every feature is opt-in and backwards-compatible.
  Adopt `attrs`, `computed`, `subscribe`, or `autoSync` one model or one callsite at a time; nothing forces a migration.
- **Promise-capable, callback-compatible.** Async operations return promises, while Backbone-style `success`/`error` callbacks and events keep working.
  New code can `await`, old code doesn't break.
- **Derive, don't duplicate.** `computed` expresses derived values once, with caching and automatic change events.
- **Headless and framework-agnostic.** No views, no router, no framework assumptions. The reactive surface is `change` events and `subscribe()`.
- **Honest about tradeoffs.** Where a guarantee can't be made (e.g. async persistence on page unload)
  the docs say so plainly rather than implying durability that doesn't exist (see the note under [Local Persistence](#local-persistence)).

### When to use it

- You're modernizing a Backbone-era app and want a typed, promise-capable data layer without a rewrite.
- You want a headless store with built-in persistence that binds to any UI framework.
- Your state is genuinely _domain data_ — entities with identity, relationships, and a persisted lifecycle.

### When to reach for something else

- You want reactivity that auto-tracks dependencies and updates individual bindings — that's what signals give you.
  Skeletor notifies per-attribute (`change:foo`), but you wire each reaction yourself, and it re-renders at component granularity.
- Your "state" is mostly ephemeral view state (form inputs, toggles, hover) — keep that in your view layer.
- You need time-travel, structural sharing, or a strict immutable single-store architecture — that's Redux's territory.

### Direction

Skeletor is being modernized from within rather than replaced. The trajectory is a
**promise-first core with events and callbacks as a compatibility shim**, and a reactivity model that bridges cleanly to signals.
The aim is that consumers never face a migration. The library modernizes underneath them while the public surface stays stable,
and the Backbone compatibility that exists today isn't sacrificed to get there.

## Migrating from Backbone

If you have an existing Backbone project, you can migrate the data layer incrementally:

1. Install Skeletor: `npm install @converse/skeletor`
2. Replace `import Backbone from 'backbone'` with named imports: `import { Model, Collection } from '@converse/skeletor'`
3. Replace `Backbone.Model.extend({...})` with `class MyModel extends Model { ... }`
4. Fix the handful of removed or renamed methods listed below
5. Keep using Backbone for Views, Router, and History — they are unaffected

Your Views and Router don't need to change at all. Skeletor models and collections emit the same events Backbone does.

## Changes from Backbone

### Modernizations

- Rewritten in TypeScript with full type definitions
- Removed the dependency on jQuery
- Replaced [underscore](http://underscorejs.org) with [lodash-es](https://lodash.com), with individual imports for tree-shaking
- Uses native browser APIs instead of lodash wherever possible
- Drops support for older browsers (including IE); requires ES6+
- All types (`Model`, `Collection`) are ES6 classes — use `class extends` instead of `.extend()`
- Adds `EventEmitter` mixin class (replaces the old `Events` constructor function)
- Async operations return Promises
- ESM build available alongside CJS
- `attrs` proxy for direct reactive attribute access
- `computed` properties with caching and automatic change events
- `subscribe()` returning an unsubscribe function on all reactive objects

### What was removed

- `View` and `ElementView` — manage your UI separately
- `Router` and `History` — use the browser's History API or a dedicated router library
- `.extend()` static method — use `class MyModel extends Model` instead
- `clone()` on Model — use `new MyModel(model.toJSON())` instead
- `chain()` and `escape()` on Model
- `inject`, `foldl`, `foldr` on Collection — use `reduce` instead
- `sample`, `take`, `tail`, `initial` on Collection
- `without`, `reject`, `select` on Collection — use `filter` instead
- `partition` and `invokeMap` on Collection

### Method renames (Underscore → Lodash)

| Old (Underscore) | New (Lodash)                           |
| ---------------- | -------------------------------------- |
| `rest`           | `drop`                                 |
| `indexBy`        | `keyBy`                                |
| `invoke`         | `invokeMap` (then removed — use `map`) |
| `contains`       | `includes`                             |

### Other behavioural changes

- `Collection.prototype.forEach` no longer returns the iterated items. Use `map` instead.
- `Model.prototype.set` returns `null` (not `false`) when validation fails.
- `Collection.prototype.create` returns `null` (not `boolean`) on failure.

---

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor2.jpg)
