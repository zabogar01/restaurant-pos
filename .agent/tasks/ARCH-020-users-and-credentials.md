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
