---
id: ARCH-020
title: Consult C3 — users and credentials (plan slice S8), under the owner's Q1, Q6a, Q7-Q11 answers
category: arch
touches: [identity, audit, boundaries]
depends_on: []
owns: [.agent/reviews/ARCH-020-*.md]
status: not-started
cycles: 0
---
# ARCH-020 — Consult C3: users and credentials

**Written** 2026-10-20 by the lead. **Owner:** `architect20`, Claude Opus 5.5, opened by hand in its own pane.
**Branch and place:** `agent/arch-020`, cut from `development` at `3749fb7`, in the worktree
`../restaurant-pos-wt/ARCH-020`. A **read-only consult**: write only `.agent/reviews/ARCH-020-users-and-credentials.md`
and this task file's Handoff. No ADR, no ARCHITECTURE edit, no code. **Read files with the Read, Grep and Glob tools,
not shell commands**: a shell read asks the owner for approval and stalls you.

## Why this task exists

The owner accepted the Phase 1 plan on 2026-10-20 and answered every question slice **S8** (users) waited on. S8 also
waits on consult **C3**. Read the plan's section 7 row for C3, its *One risk C3 must present to the owner*, the *No ADR
for users* paragraph, and slice S8, word for word: they are your question list. The lead turns your report into the S8a,
S8b and S8c task files, so write it as ARCH-012 to ARCH-015 and ARCH-019 were written: decisions with alternatives and
reasons, then *For the lead* items a task file can copy (scope, `owns`, acceptance criteria each with a red proof, the
tests expected to change, `touches` flags).

## Decided: do not reopen

Everything in `.agent/DECISIONS.md` binds; read every line from 2026-10-05 onward and all of 2026-10-20. The answers
that shape C3 (owner, 2026-10-20):

- **Q1 (ADR-009's open items):** (a) changing one's own back-office password requires the current password, verified
  against the account's own throttle (ADR-009 §4); (b) a manager who resets their own PIN from the back office stays
  signed in there, the change requires their current password, and their POS sessions end; (c) **a role change
  increments the credential version**, so every session of that user ends.
- **Q6(a):** a reactivated user keeps their PIN unless another active user holds it, in which case a new PIN is set
  before reactivation (the 2026-10-07 ruling, now in FR-B3).
- **Q7:** for the MVP, a manager sets another user's PIN on the back-office screen, typed by whoever is at the desk;
  the server does not try to tell who typed it; the PIN-in-use oracle is **accepted for the MVP**. Present it for the
  §3.2 gate review list as the plan recommends; do not reopen it.
- **Q8:** the server refuses a manager **deactivating their own account or removing their own manager role**;
  deactivating or demoting **another** manager stays allowed. It is the plan's rule, not a "last active manager" rule.
- **Q9:** a person may move between kitchen and the cashier or manager role. To cashier or manager: a PIN is set in the
  same command (and a username and password for a manager). To kitchen: the PIN is removed from use and every session
  ends. A former manager's credential row stays and never verifies.
- **Q11:** a back-office change to a user's **status, role or credentials** (deactivation, reactivation, PIN set or
  reset, password set or reset, role change) **is audited**, naming the acting manager and the user and never a PIN or
  password. Nothing else in Phase 1 is audited. PRD FR-J3 now says so.
- **PRD FR-B3** now reads, in full: *"Manage users: create, assign a role or the kitchen classification, set and reset
  PIN, set a manager's back-office username and password and reset the password, deactivate and reactivate. A username,
  once set, never changes. A reactivated user keeps their PIN unless another active user holds it, in which case a new
  PIN is set before reactivation. Deactivating a user, changing their role, or resetting their PIN or password, from the
  back office invalidates every session of that user, POS and back office, on its next authenticated request. The one
  exception is a manager who changes their own password or PIN, which requires their current password: the back-office
  session the change was made from continues, and every other session of theirs is invalidated. A manager cannot
  deactivate their own account or remove their own manager role."*
- **The first-form pattern is consult C2's** (`.agent/reviews/ARCH-019-first-back-office-form.md`, merged): ids in
  `POST` bodies, fixed-string paths, `VALIDATION_FAILED` with no wire details, `DUPLICATE` (409) as the generic
  uniqueness refusal, one locking read first, commands answer the record, the unknown-outcome rule. Users follow it;
  where users need more (a PIN must never be echoed, a password never answered), say so.
