# Changelog

## 0.0.3 (2021-05-12)

- Create the `ElementView`, which is like a Backbone View but extends
  `HTMLElement` and is therefore also a custom element or web component.
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
