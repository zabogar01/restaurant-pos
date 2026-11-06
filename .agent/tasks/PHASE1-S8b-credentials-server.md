---
id: PHASE1-S8b
title: Credentials on the server — set another user's PIN and password, own password and own PIN, the session re-stamp (plan S8, consult C3)
category: feature
touches: [identity, audit, boundaries]
depends_on: [PHASE1-S8a]
base: agent/phase1-s8a
owns: [apps/server/src/domain/users.ts, apps/server/src/domain/session.ts, apps/server/src/domain/back-office-credential.ts, apps/server/src/domain/pin.ts, apps/server/src/http/routes/back-office-users.ts, packages/contracts/src/users.ts, packages/contracts/src/routes.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, packages/api-client/src/index.ts, apps/back-office/src/session/api.ts, apps/back-office/src/session/fixtureSession.ts, apps/back-office/test/config-api.test.tsx, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**]
status: not-started
cycles: 0
---
# PHASE1-S8b — Credentials on the server: resets, own password and own PIN, the re-stamp

**Written** 2026-11-06 by the lead. Sources:
- slice S8 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S8*);
- **consult C3** (`.agent/reviews/ARCH-020-users-and-credentials.md`): sections 3 to 8 and *For the lead*, *S8b*,
  **copied verbatim below**; sections 1, 2 and 9 to 10 are context only (S8a built them, S8c draws on them);
- **S8a's Handoff** (`.agent/tasks/PHASE1-S8a-users-server.md`, *Names to carry forward*): the routes, schemas, action
  list, `lockUsers`, `command(...)`, `Refusal`, and where each code is emitted. That file is on this branch; read its
  Handoff and its round 2 sections, not its body;
- **the owner's rulings** (DECISIONS 2026-10-20 and 2026-10-21): plan Q1 (a), (b), (c), Q7, Q8, Q11; recorded in
  ARCHITECTURE §7.2, which already carries the own-change and re-stamp wording;
- **ARCHITECTURE** §7.2, §7.3, §8 (the users lock order), §11; **ADR-007, ADR-009 (§4, §5), ADR-010, ADR-011**
  (rules 6, 7, 9, 20, 25); PHASE0-007b's carried item (below, ruling 7);
- PRD FR-A4, FR-A5b, FR-B3, FR-J3; B-11, B-12, B-13.

Where this file and C3 differ, this file wins. Where this file and an accepted ADR or the contract differ, or the code
cannot do what this file says, stop and write `BLOCKED: <question>`.

## Objective

A manager can set another user's PIN and another manager's back-office password, and can change their own password
and their own PIN after giving their current password. Every credential write increments the person's credential
version in the same transaction, so every session of that person ends; an own change re-stamps the one back-office
session it was made from, inside the same transaction, so that session continues with the same token and anti-CSRF
token, and commits nothing if that session cannot be re-stamped. Each success writes one audit entry. No screen is
built (S8c builds BO-06); the client lines are the ones the compiler forces.

## Decided: do not reopen

- **Owner, plan Q1** (2026-10-20): (a) an own password change requires the current password, verified against the
  account's own throttle; (b) an own PIN change keeps the back-office session (and also requires the current
  password); (c) a role change increments the version (S8a built it). Recorded in ARCHITECTURE §7.2.
- **Q7:** the manager types another user's PIN; the PIN-in-use oracle is accepted for the MVP (ARCHITECTURE §3.2, §16).
- **Q8:** the users commands lock and re-check the acting manager (S8a's `lockUsers`).
- **Q11 and FR-J3:** a change to a user's credentials is audited, naming the acting manager and the user and never a
  PIN or password; a wrong current password is security telemetry, not an audit entry.
- **ADR-009 §5's open item is answered in ARCHITECTURE §7.2** (C3 §3, the lead's acceptance): no ADR-013.

## The lead's rulings for this slice

These fill what C3 left open or what S8a's code settles; the owner may overturn them.

1. **No migration.** The grants S8b needs exist: `staff_user` `UPDATE (pin_hash, pin_lookup, credential_version)`
   (`0015`), `back_office_credential` `UPDATE (password_hash, …)` (`0007`), `actor_session` `UPDATE` (`0003`). If a write
   needs a privilege that is not there, stop and write `BLOCKED`.
2. **The four commands live in `apps/server/src/domain/users.ts`** beside S8a's, inside `command(...)`, opening with
   `lockUsers(client, actor, subjectId)`; for an own change the subject is the actor (`lockUsers` then locks one row).
   `set-pin` and `set-password` check `OWN_ACCOUNT` before `command(...)` and before any hashing, on the lower-cased id,
   as S8a's `deactivateUser` does. The four actions join `USER_ACTIONS`: `user.pin.reset`, `user.password.reset`,
   `user.own_pin.change`, `user.own_password.change`. The routes join `back-office-users.ts`.
3. **The re-stamp is one exported function in `apps/server/src/domain/session.ts`**, taking the transaction's client,
   the session id, the staff user id, the old and the new version, running C3 §3's statement and returning the row
   count (or a boolean for exactly one). The caller throws a `Refusal` answering `UNAUTHENTICATED` on anything but one
   row, so the whole transaction rolls back. Name it as you see fit and record the name in the Handoff. The
   source-scan test reads every `.ts` file under `apps/server/src` and `apps/server/scripts` and fails if any file but
   `users.ts` (and `session.ts`, which defines it) names it.
4. **The verification and the version.** The account verified is the guard's actor's `staffUserId`, never a value from
   the body (`verifyPasswordThrottled({ staffUserId }, currentPassword, { clientInstanceId })`, unchanged), and it
   commits before the change's transaction opens. Nothing is hashed before it succeeds. Inside the change's
   transaction, after `lockUsers`, the locked actor row's `credential_version` must also equal the version the
   verification returned; otherwise `UNAUTHENTICATED`, nothing written. Whether the route verifies and passes the
   verified user to the domain, or the domain verifies and returns the result for the route to map through
   `verifiedUser`, is your choice; the answers must be exactly section 4's.
5. **A credential set to the value it already had is a success** (C3 §3): it increments, re-stamps where it is an own
   change, and writes its entry. An own PIN set to one's current PIN is therefore not `DUPLICATE` (the partial index
   compares with other rows).
6. **Driving the exactly-one-row rule (C3 S8b AC 6).** A session released *before* the transaction is already refused by
   `lockUsers`'s session read, so that case cannot prove the row count. Test it anyway, then prove the rule inside the
   window: a separate connection holds `FOR UPDATE` on the acting `actor_session` row; the command blocks at the
   re-stamp (observe the wait through `pg_stat_activity` or `pg_locks`, never a sleep); the holding connection sets
   `released_at` and commits; the command answers `UNAUTHENTICATED`, and the hash, the PIN, the version and the audit
   table are as they were. *Red:* ignore the row count: the new hash is committed.
