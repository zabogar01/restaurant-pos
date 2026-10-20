# ARCH-020 — Consult C3: users and credentials (plan slice S8)

Author: `architect20`, 2026-10-20. Read-only consult for S8a, S8b and S8c (none written yet), on
`agent/arch-020` cut from `development` at `3749fb7`. Nothing was edited except this report and the
task file's Handoff.

## Summary

S8 can be built inside the contract, every accepted ADR and every DECISIONS line as they stand. **No
contract change is needed**; two owner questions are raised (one blocks only S8a's audit list, one
blocks nothing), and one optional AC-18 sentence is offered. On the ADR-009 §5 question my judgement
is that the owner's Q1 answers ADR-009's open items and changes none of its decisions, so **no
superseding ADR is needed**; the reasons, and the exact one-point ADR to write if the lead judges
otherwise, are in section 3.

The decisions, in the order of the task's ten items:

1. **Kitchen is a row with a null role, a null PIN hash and a null PIN lookup**, all three or none,
   held by one check constraint, so "a role and no PIN" and "a PIN and no role" are both impossible
   in the database. `pos_app`'s table-wide `UPDATE` on `staff_user` becomes a column grant on
   `role, pin_hash, pin_lookup, is_active, credential_version` only: never `id`, `name` or
   `created_at`. The name gains C1's printed-text check (trimmed, 1–64, no control character).
2. **One `change-role` command with six variants, keyed by a `change` field** naming the move
   (`KITCHEN_TO_CASHIER`, …), each variant a strict object whose required credential fields are
   exactly what that move needs. The move's "from" half is a precondition checked under the lock;
   a mismatch is a new code, `USER_CHANGED` (409). Every role change increments the credential
   version (Q1c). Promotion to manager always sets a new password, and a username only when the
   person has never had one; demotion leaves the credential row, which never verifies.
3. **The credential version is incremented by deactivation, every role change, and every PIN or
   password that is stored**; not by creation or reactivation alone. The own password and own PIN
   commands re-stamp the acting session in the same transaction as the change, through one new
   session-module function with exactly two callers in one module.
4. **The current password is verified by the existing `verifyPasswordThrottled({ staffUserId })`,
   for the session's own user, in its own transaction, before the change transaction**: a wrong
   one is `INVALID_CREDENTIALS` and a strike on that account, a cooldown is `THROTTLED`, a failure
   is a security event as at M-6, and nothing about the session or its cookie changes. It is not a
   sign-in.
5. **Self-deactivation and self-demotion are refused with a new code, `OWN_ACCOUNT` (409)**, before
   the transaction opens, because the check compares two ids and no commit can change it. The same
   code refuses the other-user PIN and password resets aimed at oneself, so the current-password
   rule cannot be bypassed. Separately, every users command **locks and re-reads the acting
   manager's own row**, so two managers demoting or deactivating each other at once cannot both
   succeed: Q8's "the back office can never lose its last manager" then holds under concurrency.
6. **Reactivation takes an optional PIN.** Without one the user keeps theirs, and the partial
   unique index refuses it with `DUPLICATE` and `details: { field: 'pin' }` when an active user now
   holds it; with one, the new PIN is set in the same command. `DUPLICATE` gains optional typed
   details `{ field: 'pin' | 'username' }` for the users routes; tables keep sending none. The
   PIN-in-use refusal is the accepted oracle (Q7), with exact wording for the §3.2 list and §16.
7. **One audit entry per successful command that changes something**, in the command's
   transaction, through the existing `writeAudit`, with a closed list of fixed action names, the
   acting manager as actor and the user as subject, and no PIN, password, username, hash or lookup
   in any column. No entry for a no-op, a refusal or a wrong current password. Whether creating a
   cashier or manager is audited is owner question OQ1.
8. **Four credential field names in total: `pin`, `password`, `username`, `currentPassword`**,
   always top-level, never nested, never `newPassword` or `newPin`. `currentPassword` and
   `username` join the redaction backstop; a contracts test fails on a credential-looking key the
   backstop does not list. Nine routes, all `ACTIVE`, `BACK_OFFICE`; the list read is not
   interactive, every command is; the guard's anti-CSRF check covers the eight `POST`s.
9. **S8a records** (migration, list, create, role change, deactivate, reactivate, the lock
   protocol, the audit, the new codes), **S8b credentials** (PIN and password resets of another
   user, own password and own PIN with the re-stamp), **S8c BO-06 and the browser**. S8a carries
   PINs and passwords in its bodies already, so it is `identity` and owns its own log-scan cases.
10. **What E2 must draw**: listed in section 10.

Seven architecture and design texts are owed (section *Stale text*), none by S8's builders; one
contract sentence (AC-18) is offered, not required.

## What I verified, and what I could not

