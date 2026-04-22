export function chainCallback<T>(promise: Promise<T>, callback: ((err: any, result?: T) => void) | undefined): void {
  if (callback) {
    promise.then(
      (result) => callback(null, result),
      (err) => callback(err),
    );
  }
}

export function getCallback(...args: any[]): ((...args: any[]) => void) | undefined {
  if (args.length && typeof args[args.length - 1] === 'function') {
    return args[args.length - 1];
  }
}

export function normalizeKey(key: string | number): string {
  if (typeof key !== 'string') {
    console.warn(`${key} used as a key, but it is not a string.`);
    key = String(key);
  }
  return key;
}

export function serializeSync(value: any): string {
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Date) {
      return val.toISOString();
    }
    return val;
  });
}

export function serialize(value: any, callback: (serializedValue: string, error: any) => void): void {
  try {
    callback(serializeSync(value), null);
  } catch (e) {
    callback('', e);
  }
}

export function deserialize<T>(value: string): T {
  return JSON.parse(value);
}

/**
 * Sanitize a user-supplied string so it is safe to use as a single path segment.
 * Removes path separators, null bytes, and resolves away any `.` / `..` components.
 * Throws if the result is empty.
 */
export function sanitizePathSegment(segment: string): string {
  if (typeof segment !== 'string' || segment.length === 0) {
    throw new Error(`Storage name must be a non-empty string, got: ${JSON.stringify(segment)}`);
  }
  // eslint-disable-next-line no-control-regex
  const cleaned = segment.replace(/\x00/g, '');
  const sanitized = cleaned.replace(/[/\\]/g, '_');
  if (sanitized.length === 0) {
    throw new Error(`Storage name sanitized to an empty string: ${JSON.stringify(segment)}`);
  }
  return sanitized;
}