7. **The throttle columns (PHASE0-007b's carried item).** `set-password` writes `password_hash` only
   (`UPDATE back_office_credential SET password_hash = $1 WHERE staff_user_id = $2`). The test compares
   `consecutive_failures::text` and `blocked_until::text` before and after, with a running cooldown set by the owner
   role. For `own-password` the count is reset by the successful verification (ADR-009 §4), not by the write: the write
   still touches `password_hash` only.
8. **Subjects.** `set-pin`: an unknown id is `NOT_FOUND`; an inactive subject or a kitchen subject is `USER_CHANGED`; a
   cashier or a manager, active, is set. `set-password`: `NOT_FOUND`; an inactive subject, or one that is not a
   `MANAGER` with a credential row (a cashier, kitchen staff, a former manager whose credential row stays), is
   `USER_CHANGED`. A subject who is the actor never reaches these checks (ruling 2).
9. **The own changes answer `{ user }` and leave the session as it was:** no `Set-Cookie`, no `csrfToken` in the body,
   the session's token, `issued_at` and absolute lifetime unchanged, on success and on every refusal. `renewableAccount`,
   `reauthenticateSession`, `signIn` and `renewSession` are not called.
10. **Contracts.** `CurrentPassword` is `z.string().min(1).max(1024)`, exported; `ReauthenticateRequest` and `auth.ts`
    stay untouched. `SetPinRequest { staffUserId, pin: NewPin }`, `SetPasswordRequest { staffUserId, password:
    NewPassword }`, `OwnPasswordRequest { currentPassword, password: NewPassword }`, `OwnPinRequest { currentPassword,
    pin: NewPin }`, all strict. The schema runs before the verification, so a malformed new secret is
    `VALIDATION_FAILED` with nothing verified and nothing counted. `SECRET_KEYS` already lists all four field names;
    `log.ts` is not in `owns`. `credential-keys.test.ts` walks the new schemas without an edit; C3's red (rename
    `currentPassword` to `oldPassword` in a schema only) now applies as written.
11. **The client lines are declarations only:** `SPECS`, `ROUTES`, the four back-office API functions (called by no
    screen), the four `unavailable` entries in `fixtureSession.ts`'s `CONFIG`, and `config-api.test.tsx`'s run-time route
    list and its title. No new error code, so neither client's `realSession.ts` changes, and the POS is untouched.
12. **`back-office-credential.ts` and `pin.ts`** are in `owns` only for an export the commands need (`hashPassword` and
    `preparePin` are exported already); if one is added, case 28's exact export list grows by it and nothing else.
