---
id: ARCH-009
title: ADR-009 (Proposed), the back-office username-and-password credential, with the ARCHITECTURE.md amendments it needs
category: arch
touches: [identity, audit]
depends_on: []
owns: [docs/decisions/**, docs/ARCHITECTURE.md]
status: running
cycles: 0
---
# ARCH-009 — The back-office credential ADR

**Written** 2026-10-07 by the lead. **Owner:** `architect9`, Claude Opus 5.5, opened by hand.
**Branch and place:** `agent/arch-009`, cut from `development` at `93c6f2c`, in the worktree
`../restaurant-pos-wt/ARCH-009`. Write only `docs/decisions/ADR-009-*.md`, `docs/ARCHITECTURE.md`
and this task file's Handoff.

## Why this task exists

ARCH-008 (`.agent/reviews/ARCH-008-sessions.md`, §5 from `:436`, and *For the owner* from `:1102`)
recommended a table of its own for the back-office credential, a per-account throttle, and a new
ADR with amendments to ARCHITECTURE.md. On 2026-10-07 the owner agreed to all six of its *For the
owner* items. The contract is already changed (PRD FR-A1, FR-A2b, FR-A3, FR-B3, AC-32, new FR-A5b
and AC-35; BOUNDARIES B-11 and B-12), on `agent/lead-1007c` at `408f707`, not yet on
`development`. The exact text is quoted below so you need not fetch that branch.

The ADR records the decision so that it survives, and so that the SSO the owner plans after the
MVP has something to supersede. It is the authority the back-office credential build task will be
written from.

## Decided: do not reopen (owner, 2026-10-07, `.agent/DECISIONS.md`)

1. The MVP back office signs in with a username and password; a PIN is never accepted there.
   M-6 asks the idled manager only for their password, and offers another manager their own
   username and password instead, which is an ordinary sign-in that never receives the draft.
2. The password throttle is **per account**: five consecutive failures for one username block it
   for five minutes; only that account's success resets it; it never shares a PIN class, and no
   PIN verification resets it; server-side, survives restart; failures are security telemetry.
3. B-11 and B-12 name passwords beside PINs.
4. A username is 3 to 32 characters of lower-case letters, digits, dot, underscore and hyphen,
   compared case-insensitively, and never reused, even after its holder is deactivated. A password
   is 8 to 128 characters with no composition rules.
5. One credential version covers a manager's PIN and password: resetting either ends both their
   POS and back-office sessions. A manager who changes their **own** password stays signed in to
   the back office.
6. Accepted for the MVP: the per-account throttle lets usernames be discovered (to be recorded for
   the gate before any networked use, ARCHITECTURE 3.2); the first-manager script creates a manager
   whenever it is run at the host's terminal and does not refuse once one exists.

The new contract text, verbatim:

> **FR-A5b** Back-office password verification is throttled per account. After five consecutive
> failures for one username, the server rejects further verification for that username for five
> minutes. Only a successful verification of that account resets its counter. A password failure
> never counts in a PIN class, and no PIN verification resets a password counter. The state is
> server-side and survives browser, application, and database restart. Failed back-office sign-ins
> are security telemetry. No password value is recorded anywhere.

> **B-11. PINs and passwords are hashed with a modern password hash, never stored or transmitted
> in plaintext.** · **B-12. No PIN or password value appears in any log, audit entry, error
> message, stack trace, or analytics event, in any form — including partially masked.**

FR-A1, FR-A2b, FR-A3, FR-B3, AC-32 and AC-35 are ARCH-008's wording at `:1110–1149`, adopted
unchanged.

## What to write

1. **`docs/decisions/ADR-009-back-office-username-and-password.md`**, `Status: Proposed`, in the
   form of ADR-001 to ADR-007: context, decision, alternatives considered and why they lost (at
   least: columns on `staff_user` versus a table of its own; the `LOGIN` bucket or a third
   installation-wide class versus per account; a separate credential version versus one; a new
   session versus renewing the same row at M-6; PIN at the back office), consequences, and the
   risks accepted for the MVP (item 6). Use the number ADR-009: ADR-008 stays reserved for the
   deferred database-roles decision (ARCH-006), which the owner postponed.
2. **The amendments to `docs/ARCHITECTURE.md`** that the decision makes necessary, edited in place
   on this branch: §2.1 (Argon2id for PINs and passwords), §5.1 (a BackOfficeCredential entity;
   StaffUser's row), §7.2 (deactivation, PIN reset or password reset increments the one credential
   version; own password change keeps the session), §7.3 (the per-account throttle beside the two
   PIN classes, and "PINs are unique" becoming "unique among active staff", from ARCH-007 and
   FR-A4), §13 (the back-office `auth` row), §16 (username discovery and per-account lockout, as
   accepted MVP risks). Change nothing else. These edits are proposed together with the ADR; the
   owner accepts both at once, so mark nothing accepted.
3. **Exact replacement wording** for anything else you find stale — another ARCHITECTURE section,
   an accepted ADR (which you must not edit; propose a superseding note instead), or a designer
   document — in your Handoff, not as an edit. Known already, for the designer, not you:
   SCREEN-INVENTORY BO-01 `:548–550` and SITEMAP `:248` still describe a PIN and the shared
   `LOGIN` class at the back office.

## Read

ARCH-008 in full (it is on `development`: `.agent/reviews/ARCH-008-sessions.md`), especially §5
and *For the owner*; ARCH-007 (`.agent/reviews/ARCH-007-throttle.md`) for the PIN throttle you sit
beside; `docs/ARCHITECTURE.md` §2.1, 3.2, 5.1, 7, 13, 16; ADR-001 to ADR-007 for form and for any
conflict; `docs/PRD.md` FR-A1 to FR-A7, FR-B3, AC-19, AC-27, AC-28, AC-32 (the old text; the new
is above); `docs/BOUNDARIES.md` B-11 to B-13, B-24; `.agent/DECISIONS.md`, the 2026-10-05 to
2026-10-07 lines.

## Acceptance criteria

1. The ADR exists as `Proposed`, states each of the six decided items with its reasoning, and
   names every alternative listed above with why it lost.
2. Each ARCHITECTURE.md amendment is in the section named, and `git diff -- docs/ARCHITECTURE.md`
   touches only §2.1, 5.1, 7.2, 7.3, 13 and 16.
3. Nothing in the ADR or the amendments contradicts the new contract text above or B-11 to B-13.
   Where you think the contract text itself is wrong, say so in the Handoff with exact wording;
   do not work around it.
4. No accepted ADR is edited. `git diff --check` is clean.
5. The Handoff lists what the credential build task needs from the ADR (schema, interface, the
   throttle's statements, the first-manager script), or points to the ARCH-008 sections that
   already hold it and says what, if anything, has changed since.

## Commit and report

Commit on `agent/arch-009` only, after `git diff --check` is clean, and never push. Write the
Handoff below in full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one
of:

    herdr agent prompt lead "architect9: ARCH-009 done — <one line>"
    herdr agent prompt lead "architect9: BLOCKED — <question>"

## Handoff

*(The architect writes this section.)*
