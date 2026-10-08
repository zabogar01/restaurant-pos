# ADR-009: Back-office sign-in by username and password

**Status:** Accepted

**Date:** 2026-10-08

**Approved by:** Product owner

ADR-008 is reserved for the deferred database-roles decision and does not yet
exist. Nothing is superseded by this record: no accepted ADR covers how a
person authenticates.

## Context

The architecture approved on 2026-09-10 gave the system one credential, the
six-digit staff PIN, and two installation-wide throttle classes for it.
Section 7 described a back-office session but never said what a manager types
to obtain one, and the Phase 0 plan filled the gap by logging the back office
in with a PIN against the `LOGIN` class.

The owner has since ruled otherwise, in steps recorded in
`.agent/DECISIONS.md`:

- 2026-10-05: the back office authenticates with a credential other than the
  PIN, and Google SSO is planned for after the MVP. A draft preserved behind
  re-authentication is resumed only by the manager whose session idled.
- 2026-10-06: the MVP credential is a username and a password. The first
  manager is injected by hand. The re-authentication prompt (M-6) asks the
  idled manager only for their password and offers another manager their own
  sign-in. After eight hours the session returns to Login.
- 2026-10-07: the six items this record carries, agreed from ARCH-008's *For
  the owner*, and the contract text that states them: PRD FR-A1, FR-A2b,
  FR-A3, FR-A5b, FR-B3, AC-32 and AC-35, and BOUNDARIES B-11 and B-12.

The forces behind the design are these.

- The back office guards the configuration, the users, the audit viewer and
  end-of-day close. A PIN is a short secret that is typed many times a shift
  at a shared touch screen, in view of other staff, and that every cashier
  can guess at without limit under a ruling the owner accepted for PINs only
  (2026-10-07: any success resets its class).
- PIN-only entry has no account to count failures against, which is why the
  PIN throttle is installation-wide. A username supplies one.
- The credential is temporary by the owner's own direction. Whatever is built
  must be removable when SSO arrives without disturbing staff identity, the
  PIN, sessions or audit.
- Sessions are already built to be indifferent to the credential that was
  verified: a session records an audience and the credential version that was
  verified, and is valid only while that version equals the user's (ARCH-008,
  PHASE0-007).

## Decision

### 1. The credential

A manager signs in to the back office with a username and a password. A PIN
is never accepted there, for a manager or anyone else, and a password is never
accepted at the POS or as an inline approval. The two credentials do not
substitute for each other in either direction.

Success at the back office is a correct password for an **active** StaffUser
whose role is **Manager**. A correct password for a deactivated user, or for a
user whose role is no longer Manager, is a failed verification and is counted
as one. The table cannot express "only a manager has a credential" without a
trigger, so the rule is enforced where the password is verified, as the
`MANAGER_APPROVAL` class enforces its role rule.

### 2. Where it is stored

The credential is an entity of its own, BackOfficeCredential, in a table of
its own keyed by the StaffUser it belongs to. It holds the username, the
Argon2id password hash, and that account's throttle state. At most one exists
per StaffUser.

The application role may insert a row and may update the hash and the throttle
columns. It may not delete a row and may not change a username.

### 3. Username and password rules

A username is 3 to 32 characters of lower-case ASCII letters, digits, dot,
underscore and hyphen. What is typed is trimmed and lower-cased before it is
stored or looked up, and the stored form is constrained to lower case, so
`Budi` and `budi` are one account without a case-insensitive column type. A
username is unique across every credential row, active or not, and is never
given to another user, even after its holder is deactivated.

This deliberately differs from the PIN rule (FR-A4, a deactivated user's PIN
may be reused). A PIN is a secret that names nobody. A username is a name: it
is shown on M-6 and will be shown in the users screen, and reusing one invites
misreading history. Usernames are not scarce, so nothing is lost.

A password is 8 to 128 characters with no composition rules. It is verified
exactly as typed: no trimming, no case folding, no truncation. It is hashed
with Argon2id using the same parameter definition as the PIN, held in one
place so the two cannot drift.

Everything B-11 and B-12 say holds for a password as for a PIN. The raw value
is discarded after verification; it never enters a log, trace, metric, audit
entry, security event, error or crash report; a database error raised by the
credential table is replaced, never wrapped, because its detail can carry the
hash or the username.

### 4. The throttle

Password verification is throttled **per account**. Five consecutive failures
for one username start a five-minute cooldown for that username. Only a
successful verification of that same account resets its count. The state lives
on the credential row, so it is server-side, survives browser, application and
database restart, and cannot be reset by any cookie.

It shares nothing with the PIN throttle. A password failure never counts in
`LOGIN` or `MANAGER_APPROVAL`, and no PIN verification, successful or not,
changes a password count.

