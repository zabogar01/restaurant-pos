# PHASE0-001 — Monorepo scaffold, PostgreSQL, migration runner

**Status:** Active
**Owner:** `builder1`
**Depends on:** the implementation gate, opened 2026-09-14

## Objective

Stand up the repository skeleton the other eleven Phase 0 tasks build inside:
npm workspaces, shared TypeScript configuration, a PostgreSQL 16 container for
development and tests, and a migration runner that applies ordered SQL files
and refuses to apply one twice. Nothing domain-specific. When this is done,
`npm run verify` runs and passes on an empty project, and a migration can be
written by the next task without inventing a mechanism for it.

This is **Task 1** of
[the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md).
Work only that task. Tasks 2 through 12 belong to other agents.

## Required inputs

| Input | Path | Why |
|---|---|---|
| The plan | [docs/superpowers/plans/2026-09-08-phase-0-foundations.md](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Task 1 names every file, interface, and test. Follow it rather than improvising an equivalent |
| The architecture | [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Approved 2026-09-10, standing since 2026-09-14. §3.1 is single-host and loopback-only |
| Accepted decisions | [docs/decisions/](../../docs/decisions/) | Seven ADRs. ADR-001 and ADR-002 bear on this task |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | 24 of them. B-1 and B-7 are reachable from this task |
| Requirements | [docs/PRD.md](../../docs/PRD.md) | `NFR-1` (loopback), `NFR-5` (two bundles) shape the scaffold |
| Process | [.agent/WORKFLOW.md](../WORKFLOW.md) | Handoff format, ownership, what needs the owner |

Environment on this machine, already checked by the lead: Node v25.2.1,
npm 11.6.2, Docker 28.3.2. No local `psql` — the container is the database, and
anything needing a client should go through it or through `pg`.

## Constraints

- **Follow the plan's file list and interfaces.** Where the plan names a path, a
  script name, or an export, use it. The eleven tasks after this one were
  written against those names.
- **No `number` for money or rates, anywhere, ever** (`B-1`). Nothing in this
  task handles money, but the scaffold's lint or type configuration should not
  make it easy to break later.
- **The audit table will be append-only** (`B-7`, Task 3). Do not create a
  database role or grant in this task that a later task has to take away.
- **Do not edit the contract documents** — `docs/PRODUCT.md`, `docs/PRD.md`,
  `docs/ROADMAP.md`, `docs/BOUNDARIES.md`. A finding against one is raised, not
  applied.
- **Do not edit `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** They are the
  lead's. Write your handoff in this file.
- **Do not edit `docs/ARCHITECTURE.md` or `docs/decisions/`.** They are the
  architect's, and they are accepted.
- **Test-first.** The plan is written as TDD tasks. A test that was written
  after the code it tests proves less than it appears to.
- **Commit only what this task covers**, on branch `agent/phase-0-foundations`,
  and never to `main`. Commit messages: ordinary prose, Conventional Commits
  form, explaining *why*.
- **The placeholder design tokens in the plan's Task 11 are superseded.** Not
  your task, but do not propagate them.

## Acceptance criteria

1. `npm run verify` passes from a clean checkout, and its output is quoted in
   your handoff. Not "should pass" — the actual output.
2. `npm run db:up` starts PostgreSQL 16 and `npm run db:migrate` applies the
   migration set in order.
3. Applying migrations twice is a no-op, proven by a test rather than by
   inspection.
4. A migration that fails leaves the database in the state it was in before it
   ran, and the runner says which file failed.
5. TypeScript compiles under the shared config with no `any` introduced by the
   scaffold itself.
6. Every file the plan's Task 1 names exists, or your handoff says why it does
   not.

## Out of scope

- Tasks 2 through 12 of the plan: money, schema, PIN, audit, throttling,
  sessions, the HTTPS server, auth routes, approval, client shells, acceptance
  tests. The scaffold makes them possible; it does not start them.
- Any domain table. Task 3 owns the schema.
- Design tokens and anything visual.
- Merging. Only the owner merges.

## Handoff

Written by `builder1`. Follow the format in
[WORKFLOW.md](../WORKFLOW.md#task-handoff-format): what was done with paths,
what was decided and on what evidence, what was found and not fixed, and what
the next agent needs and does not have. A handoff that says only "done" has
failed.

### 2026-09-14 — `builder1`, Task 1 finished

Three commits on `agent/phase-0-foundations`: `4520660` (scaffold as the plan
writes it), `01f3b23` (failed-migration attribution and rollback proof),
`21e13b9` (`npm run db:migrate` did nothing as written). Not merged.

#### What was done

| Path | What |
|---|---|
| `package.json`, `package-lock.json` | npm workspaces root. Scripts `db:up`, `db:migrate`, `test` as the plan names them, plus `test:unit`, `typecheck`, `verify` |
| `tsconfig.base.json` | Plan's options verbatim (`ES2022`, `strict`, `noUncheckedIndexedAccess`) |
| `docker-compose.yml` | `postgres:16` as `pos_owner`/`pos`, published on **`127.0.0.1:5433`**, with a `pg_isready` healthcheck |
| `apps/server/package.json`, `apps/server/tsconfig.json` | Plan's manifest verbatim. Resolved: `pg` 8.23.0, `tsx` 4.23.13, `typescript` 5.9.3, `vitest` 2.1.9 |
| `apps/server/src/db/pool.ts` | Plan's code verbatim: `getPool`, `query<T>`, `withTransaction<T>`, BIGINT kept as string |
| `apps/server/src/db/migrate.ts` | `runMigrations(dir): Promise<string[]>`, one transaction per file together with its `schema_migration` row. Two changes from the plan, below |
| `db/migrations/0001_extensions.sql` | `CREATE EXTENSION IF NOT EXISTS pgcrypto;` |
| `apps/server/test/migrate.test.ts` | 7 tests: the plan's two, plus failure attribution, failure rollback, record atomicity, and the real `npm run db:migrate` script succeeding and failing |
| `.gitignore` | **Unchanged.** Commit `e6120f0` already holds every line the plan's Step 4 asks for |

Every file Task 1 names exists (acceptance 6).

#### What was decided, and on what evidence

- **Postgres binds loopback, not every interface.** The plan writes
  `ports: ["5433:5432"]`, which publishes on `0.0.0.0`. `docs/ARCHITECTURE.md`
  §3.1: "PostgreSQL is reachable only from the same host or a private local
  container network, never from the LAN." Accepted architecture beats plan
  text. Evidence: `docker compose ps` shows `127.0.0.1:5433->5432/tcp`.
- **`verify` exists now, as `npm run typecheck && npm run test:unit`.** This
  task's acceptance 1 requires it; the plan only defines it in Task 12 Step 7.
  `typecheck` is in it because acceptance 5 requires compilation and vitest
  does not type-check.
- **`db:up` is `docker compose up -d --wait`.** Without waiting on the
  healthcheck, `npm run db:up && npm run db:migrate` races container start.
- **The runner's error names the file** —
  `migration 0009_bad.sql failed and was rolled back: relation "nope" does not exist`,
  original error kept as `cause`. The plan's code surfaced only PostgreSQL's
  message (acceptance 4). Seen red before the change.
- **`npm run db:migrate` was silently broken as written; fixed.** It printed
  npm's banner and exited 0 having done nothing. Cause 1: the guard compared
  percent-encoded `import.meta.url` with hand-built `file://${argv[1]}`, and
  this checkout's path contains a space (`POS System`). Now uses
  `pathToFileURL`. Cause 2: `npm run -w apps/server` runs with cwd
  `apps/server`, so the default `db/migrations` pointed nowhere. Default is now
  anchored to the module file; an explicit path argument resolves against
  `INIT_CWD`. Both reproduced by a failing test before the fix.
- **Tests were mutation-checked, not just run green.** Removing the
  already-applied skip turns the idempotency test red (acceptance 3). Moving
  the migration SQL outside the transaction did **not** turn the plain
  rollback test red — PostgreSQL runs a multi-statement string as one implicit
  transaction — so a further test has the file's SQL succeed and only its
  `schema_migration` insert fail. That one goes red without the transaction.
- **No `any` in scaffold sources.** `grep -rnw any apps/server/src
  apps/server/test tsconfig.base.json` returns nothing. `query<T>` casts from
  `pg`'s `any[]` rows, as the plan's interface requires.
- **No database role or grant created** (B-7 constraint). Only `pos_owner`,
  from the image environment.

#### Verification, verbatim

Fresh `git clone` of `21e13b9` into a path containing a space, Docker volume
removed first (`docker compose down -v`), then `npm ci`, `npm run db:up`,
`npm run db:migrate` (printed `applied: 0001_extensions.sql`), then:

```
> verify
> npm run typecheck && npm run test:unit


> typecheck
> tsc -p apps/server --noEmit


> test:unit
> vitest run


 RUN  v2.1.9 /private/tmp/claude-501/-Users-fajars-Work-Dev-POS-System-restaurant-pos/e07bd479-f802-4526-95a0-957d17f0559d/scratchpad/clean checkout/restaurant-pos

 ✓ apps/server/test/migrate.test.ts (7 tests) 767ms
   ✓ runMigrations > npm run db:migrate > applies the repository migrations when run from the repository root 372ms
   ✓ runMigrations > npm run db:migrate > exits non-zero and names the failing file 309ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  15:43:11
   Duration  1.04s (transform 30ms, setup 0ms, collect 37ms, tests 767ms, environment 0ms, prepare 43ms)

verify exit=0
```

Same result in the working tree. `SELECT version()`: `PostgreSQL 16.15`.
Running `db:migrate` twice printed `applied: 0001_extensions.sql` and then
`no pending migrations`, both exit 0. Not skipped: nothing.

#### Found and not fixed

1. **Parallel test files will race on one database.** Vitest runs files in
   parallel by default. This file's `beforeEach` and Task 3's `beforeAll`
   both run `DROP SCHEMA public CASCADE`. **Demonstrated, not predicted:** a
   throwaway second file with Task 3's `beforeAll` shape, run with
   `npx vitest run` five times, broke all five runs. Once it was
   `14 failed | 13 passed (27)`. Four times it was `7 passed | 20 skipped (27)`,
   meaning the probe's setup died. The probe was deleted and never committed.
   There is no plan-named fix, so I did not invent one. Candidates: a root `vitest.config.ts` with
   `fileParallelism: false` for server tests, or a database per worker.
   **Needs a decision before Task 3 lands.**
2. **The pool's default role is a superuser.** `pool.ts` defaults to
   `pos_owner`, which is `POSTGRES_USER` and a superuser (`pg_roles.rolsuper`
   = `t`, checked). Superusers
   bypass grants, so a B-7 test in Task 3 that goes through `query()` proves
   nothing. The plan's Task 4 `config.ts` defaults to `pos_app`, but `pool.ts`
   does not read config. The grant test must connect as `pos_app`.
3. **Tests and development share one database.** Running tests drops the
   `public` schema. Acceptable today, with no data worth keeping.
4. **Task 12 Step 7 says to *replace* the root `scripts` block.** Done
   literally, that drops `typecheck` from `verify` and deletes `test`. It
   should extend the scripts instead.
5. **`npm audit`: 5 vulnerabilities (3 moderate, 1 high, 1 critical)**, all in
   the `vitest` 2.x → `vite` → `esbuild` dev-server chain. Dev-only, never
   shipped. The fix is `vitest` 4, a major upgrade past the plan's `^2.1.0`,
   so it is the lead's call.
6. **Nothing guards B-1 mechanically.** The plan names no linter, so none was
   added. A `number`-for-money lint rule would need a decision on ESLint.
7. **Node 25.2.1 is not LTS.** `docs/ARCHITECTURE.md` says Node.js LTS; the
   plan's `@types/node` is `^22`. Everything passed on 25. No `engines` field
   was added.

#### What the next implementer needs and does not have

- **To write a migration:** add `db/migrations/NNNN_name.sql`. It runs in one
  transaction with its record. Do not put `BEGIN`/`COMMIT` in the file — that
  breaks the atomicity.
- **Order of operations:** `npm run db:up` → `npm run db:migrate` →
  `npm run verify`. Tests call `runMigrations('db/migrations')`, which is
  relative to the repository root, where vitest runs.
- **Docker Desktop was not running** at session start, despite `docker
  --version` working. `open -a Docker` fixed it.
- **Items 1 and 2 above**, before anyone writes a second database test file.
- **Task status still reads `Active`.** Moving it is the lead's call.
