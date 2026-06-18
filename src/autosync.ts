/**
 * Debounced auto-save scheduling and unload-flush for models/collections
 * with autoSync enabled.
 */
import type PersistentStorage from './storage';

const pending = new Map<object, { timerId: ReturnType<typeof setTimeout>; run: () => unknown }>();
const inFlight = new Set<Promise<unknown>>();
// Per-object view of `inFlight`, so a caller (notably `Model.destroy`) can
// await the saves for a single object without blocking on unrelated writes.
const inFlightByObj = new Map<object, Set<Promise<unknown>>>();
let unloadListenerAttached = false;

function fireRun(obj: object | null, run: () => unknown): void {
  const p = Promise.resolve(run()).catch((e) => {
    console.error('Skeletor autoSync save error:', e);
  });
  inFlight.add(p);
  let perObj: Set<Promise<unknown>> | undefined;
  if (obj) {
    perObj = inFlightByObj.get(obj);
    if (!perObj) {
      perObj = new Set();
      inFlightByObj.set(obj, perObj);
    }
    perObj.add(p);
  }
  p.finally(() => {
    inFlight.delete(p);
    if (perObj) {
      perObj.delete(p);
      if (perObj.size === 0) inFlightByObj.delete(obj!);
    }
  });
}

/**
 * Schedule a debounced auto-save for `obj`. Replaces any pending schedule
 * for the same object.
 * @internal
 */
export function scheduleAutoSave(obj: object, run: () => unknown, delay: number): void {
  const existing = pending.get(obj);
  if (existing) clearTimeout(existing.timerId);
  const timerId = setTimeout(() => {
    pending.delete(obj);
    fireRun(obj, run);
  }, delay);
  pending.set(obj, { timerId, run });
}

/**
 * Cancel any pending auto-save for `obj`.
 *
 * This only stops a *pending* (not-yet-fired) debounce timer. A save whose
 * timer has already fired is in flight and beyond cancellation — sequence
 * against it with {@link awaitInFlightSaves} instead.
 * @internal
 */
export function cancelAutoSave(obj: object): void {
  const existing = pending.get(obj);
  if (existing) {
    clearTimeout(existing.timerId);
    pending.delete(obj);
  }
}

/**
 * Return a promise that settles once every in-flight auto-save for `obj` has
 * completed, or `null` when none are in flight. `Model.destroy` uses this to
 * sequence its delete after a save that has already fired, so a late write
 * cannot land after the delete and resurrect the record.
 * @internal
 */
export function awaitInFlightSaves(obj: object): Promise<void> | null {
  const set = inFlightByObj.get(obj);
  if (!set || set.size === 0) return null;
  return Promise.all([...set]).then(() => undefined);
}

/**
 * Immediately execute all pending auto-saves and flush storage-level
 * debounced write buffers.
 *
 * Pass `wait: true` to also await all in-flight saves before resolving — use
 * this in tests instead of arbitrary `setTimeout` sleeps. The default
 * (`wait: false`) is synchronous and is what the unload handler uses, since the
 * browser gives no way to await a write while the page is tearing down.
 * @internal
 */
export function flushPending(opts?: { storage?: typeof PersistentStorage; wait?: false }): void;
export function flushPending(opts: { storage?: typeof PersistentStorage; wait: true }): Promise<void>;
export function flushPending({
  storage,
  wait = false,
}: { storage?: typeof PersistentStorage; wait?: boolean } = {}): void | Promise<void> {
  for (const [obj, { timerId, run }] of pending.entries()) {
    clearTimeout(timerId);
    fireRun(obj, run);
  }
  pending.clear();
  if (storage) storage.flushAll();
  if (wait) return Promise.all([...inFlight]).then(() => undefined);
}

/**
 * Reset all module-level state. For use in test afterEach hooks only.
 * @internal
 */
export function resetForTesting(): void {
  for (const { timerId } of pending.values()) clearTimeout(timerId);
  pending.clear();
  inFlight.clear();
  inFlightByObj.clear();
  unloadListenerAttached = false;
}

/**
 * Lazily attach pagehide/visibilitychange listeners in browser environments
 * to flush pending writes before the page unloads. Called at most once.
 * @internal
 */
export function ensureUnloadListener(storage: typeof PersistentStorage): void {
  if (unloadListenerAttached || typeof window === 'undefined') return;
  unloadListenerAttached = true;

  const flush = () => flushPending({ storage });
  window.addEventListener('pagehide', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
