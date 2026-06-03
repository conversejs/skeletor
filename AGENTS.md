# AGENTS.md — @converse/skeletor

## What this is

A TypeScript rewrite of Backbone's Models and Collections, published as `@converse/skeletor`.
No Views, Routers, or Events mixin — uses `EventEmitter` class instead.

## Node version

```
nvm use  # v22.14.0 (.nvmrc)
```

## Commands

| Task | Command |
|------|---------|
| Full check (CI) | `make check` |
| Type check only | `npm run check:types` |
| Tests | `npm run test` |
| Lint | `npm run lint` |
| Format | `npm run prettier` |
| Build | `npm run build` |
| Dev (watch) | `npm run dev` |

**Check order**: `check:types → test → lint` (enforced by `npm run check`).

## Testing

- **Karma** runs tests in Chrome via xvfb (headless CI).
- **QUnit** tests: `test/collection.ts`, `test/model.ts`, `test/events.ts`, `test/sync.ts`, `test/noconflict.ts`
- **Mocha** tests (storage only): `test/localStorage.test.ts`, `test/indexeddb.test.ts`, `test/sessionStorage.test.ts`
- `npm run test` runs Karma twice — once with QUnit, once with `--mocha-only` for storage tests.
- `npm run dev` starts Karma in watch mode (`--single-run=false`).
- Tests require a browser environment; they cannot run with `node` directly.

## Build

- **Rollup** bundles `src/index.ts` → `dist/skeletor.js` and `dist/skeletor.min.js` (UMD format).
- **api-extractor** rolls up `.d.ts` declarations → `dist/skeletor.d.ts`.
- Entry point: `src/index.ts`. Exports `Model`, `Collection`, `EventEmitter`, `sync`, `BrowserStorage`.
- Attaches to global scope as `Skeletor` (browser `self` or server `global`).

## TypeScript

- `strict: false`, `noImplicitAny: false` — loose type checking.
- `moduleResolution: "node"`, `esModuleInterop: true`.
- `skipLibCheck: true`.

## Style

- Prettier: `singleQuote: true`, `printWidth: 120`, `tabWidth: 2`.
- ESLint: most stylistic rules off; `@typescript-eslint/no-explicit-any` off; `no-unused-vars` off.

## Key dependencies

- `localforage` — persistent storage abstraction
- `lodash-es` — tree-shakeable utilities
- `lit-html` — templating
- `mergebounce` — merge utility

## Storage drivers

- `src/drivers/sessionStorage.ts` — sessionStorage wrapper for localforage.

## CI

- GitHub Actions: `make check` on Node 22.x with xvfb/Chrome.
- Legacy `.travis.yml` (Node 10) is stale.
