---
id: PHASE1-S1a
title: Tables on the server — the dining_table record, its four commands and list, and the five back-office routes (plan S1a, consult C2)
category: feature
touches: [boundaries]
depends_on: [PHASE1-S0]
owns: [db/migrations/0010_dining_table.sql, apps/server/src/domain/dining-table.ts, apps/server/src/http/routes/back-office-tables.ts, apps/server/src/http/server.ts, packages/contracts/src/tables.ts, packages/contracts/src/routes.ts, packages/contracts/src/errors.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/back-office/src/session/api.ts, apps/back-office/src/session/realSession.ts, apps/pos/src/session/realSession.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: complete
cycles: 1
---
# PHASE1-S1a — Tables on the server

**Written** 2026-10-20 by the lead, from slice S1 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S1*) and **consult C2**
(`.agent/reviews/ARCH-019-first-back-office-form.md`, merged 2026-10-20 as PR #116). The consult's *For the lead, S1a*
section is copied below verbatim, followed by the three sections it relies on. Read the whole consult once; where this
file and the consult differ, stop and ask.

## Objective

A manager can create, rename, deactivate and reactivate dining tables, and list them, through five new back-office
routes, against a new `dining_table` record that starts empty. No screen yet: S1b builds BO-05 on these routes. This
slice also sets the server half of the pattern every later configuration slice copies (ids in `POST` bodies, a record
answered from every command, the generic `DUPLICATE` refusal, one locking read before a decision).

## Decided: do not reopen

- **Owner, 2026-10-20 (DECISIONS):** tables may be **reactivated**; a table has **no seat count** (Q10; PRD FR-B2 now
  reads "Manage tables: create, edit, deactivate and reactivate."). The refusal to deactivate a table holding an open
  order (FR-C8, AC-32's second sentence) arrives with orders in **Phase 2** (Q13). User-management changes are audited;
  **nothing else in Phase 1 is**, tables included (Q11).
- **ARCHITECTURE §8** (amended with ADR-012, accepted 2026-10-20) now states the lock order catalog row → BusinessDay →
  **DiningTable** → Order → CheckoutLease and ReceiptSeries, and that "opening a table order, and deactivating,
  reactivating or renaming a table, lock the DiningTable row before reading its state".
- **ADR-010 rule 1:** a code enters `@pos/contracts` in the task that first emits and tests it: `DUPLICATE` enters here.
  **ADR-010 rule 2:** no PostgreSQL error text is logged or copied. **ADR-011 rules 1, 9, 16:** routes declare `access`
  with no default `interactive`; one validation helper, `VALIDATION_FAILED` with no details; requests addressed by
  route-table entry, fixed-string paths.
- **Lead ruling (C2 §3, *Area*):** no area column. The migration is `0010` (S0 added `0009`).

## From consult C2, *For the lead* — S1a (verbatim)

- **Touches:** `boundaries` (FR-A2c: five new back-office route declarations; B-24: an empty table
  after migration; B-20: one transaction per command, nothing written on a refusal). Not
  `identity`: the guard, the session and the credential domain are untouched. The browser suite
  runs before merge (rule 27: a migration, the contracts and the HTTP layer).
- **Depends on:** S0 merged (the migration-on-disk check), this consult. Not on E1.
- **Owns** (globs): `db/migrations/<next>_dining_table.sql`; `apps/server/src/domain/dining-table.ts`;
  `apps/server/src/http/routes/back-office-tables.ts` and its registration in
  `apps/server/src/http/server.ts`; `packages/contracts/src/tables.ts`, `routes.ts`, `errors.ts`,
  `index.ts`; `packages/api-client/src/specs.ts` and `client.ts` (`ROUTES` names only);
  `apps/back-office/src/session/api.ts` (the five functions, declared, not called by any screen);
  the `DUPLICATE` case in `apps/back-office/src/session/realSession.ts` and
  `apps/pos/src/session/realSession.ts` (placed in each switch's general-failure group);
  `apps/server/test/**`, `packages/contracts/test/**`, `packages/api-client/test/**`.
- **Scope.**
  1. Migration: `dining_table` (`id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `label text NOT
     NULL`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT
     now()`), the label check constraint of section 4, the partial unique index
     `dining_table_active_label_key ON dining_table (lower(label)) WHERE is_active`, and the grants
     in the same file: `SELECT, INSERT` on the table and `UPDATE (label, is_active)` only; no
     `DELETE`. No row is inserted.
  2. Contracts: `TableView` (`{ tableId, label, isActive }`, strict); the four request schemas
     (`create { label }`, `update { tableId, label }`, `deactivate { tableId }`,
     `reactivate { tableId }`, strict, no transforms, no custom messages, `tableId` as `z.uuid()`,
     the label rule of section 4 as one shared schema value); the two response schemas
     (`{ table }`, `{ tables }`); the five route-table entries of section 1; `DUPLICATE` (409) with
     no details, in `ErrorCode`, the `ErrorBody` union and its completeness check.
  3. Domain: create, update, deactivate, reactivate and list, each one transaction. Update,
     deactivate and reactivate start with the one locking read (`lockDiningTable`); a missing row
     is `NOT_FOUND`; a command that would change nothing writes nothing and answers the record; a
     unique violation on `dining_table_active_label_key` is `DUPLICATE`, any other is a fault; the
     PostgreSQL error is never logged or copied. No audit entry (owner's Q11).
  4. Routes: the five, each `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }` (list
     `false`, commands `true`), parsing with the existing `parseBody` unchanged, answering
     `{ table }` or `{ tables }`.
  5. The compile-forced client lines: `SPECS` entries, `ROUTES` names, the five back-office API
     functions, and `DUPLICATE` in both clients' general-failure groups. No screen.
- **Acceptance criteria, each with its red proof** (the builder reverts each and says so):
  1. The route table equals the registered routes and each route's `interactive` equals its
     declaration (`route-table.test.ts`, data-driven, unedited). *Red:* remove one new entry from
     `ROUTE_TABLE`: case 8 fails.
  2. No `ROUTE_TABLE` path contains `?`, `#` or `:` (new contracts test). *Red:* append `?x` to
     one path: the test fails (and so does the equality test, which is expected).
  3. Each new route refuses a request with no back-office cookie or with a POS session's token in
     it (401 `UNAUTHENTICATED`), a back-office session whose user is no longer a manager (403
     `FORBIDDEN`), and, on the four `POST`s, a missing or wrong anti-CSRF header (403
     `CSRF_REFUSED`) with nothing written. One loop over the new entries. *Red:* declare one
     command `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: the loop's no-cookie case fails
     (and `access.test.ts` case 7's explicit list, which is expected).
  4. `dining_table` is empty after migration, and `pos_app` has exactly `SELECT, INSERT` and
     `UPDATE (label, is_active)` on it; a `pos_app` `DELETE` and an `UPDATE` of `id` or
     `created_at` are refused (`schema.test.ts`, the privilege map and new cases;
     `harness-race.test.ts`'s table list). *Red:* add `DELETE` to the grant: case 1 fails.
  5. Create, rename and reactivation each answer `DUPLICATE` (409, body exactly
     `{ "error": { "code": "DUPLICATE" } }`) when an active table holds the label in any case, and
     write nothing (the table's rows are unchanged). Two inactive tables may share a label, and an
     inactive table may be renamed to a label an active table holds. *Red:* create the index on
     `label` instead of `lower(label)`: the case-variant test fails.
  6. Two concurrent creates of one label (two connections, a barrier) end with exactly one row and
     one `DUPLICATE`; the same for two concurrent reactivations of two inactive tables sharing a
     label. *Red:* drop the index: both succeed.
  7. The log-scan marker test: a create refused `DUPLICATE` whose label is a marker string leaves
     the marker in no log line and no response. *Red:* copy the database error's `detail` into the
     log line: the marker appears.
  8. With another connection holding `FOR UPDATE` on an inactive table's row, a deactivation of
     that table does not return before the other connection commits (observed by a deadline the
     test sets, then by the call completing after the commit); the same for reactivating an active
     table. *Red:* remove the locking read: the no-op returns at once and the test fails.
  9. A no-op deactivation or reactivation answers the record and does not write the row (its
     `xmin` is unchanged). *Red:* make the write unconditional: `xmin` changes.
  10. Each command answers the record as committed, and a following list read contains exactly
      that record; an unknown `tableId` is 404 `NOT_FOUND` with nothing written; a malformed
      `tableId`, an empty, over-long, untrimmed or control-character label and an extra key are each
      400 `VALIDATION_FAILED` with no details. *Red:* accept an untrimmed label in the schema: its
      case fails.
  11. No table command writes an audit entry (the count of `audit_entry` is unchanged across all
      five). *Red:* not needed; it is a guard against a later change, and the Handoff says so.
  12. `error-details.types.ts` gains the `DUPLICATE` block: a details argument does not compile.
  13. `npm run verify` green; `npm run test:e2e:all` green (no browser test changes).
- **Tests expected to change:** `schema.test.ts` (the privilege map, new cases),
  `harness-race.test.ts` (the table list), `error-details.types.ts` (additions). Nothing else
  should change; a change elsewhere is reported in the Handoff with its reason.
- **The Handoff must carry forward:** the exact route names, schema names and `TableView`; that
  `lockDiningTable` is the lock Phase 2's open-order and deactivation checks share, and where
  Phase 2's check goes; the no-op rule; that `DUPLICATE` is generic and reusable.

## From consult C2 §1 — the routes (verbatim, from "The routes S1a registers")

| Method | Path | Body | Answers | `interactive` |
|---|---|---|---|---|
| `GET` | `/api/back-office/config/tables` | none | `{ tables: TableView[] }` | `false` |
| `POST` | `/api/back-office/config/tables/create` | `{ label }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/update` | `{ tableId, label }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/deactivate` | `{ tableId }` | `{ table: TableView }` | `true` |
| `POST` | `/api/back-office/config/tables/reactivate` | `{ tableId }` | `{ table: TableView }` | `true` |

Every one is `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`, under the
`/api/back-office/config/` prefix ARCHITECTURE §13 names. The guard already requires `MANAGER` and,
on the four `POST`s, the anti-CSRF token.

## From consult C2 §3 — answers and interactivity (verbatim, *Recommended*)

**Recommended:**

- **`TableView` is `{ tableId, label, isActive }`**, a strict schema in `@pos/contracts`, with
  `tableId` a UUID string. Nothing else: no timestamps (nothing reads them), no seat count
  (owner's Q10), and no area (below).
- **Every command answers `{ table: TableView }`**, the row as committed, read in the command's own
  transaction (`RETURNING`, or the locked row on a no-op). The list read answers
  `{ tables: TableView[] }`, all tables active and inactive, in a stable order (`created_at`, then
  `id`). How the list is sorted and grouped on screen is E1's.
- **The client replaces its copy of the record with the answer** (or inserts it, for a create).
  It does not reread the list after a successful command; it rereads after `DUPLICATE` (so the
  manager sees the table that holds the label), after `NOT_FOUND`, and after an unknown outcome
  (section 6). BO-05 does not poll.
- **The list read is not interactive; the four commands are.** A person's click that opens BO-05
  already reports activity through the one input listener (rule 21). The list is also reread by
  the page itself, after an unknown outcome or a refusal, and a read marked interactive would let
  those page-initiated reads extend a session (FR-A2b, AC-28). A command is always a person
  pressing a control.

## From consult C2 §4 — labels (verbatim, *Recommended*)

- **A label is 1 to 32 characters, with no leading or trailing whitespace and no control
  character** (Unicode category Cc). The schema is the precise rule; the length is in UTF-16
  units, as zod's `max` counts. The form trims before checking, and the schema refuses an
  untrimmed label rather than transforming it, so the server stores exactly what it validated and
  a request schema's input and output types stay the same. The database backstop is a check
  constraint on `char_length(label)` between 1 and 32 (code points never exceed UTF-16 units, so
  the backstop never refuses what the schema accepts) and on no leading or trailing whitespace.
  If E1 draws a different length, E1 wins; 32 fits "Terrace 12" with room.
- **Uniqueness is among active tables only, compared case-insensitively, across the whole floor.**
  "T1" and "t1" are the same label to a cashier choosing a table, and nothing groups tables
  (section 3), so there is no second key to scope it by. The authority is one partial unique
  index, `dining_table_active_label_key ON dining_table (lower(label)) WHERE is_active`, under the
  database's default collation. No pre-check is made: a read-then-insert is a race, and the index
  is not.
- **The refusal is a new code, `DUPLICATE`, status 409, with no details.** The domain catches
  SQLSTATE `23505` on that constraint by name and raises `DUPLICATE`; any other unique violation
  is a fault (500). The PostgreSQL error is never logged or copied (its `detail` quotes the
  label); ADR-010 rule 2's serializer would log only the constraint name in any case. The client
  places the refusal on the label field, because the label is the route's one unique field; a
  later form with two unique fields adds a details type then (details are optional, so adding them
  breaks nothing). The name is generic on purpose: S3's custom tender names and S6's preset names
  (if their slices make them unique) reuse it, with copy per screen.
- **Create, rename to a label an active table holds, and reactivation into a held label are each
  refused `DUPLICATE` with nothing written.** Renaming an inactive table is allowed, even to a
  label an active table holds, because the index ignores inactive rows. That gives the manager
  the way out of a refused reactivation: rename the inactive table, then reactivate it, or
  deactivate the other one first. E1 draws that state; reactivation does not take a new label in
  the same command, which would be a second way to rename.
- **Several inactive tables may share a label.** They are history, and a deactivated table's label
  may be reused, as a deactivated user's PIN may (FR-A4).

## From consult C2 §5 — the lock (verbatim, *Recommended* and *What S1a can prove now*)

- **The DiningTable row is the lock, taken `FOR UPDATE`.** In S1a one domain function, for example
  `lockDiningTable(tx, tableId)`, runs `SELECT … FROM dining_table WHERE id = $1 FOR UPDATE` and
  returns the row or nothing (`NOT_FOUND`). Update, deactivation and reactivation each call it as
  the first statement of their transaction, then decide, then write, then answer. Create needs no
  lock; the unique index serialises it.
- **Deactivation in S1a: lock, then (if already inactive) answer the record and write nothing,
  else set `is_active = false` and answer.** Phase 2 inserts exactly one step between the lock and
  the write: "if an `OPEN` order references this table, refuse", with its own code and the
  order's identity in its details (BO-05 *Must not invent*: the refusal names the order). Because
  that read follows the lock, a concurrent open-order either committed before (its order is seen)
  or waits until after (and then sees the table inactive).
- **Phase 2's open-order command takes the same row lock, after the BusinessDay row and before
  inserting the Order**, and reads `is_active` from the locked row. The lock order becomes:
  CatalogRevision → BusinessDay → **DiningTable** → Order → CheckoutLease, ReceiptSeries. No command
  takes DiningTable and then BusinessDay, so no cycle exists: deactivation, reactivation and rename
  take DiningTable alone, and settlement, void, refund and close never write the table row (a
  closed order frees its table by its own state). Two concurrent order openings on one table also
  serialise on the lock, and the second meets the first's order; the partial unique index on
  orders stays the backstop.
- **Reactivation and rename take the lock too**, for one shape across the commands. Rename gains
  nothing in Phase 2 (renaming a table with an open order is harmless: orders reference the id, and
  any document that prints a table label snapshots it, per §5.2's receipt rule).

**What S1a can prove now.** In Phase 1 an `UPDATE` takes the row lock anyway, so on the paths that
write, an explicit `FOR UPDATE` is indistinguishable from none. The no-op path tells them apart:
with another connection holding `FOR UPDATE` on an **already inactive** table's row, a
deactivation must not return until that connection ends. Without the explicit lock it reads the
row, sees nothing to change and returns at once. That test is the red proof that the lock comes
before the read, which is the property Phase 2 depends on. The same test for reactivation of an
already active table. The deactivation-versus-open-order race test itself belongs to Phase 2's
task, which creates the order table.

## Rules

- Touch only the paths in `owns`. `owns` names the consult's files; if the code needs another (a contracts test file of a
  different name is covered by `packages/contracts/test/**`), stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code. Each acceptance criterion's *Red* line is a mutation you apply, observe failing, revert, and report.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not run `db:migrate` on the development database `pos`;
  the lead does after the merge (the server now refuses to start until it does, S0).
- No audit entry, no idempotency key, no single-record read, no screen.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `3749fb7`: `npm run verify` 94 files and 3753 tests (S0's merge). The Handoff states the new counts.
The lead runs `npm run test:e2e:all` before merge (a migration, the contracts and the HTTP layer change).

## Out of scope

- BO-05, the rail, the manifest, the field-list helper and AC-35 (S1b); any back-office screen.
- FR-C8's open-order refusal (Phase 2); an area column; a single-record `GET`; tender types (S3).

## Commit and report

Commit on `agent/phase1-s1a` only, after verify is green, and never push. Conventional Commits, explaining why. Write the
Handoff below in full prose, carrying forward what the consult's *The Handoff must carry forward* names, ending with
`DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify (2026-10-20)

At `f6cf34a`, in this worktree. `git diff --name-only development...HEAD`: the task file and paths in `owns` only; the
changed existing tests are the three listed (`schema.test.ts`, `harness-race.test.ts`, `error-details.types.ts`), plus
new files under the owned test globs. `npm run verify`: 97 files, 3790 tests, green. `npm run test:e2e:all`: 58 passed
(42.9 s), the harness server starting on a database with `0010` through S0's check. Read the migration, the domain and
the routes against C2 §1, §3, §4 and §5: ids in bodies, `{ table }`/`{ tables }` answers, list non-interactive, the
partial unique index as the only authority, `lockDiningTable` first in update, deactivation and reactivation, no-op
writes nothing, `23505` on the named index only is `DUPLICATE`, database text never logged or wrapped, no audit entry.
Sent to review (`touches: boundaries`); the owner looks before merge.

## Round 2 — the review's F1 (lead ruling, 2026-10-20)

Codex reviewed `8c2fa0e` (`.agent/reviews/PHASE1-S1a-review.md`): no production-code defect; one P2. **F1 is accepted.**
Acceptance criterion 6 asks for "two connections, a barrier"; the two cases in `apps/server/test/tables.test.ts`
(`two concurrent writers`, `:256-281`) fire two requests with `Promise.all` and cannot tell a real overlap from two
commands that ran one after the other. Fix only that:

1. **Hold a barrier that both commands must reach.** Before the two requests, the owner connection opens a transaction
   and takes a table lock both commands' first statement conflicts with (`LOCK TABLE dining_table IN EXCLUSIVE MODE`
   conflicts with the `ROW EXCLUSIVE` an `INSERT` or `UPDATE` takes and the `ROW SHARE` a `SELECT … FOR UPDATE` takes;
   confirm against the PostgreSQL 16 lock table, through `.agent/bin/ask.sh librarian` if unsure). Then wait until
   **two distinct `pos_app` backends** are waiting on a lock, the way `throttle.test.ts` (`:78`), `session.test.ts`
   (`:96`) and `back-office-credential.test.ts` (`:94`) observe it through `pg_stat_activity` (count the rows, with a
   deadline). Then commit the barrier, so both commands proceed together and one meets the other's uncommitted index
   entry.
2. **Release the barrier in cleanup** (`finally`) even when an assertion throws, so a failure cannot hang later cases
   (you hit that once already with the lock tests).
3. **Keep the assertions:** one 200 and one bare `DUPLICATE`, the final rows (one row per label for creates; one active
   row per label for reactivations). One run per case is enough once the overlap is proved; drop the four-label loop
   or keep it, your call, and say which.
4. **Redo the red proof under the barrier:** make the index non-unique, see both cases fail (two 200s), revert. Record
   the observed waiting-backend count in the Handoff.

Touch only `apps/server/test/tables.test.ts`. Run `npm run verify`; commit; append a *Round 2* section to the Handoff
(what changed, the red proof, the counts) ending `DONE` or `BLOCKED: <question>`.

## Round 2 lead review (2026-10-20)

At `e8c1418`. Only `apps/server/test/tables.test.ts` changed (and the Handoff). The `raced` helper holds `LOCK TABLE
dining_table IN EXCLUSIVE MODE` on the owner connection, waits until `pg_stat_activity` shows two distinct `pos_app`
backends waiting on a lock, asserts that count is 2, commits, and ends the barrier connection in `finally`: F1's ask,
met. The lead repeated the red proof: with `0010`'s index made non-unique, both barrier cases fail `[200, 200]` (2 failed,
20 skipped); reverted, `git status` clean. `npm run verify`: 97 files, 3790 tests; `tables.test.ts` 22 passed. A
test-only round of about sixty lines, so the lead reviewed it instead of a second Codex round (kit practice, DESIGN-016
round 3). F1 closed. Complete; `touches: boundaries`, so the owner looks before merge.

## Handoff

**What I did.** Everything in the task's scope, in one commit on `agent/phase1-s1a`: `8cfff71`
("feat(server): dining tables and the five back-office table routes"). Nothing was pushed. The migration is
`db/migrations/0010_dining_table.sql`: `dining_table (id uuid PK default gen_random_uuid(), label text NOT NULL,
is_active boolean NOT NULL default true, created_at timestamptz NOT NULL default now())`, one check constraint
`dining_table_label_check` (`char_length(label) BETWEEN 1 AND 32 AND label !~ '^\s|\s$'`), the partial unique index
`dining_table_active_label_key ON dining_table (lower(label)) WHERE is_active`, and the grants `SELECT, INSERT` plus
`UPDATE (label, is_active)` to `pos_app`; no `DELETE`, no row inserted. The domain is
`apps/server/src/domain/dining-table.ts`; the routes are `apps/server/src/http/routes/back-office-tables.ts`,
registered in `apps/server/src/http/server.ts` after the back-office auth routes. The contracts are
`packages/contracts/src/tables.ts` plus `routes.ts`, `errors.ts` and `index.ts`. The client lines are the five `SPECS`
entries, five `ROUTES` names, the five functions in `apps/back-office/src/session/api.ts` (declared, called by no
screen) and `DUPLICATE` in the general-failure group of both `realSession.ts` switches.

**What the next agent needs (the items the task said to carry forward).**

- *Names.* Routes (all `{ session: 'ACTIVE', audience: 'BACK_OFFICE' }`): `GET /api/back-office/config/tables`
  (`interactive: false`, `ROUTES.tablesList`, answers `{ tables: TableView[] }`) and `POST .../tables/create`
  (`{ label }`), `.../tables/update` (`{ tableId, label }`), `.../tables/deactivate` (`{ tableId }`),
  `.../tables/reactivate` (`{ tableId }`), each `interactive: true`, each answering `{ table: TableView }`
  (`ROUTES.tablesCreate`, `tablesUpdate`, `tablesDeactivate`, `tablesReactivate`). Contract names exported from
  `@pos/contracts`: `TableLabel` (the one shared label schema value), `TableView`, `CreateTableRequest`,
  `UpdateTableRequest`, `DeactivateTableRequest`, `ReactivateTableRequest`, `TableResponse` (`{ table }`),
  `TablesResponse` (`{ tables }`). `TableView` is a strict `{ tableId: uuid, label: string, isActive: boolean }`.
  `TableLabel` is `z.string().min(1).max(32)` refined by "equals its own trim" and "no `\p{Cc}`"; no transform, no
  custom message. Back-office API keys are the route paths (`api['/api/back-office/config/tables/create']`).
- *The lock.* `lockDiningTable(client, tableId)` in the domain module runs `SELECT id, label, is_active FROM
  dining_table WHERE id = $1 FOR UPDATE` and returns the row or null (null is `NOT_FOUND`). It is exported on purpose:
  Phase 2's open-order command takes the same lock after the BusinessDay row and before inserting the order. Phase 2's
  refusal to deactivate a table holding an open order goes in `deactivateTable`, between the `lockDiningTable` call and
  the `UPDATE`, after the existing "already inactive, answer and write nothing" return or before it as that task
  decides (a table with an open order is active, so the order of those two does not matter). I left a comment there.
- *The no-op rule.* Deactivating an inactive table, reactivating an active one, and renaming to the identical label
  each answer the record and execute no `UPDATE`; the test proves it by `xmin`. A change of case alone (`on` to `On`)
  is a change and is written.
- *`DUPLICATE` is generic.* It is a bare 409 with no details in `ErrorCode`, the `ErrorBody` union and its
  completeness check, and `error-details.types.ts` pins that a details argument does not compile. The domain returns a
  `{ kind: 'DUPLICATE' }` outcome and the route raises the `AppError`, so a later unique name (S3, S6) reuses the code
  and the pattern. Both clients place it in the general-failure group for now; a screen that wants it on a field
  reads `result.body.error.code` at the call site (BO-05 is S1b).

**What I decided, and the evidence.**

- The domain returns outcomes and the route raises `AppError`, instead of the domain throwing `AppError`. Evidence: no
  file under `src/domain` imports from `src/http`, and `back-office-credential.ts`/`throttle.ts` return result kinds
  that a route maps.
- A database error is replaced by a fixed-message `Error` without a cause (as `staff.ts` does), so the global error
  handler logs a 500 with no PostgreSQL text. Only SQLSTATE `23505` on `dining_table_active_label_key` is
  `DUPLICATE`; any other error, another unique violation included, is that fault. I could not provoke a second
  unique violation (the only other unique key is the generated uuid), so the "other unique violation is a fault" half
  has no test; the code path is the single `throw` after the `if`.
- The label check constraint's whitespace test is the POSIX `\s` class, which is narrower than JavaScript's `trim()`
  (a non-breaking space passes the database and is refused by the schema). That is the direction the consult wants:
  the backstop never refuses what the schema accepts. The control-character rule has no database backstop, as the
  consult describes.
- `listTables` is one statement (`ORDER BY created_at, id`), so it is its own transaction; it takes no lock.
- The log-scan case compares lower-cased text, because the index expression makes PostgreSQL's `detail` quote
  `lower(label)`. It also captures `process.stdout` (where `logLine` writes) as well as the server's log stream, so
  the red mutation I used (a `logLine` of the error's `detail`) is visible to it.
- The fixtures create tables through the routes, never by insertion, and each case starts with `TRUNCATE dining_table`
  on the owner connection so the manager's session survives between cases.

**Existing tests I changed, and why.** Only the three the task named. `schema.test.ts`: the privilege map gained
`dining_table` (`INSERT, SELECT` on the table, `UPDATE` on `label` and `is_active`), plus a new `describe('dining_table')`
(empty after migration, exact columns, privileges and refused `DELETE`/`TRUNCATE`/`id`/`created_at` updates, the label
check, the active-label index). `harness-race.test.ts`: `dining_table` added to `MIGRATED_TABLES`.
`error-details.types.ts`: the `DUPLICATE` block. New files: `apps/server/test/tables.test.ts` (22 cases),
`packages/contracts/test/routes.test.ts` (2) and `packages/contracts/test/tables.test.ts` (8).
`route-table.test.ts` and `access.test.ts` are unedited and pass.

**Red proofs (each mutation applied, the failure read, then reverted).**

1. Removed `tables/update` from `ROUTE_TABLE`: `route-table.test.ts` case 8 failed ("registered but not in the table:
   POST /api/back-office/config/tables/update"), and so did its interactive-equality test.
2. Appended `?x` to `tables/deactivate`: the new "no path contains ?, # or :" test failed, and so did the list test.
3. Declared `create` `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: the loop's no-cookie case failed (got 200, wanted
   401); `access.test.ts` case 7 and `route-table.test.ts` "every non-ACTIVE route is interactive false" failed too, as expected.
4. Added `DELETE` to the grant: `schema.test.ts` case 1 failed (the map showed `DELETE`), and so did my new privilege case.
5. Indexed `label` instead of `lower(label)`: the case-variant create, rename and reactivate cases and the schema
   case-variant case failed (`t1` was created, 200).
6. Made the index non-unique: both concurrency cases failed (`[200, 200]` for creates and for reactivations).
7. Logged the error's `detail` through `logLine`: the marker case failed, with `key (lower(label))=(mark-dup-label-5521)
   already exists.` in the output.
8. Removed `FOR UPDATE` from `lockDiningTable`: all three lock cases failed (the call returned at once). My first version
   of that test left the other connection holding the lock when the assertion threw, which hung every later case for
   ten seconds each; I rewrote it to commit the other connection before asserting.
9. Made the deactivate write unconditional: the no-op case failed (`xmin` moved from 834027 to 834033).
10. Dropped the `.refine` for "equals its trim": the label cases in the contracts tests (`" T1"`) failed.
11. Criterion 11 (no audit entry) has no red proof, as the task says: it guards a later change. Criterion 12 is a
    compile-time fact: `error-details.types.ts` has `@ts-expect-error` on each `DUPLICATE` details line.

**`npm run verify`, real output:** typecheck clean; `Test Files 97 passed (97), Tests 3790 passed (3790)`. The
baseline was 94 files and 3753 tests, so +3 files and +37 tests (22 in `tables.test.ts`, 8 and 2 in the two contracts
files, 5 new `schema.test.ts` cases). `npm run typecheck` runs `tsc -p apps/pos` and `tsc -p apps/back-office` without
`--noEmit`; `git status` showed no emitted files afterwards.

**Not done, and why.** `npm run test:e2e:all` (criterion 13) was not run: the baseline names it as the lead's before-merge
step, and this session has no browser. No browser test changed. I did not run `db:migrate` on the development database
`pos`; the server will refuse to start there until the lead does (S0).

**Found and not fixed.** (a) The comment at the top of `error-details.types.ts` still says "No current code declares
details", which has been false since 009b; I did not touch it, it is outside this task's edit. (b) `ErrorDetailsByCode`'s
doc comment counts the codes without details; I changed "eleven" to "twelve" for the new code.

DONE

### Round 2 — F1, the barrier

**What changed.** Only `apps/server/test/tables.test.ts`, the `two concurrent writers` block. A helper `raced(first, second)`
has the owner connection open a transaction and `LOCK TABLE dining_table IN EXCLUSIVE MODE`, which conflicts with the
`ROW EXCLUSIVE` an `INSERT` or `UPDATE` takes and the `ROW SHARE` of `SELECT … FOR UPDATE`, so the create's `INSERT` and
the reactivation's locking read both block on their first statement. It then starts both requests and polls
`pg_stat_activity` (`usename = 'pos_app'`, `wait_event_type = 'Lock'`, `count(DISTINCT pid)`, up to 200 tries 25 ms apart)
until two distinct backends are waiting, and only then commits the barrier. The barrier connection is ended in `finally`,
which rolls it back if an assertion or the wait throws, so a failure cannot hang later cases. The case asserts the
observed waiting count is exactly 2 before the old assertions (one 200, one bare `DUPLICATE`, one row for creates; one
active row and two rows for reactivations). I dropped the four-label loop: with the overlap proved, one run per case is
enough. One limit I note: the barrier proves both commands were in flight and started together, but not that one's
`INSERT`/`UPDATE` ran before the other's commit; the unique index is what decides that either way.

**Red proof under the barrier.** Changed `CREATE UNIQUE INDEX` to `CREATE INDEX` in `0010_dining_table.sql`: both cases
failed with `expected [ 200, 200 ] to deeply equal [ 200, 409 ]`. The observed waiting-backend count was 2 in both runs
(the `waiting` assertion passed ahead of the failing one). Reverted; the migration is unchanged from `8cfff71`.

**Counts.** `npm run verify`: typecheck clean; `Test Files 97 passed (97), Tests 3790 passed (3790)` (unchanged: the two
cases were rewritten, not added). `git status` showed only `tables.test.ts` modified before the commit.

DONE
