---
id: PHASE0-010b
title: Inline manager approval — the HTTP adapter
category: feature
touches: [audit, identity, boundaries]
depends_on: [PHASE0-010a]
owns: [apps/server/**, packages/contracts/**]
status: review
cycles: 0
---
# PHASE0-010b — Inline manager approval: the HTTP adapter

**Written** 2026-10-12 by the lead, from the architect consult ARCH-013
(`.agent/reviews/ARCH-013-manager-approval.md`, by `architect13`, 2026-10-12), which supersedes plan
Task 10. Do not copy anything from plan Task 10. This is the second half of the split: PHASE0-010a
(merged as PR #82) built migration `0008` and the domain primitive. This task adds the two approval
codes, the `ManagerPin` field schema, the one mapping in `http/approval.ts`, and proves them through a
**test-only probe**. It adds **no production route**. The consult's binding sections are copied below
**verbatim**, with their headings moved down one level; the numbered "questions" they refer to are the
consult's sections. Touches identity, audit, B-13 and B-14: the owner looks before merge.

## Objective

A gated command (Phase 2 on) will take `managerPin` in its own body, build an `ApprovalRequest` from the
session's actor, call `withManagerApproval`, and turn the outcome into its response through one function.
This task builds that function and its contract: `APPROVAL_FAILED` (403, with `retryAfterSeconds` only
when the failure started the cooldown) and `APPROVAL_THROTTLED` (429, always with `retryAfterSeconds`)
in `@pos/contracts`; a strict `ManagerPin` field schema; and `http/approval.ts`. A probe route,
registered only in the test file through `buildServer({ apiRoutes })`, proves through `inject()` and the
jar client against the real tables as `pos_app` that the session guard runs before any PIN is verified,
that every failed PIN gets one byte-identical answer, that an approval failure never ends the cashier's
session, that no session approves anything, and that AC-19 holds through the routes. When this task is
done, AC-19 and the Phase 0 part of AC-27 close as far as the consult's question 9 table says.

## Required inputs

- **PHASE0-010a as merged** (its task file in `.agent/tasks/`, the whole Handoff, rounds 1 and 2):
  `withManagerApproval`, `ApprovalRequest`, `ApprovalOutcome`, `recordApprovalCancelled`
  (`domain/approval.ts`); `APPROVAL_THROTTLED` in `audit.ts` and migration `0008`; the
  `approval_probe`-style test table in `approval.test.ts` (a test-local construction, not a migration);
  case 23's source scan. Its Handoff section *What PHASE0-010b needs and does not have* is binding here.
- **PHASE0-009a and 009b** (their Handoffs and lead rulings): `config.access` declarations and the
  startup refusals (`http/access.ts`), the session guard, `actorOf` and `csrfTokenOf`
  (`http/session-guard.ts`), `parseBody` (`http/validate.ts`), `verifiedUser` (`http/verification.ts`,
  the pattern `http/approval.ts` follows), the jar client with its sign-in helpers
  (`test/support/client.ts`), `makePeople` and `ageOutPinCooldown` (`test/support/people.ts`), the
  credential routes' tests (the patterns for byte-identical failures, cooldowns and rebuilt servers).
- **PHASE0-008a and 008b:** `buildServer` and its `apiRoutes` option (`server.ts:30`, registered inside
  the `/api` context after the origin, client-instance and session hooks, `:97-100`; `server.test.ts:13-33`
  uses it), `AppError` (the status is an argument at each throw site; there is no code-to-status map),
  the log rules (`log.ts:91` already lists `managerPin` among the redacted keys). Use `inject(app, …)`
  from `test/support/request.ts`, never `app.inject`.
- **Contract:** PRD FR-A2c, FR-A5, FR-A6, FR-J3, FR-J4, AC-18, AC-19, AC-27; ADR-007; ADR-010 (the six
  rules); `docs/ARCHITECTURE.md` §7.1, §13; `docs/BOUNDARIES.md` B-11 to B-14, B-24.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time. This task should need no SQL that
  reads a clock; `session-scan.test.ts` case 24 already forbids a bare `now()` under `src/http`.

## From ARCH-013 (verbatim; binding)

### 4. Who may approve

**Authority:** ARCHITECTURE §7.1; owner, 2026-09-10 (self-approval); ARCH-007 §6; ARCH-012 §6;
ADR-009 §1; `throttle.ts:51-60`; `pin.ts:85-104`.

| The PIN in the request | Throttle result | Counts in `MANAGER_APPROVAL`? | Audit entry |
|---|---|---|---|
| Not exactly six ASCII digits as a string, or absent | Never reached: the route's schema answers 400 `VALIDATION_FAILED` | No | **None** |
| Matches no active user | `FAILED` | Yes | `APPROVAL_FAILED` |
| A deactivated manager's (or anyone deactivated) | `FAILED` (`findUserByPin` selects active users only) | Yes | `APPROVAL_FAILED` |
| An active cashier's, the actor's own included | `FAILED` (the role rule) | Yes, and it never resets the count | `APPROVAL_FAILED` |
| An active manager's, not the actor | `VERIFIED`; the class resets | No | `SUCCESS`, approver named (if the work commits) |
| The actor's own, the actor being an active manager | `VERIFIED` | No | `SUCCESS`, `approver_id = actor_id` |
| Anything, while the class is cooling down | `THROTTLED`; nothing is verified | No; the cooldown is not extended | `APPROVAL_THROTTLED` |

**A malformed PIN writes no audit entry.** It is not an approval outcome: no PIN was offered that
could be anyone's. Counting it would let a client bug lock every manager approval in the restaurant
for five minutes, which is why ARCH-012 §6 refused it before the throttle at sign-in; the same
reasoning holds here, and the answer during a cooldown is still 400, not 429. If a malformed PIN
ever reaches the domain function by another road, it is a failed verification like any other
(ARCH-007 §7) and is counted and audited as one.

**How the class "enforces its role rule" (ADR-009).** In one place: `throttle.ts:52`, inside the
locked transaction, so that a cashier's valid PIN is a counted failure and can never reset the
count. The approval module must not repeat the test as a rule. It does assert it: if
`verifyPinThrottled('MANAGER_APPROVAL', …)` ever returns `VERIFIED` with a role other than
`MANAGER`, that is a defect in the throttle, and the primitive throws a plain error and does not run
the work. It never turns that into `APPROVAL_FAILED`, because the count has already been reset.

**All four kinds of failure get one answer.** `FAILED` does not say whether the PIN matched nobody,
a cashier or a deactivated user, and the HTTP mapping must not either (question 6). A distinct
answer for "that is a cashier's PIN" would confirm that a PIN is live, and a cashier's PIN is what
lets someone act under another person's name (B-13).

### 6. Routes in Phase 0

**Authority:** B-14; ARCHITECTURE §7.1, §13; ARCH-012 §4, §5; ADR-010; `packages/contracts/src/errors.ts`
("a code with no emitter is an untested promise"); `server.ts:29-30` (`apiRoutes`).

#### No production route

Task 10 registers **no** route in `buildServer`'s own list. The reasons are B-14's:

- **A verify-only route is an approval with no action.** It answers "yes, a manager approved" and
  the client must then be trusted to attach that to a later request. Whatever carries it (a token,
  a flag, a window of time) is the cached approval B-14 forbids. The design avoids it by never
  having a route whose only effect is to verify a manager PIN: the PIN travels in the body of the
  gated command and is consumed by `withManagerApproval` in that request.
- **Such a route is also a PIN oracle with no cost of acting.** A gated command at least needs a
  real subject in a state that allows the action.

#### What ships instead: the adapter, proved through a probe

The HTTP half is decided now, because the designer, the POS client and every Phase 2 command would
otherwise each decide it again. It is built in **PHASE0-010b** and exercised through a **test-only
probe**: a route registered in the test file with `buildServer({ apiRoutes: [probe] })`, the
mechanism six existing test files already use. The probe is declared
`{ session: 'ACTIVE', audience: 'POS', interactive: true }` under `/api/pos/`, takes a body with
`managerPin`, calls `withManagerApproval` with a literal action, and its work writes one row the
test can look for. It is not in `src/`.

The codes therefore have an emitter that is tested (`http/approval.ts`), which satisfies the rule
in `errors.ts`, and no production surface exists that could be misused before a real command does.

**The body field.** `managerPin`, at the top level of the gated command's body:
`z.string().regex(/^[0-9]{6}$/)`, the same rule as `PosLoginRequest.pin`. Export the field schema
once from `@pos/contracts` (for example `ManagerPin`) so Phase 2's command schemas compose it. The
name is already in the logger's redaction backstop (`log.ts:91`), though no body reaches a logger
in any case. Schemas are strict: an `actorId` or `approverId` key in a body is a 400.

**Codes and statuses.**

| Situation | Status | Code | `details` |
|---|---|---|---|
| The body does not fit the schema (no `managerPin`, a malformed one, an extra key) | 400 | `VALIDATION_FAILED` (exists) | none |
| The PIN did not verify as an active manager's | 403 | `APPROVAL_FAILED` (new) | `{ retryAfterSeconds }` only when this failure started the cooldown |
| The class is cooling down; nothing was verified | 429 | `APPROVAL_THROTTLED` (new) | `{ retryAfterSeconds }`, always |
| The cashier's own session is missing, idle or lacks the token | 401, 401, 403 | `UNAUTHENTICATED`, `SESSION_IDLE`, `CSRF_REFUSED` (exist; the guard's) | none |
| The work threw, or the database failed | 500 | `INTERNAL` (exists) | none |

- **Two new codes, not `INVALID_CREDENTIALS` and `THROTTLED`.** Those mean "your sign-in did not
  verify" and lead to POS-01's states. An approval failure leaves the cashier signed in and must
  lead to M-1's states. Clients switch on the code (ADR-010), and the code should carry that
  difference itself, not leave it to which route was called.
- **403, not a fourth 401.** The request was authenticated; what it lacked was authority for this
  one action. ARCH-012 §5 already warns that three codes share 401 and that a client which sends
  every 401 to the lock screen is wrong. An approval failure must not join them.
- **One answer for every kind of failed PIN** (question 4), byte for byte, and no count of attempts
  remaining (ARCH-012 §5).
- The fifth failure is still `APPROVAL_FAILED` and gains the detail, so the prompt can show the
  cooldown without a second request; `APPROVAL_THROTTLED` is reserved for "nothing was looked at".
  This mirrors the sign-in pair exactly.
- **`APPROVAL_REQUIRED` is not added.** It is needed only where the server, not the client, decides
  that an action is gated (a free-form discount against a preset; a void that turns out to hold a
  fired line). That is Phase 2's first conditionally gated command, and the code enters there with
  its emitter.

**One mapping function,** `http/approval.ts`, in the manner of `verification.ts`:
`approved<T>(outcome: ApprovalOutcome<T>): T` returns the result or throws the `AppError` above. A
second small function may build the `ApprovalRequest` from `actorOf(request)` and
`request.clientInstanceId`, so no handler is ever tempted to take the actor from a body. Handlers
write no error body.

**The guard runs first, and that matters.** A request with no active POS session is refused in
`onRequest`, before the handler and therefore before any PIN is verified. An unauthenticated caller
cannot spend approval strikes or guess a manager PIN through a gated route. A test proves it.

**What the POS client needs for M-1** (Task 11's consult and the designer):

| M-1 state | Server signal |
|---|---|
| *empty*, *loading* | none; the client's own |
| *error* | 403 `APPROVAL_FAILED` without details. No "attempts remaining": the server reports none |
| *throttled* | 403 `APPROVAL_FAILED` with `retryAfterSeconds`, or 429 `APPROVAL_THROTTLED` |
| *permission-denied* (a cashier PIN) | **none, and it should not get one** (question 4): it is the *error* state |
| *cancelled* | the cancel report (Phase 2) |
| the cashier's session ended under the prompt | `SESSION_IDLE` or `UNAUTHENTICATED`: POS-01, and the prompt is gone |

### 7. Telemetry and secrets

**Authority:** FR-A5; FR-J3, FR-J4; AC-18, AC-19; B-12; owner, 2026-10-07; `throttle.ts:91-99`.

**What `verifyPinThrottled` already writes for `MANAGER_APPROVAL`** (read from the code, not from
the plan):

| Result | Security event | Bucket |
|---|---|---|
| `VERIFIED` | none | this class's row set to zero and unblocked; the `WHERE` names one class |
| `FAILED` | **no `PIN_FAILURE`** (`:93` writes it for `LOGIN` only) | count plus one |
| `FAILED` that starts a cooldown | one `COOLDOWN_STARTED` | blocked for the cooldown |
| `THROTTLED` | none | untouched: not counted, not extended |

**Must an approval failure also be an audit entry? Yes, and it is the only record of it.** The
owner ruled on 2026-10-07 that a failed approval is in the audit log only. The primitive writes one
`APPROVAL_FAILED` per `FAILED` and one `APPROVAL_THROTTLED` per `THROTTLED`.

**No double-counting.** Each fact has one store. The fifth failure produces two rows, and they are
two facts: "Rina's approval failed" (audit, about a person) and "the approval class began a
cooldown" (telemetry, about the installation). ARCH-007 §5 ruled that split and it stands. A refused
attempt during the cooldown produces one audit row and no event.

**One ordering consequence, inherited.** On the fifth failure the event is written inside
`verifyPinThrottled`, before it returns. If that insert throws, the primitive never reaches its
`APPROVAL_FAILED` entry; the strike stands, the request fails, and no action runs (ARCH-007 §5 said
so in advance). That is ADR-007's requirement, met.

**Secrets (B-12, FR-J4).** The PIN enters `ApprovalRequest.managerPin` and is handed to
`verifyPinThrottled` and to nothing else: not to an audit field, not to an error, not to a log
call, not to the work. `audit_entry` has three free-text columns (`action`, `subject_id`, `reason`);
the action is a literal, and the builder must make sure no code path can put request text other
than the reason into them. Proofs: both evidence tables scanned whole for every PIN the tests used;
every returned value and thrown error scanned; in 010b the log at trace and every response body,
with a marker PIN.

**AC-19.** The reset is one `UPDATE … WHERE throttle_class = $1`, so an approval success cannot
touch `LOGIN` and a login cannot touch `MANAGER_APPROVAL`. `throttle.test.ts` proves that at the
domain; Task 10 proves it through the primitive and, in 010b, through the routes, by comparing the
other class's row whole before and after.

**Found, not fixed, and not Task 10's.** `findUserByPin` runs Argon2id only when the digest finds a
row, so a failed approval answers faster for a PIN that belongs to nobody than for one that belongs
to an active cashier. A patient person at the prompt could learn that some active user holds a PIN,
at one counted, audited strike per guess. I did not find this ruled on in what I read. It is a
property of `pin.ts`, bounded by the throttle, and belongs on the list for the gate in
ARCHITECTURE §3.2; the lead may know it is already recorded.

### 9. Proofs and sequencing

#### Split it

- **PHASE0-010a, the evidence and the primitive.** Migration `0008`, the outcome in `audit.ts`,
  `domain/approval.ts`, `approval.test.ts`, the changed cases of `schema.test.ts`, the source scan.
  No HTTP, no zod, no contracts change. One review about what an approval may cause and what
  evidence each outcome leaves.
- **PHASE0-010b, the HTTP adapter.** The two codes and their details, the `ManagerPin` field
  schema, `http/approval.ts`, the probe, and the route-level proofs. One review about what a
  request must present. It depends on 010a and on nothing else.

010a touches audit, identity and a migration; 010b touches the contract package and the scans. Each
is one slice a reviewer can hold, which is why Tasks 8 and 9 were cut the same way.

#### What closes, and what does not

| Criterion | Closes in Task 10 | Still open |
|---|---|---|
| AC-18 | One combined entry per approved action; one entry per failed approval and per cooldown-refused approval, approver null; a cancelled approval's entry at the domain; no PIN in either store | The cancel **route** and the action vocabulary (Phase 2); the entries for void, discount and refund themselves (Phases 2 to 4); `REFUSED` (question 10); the wording in *For the owner* 1 |
| AC-19 | The `MANAGER_APPROVAL` class through the primitive and through a guarded route: five failures, the cooldown, a correct manager PIN refused, `LOGIN` untouched in both directions, a replaced client instance changing nothing, a rebuilt server still refusing | Nothing for Phase 0 |
| AC-27 | "Must still enter a PIN": a gated route refuses without `managerPin` whatever sessions the browser holds, a back-office session never reaches a POS route, and a manager's own POS session approves nothing | One row per real gated command, added to a table-driven test as each arrives |

The test cases and red proofs are in *For the task file*.


## For the task file (ARCH-013, verbatim; binding)

#### PHASE0-010b: rules

1. `@pos/contracts`: `APPROVAL_FAILED` and `APPROVAL_THROTTLED` in `ErrorCode`, each with
   `{ retryAfterSeconds: number }` in `ErrorDetailsByCode`; a `ManagerPin` field schema;
   `error-details.types.ts` gains a block for each code.
2. `http/approval.ts`: the one mapping of question 6, and the builder of an `ApprovalRequest` from
   `actorOf(request)` and `request.clientInstanceId`. No decorator, no hook, no state.
3. **No route is added to `buildServer`.** The probe lives in the test file and is registered with
   `apiRoutes`. Its declaration is `ACTIVE`, `POS`, `interactive: true`, under `/api/pos/`.
4. A handler never writes an error body, never reads a cookie, and never takes an actor or an
   approver from the body. Body schemas are strict.
5. Every failed PIN gets one response; no count of attempts is reported.

#### PHASE0-010b: test cases

1. Approved through the probe: 200 with the work's result; a `SUCCESS` entry naming the session's
   actor and the approver.
2. No `managerPin`; five digits; seven; the number `123456`; non-ASCII digits; an extra `actorId`
   or `approverId` key: 400 `VALIDATION_FAILED`, nothing counted, no entry, the work not run. The
   same request during a cooldown is still 400.
3. A wrong PIN: 403 `APPROVAL_FAILED` with no details; the POS session is still active (`me`
   answers 200 and no response cleared `rpos_pos_sid`). The response for an unknown PIN, a
   cashier's PIN and a deactivated manager's PIN is identical, status, body and headers.
4. The failure that starts the cooldown: 403 with `retryAfterSeconds`. The next request with the
   right PIN: 429 `APPROVAL_THROTTLED` with `retryAfterSeconds`, and an `APPROVAL_THROTTLED` entry
   naming the session's actor.
5. AC-27: one jar holding a manager's back-office session and a cashier's POS session calls the
   probe without a PIN: 400, and the jar never sent `rpos_bo_sid` to it. A jar holding only the
   back-office session: 401 `UNAUTHENTICATED`, no entry, the bucket identical.
6. A manager signed in at the POS, no PIN: 400. With their own PIN: 200 and `approver = actor`.
7. No session, an idle session, a missing anti-CSRF token, each with a body carrying a PIN: the
   guard's code, and the `MANAGER_APPROVAL` row identical before and after. An unauthenticated
   request cannot spend a strike.
8. AC-19 through the routes: five failed approvals, then the POS sign-in route still verifies; a
   successful sign-in does not end the approval cooldown; a cleared or replaced `rpos_cid` changes
   nothing; a rebuilt server still answers 429.
9. The work throws: 500 `INTERNAL`, no entry.
10. B-14 at the wire: straight after an approved request, the same request without the PIN is 400.
11. The scans: a marker PIN sent to the probe appears in no log line at trace, in no response body,
    and in neither evidence table.
12. The tripwire list in `access.test.ts` is unchanged, and a server built with no `apiRoutes` has
    exactly the routes it had before this task.

#### PHASE0-010b: red proofs

- Map `FAILED` to `INVALID_CREDENTIALS`, or to 401: case 3.
- Take the actor from the body: case 2 (strictness) and case 1.
- Make `managerPin` optional and approve on the session's role: case 6.
- Declare the probe `OPTIONAL`: the tripwire, and case 7.
- Echo the parse failure: case 11.

#### The Handoffs must carry forward

- For every gated command (Phase 2 on): one call to `withManagerApproval`, with a literal action;
  the work uses only the client it is given; `managerPin` in the body, never a session; one new row
  in the AC-27 table; the entry's action asserted by the command's own test.
- For Phase 2: the cancel route's design in question 5, the action vocabulary, `APPROVAL_REQUIRED`,
  `REFUSED`, and the idempotency question in question 10.
- AC-18, AC-19 and AC-27 close only as far as the table in question 9 says.


## Lead rulings

These rulings are addressed to the builder.

1. **Files.** The codes and their details in `packages/contracts/src/errors.ts`; the `ManagerPin` field
   schema in `packages/contracts/src/auth.ts`, exported from `@pos/contracts`; the mapping and the
   request builder in a new `apps/server/src/http/approval.ts`. Tests in a new
   `apps/server/test/approval-route.test.ts` (cases 1 to 12, each test name starting with the consult's
   case number), with the probe defined in that file. You may rename the test file if the Handoff says
   why.
2. **The probe's work** writes one row the test can look for. Create a test-local table through the
   owner connection after `resetDatabase()`, as `approval.test.ts` does for `approval_probe`, and grant
   `INSERT` (and `SELECT` if the probe returns the row) to `pos_app`. No migration.
3. **`approval.test.ts` case 23 changes in one place** (the explorer found the conflict): its third
   assertion, `namedIn(/APPROVAL_(FAILED|CANCELLED|THROTTLED)/)`, also matches `ErrorCode.APPROVAL_FAILED`,
   which `http/approval.ts` must name. Narrow that one pattern to the audit outcome as a quoted string
   literal, `/['"]APPROVAL_(FAILED|CANCELLED|THROTTLED)['"]/`, and leave the allow-list, the other three
   assertions and the test's name unchanged. `http/approval.ts` must therefore name the codes only as
   `ErrorCode.APPROVAL_FAILED` and `ErrorCode.APPROVAL_THROTTLED`, never as string literals, and it must
   not name `approverId` or `MANAGER_APPROVAL`. Red proof: put `'APPROVAL_FAILED'` as a string literal
   in `http/approval.ts`; case 23 fails. Revert.
4. **`error-details.types.ts` gains a block for each new code** (the explorer: `session-scan.test.ts`
   case 25 requires a `new AppError(ErrorCode.X, ` line and a `const xText: ErrorBody` block for every
   code). As for `INVALID_CREDENTIALS` and `THROTTLED`: a string, an exception's message and an object of
   another shape do not compile; `{ retryAfterSeconds: 1 }` does. Additions only.
5. **zod.** Confirm any zod 4 API you have not already seen used in `@pos/contracts` with the librarian
   (`.agent/bin/ask.sh librarian "<question>"`) and say in the Handoff what you asked. `ManagerPin` is
   `z.string().regex(/^[0-9]{6}$/)` with no custom message, as `PosLoginRequest.pin` is; reuse the same
   rule rather than restating it if the two can share one definition without changing 009b's schema's
   behaviour.
6. **Users and time in tests** come from `makePeople` and the domain's constructors, never inserted rows.
   Cooldowns are moved by relative `UPDATE`s through `ownerQuery` (`ageOutPinCooldown`). Every limit is
   imported (`MAX_FAILURES`, `COOLDOWN_MINUTES`); no test restates 5 or 300 (B-24).
7. **Case 12** reads the same list as `access.test.ts` case 7; nothing in `access.test.ts` changes.
8. **The owner's ARCH-013 items do not block this task.** Build to the consult.
9. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
10. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
    observed. Do not work around a rule.
11. **The database is already up** (`restaurant-pos-db-1` on port 5433, shared by every worktree). Do
    not run `npm run db:up` or `docker compose` in this worktree.

## Tests expected to change

- `apps/server/test/approval.test.ts`: case 23's third pattern only (lead ruling 3).
- `apps/server/test/error-details.types.ts`: two new blocks (lead ruling 4); additions only.
- `apps/server/test/support/client.ts` or `support/people.ts`: additions only, if a helper is shared.
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline, which the
   lead records below this line at dispatch, the client's tests unchanged.
   **Baseline (lead, 2026-10-12):** `development` at `2b8db33`, 65 test files and 3235 tests, green in
   about 50 seconds.
2. The new test file alone is green three times in a row; the Handoff maps each case number (1 to 12)
   to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rn "apiRoutes\|approval" apps/server/src/http/server.ts`
   (no new route, no import of `approval.ts`); `grep -rnE "['\"]APPROVAL_" apps/server/src` (only
   `domain/approval.ts` and `domain/audit.ts`); `grep -rn "managerPin" apps/server/src` (only
   `http/approval.ts`, `domain/approval.ts` and `http/log.ts`); `grep -rnE "reply\.code\((4|5)"
   apps/server/src/http` (nothing).
5. The Handoff carries forward the items under *The Handoffs must carry forward*, and says what Task 11
   (the client shells and the M-1 prompt) needs from this task that it does not have.

## Out of scope

- Any production route, including a cancel route; `APPROVAL_REQUIRED`; the action vocabulary;
  `REFUSED`; idempotency (Phase 2).
- Any migration, and any change under `apps/server/src/domain/`.
- Client changes, the designer's M-1 and BO-12 edits, the PRD wording, the recommended ADR. `docs/` of
  any kind.

## Handoff

**Builder, 2026-10-12.** Built to the consult and the lead rulings; no rule had to be bent, nothing is blocked.

### What I did

- `packages/contracts/src/errors.ts`: `APPROVAL_FAILED` and `APPROVAL_THROTTLED` in `ErrorCode`, each with `{ retryAfterSeconds: number }` in `ErrorDetailsByCode`.
- `packages/contracts/src/auth.ts` and `index.ts`: `ManagerPin`. It shares one non-exported `SixAsciiDigits` definition (`z.string().regex(/^[0-9]{6}$/)`) with `PosLoginRequest.pin`, so the two cannot drift; `PosLoginRequest` behaves as before (its tests are unchanged and green). Only `z.string().regex` and `z.strictObject` are used, both already in `auth.ts`; I asked the librarian (`ask.sh librarian`) whether one field schema can sit in two strict objects and whether strict objects reject unknown keys in 4.6.5: yes to both, no v3-to-v4 change that touches this.
- `apps/server/src/http/approval.ts` (new): `approvalRequest(request, { managerPin, action, subject?, reason? })` builds an `ApprovalRequest` from `actorOf(request).staffUserId` and `request.clientInstanceId`, naming fields one by one so nothing else can ride along; `approved(outcome)` returns the result or throws `AppError` (`FAILED` is 403 `APPROVAL_FAILED`, with `retryAfterSeconds` only when non-null; `THROTTLED` is 429 `APPROVAL_THROTTLED`, always with it). It names the codes only as `ErrorCode.X`, and not `approverId` or `MANAGER_APPROVAL`.
- `apps/server/test/approval-route.test.ts` (new, 17 tests): the probe, registered through `buildServer({ apiRoutes })`, and cases 1 to 12. `src/http/server.ts` is untouched; no route was added.
- Changed existing tests: `approval.test.ts` case 23's third pattern only, to `/['"]APPROVAL_(FAILED|CANCELLED|THROTTLED)['"]/` (lead ruling 3; allow-list, other assertions and name unchanged). `error-details.types.ts`: two blocks added, mirroring `THROTTLED`'s (additions only). `support/client.ts` and `support/people.ts` unchanged.

No commit hash is quoted here because the file is committed together with the work; `git log -1` on `agent/phase0-010b` is the commit.

### Case map (test names start with the consult's case number)

1. `1. approved through the probe: 200 with the work's result, one SUCCESS entry naming the actor and the approver`
2. `2. a body that does not fit the schema is 400 and counts nowhere > before any failure, and again while the class is cooling down` (eleven bodies, run before any failure and again during a cooldown)
3. `3. a wrong PIN: 403 APPROVAL_FAILED with no details, the session stays, every kind of failed PIN answers identically` (unknown PIN, another cashier's, the actor's own, a deactivated manager's; status, body and headers minus `date` compared)
4. `4. the failure that starts the cooldown reports it; the next request is 429 APPROVAL_THROTTLED and audited`; and `4b.` the security event is written only by the failure that starts the cooldown
5. `5. AC-27: a back-office session approves nothing` (two tests: both sessions in one jar; back-office only)
6. `6. a manager signed in at the POS: no PIN is 400; their own PIN approves with approver = actor`
7. `7. the guard runs before any PIN is looked at` (no session, idle, missing token; each with a wrong PIN, so a reached handler would spend a strike)
8. `8. AC-19: five failed approvals leave sign-in alone; a sign-in, a replaced client instance and a rebuilt server leave the cooldown alone`
9. `9. a work that throws: 500 INTERNAL, nothing of the error in the body or the log, no entry`
10. `10. B-14 at the wire: straight after an approved request, the same request without the PIN is 400`
11. `11. a marker PIN appears in no log line at trace, no response body and neither evidence table`
12. `12. the probe adds no production surface` (two tests)

### Decisions

- **The probe's body parser is hand-written in the test.** `zod` is a dependency of `@pos/contracts` alone (`validate.ts` says so) and `apps/server` does not list it. The probe composes the exported `ManagerPin` with a strict one-key check. Phase 2's commands should instead compose `ManagerPin` into a `z.strictObject` in `@pos/contracts`, as `PosLoginRequest` does. If the lead would rather the probe use zod directly, that needs `zod` added to `apps/server/package.json` and the lockfile, which are not in my slice.
- **Case 12 reads the same list as `access.test.ts` case 7 from that file's source** (a regex over its quoted route strings, asserting six found), so there is one list. Nothing in `access.test.ts` changed. It also asserts the only routes a probe-registered server adds are `POST /api/pos/approval-probe` and `...-throws`, and that `server.ts` and the three shipped route files do not mention approval.
- The probe has a second route, `approval-probe-throws`, because case 9 needs a work that throws and the body is strict.
- Case 1 as written cannot tell an actor taken from the body from one taken from the session, because strictness already refuses a body that carries an `actorId` (see red proof 2). The check that matters is case 2.

### Red proofs (each made, run, read, reverted)

1. `FAILED` mapped to `INVALID_CREDENTIALS` / 401 in `approval.ts`: case 3, case 4 and case 2's cooldown leg fail ("expected 401 to be 403").
2. Actor read from the body in `approvalRequest` (`request.body.actorId ?? actor`) and the probe parser relaxed to ignore extra keys: case 2 fails ("an extra actorId: expected 200 to be 400"). Case 1 does not fail, for the reason under Decisions.
3. `managerPin` optional, the probe approving on the session's role when it is absent: case 6 fails ("expected 200 to be 400"); case 10 failed too, but incidentally (a 500 from a body-less request in the mutated probe).
4. Probe declared `OPTIONAL`: 14 of 17 fail, among them case 7 (all three legs, a 500 where the guard should have refused: the handler found no actor) and case 12's tripwire (the open-route list gains both probe routes).
5. Parse-failure echo (`request.log.info({ echo: request.body })` before parsing): case 11 fails on the extra-key marker `MARK-EXTRA-KEY-9013` appearing in a log line. The `managerPin` marker itself did not leak: `log.ts`'s redaction backstop printed it as redacted, which is what that backstop is for.
6. `'APPROVAL_FAILED'` as a string literal in `approval.ts` (lead ruling 3): `approval.test.ts` case 23 fails (`['http/approval.ts']`).

### Acceptance criterion 4 (real output)

- `grep -rn "apiRoutes\|approval" apps/server/src/http/server.ts`: only the three `apiRoutes` lines already there (`:30`, `:44`, `:100`); no `approval`.
- `grep -rnE "['\"]APPROVAL_" apps/server/src`: only `domain/approval.ts` (`:76`, `:80`, `:116`) and `domain/audit.ts` (`:11-13`, `:37-39`).
- `grep -rn "managerPin" apps/server/src`: `http/approval.ts` (`:9` comment, `:24`, `:33`), `http/log.ts:91`, `domain/approval.ts` (`:16`, `:57`, `:74`).
- `grep -rnE "reply\.code\((4|5)" apps/server/src/http`: one hit that this task did not add, `http/errors.ts:97`, `reply.code(404).type('text/plain')` in the pre-existing `notFoundHandler`. The criterion says "nothing"; the literal check is not empty because of that line, and nothing under `routes/` or `approval.ts` writes a status.

### `npm run verify`

Typecheck clean for all four projects. `vitest run`: 66 test files and 3252 tests passed (baseline 65 and 3235, plus this file and its 17 tests), 53 seconds. The client's tests are unchanged. The new file alone passed three times in a row (17 of 17 each). No formatter ran; I wrote and edited by hand.

### Found, not fixed

- ARCH-013 section 7's timing note stands and is not mine: a failed approval answers faster for a PIN that belongs to nobody than for one that belongs to an active user, because `findUserByPin` runs Argon2id only on a digest hit. The probe's four failure kinds are byte-identical in status, body and headers, which is what the contract asks; timing was not measured.
- Case 4b is an addition beyond the twelve cases (the cooldown event through the route); it is cheap and I kept it.

### Carried forward (from the task)

- For every gated command (Phase 2 on): one call to `withManagerApproval` with a literal action; the work uses only the client it is given; `managerPin` in the body, never a session; one new row in the AC-27 table; the command's own test asserts the entry's action.
- For Phase 2: the cancel route's design (ARCH-013 question 5), the action vocabulary, `APPROVAL_REQUIRED`, `REFUSED`, the idempotency question (question 10).
- AC-18, AC-19 and AC-27 close only as far as the table in question 9 says; AC-19 is now proven through the routes for Phase 0.

### What Task 11 (client shells and the M-1 prompt) needs and does not have

- The wire contract is final: 400 `VALIDATION_FAILED` (no details), 403 `APPROVAL_FAILED` (details `{ retryAfterSeconds }` only on the failure that started the cooldown), 429 `APPROVAL_THROTTLED` (details always), and the guard's 401 `UNAUTHENTICATED`/`SESSION_IDLE` and 403 `CSRF_REFUSED`. A cashier's PIN is indistinguishable from an unknown one by design (the M-1 *error* state).
- It has no real route to call: there is no production gated command yet, so the M-1 prompt can only be built against these codes and the probe's shape, not against a live endpoint.
- Nothing in `@pos/contracts` yet exports a composed request schema with `managerPin`; each Phase 2 command defines its own from `ManagerPin`.

DONE