13. **The browser suite runs before merge** (the lead runs `npm run test:e2e:all`); no browser test is added or changed
    (S8c's).

## C3's decisions, copied verbatim

The text below is ARCH-020's sections 3 to 8 and its *For the lead*, *S8b*, unedited, with headings moved down one
level. Sections 5, 6 and 8 describe S8a's commands too; S8a built those parts, and they are here because S8b's commands
reuse them (the lock, `DUPLICATE`'s details, the field names, the log scan).

### 3. The credential-version increments, the re-stamp, and ADR-009 §5

**Decided:** ADR-009 §5 (one version; deactivation, a PIN reset and a password set or reset each
increment it in the same transaction; an own password change re-stamps the one session it was made
from, in the same transaction as the hash change and the increment); Q1(a), (b), (c); FR-B3.

**The increments, recommended as one rule: a command increments the version when it deactivates
the person, changes their role or classification, or stores or removes a PIN or a password.**

| Command | Increments | Why |
|---|---|---|
| Create (any classification) | No; the row starts at 1 | No session can exist |
| Deactivate (another user) | Yes | Ends every session at once (the predicate's `is_active` would too), and keeps them dead after a later reactivation: without it, reactivation would revive every session the person held |
| Reactivate, keeping the PIN | No | Every earlier session already failed at the deactivation's increment |
| Reactivate with a new PIN | Yes | A PIN is stored; uniform, and harmless (no session can exist) |
| Change role (all six moves) | Yes | Q1(c) |
| Set another user's PIN | Yes | ADR-009 §5 |
| Set another manager's password | Yes | ADR-009 §5; the throttle columns untouched (PHASE0-007b) |
| Own password | Yes, and re-stamps the acting session | Q1(a), ADR-009 §5 |
| Own PIN | Yes, and re-stamps the acting session | Q1(b) |
| A no-op (deactivating the inactive, reactivating the active) | No | Nothing is written at all (C2) |

A PIN or password set to the same value it already had still increments and is audited. The
server could tell a same PIN by its lookup, but treating it as a no-op would make "resetting a PIN
ends every session" depend on what was typed, and a reset is a deliberate act. A manager's manual
resend of a reset after an unknown outcome therefore writes a second entry and a second increment,
both truthful (two commands were sent) and both harmless (the sessions had already ended).

**The re-stamp.** Both own-credential commands run in this order:

1. The guard: cookie, anti-CSRF token, resolution (interactive), `MANAGER`.
2. The schema (`VALIDATION_FAILED`; nothing verified, nothing counted).
3. The current password, verified for the session's user (section 4), in its own committed
   transaction. Failure answers now.
4. The new secret hashed (Argon2id, and for a PIN the lookup), outside any transaction, so no lock
   is held across a hash.
5. One transaction: lock the acting manager's `staff_user` row (`FOR NO KEY UPDATE`, section 5);
   require it active, `MANAGER`, and at the credential version step 3 verified; for a password,
   lock the credential row and write `password_hash` only; for a PIN, write `pin_hash` and
   `pin_lookup` (a unique violation is `DUPLICATE` with `field: 'pin'` and rolls everything back);
   increment the version; **re-stamp the acting session**; write the audit entry; commit.
6. Answer `{ user: UserView }`. No cookie is set or cleared, the token is not rotated, and no
   `csrfToken` is issued: the tab carries on exactly as it was.

The re-stamp is one new function in `apps/server/src/domain/session.ts`, taking the transaction's
client:

```sql
-- SKETCH. Exactly one row, or the caller rolls back.
UPDATE actor_session
   SET credential_version = $4
 WHERE id = $1 AND staff_user_id = $2 AND audience = 'BACK_OFFICE'
   AND released_at IS NULL AND credential_version = $3
```

**It must update exactly one row, or the whole transaction rolls back** and the answer is
`UNAUTHENTICATED`. Zero rows means the acting session was released (a logout in another tab), or
its version had already moved; committing the change then would leave the manager signed out of a
session the contract says "continues". Rolling back keeps the guarantee: after a committed own
change, the session it was made from is valid.

**One module, two callers.** The function is imported only by the module that holds the two
own-credential commands; a source-scan test holds that list. That is the bound ADR-009 §5 drew
("it exists only for the acting manager's own session"), kept as a checked property.

**The ADR-009 §5 question, answered plainly.** Q1(b) makes an own PIN change keep the back-office
session, so a user-management command writes a session row in **two** places, not ADR-009 §5's
"single place". Q1(c) likewise falsifies ADR-009's *Consequences* bullet "a manager whose role is
changed keeps a session that resolves".

**My judgement: both are answers to ADR-009's open questions, not changes to its decision.**

- ADR-009 lists both under *Not decided here*, and says of the PIN case "as decided, a PIN reset
  ends the session": it marks the status quo as provisional, pending exactly this answer. The
  *Consequences* bullet on role changes ends "Whether a role change should also increment the
  version is a Phase 1 decision."
- The mechanism §5 decided is unchanged: one credential version for both credentials (the
  per-credential alternative stays rejected); a re-stamp of exactly the one session from which the
  acting manager changes their own credential, in the same transaction as the change; no other
  session write by any user-management command. What grows is the set of the acting manager's own
  credential changes, from one to two.
- "The single place" was true of the only command that then existed. Read as a decision, it would
  mean the ADR had decided Q1(b)'s answer, which its own *Not decided here* says it had not.

Because an accepted ADR is never edited, the statement that is now true must live somewhere
binding. **I recommend ARCHITECTURE §7.2** (wording in *Stale text* 1), which already carries the
own-password re-stamp, together with the DECISIONS line of 2026-10-20 and FR-B3, which already
says "their own password or PIN". No superseding ADR.

**If the lead judges the "single place" sentence to be part of the decision**, ADR-009 is
superseded on that one point and nothing else. I propose, and do not assume, a short ADR-013,
*Own-credential changes and role changes* (Status: Proposed; supersedes ADR-009 §5's second
paragraph and its *Consequences* bullet on role changes), whose decision would read:

> A manager who changes their own password or their own PIN from the back office must give their
> current password, verified against their own account's throttle. The command re-stamps the one
> back-office session it was made from with the new credential version, in the same transaction as
> the change and the increment; if that session cannot be re-stamped, nothing is committed. Every
> other session of that manager, POS and back office, ends. These two commands are the only
> user-management commands that write a session row. A change of a user's role or classification
> increments the credential version, so every session of that user ends on its next authenticated
> request.

Everything else in ADR-009 would stand. I do not recommend it: it restates in a second record what
the owner's answers to the first record's open questions already are.

**Two consequences worth recording, neither a change.** After S8a, a demoted manager's idle
back-office session no longer resolves (its version moved), so M-6 answers `UNAUTHENTICATED`,
clears the cookie and counts nothing: ADR-011's recorded reading ("a demoted manager … is answered
`INVALID_CREDENTIALS` at M-6 … and can lock their own account") describes a case that can no longer
arise. And `FORBIDDEN` from the back-office guard becomes unreachable in practice, as ARCH-012 §8
foresaw; the role check stays as the control.

### 4. Verifying the current password

**Decided:** Q1(a) and (b) (the own changes require the current password, verified against the
account's own throttle); ADR-009 §4 (one attempt is one transaction owned by the verifying
function; a refused attempt verifies and writes nothing; a failure is a SecurityEvent naming
nobody; only that account's successful verification resets the count); ADR-011 rules 6, 7, 9 and
25; ARCH-012 §8 ("the session module's functions should not assume M-6 is their only caller").

**Recommended:**

- **The existing `verifyPasswordThrottled({ staffUserId })` is called, unchanged, with the actor's
  `staffUserId` from the guard.** The body has no `username`; a `username` key in an own-change
  body is a strict-schema failure, as at M-6, so the request cannot name whom to verify. A
  `currentPassword` is checked by the schema for type and a generous size only (`min(1).max(1024)`,
  as `ReauthenticateRequest`), so a malformed one counts as a failure on the account, as ADR-011
  rule 9 says of every typed credential.
- **What it answers**, through the existing `verifiedUser` mapping in `http/verification.ts`:
  `FAILED` is 401 `INVALID_CREDENTIALS`, with `retryAfterSeconds` only when this failure started a
  cooldown; `THROTTLED` is 429 `THROTTLED` with `retryAfterSeconds`. ADR-011 rule 7 defines
  `INVALID_CREDENTIALS` as "a credential did not verify"; a wrong current password is one more
  instance of it, as the wrong password at M-6 is, and needs no new code. The transport core ends a
  session only on `SESSION_IDLE`, `UNAUTHENTICATED` and `FORBIDDEN` (`client.ts`), so both answers
  reach the form as refusals and the session continues.
- **A failure is security telemetry, never an audit entry.** It writes `PASSWORD_FAILURE` (and
  `COOLDOWN_STARTED` when it starts one) in `BACK_OFFICE_LOGIN`, after the throttle commits, naming
  nobody, exactly as `verifyPasswordThrottled` already does. The person typing at a signed-in desk
  is the one Q1(a) does not trust, so an entry naming the session's manager would attribute to them
  what a passer-by did (B-13). FR-J3's list does not include it either.
- **It is not a sign-in.** It creates, renews and releases no session; it sets and clears no
  cookie; it issues no `csrfToken` and does not rotate the token; the session's `issued_at` and
  absolute lifetime are untouched. It moves the activity stamp only through the guard's ordinary
  interactive resolution, as every command does. `renewableAccount`, `reauthenticateSession` and
  `signIn` are not called.
- **Its success resets the account's count**, because it is a successful verification of that
  account (ADR-009 §4). Five wrong current passwords start the account's cooldown, which also
  blocks that manager's M-6 and BO-01 sign-in for five minutes while the session itself continues:
  the per-account lockout the owner accepted on 2026-10-07, reached from one more screen.
- **Verification and change are two transactions**, in that order (section 3, steps 3 and 5). The
  change transaction re-checks, under the lock, that the person is still active, still a manager
  and still at the credential version that was verified; otherwise `UNAUTHENTICATED` and nothing
  written. That closes the window in which another manager could reset this one's password between
  the two.

**Alternatives.**

- *One transaction for verification and change*, by giving `verifyPasswordThrottled` a callback
  run before commit. Atomic, and it changes the verifying function the sign-in, M-6 and the
  throttle tests depend on, holds the credential lock across a second Argon2id hash, and needs a
  rule for which of "the strike" or "the change" a failure inside the callback rolls back. The
  two-transaction form needs none of that and loses nothing: a success reset followed by a refused
  change is truthful (the password was right).
- *A dedicated code for a wrong current password.* It would be `INVALID_CREDENTIALS` under another
  name, with the same details. Rejected.
- *Counting a wrong current password nowhere*, because the session already proves who is there.
  That is exactly what Q1(a) declined: without a count, an unattended desk could guess the
  password without limit.

### 5. Self-deactivation and self-demotion, and the acting manager under the lock

**Decided:** Q8 ("the plan's rule": the server refuses a manager deactivating their own account or
removing their own manager role; another manager may be deactivated or demoted; not a last-manager
rule), recorded with the owner's reason, "the back office can never lose its last manager".

**Recommended:**

- **The code is `OWN_ACCOUNT`, 409, no details**: "this command may not be aimed at the acting
  manager". It refuses: `deactivate` and every `change-role` move when `staffUserId` is the
  actor's; and the two other-user credential commands of S8b (`set-pin`, `set-password`) when aimed
  at oneself, because FR-B3 requires the current password for one's own PIN or password, and the
  other-user commands do not take it. One's own credentials change only through `own-password` and
  `own-pin`.
- **It is not `FORBIDDEN`.** The core ends the session on `FORBIDDEN` and the back office destroys
  the working area with it (ADR-011 rule 22); a refusal of one command must not do that.
- **Its place: after the schema, before the transaction opens.** It compares the body's id with
  the guard's actor id. No row is read, no commit can change either id, and nothing is written, so
  there is nothing for a lock to protect; checking it first also means the refusal can never wait
  behind another manager's lock.

**What Q8's guarantee needs beyond the self check.** The guard reads the actor's role when the
request arrives, without a lock. Two managers who deactivate or demote each other at the same
moment each pass the guard, each lock only the other's row, and both commit: no manager is left,
and recovery needs `create-manager` at the host. The self check alone cannot see this; it is the
case the owner's reason excludes.

**Recommended: every users command locks the acting manager's row as well as the subject's, and
re-reads it.** The first statement of every users transaction is

```sql
SELECT id, role, is_active, credential_version FROM staff_user
 WHERE id = ANY($1) ORDER BY id FOR NO KEY UPDATE   -- $1: the actor and the subject
```

followed by the check that the actor's row is active, `MANAGER`, and at the credential version of
the acting session (read from that session's row, which must be unreleased); otherwise
`UNAUTHENTICATED`, nothing written. With the rows locked in id order, two crossing commands
serialise; the second finds its actor demoted or deactivated (and, after Q1c, at a new version) and
is refused. Whatever order they commit in, the actor of the last committed command is still an
active manager, so at least one always remains.

- **`FOR NO KEY UPDATE`, not `FOR UPDATE`.** No users command changes a key, and the weaker mode
  does not block the `FOR KEY SHARE` lock a foreign-key check takes: a session being created for
  the person, or an audit entry naming them, need not queue behind a users command. The tables use
  `FOR UPDATE` (C2) because Phase 2 will take that row in a documented order; nothing in §8 takes a
  StaffUser row, so the cheaper mode is free here.
- **Lock order:** the StaffUser rows in id order, then the subject's BackOfficeCredential row, then
  (own changes only) the acting ActorSession. No other path holds these in another order: the
  password verification locks only the credential row and commits; sign-in, M-6 and the guard each
  write an ActorSession row in a single statement. No cycle exists. ARCHITECTURE §8 should say so
  (*Stale text* 3).

**Alternatives.** *The self check after the lock*: the same answer, later, and able to wait behind
another command. *No actor lock*, relying on the guard: correct for every configuration command
where a stale actor costs nothing (tables, the catalog), and wrong here, where the race is the one
the owner ruled out. *A "last active manager" count*: the owner declined it (Q8, "plan's rule").

### 6. Reactivation, a taken PIN, and the PIN-in-use refusal

**Decided:** Q6(a) and FR-B3 ("a reactivated user keeps their PIN unless another active user holds
it, in which case a new PIN is set before reactivation"); FR-A4 and `0006` (PINs unique among active
users; a deactivated user's PIN may be given to another); Q7 (the manager types the PIN; the
oracle is accepted for the MVP); C2 (`DUPLICATE`, 409, as the generic uniqueness refusal; the
partial unique index is the only authority; no pre-check; a no-op writes nothing).

**Recommended: `POST /api/back-office/config/users/reactivate` with `{ staffUserId, pin? }`.**

- Lock (section 5). Unknown id: `NOT_FOUND`. Already active: a no-op that answers the record and
  writes nothing, `pin` or no `pin`, so a manual resend after an unknown outcome is harmless.
- Inactive kitchen row: a `pin` is `USER_CHANGED` (a kitchen row has no PIN to keep or replace;
  giving one is a role change); without one, set `is_active` and answer.
- Inactive cashier or manager, **no `pin`**: set `is_active`. If an active user holds the person's
  PIN, the partial unique index refuses the update; the domain catches SQLSTATE `23505` on
  `staff_user_active_pin_lookup_key` by name and answers **`DUPLICATE` with `details: { field:
  'pin' }`**, nothing written. The client then asks for a new PIN and sends the command again with
  it.
- Inactive cashier or manager **with a `pin`**: store the new PIN, set `is_active`, increment, in
  one statement; the same index refuses a PIN that is itself taken, with the same answer. A `pin`
  is accepted even when the old PIN was free: the old holder may have been deactivated between the
  refusal and the resend, and a manager who chose a new PIN should get it. That is a reset at
  reactivation, audited as such (section 7).
- A reactivated manager's credential row, username, password and throttle state are unchanged:
  their old password verifies again. Their old sessions stay dead (the deactivation incremented).

**`DUPLICATE` gains optional typed details, on the users routes only.** A users command can meet
two unique keys, the active PIN lookup and the username (create a manager; promote to manager), and
the form must place the refusal on the right field. `ErrorDetailsByCode` gains
`DUPLICATE: { field: 'pin' | 'username' }`, and the envelope schema's `DUPLICATE` entry gets
optional details of that shape. Tables keep sending `DUPLICATE` with no details, so S1a's assertion
that a table's refusal body is exactly `{ "error": { "code": "DUPLICATE" } }` stays true. C2
foresaw this ("a later form with two unique fields adds a details type then; details are optional,
so adding them breaks nothing"). The field is a constant the server chose from the constraint's
name, never a value from the request or the database error (ADR-010 rule 1). A command that would
violate both keys is refused on the first statement that fails: the PIN, because the StaffUser
write comes before the credential insert. The manager fixes it and meets the second, if any, next.

The username index (`back_office_credential_username_key`) refuses a username held by any row,
active or not, which is ADR-009 §3's "never reused". Any other unique violation is a fault (500),
and no PostgreSQL error is copied or logged by its message: the PIN index's `detail` quotes the
**lookup** (the blind index, which ARCHITECTURE §7.3 says is never exposed or logged), and the
username index's quotes the username.

**The oracle (Q7, accepted; for the §3.2 gate list).** Every refusal with `field: 'pin'` tells the
manager that some active colleague holds the PIN they typed, at create, at promotion from kitchen,
at a PIN reset, at an own PIN change and at reactivation. It names no one; a manager can try the PIN
at the POS to learn whose it is. Managers already know the PINs they set; the refusal adds the ones
another manager set. Accepted for the MVP by the owner on 2026-10-20. Exact wording for §3.2 and
§16 is in *Stale text* 2.

**Alternatives.** *Reactivation that always demands a new PIN*: the architect's earlier
recommendation, overruled by the owner on 2026-10-07. *A pre-check of the PIN before the update*: a
race, and the index already answers. *Separate codes `PIN_IN_USE` and `USERNAME_TAKEN`*: workable;
they lose to the task's ruling that `DUPLICATE` is the generic uniqueness refusal, and they would
give the client two codes to place for one behaviour. *A refusal that hides which field collided*:
the manager could not fix the form.

### 7. The audit entries

**Decided:** Q11 and FR-J3 (a back-office change to a user's status, role or credentials is
audited, naming the acting manager and the user and never a PIN or password; nothing else in
Phase 1); ADR-007 (the entry in the same transaction as the action; one entry per action; no PIN in
any form); B-13 (every entry names a specific person); the existing writer `writeAudit(client,
entry)` and `audit_entry`'s columns and grants (`0004`, `0008`); ADR-009 §7 (the first-manager
script writes none: no authenticated actor).

**Recommended: one entry per successful command that changes something**, written with
`writeAudit` on the command's own client, before commit, so the change and its evidence commit or
roll back together:

| Column | Value |
|---|---|
| `actor_id` | the acting manager (the guard's actor) |
| `approver_id` | null (no approval is involved) |
| `action` | one of the constants below |
| `outcome` | `SUCCESS` |
| `subject_type`, `subject_id` | `staff_user`, the user's id (equal to the actor for an own change) |
| `reason`, `before_amount`, `after_amount` | null |

The actions, a closed list in one server module (a const object and its union type), each meaning
one fact so that a later audit viewer can render it without reading anything else:

| Command | `action` |
|---|---|
| Create a cashier / a manager (if OQ1 is yes) | `user.create.cashier` / `user.create.manager` |
| Deactivate | `user.deactivate` |
| Reactivate, keeping the PIN / with a new PIN | `user.reactivate` / `user.reactivate.new_pin` |
| Change role, per move | `user.role.kitchen_to_cashier`, `user.role.kitchen_to_manager`, `user.role.cashier_to_manager`, `user.role.manager_to_cashier`, `user.role.cashier_to_kitchen`, `user.role.manager_to_kitchen` |
| Set another user's PIN | `user.pin.reset` |
| Set another manager's password | `user.password.reset` |
| Own PIN / own password | `user.own_pin.change` / `user.own_password.change` |

- **One entry per command, naming the move.** The audit table has no column for a role before and
  after, and a role change that also sets a PIN or a password is one act of the manager's.
  Encoding the move in the action keeps ADR-007's "one entry per action" and lets the entry say
  everything the command did, since each move sets exactly the credentials its variant requires
  (section 2). Dotted lower case follows the only action string in the code today (`order.void`, in
  `audit.test.ts`).
- **No entry for** a no-op (nothing changed), a refusal (nothing was done; FR-J3 audits refused
  actions only for an approved refund or void), a wrong current password (section 4: security
  telemetry), creating a kitchen record (no authority and no credential; see OQ1), or anything the
  first-manager script does (ADR-009 §7).
- **Nothing secret in any column.** The writer takes no PIN or password argument at all, and no
  column could carry one except `reason`, which is always null here. The username is not written
  either: the subject is the id.

**The test that proves no PIN, password or hash reaches an entry** (S8a for its commands, extended
in S8b): run every users command once on the success path with distinct marker credentials (a PIN
of six marker digits, a password and a username of marker text), then, as the owner role, read
every `audit_entry` row whole (`row_to_json(a)::text`) and assert that none contains any marker
PIN, password or username, the PIN's lookup (`pinLookup(marker)`), or the text `$argon2id$`; and
that each command wrote exactly one entry with the expected `action`, actor and subject. *Red:*
write the PIN into `reason` in one command: the test fails. A second test proves the transaction:
a command whose audit write fails (an action outside the closed list, refused by the writer's
validation) changes nothing in `staff_user` or `back_office_credential`. *Red:* write the entry
after commit.

**What the audit does not cover, and should not:** the list read, every table command (Q11), and
the security events of section 4.

### 8. The new request fields, the redaction backstop, the log scan and the routes

**Decided:** ADR-010 rule 2 (no body, header or cookie reaches a logger; redaction is a backstop
over listed names only, so `newPassword` or a nested `pin` passes it; the property is proved by a
log scan with markers through every channel); ADR-011 rules 1, 4, 9, 16 and 25; C2 (ids in `POST`
bodies, fixed-string paths, strict schemas, no custom messages, the form refuses untrimmed text
rather than the schema transforming it).

**The field names: four, all top-level, never nested.** `pin`, `password`, `username`,
`currentPassword`. A new PIN is `pin` and a new password `password` wherever they appear; there is
no `newPassword`, `newPin` or `confirmPassword` (a confirmation field, if E2 draws one, is compared
in the client and never sent). No request schema nests a credential inside an object or array.

**The backstop.** `SECRET_KEYS` in `apps/server/src/http/log.ts` gains `currentPassword` and
`username`. `username` is not a secret, but ADR-009 §4 observes that "a mistyped username is
frequently a password typed into the wrong field", which is why a security event never stores it;
the backstop should treat it the same way. **A contracts-level test closes the gap the ADR names:**
it walks the top-level keys of every request schema in `@pos/contracts` and fails when a key matching
`/pin|password|username/i` is not in the backstop list (exported for the test), and fails when any
schema carrying such a key nests an object. *Red:* rename `currentPassword` to `oldPassword` in the
schema only.

**The schemas.** Strict objects, no transforms, no custom messages:

- `StaffName`: as `TableLabel`, trimmed, 1 to 64, no control character (section 1).
- `NewPin`: `SixAsciiDigits`, the existing rule.
- `NewUsername`: exactly ADR-009 §3's stored form, `^[a-z0-9][a-z0-9._-]{2,31}$`. The form trims and
  lower-cases ASCII letters before checking, as C2's form trims a label, so the field-list helper
  can place an error and the server stores what it validated; `normaliseUsername` still runs in the
  domain and is idempotent on it.
- `NewPassword`: a string of 8 to 128 **code points**, counted as `createBackOfficeCredential`
  counts them (`[...password].length`, a refine, after a generous UTF-16 `max`), never trimmed.
  **This differs deliberately from the sign-in schemas**, which check type and size only so that a
  malformed credential counts as a failed match (ADR-011 rule 9). A credential being *set* must
  meet the rule exactly, before it is sent, so the form can say which field is wrong.
- `CurrentPassword`: as `ReauthenticateRequest`'s `password`, `min(1).max(1024)`, so it is judged by
  the verification and counted (section 4).

**The routes**, each `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive }`, under C2's
`/api/back-office/config/` prefix, ids in the body:

| Method | Path | Body | Answers | `interactive` | Slice |
|---|---|---|---|---|---|
| `GET` | `/api/back-office/config/users` | none | `{ users: UserView[] }` | `false` | S8a |
| `POST` | `…/users/create` | union on `classification`: `KITCHEN { name }`, `CASHIER { name, pin }`, `MANAGER { name, pin, username, password }` | `{ user }` | `true` | S8a |
| `POST` | `…/users/change-role` | union on `change` (section 2) | `{ user }` | `true` | S8a |
| `POST` | `…/users/deactivate` | `{ staffUserId }` | `{ user }` | `true` | S8a |
| `POST` | `…/users/reactivate` | `{ staffUserId, pin? }` | `{ user }` | `true` | S8a |
| `POST` | `…/users/set-pin` | `{ staffUserId, pin }` | `{ user }` | `true` | S8b |
| `POST` | `…/users/set-password` | `{ staffUserId, password }` | `{ user }` | `true` | S8b |
| `POST` | `…/users/own-password` | `{ currentPassword, password }` | `{ user }` | `true` | S8b |
| `POST` | `…/users/own-pin` | `{ currentPassword, pin }` | `{ user }` | `true` | S8b |

`UserView` is `{ staffUserId, name, classification, isActive, username }`, a strict schema:
`classification` is `'CASHIER' | 'MANAGER' | 'KITCHEN'` (the row's null role read as `KITCHEN`);
`username` is the stored username or null, non-null exactly when a credential row exists, a former
manager's included. Nothing else: never a hash, a lookup, the credential version, the throttle
columns or whether a PIN is set (a cashier or manager always has one, kitchen never). The list is
every user, active and inactive, ordered by `created_at`, then `id`. The guard already requires
`MANAGER` on every route and the anti-CSRF token on every `POST`; no route is `NONE` or `OPTIONAL`,
so `access.test.ts`'s explicit list is unchanged.

**There is no standalone "set username and password" route.** FR-B3's "set a manager's back-office
username and password" happens where a manager is made, at create and at promotion, both of which
require them; no command can make a manager without a login, so a standalone route would be
reachable by no honest flow. A login-less manager can exist only if made outside the application
(none is today: the script creates both); the remedy is a demotion and a promotion, which sets
both. This is a reading for the lead to confirm, not an owner question.

**The codes S8 adds**, each entering `ErrorCode` in the slice that first emits it and tests it
(ADR-010 rule 1), and each placed in both clients' code switches (ADR-011 rule 20):

| Code | Status | Details | Emitted when | First slice |
|---|---|---|---|---|
| `OWN_ACCOUNT` | 409 | none | section 5 | S8a |
| `USER_CHANGED` | 409 | none | the command's precondition on the user's state does not hold (sections 2 and 6, and S8b's resets on a kitchen, inactive or non-manager subject) | S8a |
| `DUPLICATE` (existing) | 409 | optional `{ field: 'pin' \| 'username' }` | section 6 | S8a adds the details |

`NOT_FOUND`, `VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `THROTTLED` and `UNAUTHENTICATED` are reused
as they are.

**The log scan** (ADR-010 rule 2, `apps/server/test/log-scan.test.ts`, at trace level). For every
new route and every credential field it carries, a distinct marker, through: the success path; a
`DUPLICATE` on the PIN (the marker PIN made to collide, and its **lookup** also searched for); a
`DUPLICATE` on the username; a strict-schema refusal with the marker in an extra key and in a
malformed value; and, for the own changes, a wrong current password and a throttled one. Assert
that no marker, no marker lookup and no `$argon2id$` appears in any log line or response body, and
that every non-2xx body is exactly the envelope. The existing case 24 ("a probe that logs { pin,
password } produces a line without either key") gains `currentPassword` and `username`.

### For the lead, S8b (C3, verbatim)

#### S8b — server: credential resets, own password and own PIN, the re-stamp

- **Touches:** `identity`, `audit`, `boundaries` (B-11, B-12, B-13). Browser suite before merge.
- **Depends on:** S8a merged.
- **Owns:** `apps/server/src/domain/users.ts` (or S8a's module) and `session.ts` (the re-stamp);
  `apps/server/src/http/routes/back-office-users.ts`; `packages/contracts/src/users.ts`,
  `routes.ts`, `index.ts`; `packages/api-client/src/specs.ts`, `client.ts` (`ROUTES`);
  `apps/back-office/src/session/api.ts` (the four functions); `apps/server/test/**`,
  `packages/contracts/test/**`, `packages/api-client/test/**`.
- **Scope.**
  1. Contracts: `SetPinRequest`, `SetPasswordRequest`, `OwnPasswordRequest
     { currentPassword, password }`, `OwnPinRequest { currentPassword, pin }`; four route-table
     entries.
  2. `set-pin` and `set-password` for another user: `OWN_ACCOUNT` on oneself; the S8a lock and
     re-check; `NOT_FOUND`; `USER_CHANGED` for an inactive subject, a kitchen subject (PIN), or a
     subject that is not a manager with a credential row (password); the write; the increment; the
     audit entry. A password write touches `password_hash` only.
  3. `own-password` and `own-pin`: section 3's six steps, the verification of section 4, the
     re-stamp with its exactly-one-row rule.
  4. The re-stamp function in `session.ts`, and a source-scan test holding its importers to the one
     users module.
  5. Log scan for the four routes, including a wrong and a throttled current password.
- **Acceptance criteria, each with its red proof:**
  1. Route table, access loop and anti-CSRF as S8a's 1 and 2, for the four routes.
  2. A PIN reset: the new PIN verifies, the old does not; every session of the person resolves
     `NONE`; a taken PIN is `DUPLICATE` `{ field: 'pin' }`; a kitchen or inactive subject is
     `USER_CHANGED`; on oneself, `OWN_ACCOUNT`. *Red:* drop the increment: the person's POS session
     still resolves.
  3. A password reset (PHASE0-007b's carried test): the new password verifies, the old does not;
     every session ends; **`consecutive_failures` and `blocked_until` are byte-for-byte what they
     were, a running cooldown included**. *Red:* clear the throttle columns in the write.
  4. Own password, from back-office session S1, with a second back-office session S2 and a POS
     session P1 of the same manager open: after it, S1 resolves `ACTIVE` and its next command
     succeeds with the same anti-CSRF token; S2 and P1 resolve `NONE`; the new password verifies.
     The same for own PIN (S1 continues; P1 and S2 end; the new PIN verifies at `findUserByPin`).
     *Red:* skip the re-stamp: S1 ends.
  5. The re-stamp is in the change's transaction: with a fourth connection holding `FOR UPDATE` on
     S1's `actor_session` row, a third connection cannot see the new hash or the new version until
     the fourth releases and the command commits. *Red:* re-stamp after commit: the hash is visible
     while the re-stamp waits.
  6. The exactly-one-row rule: an own change whose acting session is released between the guard and
     the transaction (driven at the domain level) answers `UNAUTHENTICATED` and changes no hash and
     no version. *Red:* ignore the row count.
  7. The current password: wrong is 401 `INVALID_CREDENTIALS`, with `retryAfterSeconds` only on the
     fifth; then `THROTTLED` with nothing verified; each failure writes one `PASSWORD_FAILURE` and
     the fifth one `COOLDOWN_STARTED`, in `BACK_OFFICE_LOGIN`, naming nobody; no audit entry; no
     session is created, renewed or released, no `Set-Cookie` is sent and the session's token is
     unchanged; a `username` key in the body is `VALIDATION_FAILED`. *Red:* verify against a
     username from the body.
  8. A taken PIN on own PIN is `DUPLICATE` and leaves hash, version and session as they were.
  9. Audit: one entry per success with the four actions of section 7; the marker scan extended.
  10. Source scan: only the users module imports the re-stamp. *Red:* import it from the
      re-authentication route.
  11. Log scan for the four routes; `npm run verify` green; `npm run test:e2e:all` green.
- **Tests expected to change:** `log-scan.test.ts`, `session.test.ts` (the re-stamp), the S8a users
  tests, `back-office-credential.test.ts` (the throttle-column case). Nothing else.
- **The Handoff must carry forward:** the routes; that the own changes keep the token and issue no
  `csrfToken`; the exact answers of the current-password field.


## Acceptance criteria

C3's eleven criteria under *For the lead*, *S8b*, above, bind as written, each with its red proof: write each test
first, run it against the unchanged code and record the failing assertion; apply each *Red*, observe it failing for the
stated reason, revert, and report. AC 6 is driven as ruling 6 says. Add these, which C3 did not have:

12. **Ruling 5:** a PIN reset and a password reset to the value the subject already had, and an own PIN and an own
    password set to the current ones, each succeed, increment the version by one and write one entry; the own ones
    re-stamp. *Red:* treat a same-value own PIN as a no-op: no entry is written.
13. **Ruling 8:** `set-pin` on an unknown id is `NOT_FOUND`, on an inactive or kitchen subject `USER_CHANGED`;
    `set-password` on an unknown id is `NOT_FOUND`, on an inactive manager, a cashier, kitchen staff and a former
    manager with a credential row `USER_CHANGED`; each with nothing written (`xmin` of both rows unchanged) and no
    entry. Both on oneself are `OWN_ACCOUNT`, answering while another connection holds a lock on the actor's row.
    *Red:* drop the credential-row check: the former manager's password is set.
14. **Ruling 10:** a malformed new password or PIN in an own change is `VALIDATION_FAILED` with the account's count
    unchanged and no `PASSWORD_FAILURE` written. *Red:* verify the current password before the schema: the count moves.
15. **Ruling 9:** on an own change's success and on each of its refusals (`VALIDATION_FAILED`, `INVALID_CREDENTIALS`,
    `THROTTLED`, `DUPLICATE`, `UNAUTHENTICATED`), the response has no `Set-Cookie` header and no `csrfToken`, and the
    `actor_session` row's token hash, `issued_at` and `released_at` are as they were. *Red:* call `renewSession` on
    success: the header appears.
16. **Ruling 4:** a password reset of the acting manager by another manager, committed between this manager's
    verification and the change's transaction (driven at the domain level), answers `UNAUTHENTICATED` and writes
    nothing.
17. **Ruling 11:** `route-table.test.ts` and `access.test.ts` pass unedited; `config-api.test.tsx` lists the four new
    routes; `credential-keys.test.ts` passes unedited and fails on C3's rename.
18. `npm run verify` green, with counts; `npm run test:e2e:all` green (no browser test changes; the lead also runs it).

## Tests expected to change

- C3's list: `log-scan.test.ts` (the four routes; a wrong and a throttled current password), `session.test.ts` (the
  re-stamp), the S8a users tests (`users.test.ts`, `users-audit.test.ts`, `users-crossing.test.ts`: new cases, the marker
  scan extended), `back-office-credential.test.ts` (the throttle-column case; case 28 only if ruling 12 adds an export).
- `apps/back-office/test/config-api.test.tsx`: its run-time list of config routes and its title (ruling 11).
- New test files as you see fit (the source scan, the routes).
- `route-table.test.ts`, `access.test.ts` and `credential-keys.test.ts` are **not edited**.
- **Nothing else should change.** A change anywhere else is reported in the Handoff with its reason; a weakened assertion
  is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: a
  builder's heredoc stopped S7b2's first round for over an hour on an approval prompt, and S8a's on one too.
- No PIN, password, username, hash or lookup in any log line, response body, audit column or error message; no
  database error copied or logged by its message (C3 §6, ADR-010 rules 1 and 2).
- Hash outside any transaction; never hold a lock across a hash; never hash a new secret before the current password
  has verified (C3 §3 steps 3 and 4).
- Lock order: the `staff_user` rows (`lockUsers`), then the subject's `back_office_credential` row, then the acting
  `actor_session` row (ARCHITECTURE §8). No statement takes them in another order.
- Run `npm run verify` on a quiet machine, not beside another suite or `test:e2e`: server tests share one database.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`agent/phase1-s8a` at `d8aab78` (PR #173, not yet merged; its tree is S8a's final one, `24909f1`): `npm run verify` 162
files, 5779 tests; `npm run test:e2e:all` 130 passed. The development database `pos` is at `0015`; run `npm run
db:migrate` before the server tests (it should apply nothing). Confirm the baseline before you start and state the new
counts in the Handoff.

## Out of scope

- S8c: BO-06, every browser test, `e2e/support/scan.ts`, DESIGN-023's F3 save-prompt check.
- Renaming a user (OQ2); a standalone "set username and password" (C3 §8, ruled out in S8a).
- Any change to a POS or back-office screen beyond ruling 11's declarations; any ARCHITECTURE or design text.
- S8a's `reactivateUser` hashing a supplied PIN for a no-op (noted, not fixed).

## Commit and report

Commit on `agent/phase1-s8b` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done; what was decided and on what evidence; tests changed and why; each red
proof; what was found and not fixed; the real `verify` output (say whether you ran `test:e2e:all`); and what C3's
*For the lead* says the Handoff must carry forward: the routes; that the own changes keep the token and issue no
`csrfToken`; the exact answers of the current-password field (status, code, details, when `retryAfterSeconds`
appears). Add the re-stamp function's name and the four actions.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

**What I did.** One commit on `agent/phase1-s8b`, `5849011` (19 files, 1327 insertions), cut from S8a's tip. No migration (ruling 1): the grants of `0003`, `0007` and `0015` cover every write, and no statement needed a privilege that was missing.

- `apps/server/src/domain/session.ts`: `restampOwnSession(client, { sessionId, staffUserId, oldVersion, newVersion })` runs C3 section 3's statement on the transaction's client and returns `true` only for exactly one row. This is the re-stamp function's name.
- `apps/server/src/domain/users.ts`: four commands beside S8a's, each inside `command(...)` and opening with `lockUsers`. They are `setUserPin`, `setUserPassword`, `changeOwnPassword` and `changeOwnPin`; the two own commands share a private `changeOwn`. `USER_ACTIONS` gains the four actions: `user.pin.reset`, `user.password.reset`, `user.own_pin.change` and `user.own_password.change`. `set-pin` and `set-password` check `OWN_ACCOUNT` before `command(...)` and before any hashing, on the lower-cased id.
- `apps/server/src/http/routes/back-office-users.ts`: the four routes. Own-change order is the guard, then `parseBody`, then `verifyPasswordThrottled({ staffUserId: actor.staffUserId }, currentPassword, { clientInstanceId })` mapped through `verifiedUser`, then the domain call. The route verifies and hands the domain the verified `credentialVersion`; the domain hashes the new secret only after that.
- Contracts: `CurrentPassword` (`min(1).max(1024)`), `SetPinRequest`, `SetPasswordRequest`, `OwnPasswordRequest`, `OwnPinRequest`, all strict, exported through `index.ts`; four `ROUTE_TABLE` entries, all `interactive: true`. Client declarations: `SPECS`, `ROUTES` (`usersSetPin`, `usersSetPassword`, `usersOwnPassword`, `usersOwnPin`), the back-office `api.ts` and `configApi`, four `unavailable` entries in `fixtureSession.ts`. No new error code, so neither `realSession.ts` changed and the POS is untouched.
- `log.ts` is not touched: `SECRET_KEYS` already listed `currentPassword` and `username`, and case 24 already asserted all four keys.

**The routes, for the carry-forward.** All `POST`, all `{ session: 'ACTIVE', audience: 'BACK_OFFICE', interactive: true }`, ids in the body:
- `/api/back-office/config/users/set-pin` takes `{ staffUserId, pin }`;
- `/api/back-office/config/users/set-password` takes `{ staffUserId, password }`;
- `/api/back-office/config/users/own-password` takes `{ currentPassword, password }`;
- `/api/back-office/config/users/own-pin` takes `{ currentPassword, pin }`.
Each answers `{ user }` (the `UserView`).

**The own changes keep the token and issue no `csrfToken`.** On success and on every refusal: no `Set-Cookie`, no `csrfToken` in the body, and the session's token hash, `issued_at`, `released_at` and absolute lifetime are as they were. The only session column that moves on success is `credential_version`, by the re-stamp. `renewableAccount`, `reauthenticateSession`, `signIn` and `renewSession` are not called. The client keeps its anti-CSRF token and cookie and its next command goes through (tested).

**The exact answers of the current-password field.** It is `CurrentPassword = z.string().min(1).max(1024)`, so a missing, empty, over-long or non-string value is `400 VALIDATION_FAILED` and counts nothing. A string that does not match the actor's password is `401 INVALID_CREDENTIALS` with no details, except the failure that starts the cooldown (the fifth), which is `401 INVALID_CREDENTIALS` with `details: { retryAfterSeconds }` (about 300). After that, any current password, the right one included, is `429 THROTTLED` with `details: { retryAfterSeconds }`, nothing verified and nothing counted. Each failure writes one `PASSWORD_FAILURE` and the fifth also one `COOLDOWN_STARTED`, class `BACK_OFFICE_LOGIN`, naming nobody; no audit entry; a `THROTTLED` answer writes no event. A right current password resets the account's count. A `username` key is `VALIDATION_FAILED` (strict). The account verified is always the guard's actor. Five wrong current passwords also block that manager's BO-01 and M-6 sign-in for five minutes while the session continues (C3 section 4; the owner accepted this on 2026-10-07).

**What I decided, and on what evidence.**
- Ruling 4's choice: the route verifies and passes the verified version to the domain. The domain re-checks it under the lock after `lockUsers` (`locked.actor.credential_version !== verifiedVersion` gives `UNAUTHENTICATED`). `lockUsers` already compares the actor row with the session's version, so this check is belt and braces: when it fires alone, the re-stamp's `credential_version = $3` fails too and rolls back. I kept both and tested it at domain level (case 16, `verifiedVersion` 0), but no red can separate the two.
- Own password locks the credential row after the StaffUser rows and before the session (ARCHITECTURE section 8), and writes `password_hash` only. Its own count reset comes from the verification, not the write (ruling 7).
- `changeOwnPassword`'s credential-row-missing case throws `Refusal(UNAUTHENTICATED)`: a manager who passed the guard and verified a password has a row, so it is unreachable from a request and rolls back if it ever is.
- A same-value PIN or password is a success: it increments, re-stamps (own) and writes its entry (ruling 5). Tested for all four.
- Race proof (ACs 5, 6, 15 and 16): a request through HTTP cannot sit at the re-stamp. The guard's interactive resolution is an `UPDATE` of the same `actor_session` row, so a held row lock blocks the request at the guard, and a release in that window gets a guard 401 that also clears the cookie. So the AC 5 and AC 6 window tests call `changeOwnPassword` and `changeOwnPin` at domain level, with a separate connection holding `FOR UPDATE` on the session row, and observe the wait through `waitForLockWaits` (`pg_stat_activity`), never a sleep. The HTTP-level `UNAUTHENTICATED` of AC 15 is driven another way: a holder on the actor's `staff_user` row blocks the change at `lockUsers`, then bumps the version and commits.

**Existing tests I changed, and why.**
- `users.test.ts`: case 1 (the route list) grows from five to nine routes, and `bodyFor` gains the four bodies. No assertion was loosened. Without this the case fails, as ruling 11 foresaw.
- `session.test.ts`: case 31's exact export list grows by `restampOwnSession` and nothing else; two new cases (33) prove the statement.
- `log-scan.test.ts`: new markers and the four routes' success, DUPLICATE-on-PIN, strict-schema, wrong and throttled paths, in a separate `credentialRefusals` list; the S8a exact refusal list is untouched. The scan assertions cover the new markers because they are leaves of `USERS_MARK`. One new case asserts the 15 expected answers, with `retryAfterSeconds` normalised to `N`.
- `users-audit.test.ts`: four new steps with marker credentials, the marker lists extended, the row count `>= 13` raised to `>= 17`.
- `config-api.test.tsx`: the run-time route list and its title (`nine users routes`).
- `packages/contracts/test/users.test.ts`: new cases for the four schemas (additions only).
- `test/support/users.ts`: `setPin`, `setPassword`, `ownPassword`, `ownPin`, `post` and `BODY.INVALID_CREDENTIALS` (additions only).
- `back-office-credential.test.ts` is **not** changed: the throttle-column case (ruling 7) lives in `users-credentials.test.ts`, case 3, because its subject is the users command. `route-table.test.ts`, `access.test.ts` and `credential-keys.test.ts` are untouched and pass.
- New files: `users-credentials.test.ts` (28 cases) and `restamp-scan.test.ts` (1 case).

**Red proofs.** I wrote the production code before the tests, which departs from the "test first, run against unchanged code" instruction. The compensation is that every red below was run against the finished code, with the mutation made, the failing assertion read, and the mutation reverted (`git diff apps/server/src` was read afterwards and holds no residue):
- AC 2, drop the increment in `setUserPin`: `expected 1 to be 2` (version), cases 2 and 12.
- AC 3, clear the throttle columns in the password write: `expected [ 0, null ] to deeply equal [ 3, '2026-11-06 05:51:11…' ]`.
- AC 4, skip the re-stamp: S1 resolves `NONE` (`expected 'NONE' to be 'ACTIVE'`), cases 4, 12 and 15 fail too; cases 5 and 6 time out because the command never waits.
- AC 5, re-stamp after commit through a second connection: `expected '$argon2id…/bkpkb…' to be '$argon2id…wcn0ie…'` (the new hash is visible while the re-stamp waits).
- AC 6, ignore the row count: `expected { kind: 'OK', … } to deeply equal { kind: 'UNAUTHENTICATED' }`.
- AC 7, verify against a username from the body (the schema made to accept `username`): the request naming another manager answers `200` instead of `400`.
- AC 10, import the re-stamp in `back-office-auth.ts`: the scan lists `src/http/routes/back-office-auth.ts` as a third naming file.
- AC 12, treat a same-value own PIN as a no-op: `expected 1 to be 2` and no entry.
- AC 13, drop the `role !== 'MANAGER'` check: the former manager (now a cashier) gets `200`. I also separately dropped the credential-row check: a manager with no credential row gets `200`. Both reds are in case 13.
- AC 14, verify the current password before the schema: a five-digit PIN beside a wrong current password answers `401 INVALID_CREDENTIALS` instead of `400`.
- AC 15, call `renewSession` after an own PIN change: `Set-Cookie: rpos_bo_sid=…` appears (cases 4 and 15). My first attempt used `presentedForRenewal`, which throws a plain error on an `ACTIVE` route, so the result was a 500 and a wrong-reason failure; I redid it with the cookie token and got the header.
- Audit, write the PIN into `reason` for `set-pin`: `"reason": "pin 639485"` instead of `null` (the step assertion fires before the marker scan reaches the row, so the marker scan's own assertion was not the one observed to fail).
- C3's rename (`currentPassword` to `oldPassword` in `OwnPasswordRequest` only): `credential-keys.test.ts` fails with `OwnPasswordRequest.oldPassword is not in SECRET_KEYS`.
- Not given a red: AC 16 and the `verifiedVersion` check (see above), and AC 8 (a taken own PIN), whose DUPLICATE comes from the database's partial unique index, which no source mutation removes.

**Found and not fixed.**
- `reactivateUser` hashes a supplied PIN for a no-op (S8a's note, out of scope).
- `set-password` on an active `MANAGER` with no credential row (made outside the application, as the test does through the owner connection) answers `USER_CHANGED`, per ruling 8. The remedy the owner has is demotion then promotion, as C3 section 8 says.
- Case 7's THROTTLED check relies on the cooldown being about 300 seconds (`> 290`). It is stable unless the test machine pauses a test for ten seconds between the fifth failure and the read.

**`npm run verify`.** Run on the committed tree: typecheck clean for all seven projects, then `Test Files 164 passed (164), Tests 5814 passed (5814)`. The baseline was 162 files and 5779 tests, so +2 files (`users-credentials.test.ts`, `restamp-scan.test.ts`) and +35 tests. The first run, before I updated `users.test.ts` case 1, had `1 failed | 5813 passed`; that was the expected route-list case. I also ran `npm run test:e2e:all` here (Chromium and WebKit): `130 passed (2.1m)`, matching the baseline. No browser test was added or changed.

**Formatter.** No formatter was run on any file; edits were made by hand.

**What the next agent (S8c) needs and does not have.** `ROUTES.usersSetPin`, `usersSetPassword`, `usersOwnPassword` and `usersOwnPin` exist in `@pos/api-client`, and `store.config['/api/back-office/config/users/<set-pin|set-password|own-password|own-pin>']` is typed and wired in `officeApi`; the fixture session answers `unavailable` for them. The error codes a form must place: `INVALID_CREDENTIALS` (the wrong current password; field = current password) and `THROTTLED` (with `retryAfterSeconds`) from the own changes; `DUPLICATE` with `details.field === 'pin'` from `set-pin` and `own-pin`; `OWN_ACCOUNT`, `USER_CHANGED`, `NOT_FOUND`, `VALIDATION_FAILED` and `UNAUTHENTICATED` as before. A `UNAUTHENTICATED` from an own change means the session or the credentials moved under the manager; the core ends the session on it as for any command. The own changes answer the `UserView` only, so BO-06 must not expect a new token or `csrfToken`.

DONE
