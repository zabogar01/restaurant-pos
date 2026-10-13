---
id: PHASE0-011b
title: The session clock and the route table on the wire
category: feature
touches: [identity]
depends_on: [PHASE0-010b]
owns: [apps/server/**, packages/contracts/**]
status: complete
cycles: 1
---
# PHASE0-011b — The session clock and the route table on the wire

**Written** 2026-10-13 by the lead, from the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, by `architect14`, 2026-10-13), which supersedes plan
Task 11. **Do not copy anything from plan Task 11.** This is the second of four slices (011a to
011d); it shares no file with 011a, which may be running at the same time. It changes
`domain/session.ts`, a reviewed identity module, and is kept thin so its review looks at nothing
else. Touches identity: the owner looks before merge. The consult's binding sections are copied
below **verbatim**, with their headings moved down one level; the numbered "questions" they refer to
are the consult's sections, and where a copied section mentions 011a, 011c or 011d, that is other
work and not this task's.

## Objective

A client cannot show an honest idle countdown today: `SessionView` says who is signed in but not how
long the session lasts or how much of it is left, and a hard-coded 90 or 1800 is wrong after a
reload. When this task is done, every session view the server returns (sign-in, `me`,
re-authentication, on both surfaces) also carries `idleSeconds`, the audience's limit from
`SESSION_POLICY`, and `idleRemainingSeconds`, computed by PostgreSQL from `clock_timestamp()` in the
statement that judged the session, rounded down and clamped. `@pos/contracts` gains the data the
clients will need in 011c: the route table (method, path, whether interactive) for health and both
surfaces, held equal to the registered routes by a server test; zod schemas for both session views
and the error envelope; and the header name `X-RPOS-CSRF` as a constant the session guard imports. No
code is added and no other behaviour changes.

## Required inputs

- **The consult's sections copied below.** They are the specification.
- **PHASE0-007 and 009a/009b as merged** (task files and Handoffs in `.agent/tasks/`):
  `apps/server/src/domain/session.ts` (`SESSION_POLICY` at `:8-13`, "these exist nowhere else" at
  `:7`; the shared `VALID` predicate at `:64-70` and `NOT_IDLE` at `:71`; `resolveSession` at
  `:103-146`, whose active statements are at `:113-130` and idle check at `:136-142`;
  `reauthenticateSession` at `:151-172`; `createSession`, which uses SQL `now()` at `:87`); the session
  guard (`http/session-guard.ts`, which reads the `X-RPOS-CSRF` header); the route declarations
  (`http/access.ts`); the routes (`http/routes/pos-auth.ts`, `http/routes/back-office-auth.ts`,
  `http/routes/health.ts`); `packages/contracts/src/session.ts` (`SessionView`,
  `BackOfficeSessionView`), `errors.ts` (`ErrorCode`, `ErrorBody`), `auth.ts`, `index.ts`; the jar
  client and people helpers in `apps/server/test/support/`.
- **PHASE0-010b:** its probe route is registered only by `approval-route.test.ts` through
  `buildServer({ apiRoutes })`; it must not enter the route table.
- **Contract:** PRD FR-A2, FR-A2b, FR-A2c, AC-28; ADR-009; ADR-010; `docs/ARCHITECTURE.md` §7.2 and
  §14.4; `docs/BOUNDARIES.md` B-13, B-24.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time; where the moment matters, use
  `clock_timestamp()`, as `NOT_IDLE` already does.

## From ARCH-014, question 6: SessionView does not carry what the client needs (verbatim; binding)

#### `SessionView` does not carry what the client needs

It has `staffUserId`, `name`, `role` and `csrfToken`. Nothing tells the client how long the
session lasts or how much of that is left. A client could hard-code 90 and 1800, but
`session.ts:7` says of those numbers "these exist nowhere else", and a hard-coded limit still
cannot answer the case that matters: after a reload, `me` succeeds on a session that may have
five seconds left, and a client that started its countdown at 90 would show eighty-five seconds
the server has already taken away. That is exactly what ARCH-012 warned against.

**`SessionView` gains two numbers. This is a Task 11 server change (slice 011b).**

```ts
export interface SessionView {
  staffUserId: string;
  name: string;
  role: 'CASHIER' | 'MANAGER';
  csrfToken: string;
  /** This audience's idle limit in whole seconds, from the server's session policy. */
  idleSeconds: number;
  /**
   * Whole seconds until this session idles, rounded down, computed by PostgreSQL in the
   * statement that resolved it. Never more than idleSeconds, never less than 0.
   */
  idleRemainingSeconds: number;
}
```

`idleRemainingSeconds` is computed in SQL from `last_interactive_at`, the audience's limit and
`clock_timestamp()`, in the same statement that judged the session, so the limit and the answer
cannot disagree. It is rounded **down**, so the client never shows more than the server will
give. On a sign-in and on a re-authentication it equals `idleSeconds`. Both are durations, not
instants: the browser's wall clock is never compared with the server's. The back office's eight
hours are not sent; M-6 learns of them from `UNAUTHENTICATED`, and no screen draws them.

Nothing else on the server changes. `activity` stays a 204 with no body.

## From ARCH-014, question 3, mechanism 3: the route table (verbatim; binding)

3. **A server route that no client declares fails the build.** 011b puts the route table in
   `@pos/contracts`, and a server test holds the registered API routes equal to it in both
   directions. Each client's API module maps every route of its surface to a function through an
   exhaustive mapped type. When Phase 2 adds `POST /api/pos/orders`, the server test fails until
   the table has it, and then the POS fails to compile until its API module does. That is the
   moment the builder must wire the call and delete the stand-in, in the same task, as the owner
   ruled for each stand-in (2026-10-01 to 2026-10-03). It cannot prove that a declared function is
   used by a screen; review does that.

## From ARCH-014, question 4: what goes in @pos/contracts (verbatim; binding)

**In `@pos/contracts`:** only data. The `SessionView` change of question 6; zod schemas for the
two session views and for the error envelope, so that a client validates what it receives at its
boundary as the server validates what it is sent (§2.1); the header name `X-RPOS-CSRF` as a
constant the server and the core both import; and the route table. No function that performs a
request belongs there: the server imports that package.

## From ARCH-014, For the task file: PHASE0-011b (verbatim; binding)

#### PHASE0-011b: rules

1. `SessionView` gains `idleSeconds` and `idleRemainingSeconds`, as in question 6.
2. `idleRemainingSeconds` is computed by PostgreSQL in the statement that judged the session,
   from `clock_timestamp()`, rounded down, clamped to `0..idleSeconds`. No JavaScript clock is
   read. `idleSeconds` comes from `SESSION_POLICY` and from nowhere else.
3. `activity`, `release` and `logout` are unchanged.
4. `@pos/contracts` gains: the route table (method, path, `interactive`) for health and both
   surfaces; zod schemas for both session views and for the error envelope, with the existing
   type names kept; and the header name `X-RPOS-CSRF` as a constant that `session-guard.ts`
   imports.
5. A server test holds the registered API routes equal to the table, in both directions, and for
   each `ACTIVE` route holds the table's `interactive` equal to the route's declaration. The
   probe route of 010b's tests is not in the table and is registered only by its test.
6. No error code is added.

#### PHASE0-011b: test cases

1. A POS sign-in returns `idleSeconds` equal to the policy and `idleRemainingSeconds` equal to it.
2. `me`, after the session is aged by *n* seconds in the database, returns `idleRemainingSeconds`
   within one of the policy less *n*, and never more than the policy.
3. `me` does not move it: two reads a moment apart do not increase the number.
4. `activity` then `me` returns it to the policy (within one).
5. A session aged to one second short of the limit returns 0 or 1, never a negative number; aged
   past the limit, the answer is `SESSION_IDLE` as before.
6. The same five for the back office, with its policy; and a re-authentication returns the policy.
7. Both numbers are integers; the response has exactly the six keys (seven at the back office).
8. The route table equals the registered routes; removing an entry, or adding a route without
   one, fails.
9. `error-details.types.ts` and every existing route test still pass; those that compare a
   session view whole are updated and listed in the Handoff.

#### PHASE0-011b: red proofs

- Compute the remaining time from `Date.now()`: case 2 passes by luck but the source scan for a
  JavaScript clock in `session.ts` fails. (Add that scan.)
- Round up instead of down: case 5 fails.
- Mark `me` interactive in the table: case 8 fails.

## From ARCH-014, The Handoffs must carry forward (verbatim)

#### The Handoffs must carry forward

- For Task 12: the accessible names and the two data attributes; `build:clients`; the four things
  it does not have (question 10); the outcome of the browser check.
- For Phase 1's first form: it mounts inside the keyed working area and inherits M-6; AC-35's
  last sentence closes there, in a browser.
- For Phase 2's first command: add it to the route table as interactive; the POS will not compile
  until its API module declares it; delete the stand-in in the same task; M-1's three changes in
  question 8; the "certainly not applied" against "unknown" question of ARCH-012 §5 is still open
  and rule 7 does not answer it.
- For every later client screen: one request path; switch on the code; no copy without the
  designer; no fixture in a served build.

## Lead rulings

These rulings are addressed to the builder.

1. **Files.** `packages/contracts/src/session.ts` (the two numbers, the zod schemas, the types inferred
   or kept under their existing names), a new `packages/contracts/src/routes.ts` (the route table) and
   `index.ts` exports; the `X-RPOS-CSRF` constant where the contracts package keeps its other shared
   names; `apps/server/src/domain/session.ts` (the SQL); whichever of `http/session-guard.ts` and the
   two route files build a session view; tests in a new `apps/server/test/session-clock.test.ts`
   (cases 1 to 7) and a new `apps/server/test/route-table.test.ts` (case 8), each test name starting
   with the consult's case number.
2. **The route table's `interactive` for a route that is not `ACTIVE`** (health, the sign-ins) is
   `false`. For each `ACTIVE` route it equals the route's declaration, as rule 5 says.
3. **How the test reads the registered routes** (an `onRoute` hook, `printRoutes`, or another means
   Fastify 5 provides) is your choice; build the server without `apiRoutes`, so no probe is present.
   Ask the librarian if unsure, and say in the Handoff which you used.
4. **The red proof's source scan** (no JavaScript clock in `domain/session.ts`) is a new case in
   `apps/server/test/session-scan.test.ts`, matching `Date.now`, `new Date(` and `performance.now`.
   It must not match SQL `now()`: `createSession` at `:87` uses it for the absolute expiry and is out
   of scope here.
5. **Aging a session in a test** is an update of `actor_session.last_interactive_at` over the owner
   connection, as the existing session tests already do; reuse their helper if there is one.
6. **`activity`, `release`, `logout` and every error answer are unchanged** (rule 3). Only the
   session view grows.
7. **The owner's rulings on ARCH-014 (2026-10-13) do not change this task.** Build to the consult.
8. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
9. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
   observed. Do not work around a rule.
10. **The database is already up** (`restaurant-pos-db-1` on port 5433, shared by every worktree). Do
    not run `npm run db:up` or `docker compose` in this worktree.

## Constraints

- ARCHITECTURE §14.4: the browser clock never becomes an authority; no JavaScript clock is read for
  the session. `SESSION_POLICY` stays the only place the limits live (B-24).
- FR-A2b and AC-28: `me` stays non-interactive; nothing in this task extends a session that did not
  extend before.
- ADR-010: handlers write no error body; no code is added (rule 6 of the consult's 011b rules).
- No migration.

## Tests expected to change

The explorer found the exact-key assertions on a session view; each gains `idleSeconds` and
`idleRemainingSeconds`, and nothing else in those tests changes:

- `apps/server/test/pos-sign-in.test.ts:78` (case 1).
- `apps/server/test/back-office-sign-in.test.ts:62` (case 12).
- `apps/server/test/reauthenticate.test.ts:103` (case 18).
- `apps/server/test/session-guard.test.ts:223` (case 9, both audiences).
- `apps/server/test/session-scan.test.ts`: one new case (lead ruling 4); additions only.
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline.
   **Baseline (lead, 2026-10-13):** `development` at `91f79bc` (code identical to `e52d0a4`), 66 test
   files and 3252 tests, green.
2. Each new test file alone is green three times in a row; the Handoff maps each case number (1 to 9)
   to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rnE "Date\.now|new Date\(|performance\.now"
   apps/server/src/domain/session.ts` (nothing); `grep -rn "x-rpos-csrf" -i apps/server/src` (only the
   import of the constant, no string literal); `grep -rnE "\b(90|1800|28800)\b" apps/server/src`
   (only `SESSION_POLICY`).
5. The Handoff shows one real `me` response body from the jar client, before and after aging the
   session.
6. The Handoff carries forward the items under *The Handoffs must carry forward* that concern 011b,
   and says what 011c (the POS signs in) needs from this task that it does not have.

## Out of scope

- Serving bundles and the error handler outside `/api` (011a).
- `@pos/api-client`, any client source (011c, 011d).
- The back office's eight-hour absolute limit on the wire (the consult says it is not sent).
- Any migration, any new error code, `docs/` of any kind, the ADR.

## Lead ruling on the BLOCKED (2026-10-13)

Addressed to the builder.

1. **Yes, change `apps/server/test/session.test.ts` case 5 (lines 159 to 164), and nothing else in that
   file.** The ACTIVE resolution carrying `idleRemainingSeconds` is what the consult requires, so the
   whole-object `toEqual` must include it. Use your proposed `idleRemainingSeconds: expect.any(Number)`,
   and follow it with assertions that are **required**, not optional: the value is an integer, at least 0,
   and at most `SESSION_POLICY.POS.idleSeconds`. Do not pin 89 or 90.
2. Add `apps/server/test/session.test.ts` (case 5 only) to the list under *Tests expected to change* in
   your Handoff's account of changed tests.
3. Keeping `Actor` unchanged and carrying the number on a separate request decoration is accepted.
4. Then run `npm run verify`, commit on this branch with path-scoped `git add` (your Handoff edits
   included), and finish the Handoff with the counts and DONE.

## Round 2 — the review's finding (lead rulings, 2026-10-13)

The review is `.agent/reviews/PHASE0-011b-review.md` (Codex, one P2). Addressed to the builder.

1. **The finding is accepted: fix it.** The exported `ErrorBody` schema must parse to the existing
   discriminated `ErrorBody` type: each envelope keeps its own code literal and its own details shape, so
   a parsed result is assignable to `ErrorBody`, and narrowing on a detail-bearing code (`THROTTLED`,
   `INVALID_CREDENTIALS`, `APPROVAL_FAILED`, `APPROVAL_THROTTLED`) exposes `details.retryAfterSeconds`,
   while a code without details exposes no `details`. Keep the strict runtime rejection of unexpected
   fields and the `satisfies` link to `ErrorDetailsByCode`. 011c's client depends on this.
2. **Prove it at compile time.** Add the reviewer's two scenarios to
   `apps/server/test/error-details.types.ts` (additions only), or to a new types-only test file in
   `packages/contracts` if that is where the contracts package is typechecked; one assertion that the
   parse result is assignable to `ErrorBody`, one that narrowing exposes `details` for a detail-bearing
   code, and a `@ts-expect-error` that a code without details has none. Show them failing on the current
   code before the fix.
3. **Acceptance criterion 2, as written:** run `session-clock.test.ts` alone three times in a row and
   `route-table.test.ts` alone three times in a row, and show each result.
4. Everything else in round 1 stands. Append a *Round 2* section to the Handoff, commit after
   `npm run verify` is green, and end with DONE or BLOCKED as before.

## Handoff

**Status: done and committed on `agent/phase0-011b`.** The first round stopped on one unlisted test; the
lead ruled yes (see *Lead ruling on the BLOCKED*), I applied it, and verify is green.

### The blocker (resolved by the ruling above)

`apps/server/test/session.test.ts:159` (case 5, "a fresh session resolves ACTIVE with the user and
role") does `expect(await resolveSession(token, 'POS', false)).toEqual({ status, sessionId,
staffUserId, role })`. The task requires the statement that judges the session to return the remaining
seconds, so the ACTIVE resolution gains `idleRemainingSeconds` and a strict `toEqual` fails. Real output:
`+ "idleRemainingSeconds": 89` is the only difference. (A fresh `createSession` followed by a
`resolveSession` a few milliseconds later reads 89, not 90: the value is rounded down, as the task says.
The sign-in response itself returns 90, which is what case 1 holds.)

I looked for a way to keep that test untouched and found none that is not a hack: carrying the number
out of `resolveSession` needs either a new field on the ACTIVE resolution (this test fails) or a second
exported function (case 31 of the same file, "the module exports exactly the specified names", then
fails). I chose the first and kept `Actor` unchanged, so `session-guard.test.ts` case 9's whole-actor
`toEqual` still passes; the number travels on a separate request decoration, `idleRemainingSeconds`.

**Proposed resolution (exact line).** In `apps/server/test/session.test.ts`, replace lines 159 to 164 with:

```ts
    expect(await resolveSession(issued.token, 'POS', false)).toEqual({
      status: 'ACTIVE',
      sessionId: issued.sessionId,
      staffUserId: cashierId,
      role: 'CASHIER',
      idleRemainingSeconds: expect.any(Number),
    });
