---
id: PHASE0-010a
title: Inline manager approval — the evidence and the primitive
category: feature
touches: [audit, identity, boundaries]
depends_on: [PHASE0-009b]
owns: [apps/server/**, db/migrations/**]
status: review
cycles: 0
---
# PHASE0-010a — Inline manager approval: the evidence and the primitive

**Written** 2026-10-12 by the lead, from the architect consult ARCH-013
(`.agent/reviews/ARCH-013-manager-approval.md`, by `architect13`, 2026-10-12), which supersedes plan
Task 10 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:2730-2980`). Do not copy anything
from plan Task 10. This is the first half of the split: the migration, the audit outcome and the
domain primitive, with no HTTP. PHASE0-010b adds the HTTP adapter afterwards. The consult's binding
sections are copied below **verbatim**, with their headings moved down one level; the numbered
"questions" they refer to are the consult's sections (question 3 is section 3, and so on). Section 6
(routes) belongs to 010b and is not copied; nothing in this task adds a route, a code or a schema.
Touches audit, identity, B-13 and B-14: the owner looks before merge.

## Objective

A gated command will call `withManagerApproval(request, work)` with the signed-in actor, the manager
PIN from its own request, and a literal action. The primitive verifies the PIN once in the
`MANAGER_APPROVAL` class, and on success runs the work once in one transaction that also writes the
one combined `SUCCESS` audit entry naming actor and approver. A failed approval writes an
`APPROVAL_FAILED` entry, and an approval refused by the cooldown writes the new `APPROVAL_THROTTLED`
entry, each in its own committed transaction with a null approver; neither runs the work. No value
that means "approved" ever leaves the function. `recordApprovalCancelled` writes an
`APPROVAL_CANCELLED` entry. Migration `0008` admits the new outcome and moves `occurred_at` to
`clock_timestamp()`. When this task is done, the test cases below prove every rule against the real
tables as `pos_app`, and AC-18 and AC-19 close at the domain as far as the consult's question 9 table
says.

## Required inputs

- **Built domain:** `verifyPinThrottled`, `ThrottledVerification`, `MAX_FAILURES`, `COOLDOWN_MINUTES`
  (`throttle.ts`); `AuditOutcome`, `OUTCOMES`, `writeAudit`, `writeAuditOwnTransaction`, the
  validation in `audit.ts`; `withTransaction` (`db/pool.ts`); `createStaffUser` (`pin.ts`, for tests
  only). Migrations `0001` to `0007`; `audit_entry`'s constraints, grants and append-only trigger in
  `0004`; `pin_throttle_bucket` in `0005`.
- **Test support:** `makePeople` and `ageOutPinCooldown` (`test/support/people.ts`), `ownerQuery` and
  `resetDatabase` (`test/support/database.ts`). There is no shared bucket-reset helper: files reset
  the bucket inline through the owner connection (`pos-sign-in.test.ts:52-54`) or call
  `resetDatabase()` in `beforeEach`. Never `DELETE` from the bucket in a new test.
- **Contract:** PRD FR-A5, FR-A6, FR-J1 to FR-J4, AC-18, AC-19; ADR-007; `docs/ARCHITECTURE.md` §7.1,
  §11, §13; `docs/BOUNDARIES.md` B-7, B-12, B-13, B-14, B-20, B-24.
- **Owner rulings** (`.agent/DECISIONS.md`): 2026-09-10 (a manager may approve their own action),
  2026-10-06 (a cooldown-refused approval is an audit entry, not a security event; the count resets
  when a cooldown ends; an approved void the server refuses writes `REFUSED`; an abandoned prompt is a
  cancelled approval), 2026-10-07 (a failed approval is audit only, never also a `PIN_FAILURE`).
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time; any statement you add that reads
  the clock uses `clock_timestamp()`. This task adds no SQL that reads a clock except the column
  default lead ruling 3 sets.

## From ARCH-013 (verbatim; binding)

### 1. Plan Task 10 against what is built and decided

**Authority:** ARCH-007 §7 (one function, no exported reset); ADR-007; migrations `0004`, `0005`;
`audit.ts`; owner rulings of 2026-10-06 and 2026-10-07.

#### What is right and stays

- A function that takes the PIN and the work together and runs the work inside a transaction.
- The `SUCCESS` entry written on the work's client, so the action and its entry commit or roll
  back together (`:2948-2963`).
- "No audit entry when the work itself fails" (`:2822-2833`), for Phase 0.
- "Nothing here issues a token or touches a session" (`:2910-2911`).

#### Every plan line to drop or change

| Plan lines | What is wrong | What the task says instead |
|---|---|---|
| `:2732-2734` Files | Lists two files. | Adds `db/migrations/0008_audit_entry_approval_throttled.sql`, a change to `domain/audit.ts` (the outcome type and list), and changes to `schema.test.ts` (cases 10 and 11). 010b adds its own files (see *For the task file*). |
| `:2737` Consumes | Names `findUserByPin` and "throttle (Task 6)" as three functions. | Consumes `verifyPinThrottled` and `ThrottledVerification` (`throttle.ts`), `writeAudit` and `writeAuditOwnTransaction` (`audit.ts`), `withTransaction` (`db/pool.ts`). **The approval module never imports `pin.ts`.** |
| `:2738` Produces | `ApprovalError`; `subjectType`/`subjectId`; `clientInstanceId?: string \| null`; `work` receives a bare `approverId`; the function resolves to `T`. | The interface in question 3. A union is returned; `subject` is `{ type, id }` as in `AuditInput`; `clientInstanceId` is `string` or absent. |
| `:2746` `query` for reads | `pos_app` has no `SELECT` on `audit_entry` (`0004:47-51`). | Tests read through `ownerQuery` (`test/support/database.ts`), as `people.ts` does. |
| `:2755` `DELETE FROM audit_entry` | B-7. The trigger refuses it for every role (`0004:43-45`). | Dropped. A test finds its own rows by the actor it created; it never asserts on the whole table. |
| `:2756` `DELETE FROM app_session` | No such table (`actor_session`), and no `DELETE` grant. | Dropped. The primitive touches no session. |
| `:2757` `DELETE FROM staff_user` | No `DELETE` grant; a user named in the audit log cannot be deleted. | Dropped. People come from `makePeople(<own PIN base>)`. |
| `:2758-2760` `UPDATE auth_throttle …` | The table is `pin_throttle_bucket`; a test resets it through the owner connection, never through the application pool. | The existing reset and `ageOutPinCooldown` helpers. |
| `:2761-2762` fixed PINs | Collide with other files' users (PINs are unique among active users). | `makePeople`, one PIN range for the file. |
| `:2778-2780` `rows toEqual [...]` | Whole-table equality on an append-only table. | Rows filtered by actor. |
| `:2783-2790` cashier PIN | Only asserts a rejection. | Returns `FAILED`; one `APPROVAL_FAILED` entry; the class's count rises by one and is never reset (ARCH-007 §6). |
| `:2804`, `:2937` `'INVALID_APPROVAL'` | Not an outcome. | `'APPROVAL_FAILED'`. |
| `:2843-2849` | `auth_throttle`. | The `bucket()` helper on `pin_throttle_bucket`, compared whole. |
| `:2852-2862` PIN in the error message | Tests one string on one path. | Replaced by the scans in the test list: both evidence tables, the returned values, thrown errors, and (010b) the log and every response. |
| `:2876-2885` imports | `assertNotThrottled`, `recordFailure`, `recordSuccess` and `ThrottledError` were deliberately never exported (ARCH-007 §7). | One import: `verifyPinThrottled`. |
| `:2887-2896` `ApprovalError` | A refusal is an expected outcome with data; an exception that must be caught for the normal flow is one that will one day not be caught (ARCH-007 §7). | Dropped. |
| `:2909-2911` comment | "all inside one transaction" is false, and by decision: the verification commits before the business transaction opens (ARCH-007 §5). | The comment says what is true: two transactions, in that order, and why. |
| `:2917-2924` | Check, then act: the race ARCH-007 §1 closed. It also writes **no audit entry** when the cooldown refuses the approval. | `THROTTLED` from the one call; an `APPROVAL_THROTTLED` entry (question 2). |
| `:2926-2929` | `findUserByPin` outside the lock, and the role rule in the caller. A cashier's valid PIN would be judged by the approval module. | The role rule is `throttle.ts:52`, under the lock. The approval module does not judge a role; it asserts one (question 4). |
| `:2933-2941` | `subjectType`, `subjectId` and `clientInstanceId` are not fields of `AuditInput`; `audit_entry` has no client-instance column. | `subject`. The client instance goes to `verifyPinThrottled` only. |
| `:2943` `throw` | See `ApprovalError`. | `return`. |
| `:2946` `recordSuccess` | Does not exist. The reset happened under the lock. | Dropped. |
| `:2949-2960` | The reason and amounts come from the input; amounts are known only after the work. | The work returns its result and its before and after amounts; the primitive writes the entry. |
| `:2968-2970` | `npx vitest run …`, "all seven cases". | `npm run verify` with the database up; the case list below. |
| `:2975-2976` | Commit instructions. | The repository's rules: the task's own branch, verify green, no push. |
| `:2017-2018` (Task 8) | `APPROVAL_REQUIRED`, `APPROVAL_INVALID`. | `APPROVAL_FAILED` and `APPROVAL_THROTTLED` enter in 010b. `APPROVAL_REQUIRED` is not added: it enters with the first conditionally gated command (question 6). |

### 2. The cooldown-refused approval

**Authority:** owner, 2026-10-06 ("A cashier's approval refused by the cooldown writes an audit
entry, not a security event"); owner, 2026-10-07 (a failed approval is audit only, never also a
`PIN_FAILURE`); ADR-007; ARCH-007 §4 and §7; B-7, B-13; `0004`.

#### The outcome value: `APPROVAL_THROTTLED`

A fourth outcome, not a reuse of `APPROVAL_FAILED`. During a cooldown no PIN is verified
(`throttle.ts:47-49`), so "failed" would state something that did not happen: it would tell the
audit viewer that someone typed a wrong PIN when a manager may have typed the right one. An audit
log is read by counting, and the count of wrong PINs must be the count of wrong PINs.

The spelling follows the two beside it (`APPROVAL_FAILED`, `APPROVAL_CANCELLED`) and the API code
that already says the same thing (`THROTTLED`). I considered `APPROVAL_REFUSED` and reject it:
`REFUSED` is the contract's word for a different event (the manager approved and the *server*
refused the action), and two outcomes one prefix apart would be misread on BO-12.

**Recommended, not decided:** the spelling is mine. It appears in no contract document and need not;
the wording proposed for the owner does not name it. In an append-only table a spelling is
permanent once written, so the lead should settle it in the task file before 010a is dispatched.

#### What the entry holds

`actor_id` (the cashier, from the session), `approver_id` null, `action`, `outcome`, and the
subject when the command has one. Nothing else.

- **No retry time.** It would be a new column on an append-only table for one outcome. It is also
  derivable: the cooldown's start is a `COOLDOWN_STARTED` security event with database time, and its
  length is a constant. The audit viewer answers "who tried what, when"; "how long until the keypad
  works" is the prompt's question and the response carries it.
- **No class.** An approval is only ever verified in `MANAGER_APPROVAL`; the outcome implies it.
- **No approver.** The existing constraint `audit_entry_unapproved_outcome_check`
  (`outcome = 'SUCCESS' OR approver_id IS NULL`) already covers the new value without change. Even
  when the PIN typed was a real manager's, nobody was identified, because nothing was looked at.
- **No reason and no amounts,** on this entry and on `APPROVAL_FAILED` and `APPROVAL_CANCELLED`
  alike. The amounts are the before and after of a change that did not happen (the contract says the
  same of `REFUSED`). The reason is the reason for an action that did not happen. This second point
  is a recommendation: FR-J2 says "required business reason where applicable" and does not say
  whether a failed approval is such a case. The lead may rule that the reason is kept; nothing in
  the schema prevents either.

#### The migration

`db/migrations/0008_audit_entry_approval_throttled.sql`, run by the owner role as every migration
is:

```sql
-- A manager approval refused by the MANAGER_APPROVAL cooldown is an audit
-- entry naming the cashier (owner, 2026-10-06): no PIN was verified, so it is
-- not APPROVAL_FAILED. Widening a CHECK is DDL: it edits no row, so the
-- append-only trigger does not fire, and audit_entry_unapproved_outcome_check
-- already requires approver_id to be null for the new value. No column is
-- added, so pos_app's column grants are unchanged. REFUSED is still to come,
-- with its refusal code and its own constraints (FR-J3).
ALTER TABLE audit_entry
  DROP CONSTRAINT audit_entry_outcome_check,
  ADD CONSTRAINT audit_entry_outcome_check
    CHECK (outcome IN ('SUCCESS', 'APPROVAL_FAILED', 'APPROVAL_CANCELLED',
                       'APPROVAL_THROTTLED'));
```

I ran this shape on PostgreSQL 16 with rows present and a raising statement-level trigger (see
*What I verified*): it applies, the trigger does not fire, existing rows are scanned and kept, and
it rolls back as a unit. `migrate.ts` wraps each file in `BEGIN … COMMIT`, so a failure leaves the
old constraint in place. Migration `0004` is not edited.

The same migration may carry the `occurred_at` default of question 8, if the lead accepts that
recommendation.

`audit.ts` changes in two places: `AuditOutcome` gains `'APPROVAL_THROTTLED'` and so does
`OUTCOMES`. `validateAudit` already refuses an approver on anything but `SUCCESS`.

#### Do FR-J3, AC-18 and FR-A5 read consistently with the ruling?

**No, and I do not treat the gap as decided.** Three sentences now pull against it:

- FR-J3: "Unauthenticated PIN failures and throttle cooldowns are security telemetry, **not audit
  entries**, because they have no identified actor." A cooldown-refused approval is a consequence of
  a throttle cooldown, it has an identified actor, and by ruling it *is* an audit entry.
- AC-18: "Unauthenticated PIN failures and throttle cooldowns appear **only** in security telemetry."
  A test written to that sentence would fail on an `APPROVAL_THROTTLED` row.
- FR-J3, AC-18 and FR-A5 each enumerate "failed or cancelled" approvals. A cooldown-refused one is
  neither, as built: no verification failed and nobody cancelled.

The ruling and the PRD can be reconciled by reading "throttle cooldowns" as "the start of a
cooldown" (the `COOLDOWN_STARTED` event, which stays telemetry). SCREEN-INVENTORY BO-12 already
reads it that way. But that is a reading, and the PRD is what the tests cite. Exact replacement
wording is in *For the owner*, item 1. PHASE0-010a does not depend on the wording being approved:
the ruling itself is in DECISIONS.md, and the builder cites the ruling.

### 3. Shape of the primitive

**Authority:** B-14; FR-A6; ADR-007; ARCHITECTURE §7.1 ("embedded in the protected POS command …
creates no approval session or reusable token") and §13 ("inline approval as part of protected
commands"); ARCH-007 §5 ("the transaction is never the caller's").

#### Decision: a function that runs the approved work

```ts
// domain/approval.ts
export interface ApprovalRequest {
  /** The initiating actor, from actorOf(request). Never from a request body. */
  actorId: string;
  /** Six digits from this request's body. Passed to verifyPinThrottled and nowhere else (B-12). */
  managerPin: string;
  /** What is being approved. A literal at the call site, never a value the client chose. */
  action: string;
  subject?: { type: string; id: string };
  /** Written on the SUCCESS entry only. */
  reason?: string;
  clientInstanceId?: string;
}