Read in this worktree at `a167115`: the task file; the Phase 1 plan whole; `.agent/DECISIONS.md`
from 2026-10-05 to the end; ADR-007, ADR-009, ADR-010 and ADR-011 whole; ADR-012 rule 8 and its
consequence on printed names; ARCHITECTURE §3.2, §5, §7, §8, §11 to §14 and §16; PRD FR-A1 to
FR-A7, FR-B1 to FR-B4, FR-J1 to FR-J4, the edge-case list, AC-18, AC-19, AC-27, AC-28, AC-32 and
AC-35; ARCH-012 §8; ARCH-018's C1 text on printed names; ARCH-019 (C2) whole; the *For Phase 1* and
*next agent* notes of PHASE0-004, 005, 006b, 007, 007b, 009b and 012b; SCREEN-INVENTORY BO-06;
SITEMAP BO-06 and its cross-client walk 4; DESIGN-011's BO-06 section.

The code read: `db/migrations/0002`, `0003`, `0004`, `0006`, `0007`, `0008`, `0009`;
`apps/server/src/domain/` (`staff.ts`, `pin.ts`, `session.ts`, `throttle.ts`,
`back-office-credential.ts`, `audit.ts`); `apps/server/src/http/` (`log.ts`, `validate.ts`,
`verification.ts`, `routes/back-office-auth.ts`, the exports of `session-guard.ts`); the
back office's error switch in `apps/back-office/src/session/realSession.ts` and the core's
session-ending codes in `packages/api-client/src/client.ts`; the `staff_user` cases of
`apps/server/test/schema.test.ts`; `e2e/support/scan.ts`'s credential-route map; and, in the
`PHASE1-S1a` worktree (in review, not on this branch), `domain/dining-table.ts`,
`http/routes/back-office-tables.ts`, `packages/contracts/src/errors.ts` and `tables.ts`.

PostgreSQL 16 facts, from the librarian (`.agent/bin/ask.sh librarian`), each cited to the manual:

- `REVOKE UPDATE ON t` also revokes the column-level `UPDATE` grants on `t`; revoking a column
  privilege does not remove a table-level one. So the migration revokes first and grants columns
  after (sql-revoke, *Description*).
- `SELECT … FOR UPDATE` (and the other row-lock modes) needs `SELECT` plus `UPDATE` on at least one
  column (ddl-priv §5.7; sql-select). Column `UPDATE` is therefore enough to lock a row.
- A `CHECK` is satisfied when its expression is true or null (ddl-constraints §5.4.1), so the
  existing `role IN ('CASHIER','MANAGER')` and `pin_hash LIKE '$argon2id$%'` checks pass a null.
- `ALTER TABLE … ADD CONSTRAINT … CHECK` scans the table unless `NOT VALID` (sql-altertable). The
  librarian could not confirm the error wording on a violating row; the migration does not depend
  on it.

The librarian's quotes came through a summarising fetch; the task file should tell the builder to
confirm the column-grant syntax against the manual, as C1 did for `[[:cntrl:]]`.

Not done: no code was run, no test was run, no browser was opened.

## 1. The `staff_user` loosening for kitchen staff

**Decided:** FR-A1 (kitchen is a non-authenticating classification with no PIN and no application
permissions); owner, 2026-10-06 (kitchen staff are user records); Q9 (a person may move between
kitchen and the roles; to kitchen removes the PIN from use); ARCHITECTURE §5.1 (StaffUser holds a
classification, an optional authentication role and a PIN hash for authenticating users). The plan:
"a forward migration that loosens `staff_user` without letting a row hold a role and no PIN",
enforced by constraints, not application checks.

**Recommended: kitchen is `role IS NULL`, with the PIN hash and lookup null with it.**

```sql
-- SKETCH for S8a's migration (the next free number when it is written).
ALTER TABLE staff_user
  ALTER COLUMN role       DROP NOT NULL,
  ALTER COLUMN pin_hash   DROP NOT NULL,
  ALTER COLUMN pin_lookup DROP NOT NULL,
  -- A role and a PIN together, or neither (kitchen). Never one without the other.
  ADD CONSTRAINT staff_user_credential_shape_check CHECK (
    (role IS NULL AND pin_hash IS NULL AND pin_lookup IS NULL)
    OR (role IS NOT NULL AND pin_hash IS NOT NULL AND pin_lookup IS NOT NULL)),
  -- Printed-text rule (ADR-012 rule 8, C1): trimmed, bounded, no control character.
  ADD CONSTRAINT staff_user_name_text_check CHECK (
    name = btrim(name) AND char_length(name) <= 64 AND name !~ '[[:cntrl:]]');

REVOKE UPDATE ON staff_user FROM pos_app;
GRANT UPDATE (role, pin_hash, pin_lookup, is_active, credential_version)
  ON staff_user TO pos_app;
```

