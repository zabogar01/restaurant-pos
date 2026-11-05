---
id: PHASE1-S8a
title: Users on the server — staff records, kitchen, roles, deactivate and reactivate, and their audit (plan S8, consult C3)
category: feature
touches: [identity, audit, boundaries]
depends_on: []
owns: [db/migrations/0015_staff_user_kitchen.sql, apps/server/src/domain/users.ts, apps/server/src/domain/staff.ts, apps/server/src/domain/pin.ts, apps/server/src/domain/session.ts, apps/server/src/domain/back-office-credential.ts, apps/server/src/domain/audit.ts, apps/server/scripts/create-manager.ts, apps/server/src/http/routes/back-office-users.ts, apps/server/src/http/server.ts, apps/server/src/http/log.ts, packages/contracts/src/users.ts, packages/contracts/src/routes.ts, packages/contracts/src/errors.ts, packages/contracts/src/index.ts, packages/api-client/src/specs.ts, packages/api-client/src/client.ts, packages/api-client/src/index.ts, apps/back-office/src/session/api.ts, apps/back-office/src/session/realSession.ts, apps/back-office/src/session/fixtureSession.ts, apps/back-office/test/config-api.test.tsx, apps/pos/src/session/realSession.ts, apps/server/test/**, packages/contracts/test/**, packages/api-client/test/**, e2e/support/people.ts]
status: not-started
cycles: 0
---
# PHASE1-S8a — Users on the server: staff records, kitchen, roles, status, and the audit

**Written** 2026-11-05 by the lead. Sources:
- slice S8 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S8*);
- **consult C3** (`.agent/reviews/ARCH-020-users-and-credentials.md`): sections 1, 2, 3 (the increments), 5, 6, 7 and 8,
  and *For the lead*, *S8a*, **copied verbatim below**; read the rest of C3 for context (section 4 and the re-stamp are
  S8b's);
- **the owner's rulings** (DECISIONS 2026-10-20 and 2026-10-21): plan Q1 (ADR-009's open items), Q6(a), Q7, Q8, Q9,
  Q11; C3's OQ1 and OQ2; ADR-009's open items recorded in ARCHITECTURE §7.2 (no ADR-013);
- **ARCHITECTURE** §5.1, §7.2, §8 (the users lock order), §11 (the audited actions), §3.2 and §16 (the PIN-in-use
  oracle), all already carrying C3's wording; **ADR-007, ADR-009, ADR-010, ADR-011**; consult **C2**
  (`.agent/reviews/ARCH-019-first-back-office-form.md`) and the pattern S1a built on it (`dining-table.ts`,
  `back-office-tables.ts`);
- PRD FR-A1, FR-A2c, FR-A4, FR-B3, FR-J3, AC-18, AC-32 (its first sentence, server half); B-11, B-12, B-13, B-20.

Where this file and C3 differ, this file wins. Where this file and an accepted ADR or the contract differ, or the code
cannot do what this file says, stop and write `BLOCKED: <question>`.

## Objective

The server holds every person the restaurant employs as a `staff_user` row: a cashier or a manager with a PIN (and a
manager with a back-office login), or kitchen staff with no role and no PIN. A manager can list them, create each
classification, move a person between classifications, deactivate and reactivate. Every command locks and re-reads
the acting manager, refuses one aimed at oneself, ends the person's sessions where C3 says so, and writes exactly one
audit entry when it changes something. No screen is built (S8c builds BO-06); the client lines are the ones the
compiler forces. The credential-only commands (set a PIN, set a password, own password, own PIN, the re-stamp) are
S8b's.

## Decided: do not reopen

- **Owner, plan Q1** (2026-10-20): (a) an own password change requires the current password; (b) an own PIN change keeps
  the back-office session; (c) **a role change increments the credential version**, so every session of the person ends.
  Recorded in ARCHITECTURE §7.2.
- **Q6(a):** reactivation keeps the PIN unless another active user holds it, in which case a new PIN is set (FR-B3).
- **Q7:** the manager types another user's PIN; the PIN-in-use oracle is accepted for the MVP (ARCHITECTURE §3.2, §16).
- **Q8:** the server refuses a manager deactivating their own account or removing their own manager role; another
  manager may be deactivated or demoted; there is no "last active manager" count.
- **Q9:** a person moves between kitchen and the two roles; moving to a role sets a PIN in the same command (and a
  username and password for a manager); moving to kitchen removes the PIN and ends every session; a former manager's
  credential row stays and never verifies.
- **Q11 and FR-J3:** a back-office change to a user's status, role or credentials is audited, naming the acting manager
  and the user and never a PIN or password; nothing else in Phase 1.
- **C3 OQ1 (2026-10-21): creating a cashier or a manager is audited** (`user.create.cashier`, `user.create.manager`);
  creating kitchen staff is not; the first-manager script still writes none (ADR-009 §7).
- **C3 OQ2 (2026-10-21): a display name cannot be corrected in Phase 1;** `name` gets no `UPDATE` grant.

## The lead's rulings for this slice

These fill what C3 left open or what changed since it was written (2026-10-20, at `0009`); the owner may overturn them.

1. **The migration is `0015_staff_user_kitchen.sql`** (`0014` is the last applied). The name check uses `[[:cntrl:]]`
   exactly as `0013_catalog.sql` does; that migration's comment already records that it matches the C0 and C1 controls
   under the database's encoding, so no spelled-out ranges are needed. Still prove U+0007 and U+009B in the schema test.
   Confirm the column-grant syntax against the PostgreSQL 16 manual, as C3 asks.
2. **C3's three readings that bind S8a are accepted:** there is no standalone "set username and password" command
   (C3 §8); promotion to manager always sets a new password (§2); reactivation accepts a new PIN even when the old one is
   free (§6).
3. **The commands live in one new module, `apps/server/src/domain/users.ts`:** the commands, the lock helper with the
   actor re-check (S8b's commands open with it), and the closed action list. The routes are
   `apps/server/src/http/routes/back-office-users.ts`.
4. **`DUPLICATE`'s details are for the users routes only.** Every route that sends `DUPLICATE` today (tables, tender
   methods, the catalog, presets) keeps sending it with no details, and their exact-body assertions stay unedited.
5. **The audit rollback proof (C3 §7, AC 10).** `writeAudit` today refuses only a blank action; it holds no closed list,
   so "an action outside the closed list, refused by the writer's validation" does not exist. The closed list is the
   users module's, checked inside the command's transaction before `writeAudit`. Prove the rollback by making the audit
   insert fail without a production seam: for example, as the owner role, revoke `INSERT` on `audit_entry` from
   `pos_app` for the one test and restore it after (in a `finally`), then assert `staff_user` and
   `back_office_credential` are unchanged. **No test-only branch or flag in production code.** `audit.ts` is in `owns`
   only if a type must be exported.
6. **The create path and the first-manager script.** `apps/server/scripts/create-manager.ts` already composes
   `createStaffUser` and `createBackOfficeCredential` on one client. Keep both functions shared by the script and the
   create command (ADR-009 §7). Change the script only if a signature changes, and then **what it prints and its exit
   codes stay exactly as they are**; say so in the Handoff with the before and after.
7. **The client lines are declarations only:** `SPECS`, `ROUTES`, the five back-office API functions (called by no
   screen), and `OWN_ACCOUNT` and `USER_CHANGED` in both clients' `realSession.ts` switches in the general failure
   group. Nothing else in either client changes. **Widened by the lead during round 1 (2026-11-05):**
   `apps/back-office/src/session/fixtureSession.ts` joins `owns` for the five users routes' `unavailable` entries in
   its `CONFIG` table, which the compiler forces (the table is keyed by every config route); nothing else in it.
8. **The browser suite runs before merge** (the lead runs `npm run test:e2e:all`); no browser test is added or changed
   (S8c's). `e2e/support/people.ts` changes only if `createStaffUser`'s signature does.

## C3's decisions, copied verbatim

The text below is ARCH-020's, unedited, with its headings moved down one level. Where it says "the next free number",
read `0015`; where it says "if OQ1 is yes", read *yes*.

### 1. The `staff_user` loosening for kitchen staff

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

### 2. Role changes

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


### 3. The credential-version increments (the part S8a builds; the re-stamp is S8b's)

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


### For the lead, S8a (C3, verbatim)

Each item below is written to be copied into a task file. Migration numbers are "the next free
number when the task is written": S1a takes `0010`, and ADR-012's slices may take the following
ones first.

#### S8a — server: staff records, roles, status, and the audit

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

## Acceptance criteria

C3's fifteen criteria under *For the lead*, *S8a*, above, bind as written, each with its red proof: write each test
first, run it against the unchanged code and record the failing assertion; apply each *Red*, observe it failing for the
stated reason, revert, and report. Add these, which C3 did not have:

16. **OQ1:** creating a cashier writes one `user.create.cashier` entry and creating a manager one `user.create.manager`
    entry, each naming the acting manager and the new user; **creating kitchen staff writes none**. *Red:* skip the
    entry for a manager.
17. **Ruling 4:** every existing route that answers `DUPLICATE` still answers exactly `{ "error": { "code": "DUPLICATE" } }`
    (the tables, tender-method, catalog and preset tests that assert it pass unedited), and only the users routes carry
    `details.field`. *Red:* attach `details` in the shared envelope helper.
18. **Ruling 6:** the first-manager script prints and exits exactly as before; if its source changed, a test or the
    Handoff shows the before and after. The script writes no audit entry.
19. **Ruling 5:** the audit rollback test fails the insert through privileges or the database, never through a branch
    in production code. *Red:* write the entry after commit.
20. `npm run verify` green, with counts; `npm run test:e2e:all` green (no browser test changes; the lead also runs it).

## Tests expected to change

- C3's list: `schema.test.ts` (the `staff_user` privilege map; new cases), `session.test.ts` (the predicate case),
  `back-office-credential.test.ts` and `pin.test.ts` only as far as the types and the create path change,
  `log-scan.test.ts` (case 24 gains `currentPassword` and `username`; new cases), `error-details.types.ts`, and the
  contracts' envelope tests for `DUPLICATE`'s details.
- `route-table.test.ts` and `access.test.ts` are **not edited** (C3 AC 1 and §8): they must pass as they are.
- `schema-check.test.ts` only if it lists migrations by name.
- New test files for the users domain, the routes and the contracts key-name test.
- **Nothing else should change.** A change anywhere else is reported in the Handoff with its reason; a weakened assertion
  is not acceptable.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: a
  builder's heredoc stopped S7b2's first round for over an hour on an approval prompt.
- No PIN, password, username, hash or lookup in any log line, response body, audit column or error message; no
  database error copied or logged by its message (C3 §6, ADR-010 rules 1 and 2).
- Hash outside any transaction; never hold a lock across a hash (C3 §3, *For the lead* item 3).
- An applied migration is never edited; `0002`'s comment on `credential_version` stays, and `0015`'s header states the
  full rule (C3 §1).
- Run `npm run verify` on a quiet machine, not beside another suite or `test:e2e`: server tests share one database.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`development` at `99a734b` (S7b1 and S7b2 merged; the tree is S7b2's final one): `npm run verify` 157 files, 5696
tests; `npm run test:e2e:all` 130 passed. Run `npm run db:migrate` before the server tests. Confirm the baseline
before you start and state the new counts in the Handoff.

## Out of scope

- S8b: set another user's PIN, set another manager's password, own password, own PIN, the current-password
  verification and the session re-stamp. S8c: BO-06 and every browser test.
- Renaming a user (OQ2). Any change to the POS or back-office screens beyond ruling 7's declarations.
- The ARCHITECTURE and design texts C3 lists under *Stale text* (already applied, or the designer's).

## Commit and report

Commit on `agent/phase1-s8a` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done; what was decided and on what evidence; tests changed and why; each red
proof; what was found and not fixed; the real `verify` and `test:e2e:all` output; and what C3's *For the lead* says the
Handoff must carry forward (the route and schema names, the action list, that the lock helper and the actor re-check
are what S8b's commands open with, the codes and where each is emitted, the migration's effect on the development
database).

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead ruling on the round 1 BLOCKED, 2026-11-05

The builder's question: may the lead commit its edit to `apps/back-office/test/config-api.test.tsx`, and is the
`fixtureSession.ts` addition ratified? **Yes to both.** Each is forced by the five new config routes, because each
holds a table keyed by every config route: the fixture `CONFIG` (widened in `50d2501`) and the test's exact run-time
list. `config-api.test.tsx` joins `owns` for exactly that list and its title; nothing else in it. The lead committed the
builder's working-tree edit unchanged, as the builder wrote it, so the slice's tree is the one the builder verified,
and no builder round was spent on a commit. The Handoff's `BLOCKED` line is answered here; the round counts as done.

## Handoff

**Result.** The slice is built and `npm run verify` is green: typecheck clean, 162 files and 5779 tests passed (baseline was 157 files and 5696 tests). I did not run `npm run test:e2e:all`: it needs a browser build and run that I did not attempt, and the task has the lead run it before merge. No browser test was added or changed. I changed nothing that Prettier formats; no formatter was run.

**What was built, by path.**
- `db/migrations/0015_staff_user_kitchen.sql`: `role`, `pin_hash`, `pin_lookup` nullable; `staff_user_credential_shape_check` (a role and a PIN together, or neither); `staff_user_name_text_check` (trimmed, at most 64, no `[[:cntrl:]]`); `REVOKE UPDATE` then `GRANT UPDATE (role, pin_hash, pin_lookup, is_active, credential_version)`. The header states the full credential-version rule. The PostgreSQL 16 manual (REVOKE page) says a table-level revoke also revokes the column privileges, confirmed through ask.sh librarian and by the privilege-map test. U+0007 and U+009B are both refused by `[[:cntrl:]]` (schema test).
- `apps/server/src/domain/users.ts` (new): `listUsers`, `createUser`, `changeRole`, `deactivateUser`, `reactivateUser`, `lockUsers`, `USER_ACTIONS`.
- `apps/server/src/http/routes/back-office-users.ts` (new), registered in `server.ts`.
- `pin.ts`: added `preparePin` and `insertStaffUser` (`createStaffUser` now composes them, same messages). `back-office-credential.ts`: added `hashPassword` and `insertBackOfficeCredential` (`createBackOfficeCredential` composes them, same messages); `LockedRow.role` is `StaffRole | null`. `session.ts`: `AND u.role IS NOT NULL` in `VALID`. `log.ts`: `SECRET_KEYS` exported and gains `currentPassword` and `username`.
- Contracts: `users.ts` (new), `errors.ts`, `routes.ts`, `index.ts`. Client: `specs.ts`, `client.ts`, both `realSession.ts` switches, back-office `api.ts`.

**Names to carry forward (S8b, S8c).**
- Routes: `GET /api/back-office/config/users`; `POST .../users/create`, `/change-role`, `/deactivate`, `/reactivate`. `ROUTES`: `usersList`, `usersCreate`, `usersChangeRole`, `usersDeactivate`, `usersReactivate`.
- Schemas: `StaffClassification`, `StaffName`, `NewPin` (= `ManagerPin`), `NewUsername`, `NewPassword`, `UserView`, `UserResponse`, `UsersResponse`, `CreateUserRequest` with `CreateKitchenUserRequest`, `CreateCashierUserRequest`, `CreateManagerUserRequest`, `ChangeRoleRequest` with `KitchenToCashierRequest`, `KitchenToManagerRequest`, `CashierToManagerRequest`, `ManagerToCashierRequest`, `CashierToKitchenRequest`, `ManagerToKitchenRequest`, `DeactivateUserRequest`, `ReactivateUserRequest`. `CurrentPassword` is not defined (no S8a schema uses it); S8b adds it.
- Action list (`USER_ACTIONS`): `user.create.cashier`, `user.create.manager`, `user.deactivate`, `user.reactivate`, `user.reactivate.new_pin`, and `user.role.kitchen_to_cashier|kitchen_to_manager|cashier_to_manager|manager_to_cashier|cashier_to_kitchen|manager_to_kitchen`. S8b adds `user.pin.reset`, `user.password.reset`, `user.own_pin.change`, `user.own_password.change`; the closed-list check is `audit()` in `users.ts`, before `writeAudit`.
- **S8b's commands open with `lockUsers(client, actor, subjectId)`** inside `command(...)`: it locks the actor's and subject's `staff_user` rows together (id order, `FOR NO KEY UPDATE`), then re-reads the actor (active, MANAGER, credential version equal to the session row's, session unreleased) and returns `UNAUTHENTICATED` otherwise. Pass `subjectId` lower-case. The own-account check (`OWN_ACCOUNT`) goes before `command(...)`, before any hashing. `Refusal` thrown inside the callback rolls back and answers; a 23505 on `staff_user_active_pin_lookup_key` or `back_office_credential_username_key` becomes `DUPLICATE` with its field.
- Codes: `OWN_ACCOUNT` 409 (deactivate and change-role aimed at the actor's own id; S8b adds set-pin and set-password), `USER_CHANGED` 409 (stale origin or inactive subject; a username sent for someone who has one or missing for someone who has none; a `pin` for a kitchen row on reactivate), `DUPLICATE` 409 with `details.field` `pin` or `username` on the users routes only, `UNAUTHENTICATED` 401 from the actor re-check, `NOT_FOUND`, `VALIDATION_FAILED`.

**Decisions and evidence.**
1. *Hashing outside the lock, and the shared create path.* Ruling 6 says keep `createStaffUser` and `createBackOfficeCredential` shared; C3 says hash outside any transaction. `createStaffUser` hashes inside the call, so calling it under the actor lock would hold a lock across Argon2id. I split each into a prepare/hash step and one shared INSERT function (`insertStaffUser`, `insertBackOfficeCredential`); the script still calls the two original functions, which compose the same pieces. `apps/server/scripts/create-manager.ts` is untouched: its output and exit codes are exactly as before, and the existing back-office-credential cases 29 to 35 still pass.
2. *A refusal after a write.* The username collision comes after the staff row is inserted in the same transaction, so it is raised as a thrown `Refusal` to roll back both rows; the PIN `ON CONFLICT DO NOTHING` path returns before any write.
3. *Response scan.* A `UserView` carries `username` by design, so the response-body scans exclude username markers and instead check refusals never contain one; PINs, passwords, lookups and `$argon2id$` are scanned everywhere. The log scan reads each line without its `time`, because a six-digit PIN marker can spell part of a timestamp.
4. *Uppercase ids.* `z.uuid()` accepts upper case and PostgreSQL prints lower case, so the domain lower-cases the subject id before the own-account comparison and the lock (tested).
5. *Key-name test location.* It is `apps/server/test/credential-keys.test.ts`, because it must import `SECRET_KEYS` from the server and the contracts package cannot. It walks every `*Request` export at any depth and fails on a credential-shaped key that is nested or not in the list. The task's red names `currentPassword`, which has no S8a schema; I used `password` renamed to `oldPassword` in the create-manager schema instead.
6. *Audit rollback proof (ruling 5).* `REVOKE INSERT (action) ON audit_entry FROM pos_app`, restored in a `finally`; no production branch or flag.

**Files outside `owns`, changed because the compiler or an existing test forced it. Please ratify or tell me to revert.**
- `apps/back-office/src/session/fixtureSession.ts`: five `unavailable` entries for the new config routes (`ConfigApi` now has five more required members; typecheck failed without them).
- `apps/back-office/test/config-api.test.tsx`: its run-time list of config routes must gain the five users routes (and its title say so), or it fails. **The pre-commit hook refused this file (not in the builder's owns), so the edit is in the working tree and NOT in commit `5c41a6a`.** Commit `5c41a6a` therefore has exactly one failing test, this one; with the working-tree edit, `npm run verify` is green (162 files, 5779 tests). The edit adds, after the tender-methods entries and in sorted order: `/api/back-office/config/users`, `.../users/change-role`, `.../users/create`, `.../users/deactivate`, `.../users/reactivate`, and changes the title to "...the five preset routes and the five users routes at run time...".
- Within a listed file, `apps/server/test/back-office-credential.test.ts` case 28 (exact export list) gains `hashPassword` and `insertBackOfficeCredential`. Nothing was loosened; each list only grew by the new items.

**Existing tests changed, and why.** `schema.test.ts` (privilege map for `staff_user`; four new cases), `session.test.ts` (new case 11), `log-scan.test.ts` (case 24 gains `currentPassword` and `username`; `resetDatabase` added to its `beforeAll` so a re-run does not meet its own PINs; new users scan), `error-details.types.ts`, the three above. `route-table.test.ts`, `access.test.ts` and every existing `DUPLICATE` assertion (tables, tender methods, catalog, presets) pass unedited.

**Red proofs (each applied, failing for the stated reason, reverted; `git status` shows no mutation left).**
1. Dropped `users/deactivate` from `ROUTE_TABLE`: `route-table.test.ts` failed "registered but not in the table".
2. Declared `deactivate` `OPTIONAL`: users case 2 failed at "no cookie".
3. Granted `UPDATE (name)`: schema privilege map and the new column test failed.
4. Create-manager username collision reported as `'pin'`: the username-DUPLICATE case failed.
5. Origin check skipped: the stale-move case wrote.
6. Increment dropped from deactivation: the deactivate/reactivate sessions case (AC-32) and three others failed.
7. Unique violation treated as a fault: the three taken-PIN cases got 500.
8. Own-account check dropped from `deactivateUser`: self-deactivation returned 200, and the held-lock case failed.
9. Lock only the subject (actor read unlocked): both crossing cases ended `[200, 200]`. My first attempt, dropping the actor from the lock array entirely, made both `UNAUTHENTICATED`, which missed the real defect; the final mutation kept an unlocked actor read.
10. PIN written into `reason`: the one-entry-per-command case failed. Manager-create entry skipped: failed. Audit written after commit (deactivate): the rollback case and the no-entry case failed.
11. `u.role IS NOT NULL` removed: session case 11 got `ACTIVE`.
12. `password` renamed `oldPassword` in a schema: the key-name test failed on "not in SECRET_KEYS".
13. Details attached in the shared envelope helper (`send` in `errors.ts`): tables and tender-methods `DUPLICATE` exact-body cases failed.
Case 14 (`error-details.types.ts`) is compile-time and passes `tsc`; every `@ts-expect-error` is live.

**Verify output.** `npm run verify`: typecheck clean; `Test Files 162 passed (162)`, `Tests 5779 passed (5779)`. An earlier full run in this session had three failures, all fixed above (case 28 export list, `config-api.test.tsx`, and my own wrong depth in `credential-keys.test.ts`). One full run took 1119 s on a busy machine against about 120 s normally; I did not find a cause in the tests (the next runs took 117 s and 135 s).

**Found, not fixed.** `reactivateUser` hashes a supplied `pin` before the lock even where the command turns out to be a no-op; harmless, only cost. The own-account check lives in the domain (`changeRole`, `deactivateUser`) rather than the route; a route test proves the status.

**Migration and the development database.** I ran `npm run db:migrate` here: `applied: 0015_staff_user_kitchen.sql`, with no failure, so every existing development row already satisfied the new checks. The lead should do the same on any other development database and, if the migration fails, report the row and not edit it by hand.

**What the next agent does not have.** No `CurrentPassword` schema, no `set-pin`/`set-password`/`own-*` routes, no re-stamp. No screen; the five back-office API functions are declared and called by nothing.

The Handoff itself was written before the commit; the commit is `5c41a6a` on `agent/phase1-s8a`, and the Handoff text was corrected afterwards in the working tree.

BLOCKED: may I commit the one-file edit to apps/back-office/test/config-api.test.tsx (five users route keys added to its expected list; it is sitting uncommitted in the working tree and the pre-commit hook refuses it for the builder), and do you ratify the fixtureSession.ts addition?
