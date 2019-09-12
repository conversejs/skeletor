import { ajax, sync } from './helpers.js';
import { Collection } from './collection.js';
import { Events } from './events.js';
import { Model } from './model.js';
import { Router } from './router.js';
import { View } from './view.js';

const skeletor = {
  Collection,
  Events,
  Model,
  Router,
  View,
  ajax,
  sync
}
window.Skeletor = skeletor;
export default skeletor;
