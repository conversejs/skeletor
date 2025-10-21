import { Model } from './model';

export type SyncOperation = 'create' | 'update' | 'patch' | 'delete' | 'read';

export type ObjectListenedTo = object & { _listenId?: string };

export interface SyncOptions {
  url?: string;
  data?: any;
  attrs?: any;
  success?: (data?: any, options?: SyncOptions) => void;
  error?: (error: any) => void;
  xhr?: any;
  wait?: boolean;
}

export type ClassConstructor = new (...args: any[]) => object;

export type EventContext = unknown;

export type EventCallback = (...args: any[]) => void;

export type EventCallbackMap = Record<string, EventCallback>;

export type EventCallbacksMap = Record<string, EventCallback[]>;

export type EventListenerMap = Record<string, ListeningType>;

export interface EventHandlersMap {
  all?: EventHandler[];
  [name: string]: EventHandler[];
}

export type ListeningMap = Record<string, ListeningType>;

export type ObjectWithId = Record<string, any> & { id: string | number };

export interface EventEmitter {
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

export interface EventHandler {
  callback: EventCallback;
  context: any;
  ctx: any;
  listening?: ListeningType | null;
}

export interface ListeningType {
  _events?: EventCallbackMap;
  cleanup(): void;
  count: number;
  id: string;
  interop: boolean;
  listener: EventEmitter;
  obj: any;

  start(name: string | EventCallbackMap, callback: EventCallback, context: any, _listening: ListeningType): this;
  stop(name: string | EventCallbackMap, callback: EventCallback): void;
}

export interface EventsApiOptions {
  context?: any;
  ctx?: any;
  listening?: ListeningType;
  listeners?: ListeningMap;
}

export interface OffApiOptions {
  context?: any;
  listeners?: { [key: string]: ListeningType };
}

export type Comparator<T extends Model = Model> = string | boolean | ((a: T, b: T) => number) | (() => string);

export type OfferFunction = (name: string, callback: EventCallback) => void;

export type IterateeFunction = (
  eventsOrMap: EventCallbackMap | EventHandlersMap,
  name: string | null,
  callback: EventCallback | EventHandler | null,
  options: EventsApiOptions | OffApiOptions | OfferFunction | any[]
) => EventCallbackMap | EventHandlersMap | void;

export type ModelAttributes = Record<string | number, any> & { id?: string | number };
