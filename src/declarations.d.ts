/**
 * `@converse/localforage-getitems` ships its types as an ambient script that
 * declares the *unscoped* module name (`localforage-getitems`), left over from
 * the package it was forked from. TypeScript therefore resolves the scoped
 * specifier to a `typings/index.d.ts` that isn't a module (TS2306), so declare
 * the shape we use here instead.
 */
declare module '@converse/localforage-getitems' {
  export function extendPrototype<T>(localforage: T): T;
  export const extendPrototypeResult: boolean;
}
