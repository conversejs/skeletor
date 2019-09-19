# Skeletor

[![XMPP Chat](https://inverse.chat/badge.svg?room=discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![Travis](https://api.travis-ci.org/skeletorjs/skeletor.png?branch=master)](https://travis-ci.org/skeletorjs/skeletor)

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor2.jpg)

Skeletor is a work-in-progress [Backbone](http://backbonejs.org) fork.
Your contributions are welcome and appreciated.

It adds the following changes:

* Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
* Drop support for older browsers (including IE) and uses ES6+ language features
* Splits models, views and collections into separate modules

We also aim to do the following:

* Allow for tree-shaking by importing only the necessary lodash methods
* Use the native browser API instead of lodash whereever possible

More speculatively:

* Update Views to be Web Components

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor.jpg)

### Changes due to using Lodash instead of Underscore

1. Use `drop` instead of `rest`.
2. `indexBy` is called `keyBy`
2. Use `invokeMap` for collections instead of `invoke`.

![](https://raw.githubusercontent.com/skeletorjs/skeletor/master/images/skeletor3.jpg)
