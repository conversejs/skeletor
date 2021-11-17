# Skeletor

[![XMPP Chat](https://conference.conversejs.org/muc_badge/discuss@conference.conversejs.org)](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org)
[![Travis](https://api.travis-ci.org/conversejs/skeletor.png?branch=master)](https://travis-ci.org/conversejs/skeletor)

Skeletor is a [Backbone](http://backbonejs.org) fork that adds various improvements and features.

## Introduction

The goal of Skeletor is to modernize Backbone and to allow you to stop
writing imperative view code (e.g. manually adding and removing DOM nodes)
and instead start writing declarative, component-based code that automatically
updates only the changed parts of the DOM, similarly to basically all modern
JavaScript frameworks.

The original Backbone Views aren't components can't be rendered in a nested and
declarative way. Instead, it's up to you to manually make sure that these views
are rendered in the correct place in the DOM. This approach becomes unwieldy,
difficult and fragile as your site becomes larger and more complex.

Skeletor solves this by creating a new type of View, called `ElementView`,
which is very similar to the original Backbone `View` but which is also a web
component that gets instantiated automatically as soon as its rendered in the
DOM.

## Why bother?

The goal of this fork is to allow the Converse team to gradually update the [Converse](https://conversejs.org)
XMPP webchat client to use web components (using [LitElement](https://lit-element.polymer-project.org/))
without requiring us to put everything on hold in order to do a massive rewrite.

The end-goal is to not have any Skeletor Views at all, only LitElement components.

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
