# Skeletor

[![XMPP Chat](https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![CI Tests](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml/badge.svg)](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml)

Skeletor is a modernized, TypeScript-first rewrite of [Backbone](http://backbonejs.org)'s Models and Collections.

The reactive data layer you know, without jQuery, without Underscore, and without the baggage of Views or Routing.

Useful if you have a Backbone app you want to modernize, or you simply want lightweight reactive data models that work with any UI layer.

## Why Skeletor?

- **Backbone-compatible mental model** — `get`, `set`, events, collections: all there. Your existing Backbone knowledge transfers directly.
- **Piecemeal modernization** — Swap Backbone's data layer for Skeletor without touching your Views or Router. Modernize at your own pace.
- **Works with any UI** — Skeletor only manages data. Pair it with React, Vue, Lit, web components, or plain DOM.
- **TypeScript-first** — Full type definitions included.
- **No jQuery, no Underscore** — Uses native browser APIs and [lodash-es](https://lodash.com), individually imported for tree-shaking.
- **Built-in browser storage** — Persist models to IndexedDB, localStorage, or sessionStorage with zero extra setup.
- **Promises everywhere** — All async operations (`fetch`, `save`, `destroy`) return Promises.
- **ESM + CJS builds** — Works in modern bundlers and Node.js out of the box.
- **Works in NodeJS** — Persists to SQLite, available from Node 22

Skeletor powers [Converse.js](https://conversejs.org), a full-featured open-source XMPP chat client.

## Installation

```
npm install @converse/skeletor
```

## Quick Start

### Model

```ts
import { Model } from '@converse/skeletor';

class User extends Model {
  get defaults() {
    return { name: '', active: false };
  }

  validate(attrs) {
    if (!attrs.name) return 'Name is required';
  }
}

const user = new User({ name: 'Alice' });

user.on('change:name', (model, value) => {
  console.log('Name changed to', value);
});

user.set('name', 'Bob'); // → "Name changed to Bob"
console.log(user.get('name')); // → "Bob"
console.log(user.hasChanged('name')); // → true
```

### Collection

```ts
import { Model, Collection } from '@converse/skeletor';

class User extends Model {}

class Users extends Collection {
  get model() { return User; }
  get url() { return '/api/users'; }
}

const users = new Users([
  { id: 1, name: 'Alice', active: true },
  { id: 2, name: 'Bob',   active: false },
]);

users.on('add', (model) => console.log('Added:', model.get('name')));
users.add({ id: 3, name: 'Carol', active: true });

const active = users.filter(u => u.get('active'));
const names  = users.pluck('name'); // → ['Alice', 'Bob', 'Carol']

// Load from the server
await users.fetch();
```

### Browser Storage

Persist models locally without a server — no extra packages needed.

```ts
import { Model, BrowserStorage } from '@converse/skeletor';

class Settings extends Model {
  constructor(...args) {
    super(...args);
    this.browserStorage = new BrowserStorage('app-settings', 'local');
  }
}

const settings = new Settings();
await settings.fetch();          // loads from localStorage

settings.set('theme', 'dark');
await settings.save();           // persists to localStorage
```

Supported backends: `'local'` (localStorage), `'session'` (sessionStorage), `'indexed'` (IndexedDB), `'memory'`.

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
```

### Store-style subscriptions

`subscribe()` is a modern alternative to `on()` that returns an unsubscribe function, making it compatible with React's `useSyncExternalStore` and other store-style APIs.

```ts
// Model — subscribe to all attribute changes
const unsub = user.subscribe((model, changed) => {
  console.log('changed:', changed); // { name: 'Bob' }
});
unsub(); // unsubscribe

// Model — subscribe to a specific event
const unsub = user.subscribe('change:name', (model, value) => {
  console.log('name is now', value);
});

// Collection — fires once per operation (add/remove/reset/sort) — not per individual model
const unsub = users.subscribe((collection) => {
  console.log('collection changed, length:', collection.length);
});

// React — useSyncExternalStore
import { useSyncExternalStore } from 'react';

function UserName({ user }) {
  const attrs = useSyncExternalStore(
    (cb) => user.subscribe(cb),  // subscribe (returns unsub)
    () => user.toJSON()          // getSnapshot
  );
  return <span>{attrs.name}</span>;
}
```

## Features at a Glance

| Export | What it provides |
|---|---|
| `Model` | `get`/`set`, change tracking, validation, server sync via `fetch` |
| `Collection` | Full array API plus `where`, `findWhere`, `pluck`, `groupBy`, `keyBy`, `countBy`, `sortBy` |
| `EventEmitter` | `on`/`off`/`trigger`/`once` plus `listenTo`/`stopListening` for safe memory management, and `subscribe()` returning an unsubscribe function |
| `BrowserStorage` | IndexedDB, localStorage, sessionStorage, and in-memory backends |
| `sync` | Low-level Fetch-based HTTP function (override for custom transports) |

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

| Old (Underscore) | New (Lodash) |
|---|---|
| `rest` | `drop` |
| `indexBy` | `keyBy` |
| `invoke` | `invokeMap` (then removed — use `map`) |
| `contains` | `includes` |

### Other behavioural changes

- `Collection.prototype.forEach` no longer returns the iterated items. Use `map` instead.
- `Model.prototype.set` returns `null` (not `false`) when validation fails.
- `Collection.prototype.create` returns `null` (not `boolean`) on failure.

---

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor2.jpg)
