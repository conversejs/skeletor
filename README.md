# Skeletor

[![XMPP Chat](https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![CI Tests](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml/badge.svg)](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml)

Skeletor is a modernization of [Backbone](http://backbonejs.org)'s Models and Collections, which are used for managing state.

## Installation

```
npm install @converse/skeletor
```

## Changes from Backbone

We've made big, backwards incompatible changes in version 1.0.0:

- Removed the old `View`
- Removed the old `Events` constructor function and instead added the `EventsEmitter` mixin class.
- Removed the `Router` and `History` classes.
- All other types (e.g. `Model`, `Collection`) are now ES6 classes.

### Sekeletor adds the following changes to Backbone

* Rewritten in TypeScript
* Removes the dependency on jQuery
* Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
* Imports lodash methods individually to allow for tree-shaking
* Uses the native browser API instead of lodash whereever possible
* Drops support for older browsers (including IE) and uses ES6+ language features
* Splits models and collections into separate modules
* Adds the possibility to returns promises for asynchronous operations

### Other backwards incompatible changes

* Collection.prototype.forEach no longer returns the items being iterated over.
  If you need that, use `map` instead.
* The `chain`, `clone` and `escape` methods on Models have been removed.
* The `clone` method has also been removed from Collections
* The `inject`, `foldl` and `foldr` methods on Collections has been removed. You can use `reduce` instead.
* Removed the `sample`, `take`, `tail` and `initial` method on Collections.
* Removed the `without`, `reject` and `select` methods on Collections, use `filter`.
* Removed the `.extend()` method on `Model` and `Collection`.
* Models and Collections should be defined via `class .. extends` syntax.

#### Changes due to using Lodash instead of Underscore

1. Use `drop` instead of `rest`.
2. `indexBy` is called `keyBy`
3. Use `invokeMap` for collections instead of `invoke`.
4. Use `includes` instead of `contains`
5. The `partition` and `invokeMap` methods have been removed.

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor2.jpg)