- **The plan's *No ADR for users*:** answering ADR-009's open items supersedes nothing, so C3 suffices; **but** Q1(b)
  makes an own PIN change keep the back-office session, which extends ADR-009 §5's "the single place where a
  user-management command writes a session row" to two places. Say so plainly, and say whether you judge that a change
  to ADR-009's decision (then the lead must commission a superseding ADR on that one point) or an answer to its open
  question.

## What to decide

From the plan's C3 row and S8, at least:

1. **The `staff_user` loosening for kitchen staff**: the forward migration that allows a kitchen row with no role and no
   PIN while keeping "a role and no PIN" impossible (constraints, not application checks); the column grants on
   `staff_user` the new commands need.
2. **Role changes** between kitchen and the two roles (Q9), and between cashier and manager: what each command takes,
   what it writes, the credential-version increment (Q1c), and the manager's back-office credential row on promotion
   and demotion (ADR-009 §1: verification requires an active manager).
3. **The credential-version increments** for every command that must end sessions, and the **re-stamp of the acting
   session** in the same transaction as the hash change, for an own password change and an own PIN change (ADR-009 §5;
   Q1a, Q1b). The two places that write a session row, and the ADR question above.
4. **Verifying the current password** through the account's throttle (ADR-009 §4), what a throttled or wrong current
   password answers, and that it is not a sign-in.
5. **Self-deactivation and self-demotion refused** (Q8): the code, and the check's place relative to the lock.
6. **Reactivation and a taken PIN** (Q6a): what the command takes and refuses; uniqueness among active staff (FR-A4,
   `0006`); the PIN-in-use refusal and the oracle (Q7, accepted; for the §3.2 list).
7. **The audit entries** (Q11): which commands write one, its action names and fields under ADR-007 and the existing
   writers (PHASE0-005), in the command's transaction, never a PIN or password; the test that proves no PIN, password
   or hash reaches an entry.
8. **The new request fields** under ADR-010 rule 2's redaction backstop (which matches listed names only, so
   `newPassword` or a nested `pin` would pass it): the field names, the log-scan markers each needs, and the route
   declarations (interactive, anti-CSRF).
9. **The split** S8a (records: kitchen, create, role change, deactivate, reactivate), S8b (credentials: PIN set and
   reset, username and password set, password reset, own password and own PIN with the re-stamp), S8c (BO-06 and the
   browser cases: a deactivated cashier's open POS session and a reset manager's open back-office session each end on
   their next request, in a second profile, as POS-01 *session invalidated* and BO-01 *Session ended*), each with scope,
   `owns`, acceptance criteria with red proofs, tests expected to change and `touches`.
