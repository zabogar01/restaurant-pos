---
id: PHASE0-003b
title: Serial server tests on their own database, and an application pool that is not a superuser
category: feature
touches: [audit, identity]
depends_on: []
owns: [vitest.config.ts, package.json, package-lock.json, docker-compose.yml, db/dev.env, scripts/**, apps/server/**]
status: not-started
cycles: 0
---
# PHASE0-003b — Test harness and database roles

**Written** 2026-10-05 by the lead, from the architect consult ARCH-006
(`.agent/reviews/ARCH-006-phase0-core-schema.md`, sections 2 and 3, and *Rules for
PHASE0-003b*). Second of three slices of Phase 0 Task 3. It creates **no table**; 003c, the
schema, is cut from this branch once it is merged.

## Objective

Two defects make every later database test unreliable or meaningless. First, vitest runs test
files in parallel, and each server test file drops and rebuilds the one database's `public`
schema, so a second server file races the first (Task 1's builder reproduced it failing five
runs in five); the same race runs across worktrees, and the tests erase the development
database `pos`. Second, the server's pool connects as `pos_owner`, a superuser, so the
append-only grants that B-7 rests on would never be exercised by the application or its tests.
When this task is done, server test files run one at a time on a database of their own, one
verify at a time across worktrees; the application pool connects as a provisioned,
unprivileged `pos_app`; only the migration runner holds the owner connection; and no credential
is in source or in a migration.

## Required inputs

- ARCH-006 sections 2 and 3, and *Rules for PHASE0-003b* (the report's lines 763-794). This file
  restates those rules; where they differ, this file wins.
- Today's code: `apps/server/src/db/pool.ts` (owner default at `:16`; BIGINT kept as a string,
  which stays), `apps/server/src/db/migrate.ts` (`runMigrations` uses `query` and
  `withTransaction` from the pool), `apps/server/test/migrate.test.ts` (drops the schema through
  `query()` before each case), `apps/server/package.json`, root `package.json` (`db:up`,
  `db:migrate`, `test`, `verify`; no vitest config file), `docker-compose.yml` (owner
  `pos_owner` / `devpassword`, database `pos`, `127.0.0.1:5433`), `db/migrations/0001_extensions.sql`.
- `docs/ARCHITECTURE.md` §11 (separate migration and application roles), §14.2 and §14.4
  (real PostgreSQL; separate owner and application roles so privileges are exercised locally;
  isolated test fixtures). `docs/BOUNDARIES.md` B-7.
- `.gitignore` ignores `.env` and `.env.*`; the committed development file is therefore
  `db/dev.env`.

## What to build

1. **Serial server tests (lead ruling, from ARCH-006 §2).** Any vitest run from the repository
   root that includes a server test runs the server test files one at a time, after the server's
   global setup: `npm run verify`, `npx vitest run`, and `npx vitest run apps/server/test/<file>`
   alike. The client's tests keep running in parallel with exactly today's settings.
   Preferred: one root `vitest.config.ts` with `test.projects`: a `server` project
   (`apps/server/test/**`, `fileParallelism: false`, a `globalSetup`) and a project for
   everything else configured as today's defaults. Fallback, only if vitest 4.1 does not honour
   per-project `fileParallelism`: two chained vitest invocations in the npm scripts; say in the
   Handoff why. No `describe.concurrent` or `test.concurrent` in a server test.
2. **Global setup for the server project**, in order: take a session-level PostgreSQL advisory
   lock on a dedicated owner connection and hold it until teardown (a second verify, from any
   worktree, waits its turn); run the provisioning step; point the run at database `pos_test`.
   The development database `pos` is never touched by a test.
3. **The provisioning step** (development and test tooling, under `scripts/` or
   `apps/server/scripts/`, never imported by `apps/server/src`): idempotent; connects as the
   owner; creates `pos_app` if absent and on every run sets it to `LOGIN NOSUPERUSER NOCREATEDB
   NOCREATEROLE NOREPLICATION NOBYPASSRLS` with its password from the environment; creates
   database `pos_test` if absent. It runs from `npm run db:up` (after the container is healthy)
   and from the global setup. `CREATE ROLE ... PASSWORD` takes no bind parameter: quote the
   password with the driver's literal-escaping function, never by concatenation. No Compose
   init script (it runs only on a fresh data volume, and the owner's volume already exists).
4. **The pool split.** `getPool`, `query` and `withTransaction` connect from `DATABASE_URL`, as
   `pos_app`. The migration runner connects from `MIGRATION_DATABASE_URL`, as the owner, through
   its own connection, and creates `schema_migration` there. **Neither variable has a fallback
   in source: unset is an error that names the variable.** No module under `apps/server/src`
   other than the migration runner can reach the owner connection. `npm run db:migrate` keeps
   working against `pos`.
5. **Credentials.** None in `db/migrations/` or `apps/server/src/`. Development values (owner
   URL, `pos_app` password, both connection URLs for `pos`, and the test database name) live in
   one committed file, `db/dev.env`, read by Compose, the npm scripts and the vitest setup. Its
   first lines say it configures a throwaway loopback-only development database and nothing
   else. A fresh worktree must pass `npm run verify` after `npm run db:up` with no manual step.
6. **Test support.** A module under `apps/server/test/` that gives a test an owner connection
   and `resetDatabase()` (drop and recreate schema `public` through the owner connection, then
   run the real `db/migrations`). Tests reset with it and never with `DELETE`.
7. **`migrate.test.ts`.** The only permitted edits: its schema drop and its reads of
   `schema_migration` go through the owner connection (once `query()` is `pos_app`, `DROP
   SCHEMA` through it fails, as it should). Every assertion stays, unweakened.

Put these facts to the librarian (`.agent/bin/ask.sh librarian "<question>"`) before writing,
and cite the answers in the Handoff: per-project `fileParallelism` and `sequence.groupOrder` in
vitest 4.1; per-project `globalSetup` and `env`; whether a session-level advisory lock held by
a global setup survives until teardown; literal-escaping for `CREATE ROLE ... PASSWORD` in `pg`;
whether `tsx` passes `--env-file` through (or how `db:migrate` should load `db/dev.env`).

## Tests expected to change

- `apps/server/test/migrate.test.ts`: only the connection its schema drop and its
  `schema_migration` reads use (item 7). Any other test that changes: stop and raise it.

New tests (in `apps/server/test/`):

- the application pool's `current_user` is `pos_app`, it is not a superuser, cannot create a
  role or a database, and has no `CREATE` on schema `public`;
- `getPool()` (or `query()`) with `DATABASE_URL` unset throws an error naming it; the migration
  runner with `MIGRATION_DATABASE_URL` unset likewise;
- the provisioning step run twice in a row succeeds both times;
- the race reproduction: a second server test file of `migrate.test.ts`'s shape (reset in
  `beforeEach`, then assert on what the migrations created). It stays in the suite as the
  harness's own regression test.

## Constraints

- **No table and no migration in this task.** `db/migrations/` is not in `owns:`.
- No credential, password or connection string with a password in `apps/server/src/`, in
  `db/migrations/`, or in a test file; tests read them from the environment the setup loads.
- Do not weaken any assertion in `migrate.test.ts`. Do not touch `apps/pos/` or `packages/`.
- Do not change how the client tests run: same files, same environment, same counts.
- B-7: nothing here may give `pos_app` more than it needs; it gets no privilege in this task
  beyond `LOGIN` (the grants arrive with 003c's tables).
- Fail closed: a server or test started with a missing variable stops with a clear error; it
  never connects as whatever a default names.

## Acceptance criteria

1. Ten consecutive `npm run verify` runs are green with the race reproduction file beside
   `migrate.test.ts`. The Handoff shows the ten exit codes. Red on any failure.
2. The client's test-file and test counts reported by vitest are identical before and after the
   configuration change (2726 tests in 41 files on `e9d5b96`, after PHASE0-003a, plus only this
   task's new server tests). The Handoff shows both counts.
3. `npx vitest run apps/server/test/migrate.test.ts` alone also runs the global setup and is green.
4. After a green verify, database `pos` is unchanged: the Handoff shows `schema_migration` in
   `pos` before and after (or that it did not exist and still does not).
5. Two `npm run verify` runs started at the same moment from two worktrees (or two shells in this
   worktree) both pass; the Handoff shows the second waited.
6. The `pos_app` test above passes, and `grep -rn "devpassword\|apppassword\|postgres://" apps/server/src db/migrations`
   returns nothing.
7. `npm run db:up` from a clean shell provisions `pos_app` and `pos_test`, and `npm run db:migrate`
   applies `0001_extensions.sql` to `pos` as the owner.

## Out of scope

- Any table, grant or migration (003c). The `Rate` brand (003a).
- `config.ts`, the HTTPS server and anything else in plan Tasks 4 to 12.
- A non-superuser owner distinct from `pos_owner` (pre-production gate).

## Handoff

*(Written by the builder.)*
