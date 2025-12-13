import {Collection} from './collection';
import {Model} from './model';

/**
 * @public
 */
export type SyncOperation = 'create' | 'update' | 'patch' | 'delete' | 'read';

/**
 * @public
 */
export type ObjectListenedTo = object & {_listenId?: string};

/**
 * @public
 */
export interface SyncOptions {
  url?: string;
  data?: any;
  attrs?: any;
  success?: (data?: any, options?: SyncOptions) => void;
  error?: (error: any) => void;
  xhr?: any;
  wait?: boolean;
}

/**
 * @public
 */
export type ClassConstructor<T = any> = new (...args: any[]) => T;

/**
 * @public
 */
export type EventContext = unknown;

/**
 * @public
 */
export type EventCallback = (...args: any[]) => void;

/**
 * @public
 */
export type EventCallbackMap = Record<string, EventCallback>;

/**
 * @public
 */
export type EventCallbacksMap = Record<string, EventCallback[]>;

/**
 * @public
 */
export type EventListenerMap = Record<string, ListeningType>;

/**
 * @public
 */
export interface EventHandlersMap {
  all?: EventHandler[];
  [name: string]: EventHandler[];
}

/**
 * @public
 */
export type ListeningMap = Record<string, ListeningType>;

/**
 * @public
 */
export type ObjectWithId = Record<string, any> & {id: string | number};

/**
 * @public
 */
export interface IEventEmitter {
  _events?: Record<string, any>;
  _listeners?: ListeningMap;
  _listeningTo?: ListeningMap;
  _listenId?: string;

  on(name: string | EventCallbackMap, callback?: EventCallback | EventContext, context?: EventContext): this;
  off(
    name?: string | EventCallbackMap | null,
    callback?: EventCallback | EventContext | null,
    context?: EventContext
  ): this;
  trigger(name: string, ...args: any[]): this;
  stopListening(obj?: any, name?: string | EventCallbackMap, callback?: EventCallback): this;
  once(name: string | EventCallbackMap, callback?: EventCallback | EventContext, context?: EventContext): this;
  listenTo(obj: ObjectListenedTo, name: string | EventCallbackMap, callback?: EventCallback): this;
  listenToOnce(obj: any, name: string | EventCallbackMap, callback?: EventCallback): this;
}

/**
 * @public
 */
export interface EventHandler {
  callback: EventCallback;
  context: any;
  ctx: any;
  listening?: ListeningType | null;
}

/**
 * @public
 */
export interface ListeningType {
  _events?: EventCallbackMap;
  cleanup(): void;
  count: number;
  id: string;
  interop: boolean;
  listener: IEventEmitter;
  obj: any;

  start(name: string | EventCallbackMap, callback: EventCallback, context: any, _listening: ListeningType): this;
  stop(name: string | EventCallbackMap, callback: EventCallback): void;
}

/**
 * @public
 */
export interface EventsApiOptions {
  context?: any;
  ctx?: any;
  listening?: ListeningType;
  listeners?: ListeningMap;
}

/**
 * @public
 */
export interface OffApiOptions {
  context?: any;
  listeners?: {[key: string]: ListeningType};
}

/**
 * @public
 */
export type Comparator<T extends Model = Model> = string | boolean | ((a: T, b: T) => number) | ((a?: T) => string);

/**
 * @public
 */
export type OfferFunction = (name: string, callback: EventCallback) => void;

/**
 * @public
 */
export type IterateeFunction = (
  eventsOrMap: EventCallbackMap | EventHandlersMap,
  name: string | null,
  callback: EventCallback | EventHandler | null,
  options: EventsApiOptions | OffApiOptions | OfferFunction | any[]
) => EventCallbackMap | EventHandlersMap | void;

/**
 * @public
 */
export type ModelAttributes = Record<string | number, any> & {id?: string | number};

/**
 * @public
 */
export type Options = Record<string, any>;

export type FetchOrCreateOptions = Options & {
  promise?: boolean,
  success?: (m: Model, resp: any, callbackOpts: Options) => void;
};

/**
 * @public
 */
export type CollectionOptions<T extends Model = Model> = Options & {
  model?: new (attributes?: Partial<ModelAttributes>, options?: ModelOptions) => T;
  comparator?: Comparator<T>;
  previousModels?: Model[];
};

/**
 * @public
 */
export type ModelOptions = Options & {
  collection?: Collection;
  parse?: boolean;
  unset?: boolean;
  silent?: boolean;
  validate?: boolean;
};