One attempt is one transaction owned by the verifying function: lock the
credential row, read the cooldown from the database clock after the lock is
held, verify, write the outcome, commit. This is the PIN throttle's protocol
(ARCH-007 questions 1 to 6) applied to a different row, and it is adopted
whole rather than restated: no window between the check and the count, every
statement under the lock on the transaction's own connection, a refused
attempt verifies nothing and writes nothing and does not extend the cooldown,
and no exported function resets a count. The count is treated as zero once a
cooldown has ended, as the owner ruled for the PIN classes on 2026-10-06.

Three things differ from the PIN throttle.

- **An unknown username has no row.** It is a failed verification, it is never
  refused as throttled, and it is counted nowhere.
- **The failure at M-6 counts on the same row** as a failure at Login for that
  account. There is one count per account, not one per screen.
- **Setting or resetting a password does not clear the count or a running
  cooldown.** Only that account's successful verification does (FR-A5b).

A failed back-office sign-in has no identified actor, at Login and at M-6
alike: an idle session names who *was* signed in, not who is typing. It is
therefore security telemetry and never an audit entry (FR-A5b, FR-J3, B-13,
ADR-007). Each failure writes one SecurityEvent, and a failure that starts a
cooldown writes one more, both in a class of their own for the back office.
The event is written after the throttle's transaction commits, so evidence
that fails to write can never refund a strike. It names no person: it carries
no StaffUser reference and **not the username that was typed**, because a
mistyped username is frequently a password typed into the wrong field.

### 5. One credential version

A StaffUser has one credential version. Deactivation, a PIN reset, and a
password set or reset each increment it, in the same transaction as the change
they accompany. Every session of that user, POS and back office, then fails on
its next authenticated request, by the comparison the session module already
makes.

A manager who changes **their own** password stays signed in to the back
office. The command that changes the password re-stamps the one session it was
made from with the new version, in the same transaction as the hash change and
the increment. Every other session of that manager ends. This is the single
place where a user-management command writes a session row; it exists only for
the acting manager's own session and is designed with the Phase 1 users
screen, which is the first code that changes a password at all.

### 6. Re-authentication at M-6

When a back-office session idles past 30 minutes, the session row is neither
released nor marked. The same manager types their password; the server
verifies it for the StaffUser the idle session names, not for a username taken
from the request; and the **same session row** is renewed with a new token.
The eight-hour absolute lifetime keeps running from the original sign-in and
is never restarted by a renewal.

The renewal succeeds only for the user the row already names, with the
credential version the row already holds. A draft preserved behind M-6 can
therefore never be resumed under another identity through this path, whatever
the client sends.

Another manager at M-6 is an ordinary sign-in: their username, their password,
their account's count, and a new session. The idled session is released first
so that it does not remain renewable, and the client discards the draft. Past
the absolute lifetime there is nothing to renew, and the manager signs in from
the login screen.

### 7. The first manager

No screen can create the first manager, because every back-office screen
requires one. The first manager is created by a command-line script run by the
owner on the host. It reads the name, PIN, username and password from the
terminal, with the two secrets not echoed and never from arguments or the
environment (both reach shell history and the process list, which is B-12 by
another door). It creates the StaffUser and the BackOfficeCredential in one
transaction through the same domain functions the users screen will use, and
prints nothing secret.

It is not seed data (B-24): it contains no name, PIN or password and creates
only what its operator types. It writes no audit entry: creating a user is not
an audited action (FR-J3), and there is no authenticated actor to name (B-13).

## Options considered

**The credential.**

- *A PIN at the back office* (the Phase 0 plan). Rejected by the owner. It
  would put the configuration and the audit viewer behind a six-digit secret
  that is observable at the POS all day, and behind a throttle that any
  cashier can reset with their own PIN. It would also make a wrong PIN at a
  manager's desk a strike against every cashier's login.
- *SSO now.* Deferred by the owner to after the MVP. It needs an identity
  provider and outbound connectivity that the loopback-only MVP has no other
  reason to depend on.
- **A username and a password.** Chosen.

**Storage.**

- *Two nullable columns on `staff_user`.* One table and one join fewer. It
  loses on four counts. Every reader of `staff_user`, including the POS PIN
  lookup, would carry a password hash within reach. The credential is expected
  to be replaced, and a superseded credential should be droppable as a table
  rather than left as dead columns on the identity record. The throttle state
  belongs beside the secret it protects, on a row a sign-in can lock without
  locking the user, which every request of that user reads. And `staff_user`
  is about to loosen for kitchen staff with no PIN; two more nullable
  credential columns and a both-or-neither check make its constraints harder
  to read than two tables are.
- **A table of its own.** Chosen.

**The throttle.**

- *The `LOGIN` class.* It changes what AC-19 means without changing its
  words. A manager mistyping a password five times would lock every cashier
  out of the POS, and five wrong PINs at the lock screen would lock the back
  office. Worse, the limit the owner accepted for PINs would spread to
  passwords: every cashier holds a valid PIN, so a cashier could guess four
  passwords for a manager's username, log in at the POS to reset the count,
  and repeat without ever starting a cooldown.
