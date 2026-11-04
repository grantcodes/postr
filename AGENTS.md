# AGENTS.md

## Repo shape

- pnpm workspace monorepo (`pnpm-workspace.yaml`). The root is private and holds orchestration scripts, `tests/server.ts` and `scripts/`.
- Packages: `packages/core` (`@postr/core`), `plugin-feeds`, `plugin-webmention-endpoint`, `syndicator-telegram`, `syndicator-instagram`, `syndicator-superfeedr`. Plugins depend on `@postr/core` as a `workspace:^` peer + dev dependency.
- 2.0 is a clean break from 1.x (RxDB/Express), which lives on `master`; the rebuild plan is `.planning/REBUILD.md` (gitignored).

## TypeScript everywhere

- Every package is strict TypeScript ESM: `.ts` only, `"type": "module"`, settings in `tsconfig.base.json` (`nodenext`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `rewriteRelativeImportExtensions`).
- Relative imports use the `.ts` extension; `tsc` rewrites them to `.js` in `dist/`. Each package has `tsconfig.json` (src + test, no emit; used by `vp check` for type checking) and `tsconfig.build.json` (emit `src` → `dist`).
- Tests are `test/**/*.test.ts`, run directly by `node --test` (Node type stripping). No erasable-incompatible syntax (enums, namespaces, parameter properties).
- Core's `exports` has an `@postr/source` condition pointing at `src/index.ts`. Plugin tests run with `node --conditions=@postr/source` and `tsconfig.base.json` sets it as a `customConditions`, so tests and `vp check` use core's source without a build. `tsconfig.build.json` clears it so `dist` types resolve against core's published `dist`.

## Core architecture (`packages/core/src`)

- `postr.ts` — `createPostr(options)`: opens SQLite (`node:sqlite` + Drizzle 1.0 RC, migrations in `packages/core/drizzle/`), wires the post service, plugins, job queue and the Hono Micropub app. Returns `{ posts, app, fetch, media, jobs, close }`.
- `db/schema.ts` — `posts` (mf2 `properties` JSON + columns for `path`, `slug`, `status`, `visibility`, `published`, `publishedAt`, `updated`, `deletedAt`), `refs`, `post_refs`, `jobs`. After changing it run `pnpm --filter @postr/core db:generate`.
- `posts/service.ts` — create/update/delete/undelete/get/getByUrl/list/categories/references/toMf2. `posts/normalize.ts` splits mf2 into columns, applies defaults and drops `mp-*` commands.
- `micropub/app.ts` — Micropub + media routes; `micropub/auth.ts` — token verification and scopes.
- `side-effects.ts` — built-in plugin: external media download (beforeSave) and queued reference fetching, webmentions and syndication (afterSave, only for `origin: 'user'`). `jobs.ts` retries with backoff.
- Plugins (`plugins.ts`) are objects: `beforeSave`, `afterSave`, `routes` (mounted at `<endpoint>/plugin/<id>`), `syndication`, `postTypes`. Writes from plugins go through `posts.update(..., { origin })`.

## Commands that matter

- `pnpm install`, `pnpm run build`, `pnpm test`, `vp check` (format, lint, type check), `pnpm run check` (vp check + build + test + dry-run pack).
- `pnpm run test-server` starts `tests/server.ts` on `http://localhost:3000/micropub` (`PORT` overrides; port 3000 may be taken locally), data in `tests/_tmp/`, token `token`.
- `postr-import-legacy` (core bin) imports a 1.x `collection.dump()` JSON file.

## Release workflows

- **`npm-prerelease.yml`**: pushes to `dev` → release-please (`release-please-config.dev.json`) → publish released packages to npm tag `next` via OIDC trusted publishing (`scripts/publish-release-please-packages.ts`).
- **`release-please-stable.yml`**: pushes to `master` → release-please (`release-please-config.json`) → publish to `latest`.
- A new package must be added to both release-please configs, `.release-please-manifest.json` and `PACKAGE_MAP` in the publish script.

## Env and compatibility

- Node 24+ (`.node-version`, `engines`); `node:sqlite` and TS type stripping are required.
- `sharp` is an optional peer of core (only for `media.imageSizes`) and a dependency of the Instagram syndicator.

## Vite+ (`vp`) awareness

- `vite-plus` is a root devDependency. Root `vite.config.ts` holds only the `fmt` (Oxfmt) and `staged` config; do not add Vitest or Vite app config.
- Format with `vp fmt`; `vp check` runs format, lint (Oxlint) and type-aware type checks (tsgolint), and is the first step of `pnpm run check`. There is no separate `tsc` typecheck script.
- `pnpm install` runs `prepare` → `vp config --no-agent`, which installs the Git hook dispatcher; `.vite-hooks/pre-commit` runs `vp staged` (`vp check --fix` on staged files). Skip once with `VP_GIT_HOOKS=0`.

## Safe working assumptions

- `auth.dangerousToken` / `auth.dangerousAllowAll` bypass token verification; keep them to tests and local development.
- Formatting is owned by Oxfmt (`fmt` in `vite.config.ts`: no semicolons, single quotes, ES5 trailing commas); don't hand-format.
