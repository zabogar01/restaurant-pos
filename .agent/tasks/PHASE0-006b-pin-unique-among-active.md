---
id: PHASE0-006b
title: A PIN is unique among active staff only
category: feature
touches: [identity]
depends_on: [PHASE0-006]
owns: [db/migrations/**, apps/server/src/**, apps/server/test/**]
status: not-started
cycles: 0
---
# PHASE0-006b — PIN unique among active staff

**Written** 2026-10-07 by the lead, from the architect consult ARCH-007
(`.agent/reviews/ARCH-007-throttle.md` §8, `:404-460`, and *For the task file*, `:673-680`) and the
owner's rulings. Cut from `development` at `20ae39e`, after PHASE0-006 (throttle) merged as PR #61.
The architect consult is ARCH-007; touches identity, so the owner looks before merge.

## Objective

Make the database enforce what FR-A4 now says: "PINs are unique among active users, so an audit
actor is unambiguous. A deactivated user's PIN may be given to another user." (owner, 2026-10-07).
Today `0002_staff_user.sql:29` makes `pin_lookup` unique across every row, deactivated ones
included. When this task is done, a forward migration replaces that index with a partial one over
active rows, `createStaffUser` still refuses a PIN held by an active user and accepts one held only
by a deactivated user, and tests prove it.

## Required inputs

- **ARCH-007 §8** (`:404-460`) and *The PIN reuse task* (`:673-680`): read both in full.
- `db/migrations/0002_staff_user.sql` (the index `staff_user_pin_lookup_key` on `pin_lookup`);
  the migration runner `apps/server/src/db/migrate.ts` (files applied in name order).
- `apps/server/src/domain/pin.ts`: `createStaffUser` inserts with `ON CONFLICT (pin_lookup) DO
  NOTHING` (`:69`) and reports `PIN already in use` when no row is returned; `findUserByPin`
  already filters `is_active`.
- `apps/server/test/schema.test.ts` case 15 (`:420-425`) and `apps/server/test/pin.test.ts`;
  the harness `apps/server/test/support/database.ts` (`resetDatabase`, `ownerQuery`).
- `docs/PRD.md` FR-A4, FR-B3; `docs/BOUNDARIES.md` B-12, B-13; `.agent/DECISIONS.md` lines dated
  2026-10-06 and 2026-10-07 on PIN reuse and reactivation.

## Rules

1. **A new migration, `db/migrations/0006_staff_user_active_pin_lookup.sql`**, exactly ARCH-007's
   shape: `DROP INDEX staff_user_pin_lookup_key;` then `CREATE UNIQUE INDEX
   staff_user_active_pin_lookup_key ON staff_user (pin_lookup) WHERE is_active;`, with a comment
   citing FR-A4 and the owner's ruling. **Never edit `0002`** or any applied migration. No grant
   changes (an index carries none).
2. **In the same commit,** `createStaffUser`'s conflict clause becomes `ON CONFLICT (pin_lookup)
   WHERE is_active DO NOTHING`. Without it, PostgreSQL rejects the insert outright against a
   partial index and every user creation fails (ARCH-007 verified this). Nothing else in `pin.ts`
   changes.
3. **No reactivation path is added.** The owner ruled (2026-10-07) that a reactivated user keeps
   their PIN unless another active user has taken it, in which case they set a new one; that
   command belongs to Phase 1's user management (FR-B3). The index already makes the dangerous
   case impossible: reactivating a row whose PIN an active user holds is a unique violation.
4. Tests reset with `resetDatabase()`; deactivation and reactivation in tests are fixture changes
   made through `ownerQuery`, since no domain function does them yet.

## Test cases

In `pin.test.ts` (new cases, numbered on from its last):

1. A PIN held by an active user is still refused for a new user with `PIN already in use`, and no
   second row exists.
2. A PIN held only by a deactivated user (deactivated through `ownerQuery`) can be given to a new
   user: `createStaffUser` returns an id, and two rows now share that `pin_lookup`, one inactive.
3. `findUserByPin` with that PIN then returns the **new** user and never the deactivated one.
4. Setting the deactivated row active again (through `ownerQuery`) while the new user is active is
   refused by the database with a unique violation (`23505`) on
   `staff_user_active_pin_lookup_key`; the row stays inactive.
5. Two deactivated users may share a PIN with each other (both inactive; insert or deactivate
   through `ownerQuery`), and a new active user may then take it too.

In `schema.test.ts`:

6. **Case 15 changes:** the constraint name becomes `staff_user_active_pin_lookup_key`; a duplicate
   `pin_lookup` between two active rows is still refused. Add beside it: two rows with the same
   `pin_lookup`, one of them inactive, are accepted. Do not change the privilege map or any other
   case.

## Tests expected to change

- `apps/server/test/schema.test.ts` case 15 (`:420-425`), as in test case 6: the constraint name, and
  one added case. Nothing else in it. The lead grepped `apps/server/test/` for
  `staff_user_pin_lookup_key`, `0002` and index names: only case 15 names the index, and
  `migrate.test.ts`'s `0002_broken.sql` is a temporary fixture, unrelated. If any other existing
  test needs a change, stop and raise it.

## Constraints

- **B-12:** no PIN, digest or hash in any error that leaves `pin.ts` (unchanged behaviour; the
  conflict path stays `ON CONFLICT ... DO NOTHING`, never a caught unique violation).
- **B-13 / FR-A4:** an audit entry names a staff id, so two rows sharing a PIN never make an actor
  ambiguous; the partial index guarantees at most one **active** holder.
- Do not change `0001` to `0005`, `throttle.ts`, `audit.ts`, `pool.ts`, the client, or any document.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s 49 files and
   2838 tests (lead's verify, 2026-10-07), the client's 40 files and 2719 tests unchanged.
2. The server tests apply `0006` through `resetDatabase()`. Do not run `npm run db:migrate` against
   the dev database `pos`; the lead does that after merge.
3. **Red proofs, each made, run, shown and reverted:** revert the `ON CONFLICT` change and every
   `createStaffUser` test fails; drop `WHERE is_active` from the new index and test case 2 fails.
4. The Handoff maps each test case number to its test name.

## Out of scope

- A reactivation, deactivation or PIN-change command (Phase 1, FR-B3).
- Sessions (plan Task 7), routes, approval.

## Handoff

**What I did.** Commit `4128484` on `agent/phase0-006b`. Added
`db/migrations/0006_staff_user_active_pin_lookup.sql`, which drops
`staff_user_pin_lookup_key` and creates `staff_user_active_pin_lookup_key`, a unique index on
`pin_lookup` `WHERE is_active`, with a comment citing FR-A4 and the owner's 2026-10-07 ruling.
Changed the one line in `apps/server/src/domain/pin.ts` so the conflict clause reads
`ON CONFLICT (pin_lookup) WHERE is_active DO NOTHING`. Nothing else in `pin.ts` changed, and `0001`
to `0005` are untouched. I did not run `npm run db:migrate`; the server tests apply `0006` through
`resetDatabase()`.

**Test map.** `apps/server/test/pin.test.ts`, new `describe('PIN uniqueness among active users')`:
case 1 "still refuses a PIN held by an active user and writes no second row (case 1)"; case 2
"gives a PIN held only by a deactivated user to a new user (case 2)"; case 3 "finds the new user,
never the deactivated one, by that PIN (case 3)"; case 4 "refuses to reactivate a user whose PIN an
active user now holds (case 4)" (asserts `23505`, constraint `staff_user_active_pin_lookup_key`, row
still inactive); case 5 "lets deactivated users share a PIN, and a new active user take it too
(case 5)". `apps/server/test/schema.test.ts`, case 6 of the task: the existing case-15 test now
expects `staff_user_active_pin_lookup_key`, and a new test "accepts the same pin_lookup on two rows
when one is inactive (case 15)" sits beside it. Deactivation and reactivation are done through
`ownerQuery`.

**Existing tests changed.** Only `schema.test.ts` case 15: the expected constraint name. Nothing
loosened.

**Red proofs.** (a) With `WHERE is_active` removed from the `ON CONFLICT` clause, 15 of 27 tests in
`pin.test.ts` failed, every one that calls `createStaffUser` successfully, with "The staff user
store failed" (PostgreSQL refuses the inference against a partial index). (b) With `WHERE is_active`
removed from the new index, `pin.test.ts` cases 2, 3, 4 and 5 failed with "PIN already in use", and
the new `schema.test.ts` test failed with a duplicate key on `staff_user_active_pin_lookup_key`.
Case 2 failed as the task required. Both mutations reverted; the files match the commit.

**Verify.** `npm run verify`: typecheck clean; 49 test files passed, 2844 tests passed (development
was 49 files and 2838 tests, so +6: five in `pin.test.ts`, one in `schema.test.ts`). The run does
not split server from client counts, so I cannot show the client's 40 files and 2719 tests
separately; no client file was touched.

**Found, not fixed.** The existing test "refuses a duplicate PIN and writes no second row" in
`pin.test.ts` now overlaps case 1. I left it as is rather than remove coverage. No browser was
used or needed.

**Next agent.** The lead must run `npm run db:migrate` against the dev database `pos` after merge.
No formatter was run.

DONE
