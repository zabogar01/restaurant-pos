# Phase 0 gate report

**Written** 2026-10-19 by the lead, against `development` at `67311d8`. **For:** the owner, who closes Phase 0.
**Measured against:** the plan's Phase 0 Definition of Done
(`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3752-3761`, its three amended lines approved by the owner
on 2026-10-19) and the gate list in ARCH-015 §7 (*For the lead* 4).

## Verdict

Every line of the Definition of Done is met, each by a passing test or a compiler check rather than by inspection, with
one qualification on B-24 (line 8) that rests on an owner ruling and is stated below. Every item on ARCH-015's gate
list is done. **The lead recommends closing Phase 0.**

## The run

A fresh clone of `development` from GitHub, at `70fb286`, on 2026-10-19: `npm ci`; `npm run db:up` (Docker Compose
reused the running `restaurant-pos-db-1` container and its `pgdata` volume, and provisioned `pos_app` and `pos_test`);
`npm run db:migrate` (no pending migrations, 0001 to 0008 applied); `npm run verify`, typecheck clean and 93 test files
with 3744 tests passed; `npm run test:e2e:all`, 58 passed in Chromium and WebKit (47 s). The commits after `70fb286`
(PR #107) change only the plan's Definition of Done and the lead's memory, so the run stands for `67311d8`.

The clone had to sit in a directory named `restaurant-pos`: the compose file sets no project `name:`, so a clone under
any other name starts a second database on port 5433 and fails. This does not affect the result; it is a small builder
change for later (journal 2026-10-19).

## The Definition of Done, line by line

1. **`verify` from a clean checkout after `db:up && db:migrate`, then `test:e2e:all`.** Met: the run above.

2. **No `number` touches a monetary or rate value in `packages/money` or `apps/server` (B-1).** Met.
   `packages/money/test/no-number.types.ts` is compiled by `npm run typecheck` (`packages/money/tsconfig.json`
   includes `test`): each `@ts-expect-error` asserts that a `number` is refused where money or a rate belongs, and
   that money never comes back as a `number`; a widened signature would fail the typecheck with TS2578. The codecs
   refuse a JSON number instead of coercing it (`codec.test.ts`, `money.test.ts`). In the database,
   `schema.test.ts` case 14 proves there is no floating-point, `numeric` or `money` column and that `bigint` amounts
   stay exact. `apps/server/src` does not use money or rates at all in Phase 0 (no order, tender or tax code exists).

3. **No path writes a PIN or password value to a log, audit row, telemetry row or error message (B-12).** Met, by
   the two scans the line names. Server side: `log-scan.test.ts` cases 21 and 22 send a distinct marker through
   every channel and find none in the log at `trace` level or in any response body; `session-scan.test.ts` case 23
   does the same for session and anti-CSRF tokens. Browser side: the harness's credential scan runs after every
   profile test (B1 to B11) and reads the server log, **the stored `audit_entry` and `security_event` rows**
   (`e2e/support/fixtures.ts:198`), each page's console, storage, cookies and every request URL; a credential may
   appear only in its own sign-in or re-authentication body, as often as it was typed (PHASE0-012b ruling 5).
   `scan.spec.ts` F1 to F3 prove the scan itself finds a planted credential without repeating it. The audit writer
   refuses free-form content and never echoes it (`audit.test.ts` cases 9 and 11). Phase 0 writes no telemetry.

4. **The application role cannot UPDATE or DELETE `audit_entry`, by a passing test (B-7).** Met.
   `schema.test.ts` case 3: `pos_app` may insert and is refused UPDATE, DELETE, TRUNCATE and SELECT; case 6: the
   append-only trigger refuses UPDATE, DELETE and TRUNCATE even for the owner role. (The known bypass through
   `session_replication_role` is ADR-008's, deferred by the owner; STATE lists it.)

5. **The server refuses to start when `POS_LISTEN_HOST` is not a loopback IP literal (NFR-1, ADR-010 rule 5).**
   Met. `loopback.test.ts`: case 2 refuses each non-loopback value and names it; a non-loopback host is refused
   before any socket exists; case 5 closes the server and rejects if a bound address turns out not to be loopback.

6. **A success in the `LOGIN` class does not reset the `MANAGER_APPROVAL` counter (FR-A5).** Met.
   `throttle.test.ts` case 8 (FR-A5, AC-19). The back-office password throttle is separately isolated from the PIN
   throttle (`back-office-credential.test.ts`, FR-A5b, AC-35). In the browser, B1 and B2 prove the cooldown holds and
   survives a cleared client-instance cookie.

7. **Two separate bundles with two separate session cookies; neither session resolves on the other's routes (NFR-5,
   FR-A2c).** Met. The server serves `/pos/` and `/back-office/` as separate bundles (`bundles.test.ts`).
   `session.test.ts` case 6: a token of one audience resolves to nothing as the other. `session-scan.test.ts` case 27:
   one client holding both sessions sends each route only its own cookie. In both browsers: B3 (one manager holds both
   sessions in one profile), B4 (ending one leaves the other), B5 (neither session is accepted by the other surface).
   ADR-011 rules 2 and 3 record the path-scoped cookies and that no route accepts either.

8. **No menu, rate, table or business detail is hard-coded or seeded outside the test fixture (B-24).** Met, with one
   qualification. The server holds and seeds no restaurant data: the only seeded rows are the two installation-wide
   throttle buckets (`db/migrations/0005_pin_throttle_bucket.sql`), which FR-A5 requires and which are not restaurant
   configuration. **The qualification:** the served POS shows the client fixtures (floor, orders, payments, approval
   stand-ins) under a real sign-in, by the owner's ruling of 2026-10-13 (DECISIONS); they are fixtures, chosen by the
   build, and each goes when its server command arrives in a later phase. Nothing outside those fixtures is
   hard-coded.

## ARCH-015's gate list

| Item | State |
|---|---|
| PHASE0-012b, the browser acceptance tests | Merged, PR #104 |
| `verify` then `test:e2e:all` from a fresh clone | Green, above |
| The browser-clients ADR | ADR-011 accepted 2026-10-19, PR #102; its one unbuilt rule (root 404 `no-store`) built by PHASE0-013, PR #106 |
| The owner's Safari hand check (NFR-5 look, M-6) | Done by the owner, 2026-10-19: "all looks good" |
| The owner's roadmap reading (the inline approval prompt) | Confirmed 2026-10-19: met by the primitive, the adapter and the stand-ins (DECISIONS) |
| The plan's Definition of Done wording | Approved and applied 2026-10-19, PR #107 (DECISIONS) |

## Not part of the gate, carried forward

These do not block closing Phase 0; each is recorded in STATE.md with its pointer.

- **Known defects:** `closeOrder` accepts a non-cash draft above the balance (unreachable today; own task with an
  architect consult); the `session_replication_role` bypass (ADR-008, deferred); the PIN timing leak (ARCH-013 §7);
  no schema check at startup; 011d1's sign-in layout findings (design slice B); one development-only npm advisory.
- **Owed to later phases:** the carry-forwards in the Handoffs of PHASE0-005 to 013 and ARCH-012 to 016 (Phase 1:
  AC-32's POS half, AC-35's last sentence; Phase 2: AC-27's second sentence, AC-19's approval class, M-1, the
  idempotency design including ADR-011's `CSRF_REFUSED` retry).
- **Owner questions still open** (STATE.md): ARCH-013's five items (2 and 3 before Phase 2), the receipt and
  service-charge questions, the FR-M3/B-2 rounding wording, PRD wording owed, the `conversation only` DECISIONS lines.
- **Before Phase 1 starts:** Phase 1 needs its own plan (ROADMAP; QUEUE item 13). ADR-009's "Not decided here"
  (own-password change, own-PIN reset, role change) must be decided before the users screen.

## What the owner decides

Close Phase 0 on this report, or name what is missing.
