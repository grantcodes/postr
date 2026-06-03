# AGENTS.md

## Repo shape
- This repo is a **pnpm workspace monorepo** (see `pnpm-workspace.yaml`). The repo root is a non-publishable workspace/meta root with orchestration scripts only. The `@postr/core` package lives in `packages/core/`; each package under `packages/` has its own `package.json`.
- All internal package references use `workspace:^` protocol — pnpm resolves these from the workspace automatically.
- Legacy `package-lock.json` files have been removed; `pnpm-lock.yaml` is the single source of truth.

## Runtime entrypoints
- Core entrypoint is `packages/core/index.js`, which wires config, RxDB collection setup, plugin loading, and the shared Express router.
- HTTP behavior lives in `packages/core/lib/router.js`: `GET /` handles Micropub queries, `POST /` handles Micropub actions/posts, and `POST /media` is the media endpoint.
- Database setup is centralized in `packages/core/lib/db.js`; it creates the `posts` RxDB collection and registers the pre/post hooks for validation, defaults, permalink conflict handling, media downloads, ref parsing, and webmentions.
- Plugin registration lives in `packages/core/lib/plugins.js`. Class-based plugins receive `{ RxDB, config, getCollection, generateSearch, router, getHEntry, isNode }` via `imports`.

## Commands that matter
- Root install: `pnpm install` (or `vp install` if using Vite+)
- Root smoke server: `pnpm run test-server`
- Build all packages (compiles TS sources where needed): `pnpm run build`
- Verify all packages: `pnpm run check` (build + dry-run pack)
- Dry-run pack independently: `pnpm -r pack --dry-run`
- Release automation uses release-please manifest mode (see `release-please-config.json` and `.release-please-manifest.json`)
- Do not use `npm test` at root or in packages as a verification step unless you first replace the placeholder script; the checked-in script intentionally exits with an error.
- `pnpm run test-server` starts an Express app on `http://localhost:3000/micropub`, uses `tests/_tmp/` for LevelDB/media output, seeds sample posts on first run, and enables `dangerousDevMode`.

## Release workflows
- **`npm-prerelease.yml`**: triggered by pushes to `dev`. Uses release-please manifest mode with prerelease config (`release-please-config.dev.json`) to open/update release PRs. When a release PR merges, creates GitHub Releases and publishes released packages to npm tag `next` via OIDC trusted publishing (no npm tokens). Version suffix is `-dev.N` (branch-derived) — the npm dist-tag `next` is a separate concern set in the publish script.
- **`release-please-stable.yml`**: triggered by pushes to `master`. Uses release-please manifest mode with stable config (`release-please-config.json`) to open/update release PRs. When a release PR merges, creates GitHub Releases and publishes released packages to npm tag `latest` via OIDC trusted publishing (no npm tokens).

## Package-specific gotchas
- All packages publish modern CommonJS source directly. There is no transpile or `build/` artifact step for any package, except `@postr/plugin` which compiles from TypeScript (`packages/plugin/src/` → `dist/`) via `pnpm -r build` or the `prepare` lifecycle hook.
- Because these packages use `workspace:^` references, pnpm links them automatically during `pnpm install`. Source edits to JS-only packages are picked up immediately by workspace consumers via pnpm symlinks. For `@postr/plugin`, run `pnpm run build` or `pnpm --filter @postr/plugin build` to recompile after changing `.ts` source.

## Env and compatibility
- Local Node version is pinned to `24` in `.node-version` for Vite+ / `vp env`; `package.json` enforces `"node": ">=24"`.
- CI uses Node 24 with `pnpm/action-setup@v4` (see `.github/workflows/npm-prerelease.yml`).
- `config.json` is gitignored. `lib/config.js` also checks `MICROPUB_ENDPOINT_CONFIG` and `--config=...`, but the `require(configFile)` path is currently disabled, so runtime config effectively comes from the options object passed into `require('@postr/core')(options)`.

## Vite+ (`vp`) awareness
- `vp` (Vite+) is optionally available as a secondary orchestration layer. It delegates to pnpm and respects the same workspace configuration.
- Useful commands: `vp install`, `vp run <script>`, `vp exec <cmd>`, `vp pm pack -r -- --dry-run`.
- No root scripts depend on `vp` — all build, check, and test-server workflows use bare `pnpm`/`node` commands.
- Do not add a `vite.config.ts` unless the repo actually needs Vite+ config features such as `run`, `staged`, lint/test/pack config, or template defaults.
- The repo does not adopt Vite+ app-style conventions (no `vite.config`, no `vitest`, no `vp check` expectations) — it is a Node library monorepo, not a Vite app.

## Safe working assumptions
- `dangerousDevMode` and `dangerousPermanentToken` bypass normal token verification in `lib/middlewear/auth.js`; keep them confined to test/dev flows.
- Plugin routers are mounted under `/plugin/<id>` by the base plugin class.
- Follow the repo's existing Prettier style in `package.json` files: no semicolons, single quotes, trailing commas where valid in ES5.