export interface ApprovedWork<T> {
  result: T;
  /** Minor units (B-1). Known only once the work has run. */
  beforeAmount?: bigint;
  afterAmount?: bigint;
}

export type ApprovalOutcome<T> =
  | { outcome: 'APPROVED'; result: T }
  // retryAfterSeconds is a number when this failure started a cooldown, otherwise null.
  | { outcome: 'FAILED'; retryAfterSeconds: number | null }
  | { outcome: 'THROTTLED'; retryAfterSeconds: number };

export function withManagerApproval<T>(
  request: ApprovalRequest,
  work: (client: pg.PoolClient, approver: { id: string }) => Promise<ApprovedWork<T>>
): Promise<ApprovalOutcome<T>>;

/** A cancelled approval prompt (FR-J3). Verifies nothing and touches no bucket. */
export function recordApprovalCancelled(input: {
  actorId: string;
  action: string;
  subject?: { type: string; id: string };
}): Promise<void>;
```

#### The sequence, and what each failure leaves behind

1. **Validate the audit fields first** (actor present, action not blank, subject whole). An invalid
   request throws before any PIN is looked at. Otherwise a strike could be counted and its evidence
   then refused by `validateAudit`.
2. **`verifyPinThrottled('MANAGER_APPROVAL', managerPin, { clientInstanceId })`.** Its own
   transaction, committed before anything else here happens. If it throws (the database failed, or
   its `COOLDOWN_STARTED` insert failed), the primitive throws; the work has not run.
3. **`THROTTLED`:** `writeAuditOwnTransaction` with `APPROVAL_THROTTLED`; return `THROTTLED`.
4. **`FAILED`:** `writeAuditOwnTransaction` with `APPROVAL_FAILED`; return `FAILED`.
5. **`VERIFIED`:** `withTransaction((client) => …)`: call `work(client, { id })` once, then
   `writeAudit(client, { outcome: 'SUCCESS', approverId, actorId, action, subject, reason, amounts })`,
   then commit; return `APPROVED` with the work's result.

| What goes wrong | What is left | Why that is right |
|---|---|---|
| The evidence write in step 3 or 4 fails | The strike (if any) stands; no entry; the primitive **throws**; the work did not run | ADR-007: "If that evidence cannot commit, the protected request fails and its business action does not run." The primitive must not swallow this and return `FAILED`. |
| The process dies between step 2's commit and the entry | A counted strike with no audit entry | The reverse (an entry with no strike) cannot happen. ARCH-007 §5 accepted the same asymmetry for security events: evidence must never be able to undo enforcement. Closing it needs a callback under the throttle's lock, which ARCH-007 §7 rejected; I do not reopen that. |
| The work throws | The transaction rolls back; the error is rethrown unchanged; **no audit entry of any outcome**; the class's count was already reset | The PIN was right, so the reset is correct. Nothing happened, so there is nothing to attribute. This is the place `REFUSED` will occupy (question 10). |
| The `SUCCESS` insert fails | The work's writes roll back with it | ADR-007's first sentence. |
| `BEGIN` or `COMMIT` fails after a successful verification | No action, no entry, and the approval is gone | The next attempt needs the PIN again. Nothing carried the approval across the failure, which is B-14 doing its job. A lost `COMMIT` acknowledgement is the ordinary unknown-outcome case and belongs to Phase 2's idempotency design. |

**A window that exists and is acceptable.** Between step 2's commit and step 5's `BEGIN` (the same
call, microseconds apart) the approver could be deactivated. The action then carries the approval
of a manager deactivated a moment ago. That is one legitimate serial order of two events, and the
alternative (re-reading the approver inside the work's transaction) adds a second copy of the
verification rule for no harm prevented.

#### How B-14 and FR-A6 are held

**In the type system:**

- **There is no approval value.** No exported type means "an approved thing". `ApprovalOutcome`
  carries the work's result and no approver. The approver's id exists only as the parameter of a
  callback, so there is nothing to store on a request, a session, an instance or a module, and
  nothing to pass to a second command.
- **The PIN and the work arrive in the same call.** No function accepts a PIN now and work later.
- **The action and subject are fixed in `ApprovalRequest` before the PIN is verified,** and the
  primitive writes them on every outcome's entry itself. The work cannot change what the entry says
  was approved, and a failed attempt names the same action a success would have.

**At runtime:**

- The work is called exactly once, inside one transaction that is closed before the function
  resolves. The module holds no state: no cache, no map, no module-level variable.
- The session is never read or changed. A manager's own POS session is not an approval; a manager
  actor still supplies a PIN (ARCHITECTURE §7.1; ARCH-012 §4).

**What no type can hold, stated plainly.** `writeAudit` accepts an `approverId` from any caller, so
a careless command could write a `SUCCESS` entry naming an approver nobody verified. And a work
callback could perform something other than what `action` says. Two rules and a scan cover these:

- **Only `domain/approval.ts` passes `approverId` to an audit writer, and only it names the
  `MANAGER_APPROVAL` class or an `APPROVAL_*` outcome.** A source scan in the style of
  `session-scan.test.ts` case 24 enforces it.
- **One gated command, one call site, one literal action.** Each later command's own test asserts
  that the entry's action is the thing it did. That is a rule for Phase 2's task files.

#### Alternatives, and why they lost

- **A verification that hands back an approver for the caller's transaction** (for example
  `verifyManagerApproval(…): Promise<Approver>`). It is the simpler signature and lets each command
  own its transaction. It loses because it manufactures exactly the object B-14 forbids: a value
  that means "a manager approved", which can be held past its moment, used for two commands, or
  attached to a request. It also makes every command remember to write the combined entry, and to
  keep the approver in scope after its own rollback when `REFUSED` arrives. Seven commands would
  each carry that; one primitive carries it once.
- **A callback under the throttle's lock** (one transaction for verification, work and entry). It
  would give exact agreement between strikes and entries. ARCH-007 §7 rejected it: the work's
  failure would refund a strike, and caller code under the installation-wide lock invites the
  deadlock ARCH-007 §1 describes. Binding; not reopened.
- **A server-side "pending approval" record** opened when the prompt opens. See question 5; it is an
  approval-shaped object that lives across requests.

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

### 5. Cancellation

**Authority:** FR-J3; ADR-007; B-13, B-20; owner, 2026-10-06 ("An abandoned approval prompt is a
cancelled approval for FR-J3"); ARCH-003 (*For the owner* 3); ARCH-012 §4.

#### How the server learns of it

Only by being told. The prompt opens, is cancelled and is abandoned entirely on the client; a gated
command is not sent until a PIN has been typed. So the entry can never attest more than this: *the
client reported that this signed-in person dismissed an approval prompt for this action on this
subject.* That is the most a server can know about an event that happens in a browser, and the
design should not pretend to more.

#### What Phase 0 ships: the recorder, not the route

`recordApprovalCancelled` (question 3) writes one `APPROVAL_CANCELLED` entry in its own transaction
through `writeAuditOwnTransaction`. It verifies nothing, reads no bucket and writes no security
event. If the entry cannot commit it throws: Cancel, on the server, is a request that can fail
(ARCH-003).

**I recommend the route waits for the first gated command (Phase 2).** Two reasons:

- **It has nothing true to say yet.** No gated action exists server-side, so no approval prompt can
  open against the server. Every entry a Phase 0 cancel route wrote would be untrue by construction.
- **It needs a closed action vocabulary.** A cancel route cannot take `action` as free text: that
  would let a client write arbitrary strings into the audit log. The vocabulary of gated actions
  (and how a discount's apply, replace and remove are named as one transition, §11) should be
  designed with the commands, not ahead of them. ARCH-006 deliberately left `action` without one.

#### The route's design, for the task that builds it

- `POST /api/pos/approvals/cancel`, declared `{ session: 'ACTIVE', audience: 'POS', interactive: false }`.
  The actor is `actorOf(request)`; the anti-CSRF token follows from the method.
- **Not interactive, deliberately.** A person pressing Cancel is real input, and the client's
  `activity` call already covers that. But the same request also reports a prompt the client closed
  *because* the session was about to idle, and that report must not extend the session it is
  closing for.
- Body: `{ action, subject? }`, strict, `action` from a closed enum in `@pos/contracts`, the subject
  a typed reference the server checks exists. No PIN field: a cancel never carries a credential.
- Answer: 204. No new code.

**What stops forging.** The actor comes from the session, and the approver is null by a database
constraint, so a client can implicate nobody but the person signed in. A forged entry is a true
record of what that person's client sent.

**What stops flooding. Nothing does, and I recommend accepting that for the loopback MVP.** A
signed-in cashier's client can post cancellations without limit, each an attributable row. The same
is true of `APPROVAL_THROTTLED` entries during a cooldown. A server-side limit would need the
application role to read `audit_entry` (it has no `SELECT`) or a counter table for the purpose.
Recorded for the gate before any networked use; see *For the owner*, item 4.

#### The open dependency I am not resolving: inferred abandonment

The owner ruled that an abandoned prompt *is* a cancelled approval. ARCH-003 pointed out what that
leaves open: "the client cannot reliably report it, so the ruling decides whether the server must
infer it." DECISIONS.md does not say. The cases:

- Cancel, Escape, navigating away, or the client's own idle lock closing the prompt: the client can
  report it, provided the report arrives while the session is still active.
- The session already idle at the server, a closed tab, a crash, a lost connection: no report can
  arrive, or it is refused with `SESSION_IDLE`. An idle session is never an actor (ARCH-012 §4), and
  I would not weaken that for this.

For the server to infer those, the client would have to announce every prompt opening, the server
would keep a pending record, and an entry would be written later at a time nobody acted. That is an
approval-shaped object living across requests, a new table, a new flood surface, and an audit
timestamp that records an inference. **I recommend against it** and say why in *For the owner*,
item 2, but it is the owner's call, and it is needed before Phase 2, not before PHASE0-010. Nothing
in 010a or 010b forecloses either answer.

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

### 8. Constants and time

**B-24.** Task 10 adds no constant. `MAX_FAILURES` and `COOLDOWN_MINUTES` stay in `throttle.ts` and
nowhere else; tests import them and never write 5 or 300. No seed, no staff row, no setting. The
action names the probe uses are test literals, not a vocabulary.

**Time.** The approval module and the adapter add **no SQL that reads a clock**. The scan in
`session-scan.test.ts` case 24 (no `now()` under `src/http`) covers the adapter as it stands.

One clock deserves a decision, and Task 10 is where it first matters. `audit_entry.occurred_at`
defaults to `now()` (`0004:27`), which in PostgreSQL is the time the transaction *started*. Until
now every audit entry was the only statement in its transaction. The combined `SUCCESS` entry is
the first written at the *end* of a transaction that did other work, and from Phase 2 that work
waits on row locks (an order, a lease). The entry's time would then be the moment the command
began waiting, not the moment the action took effect, and entries could carry times out of step
with their `id` order.

**I recommend `0008` also sets the default to `clock_timestamp()`:**

```sql
-- now() is the transaction's start. A combined entry is written at the end of
-- a transaction that may have waited for a lock, and the application cannot
-- supply this column, so the default is the only place the time is decided.
ALTER TABLE audit_entry ALTER COLUMN occurred_at SET DEFAULT clock_timestamp();
```

Changing a default edits no row and fires no trigger. `pos_app` still cannot supply the column. The
proof is a work callback that runs `SELECT pg_sleep(…)` and then reads `clock_timestamp()` on its
client: the entry's `occurred_at` must not be earlier than that reading. This is a recommendation.
If the lead declines it, nothing in Phase 0 misbehaves; the question returns with the first command
that waits on a lock. `security_event` needs no change: each event is a single statement on the
pool, where the two clocks agree.

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

### 10. Anything else

**Against the boundaries and requirements the task names:**

- **B-11.** No PIN is stored or sent anywhere new. It arrives in a JSON body over the TLS listener
  and nowhere else; never in a URL.
- **B-12.** Question 7.
- **B-13.** Every entry the primitive writes names the session's actor. No outcome uses a stand-in.
  A request with no active session writes nothing at all, because the guard refuses it first. The
  `COOLDOWN_STARTED` event names no person, by the table's design.
- **B-14, FR-A6.** Question 3.
- **B-20.** A failed, throttled or cancelled approval leaves no business state: the work is not
  called. A work that fails rolls back whole.
- **B-24.** Question 8.
- **FR-A5.** One call to the throttled verification; the primitive adds no state and no reset.
- **FR-J3 and ADR-007.** One combined entry on success, in the action's transaction; one
  actor-attributed entry with a null approver for each other outcome, in its own transaction, whose
  failure fails the request.

No rule here requires a boundary to be broken.

**Room for `REFUSED`, without deciding it.** FR-J3 gives a refund a `REFUSED` entry naming actor
and approver, with a refusal code and no amounts. The owner ruled on 2026-10-06 that a void gets
the same (DECISIONS.md; this is the item the task file calls open, and it is not). `REFUSED` still
arrives in the phase that first writes it, with its `refusal_code` column, its constraints and its
grant (ARCH-006 §6; the comment at `0004:29-30`). The primitive is where it will live, and the
shape above leaves the room: when a work signals a business refusal, the primitive is the one place
that still holds both the actor and the approver after the rollback, and can write the entry in its
own transaction. In Phase 0 a work that throws writes nothing. Two things that phase must then
settle and this one does not: how a work signals a refusal as distinct from a fault, and that the
`REFUSED` entry's own failure is handled as ADR-007 handles failed evidence.

**A dependency for Phase 2's idempotency consult.** The seven duplicate-sensitive commands carry
idempotency keys (ARCHITECTURE §13), and several are gated. A replayed gated command meets a
question this consult leaves alone: is the PIN verified again on a replay, and how is a second
`SUCCESS` entry avoided? The primitive as specified writes exactly one `SUCCESS` entry each time
the work returns. Where the idempotency lookup sits relative to the verification is that consult's
to decide.

**The plan's test "leaves no audit entry when the work itself fails"** stays true for Phase 0 and
will be narrowed, not removed, when `REFUSED` arrives: a *fault* still leaves nothing.


## For the task file (ARCH-013, verbatim; binding)

#### PHASE0-010a: rules

1. Create `db/migrations/0008_audit_entry_approval_throttled.sql` as in question 2 (and the
   `occurred_at` default of question 8 if the lead accepts it). Do not edit `0004`.
2. `AuditOutcome` and `OUTCOMES` in `audit.ts` gain `'APPROVAL_THROTTLED'`. Nothing else in that
   file changes, except exporting whatever the primitive needs to validate an entry early.
3. Create `domain/approval.ts` with exactly the exports of question 3. It imports
   `verifyPinThrottled`, the audit writers and `withTransaction`. It does not import `pin.ts`,
   holds no module-level state, and adds no SQL of its own.
4. The audit fields are validated before the PIN is verified. An invalid request throws and
   changes nothing.
5. One call to `verifyPinThrottled('MANAGER_APPROVAL', …)` per approval. No second look at the
   bucket, no retry, no reset.
6. `THROTTLED` writes `APPROVAL_THROTTLED`; `FAILED` writes `APPROVAL_FAILED`; both through
   `writeAuditOwnTransaction`, with the actor, a null approver, the action and the subject, and
   without reason or amounts. If the write throws, the primitive throws.
7. On `VERIFIED`, assert the role is `MANAGER` and throw a plain error if it is not. Then one
   `withTransaction`: the work once, then the `SUCCESS` entry on the same client, with the reason
   from the request and the amounts from the work.
8. A work that throws is rethrown unchanged. No entry of any outcome is written for it.
9. The PIN is passed to `verifyPinThrottled` only. It is never logged, never put in an error and
   never given to the work.
10. `recordApprovalCancelled` writes one `APPROVAL_CANCELLED` entry and touches nothing else.
11. Tests create people with `makePeople` on the file's own PIN range, read the evidence tables
    through `ownerQuery`, find their rows by actor, and import the policy numbers. No test deletes
    from, updates or truncates `audit_entry` or `security_event`.

#### PHASE0-010a: test cases

`schema.test.ts`:

1. Case 10 covers three unapproved outcomes: `APPROVAL_THROTTLED` with an approver is refused by
   `audit_entry_unapproved_outcome_check` and accepted without one.
2. Case 11 becomes "outside the four": `REFUSED`, `SUCCEEDED` and the empty string are still
   refused by `audit_entry_outcome_check`.
3. Cases 1 and 12 pass **unedited**: the privilege map and the column list did not change. (If the
   `occurred_at` default is taken and case 12 compares defaults, that one line changes.)

`approval.test.ts`:

4. Approved by another manager: the work runs once, on a client inside a transaction; one `SUCCESS`
   entry with actor, approver, action, subject, reason and the work's amounts; the result is
   returned as `APPROVED`.
5. After two failed approvals, an approved one resets `MANAGER_APPROVAL`; the `LOGIN` row is
   identical, compared whole, before and after.
6. Self-approval: a manager actor with their own PIN gets `SUCCESS` with `approver_id = actor_id`.
7. A PIN that matches nobody: `FAILED` with `retryAfterSeconds` null; the work is not called; one
   `APPROVAL_FAILED` entry with a null approver, the action and subject, no reason and no amounts;
   the count rises by one; no security event.
8. An active cashier's PIN, and separately the actor's own cashier PIN: as case 7, and the returned
   value is deep-equal to case 7's.
9. A deactivated manager's PIN: as case 7.
10. The failure that reaches `MAX_FAILURES`: `FAILED` with a positive `retryAfterSeconds` no greater
    than the cooldown; that attempt's own `APPROVAL_FAILED` entry; exactly one `COOLDOWN_STARTED`
    for `MANAGER_APPROVAL`; no `PIN_FAILURE`.
11. During the cooldown, the right manager PIN: `THROTTLED`; the work is not called; one
    `APPROVAL_THROTTLED` entry with a null approver; the bucket row identical before and after; no
    new security event.
12. After the cooldown is aged out, the right PIN approves.
13. The work throws: the same error object surfaces; no entry of any outcome for that actor; a row
    the work wrote on its client is absent; the class was reset.
14. The `SUCCESS` entry cannot be written (an actor id that is no staff row): the error surfaces and
    the row the work wrote is absent.
15. The failed-approval entry cannot be written (the same actor id, a wrong PIN): the primitive
    **throws**; the work is not called; the strike stands.
16. An invalid request (a blank action; an empty actor; a subject with one half): throws before any
    verification; the bucket row is identical; no row anywhere.
17. The transaction is committed before the function resolves: the work's row and the entry are
    visible to another connection.
18. AC-19: `MAX_FAILURES - 1` failed approvals, a successful `verifyPinThrottled('LOGIN', …)`, one
    more failed approval: the cooldown starts. And the reverse: `MAX_FAILURES - 1` failed logins,
    an approved action, the `LOGIN` row unchanged.
19. More than `MAX_FAILURES` concurrent wrong approvals: exactly `MAX_FAILURES` return `FAILED` and
    the rest `THROTTLED`; the entries match one for one; one `COOLDOWN_STARTED`.
20. `recordApprovalCancelled`: one `APPROVAL_CANCELLED` entry, null approver, action and subject;
    both bucket rows identical; no security event; an invalid input throws and writes nothing.
21. Secrets: no PIN used in the file appears in any row of `audit_entry` or `security_event`, in
    any returned value, or in the message or stack of any error thrown.
22. (With the default change.) The entry's `occurred_at` is not earlier than a `clock_timestamp()`
    the work read after a `pg_sleep`.
23. Source scan over `apps/server/src`: `approverId`, the string `MANAGER_APPROVAL` and the three
    `APPROVAL_*` outcome literals appear only in `domain/approval.ts`, `domain/audit.ts` and
    `domain/throttle.ts`; `approval.ts` does not import `pin.ts`.

#### PHASE0-010a: red proofs

Each mutation must turn the named case red; the Handoff reports the failure text.

- Write the `SUCCESS` entry through `writeAuditOwnTransaction`: case 13 or 14.
- Map `THROTTLED` to `APPROVAL_FAILED`, or write nothing on `THROTTLED`: case 11.
- Call the work before the verification, or on `FAILED`: case 7.
- Verify in `LOGIN`: cases 8 and 18.
- Catch the evidence failure and return `FAILED`: case 15.
- Validate after verifying: case 16.
- Remove migration `0008`: case 1 and case 11.

#### The Handoffs must carry forward

- For every gated command (Phase 2 on): one call to `withManagerApproval`, with a literal action;
  the work uses only the client it is given; `managerPin` in the body, never a session; one new row
  in the AC-27 table; the entry's action asserted by the command's own test.
- For Phase 2: the cancel route's design in question 5, the action vocabulary, `APPROVAL_REQUIRED`,
  `REFUSED`, and the idempotency question in question 10.
- AC-18, AC-19 and AC-27 close only as far as the table in question 9 says.


## Lead rulings

These rulings are addressed to the builder.

1. **The outcome is spelled `APPROVAL_THROTTLED`** (the consult's question 2, settled by the lead). It
   is permanent once a row carries it.
2. **No reason and no amounts on an unapproved entry** (`APPROVAL_FAILED`, `APPROVAL_THROTTLED`,
   `APPROVAL_CANCELLED`), as question 2 recommends. Only the `SUCCESS` entry carries the request's
   reason and the work's amounts.
3. **`0008` also sets `audit_entry.occurred_at`'s default to `clock_timestamp()`**, as question 8
   recommends, in the same file and the same `ALTER TABLE` or a second statement in it. Test case 22
   is therefore required. `security_event` is not changed. The explorer found no test that compares
   column defaults, so `schema.test.ts` case 12 should pass unedited; if it does not, stop and raise it.
4. **Files.** `db/migrations/0008_audit_entry_approval_throttled.sql`; `apps/server/src/domain/audit.ts`
   (rule 2 of the consult); `apps/server/src/domain/approval.ts`; `apps/server/test/approval.test.ts`
   (cases 4 to 23, each test name starting with the consult's case number); `apps/server/test/schema.test.ts`
   (cases 10 and 11 only). You may add a helper to `test/support/people.ts` if two cases need it.
5. **ARCH-006's owner item 6 is not open.** The owner ruled on 2026-10-06 that an approved void the
   server refuses writes `REFUSED`. Nothing in this task writes `REFUSED`; question 10 says where it
   will go.
6. **The owner's items in ARCH-013 do not block this task** (the PRD wording for FR-J3, AC-18 and
   FR-A5; inferred abandonment; Cancel in flight; the flood risk; the ADR). Build to the consult and
   cite the 2026-10-06 ruling, not the PRD sentence it conflicts with.
7. **The two `ask.sh` routes** are available for library facts: `.agent/bin/ask.sh librarian
   "<question>"`. Say in the Handoff what you asked, if anything.
8. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
9. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
   observed. Do not work around a rule.

## Tests expected to change

- `apps/server/test/schema.test.ts`: case 10's loop (`:329-335`) gains `APPROVAL_THROTTLED`; case 11's
  title (`:343`) says "four", and its refused values stay `REFUSED`, `SUCCEEDED` and `''`. Nothing
  else in the file.
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline, which the
   lead records below this line at dispatch, the client's tests unchanged.
   **Baseline (lead, 2026-10-12):** `development` at `cb23a29`, 64 test files and 3211 tests, green in
   about 50 seconds.
2. `approval.test.ts` alone is green three times in a row; the Handoff maps each case number (4 to 23)
   to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rn "pin.js\|pin'" apps/server/src/domain/approval.ts`
   (nothing); `grep -rn "approverId" apps/server/src` (only `approval.ts` and `audit.ts`);
   `grep -rn "MANAGER_APPROVAL\|APPROVAL_" apps/server/src` (only `approval.ts`, `audit.ts` and
   `throttle.ts`, as test case 23 requires);
   `grep -rnE "now\(\)" apps/server/src/domain/approval.ts db/migrations/0008_*.sql` (nothing).
