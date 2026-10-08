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

`architect9`, 2026-10-07.

### What was written

- **`docs/decisions/ADR-009-back-office-username-and-password.md`**, `Status: Proposed`. It
  states the six decided items with their reasoning (Decision 1 to 7), every alternative the
  task names and why it lost, plus four the task did not name (SSO now; counting failures for
  unknown usernames; marking an idle session released; a bootstrap screen or a refusing script
  for the first manager), the consequences, the accepted MVP risks, and what an SSO ADR would
  remove and keep.
- **`docs/ARCHITECTURE.md`**, sections 2.1, 5.1, 7.2, 7.3, 13 and 16 only
  (`git diff -U0` shows nine hunks, all inside those sections). The document's `Status:
  Approved` header and section 18 are untouched, and nothing is marked accepted.

No accepted ADR was edited. `git diff --check` is clean. That is the only check I ran: this is
docs-only work and the task names no other lint. I ran no SQL and no tests.

### Two edits that go a little past the task's parentheses, for the lead to keep or strip

1. **Section 7.3's heading** now reads "PIN and password lookup, verification, and
   throttling". The password rules sit in that section and a reader searching for them would
   not look under "PIN". I searched the repository's Markdown for a link to the old anchor and
   found none; documents cite the section by number.
2. **Section 7.2's "unsaved form state" bullet** now also says that the same manager
   re-authenticates with a password, that this renews the same session under a new token with
   the absolute lifetime still running, and that another manager signs in afresh and never
   receives the state. The task lists only the credential-version rules for 7.2, but this is
   decided item 1 and the ADR's M-6 alternative, and section 7.2 is where the architecture
   states session behaviour. Without it ARCHITECTURE.md does not say what M-6 does.

### Where the contract text and the decided items do not agree

I worked to the decided items and did not work around the text. Each of these needs the lead
to draft and the owner to approve; none blocks the ADR.

1. **FR-B3 contradicts decided item 5.** The new FR-B3 says resetting a password "invalidates
   every session of that user". Item 5 says a manager who changes their own password stays
   signed in. Proposed replacement for FR-B3's second sentence:

   > Deactivating a user, or resetting their PIN or password, from the back office invalidates
   > every session of that user, POS and back office, on its next authenticated request. The
   > one exception is a manager who changes their own password: the back-office session the
   > change was made from continues, and every other session of theirs is invalidated.

   AC-32 is about deactivation only and needs no change.
2. **FR-A5b's "only a successful verification of that account resets its counter" omits the
   reset when a cooldown ends.** The owner ruled on 2026-10-06 that "the failure count resets
   when a cooldown ends", in the context of the PIN classes. ARCH-008 applied it to the
   password count and so does the ADR (Decision 4); without it the first wrong password after
   a cooldown would start the next one at once. FR-A5 has the same omission. If the owner
   wants the text to say it, add to FR-A5b after that sentence: "The count also returns to
   zero when a cooldown ends." Please confirm the ruling extends to passwords; I have assumed
   it does.
3. **FR-A5b and AC-35 say "for one username"; an unknown username is never blocked.** There is
   no row to count against. A tester reading AC-35 literally could expect five wrong attempts
   on a name that does not exist to block it. This is the accepted username-discovery risk
   seen from the other side. Suggested clarification for AC-35, after "block that username
   for five minutes": "(a username that has no account is refused every time and is never
   blocked)".
4. **`.agent/DECISIONS.md` line 102** (the lead's delegated line of 2026-10-06) still says a
   wrong password at M-6 "counts as a LOGIN failure". Line 113 refines it and FR-A5b now
   forbids it. The file is append-only and the lead's; a builder reading 102 alone would be
   misled, so the build task file should cite 113 and FR-A5b, not 102.
5. **PRD section 6, the edge case at `:463`** ("that user's POS session is invalidated")
   was flagged by ARCH-008 to read "that user's sessions are invalidated". The task file does
   not list it among the changes on `agent/lead-1007c`, and I did not fetch that branch.

### Stale wording elsewhere in ARCHITECTURE.md (outside the six sections; not edited)

Exact replacements, to be applied if and when the owner accepts ADR-009:

- **Section 1**, "preserve the seven consequential decisions": no change while ADR-009 is
  Proposed. On acceptance, section 18 needs a second sentence and row rather than an edit to
  the dated one: after the table, "ADR-009 was accepted on `<date>`:" and the row
  `| [ADR-009](decisions/ADR-009-back-office-username-and-password.md) | Back-office sign-in
  by username and password |`. Section 1's "seven" then becomes "eight", and so do the "seven
  accepted ADRs" lines in AGENTS.md, CLAUDE.md and `.agent/roles/architect.md` (the lead's).
- **Section 3.2**, the gate list has no entry for any accepted authentication risk. Add one
  bullet: "a review of the authentication risks accepted for the loopback MVP: PIN guessing
  that a cashier's own login resets, response-time differences in PIN and password
  verification, back-office username discovery, per-account lockout, and the unaudited
  first-manager script;". The first two are ARCH-007's and were accepted on 2026-10-07 with
  the same "revisit at the gate" condition; nothing in section 3.2 records them either.
- **Section 5.1, SecurityEvent row**: "containing no PIN and no claimed audit actor" should
  read "containing no PIN, no password, no username and no claimed audit actor". It is inside
  section 5.1, but the task names only two rows there, so I left it.
- **Section 11**, last paragraph: "An unauthenticated failed login has no identified actor …
  Audit and telemetry both exclude the PIN value in every form." should read "An
  unauthenticated failed login, at the POS or the back office, has no identified actor and
  therefore cannot satisfy B-13. It is recorded only as a SecurityEvent. Audit and telemetry
  both exclude PIN and password values in every form."
- **Section 12**, "do not expose SQL, stack traces, secrets, blind indexes, or PINs" should
  end "blind indexes, PINs, or passwords".
- **Section 14.2**, "throttle bucket races and restart durability" should read "PIN throttle
  bucket and per-account password throttle races, their isolation from each other, and restart
  durability".
- **Section 16, first row**, "Exposure of PINs" could read "Exposure of PINs and passwords".
  I left it because the task names two new rows, not this one.

### Accepted ADRs

None conflicts and none needs superseding. ADR-001 (separate session cookies, shared
authentication primitives) and ADR-002 (PostgreSQL-backed sessions and throttle state) are
consistent with the decision. ADR-007 says "Neither store may contain a PIN value"; that is
now narrower than B-12, but it is not wrong, and ADR-009 states the password rule itself, so
no superseding note is proposed.

### For the designer (known to the lead already)

SCREEN-INVENTORY BO-01 `:548–550` and SITEMAP `:248`, as the task says. One addition from the
ADR's consequences: the users screen, when it is designed, must say before a PIN or password
reset is confirmed that it ends all of that manager's sessions.

### What the credential build task needs

It is all in ARCH-008 and **nothing in it has changed**: the owner adopted every
recommendation. The task file can be written from:

- **Schema and grants:** ARCH-008 §5 "Schema: a table of its own" (`:450–497`).
- **Interface, the throttle's statements, evidence:** ARCH-008 "The back-office credential
  task" rules 1 to 9, test cases and red proofs (`:1040–1098`), which in turn cite ARCH-007
  questions 1 to 6 for the locking protocol. Note that the built `throttle.ts` reads the clock
  with `clock_timestamp()` after the lock, not `now()` as ARCH-007's sample had it (ARCH-008
  `:64–66`); the password throttle follows the built code.
- **M-6 against a session:** ARCH-008 §5 "M-6 against a session" (`:626–674`); the session
  half is already PHASE0-007's `reauthenticateSession`.
- **The first-manager script:** ARCH-008 §5 (`:676–696`) and rule 10; per decided item 6 it
  does not refuse when a manager exists.

Four things the ADR adds or sharpens that the task file should carry:

1. **Setting or resetting a password does not touch `consecutive_failures` or
   `blocked_until`.** ARCH-008 did not say either way; FR-A5b's "only" decides it. The column
   grant permits the write, so the rule needs a test when the Phase 1 writer exists.
2. **The own-password re-stamp is not this task's.** It needs a writer of `actor_session`
   inside a user-management transaction, which PHASE0-007's rule 13 ("no function takes a
   client") does not allow today. It belongs to the Phase 1 users-screen task and wants a
   short architect consult then.
3. **The migration number** in ARCH-008 (`0007`) assumed `0006` had landed; the builder takes
   the next free number.
4. **Success requires role Manager and an active user**, and a correct password that fails
   that rule is counted. ARCH-008 rule 4 has it; I repeat it because it is the rule most
   easily dropped.

### Open product questions the ADR names and does not close

- Does changing one's own password require the current password? I recommend yes: an
  unattended signed-in back office otherwise lets a passer-by take the account and lock its
  owner out, which the server cannot prevent any other way. Needed before the Phase 1 users
  screen.
- Does a manager who resets their **own PIN** from the back office stay signed in? Item 5
  names the password only; as written, a PIN reset ends their session.
- Does a role change increment the credential version? (ARCH-008 `:816–818`; Phase 1.)

### Not verified

I did not read `pin.ts`, so the ADR says "the same parameter definition as the PIN" and states
no Argon2id numbers. I did not read `.agent/STATE.md`, `QUEUE.md` or the journal, and did not
fetch `agent/lead-1007c`; the new contract text is taken from this task file.

### Acceptance (2026-10-08)

The lead reported that the owner accepted ADR-009 on 2026-10-08 (lead session: "accept
ADR-009") and instructed these edits. I am recording the owner's acceptance as relayed, not
accepting anything myself; this worktree's `.agent/DECISIONS.md` has no line for it yet, so the
lead's line there is the record.

- **ADR-009:** `Status: Accepted`, `Date: 2026-10-08`, `Approved by: Product owner`, in the
  form of ADR-001 to ADR-007. The body is unchanged. Everything above this note that calls the
  ADR "Proposed" describes it as it stood on 2026-10-07.
- **ARCHITECTURE.md**, the post-acceptance wording listed above, applied as written:
  section 1 ("seven" to "eight"); section 3.2 (the authentication-risk gate bullet, placed
  before the last bullet so the list's punctuation holds); section 5.1 (the SecurityEvent
  row); section 11 (last paragraph); section 12 (the errors bullet); section 14.2 (the throttle
  test line); section 16 (first row); section 18 (a dated sentence and a second table with
  the ADR-009 row, leaving the 2026-09-10 table as it was).
- **Not edited, the lead's:** the "seven accepted ADRs" lines in AGENTS.md, CLAUDE.md and
  `.agent/roles/architect.md`.

`git diff --check` is clean. The contract-wording items and the open product questions above
are unaffected by the acceptance and still stand.

DONE
