//     (c) 2010-2019 Jeremy Ashkenas and DocumentCloud

import _ from 'lodash';

// Helpers
// -------

// Helper function to correctly set up the prototype chain for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
//
export function extend(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
        child = protoProps.constructor;
    } else {
        child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
}

// Throw an error when a URL is needed, and none is supplied.
export function urlError() {
    throw new Error('A "url" property or function must be specified');
}

// Wrap an optional error callback with a fallback error event.
export function wrapError(model, options) {
    var error = options.error;
    options.error = function(resp) {
        if (error) error.call(options.context, model, resp, options);
        model.trigger('error', model, resp, options);
    };
}

// Map from CRUD to HTTP for our default `sync` implementation.
const methodMap = {
    create: 'POST',
    update: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    read: 'GET'
};

// sync
// ----

// Override this function to change the manner in which Backbone persists
// models to the server. You will be passed the type of request, and the
// model in question. By default, makes a RESTful Ajax request
// to the model's `url()`. Some possible customizations could be:
//
// * Use `setTimeout` to batch rapid-fire updates into a single request.
// * Send up the models as XML instead of JSON.
// * Persist models via WebSockets instead of Ajax.
//
export function sync(method, model, options) {
    const type = methodMap[method];

    // Default JSON-request options.
    const params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
        params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
        params.contentType = 'application/json';
        params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET') {
        params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
        options.textStatus = textStatus;
        options.errorThrown = errorThrown;
        if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
}

export function ajax() {
    return fetch.apply(this, arguments);
}

// Create a local reference to a common array method we'll want to use later.
var slice = Array.prototype.slice;

// Proxy Backbone class methods to Underscore functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
var addMethod = function(base, length, method, attribute) {
    switch (length) {
        case 1: return function() {
            return base[method](this[attribute]);
        };
        case 2: return function(value) {
            return base[method](this[attribute], value);
        };
        case 3: return function(iteratee, context) {
            return base[method](this[attribute], cb(iteratee, this), context);
        };
        case 4: return function(iteratee, defaultVal, context) {
            return base[method](this[attribute], cb(iteratee, this), defaultVal, context);
        };
        default: return function() {
            var args = slice.call(arguments);
            args.unshift(this[attribute]);
            return base[method].apply(base, args);
        };
    }
};

var addUnderscoreMethods = function(Class, base, methods, attribute) {
    _.each(methods, function(length, method) {
        if (base[method]) Class.prototype[method] = addMethod(base, length, method, attribute);
    });
};

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
};

var modelMatcher = function(attrs) {
    var matcher = _.matches(attrs);
    return function(model) {
        return matcher(model.attributes);
    };
};

export function addMethodsToObject(config) {
    var Base = config[0],
        methods = config[1],
        attribute = config[2];

    Base.mixin = function(obj) {
        var mappings = _.reduce(_.functions(obj), function(memo, name) {
            memo[name] = 0;
            return memo;
        }, {});
        addUnderscoreMethods(Base, obj, mappings, attribute);
    };

    addUnderscoreMethods(Base, _, methods, attribute);
}