5. `npm run db:migrate` applies `0008` to a database at `0007` (the dev database `pos`) and a second
   run applies nothing; the Handoff shows both outputs.
6. The Handoff carries forward the items under *The Handoffs must carry forward*, and says what
   PHASE0-010b needs from this task that it does not have.

## Out of scope

- Any route, code, schema or change to `@pos/contracts` (PHASE0-010b).
- The cancel route, the action vocabulary, `APPROVAL_REQUIRED`, `REFUSED` and idempotency (Phase 2).
- Client changes, the designer's M-1 and BO-12 edits, the PRD wording, the recommended ADR.
- Editing migration `0004` or any migration before `0008`. `docs/` of any kind.

## Round 2: lead ruling (2026-10-12)

These rulings are addressed to the builder. The review (`.agent/reviews/PHASE0-010a-review.md`) has one
P2 finding, **accepted**: `withManagerApproval` hands the work the same `approver` object it later
reads `approver.id` from for the `SUCCESS` entry (`approval.ts:79`, `:83`), and it keeps the caller's
`subject` object by reference (`:48`). A work callback can therefore assign `approver.id` or the
request's `subject.id` and change who and what the combined entry names, after the PIN was verified.
That breaks the consult's question 3 ("the action and subject are fixed in `ApprovalRequest` before
the PIN is verified … The work cannot change what the entry says was approved") and FR-J2/FR-J3.

