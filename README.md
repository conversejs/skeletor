# Skeletor

[![XMPP Chat](https://inverse.chat/badge.svg?room=discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![Travis](https://api.travis-ci.org/conversejs/skeletor.png?branch=master)](https://travis-ci.org/conversejs/skeletor)

Skeletor is a [Backbone](http://backbonejs.org) fork.

Its goal is to modernize and componentize Backbone.

Original Backbone Views can't be rendered in a nested and declarative way,
similarly to how components are rendered in React and other frameworks.

We can solve this by making Views web components. Check out the `ElementView` class, which does this.

## Why bother?

The goal of this fork is to allow the Converse team to gradually update the [Converse](https://conversejs.org)
XMPP webchat client to use web components (using [LitElement](https://lit-element.polymer-project.org/))
without requiring us to put everything on hold in order to do a massive rewrite.

The end-goal is to not have any Backbone/Skeletor Views at all, only LitElement components.

We can cheat a little by letting the existing Views also be web components
(more accurately, "custom elements"), this allows us to declaratively render the
UI, while we're progressively getting rid of the views.

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor2.jpg)

## Sekeletor adds the following changes to Backbone

* Removes the dependency on jQuery
* Instead of the `render` method Views can have a `toHTML` method which must return a [lit-html](https://lit-html.polymer-project.org/) `TemplateResult`.
* Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
* Imports lodash methods individually to allow for tree-shaking
* Uses the native browser API instead of lodash whereever possible
* Drops support for older browsers (including IE) and uses ES6+ language features
* Splits models, views and collections into separate modules
* Adds the possibility to returns promises for asynchronous operations
* Adds a new `ElementView` class, which is a like a Backbone View, but doubles
  as an instance of HTMLElement and can be used to register a custom element or
  web-component.

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor.jpg)

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

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor3.jpg)