```

Optionally also assert the range in a following line (`<= SESSION_POLICY.POS.idleSeconds`, `>= 0`); the
exact value is 89 or 90 depending on timing, so it must not be pinned. Once ruled, I apply it, run verify,
and commit; nothing else is outstanding except the Handoff counts.

### What I did (all uncommitted)

- `packages/contracts/src/session.ts`: `SessionView` and `BackOfficeSessionView` become zod strict
  objects with `idleSeconds` and `idleRemainingSeconds` (non-negative integers); the TypeScript types
  keep their names, inferred.
- `packages/contracts/src/errors.ts`: a zod `ErrorBody` schema beside the existing `ErrorBody` type
  (same name, value and type). One strict envelope per code; `details` allowed only on the four codes
  of `ErrorDetailsByCode`, held equal to it by a `satisfies Record<keyof ErrorDetailsByCode, true>`.
- `packages/contracts/src/headers.ts` (new): `CSRF_HEADER = 'X-RPOS-CSRF'`.
- `packages/contracts/src/routes.ts` (new): `ROUTE_TABLE` of ten entries (method, path, `interactive`),
  health plus both surfaces; `RouteEntry` and `RouteMethod` types. The probe route is not in it.
- `packages/contracts/src/index.ts`: exports the above.
- `apps/server/src/domain/session.ts`: `IDLE_REMAINING` SQL fragment
  (`LEAST($3, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM last_interactive_at + limit - clock_timestamp()))))`),
  returned by the active statements (SELECT, and the UPDATE's RETURNING, where `s` is the new row so an
  interactive resolution reads the full limit). `SESSION_POLICY` untouched and still the only place the
  limits live; `createSession` untouched.
- `apps/server/src/http/session-guard.ts`: imports `CSRF_HEADER` (no literal left); the guard stores the
  number on `request.idleRemainingSeconds`; new `idleClockOf(request)` returns `{ idleSeconds (from
  SESSION_POLICY), idleRemainingSeconds }`; `signIn` and `renewSession` also return both numbers, equal to
  the policy, which is what the consult says a sign-in and a re-authentication return.
- `apps/server/src/http/routes/pos-auth.ts`, `back-office-auth.ts`: the four views that build a session
  view carry the two numbers. `activity`, `release`, `logout` and every error answer are unchanged.
- Tests: new `apps/server/test/session-clock.test.ts` (cases 1 to 7, both audiences, 13 tests) and
  `apps/server/test/route-table.test.ts` (case 8, 3 tests); one added case in
  `apps/server/test/session-scan.test.ts` (`11b.`, the JavaScript-clock scan).

### Decisions and evidence

- **How the test reads the registered routes:** an `onRoute` hook added to the app returned by
  `buildServer` before `ready()`. Fastify registers the `/api` context at `ready()`, so the root hook sees
  every route with its full path and `config.access`. HEAD twins that Fastify adds for GET are skipped.
  The server is built without `apiRoutes`, so no probe is registered. I did not need the librarian.
- **The table has no `surface` field**, only method, path and `interactive` as the consult says. A client
  maps by `"METHOD path"`.
- **Case 5 and case 2 are tighter than the consult** so the round-down is provable: aged by *n*, the value
  must be strictly below `policy - n` (within one still holds); aged to one second short of the limit, it
  must be exactly 0. Both are sound because the test's own latency is far under a second, and a latency
  over a second fails earlier as `SESSION_IDLE`. Without this, "round up" passes case 5, because 0.99
  rounds to 1 and `{0, 1}` accepts it.
- **Case 6** (re-authentication returns the policy) is in `session-clock.test.ts`; its remaining value is
  the constant from `SESSION_POLICY`, not a SQL result, since the same statement just set
  `last_interactive_at` to the clock.

### Existing tests changed

Exact-key assertions, each gaining `idleRemainingSeconds` and `idleSeconds` and nothing else:
`pos-sign-in.test.ts:78`, `back-office-sign-in.test.ts:62`, `reauthenticate.test.ts:103`,
`session-guard.test.ts:223` (both audiences); and the additions to `session-scan.test.ts`. No other
existing test was changed except `session.test.ts` case 5 (lines 159 onwards), changed under the lead's
ruling: the whole-object `toEqual` now also lists `idleRemainingSeconds: expect.any(Number)`, followed by
required assertions that the value is an integer, at least 0 and at most `SESSION_POLICY.POS.idleSeconds`;
nothing else in that file changed. I did not touch `error-details.types.ts`; it passes.

### Red proofs (each made, run, reverted)

1. **JavaScript clock:** added `const PROOF = Date.now();` to `domain/session.ts`; `session-scan.test.ts`
   case `11b.` failed with `expected '...' not to match /Date\.now|new Date\(|performance\.now/`.
   Reverted. (Note on my own edit: the revert initially left `TOKEN_SHAPE =/^`; I restored the space and
   the file now reads as in `development` apart from the intended change.)
2. **Round up** (`FLOOR` to `CEIL`): `session-clock.test.ts` failed 4 tests, case 2 (`aged 1: expected 89
   to be less than 89`, and `1799 ... 1799` at the back office) and case 5 (`expected 1 to be +0`), on both
   audiences. Reverted.
3. **`me` interactive in the table:** `route-table.test.ts` failed with `GET /api/pos/auth/me: expected
   true to be false`. Reverted. Also removed the `release` entry: both-directions test failed with
   `registered but not in the table: [ 'POST /api/pos/auth/release' ]`. Restored.

### Grep output

- `grep -rnE "Date\.now|new Date\(|performance\.now" apps/server/src/domain/session.ts`: no output.
- `grep -rniE "x-rpos-csrf|CSRF_HEADER" apps/server/src`: only `session-guard.ts:3` (the import), `:45`
  (`CSRF_HEADER.toLowerCase()`) and `:95` (the read). No string literal.
- `grep -rnE "\b(90|1800|28800)\b" apps/server/src`: only `domain/session.ts:11` and `:12`
  (`SESSION_POLICY`).

### A real `me` body, POS, from the jar client

Before: `{"staffUserId":"65d839c4-dd99-40e5-8aff-29013c82f4c9","name":"Person 670001","role":"CASHIER","csrfToken":"tiPtt75xTnGc7wG7JI0QLHfdhjCQfju0jEf6vup7ygk","idleSeconds":90,"idleRemainingSeconds":89}`
After `ageSession(id, 40)`: the same with `"idleRemainingSeconds":49`.
(Produced by a throwaway test, deleted; the csrfToken is a test value.)

### verify

`npm run verify` after the lead's ruling: typecheck clean; `vitest run`: 68 test files, **3269 tests, all
passed**. (Before the ruling it was 3268 passed and 1 failed, `session.test.ts` case 5.) Baseline was 66 files and 3252 tests, green; the difference is 17
new tests: 13 in `session-clock.test.ts`, 3 in `route-table.test.ts` and 1 scan case (3252 + 17 = 3269). `session-clock.test.ts` and `route-table.test.ts` run together
were green three times in a row (16 tests each time).

### For the next agent

- 011c needs from this task: `SessionView` with the two numbers, `ROUTE_TABLE`, `CSRF_HEADER`, and the
  `ErrorBody` and view zod schemas, all from `@pos/contracts`. It does not have a client-side clock rule:
  the countdown must start from `idleRemainingSeconds` of the latest view and count down locally in
  durations only; a `me` read after a reload is the only way to resynchronise, and `activity` is a 204 with
  no body (the client resets to `idleSeconds`, then a `me` read confirms).
- The back office's eight hours are not on the wire, as the consult says.
- For Phase 2's first command: add it to `ROUTE_TABLE` with `interactive: true`; the route-table test
  fails until you do.
- The `ErrorBody` schema is for validation; its inferred type is deliberately not exported under that
  name, the precise mapped type is.
- No formatter was run. No browser was used.

### Case map (acceptance 2)

In `session-clock.test.ts`, each test runs on both audiences: 1 `1. a sign-in returns idleSeconds equal
to the policy ...`; 2 `2. me, after the session is aged by n seconds ...`; 3 `3. me does not move it
...`; 4 `4. activity, then me, returns it to the policy within one`; 5 `5. one second short of the limit is
0 or 1 ...`; 7 `7. both numbers are integers and the response has exactly the expected keys`; 6 `6. a
re-authentication returns the policy for both numbers`. Case 8 in `route-table.test.ts`: three tests
named `8. ...`. Case 9: the existing suite, green (68 files). The JavaScript-clock scan is `11b.` in
`session-scan.test.ts`.

### Round 2 — the review's P2 finding

**What was wrong.** My `envelope(code: ErrorCode)` took the whole union, so each `z.literal(code)` was typed
as `ErrorCode` and the exported `ErrorBody` schema parsed to `{ error: { code: ErrorCode } }`: not
assignable to the `ErrorBody` type, and narrowing on `THROTTLED` exposed no `details`. The reviewer was right.

**The fix** (`packages/contracts/src/errors.ts` only). The schema is now a `z.union` of fifteen envelopes
written out, one per code. Eleven use `bare(code)` (generic `C extends ErrorCode`, so the literal keeps its
own type); four use `withRetry(code)` (`C extends keyof ErrorDetailsByCode`, `details` optional
`{ retryAfterSeconds }`). The four are collected in a `WITH_DETAILS` object held to `ErrorDetailsByCode` by
`satisfies Record<keyof ErrorDetailsByCode, z.ZodType>`; the former `DETAIL_CODES` list and the
`as unknown as` cast are gone. Every envelope is still a strict object, so unexpected fields are still
rejected at runtime. A type-level `Mutual<z.infer<typeof ErrorBody>, ErrorBody>` must be `true`, so the
schema's output and the type are mutually assignable and a code missing from the union fails to compile.

**Compile-time proofs** (additions only to `apps/server/test/error-details.types.ts`, which `npm run
typecheck` compiles; one added import, `ErrorBody as ErrorBodySchema`, and one function at the end):
`parsedErrorBodyKeepsItsCodes` assigns `ErrorBodySchema.parse(input)` to a `const parsed: ErrorBody`
(assignability); narrows on `ErrorCode.THROTTLED` and returns `parsed.error.details?.retryAfterSeconds`
(details exposed for a detail-bearing code); and has a `@ts-expect-error` on the same read after narrowing
to `ErrorCode.INTERNAL` (no details on a code that declares none).

**Failing before the fix** (the new proofs added, `errors.ts` still the round-1 version):
`npx tsc -p apps/server --noEmit` exited 2 with
`apps/server/test/error-details.types.ts(265,9): error TS2322: Type '{ error: { code: ErrorCode; }; }' is
not assignable to type 'ErrorBody'.` Only that error was reported: after the assignment the narrowing was
already unsound, so it is the same defect.

**Red proof for the completeness assertion.** Removed `bare(ErrorCode.FORBIDDEN)` from the union:
`npx tsc -p packages/contracts --noEmit` failed with
`packages/contracts/src/errors.ts(101,53): error TS2344: Type 'false' does not satisfy the constraint
'true'.` Restored.

**After the fix:** `npm run typecheck` clean (the `@ts-expect-error` is used, so the no-details proof holds);
`npm run verify`: 68 test files, 3269 tests, all passed (round 1 counts; no runtime test was added, the
proofs are compile-time).

**Acceptance criterion 2, each new file alone, three runs in a row**, all green:
`session-clock.test.ts`: 13 passed, 13 passed, 13 passed (3.62 s, 3.56 s, 3.53 s);
`route-table.test.ts`: 3 passed, 3 passed, 3 passed (257 ms, 247 ms, 291 ms).

**For 011c:** `ErrorBody.parse(x)` now returns the `ErrorBody` type; switch on `error.code` and read
`error.details?.retryAfterSeconds` for the four detail-bearing codes.

DONE