10. **Snapshot what the entries say, before the first `await`.** Copy `subject` into a new object
    of two strings (its `type` and `id`) at the top of `withManagerApproval`, before the dry-run
    validation, and use only that copy for validation and for every entry this call writes. Keep the
    verified manager's id in a private `const` string, and write the `SUCCESS` entry's `approverId`
    from that string. Give the work its own object (`{ id }`, frozen with `Object.freeze`), never the
    one the entry reads. Do the same subject copy in `recordApprovalCancelled`. A subject that is not
    an object, or whose parts are not strings, must still be refused before verification exactly as
    the dry run refuses it today (case 16 stays green unedited).
11. **Regression, as case 4b in `approval.test.ts`:** a work that assigns a different existing staff
    id to the approver argument (catch the `TypeError` a frozen object throws in strict mode, or assert
    the assignment did not take) and replaces the original request's `subject.type` and `subject.id`:
    the result is `APPROVED`, and the `SUCCESS` entry names the verified manager and the original
    subject. The test name starts with "4b".
12. **Red proofs:** (a) write `approverId` from the object handed to the work and drop the freeze:
    case 4b fails; (b) use the caller's `subject` object instead of the copy: case 4b fails. Revert
    each and show the failure text in the Handoff.
13. **Nothing else changes in this round.** The dry-run validation stays as it is. Run `approval.test.ts`
    once, then `npm run verify` once on its own (no parallel runs against the test database), and
    commit. Append a *Round 2* section to the Handoff with the new counts (expected: 65 files, 3235
    tests); the last line stays DONE or BLOCKED.