- **The existing checks stay.** `staff_user_role_check` still refuses `'KITCHEN'` or any other
  string, and passes a null; `staff_user_pin_hash_check` passes a null. Schema case 16 ("rejects
  KITCHEN as a staff_user role") stays true and unchanged: kitchen is not a role value.
- **The partial unique index of `0006` needs nothing.** A null `pin_lookup` is never equal to
  another, so any number of active kitchen rows coexist, and `findUserByPin`'s
  `WHERE pin_lookup = $1 AND is_active` can never select one.
- **The name rule.** A staff name is shown on BO-06, the POS bar and M-6, and may be printed on a
  receipt or ticket once PRD §9 question 1 is answered; ADR-012 rule 8 and C1 make every name that
  reaches paper refuse control characters, and C2 makes a form trim and the schema refuse an
  untrimmed value. The length guard is a recommendation for E2 to settle (64 fits a full name with
  room). The builder verifies that `[[:cntrl:]]` matches C1 controls such as U+009B under the
  database's encoding, and spells the ranges out if it does not, exactly as C1 asks for its own
  columns. **The migration scans existing rows** and fails if one violates a new check; the
  Phase 0 script trims names and nothing can type a control character into a terminal by
  accident, so I expect none, but the Handoff must tell the lead to migrate the development
  database and to report a failure rather than edit a row by hand.
- **The grants.** The new commands write exactly `role`, `pin_hash`, `pin_lookup`, `is_active` and
  `credential_version`. Nothing writes `id`, `created_at` or `name` (FR-B3 has no rename; OQ2). A
  column grant makes "the application cannot rename a person or move their creation time" a
  property of the database, as `0007` did for the username. `SELECT` and `INSERT` stay table-wide;
  `DELETE` stays absent. `0002`'s comment on `credential_version` ("Incremented on deactivation and
  on PIN reset") is left alone, because an applied migration is never edited; the new migration's
  header states the full rule.

**Alternatives.**

- *`'KITCHEN'` as a third value of `role`.* Fewest statements. It loses because every reader of
  `role` today (the session predicate, `findUserByPin`, the password verification, the guard)
  treats the column as an authentication role, and `KITCHEN` would then be a role value that each
  must remember to exclude; `0002`'s own comment says it is "never an authenticating role". A null
  fails closed in every one of them without a change: `null === 'MANAGER'` is false.
- *A new `classification` column beside a nullable `role`.* Two columns that must agree, and a
  check to make them agree, for no information the null does not already carry.
- *Keeping the PIN of a person moved to kitchen*, so that moving back restores it. Q9 says the PIN
  is removed from use; a kept hash would also keep a second credential in reach of every reader of
  the row. Rejected; moving back sets a new PIN (Q9).

**What the database still cannot say**, and the application does: "a MANAGER has a
`back_office_credential` row" (ADR-009 §1: a table cannot express it without a trigger). Every
command that makes a manager creates or keeps one (section 2), and verification refuses anyone who
is not an active manager.

**Defence in depth, recommended for S8a: the session predicate requires a role.** `VALID` in
`session.ts` gains `AND u.role IS NOT NULL`. Every command that makes a row kitchen also increments
the version, so this is never the line that ends a session; it is what makes "a kitchen row can
never resolve a session" true even if a later command forgets the increment, and it makes the
resolution's `role: StaffRole` honest at the type level. `verifyPasswordThrottled`'s `LockedRow`
types `role` as `StaffRole | null` for the same reason (a former manager moved to kitchen keeps a
credential row; the existing `row.role === 'MANAGER'` already refuses it).

## 2. Role changes

**Decided:** Q9 (the moves and what each sets or removes); Q1(c) (a role change increments the
credential version); Q8 (no manager removes their own manager role); ADR-009 §1 (a correct password
verifies only for an active manager), §2 and §3 (a username is set once, never changed, never
reused); FR-B3 (set a manager's username and password; a username once set never changes).

**Recommended: one command, `POST /api/back-office/config/users/change-role`, whose body is a
discriminated union on `change`:**

| `change` | Body (besides `staffUserId`, `change`) | Writes, besides `role` and the version |
|---|---|---|
| `KITCHEN_TO_CASHIER` | `pin` | `pin_hash`, `pin_lookup` |
| `KITCHEN_TO_MANAGER` | `pin`, `password`, `username`? | the PIN; the credential row (insert, or the hash of an existing one) |
| `CASHIER_TO_MANAGER` | `password`, `username`? | the credential row (insert, or the hash of an existing one) |
| `MANAGER_TO_CASHIER` | none | nothing else; the credential row stays and never verifies |
| `CASHIER_TO_KITCHEN` | none | `pin_hash` and `pin_lookup` set null |
| `MANAGER_TO_KITCHEN` | none | the PIN set null; the credential row stays and never verifies |

- **Each variant is a strict object with exactly its fields**, so "a PIN is set in the same
  command" (Q9) is a schema property: `KITCHEN_TO_CASHIER` without a `pin` is
  `VALIDATION_FAILED`, before anything is read. The client builds the variant from the move the
  manager chose, and C2's field-list helper runs on the variant's own schema (a union has no
  `.shape`), so contracts export each variant as well as the union.
- **The "from" half is a precondition, checked under the lock.** If the locked row's current
  classification is not the move's origin, or the user is inactive, the command is refused
  `USER_CHANGED` (409, no details) with nothing written: the manager's screen was built on a state
  that no longer holds (another manager acted in between). The client rereads the list.
- **`username` is required exactly when the person has no credential row**, and must be absent
  when they have one (a former manager, demoted earlier). The client knows which from the list's
  `username` field; a mismatch can only come from a concurrent promotion and demotion, and is
  `USER_CHANGED`. A username is never changed (ADR-009 §2).
- **Promotion to manager always sets a new password**, whether or not a credential row exists. A
  former manager's old password would otherwise start verifying again the moment the role came
  back, set by whoever set it last and possibly reset since by nobody. Setting it is the
  "set a manager's … password" of FR-B3. As ADR-009 §4 and PHASE0-007b require, the write touches
  `password_hash` only: a running cooldown on that account keeps running.
- **Demotion leaves the credential row** (the application deletes none, `0007`), and it never
  verifies, because ADR-009 §1 requires an active manager. This is Q9's "a former manager's
  credential row stays and never verifies", and needs no code beyond what exists.
- **Every move increments `credential_version`** (Q1c), so every session of the person ends on its
  next authenticated request: a demoted manager is answered `UNAUTHENTICATED` and sees BO-01
  *Session ended*, never a run of `FORBIDDEN`; a promoted cashier starts fresh at both surfaces.
  The guard's role check stays the control (ARCH-012 §8); the version is a second one.
- **Any change of role aimed at oneself is `OWN_ACCOUNT`** (section 5): the actor is a manager, so
  every move away from MANAGER removes their own manager role, and no move toward MANAGER can
  apply to them.

**Why one command with a `change` discriminator.**

- The required fields depend on both ends of the move (a cashier promoted keeps their PIN; a cook
  promoted needs one). Keyed by the target role alone, the schema could only make `pin` optional
  and the server would have to decide from the row whether its absence is an error, which is a
  state-dependent validation the client cannot place on a field. Keyed by the move, each variant
  is exact and the only state check is the origin, which has one refusal.
- It gives the audit one action per command, named by the move (section 7).
- One route instead of six keeps the route table and the API module readable; six routes would
  each repeat the same lock, precondition and answer.

**Alternatives.** *A target role and optional credential fields, with the server inferring the
origin*: the ambiguity above, and a stale screen silently applying a different move than the one
the manager saw. *Separate routes per move*: correct and wordier. *An expected version per user row
in the view*: works, and exposes the credential version, which no client needs; the origin is the
part of the state the manager actually judged. *Promotion keeping a former manager's old password*:
rejected above.

## 3. The credential-version increments, the re-stamp, and ADR-009 §5

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

## 4. Verifying the current password

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

## 5. Self-deactivation and self-demotion, and the acting manager under the lock

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

## 6. Reactivation, a taken PIN, and the PIN-in-use refusal

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

## 7. The audit entries

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

## 8. The new request fields, the redaction backstop, the log scan and the routes

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

## 9. The split

The plan's split holds, with one correction: **S8a already carries credentials** (create needs a
PIN, and a password and username for a manager; promotion needs them; reactivation may take a PIN),
so S8a is `identity`, writes the hashing and uniqueness paths, and owns its log-scan cases. S8b is
then the credential-only commands and the re-stamp. If the lead wants S8a smaller, the clean line is
S8a1 (migration, list, deactivate, reactivate, kitchen create, the lock protocol, the audit writer
and the codes) and S8a2 (create of a cashier or manager, change-role); I do not think it is needed.
The items to copy are under *For the lead*.

## 10. What design slice E2 (BO-06) must draw

The architecture fixes these; the copy and layout are E2's (ADR-011 rule 24).

1. **Kitchen without a PIN.** Creating kitchen staff asks only for a name; a kitchen row has no PIN
   action and no back-office login; `classification` is shown, never "role: kitchen".
2. **Create, by classification.** Cashier: name and PIN. Manager: name, PIN, username and
   password. The username is shown in its stored, lower-case form once typed, and is never
   editable afterwards (FR-B3).
3. **Role change as a move**, with the fields each move needs (section 2): a PIN from kitchen; a
   username only when the person has none; a password for every promotion to manager, including a
   former manager's. The move to kitchen says the PIN is removed.
4. **The warning before every command that ends sessions**, at the moment of the action (BO-06
   *Must not invent*; ADR-009 *Consequences*): deactivation, every role change, a PIN reset and a
   password reset each end every session of that person, POS and back office, on their next
   action. For one's own PIN: the POS sessions end and this one continues. For one's own password:
   every other session ends and this one continues. Whether that warning is a confirmation step is
   E2's: by the ARCH-002 test none is required, because every one of these is reversible by another
   command (reactivate, change back, reset again) and none is an irreversible harm the server
   cannot prevent.
5. **The own-password form** (current password and new password) and **the own-PIN form**
   (current password and new PIN), reached from the manager's own row or the frame, never from
   another person's row; the own row offers no deactivate and no role change. A new-password
   confirmation field is E2's call (client-only, never sent).
6. **Credential fields** are native inputs, uncontrolled, read once on submit and emptied after
   every response (ADR-011 rule 25 applied to the PIN as to the password); no reveal, no echo, no
   "view PIN" (BO-06 *Must not invent*); `autocomplete="new-password"` on new secrets and
   `current-password` on the current one, so a browser does not offer to save a cashier's PIN as a
   site password.
7. **The refusals:** `DUPLICATE` placed on the PIN or the username field from `details.field`, the
   PIN refusal naming no one; `OWN_ACCOUNT` (reachable only by a stale or crafted request if the own
   row offers no such action, but it needs a state); `USER_CHANGED` (the list is reread and the
   manager told the person changed meanwhile); `NOT_FOUND`; `INVALID_CREDENTIALS` and `THROTTLED`
   on the current-password field, with the cooldown's seconds; the reactivation refusal that asks
   for a new PIN and resends with it.
8. **Unknown outcomes** (C2's table): the draft kept, the list reread, nothing resent. For the own
   password the reread cannot tell whether the change applied; the copy must say so, because a
   manual resend with the old current password is refused (and counted) if the first one applied.
   For a reset, the copy must not claim the other person's sessions ended.
9. **States from the inventory still owed:** loading, error, overflow, the deactivation result and
   its cross-client outcome (SITEMAP walk 4), reactivation, and the inactive list (DESIGN-011
   BO-06). Rename is not drawn (OQ2).

## For the owner

**OQ1. Is creating a cashier or a manager from the users screen audited?** (blocks only S8a's
audit list.) FR-J3 now audits "a back-office change to a user's status, role or credentials", and
Q11 listed deactivation, reactivation, PIN set or reset, password set or reset and role change.
Creating a cashier sets a PIN, and creating a manager sets a PIN, a username and a password and
grants back-office authority. **Proposed: yes, one entry per create (`user.create.cashier`,
`user.create.manager`), and none for creating kitchen staff**, for Q11's own reason: "a manager who
sets or resets a PIN knows it; an entry naming that manager and the person is the only record that
the knowledge exists", which is as true of the first PIN as of a reset. The first-manager script
still writes none (no authenticated actor, ADR-009 §7). The alternative is to read "change" as
excluding creation, in which case the creating manager's knowledge of the first PIN, and the grant
of manager authority, leave no record.

**OQ2. May a user's display name be corrected?** (blocks nothing.) FR-B3 does not list it, and the
sitemap's "User create / edit" reads as role assignment. **Proposed: no, not in Phase 1.** An entry
names the user by id, and a viewer shows the current name, so a rename rewrites how every past audit
entry and session reads; a mistyped name is fixed by deactivating and re-creating (a manager then
needs a new username, because usernames are never reused). If the owner wants it, it needs a column
grant on `name` by a forward migration, and should be audited like a role change.

Four readings the lead may confirm with the owner, which I do not think need it: there is no
standalone "set username and password" command (section 8); promotion to manager always sets a new
password (section 2); reactivation accepts a new PIN even when the old one is free (section 6); a
PIN or password reset to the same value still ends the sessions (section 3).

## Stale text found

None of the four contract documents contradicts this consult. Seven texts are owed, none by S8's
builders.

1. **ARCHITECTURE §7.2, the last two bullets** (mine; for a small architect task or the next
   ARCHITECTURE amendment, owner-accepted). Replace "A StaffUser has one credential version.
   Deactivation, a PIN reset, or a back-office password set or reset increments it and causes every
   session of that user, POS and back office, to fail on its next authenticated request." and "A
   manager who changes their own password keeps the back-office session the change was made from:
   the command re-stamps that one session with the new version in the same transaction. Their other
   sessions fail as above." with:
   > - A StaffUser has one credential version. Deactivation, a change of role or classification,
   >   and storing or removing a PIN or a back-office password each increment it, in the same
   >   transaction as the change, and every session of that user, POS and back office, then fails on
   >   its next authenticated request. Reactivation alone does not increment it: the deactivation's
   >   increment has already ended every earlier session.
   > - A manager who changes their own password or their own PIN from the back office gives their
   >   current password, verified against their own account's throttle, and keeps the back-office
   >   session the change was made from: the command re-stamps that one session with the new version
   >   in the same transaction, and commits nothing if it cannot. Their other sessions fail as
   >   above. These two commands are the only user-management commands that write a session row
   >   (owner, 2026-10-20, answering ADR-009's open items).
2. **ARCHITECTURE §3.2 and §16, the PIN-in-use oracle** (Q7, accepted; the plan asked for it on the
   gate list). In §3.2, replace "back-office username discovery, per-account lockout, and the
   unaudited first-manager script;" with "back-office username discovery, per-account lockout, the
   unaudited first-manager script, and the users screen's refusal of a PIN another active user
   holds;". In §16, add the row: "| The users screen refuses a PIN another active user holds | A
   manager learns that some active colleague holds a six-digit PIN they typed, and can try it at the
   POS to learn whose it is | The refusal names no one; managers already know every PIN they set;
   reconsider at the gate in section 3.2 | Accepted for the MVP |".
3. **ARCHITECTURE §8, the lock order.** After the DiningTable sentence, add: "User-management
   commands take no coordination row. They lock the StaffUser rows of the acting manager and of the
   user acted on, in id order, `FOR NO KEY UPDATE`, then that user's BackOfficeCredential row, then,
   for an own-credential change, the acting ActorSession; the acting manager's row is re-read under
   the lock, so two managers deactivating or demoting each other at once cannot both succeed."
4. **ARCHITECTURE §11, the audited actions.** Replace "The audited actions are whole-order void,
   fired-line void, discount apply/replace/remove, refund, manager CheckoutLease takeover, and every
   manager approval outcome." with "The audited actions are whole-order void, fired-line void,
   discount apply/replace/remove, refund, manager CheckoutLease takeover, back-office reprint of a
   kitchen ticket, every back-office change to a user's status, role or credentials (one entry per
   command, naming the acting manager and the user, never a PIN, password or hash), and every
   manager approval outcome." (The reprint was already missing; plan G8 noted the I-8 ruling.)
5. **SCREEN-INVENTORY BO-06 and SITEMAP BO-06** (the designer's, through E2). The inventory's
   purpose should read "Manage staff: create, assign a role or the kitchen classification, change
   it, set and reset PINs, set a manager's username and password and reset the password, change
   one's own password and PIN, deactivate and reactivate."; its states gain *PIN or username in use
   — refused*, *own account — deactivation and role change refused*, *user changed meanwhile —
   reread*, *current password wrong or throttled*, *reactivation needs a new PIN*, and the warning of
   section 10 item 4; "PINs are six digits and unique across users" should read "unique among active
   users" (FR-A4). The sitemap gains the role-change, password, own-password and own-PIN modals and
   a reactivate action.
6. **The Phase 1 plan's S8 goal and *Definition of Done* AC-32 line** say the own exception is for
   the password; Q1(b) added the PIN. The plan says later consults win, so this is recorded, not
   edited.
7. **ADR-011's recorded reading on a demoted manager at M-6**, and ADR-009's *Consequences* bullet
   on role changes, describe cases S8a ends (section 3). Accepted ADRs are not edited; §7.2's new
   wording carries the current rule.

**Offered, not required: PRD AC-18.** AC-18 lists the entries the audit log contains and does not
mention user changes (nor the kitchen-ticket reprint). If the owner wants the acceptance criterion
to match FR-J3, after "and entries for whole-order void, fired-line void, discount
apply/replace/remove, and refund" add ", and one entry per back-office change to a user's status,
role or credentials, naming the acting manager and the user". S8's tests prove FR-J3 either way.

## For the lead

Each item below is written to be copied into a task file. Migration numbers are "the next free
number when the task is written": S1a takes `0010`, and ADR-012's slices may take the following
ones first.

### S8a — server: staff records, roles, status, and the audit

- **Touches:** `identity` (credentials in request bodies, the credential version, the session
  predicate, the credential row on promotion), `audit` (the first production audit writer for
  users), `boundaries` (B-11, B-12: a PIN and a password travel in back-office bodies for the first
  time; B-13; FR-A4; FR-A2c route declarations; B-20). The browser suite runs before merge (a
  migration, the contracts, the HTTP layer, the session domain).
- **Depends on:** S1a merged (the C2 pattern, `DUPLICATE`, the route-table guard); this consult;
  OQ1 answered (only the two create actions depend on it; the builder can build with them behind
  the answer). Not on E2.
- **Owns** (globs): `db/migrations/<next>_staff_user_kitchen.sql`;
  `apps/server/src/domain/staff.ts`, `pin.ts`, `session.ts` (the predicate only),
  `back-office-credential.ts` (types only), a new `apps/server/src/domain/users.ts` (or the name the
  builder chooses; one module for the commands, the lock protocol and the action list);
  `apps/server/src/http/routes/back-office-users.ts` and its registration in `server.ts`;
  `apps/server/src/http/log.ts` (`SECRET_KEYS`); `packages/contracts/src/users.ts`, `routes.ts`,
  `errors.ts`, `index.ts`; `packages/api-client/src/specs.ts` and `client.ts` (`ROUTES` names
  only); `apps/back-office/src/session/api.ts` (the five functions, declared, called by no screen);
  the `OWN_ACCOUNT` and `USER_CHANGED` cases in both clients' `realSession.ts` switches (the general
  failure group); `apps/server/test/**`, `packages/contracts/test/**`, `packages/api-client/test/**`;
  `e2e/support/people.ts` only if `createStaffUser`'s signature changes.
- **Scope.**
  1. The migration of section 1: the three columns nullable, the shape check, the name check, the
     revoke and the column grant. No row inserted or edited.
  2. Contracts: `StaffClassification`, `StaffName`, `NewPin`, `NewUsername`, `NewPassword` (section
     8); `UserView`; `CreateUserRequest` (the union and its three exported variants),
     `ChangeRoleRequest` (the union and its six variants), `DeactivateUserRequest`,
     `ReactivateUserRequest`; `UserResponse`, `UsersResponse`; the five route-table entries;
     `OWN_ACCOUNT`, `USER_CHANGED`; `DUPLICATE`'s optional details; the envelope schema and its
     completeness check.
  3. Domain: list; create (kitchen, cashier, manager), composing `createStaffUser` and
     `createBackOfficeCredential` on one client so the first-manager script and the screen still
     share them (ADR-009 §7), with the PIN refusal made distinguishable without changing what the
     script prints; change-role (six moves); deactivate; reactivate. Every command: the schema, then
     `OWN_ACCOUNT` where it applies, then hashing outside the transaction, then one transaction that
     opens with the two-row lock of section 5 and the actor re-check, then `NOT_FOUND`, the
     precondition (`USER_CHANGED`), the no-op rule, the writes (a unique violation by constraint
     name is `DUPLICATE` with its field; any other is a fault; no database error is copied or
     logged by message), the increment, the audit entry, commit, the view.
  4. Session: `AND u.role IS NOT NULL` in `VALID`; `LockedRow.role` typed `StaffRole | null`.
  5. Routes: the five, declared as section 8 says, parsing with `parseBody` unchanged.
  6. `SECRET_KEYS` gains `username` and `currentPassword`; the contracts key-name test.
  7. The compile-forced client lines: `SPECS`, `ROUTES`, the five back-office API functions, the two
     codes in both switches. No screen.
- **Acceptance criteria, each with its red proof** (the builder reverts each and says so):
  1. The route table equals the registered routes and each route's `interactive` its declaration
     (`route-table.test.ts`, unedited). *Red:* drop one entry from `ROUTE_TABLE`.
  2. Each new route refuses no cookie and a POS token (401 `UNAUTHENTICATED`), a non-manager (403
     `FORBIDDEN`), and on the four `POST`s a missing or wrong anti-CSRF header (403 `CSRF_REFUSED`),
     with nothing written: one loop over the new entries. *Red:* declare one command `OPTIONAL`.
  3. Schema: a kitchen row (role, PIN hash and lookup all null) is accepted; each of "a role and no
     PIN", "a PIN and no role" and "a hash without a lookup" is refused by
     `staff_user_credential_shape_check`; an untrimmed, over-long or control-character name is
     refused by `staff_user_name_text_check` (U+0007 and U+009B both); case 16 still refuses
     `'KITCHEN'`. `pos_app` has `SELECT, INSERT` and `UPDATE (role, pin_hash, pin_lookup, is_active,
     credential_version)` on `staff_user` and nothing else; an `UPDATE` of `name`, `id` or
     `created_at` and a `DELETE` are refused (the privilege map, `schema.test.ts`). *Red:* grant
     `UPDATE (name)`.
  4. Create: each classification answers the view; a cashier's and a manager's PIN verify at
     `findUserByPin` and a manager's password at `verifyPasswordThrottled`; a PIN an active user
     holds is `DUPLICATE` `{ field: 'pin' }`, a username any row holds (an inactive one included) is
     `DUPLICATE` `{ field: 'username' }`, each with no row written in either table. *Red:* catch the
     username violation as `'pin'`.
  5. Change role, per move: the row's classification, PIN and credential row after each move are as
     section 2's table says; a move whose origin differs from the row, or on an inactive user, is
     `USER_CHANGED` with nothing written; promotion of a former manager keeps the username and
     replaces the hash, and leaves `consecutive_failures` and `blocked_until` as they were; a
     `username` sent for a person who has one, or missing for one who has none, is `USER_CHANGED`.
     *Red:* skip the origin check: the stale-move case writes.
  6. The version: deactivation and every move increment it by one; reactivation keeping the PIN does
     not; a no-op writes nothing (`xmin` unchanged). After each incrementing command, every POS and
     back-office session of the person resolves `NONE`; **after a deactivation and a reactivation,
     the person's old sessions still resolve `NONE`** (AC-32, server half). *Red:* drop the
     increment from deactivation: the reactivated person's old session resolves again.
  7. Reactivation: keeping a free PIN reactivates; a PIN an active user now holds is `DUPLICATE`
     `{ field: 'pin' }` with nothing written; the same command with a new PIN reactivates and the
     new PIN verifies; a `pin` for a kitchen row is `USER_CHANGED`. *Red:* treat every unique
     violation as a fault: the taken-PIN case answers 500 instead of `DUPLICATE`.
  8. Own account: `deactivate` and every `change-role` move on the actor's own id are `OWN_ACCOUNT`
     with nothing written, and answer while another connection holds a lock on the actor's row (the
     check precedes the transaction). *Red:* drop the check: the self-deactivation commits.
  9. Two managers deactivating (and, separately, demoting) each other at once, released together
     from a third connection's lock on both rows, end with exactly one success, one
     `UNAUTHENTICATED`, and one active manager. *Red:* lock only the subject's row: both succeed.
  10. Audit: each successful command writes exactly one entry with its action, the actor and the
      subject; a no-op and every refusal write none; the marker scan of section 7 finds no PIN,
      password, username, lookup or `$argon2id$` in any row; a failing audit write leaves
      `staff_user` and `back_office_credential` unchanged. *Red:* put the PIN in `reason`.
  11. Session predicate: a cashier's session whose row is made kitchen by the owner role without an
      increment resolves `NONE`. *Red:* remove `u.role IS NOT NULL`.
  12. The list answers every user, active and inactive, in creation order, and no response body of
      any new route contains a marker credential, a lookup or `$argon2id$`.
  13. Log scan (section 8) for the five routes and their fields; case 24 extended; the contracts
      key-name test. *Red:* rename a field `oldPassword` in a schema only: the key-name test fails.
  14. `error-details.types.ts`: `OWN_ACCOUNT` and `USER_CHANGED` take no details; `DUPLICATE` takes
      only `{ field }` of the two literals.
  15. `npm run verify` green; `npm run test:e2e:all` green (no browser test changes).
- **Tests expected to change:** `schema.test.ts` (the `staff_user` privilege map; new cases),
  `session.test.ts` (the predicate case), `back-office-credential.test.ts` and `pin.test.ts` only as
  far as the types and the create path change, `log-scan.test.ts`, `error-details.types.ts`, and the
  contracts' envelope tests for `DUPLICATE`'s details. `harness-race.test.ts` needs nothing (no new
  table). A change elsewhere is reported in the Handoff with its reason.
- **The Handoff must carry forward:** the route and schema names; the action list; that the lock
  helper and the actor re-check are what S8b's commands open with; the codes and where each is
  emitted; the migration's effect on the development database.

### S8b — server: credential resets, own password and own PIN, the re-stamp

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

### S8c — client: BO-06, and AC-32 in the browser

- **Touches:** `identity` (credential forms in the back office, sessions ended across profiles),
  `boundaries` (B-11, B-12 in the client: rule 25; AC-32). Browser suite before merge.
- **Depends on:** S8b merged; E2 reviewed (section 10); S1b merged (the manifest, the rail, the
  store's `config` member, the field-list helper, the result table, the departure decision, the
  dialog rule at BO-01).
- **Owns:** `apps/back-office/src/**`, `apps/back-office/test/**`, `e2e/tests/users.spec.ts`,
  `e2e/support/scan.ts` (the credential-route map), additions to `e2e/support/**`.
- **Scope.**
  1. BO-06 in the rail and the manifest; the list (active and inactive, kitchen without PIN
     actions, the own row without deactivate or role change).
  2. Create, change role, deactivate, reactivate (with the new-PIN path), PIN reset, password reset,
     own password, own PIN, each from E2, through C2's form pattern and result table, with the
     users rows added: `DUPLICATE` placed by `details.field`; `OWN_ACCOUNT` and `USER_CHANGED` keep
     the draft and reread; `INVALID_CREDENTIALS` and `THROTTLED` on the current-password field.
  3. Credential inputs per rule 25 and section 10 item 6.
  4. The browser spec, two profiles, Chromium and WebKit.
- **Acceptance criteria, each with its red proof:**
  1. Client tests: every credential input is uncontrolled, has no `value` attribute, is emptied
     after every response (success included), and its value appears in exactly one request body and
     nowhere in the DOM, storage or console. *Red:* hold the PIN in React state: the attribute or
     DOM assertion fails.
  2. Client tests: `DUPLICATE` with `field: 'pin'` marks the PIN field and not the username; a
     reactivation refused that way asks for a new PIN and its resend carries it; `USER_CHANGED`
     rereads once and sends nothing else; an own-password unknown outcome rereads, resends nothing
     and empties the password fields.
  3. **Browser D1 (AC-32's POS half):** profile 1, manager A at BO-06; profile 2, cashier C signed
     in at the POS. A deactivates C. C's next request is answered `UNAUTHENTICATED` and the POS
     shows POS-01 *session invalidated* (by the state attribute and accessible name the Handoffs
     list). *Red:* the deactivation command made a no-op: C stays signed in.
  4. **Browser D2:** profile 1, A; profile 2, manager B signed in to the back office. A resets B's
     password after the warning. B's next request reaches BO-01 *Session ended* with the working
     area held; B signs in with the new password and is signed in. *Red:* drop the increment from
     the password reset: B stays signed in.
  5. **Browser D3:** A, in profile 1, changes their own password; profile 1 stays `signed-in` and its
     next command succeeds; A's back-office session in profile 2 reaches BO-01 *Session ended*.
     *Red:* skip the re-stamp: profile 1 ends.
  6. The credential scan, extended: `scan.ts`'s map lets a PIN appear in the bodies of
     `users/create`, `users/change-role`, `users/reactivate`, `users/set-pin`, `users/own-pin` and
     the POS sign-in; a password in `users/create`, `users/change-role`, `users/set-password`,
     `users/own-password` and the two back-office password routes; a username in `users/create`,
     `users/change-role` and the back-office sign-in; and nowhere else. *Red:* log a PIN from a
     users handler under a key the backstop does not list.
  7. `npm run verify` green; `npm run test:e2e:all` green, the new spec included.
- **Tests expected to change:** the back office's rail and manifest tests (a second destination);
  nothing in the existing e2e specs.
- **The Handoff must carry forward:** the accessible names the spec drives; what a later credential
  form copies.

### For the lead, beyond the three task files

1. **The ADR-009 §5 question** (section 3): my judgement is that no superseding ADR is needed, and
   ARCHITECTURE §7.2's wording (*Stale text* 1) records the rule. If you judge otherwise, the
   one-point ADR-013 text is in section 3, for an architect task, Proposed, for the owner.
2. **OQ1** goes to the owner before S8a's task file is final; **OQ2** whenever convenient, before
   E2's brief.
3. **The four ARCHITECTURE amendments** (*Stale text* 1 to 4) fit one small architect task; 2 is the
   §3.2 entry the plan asked C3 to present. None blocks S8.
4. **E2's brief** takes section 10 and *Stale text* 5.
5. **AC-18's sentence** is offered to the owner only if you think the acceptance criterion should
   list what FR-J3 now audits.
