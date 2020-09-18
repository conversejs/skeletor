# Changelog

## 0.0.1 (Unreleased)

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

