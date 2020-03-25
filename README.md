# Skeletor

[![XMPP Chat](https://inverse.chat/badge.svg?room=discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![Travis](https://api.travis-ci.org/skeletorjs/skeletor.png?branch=master)](https://travis-ci.org/skeletorjs/skeletor)

Skeletor is a work-in-progress [Backbone](http://backbonejs.org) fork.

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor2.jpg)

## Sekeletor adds the following changes to Backbone

* Removes the dependency on jQuery
* Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
* Imports lodash methods individually to allow for tree-shaking
* Use the native browser API instead of lodash whereever possible
* Drops support for older browsers (including IE) and uses ES6+ language features
* Splits models, views and collections into separate modules
* Adds the possibility to returns promises for asynchronous operations

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor.jpg)

### Backwards incompatible changes

* Collection.prototype.forEach no longer returns the items being iterated over.
  If you need that, use `map` instead.
* The `chain` method on Models has been removed.
* The `inject`, `foldl` and `foldr` methods on Collections has been removed. You can use `reduce` instead.
* Removed the `sample`, `take`, `tail` and `initial` method on Collections.
* Removed the `without`, `reject` and `select` methods on Collections, use `filter`.

#### Changes due to using Lodash instead of Underscore

1. Use `drop` instead of `rest`.
2. `indexBy` is called `keyBy`
3. Use `invokeMap` for collections instead of `invoke`.
4. Use `includes` instead of `contains`
5. The `partition` and `invokeMap` methods have been removed.

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor3.jpg)
