# Skeletor

[![XMPP Chat](https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![CI Tests](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml/badge.svg)](https://github.com/conversejs/skeletor/actions/workflows/karma-tests.yml)

Skeletor is a modernization of [Backbone](http://backbonejs.org)'s Models and Collections,
while getting rid of the old Views.

It provides you with a more modern Backbone-like way to manage state.

## Introduction

The original goal of Skeletor was to modernize Backbone to allow writing
declarative view code instead of the imperative code (e.g. manually adding and
removing DOM nodes). In other words, to allow for component-based code that
automatically updates only the changed parts of the DOM, similarly to basically
all modern JavaScript frameworks.

The original Backbone Views aren't components and can't be rendered in a nested and
declarative way. Instead, it's up to you to manually make sure that these views
are rendered in the correct place in the DOM. This approach becomes unwieldy,
difficult and fragile as your site becomes larger and more complex.

Skeletor solves this by creating a new type of View, called `ElementView`,
which is very similar to the original Backbone `View` but which is also a web
component that gets instantiated automatically as soon as its rendered in the
DOM.

The thing is, [Lit](https://lit.dev) Elements already provide anything one
might need for a modern Backbone-line application. There's not really a need
for the `ElementView` anymore, except to provide an upgrade path from a
Backbone app to one that uses web components. It'll therefore likely be removed
entirely in a future version, thereby leaving only Models and Collections, for
managing state.

## Installation

```
npm install @converse/skeletor
```

## Changes from Backbone

We've made big, backwards incompatible changes in version 2:

- Removed the old `View` type
- Removed the old `Events` constructor function and instead added the `EventsEmitter` mixin class.
- Removed the `Router` and `History` classes.
- All other types (`Model`, `Collection`, `ElementView`) are now ES6 classes.

### Sekeletor adds the following changes to Backbone

* Added TypeScript type declarations (generated from typed JSDoc comments)
* Removes the dependency on jQuery
* Replaces [underscore](http://underscorejs.org) with [lodash](https://lodash.com)
* Imports lodash methods individually to allow for tree-shaking
* Uses the native browser API instead of lodash whereever possible
* Drops support for older browsers (including IE) and uses ES6+ language features
* Splits models and collections into separate modules
* Adds the possibility to returns promises for asynchronous operations
* Adds a new `ElementView` class, which is a like a Backbone View, but doubles
  as an instance of HTMLElement and can be used to register a custom element or
  web-component.

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

### ElementView example

The ElementView looks very similar to a normal Backbone View.

Since it's a web component, you need to call `CustomElementRegistry.define` to
register it.

The `this` variable for the ElementView is the custom DOM element itself,
in this case, `<my-custom-button>`.

So there is no `el` attribute and `this.el` will be undefined. Whereever in a
Backbone View you'd use `this.el`, with an ElementView you'd just use `this`.


```javascript

import { ElementView } from '@converse/skeletor/src/element.js';
import { render } from 'lit';
import { html } from 'lit';

export default class MyCustomButton extends ElementView {
    events = {
        'click .button': 'onButtonClicked'
    }

    async initialize () {
        this.model = new Model({ count: 0 });
        this.listenTo(this.model, 'change', this.render)
    }

    render () {
      return render(html`<button class="button">I've been clicked ${model.get('count')} times!</button>`, this);
    }

    onButtonClicked () {
      this.model.save('count', this.model.get('count')+1);
    }
}

CustomElementRegistry.define('my-custom-button', MyCustomButton);
```

You can now put your custom element in the DOM, and once the DOM is loaded by
the browser, your ElementView will automatically be instantiated and
`initialize` will be called.


```html
  <div>
    <my-custom-button></my-custom-button>
  </div>
```

![](https://raw.githubusercontent.com/conversejs/skeletor/master/images/skeletor2.jpg)
