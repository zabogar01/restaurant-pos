---
id: PHASE1-S3a
title: Tender methods on the server — the tender_method record, its four commands and list, and the five back-office routes (plan S3, consult C2 §8)
category: feature
touches: [boundaries]
depends_on: [PHASE1-S2a]
owns: [db/migrations/0012_tender_method.sql, apps/server/src/domain/tender-method.ts, apps/server/src/http/routes/back-office-tender-methods.ts, apps/server/src/http/server.ts, packages/contracts/src/tender-methods.ts, packages/contracts/src/routes.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, apps/back-office/src/session/api.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: review
cycles: 0
---
# PHASE1-S3a — Tender methods on the server

**Written** 2026-10-22 by the lead, from slice S3 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S3*), **consult C2**
(`.agent/reviews/ARCH-019-first-back-office-form.md`, §8 *Cash and card for S3*, and the pattern of §1, §3, §4 and §5),
and the design **DESIGN-018** (`.agent/tasks/DESIGN-018-settings-and-tenders.md`, Handoff, the *Method name* row). The
plan sizes S3 as one task; the lead splits it, as S1 and S2 were split, into this server half and **PHASE1-S3b** (BO-08's
payment-methods part, written after this one merges). This slice is a near copy of **PHASE1-S1a** (tables on the
server, merged as PR #119): where this file says "as S1a", copy S1a's shape, and where this file and S1a differ, this
file wins. Where this file and the consult differ, stop and write `BLOCKED: <question>`.

## Objective

A manager can create, rename, deactivate and reactivate **custom tender methods**, and list them, through five new
back-office routes, against a new `tender_method` record that starts empty (B-24). **Cash and card are not rows**: they
are fixed kinds the application never creates, renames or deactivates, and nothing in this slice stores, seeds or names
them. No screen yet: S3b builds BO-08's payment-methods part on these routes. Nothing tenders with a method until
Phase 4.

## Decided: do not reopen

- **Owner, 2026-10-20 (DECISIONS):** FR-B7 is Phase 1, as slice S3 (plan Q4). C2's OQ1: a deactivated custom method
  may be **reactivated**; PRD FR-B7 reads "Manage tender types: create, rename, deactivate and reactivate custom named
  methods alongside cash and card." **Nothing in Phase 1 is audited except user management** (Q11): no audit entry
  here.
- **Lead, as C2 §8 recommends (DESIGN-018 *Rulings*, accepted by the owner with DESIGN-018 question 1, DECISIONS
  2026-10-21):** cash and card are fixed kinds, not rows; only custom methods are rows; **a custom name may equal
  "Cash" or "Card"**, and the server does not refuse it.
- **DESIGN-018 (*Rules S2a, S2b and S3 can test*, the *Method name* row):** required; **1 to 32 characters**; no
  control character; unique among **active** methods, compared case-insensitively. The record is `{ id, name, active }`
  and nothing else (no fee, integration, order or icon).
- **ADR-010 rules 1 and 2; ADR-011 rules 1, 9 and 16**, as S1a: no new error code (`DUPLICATE` and `NOT_FOUND` exist
  and are reused); no PostgreSQL error text logged or copied; every route declares `access` with no default
  `interactive`; one validation helper (`parseBody`, unchanged), `VALIDATION_FAILED` with no details; fixed-string
  paths, the id in the body.
- **Lengths are code points.** zod 4.6.5's `min`/`max` and PostgreSQL's `char_length` both count code points (S2b
  Handoff, decision 1). The "UTF-16 units" wording in C2 §4, DESIGN-018 and older comments is wrong; do not copy it
  into a new comment. (Correcting the old comments is a separate queued cleanup, not this task.)
- **The migration is `0012`** (S2a added `0011`).

## The shape (lead rulings, 2026-10-22, from C2 §8 and S1a)

1. **Migration `0012_tender_method.sql`.** `tender_method (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT
   NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`; one check constraint
   `tender_method_name_check` (`char_length(name) BETWEEN 1 AND 32`, `name !~ '^\s|\s$'`, and `name !~ '[[:cntrl:]]'`
   as S2a's `0011` uses it); the partial unique index `tender_method_active_name_key ON tender_method (lower(name))
   WHERE is_active`; grants to `pos_app` in the same file: `SELECT, INSERT` on the table and `UPDATE (name, is_active)`
   only; no `DELETE`. **No row is inserted** (no cash, no card, nothing).
2. **Contracts, a new `packages/contracts/src/tender-methods.ts`**, exported from `index.ts`:
   - `TenderMethodName`: one shared schema value, `z.string().min(1).max(32)` refined by "equals its own trim" and "no
     `\p{Cc}`", no transform, no custom message (as `TableLabel`).
   - `TenderMethodView`: strict `{ tenderMethodId: z.uuid(), name: string, isActive: boolean }`; nothing else.
   - Requests, strict: `CreateTenderMethodRequest { name }`, `UpdateTenderMethodRequest { tenderMethodId, name }`,
     `DeactivateTenderMethodRequest { tenderMethodId }`, `ReactivateTenderMethodRequest { tenderMethodId }`.
   - Responses: `TenderMethodResponse { tenderMethod }`, `TenderMethodsResponse { tenderMethods }`.
3. **Routes** (`routes.ts`), every one `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`:

   | Method | Path | Body | Answers | `interactive` |
   |---|---|---|---|---|
   | `GET` | `/api/back-office/config/tender-methods` | none | `{ tenderMethods: TenderMethodView[] }` | `false` |
   | `POST` | `/api/back-office/config/tender-methods/create` | `{ name }` | `{ tenderMethod }` | `true` |
   | `POST` | `/api/back-office/config/tender-methods/update` | `{ tenderMethodId, name }` | `{ tenderMethod }` | `true` |
   | `POST` | `/api/back-office/config/tender-methods/deactivate` | `{ tenderMethodId }` | `{ tenderMethod }` | `true` |
   | `POST` | `/api/back-office/config/tender-methods/reactivate` | `{ tenderMethodId }` | `{ tenderMethod }` | `true` |

   The list answers every custom method, active and inactive, ordered by `created_at`, then `id`. `ROUTES` names:
   `tenderMethodsList`, `tenderMethodsCreate`, `tenderMethodsUpdate`, `tenderMethodsDeactivate`,
   `tenderMethodsReactivate`.
4. **Domain, `apps/server/src/domain/tender-method.ts`**, as `dining-table.ts`: create, update, deactivate, reactivate
   and list, each one transaction. Update, deactivate and reactivate open with **`lockTenderMethod(client,
   tenderMethodId)`** (`SELECT … FROM tender_method WHERE id = $1 FOR UPDATE`, returning the row or null) as their first
   statement; null is `NOT_FOUND`. A command that would change nothing (deactivate an inactive method, reactivate an
   active one, rename to the identical name) writes nothing and answers the record; a change of case alone is a change.
   SQLSTATE `23505` on `tender_method_active_name_key`, matched by constraint name, is `DUPLICATE`; any other error is a
   fault, replaced by a fixed-message `Error` with no cause (as S1a). The domain returns outcomes; the route raises the
   `AppError` (as S1a). Rename of an inactive method is allowed even to a name an active method holds; reactivation
   into a held name is `DUPLICATE` with nothing written; several inactive methods may share a name.
5. **Routes module**, `apps/server/src/http/routes/back-office-tender-methods.ts`, registered in `server.ts` after the
   settings routes, parsing with `parseBody` and answering the record as committed (read in the command's own
   transaction: `RETURNING`, or the locked row on a no-op).
6. **The compile-forced client lines only.** Five `SPECS` entries and five `ROUTES` names in `packages/api-client`; the
   five functions in `officeApi()` in `apps/back-office/src/session/api.ts`. **`ConfigApi` excludes the five paths for
   now**, exactly as S2a excluded the settings paths (S2a Handoff, *Decisions* 1): an `Exclude` on `ConfigPath` with a
   comment saying S3b adds them to `ConfigApi`, `configApi()`, `fixtureSession.ts` and `config-api.test.tsx` together
   with the screen. No back-office test or screen file changes. No `realSession.ts` change (no new code).
7. **Not decided here, and left alone:** where the TenderMethod row sits in ARCHITECTURE §8's lock order. Phase 4's
   tender command is the first to read a method while writing something else; S3a takes only its own row. Say in the
   Handoff that `lockTenderMethod` is exported and that the lock order is Phase 4's (with an architect).

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. The route table equals the registered routes, and each route's `interactive` equals its declaration
   (`route-table.test.ts`, data-driven, unedited). *Red:* remove one new entry from `ROUTE_TABLE`: case 8 fails.
2. No `ROUTE_TABLE` path contains `?`, `#` or `:` (`packages/contracts/test/routes.test.ts`; extend it to the new paths
   if it filters on `/config/tables`). *Red:* append `?x` to one new path: the test fails.
3. Each new route refuses a request with no back-office cookie, or with a POS session's token, 401 `UNAUTHENTICATED`; a
   back-office session whose user is no longer a manager, 403 `FORBIDDEN`; and, on the four `POST`s, a missing or wrong
   anti-CSRF header, 403 `CSRF_REFUSED`, with nothing written. One loop over the new entries. *Red:* declare one command
   `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: the loop's no-cookie case fails.
4. `tender_method` is **empty after migration** (no cash, no card, no row), and `pos_app` has exactly `SELECT, INSERT`
   and `UPDATE (name, is_active)` on it; a `pos_app` `DELETE`, `TRUNCATE`, and an `UPDATE` of `id` or `created_at` are
   refused (`schema.test.ts`: the privilege map and a new `describe('tender_method')` with the columns, the name check
   and the index; `harness-race.test.ts`'s table list). *Red:* add `DELETE` to the grant: case 1 fails.
5. Create, rename and reactivation each answer `DUPLICATE` (409, body exactly `{ "error": { "code": "DUPLICATE" } }`)
   when an active method holds the name in any case, and write nothing. Two inactive methods may share a name; an
   inactive method may be renamed to a name an active method holds. A custom method named `Cash`, `cash` or `Card` is
   created (C2 §8). *Red:* index `name` instead of `lower(name)`: the case-variant test fails.
6. Two concurrent creates of one name end with exactly one row and one `DUPLICATE`; the same for two concurrent
   reactivations of two inactive methods sharing a name. **Use S1a's round 2 barrier** (`tables.test.ts`, the `raced`
   helper: the owner connection holds `LOCK TABLE tender_method IN EXCLUSIVE MODE`, waits until `pg_stat_activity`
   shows two distinct `pos_app` backends waiting on a lock, asserts that count is 2, commits, and ends the barrier in
   `finally`). *Red:* make the index non-unique: both cases fail `[200, 200]`.
7. The log-scan marker: a create refused `DUPLICATE` whose name is a marker string leaves the marker in no log line and
   no response (as S1a's case, stdout captured too). *Red:* log the database error's `detail`: the marker appears.
8. With another connection holding `FOR UPDATE` on an **inactive** method's row, a deactivation of it does not return
   before that connection commits; the same for reactivating an **active** method. Commit the other connection before
   asserting, so a failure cannot hang later cases. *Red:* remove `FOR UPDATE` from `lockTenderMethod`: the no-op returns
   at once and the test fails.
9. A no-op deactivation, reactivation or identical rename answers the record and does not write the row (`xmin`
   unchanged). *Red:* make the deactivate write unconditional: `xmin` changes.
10. Each command answers the record as committed, and a following list read contains exactly that record; the list
    holds active and inactive methods in creation order; an unknown `tenderMethodId` is 404 `NOT_FOUND` with nothing
    written; a malformed id, an empty, 33-code-point, untrimmed, line-feed or control-character name, and an extra key
    are each 400 `VALIDATION_FAILED` with no details. A 32-emoji name is accepted (code points, not UTF-16 units).
    *Red:* accept an untrimmed name in the schema: its case fails.
11. The database backstop refuses, as the owner, a name of 33 code points, an untrimmed name and a name holding ESC,
    and accepts a 32-emoji name (`schema.test.ts`). *Red:* drop the `[[:cntrl:]]` clause: the ESC case fails.
12. No tender-method command writes an audit entry (the `audit_entry` count is unchanged across all five). No red; a
    guard against a later change, and the Handoff says so.
13. `npm run verify` green. The lead runs `npm run test:e2e:all` before merge (a migration, the contracts and the HTTP
    layer change); you may run it too and report it.

## Tests expected to change

- `apps/server/test/schema.test.ts`: the privilege map gains `tender_method`; a new `describe('tender_method')`.
- `apps/server/test/harness-race.test.ts`: `tender_method` in `MIGRATED_TABLES`.
- `packages/contracts/test/routes.test.ts`: only if it filters on the table paths (criterion 2).
- New: `apps/server/test/tender-methods.test.ts`, `packages/contracts/test/tender-methods.test.ts`.
- **Nothing else should change**, `route-table.test.ts`, `access.test.ts` and every back-office test included. A change
  anywhere else is reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not run `db:migrate` on the development database `pos`;
  the lead does after the merge (the server refuses to start until it does, S0).
- No audit entry, no idempotency key, no single-record read, no seed, no screen, no new error code.
- Fixtures create methods through the routes, never by insertion; each case may `TRUNCATE tender_method` on the owner
  connection, as S1a's tests do.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `d164a23` (S2b #130, DESIGN-019 #131 and the lead's #132, #133 merged). The lead's last runs, of S2b's
final tree: `npm run verify` 114 files, 4331 tests; `npm run test:e2e:all` 74 passed. Confirm the baseline before you
start and state the new counts in the Handoff.

## Out of scope

- BO-08's payment-methods part, `ConfigApi`'s inclusion, the fixture session (S3b). Any back-office screen.
- Tendering with a method, the Tender record, the name snapshot (Phase 4). Cash and card as data in any form.
- The code-point comments elsewhere (queued cleanup). ARCHITECTURE §8's lock order (rule 7).

## Commit and report

Commit on `agent/phase1-s3a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done (paths, commits); **what S3b needs** (the exact route, `ROUTES` and
schema names, `TenderMethodView`, the `ConfigApi` exclusion S3b removes, and how `DUPLICATE` and `NOT_FOUND` arrive);
what was decided and on what evidence; tests changed and why; each red proof (mutation, failure read, reverted); what
was found and not fixed; the real `verify` output. End with `DONE` or `BLOCKED: <one question>`, then report to the lead
through Herdr as AGENTS.md says.

## Lead verify (2026-10-22)

At `09e23d9`, in this worktree. `git diff --name-only development...HEAD`: the task file and paths in `owns` only; the
changed existing tests are the two listed (`schema.test.ts`, `harness-race.test.ts`), plus the two new test files.
`npm run verify`: 116 files, 4367 tests, green. Read the migration, the domain and the `api.ts` change against the task's
*The shape* and C2 §4, §5 and §8: no row inserted, the check constraint and partial unique index as ruled, the grants,
`lockTenderMethod` first in rename, deactivation and reactivation, the no-op returns, `23505` on the named index only is
`DUPLICATE`, the database error replaced without a cause, no audit entry, and the `ConfigApi` exclusion with its S3b
comment. `npm run test:e2e:all` is the lead's before merge. Reviewers cannot reach the database or a browser: this note
is the evidence for the server and browser runs, and a "blocked" on that alone is ruled clear. Sent to review
(`touches: boundaries`); the owner looks before merge.

## Handoff

**What I did.** I built the server half of tender methods as a near copy of S1a, on `agent/phase1-s3a`. The files are:

- `db/migrations/0012_tender_method.sql`: the table, `tender_method_name_check` (1 to 32 code points, no edge whitespace, no `[[:cntrl:]]`), the partial unique index `tender_method_active_name_key ON (lower(name)) WHERE is_active`, and grants of `SELECT, INSERT` plus `UPDATE (name, is_active)`. No row is inserted and no `DELETE` is granted.
- `packages/contracts/src/tender-methods.ts`, exported from `index.ts`: `TenderMethodName`, `TenderMethodView`, the four strict requests, `TenderMethodResponse` and `TenderMethodsResponse`. Five entries were added to `routes.ts`.
- `apps/server/src/domain/tender-method.ts`: the five operations. `lockTenderMethod` is exported and is the first statement of update, deactivate and reactivate.
- `apps/server/src/http/routes/back-office-tender-methods.ts`, registered in `server.ts` after the settings routes.
- `packages/api-client`: five `SPECS` entries and five `ROUTES` names.
- `apps/back-office/src/session/api.ts`: five `officeApi()` functions, and `ConfigPath` now `Exclude`s the tender-methods paths, with a comment saying S3b adds them.
- Tests: new `apps/server/test/tender-methods.test.ts` (23 cases) and `packages/contracts/test/tender-methods.test.ts` (8 cases).

**What S3b needs.**

- Routes: `GET /api/back-office/config/tender-methods`, and `POST` to `.../create` (`{ name }`), `.../update` (`{ tenderMethodId, name }`), `.../deactivate` and `.../reactivate` (`{ tenderMethodId }`).
- `ROUTES` names: `tenderMethodsList`, `tenderMethodsCreate`, `tenderMethodsUpdate`, `tenderMethodsDeactivate`, `tenderMethodsReactivate`.
- Contract names: `TenderMethodName`, `TenderMethodView` (`{ tenderMethodId, name, isActive }`), `CreateTenderMethodRequest`, `UpdateTenderMethodRequest`, `DeactivateTenderMethodRequest`, `ReactivateTenderMethodRequest`, `TenderMethodResponse` (`{ tenderMethod }`) and `TenderMethodsResponse` (`{ tenderMethods }`).
- `ConfigApi` exclusion: S3b removes the `Exclude` on `ConfigPath` in `apps/back-office/src/session/api.ts`. It then adds the five paths to `configApi()`, `fixtureSession.ts` (currently `unavailable` entries for tables and settings) and `config-api.test.tsx`, together with the screen. I did not touch those files, since they are outside `owns`.
- Errors: `DUPLICATE` arrives as 409 `{ "error": { "code": "DUPLICATE" } }` on create, on update (rename into a name an active method holds) and on reactivate. `NOT_FOUND` arrives as 404 on update, deactivate and reactivate. Both carry no details. A bad body is 400 `VALIDATION_FAILED`.
- Reactivation takes no new name. The way out of a refused reactivation is to rename the inactive method and then reactivate it. A test shows this.

**What I decided, and on what evidence.**

1. Lengths are code points, as the task said. The schema counts them through zod's `max` and the database through `char_length`. The tests use 32 and 33 emoji, and the migration and contract comments say code points. I did not copy the old "UTF-16 units" wording.
2. `lockTenderMethod` is exported for Phase 4. Where the TenderMethod row sits in ARCHITECTURE §8's lock order is Phase 4's to decide, with an architect. S3a takes only its own row. I said so in the function's comment.
3. In the "Cash, cash or Card" case I truncate between the three creates. `Cash` and `cash` collide case-insensitively, so creating all three in one run would, correctly, answer `DUPLICATE`. My first draft failed for this reason (a test bug, not a defect). The case then checks that a second `CARD` is `DUPLICATE`, which shows these names are ordinary rows.
4. `makePeople` base is 690000. 680000 is already used by `settings.test.ts`.

**Existing tests changed.** `schema.test.ts` gained the `tender_method` entry in the privilege map and a new `describe('tender_method')`. `harness-race.test.ts` gained `'tender_method'` in `MIGRATED_TABLES`. I did not edit `packages/contracts/test/routes.test.ts`: its table-routes case filters on `/config/tables` and does not match the new paths, and its criterion-2 case is generic over `ROUTE_TABLE`. `route-table.test.ts`, `access.test.ts` and every back-office test are unchanged and pass. No assertion was weakened.

**Red proofs.** Each mutation was applied, the failure read, and the mutation reverted.

1. Removed the `reactivate` entry from `ROUTE_TABLE`: `route-table.test.ts` case 8 failed ("registered but not in the table: POST …/tender-methods/reactivate"), and the interactive case failed too.
2. Appended `?x` to the update path: `routes.test.ts` "no path contains ?, # or :" failed.
3. Declared `create` as `{ session: 'OPTIONAL', audience: 'BACK_OFFICE' }`: case 3 failed at "POST …/create: no cookie", answering 200 instead of 401.
4. Added `DELETE` to the grant: `schema.test.ts` case 1 (the privilege map) failed, showing `DELETE` in the table list, and the `tender_method` privilege test failed because `DELETE` succeeded.
5. Indexed `name` instead of `lower(name)`: the case-variant tests failed (`qris` accepted as 200 on create, rename and reactivation, and in the schema test).
6. Made the index non-unique: both race cases failed with `[200, 200]`, and the barrier's waiting count was still 2.
7. Wrote the database error's `detail` to stdout from the domain: the marker test failed, with the line `key (lower(name))=(mark-dup-tender-5521) already exists.` in the captured output.
8. Removed `FOR UPDATE` from `lockTenderMethod`: all three case 8 tests failed ("the call returned while the row was locked").
9. Made `deactivateTenderMethod` write unconditionally: the case 9 `xmin` test failed (`1098387` against `1098381`).
10. Removed the trim refinement from `TenderMethodName`: the contract test failed, and case 10 failed on the route with 500 `INTERNAL`, because the database check refused what the schema let through. That is the backstop working, and it shows the schema is the layer that answers 400.
11. Dropped the `[[:cntrl:]]` clause from the migration: the `tender_method` schema case (criterion 11) failed on the first control-character name, which succeeded when it should have been refused.

Criterion 12 (no audit entry) has no red proof, as the task says. It is a guard against a later change: it counts `audit_entry` across all five commands and a duplicate refusal.

**Found and not fixed.** Older comments (`tables.ts`, `0010`, `0011`, `dining-table.ts`) still say "UTF-16 units". That is the queued cleanup, so I left it alone. I ran no formatter.

**`npm run verify`.** Typecheck was clean. `vitest run`: Test Files 116 passed (116); Tests 4367 passed (4367). The baseline was 114 files and 4331 tests, so this adds 2 files and 36 tests. I did not run `npm run test:e2e:all` (the lead runs it before merge). I did not run `db:migrate` on the development database `pos`; the lead does that after the merge.

**What the next agent lacks.** Nothing is blocking. `docs/` and the contract are untouched. No browser was used or needed.

DONE
