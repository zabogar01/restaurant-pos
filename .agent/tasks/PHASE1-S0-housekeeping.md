---
id: PHASE1-S0
title: One development database from any checkout, and a server that refuses a schema out of step with db/migrations
category: feature
touches: []
depends_on: []
owns: [docker-compose.yml, db/migrations/0009_*.sql, apps/server/src/index.ts, apps/server/src/db/**, apps/server/test/schema.test.ts, apps/server/test/schema-check.test.ts]
status: complete
cycles: 0
---
# PHASE1-S0 — Housekeeping before Phase 1's migrations

**Written** 2026-10-20 by the lead, from slice S0 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S0*, accepted by the owner 2026-10-20) and the
architect's Handoff in `.agent/tasks/ARCH-017-phase-1-plan.md` (*What the lead needs to write the first task file*). The
plan says no consult is needed; the decisions it leaves open are the lead rulings below.

## Objective

Two things become true. First, `docker compose` names its project explicitly, so a clone or worktree in a directory of
any name reaches the one development database container and volume instead of creating its own. Second, the server
refuses to start, before it opens any socket, when the set of migrations recorded in the database differs from the set
of `.sql` files in `db/migrations`, with a fixed sentence that tells the operator what to do. Phase 1 adds about eight
migrations across parallel worktrees; without the check a stale schema shows up only as `INTERNAL` on first use
(ARCH-010, Task 8 consult).

## Required inputs

- **The compose file** (`docker-compose.yml`) has no top-level `name:`, so Compose derives the project from the directory
  name. The owner's running container is `restaurant-pos-db-1`, project label `restaurant-pos`, and its volume is
  `restaurant-pos_pgdata` (the lead checked with `docker ps` and `docker volume ls`, 2026-10-20). A checkout in
  `../restaurant-pos-wt/<ID>` or a fresh clone under another name would otherwise create a second container fighting
  for port 5433.
- **The migration runner** (`apps/server/src/db/migrate.ts`). It is the only module that holds the owner connection
  (`MIGRATION_DATABASE_URL`). It creates `schema_migration (filename text PRIMARY KEY, applied_at timestamptz)` if
  absent, lists `readdir(dir).filter(f => f.endsWith('.sql')).sort()`, and applies each file not yet recorded, one
  transaction per file. Its default directory is anchored to the source file
  (`new URL('../../../../db/migrations', import.meta.url)`), not to the working directory. It stores no checksum.
- **The startup sequence** (`apps/server/src/index.ts`, `main()`): 1 configuration, 2 the pepper, 3 the certificate
  (`loadTls`), 4 the database (`SELECT 1` as `pos_app`, refusing with a `StartupError`), 5 `buildServer` then
  `listenLoopback`. In-process server tests call `buildServer` directly and never run `main()`.
- **The privilege, and why S0 needs a migration.** The server connects as `pos_app`. `pos_app` has no privilege on
  `schema_migration` today: ARCH-006 prescribed it (`.agent/reviews/ARCH-006-phase0-core-schema.md:1011-1014`) and
  `apps/server/test/schema.test.ts:164-170`, case 1, asserts
  `expect(actual.schema_migration).toEqual({ table: [], columns: {} })`. ARCH-010's Task 8 consult
  (`.agent/reviews/ARCH-010-https-server.md:660-664`) declined the check in Phase 0 for exactly this reason and called it
  "a gap worth closing with a small migration later". This is that migration. Neither ADR nor `docs/ARCHITECTURE.md`
  says anything about `schema_migration`'s grants (the lead's grep).
- **ADR-010 rule 2** (`docs/decisions/ADR-010-http-boundary.md:163-170`): "The server defines a small, closed set of its
  own startup and configuration errors, whose sentences an operator has to be able to read … Such a sentence may be
  logged only because it is fixed wording in the server's source combined with values that are neither secrets nor
  taken from a request: a variable's name, a file path, a refused bind address. A value read from the environment or a
  file is never among them." The new refusals join that set.
- **The browser harness** (`e2e/support/global-setup.ts:85-130`) resets its own database with the real migrations
  (`resetE2eDatabase`), then spawns `apps/server/src/index.ts` with no `MIGRATION_DATABASE_URL`, and fails if the server
  exits during start-up. That run is the end-to-end proof that the check accepts a fully migrated database.
- **Server tests** run serially on `pos_test` (`resetDatabase()` drops the schema and runs the real migrations through
  the owner connection; `ownerQuery` reads as the owner). They need `npm run db:up` first and `openssl` on `PATH`.

## Lead rulings

1. **The project name is `restaurant-pos`**, as a top-level `name: restaurant-pos` in `docker-compose.yml`. It matches
   the running container and volume, so the owner's data is untouched and every checkout shares one container, which
   the Phase 0 race design assumes. Change nothing else in the file.
2. **Migration `0009` grants `pos_app` `SELECT` on `schema_migration`, and nothing else** (no `INSERT`, `UPDATE`,
   `DELETE`, `TRUNCATE`, no sequence). The application may read which migrations were applied; it can never record or
   erase one, so the separation in ARCHITECTURE §11 stands. Name it `0009_schema_migration_read.sql` (or a name in the
   same style), with a header comment saying why, in the manner of the existing migrations. `schema_migration` exists by
   the time any migration runs, because the runner creates it first. This amends ARCH-006's case 1 as ARCH-010
   anticipated; it is a lead ruling the owner may overturn.
3. **"Differ" is a comparison of file names as sets.** The schema is out of step when (a) a `.sql` file in
   `db/migrations` has no row in `schema_migration` ("behind"), or (b) a row in `schema_migration` has no file
   ("ahead"). Use the runner's own listing rule (`.sql` suffix only), so the two can never disagree about what counts as
   a migration: share it through a small module both import, not a copy. Content is not compared; the runner stores no
   checksum, so a file edited after it was applied is not detected. Say so in the Handoff; do not add checksums.
4. **When `pos_app` cannot read the table** (`42501` permission denied, or `42P01` undefined table), the database is
   behind by definition (it predates `0009`, or was never migrated): refuse with the "behind" sentence. Any other error
   from the check is not caught by the check; it reaches `main()`'s existing fatal path and the safe serializer.
5. **Two fixed sentences, no values.** Behind: `the database is missing migrations that are in db/migrations; run npm
   run db:migrate`. Ahead: `the database has migrations that are not in db/migrations; this checkout is older than the
   database`. When both hold, use the "ahead" sentence, because migrating will not fix it. Neither sentence names a
   file, a count or a database name (rule 2: a value read from a file or the environment is never among them). Both are
   `StartupError`s, so `log.ts` prints exactly the sentence.
6. **Where it runs.** In `main()` only, as part of step 4: after the `SELECT 1`, before `buildServer` and before any
   socket; so after the certificate check, as the plan says. Not in `buildServer` and not in a Fastify hook, so the
   in-process tests are unaffected. Through `query()` as `pos_app`; **the server never reads `MIGRATION_DATABASE_URL`
   and never imports a code path that does.** The directory is anchored to the source file as the runner's default is,
   never to the working directory and never to an environment variable.
7. **No new environment variable, no new route, no change to `/api/health`.** Health keeps answering `SELECT 1` only.

## Rules

- Touch only the paths in `owns`. If you need another file (a test helper under `apps/server/test/support/`, for
  instance), stop and write `BLOCKED: <question>` in the Handoff.
- Red first: write the check's tests and the `schema.test.ts` change, run them against the unchanged code and record
  the failing assertions and lines in the Handoff; then write the code.
- Do not run `npm run db:migrate` against the development database `pos`; the lead applies `0009` there after the merge
  and does the hand check. Your proof is the server tests on `pos_test` and the harness's own database.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/server/test/schema.test.ts:164-170`, case 1: the title ("…and none on schema_migration") and the assertion on
  `actual.schema_migration` change to say `pos_app` has exactly table-level `SELECT` on it and nothing else. Report the
  exact shape the privilege query returns (whether `columns` stays empty for a table-level grant) and assert that shape
  exactly; do not loosen it to a subset. The rest of case 1, and every other case, is unchanged.
- **New:** `apps/server/test/schema-check.test.ts`, the check's own tests (below).
- No other existing test should change. `migrate.test.ts` uses temporary directories and the owner connection;
  `harness-race.test.ts`'s table list is unchanged because `0009` creates no table. If either fails, stop and say so.

## Acceptance criteria

1. `docker-compose.yml` has `name: restaurant-pos` and no other change. (The lead runs `docker compose --env-file
   db/dev.env config` from the worktree and checks it prints `name: restaurant-pos`; you need not run Docker.)
2. `0009` grants `SELECT` on `schema_migration` to `pos_app` and nothing else; `schema.test.ts` case 1 asserts exactly
   that, and the red run before the migration existed is recorded.
3. The check, run against `pos_test` after `resetDatabase()`, with the real `db/migrations` passes; with a temporary
   directory holding the real files plus one more it refuses with the "behind" sentence; with one real file missing it
   refuses with the "ahead" sentence; with both differences, the "ahead" sentence; after the test revokes `pos_app`'s
   `SELECT` through the owner connection (or drops the table), the "behind" sentence. Each refusal is asserted as a
   `StartupError` with the exact sentence. The red run is recorded.
4. `main()` runs the check after `SELECT 1` and before `buildServer`; `grep -n MIGRATION_DATABASE_URL
   apps/server/src` shows it only in `migrate.ts`.
5. `npm run verify` green. The baseline is 93 test files and 3744 tests (lead's verify at `44a6497`; only documents
   changed since); the Handoff states the new counts and which tests were added.
6. `git diff --name-only development...HEAD` shows only the task file and paths in `owns`.

The lead runs `npm run test:e2e:all` before merge (the change touches `db/migrations`), which proves the check accepts
the harness's fully migrated database, and then applies `0009` to the development database and checks that the server
refuses before `db:migrate` and starts after it.

## Out of scope

- Running migrations from the server, or at startup in any form (ARCH-010: migrating stays a deliberate command).
- Checksums or content comparison of migration files.
- Any Phase 1 table, route or screen; `AGENTS.md` and the lead's notes (the lead updates them after the merge).
- The `npm ci` install-script warnings and the npm advisory (known, separate).

## Commit and report

Commit on `agent/phase1-s0` only, after verify is green, and never push. Conventional Commits, explaining why. Write the
Handoff below in full prose, ending with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as
AGENTS.md says.

## Lead verify (2026-10-20)

At `5191bf9`, in this worktree. `git diff --name-only development...HEAD`: the task file and owned paths only; the one
changed existing test is `schema.test.ts` case 1, as listed. `npm run verify`: 94 files, 3753 tests, green.
`docker compose --env-file db/dev.env config` prints `name: restaurant-pos`. `npm run test:e2e:all`: 58 passed (44.9 s),
so the harness server starts through the check on a fully migrated database. Hand check: this worktree's server against
the development database `pos` (0001-0008, no `0009`) exits 1 with the StartupError "the database is missing migrations
that are in db/migrations; run npm run db:migrate" (the 42501 path). `db:migrate` on `pos` and the start after it wait
for the merge. Sent to review: a migration and about 350 changed lines.

## Review and lead ruling (2026-10-20)

Codex `gpt-6-astra` reviewed `68a6909` (`.agent/reviews/PHASE1-S0-review.md`): no code findings; every ruling and
acceptance criterion cleared by inspection. Its verdict is `blocked` only because its sandbox refuses TCP to
`127.0.0.1:5433` (`EPERM`), so its `verify` produced no test results; a known limit of the reviewer environment, not of
the work. **Lead ruling:** the review stands as clear; the runtime evidence is the lead's verify note above (94 files,
3753 tests; `test:e2e:all` 58; the refusal hand check), run on this same tree. No fix round. Complete.

## Handoff

**What I did.** (1) `docker-compose.yml` now starts with `name: restaurant-pos`; nothing else changed. (2) New migration
`db/migrations/0009_schema_migration_read.sql` grants `SELECT` on `schema_migration` to `pos_app` and nothing else, with a
header comment saying why. (3) New `apps/server/src/db/migration-files.ts` holds the one listing rule
(`listMigrationFiles`: `.sql` suffix, sorted) and `defaultMigrationsDir()` (anchored to the source file); `migrate.ts` now
imports both instead of its own copies, so runner and check cannot disagree. (4) New `apps/server/src/db/schema-check.ts`
exports `assertSchemaCurrent(dir = defaultMigrationsDir())`. It reads `schema_migration` through `query()` as `pos_app`
and compares file names as sets. Recorded-but-no-file throws `StartupError` with the "ahead" sentence (checked first, so it
wins when both hold); file-but-no-row throws the "behind" sentence. A `42501` or `42P01` from the read throws the "behind"
sentence; any other error is rethrown untouched. Both sentences are exactly the wording in ruling 5, with no values.
(5) `main()` in `index.ts` calls `assertSchemaCurrent()` right after the `SELECT 1` block and before `buildServer`. Not in
`buildServer`, no new variable, no route change, health untouched.

**Red first.** Before any source existed I ran `schema.test.ts` and the new `schema-check.test.ts`. `schema.test.ts:167`
failed: `expected { table: [], columns: {} } to deeply equal { table: [ 'SELECT' ], columns: {} }`; `schema-check.test.ts`
failed to load: `Cannot find module '../src/db/schema-check.js'`. After the code, all green. I also mutated the guard
(swapped the order of the two checks so "behind" is tested first) and `uses the ahead sentence when both differences hold`
failed with the behind sentence received; reverted.

**Tests changed.** Only `apps/server/test/schema.test.ts` case 1: the title now says "and only SELECT on schema_migration",
and the assertion is `toEqual({ table: ['SELECT'], columns: {} })`. The privilege query returns `columns: {}` for a
table-level grant (the helper skips column privileges the table grant already covers), so the shape is asserted exactly,
not loosened. Added `apps/server/test/schema-check.test.ts`, 9 tests: passes on the real directory (default and explicit),
behind (extra file), ahead (file removed), both differences gives ahead, a non-`.sql` extra file is ignored, `REVOKE SELECT`
gives behind (42501), `DROP TABLE schema_migration` gives behind (42P01), and a renamed column surfaces the raw `42703`
error, not a `StartupError`. Each refusal asserts `StartupError` and the exact sentence.

**Verify.** `npm run verify` green: typecheck clean, 94 test files and 3753 tests passed (baseline 93 and 3744: one new
file, nine new tests). `git diff --name-only development...HEAD` shows only the task file and owned paths.

**Found, not fixed.** `grep -n MIGRATION_DATABASE_URL apps/server/src` also matches a comment in `pool.ts:22`, besides
`migrate.ts`; no code path outside `migrate.ts` reads it. The check does not detect a migration file edited after it was
applied (the runner stores no checksum), as ruling 3 says; no checksums added. I did not run Docker, `db:migrate` on the
development database `pos`, or `test:e2e`; the lead does those after the merge. No formatter was run; I wrapped no files
by hand beyond matching style (`schema-check.ts` has one long `recorded = new Set(...)` line, as `index.ts` already has).

**Next agent needs.** Nothing missing. The lead should confirm `docker compose --env-file db/dev.env config` prints
`name: restaurant-pos`, run `npm run test:e2e:all`, apply `0009` to `pos`, and confirm the server refuses before
`db:migrate` and starts after it.

DONE
