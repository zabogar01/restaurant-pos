# Phase 1 gate report

**Written** 2026-11-10 by the lead, against `development` at `de82604` (S10, PR #181, merged). **For:** the owner, who
closes Phase 1. **Measured against:** the Phase 1 Definition of Done
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md:479-531`) and ROADMAP's Phase 1 acceptance as
amended by the owner's Q13 ruling (`docs/ROADMAP.md:60-90`; DECISIONS 2026-10-20).

## Verdict

Every line of the Definition of Done is met, each by a passing test or a compiler check rather than by inspection. The
three lines the plan marked *subject to Q13* stand because the owner accepted Q13 on 2026-10-20: AC-31, AC-32's second
sentence and AC-12's add and fire rejections now belong to Phases 2 and 3. One qualification on B-24 carries over from
Phase 0 unchanged and rests on the owner's 2026-10-13 ruling. All eleven slices (S0 to S10) are merged. **The lead
recommends closing Phase 1.** Several screens still await the owner's own look in a browser; that is listed below and
is not a line of the Definition of Done.

## The run

A fresh clone of `development` from GitHub, at `de82604`, on 2026-11-10, **in a directory named `gate-p1`** (not
`restaurant-pos`): `npm ci` (exit 0; the known install-script warnings); `npm run db:up` (exit 0: Docker Compose reused
the one `restaurant-pos-db-1` container, because S0 gave the compose file its project `name:`, and provisioned `pos_app`
and `pos_test`); `npm run db:migrate` (no pending migrations; `0001` to `0015` applied); `npm run verify`, typecheck clean
and **180 test files with 6284 tests passed**; `npm run test:e2e:all`, **152 passed** in Chromium and WebKit (2.2 min).
The lead's run in the main checkout at the same commit gave the same counts.

## The Definition of Done, line by line

1. **`verify` from a clean checkout in a directory not named `restaurant-pos`, then `test:e2e:all`.** Met: the run
   above. Phase 0's gate found a clone under another name started a second database; it no longer does.

2. **The server refuses to start against a database whose applied migrations differ from `db/migrations`.** Met by
   `apps/server/test/schema-check.test.ts` (S0): it passes on a fully migrated database, refuses with the *behind*
   sentence when a file has no row and with the *ahead* sentence when a row has no file, and refuses when `pos_app`
   cannot read `schema_migration` or the table is missing. (STATE's known limit stands: the check compares names, not
   contents.)

3. **Demonstrable: a menu built in the back office is browsable at the POS, and an 86 reaches a separately signed-in POS
   within three seconds of page time.** Met by `e2e/tests/pos-catalog.spec.ts` P1 (S7b1), in two profiles: the manager
   builds a category and three items through BO-03 and BO-04, the cashier sees exactly those tiles at POS-03 in the
   back office's order, and an 86 made at the back office reaches the tile in place within two seconds of paused page
   time (its reversal too), under a three-second budget, with no restart and no real wait (ADR-011 rule 27). P2 adds
   the focus refresh with no page time spent.

4. **AC-12, Phase 1 part.** Met. In the browser, P1 asserts the 86'd tile keeps its slot (`data-item` order unchanged)
   and is disabled; P8 (S7b2) opens M-2, makes the 86 at the back office, and asserts the sheet keeps its choices, Add
   turns off in place, and Cancel returns to the tile. The in-place layout and the open-sheet notice are covered by the
   POS's served-catalog component tests (`served-menu.test.tsx`, `served-item-sheet.test.tsx`, `served-round2.test.tsx`).
   The add and fire rejections are Phases 2 and 3 (Q13).

5. **AC-31, Phase 1 part: every catalog change advances the catalog version, a stale command is refused with nothing
   written, and the POS projection carries the version.** Met. `catalog.test.ts` (S4a): a stale edit is refused STALE
   with rows and version unchanged, judged before NOT_FOUND, and decided under the coordination lock; `catalog-routes.test.ts`
   case 4 (S4b): each stale versioned route is 409 `CATALOG_CHANGED` with a bare body and writes nothing;
   `discount-presets.test.ts` cases 4 and 5 (S6a): each preset command advances the version by exactly one and a stale
   one is 409 and writes nothing; `pos-catalog-routes.test.ts` (S7a) case 9: the projection's version equals the
   version after every command class, and case 7: version and contents belong together across a concurrent commit.
   The 86 commands advance it as ADR-012 rules (S5). The POS-command rejection is Phase 2's (Q13).

6. **AC-32, first sentence: deactivating a user, resetting their PIN, or setting or resetting their password ends every
   session of that user on its next request; an own password change keeps that one back-office session.** Met.
   `users.test.ts` case 6 and `session.test.ts` case 18 (deactivation); `users-credentials.test.ts` case 2 (a PIN reset
   ends every session), case 3 (a password reset ends every session and leaves the throttle as it was), case 4 (own
   password and own PIN: the acting session continues with the same token, the others end), and the re-stamp scan
   (`restamp-scan.test.ts`). In the browser, `staff.spec.ts` D1 (a deactivated cashier's POS session ends, POS-01
   *session invalidated*), D2 (a reset manager's session in another profile ends, BO-01 *Session ended*) and D3 (an own
   password change keeps this profile and ends the other). (A role change also increments the credential version, by
   the owner's Q1c; the sentence of AC-32 this line measures does not name it.)

7. **AC-35, last sentence: after a 30-minute idle the same manager resumes with the password alone and finds the
   unsaved BO-05 edit; a different manager does not.** Met by `e2e/tests/tables.spec.ts` C1 to C3 (S1b), in a real
   browser with the page clock. S10 added to C3 that BO-01 shows the isolated-draft sentence after the eight-hour end.

8. **FR-B1: a change creates a new settings version, earlier versions are unchanged, exactly one is current.** Met by
   `settings.test.ts` (S2a) S2-9 to S2-17: the first save writes version 1, which is then current; each save writes the
   next and every earlier version reads back column for column; a stale or absent number is `SETTINGS_CHANGED` with
   nothing written; any one field's change makes a version; every version has `calculation_policy` 1.

9. **B-1: no `number` touches money or a rate; amounts cross the API as canonical strings and a JSON number is refused;
   no new column is floating-point, `numeric` or `money`.** Met. `packages/money`'s type tests compile under
   `typecheck`; the codecs refuse a JSON number (`codec.test.ts`, `rate-codec.test.ts`, `money.test.ts`); the contract
   schemas and routes refuse one for prices, deltas, preset amounts and rates (`packages/contracts/test/catalog.test.ts`,
   `apps/server/test/settings.test.ts`, `catalog-routes.test.ts` case 5); `schema.test.ts` case 14 covers every Phase 1 table.

10. **B-7: `pos_app` still cannot UPDATE, DELETE or TRUNCATE `audit_entry`; the privilege-equality test names every Phase 1
    table with exactly its grants; the settings-version table grants only SELECT and INSERT.** Met by `schema.test.ts`
    cases 1, 3 and 6, extended by each slice that added a table (`0009` to `0015`).

11. **B-12: no PIN or password in a log, audit row, telemetry, error body, URL or browser storage, including the new
    routes that carry one.** Met. `log-scan.test.ts` cases 21 to 24 and the S8b block (every credential route and field
    name, at trace, and every response body); `users-audit.test.ts` case 10/12 (no PIN, password, lookup or hash in an
    audit row or response); in the browser, the harness's credential scan after every test, whose map gained every
    Phase 1 credential route (S8c1, S8c2), with every typed credential in the ledger.

12. **B-13: every audit entry Phase 1 writes names a specific actor.** Met. The owner's Q11 answer audits a user's
    status, role and credential changes (DECISIONS 2026-10-20): `users-audit.test.ts` case 10/16 (each successful
    command writes exactly one entry naming the acting manager and the subject; kitchen staff none), case 10 (no entry
    for a no-op, refusal or validation failure) and case 19 (a failed audit insert leaves the user rows unchanged).

13. **B-24: nothing restaurant-specific is hard-coded or seeded; every new configuration table is empty after
    migration; the served POS bundle holds no fixture menu.** Met, with Phase 0's qualification. `schema.test.ts`:
    *is empty after migration* for tables (S1a), tender methods (no cash, no card, S3a), the catalog (C-9), presets
    (S6-1) and settings (S2-8). The built-bundle tests (`apps/pos/test/built-session.test.ts` and
    `built-session-development.test.ts`, through `built-session-support.ts`) prove the served build holds neither
    `FIXTURE_MENU_MARKER` nor `FIXTURE_PRESETS_MARKER` (S7b1, S7b3), as they prove the fixture session
    absent. **The qualification (unchanged from Phase 0):** the served POS still shows client fixtures for the floor,
    orders, payments and approvals under a real sign-in, by the owner's 2026-10-13 ruling; each goes when its server
    command arrives (Phase 2 on).

14. **FR-A2c and ADR-011 rule 1: every route declares its access, configuration routes take only a back-office session
    and POS catalog routes only a POS session, and the route table equals the registered routes.** Met.
    `route-table.test.ts` case 8 (equal in both directions, `interactive` matching); `access.test.ts` (an undeclared
    route stops startup); each Phase 1 route family's refusal case (`catalog-routes.test.ts` 3, `discount-presets.test.ts`
    11, `users-credentials.test.ts` 2, and the tables, settings and tender-methods equivalents): no cookie or a POS
    cookie is 401, a demoted manager 403, a bad anti-CSRF header 403, nothing written; `pos-catalog-routes.test.ts` 1.

15. **NFR-5 and ADR-011 rule 26: the two clients import nothing from each other.** Met by
    `apps/back-office/test/boundaries.test.tsx` (both directions, with a self-test of the scan) and the API-module
    tests that each client holds only its own routes.

## ROADMAP Phase 1, item by item

| Item | Built by | Merged |
|---|---|---|
| Desktop navigation and dense layouts | S1b (the rail, the form pattern), every BO screen after it | #123 on |
| Settings, fixed IDR/0 shown, versioned (FR-B1) | S2a, S2b | #128, #130 |
| Categories, items, variants, modifiers, prices (FR-B4, C1-C4) | S4a, S4b, S4c1, S4c2a, S4c2b | #140 to #149 |
| 86 toggle (FR-B6, C5) | S5 | #151 |
| Tables: create, edit, deactivate (FR-B2) | S1a, S1b | #119, #123 |
| Discount presets (FR-B5) | S6a, S6b (and FE-037) | #154, #157, #159 |
| Tender types (FR-B7) | S3a, S3b | #134, #137 |
| Users, credentials and session ends (FR-B3) | S8a, S8b, S8c1, S8c2 | #173, #174, #177, #178 |
| Catalog propagation to the POS, two-second poll (FR-C6) | S7a, S7b1, S7b2, S7b3 | #165, #169 to #171 |
| Catalog version (FR-C7) | S4a onward, ADR-012 | as above |
| Carry-forwards: housekeeping, POS-03 Release, BO-01 | S0, S9, S10 | #115, #180, #181 |

## Not part of the gate, carried forward

None of these blocks closing Phase 1; each is in STATE.md or QUEUE.md with its pointer.

- **The owner's own look in a browser, still owed:** POS-03's Release (#180) and BO-01 (#181); BO-06 Staff; the served
  POS catalog (the menu, M-2, the preset picker); BO-03 with the 86, BO-04, BO-07 and BO-08's methods. The lead measured
  layouts headless where it could; the look is the owner's. **DESIGN-023 F3** (does a browser offer to save a PIN or
  another person's password typed on Staff?) needs a headed Chrome or Firefox check by the owner.
- **Small tasks queued:** M-6 re-announces its ticking cooldowns (DESIGN-016 N3/F4 not built there); POS-03's bar lacks
  the artifact's order title and order-type tag; the code-point/UTF-16 comment and client-check cleanup; the frame's
  focus after a different manager signs in; extracting the dialog lifecycle and the name check.
- **Known defects (unchanged):** `closeOrder` accepts a non-cash draft above the balance (Phase 4); the
  `session_replication_role` bypass (ADR-008, deferred); the PIN timing leak (§3.2 list); the schema check compares
  names, not contents; one development-only npm advisory.
- **Contract wording owed, not drafted:** ROADMAP Phase 1's users line for role changes (Q1c) and tender "reactivate"
  (OQ1); the PRD lines listed in STATE.
- **Before Phase 2 starts:** Phase 2 needs its own plan (ROADMAP; the architect writes it, as ARCH-017 did). Entry
  conditions already recorded: ARCH-013's owner items 2 and 3 (best-effort cancel reports; no Cancel while verifying);
  FR-M3/B-2's rounding wording against the code's half away from zero; the Pergub 35/2024 Pasal 8 ruling before a
  non-zero service charge is used (Q3); the order between opening an order (which captures a settings version) and the
  business day, which ROADMAP places in Phase 5 (plan §1.3). Phase 2 also takes AC-31, AC-32's second sentence, the
  FR-C8 table refusal, AC-12's add rejection, AC-27's second sentence, M-1 and the idempotency design.

## What the owner decides

Close Phase 1 on this report, or name what is missing. If closed, the next step is commissioning the Phase 2 plan.