## Handoff

### What I did

Built the evidence and the primitive for inline manager approval, to ARCH-013 and the lead rulings, on
branch `agent/phase0-010a`. No route, code, schema or contracts change.

- `db/migrations/0008_audit_entry_approval_throttled.sql`: widens `audit_entry_outcome_check` to admit
  `APPROVAL_THROTTLED`, and sets `audit_entry.occurred_at`'s default to `clock_timestamp()` (lead ruling 3).
  `0004` is untouched. The comments avoid the literal `now()` so acceptance grep 4 is empty.
- `apps/server/src/domain/audit.ts`: `AuditOutcome` and `OUTCOMES` gain `'APPROVAL_THROTTLED'`. Nothing else.
- `apps/server/src/domain/approval.ts` (new): exactly the exports of question 3 (`ApprovalRequest`,
  `ApprovedWork`, `ApprovalOutcome`, `withManagerApproval`, `recordApprovalCancelled`). Imports only
  `pg` (type), `withTransaction`, `writeAudit`, `writeAuditOwnTransaction`, `verifyPinThrottled`. No
  module state, no SQL of its own, no `pin.ts`.
- `apps/server/test/approval.test.ts` (new): 23 tests, one per case 4 to 23 (case 14 and case 18 have two
  tests each, see below).