10. **What design slice E2 (BO-06) must draw** that the architecture fixes (the warning before a reset that ends a
    manager's sessions, the own-password form with the current password, kitchen without a PIN, the refusals).

## Read

- The plan (S8, sections 2, 5, 7 and 8 Q1, Q6-Q11); ARCH-017's Handoff (`.agent/tasks/ARCH-017-phase-1-plan.md`).
- `docs/ARCHITECTURE.md` (§3, §6 identity, §7, §8, §11 to §14, §16 and the §3.2 gate list); ADR-007, ADR-009, ADR-010,
  ADR-011 in full; ADR-012's rule on control characters in printed text, as it bears on names.
- `docs/PRD.md` FR-A1 to FR-A7, FR-B3, FR-J1 to FR-J4, AC-18, AC-32, AC-35; `docs/BOUNDARIES.md` (B-11, B-12, B-13, B-20,
  B-24 at least).
- `.agent/reviews/ARCH-006-phase0-core-schema.md`, `ARCH-012` to `ARCH-015`, `ARCH-019` (C2); the PHASE0-004 to
  PHASE0-009b and PHASE0-012b Handoffs in `.agent/tasks/` (look for *For Phase 1* and *What the next agent needs*),
  especially PHASE0-007b (the back-office credential) and its "a password set or reset bumps the version and does not
  touch the throttle columns".
- The code: `db/migrations/0002`, `0003`, `0006`, `0007`; `apps/server/src/domain/` (staff, PIN, session, throttle,
  back-office credential, audit); `apps/server/src/http/` (access, guard, validation, log redaction); the table pattern
  (PHASE1-S1a, in review, not on your branch: read `../restaurant-pos-wt/PHASE1-S1a/apps/server/src/domain/dining-table.ts`
  and `.../http/routes/back-office-tables.ts` with the Read tool); `apps/server/test/schema.test.ts`.
- `.agent/reviews/DESIGN-011-back-office-audit.md` (BO-06); `docs/design/SCREEN-INVENTORY.md` BO-06.
- **Never print `db/dev.env`'s values.** For a library fact, `.agent/bin/ask.sh librarian "<question>"`; do not recall.

## Acceptance criteria

1. The report answers each of the ten items above, each with alternatives and reasons, or names where it is answered.
2. Nothing contradicts the contract, an accepted ADR or a DECISIONS line. The ADR-009 §5 question is answered plainly;
   if a superseding ADR is needed, the report says exactly on which point and proposes it, without assuming it.
3. *For the lead* gives S8a, S8b and S8c each a scope, `owns`, acceptance criteria with red proofs, tests expected to
   change and `touches`, concrete enough to copy into a task file.
4. `git diff --name-only development` shows only the report and this task file; `git diff --check` is clean.

## Out of scope

- C4 (the POS catalog), ADR-012's questions, BO-06's visual design (E2's); any code, ADR, ARCHITECTURE edit, task file
  or design work; the contract documents.

## Commit and report

Commit on `agent/arch-020` only, after `git diff --check` is clean, and never push. Write the Handoff below in full
prose: what you decided and why, any question for the owner with a proposed answer, anything stale you found with exact
replacement wording, and what the lead needs to write S8a to S8c and E2's brief. End with `DONE` or `BLOCKED: <one
question>`. Then run exactly one of:

    herdr agent prompt lead "architect20: ARCH-020 done — <one line>"
    herdr agent prompt lead "architect20: BLOCKED — <question>"

## Handoff

**architect20, 2026-10-20.** The report is `.agent/reviews/ARCH-020-users-and-credentials.md`. It
answers the ten items in order (sections 1 to 10), each with the decided basis, the recommendation,
the alternatives and why they lost, then *For the owner*, *Stale text found* and *For the lead*
(S8a, S8b and S8c, each with touches, depends, owns, scope, acceptance criteria with red proofs,
tests expected to change and what its Handoff must carry). Nothing else was edited.

**What I decided, and why, in brief.**

- *Kitchen* is a `staff_user` row with `role`, `pin_hash` and `pin_lookup` all null, held by one
  check constraint (all three or none), so "a role and no PIN" is impossible in the database; the
  existing role and hash checks pass a null and stay; the `0006` partial index needs nothing.
  `pos_app`'s table-wide `UPDATE` becomes a column grant on `role, pin_hash, pin_lookup, is_active,
  credential_version` (revoke first: the librarian confirmed a table revoke removes column grants).
  The name gains C1's printed-text check. The session predicate gains `u.role IS NOT NULL` as
  defence in depth.
- *Role change* is one command whose body is a union keyed by the move (`KITCHEN_TO_CASHIER` and
  five more), so each move's required credentials are a schema property; the move's origin is a
  precondition under the lock, refused by a new `USER_CHANGED` (409). Every move increments the
  version (Q1c). Promotion always sets a new password (a former manager's old one would otherwise
  verify again) and a username only for someone who never had one.
- *Increments:* deactivation, every role change, every stored or removed PIN or password; not
  creation or reactivation alone. The deactivation increment is what keeps old sessions dead after
  a reactivation, and S8a's red proof shows it.
- *Own password and own PIN:* the existing `verifyPasswordThrottled({ staffUserId })`, unchanged,
  for the session's own user, in its own transaction; then the new secret hashed outside any lock;
  then one transaction that re-checks the version, writes, increments, re-stamps the acting session
  (exactly one row or everything rolls back) and audits. Wrong current password is
  `INVALID_CREDENTIALS`, cooldown `THROTTLED`, failure a security event as at M-6; no cookie, token
  or `csrfToken` changes. It is not a sign-in.
- *Q8:* `OWN_ACCOUNT` (409, not `FORBIDDEN`, which would destroy the working area), checked before
  the transaction because it compares two ids. It also refuses the other-user PIN and password
  resets aimed at oneself, so the current-password rule cannot be bypassed. Beyond the plan's rule,
  every users command locks and re-reads the **acting** manager's row too (`FOR NO KEY UPDATE`, id
  order): without it two managers demoting each other at once both succeed and leave none, which is
  the case the owner's reason for Q8 excludes.
- *Reactivation* takes an optional PIN; a taken PIN is `DUPLICATE` with new optional typed details
  `{ field: 'pin' | 'username' }` (tables keep sending none, so S1a's exact-body assertion holds).
- *Audit:* one entry per successful command, in its transaction, through `writeAudit`, actor the
  manager, subject `staff_user`/id, a closed list of dotted action names encoding the move; nothing
  for a no-op, a refusal or a wrong current password; a marker scan over whole rows proves no PIN,
  password, username, lookup or hash.
- *Fields:* only `pin`, `password`, `username`, `currentPassword`, top-level; the backstop gains
  `username` and `currentPassword`, and a contracts test fails on a credential-looking key the
  backstop does not list. Set-schemas hold the full username and password rules (the form must place
  the error); the current password keeps the loose verification schema so it is counted.
- *No standalone "set username and password" route:* a manager is only ever made at create or
  promotion, both of which set them.

**The ADR-009 §5 question.** Q1(b) makes a user-management command write a session row in two
places, and Q1(c) falsifies ADR-009's *Consequences* bullet on role changes. My judgement: both are
answers to ADR-009's own *Not decided here* items, not changes to its decision (the ADR calls the
PIN case's status quo provisional, the mechanism of one version and a same-transaction re-stamp of
the acting session is unchanged, and "single place" described the one command that then existed).
I recommend recording the current rule in ARCHITECTURE §7.2 (exact wording in *Stale text* 1), not a
superseding ADR. If the lead judges otherwise, section 3 gives the exact decision text of a
one-point ADR-013, which I propose and do not assume.

**Questions for the owner, each with a proposed answer.**

- **OQ1** (blocks only S8a's two create actions): is creating a cashier or manager audited?
  Proposed yes (`user.create.cashier`, `user.create.manager`; none for kitchen; the script still
  none), for Q11's own reason that the manager who sets a PIN knows it.
- **OQ2** (blocks nothing): may a display name be corrected? Proposed no in Phase 1 (FR-B3 omits
  it; a rename rewrites how past entries read). The column grant leaves `name` out accordingly.

**Stale text found, with exact replacement wording in the report.** ARCHITECTURE §7.2 (the
increments and the own-PIN re-stamp), §3.2 and §16 (the PIN-in-use oracle, as the plan asked), §8
(the users lock order), §11 (the audited actions, also missing the I-8 reprint); SCREEN-INVENTORY and
SITEMAP BO-06 (the designer's, through E2); the plan's S8 goal and AC-32 DoD line (own PIN); ADR-011's
reading on a demoted manager at M-6 and ADR-009's role-change consequence (recorded, not edited).
Offered, not required: one AC-18 sentence so the criterion lists what FR-J3 now audits. No contract
document contradicts the consult.

**What the lead needs for S8a to S8c and E2.** *For the lead* is written to be copied. S8a carries
credentials in its bodies already (create, promotion, reactivation), so it is `identity` and owns
its own log-scan cases; the plan's split otherwise holds, and an optional S8a1/S8a2 line is given.
E2's brief is section 10 plus *Stale text* 5: kitchen without a PIN, create by classification, role
change as a move, the warning before every session-ending command (no confirmation required by the
ARCH-002 test), the own-password and own-PIN forms with the current password, uncontrolled
credential inputs with `autocomplete` hints, every refusal's state, and the own-password unknown
outcome, whose reread cannot tell whether the change applied.

**Not done.** No code or test was run, and no browser was opened. Four PostgreSQL facts came from
the librarian through a summarising fetch; the task file should have the builder confirm the
column-grant syntax and `[[:cntrl:]]`'s coverage of C1 controls against the manual, as C1 asked.

DONE
