---
id: PHASE0-011b
title: The session clock and the route table on the wire
category: feature
touches: [identity]
depends_on: [PHASE0-010b]
owns: [apps/server/**, packages/contracts/**]
status: not-started
cycles: 0
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

## Handoff