- `apps/server/test/schema.test.ts`: cases 10 and 11 only.

The work is one commit on the branch; see the Commit note at the end of this Handoff.

### Decisions and the evidence for them

1. **Early validation without a new export.** The consult (rule 2) allows exporting what the primitive
   needs to validate early. I first exported `validateAudit`, and `audit.test.ts` case 12 ("exports only
   the three writers", `Object.keys(auditModule)` compared whole) failed. That test is not in *Tests
   expected to change*, so I did not edit it. Instead `withManagerApproval` does a dry run through
   `writeAudit` with a stub client whose `query` returns nothing: `validateAudit` runs, no database is
   touched, and there is still exactly one copy of the audit rules. If the lead prefers the plain export,
   the exact change is: export `validateAudit` in `audit.ts`, call it directly in `approval.ts`, and add
   `'validateAudit'` (sorted first) to the expected list at `audit.test.ts:303-307`. Say so and I will make it.
2. **The role assertion.** `VERIFIED` with a role other than `MANAGER` throws a plain error whose message
   names no PIN; it never becomes `APPROVAL_FAILED`. In the red proof for "verify in LOGIN" this is the
   assertion that fires in cases 8 and 21.
3. **`clientInstanceId` is also checked before verification** (non-string or blank throws). It is only
   validated by `writeSecurityEvent` after a strike is counted, so a blank value would otherwise have
   counted a strike and then thrown.
4. **Test probe table.** `approval_probe` (one `note` column, `INSERT` granted to `pos_app`) is created
   through the owner connection in `beforeEach`, after `resetDatabase()`, so a rolled-back work is
   observable. It is dropped with the schema on the next reset.
5. **Secrets scan (case 21)** matches a PIN as a whole token (not flanked by alphanumerics, `.`, `:`, `+`
   or `-`), because a bare six-digit substring would sometimes hit a timestamp's microseconds or a uuid.
   The test asserts the matcher both catches a bare PIN and ignores a timestamp.
6. **Case 14 has a second test**, "a commit that fails leaves no SUCCESS entry". My first red proof
   (write `SUCCESS` through `writeAuditOwnTransaction`) left cases 13 and 14 green: the entry is the last
   statement, so if it fails the outer transaction fails as well. The mutation only shows when something
   fails *at COMMIT*, after the entry was written. The new test adds a `DEFERRABLE INITIALLY DEFERRED`
   unique constraint on the probe table and inserts the same note twice. Under the mutation it fails
   (a `SUCCESS` entry survives a rolled-back action); with the real code it passes.
7. **Case 18 has two tests** (the two directions the case lists).

### Case to test-name map (`apps/server/test/approval.test.ts`)

- 4: "4: another manager approves; the work runs once inside a transaction and one SUCCESS entry carries everything"
- 5: "5: an approval resets MANAGER_APPROVAL after two failures and leaves the LOGIN row identical"
- 6: "6: a manager approves their own action with their own PIN, approver equal to actor"
- 7: "7: a PIN that matches nobody fails, runs nothing, counts one strike and writes one APPROVAL_FAILED"
- 8: "8: an active cashier's PIN, the actor's own included, answers exactly as a PIN that matches nobody"
- 9: "9: a deactivated manager's PIN fails like any other"
- 10: "10: the failure that reaches MAX_FAILURES reports the cooldown and starts exactly one COOLDOWN_STARTED"
- 11: "11: during the cooldown the right manager PIN is THROTTLED, runs nothing and leaves the bucket alone"
- 12: "12: once the cooldown has passed the right PIN approves"
- 13: "13: a work that throws surfaces the same error, writes no entry, rolls back its row and keeps the reset"
- 14: "14: a SUCCESS entry that cannot be written fails the request and rolls back the work" and
  "14: a commit that fails leaves no SUCCESS entry, because the entry shares the work's transaction"
- 15: "15: an APPROVAL_FAILED entry that cannot be written makes the primitive throw, with the strike standing"
- 16: "16: an invalid request throws before any verification and changes nothing"
- 17: "17: the transaction is committed before the function resolves"
- 18: "18: failed approvals and a successful login do not touch each other's count" and
  "18: failed logins do not move the LOGIN row when an action is approved"
- 19: "19: concurrent wrong approvals split into MAX_FAILURES failures and the rest throttled, one entry each"
- 20: "20: a cancelled approval is one APPROVAL_CANCELLED entry and touches no bucket or event"
- 21: "21: no PIN used in this file appears in either evidence table, a returned value or an error"
- 22: "22: the entry's occurred_at is not earlier than a clock reading the work took after a sleep"
- 23: "23: only approval.ts, audit.ts and throttle.ts name the approver, the class or the outcomes" and
  "23: approval.ts does not import pin.ts"

`approval.test.ts` alone was run three times in a row: 23 passed each time (3.80 s to 4.07 s).

### Existing tests changed

`apps/server/test/schema.test.ts` only. Case 10: the outcome loop gains `APPROVAL_THROTTLED`, the title
says so, **and the final stored-row count goes from `'4'` to `'5'`**, which the task did not list but
which the extra accepted row makes unavoidable (the loop inserts one more row without an approver).
Case 11: the title says "four"; the refused values are unchanged. Cases 1 and 12 passed unedited.

### Red proofs (each made, run, reverted; `approval.test.ts` against a green tree otherwise)

1. `SUCCESS` written through `writeAuditOwnTransaction` instead of on the work's client: cases 13 and 14
   (the original ones) stayed green, see decision 6. After adding the deferred-constraint test:
   `× 14: a commit that fails leaves no SUCCESS entry ...` with `expected [ { …(9) } ] to deeply equal []`,
   the received row being the `SUCCESS` entry for the cashier with the manager as approver.
2. `THROTTLED` written as `APPROVAL_FAILED`: `× 11 ... "outcome": "APPROVAL_THROTTLED"` expected,
   `"APPROVAL_FAILED"` received; and `× 19 ... expected [...] to have a length of 5 but got 8`. Writing
   nothing on `THROTTLED`: `× 11 expected [ ... ] to have a length of 6 but got 5` and `× 19 expected [] to
   have a length of 3 but got +0`.
3. Work called on `FAILED`: `× 7`, `× 9`, `× 15`, `× 19`, each `expected 1 to be +0` (or `5 to be +0`) on
   the call count. Case 8 did not fail at first because it never asserted the call count; I added
   `expect(calls.n).toBe(0)` to it.
4. Verify in `LOGIN`: 12 failures, including case 8 (`Error: manager approval verified a user who is not
   a manager`), case 18 (`expected '{"blocked_until": null, "throttle_class": "LOGIN",
   "consecutive_failures": 4}' to be ...0}`), and cases 5, 7, 9, 10, 12, 13, 15, 19, 21.
5. Evidence failure caught and `FAILED` returned: `× 15 ... promise resolved "{ outcome: 'FAILED', …(1) }"
   instead of rejecting`.
6. Validation moved after verification: `× 16 ... "consecutive_failures": 0` expected, `4` received (four
   invalid requests, each counted a strike). This was run against the `validateAudit` export form; I then
   switched to the dry-run form (decision 1), which is the same call moved, and did not repeat this mutation.
7. Migration `0008` removed: `× 11`, `× 19`, `× 21` with `new row for relation "audit_entry" violates check
   constraint "audit_entry_outcome_check"`; `× 22 expected [ { ok: false } ] to deeply equal [ { ok: true }
   ]` (the default change); and `schema.test.ts` case 10: `APPROVAL_THROTTLED: expected
   'audit_entry_outcome_check' to be 'audit_entry_unapproved_outcome_check'`.

### `npm run verify`

Typecheck clean. `Test Files 65 passed (65)`, `Tests 3234 passed (3234)`, 54 s. Baseline in the task:
64 files and 3211 tests; the difference is the one new file and its 23 tests. The client project's
tests are unchanged.

### Acceptance greps

- `grep -rn "pin.js\|pin'" apps/server/src/domain/approval.ts`: no output.
- `grep -rn "approverId" apps/server/src`: `approval.ts:83` and `audit.ts` (lines 19, 67, 69, 70, 119).
- `grep -rn "MANAGER_APPROVAL\|APPROVAL_" apps/server/src`: `approval.ts` (62, 64, 68, 102), `audit.ts`
  (11-13, 31, 37-39, 42), `throttle.ts:5`.
- `grep -rnE "now\(\)" apps/server/src/domain/approval.ts db/migrations/0008_*.sql`: no output.

### Migration against the dev database

`npm run db:migrate`: `applied: 0008_audit_entry_approval_throttled.sql`. Second run:
`no pending migrations`. Note that this dev database is the one in the main checkout's running
container (`restaurant-pos-db-1`, port 5433), which this worktree shares.

### What I found and did not fix

- **A stray container.** `npm run db:up` in this worktree failed at `docker compose up` (`Bind for
  127.0.0.1:5433 failed: port is already allocated`, because the main checkout's container holds the
  port). It left a created-but-not-started container `phase0-010a-db-1`, a network and a volume
  `phase0-010a_pgdata`. I tried `docker compose down -v` and the environment refused it, so they are
  still there. They are harmless; the lead or owner can remove them. Tests ran against the main
  checkout's database via the harness's global setup.
- **Test-name caveat.** `approval.test.ts` cases 21 and 23 are named after the consult's numbers but
  hold one or two `it`s; see the map.
- Nothing was run in a browser, none was needed.

### Carried forward

- For every gated command (Phase 2 on): one call to `withManagerApproval`, with a literal action; the
  work uses only the client it is given; `managerPin` in the body, never a session; one new row in the
  AC-27 table; the entry's action asserted by the command's own test.
- For Phase 2: the cancel route's design (question 5), the closed action vocabulary, `APPROVAL_REQUIRED`,
  `REFUSED` (a work that throws still writes nothing, and the test at case 13 will be narrowed, not
  removed), and the idempotency question of question 10.
- AC-18, AC-19 and AC-27 close only as far as the table in question 9 says: AC-18 and AC-19 at the
  domain; the route-level proofs and AC-27 are 010b and later.

### What PHASE0-010b needs and does not have

010b can import `withManagerApproval`, `ApprovalOutcome` and `recordApprovalCancelled` from
`apps/server/src/domain/approval.ts`. It does not have a gated command to call it, so its probe route
must supply a literal action and a work that writes a probe row. The `approval_probe` table in
`approval.test.ts` is a test-local construction, not a migration; 010b must not assume it exists. The
domain returns `FAILED` for four different causes by design, and the HTTP mapping must not distinguish
them either. `retryAfterSeconds` is the only data in the `FAILED` and `THROTTLED` outcomes.

### Commit

Committed on `agent/phase0-010a` after the verify above; the hash is in `git log`.

## Round 2

Fixed the review's P2 (rulings 10 to 13); nothing else changed.

- `apps/server/src/domain/approval.ts`: a private `snapshotSubject` copies a subject's `type` and `id` into
  a new object. `withManagerApproval` takes that copy as its first statement after destructuring the
  request, before the dry-run validation and the first `await`, and uses only the copy for validation and
  for the `THROTTLED`, `FAILED` and `SUCCESS` entries. The verified manager's id is a private `const
  approverId: string`; the `SUCCESS` entry's `approverId` is written from that string, and the work gets
  `Object.freeze({ id: approverId })`, an object nothing else reads. `recordApprovalCancelled` takes the
  same copy. A subject that is not an object (`null`, a string) is passed through unchanged and refused by
  the dry run as before; non-string parts are copied as they are and refused the same way. Case 16 is
  green and unedited. The dry-run validation is unchanged.
- `apps/server/test/approval.test.ts`: new "4b: a work that rewrites the approver argument and the request
  subject cannot change what the entry says". The work assigns `otherManager.id` to `approver.id`
  (asserted to throw a `TypeError`, since modules are strict), then overwrites the original request's
  `subject.type` and `subject.id`. The result is `APPROVED`; the entry names the verified manager and
  `probe` / `p-1`.

Red proofs, each reverted:

- (a) Entry written from a plain object handed to the work, no freeze:
  `× 4b ... AssertionError: expected false to be true` at `expect(rewriteRefused).toBe(true)` (the
  assignment took, so the entry would have named `otherManager`; the freeze assertion comes first).
- (b) The caller's `subject` object used instead of the copy:
  `× 4b ... AssertionError: expected 'order' to be 'probe'` at `expect(entry?.subject_type)`.

`approval.test.ts` run once after the revert: 24 passed. `npm run verify` run once on its own:
`Test Files 65 passed (65)`, `Tests 3235 passed (3235)`, typecheck clean. Committed as a second commit on
the branch (see `git log`).

DONE
