/*!
 * Copyright (c) JC Brand <jc@opkode.com>
 */
import { View } from "./view";
import  {
   chain, includes, debounce, detect,
   difference, drop, each,
   every, extend, filter,
   find, first, forEach, get,
   head, indexOf,
   initial, invoke,
   isEmpty, last, lastIndexOf,
   map, max, min,
   reduce, reduceRight,
   reject, rest, sample,
   shuffle, size,
   some, sortBy, tail,
   take, toArray, without
} from 'lodash';


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
   chain, includes, difference, drop,
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

extend(Overview.prototype, View.prototype);
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
