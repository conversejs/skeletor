export type SyncOperation = 'create' | 'update' | 'patch' | 'delete' | 'read';

export interface SyncOptions {
  url?: string;
  data?: any;
  attrs?: any;
  success?: (data?: any, options?: SyncOptions) => void;
  error?: (error: any) => void;
  xhr?: any;
  wait?: boolean;
}

export type ClassConstructor = new (...args: any[]) => {};

export type EventCallback = (...args: any[]) => void;

export type EventMap = Record<string, EventCallback>;

export type ListeningMap = Record<string, Listening>;

export interface EventEmitter {
  _events?: Record<string, any>;
  _listeners?: ListeningMap;
  _listeningTo?: ListeningMap;
  _listenId?: string;

  on(name: string | EventMap, callback?: EventCallback, context?: any): this;
  off(name?: string | null, callback?: EventCallback | null, context?: any): this;
  trigger(name: string, ...args: any[]): this;
  stopListening(obj?: any, name?: string, callback?: EventCallback): this;
  once(name: string | EventMap, callback?: EventCallback, context?: any): this;
  listenTo(obj: any, name: string | EventMap, callback?: EventCallback): this;
  listenToOnce(obj: any, name: string | EventMap, callback?: EventCallback): this;
}

export interface EventHandler {
  callback: EventCallback;
  context: any;
  ctx: any;
  listening?: Listening | null;
}

export interface Events {
  [name: string]: EventHandler[];
}

export interface Listening {
  count: number;
  stop(name: string, callback: EventCallback): void;
  cleanup(): void;
}

export interface EventsApiOptions {
  context?: any;
  ctx?: any;
  listening?: Listening;
  listeners?: ListeningMap;
}

export interface OffApiOptions {
  context?: any;
  listeners?: { [key: string]: Listening };
}

export interface EventsCallbackMap {
  [name: string]: EventCallback;
}

export interface EventsHandlersMap {
  all?: EventHandler[];
  [name: string]: EventHandler[];
}

export type OfferFunction = (name: string, callback: EventCallback) => void;

export type IterateeFunction = (
  eventsOrMap: Events | EventsCallbackMap | EventsHandlersMap,
  name: string,
  callback: EventCallback | null,
  options: EventsApiOptions | OffApiOptions | OfferFunction | any[]
) => Events | EventsCallbackMap | EventsHandlersMap | void;
