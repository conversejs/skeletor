/*!
 * Copyright (c) JC Brand <jc@opkode.com>
 */
import debounce from 'lodash-es/debounce.js';
import difference from 'lodash-es/difference.js';
import drop from 'lodash-es/drop.js';
import every from 'lodash-es/every.js';
import extend from 'lodash-es/extend.js';
import filter from 'lodash-es/filter.js';
import find from 'lodash-es/find.js';
import first from 'lodash-es/first.js';
import forEach from 'lodash-es/forEach.js';
import get from 'lodash-es/get.js';
import head from 'lodash-es/head.js';
import includes from 'lodash-es/includes.js';
import indexOf from 'lodash-es/indexOf.js';
import initial from 'lodash-es/initial.js';
import invoke from 'lodash-es/invoke.js';
import isEmpty from 'lodash-es/isEmpty.js';
import last from 'lodash-es/last.js';
import lastIndexOf from 'lodash-es/lastIndexOf.js';
import map from 'lodash-es/map.js';
import max from 'lodash-es/max.js';
import min from 'lodash-es/min.js';
import reduce from 'lodash-es/reduce.js';
import reduceRight from 'lodash-es/reduceRight.js';
import reject from 'lodash-es/reject.js';
import rest from 'lodash-es/rest.js';
import sample from 'lodash-es/sample.js';
import shuffle from 'lodash-es/shuffle.js';
import size from 'lodash-es/size.js';
import some from 'lodash-es/some.js';
import sortBy from 'lodash-es/sortBy.js';
import tail from 'lodash-es/tail.js';
import take from 'lodash-es/take.js';
import toArray from 'lodash-es/toArray.js';
import without from 'lodash-es/without.js';
import { View } from "./view";


const Overview = function (options) {
   /* An Overview is a View that contains and keeps track of sub-views.
    * Kind of like what a Collection is to a Model.
    */
   this.views = {};
   this.keys = () => Object.keys(this.views);
   this.getAll = () => this.views;
   this.get = id => this.views[id];

   /* Exclusive get. Returns all instances except the given id. */
   this.xget = id => {
      return this.keys()
         .filter(k => (k !== id))
         .reduce((acc, k) => {
            acc[k] = this.views[k]
            return acc;
         }, {});
   }

   this.add = (id, view) => {
      this.views[id] = view;
      return view;
   };

   this.remove = id => {
      if (typeof id === "undefined") {
            new View().remove.apply(this);
      }
      const view = this.views[id];
      if (view) {
            delete this.views[id];
            view.remove();
            return view;
      }
   };

   this.removeAll = () => {
      this.keys().forEach(id => this.remove(id));
      return this;
   }

   View.apply(this, Array.prototype.slice.apply(arguments));
};


const methods = {
   includes, difference, drop,
   every, filter, find,
   first, forEach, head,
   indexOf, initial, invoke, isEmpty,
   last, lastIndexOf, map, max, min, reduce,
   reduceRight, reject, rest, sample,
   shuffle, size, some, sortBy, tail, take,
   toArray, without
}
Object.keys(methods).forEach(name => {
   Overview.prototype[name] = function() {
      const args = Array.prototype.slice.call(arguments);
      args.unshift(this.views);
      return methods[name].apply(this, args);
   };
});

Object.assign(Overview.prototype, View.prototype);
Overview.extend = View.extend;


const OrderedListView = Overview.extend({
   /* An OrderedListView is a special type of Overview which adds some
    * methods and conventions for rendering an ordered list of elements.
    */
   // The `listItems` attribute denotes the path (from this View) to the
   // list of items.
   listItems: 'model',
   // The `sortEvent` attribute specifies the event which should cause the
   // ordered list to be sorted.
   sortEvent: 'change',
   // If false, we debounce sorting and inserting the new item
   // (for improved performance when a large amount of items get added all at once)
   // Otherwise we immediately sort the items and insert the new item.
   sortImmediatelyOnAdd: false,
   // The `listSelector` is the selector used to query for the DOM list
   // element which contains the ordered items.
   listSelector: '.ordered-items',
   // The `itemView` is constructor which should be called to create a
   // View for a new item.
   ItemView: undefined,
   // The `subviewIndex` is the attribute of the list element model which
   // acts as the index of the subview in the overview.
   // An overview is a "Collection" of views, and they can be retrieved
   // via an index. By default this is the 'id' attribute, but it could be
   // set to something else.
   subviewIndex: 'id',

   initialize () {
      this.sortEventually = debounce(() => this.sortAndPositionAllItems(), 100);
      this.items = get(this, this.listItems);
      this.items.on('remove', this.removeView, this);
      this.items.on('reset', this.removeAll, this);

      this.items.on('add', (a, b) => {
         if (this.sortImmediatelyOnAdd) {
            this.sortAndPositionAllItems();
         } else {
            this.sortEventually();
         }
      });

      if (this.sortEvent) {
         this.items.on(this.sortEvent, this.sortEventually, this);
      }
   },

   createItemView (item) {
      let item_view = this.get(item.get(this.subviewIndex));
      if (!item_view) {
            item_view = new this.ItemView({model: item});
            this.add(item.get(this.subviewIndex), item_view);
      } else {
            item_view.model = item;
            item_view.initialize();
      }
      item_view.render();
      return item_view;
   },

   removeView (item) {
      this.remove(item.get(this.subviewIndex));
   },

   sortAndPositionAllItems () {
      if (!this.items.length) {
            return;
      }
      this.items.sort();

      const list_el = this.el.querySelector(this.listSelector);
      const div = document.createElement('div');
      list_el.parentNode.replaceChild(div, list_el);
      this.items.forEach(item => {
            let view = this.get(item.get(this.subviewIndex));
            if (!view) {
               view = this.createItemView(item)
            }
            list_el.insertAdjacentElement('beforeend', view.el);
      });
      div.parentNode.replaceChild(list_el, div);
   }
});

export { OrderedListView, Overview }