- *A third installation-wide class.* The smallest change, and it isolates
  passwords from PINs. It loses because the owner said failures count against
  an account; because one manager's typing mistakes would lock out every
  other manager; and because installation-wide counting exists only where
  there is no account to count against, which a username supplies.
- *Counting failures for unknown usernames too*, to hide which usernames
  exist. It needs a row for every name anyone types, written by callers who
  have not authenticated, and it still leaves a timing difference. Not worth
  it for a loopback-only server; see the accepted risks.
- **Per account, on the credential row.** Chosen.

**The credential version.**

- *A version per credential*, so that a PIN reset leaves the back-office
  session alone. The session would have to record which credential made it,
  and the validity check would have to choose a column by audience. That is
  more mechanism to buy a convenience nobody asked for.
- **One version.** Chosen. It over-invalidates: resetting a manager's PIN
  also ends their back-office session, and resetting their password also ends
  their POS session. A POS session lasts 90 seconds and a reset is rare and
  deliberate, so failing closed is the right way round.
- *Sending a manager who changes their own password to Login.* It needs no
  session write from a user-management command. The owner chose the other way:
  the manager stays signed in.

**Re-authentication.**

- *A new session at M-6.* The absolute lifetime would either restart at every
  idle timeout, which makes "eight hours absolute" bind only a manager who
  never pauses for thirty minutes, or be copied from the old row, which is the
  renewal written as two statements. It would also leave the same-manager
  rule to the route rather than to the statement that renews.
- *Marking a session released when it idles.* The session could not then be
  renewed, and the preserved draft would need a second session and a way to
  tie the draft to it.
- **Renew the same row, for the same manager, with a new token.** Chosen.

**The first manager.**

- *SQL typed by hand.* Not possible without the application: the PIN needs an
  Argon2id hash and a blind index keyed by a secret held outside the database,
  and the password needs an Argon2id hash.
- *A bootstrap screen shown while no manager exists.* An unauthenticated route
  that creates the most privileged user is a standing hazard for a moment's
  convenience, and the owner asked for injection by hand.
- *A script that refuses once a manager exists.* It would stop the owner
  recovering from a forgotten password before the users screen is built.
- **A script that always runs.** Chosen.

## Consequences

- The back office is no longer reachable with a secret that is typed in the
  open at the POS, and AC-19 is untouched: the two PIN classes mean exactly
  what they meant.
- One manager's mistakes cannot lock out another manager or any cashier. The
  cost is the two risks below.
- A second credential, a second throttle model and a renewal path now exist,
  each with its own race cases to test. The throttle is tested on its own row
  with the cases the PIN throttle was given, plus the isolation between the
  two.
- SecurityEvent gains an event type for a password failure and a class for the
  back office. It still holds no secret and names no person.
- Resetting either credential of a manager ends all of that manager's
  sessions. The users screen must say so before the reset is confirmed; what
  it says is the designer's.
- A manager whose role is changed keeps a session that resolves, because a
  role change does not increment the credential version. The back-office
  route guard, which requires the Manager role on every request, is what
  refuses them. Whether a role change should also increment the version is a
  Phase 1 decision.
- Recovery from a forgotten password, until the users screen exists, is a
  **new** manager made with the script. Usernames are never reused and the
  application cannot delete a credential, so the locked-out record stays,
  active, with its old PIN, until someone deactivates it.
- When SSO replaces the password, a new ADR supersedes this one. What it
  removes is the BackOfficeCredential table, its throttle and its two
  SecurityEvent values. What it keeps is StaffUser, the PIN, the session and
  its audience, the single credential version, and the M-6 renewal, none of
  which knows which credential was verified.

### Risks accepted for the MVP

The owner accepted both on 2026-10-07. Both rest on the server being
loopback-only, and both are to be reconsidered at the gate before any
networked or production use (ARCHITECTURE 3.2).

- **Usernames can be discovered.** An account that exists and has been
  attacked answers "throttled"; a name that does not exist never does. A known
  username also costs an Argon2id verification and an unknown one does not, so
  timing tells the same story. A username is not a secret, but on a network
  this is a list of whom to attack.
- **Anyone who knows a username can lock that manager out of the back
  office**, five minutes at a time, for as long as they keep typing. It is
  bounded per attempt and it denies one person rather than the restaurant,
  which the installation-wide PIN cooldown does not.
- **The first-manager script creates a manager whenever it is run** by someone
  at the host's terminal with the application's configuration, and it leaves
  no audit entry. On the MVP that person already controls the database. On a
  shared or networked host it is an unaudited route to full authority.

### Not decided here

These are product questions this record does not close.

- Whether changing one's own password requires the current password. Without
  it, an unattended signed-in back office lets a passer-by take the account
  over and lock its owner out, which the server cannot otherwise prevent.
- Whether a manager who resets their **own PIN** from the back office also
  stays signed in. The ruling names the password only; as decided, a PIN reset
  ends the session.
- Whether a role change increments the credential version.
