---
id: PHASE1-S8c2
title: BO-06 Staff in the back office, part 2 — role changes, PIN and password resets, own password and own PIN, and walks D2 and D3 (plan S8, consult C3, DESIGN-023)
category: ui
touches: [identity, boundaries]
depends_on: [PHASE1-S8c1]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/staff.spec.ts, e2e/support/**]
status: complete
cycles: 0
---
# PHASE1-S8c2 — BO-06 Staff, part 2: role changes, resets and the own changes

**Written** 2026-11-09 by the lead. Sources:
- slice S8 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S8*);
- **consult C3** (`.agent/reviews/ARCH-020-users-and-credentials.md`): §2 (role changes) and *For the lead*, *S8c*,
  **copied verbatim below**; §10 is copied in S8c1's task file;
- **PHASE1-S8c1** (merged as #177): its task file `.agent/tasks/PHASE1-S8c1-staff-screen.md`, its rulings, its
  Handoff (*How it works* and **What S8c2 needs**) and its round 2. This slice extends S8c1's code; it does not
  restructure it;
- the server halves **PHASE1-S8a** and **PHASE1-S8b** (#173, #174): their Handoffs are the server's contract. S8b's
  Handoff gives **the exact answers of the current-password field**;
- the design **DESIGN-023** (`F/users.html` and the Handoff of `.agent/tasks/DESIGN-023-users.md`, as amended by its
  round 2), and `D`'s *Configuration forms — DESIGN-023 additions* (`docs/DESIGN.md:2168`).

S8c1 built the screen, the list, create, deactivate and reactivate, every shared state, and walk D1. **This slice adds
the rest of DESIGN-023:** the six role moves, the reset of another person's PIN or password, the manager's own password
and own PIN, and walks D2 and D3. With it, BO-06 and FR-B3 are built end to end.

Where this file and DESIGN-023 differ, this file's rulings say which wins; where they still differ, or the merged code
cannot do what this file says, stop and write `BLOCKED: <question>`.

Abbreviations as in S8c1: `D` = `docs/DESIGN.md`; `F/` = `docs/design/visual-directions/frost/back-office/`; **C2** =
`.agent/reviews/ARCH-019-first-back-office-form.md`; **C3** = `.agent/reviews/ARCH-020-users-and-credentials.md`.

## Objective

On BO-06, each active other person's row offers **Change role**, **Reset PIN** (a cashier or a manager) and **Reset
password** (a manager) beside Deactivate; the manager's own row offers **Change my password** and **Change my PIN**.
Each opens S8c1's non-modal panel with exactly the fields its command needs and, beside Save, DESIGN-023's warning in
that person's terms. A role change is one of six moves; a promotion to manager always sets a new password and asks for
a username only when the person has none. The own changes ask for the current password; a wrong one is placed on that
field, and the cooldown it can start is shown with its remaining wait and blocks the field until it ends. After an own
change this tab carries on signed in, and the manager's other sessions end. In the browser, a reset of another
manager's password ends that manager's session in another profile (D2), and an own password change keeps this profile
signed in and ends the manager's session in another (D3).

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **PHASE1-S8c1's task file**: its *Decided* section and rulings 2, 4, 5, 8, 11 to 14, 16 to 18 and 20 (they bind
   here too, for the new commands), and its Handoff's *How it works* and *What S8c2 needs*, then its round 2 (R1:
   credentials emptied when a command answers; R2: the panel refits after every render; R3: M-6 recovery focus).
3. **DESIGN-023's Handoff**, as for S8c1, now for every state: *Rules for S8c* (the command-field matrix, the
   classification-switch and move rules, *Change role opens with no destination chosen*, *An unknown move whose reread
   shows a change*, *The cooldown*), *Exact copy and accessible names*, the warning table, *Focus and interruption
   contract*, and *Coverage and review states*.
4. **`D`**, *Configuration forms — DESIGN-023 additions* (`:2168`), and the earlier parts as S8c1 lists them.
5. **The Frost artifact** `F/users.html` (`users.js`, `users-states.js`), for the states listed in ruling 13. It is a
   review fixture; nothing of its fixture data or response chooser is product.
6. **PHASE1-S8b's Handoff** (`.agent/tasks/PHASE1-S8b-credentials-server.md`): the four routes, *The own changes keep
   the token and issue no `csrfToken`*, and *The exact answers of the current-password field*. **PHASE1-S8a's Handoff**
   for the change-role variants' contract names.
7. **The existing code**: `apps/back-office/src/staff/` (S8c1), `copy.ts` (the shared cooldown duration formatter, used
   by BO-01 and M-6), `SignIn.tsx` and `Reauth.tsx` (how the cooldown is shown and counted down there), `session/`, and
   the tests beside them. **The browser harness**: `e2e/tests/staff.spec.ts` (D1 to D1d), `e2e/support/staff.ts`,
   `e2e/support/fixtures.ts`, `e2e/support/scan.ts`.
8. The contract, for meaning only: PRD FR-A1, FR-A3, FR-A4, FR-A5b, FR-B3, FR-J4, AC-18, AC-32; BOUNDARIES B-11, B-12,
   B-13; ADR-009 §1 to §5; ADR-011 rules 7, 9, 20, 24 and 25.

## Decided: do not reopen

- **Everything S8c1's *Decided* section lists**, and S8c1's built behaviour: the list, the command slot, the
  credential lifecycle (emptied when the command answers), the departure decision, M-6 and BO-01, the read rules.
- **The owner's rulings:** a role change ends every session of the person (Q1c); no manager removes their own manager
  role or deactivates themselves (Q8; the own row offers neither); moving to a role sets a PIN in the same command, and
  a manager's username and password; moving to kitchen removes the PIN; a former manager's login stays and never
  verifies (Q9); an own password change requires the current password, and an own PIN change keeps this back-office
  session (Q1a, Q1b); five wrong current passwords start the account's sign-in cooldown while the session continues
  (accepted 2026-10-07; C3 §4).
- **PRD FR-B3 is the authority for the own changes:** after an own password or own PIN change, "the back-office
  session the change was made from continues, and every other session of theirs is invalidated". C3 §10 item 4's
  narrower sentence for the own PIN is superseded (DESIGN-023 round 2 F1); own PIN takes the own-password warning.
- **The server (S8a, S8b, merged):** `change-role` with a strict variant per move (`KitchenToCashierRequest`,
  `KitchenToManagerRequest`, `CashierToManagerRequest`, `ManagerToCashierRequest`, `CashierToKitchenRequest`,
  `ManagerToKitchenRequest`; `username` exactly when the person has none); `set-pin` `{ staffUserId, pin }`;
  `set-password` `{ staffUserId, password }`; `own-password` `{ currentPassword, password }`; `own-pin`
  `{ currentPassword, pin }`. The own changes answer `{ user }` and set no cookie and no token: the tab carries on with
  its cookie and anti-CSRF token as they were.
- **DESIGN-023, accepted with its round 2**, for every state this slice builds.

## Lead rulings (2026-11-09)

1. **Extend, do not restructure.** Add the new forms as new `Editor.kind` values beside `create` and `reactivate`, with
   their `fieldsOf` entries and their branches in `submit`, as S8c1's Handoff describes. Reuse S8c1's field checks
   (`fields.ts`), credential inputs, refusal notices, unknown-outcome handling and emptying (`credentialEpoch`) as they
   are. Change an S8c1 helper only where this slice cannot work otherwise, and say why.
2. **The row actions, in DESIGN-023's order and names.** An active other person: *Change role*, then *Reset PIN* (a
   cashier or a manager, never kitchen), then *Reset password* (a manager only; a former manager is not a manager),
   then *Deactivate*. The own row: *Change my password*, then *Change my PIN*, and nothing else. An inactive person:
   *Reactivate* only. Accessible names `{Action} — {name}`, as the copy table gives them.
3. **The full focus rule after an authoritative success** (DESIGN-023 *Focus and interruption contract*, replacing
   S8c1 ruling 3's reduced rule): Change role if the row is active and another person's, Reactivate if inactive, Change
   my password if the own row; Add person if the row is absent. Name the target action explicitly (S8c1's Handoff
   warns that "first button" would depend on button order). S8c1's tests that assert the reduced rule are updated to
   this one.
4. **The current password.** A new check in `fields.ts`: refuse empty (*Enter your current password.*), refuse over
   1024 code points (*Use 1024 characters or fewer.*), never trim; a pair test against the contract's `CurrentPassword`
   over empty, one character, 1024 and 1025 code points including astral characters, and leading and trailing spaces
   kept. The input: native, uncontrolled, `type="password"`, `autocomplete="current-password"`, emptied by the same
   rules as every credential. A malformed current password that passes this check is the server's to count (C3 §4).
5. **The move form** follows DESIGN-023's round 2 rule exactly: it opens on the disabled first option *Choose a new
   classification*, the other choices omit the person's current classification, no credential field and no warning
   show, Save is off with *Choose a new classification before saving.*, a submission sends nothing, focus is on the
   select. Choosing a move shows exactly its fields (C3 §2's table: a PIN from kitchen; a password for every promotion
   to manager; a username only when `UserView.username` is null) and its warning; the context reads *Current
   classification: {classification}.* with its suffix. A former manager's promotion shows *Retained username:
   {username} · This username cannot change.* and asks for no username. Changing the chosen move clears every
   credential field and shows the retained-choice notice when a previous choice is replaced (S8c1 ruling 7's rule for
   a classification switch). The request is the move's variant with exactly its fields:
   `{ staffUserId, change: 'KITCHEN_TO_CASHIER', pin }`, `{ …, change: 'KITCHEN_TO_MANAGER', pin, password }` plus
   `username` only when the person has none, `{ …, change: 'CASHIER_TO_MANAGER', password }` likewise,
   `{ staffUserId, change: 'MANAGER_TO_CASHIER' }`, `{ …, change: 'CASHIER_TO_KITCHEN' }`,
   `{ …, change: 'MANAGER_TO_KITCHEN' }`, each checked against its variant schema before it is sent.
6. **The resets of another person.** *Reset PIN — {name}*: New PIN only; *Reset password — {name}*: New password only;
   each with its warning beside Save and no current password. `DUPLICATE` `{ field: 'pin' }` on a PIN reset is placed
   on New PIN with its sentence, naming no one.
7. **The warnings** are DESIGN-023's warning table, chosen by the subject's **current** classification as the list
   shows it: a cashier's PIN reset and promotion name *POS sessions*; a manager's resets, a manager's demotions name
   *POS and back-office sessions*; the two moves from kitchen say the person has no sessions now; own password and own
   PIN both say *Your other POS and back-office sessions will end on their next action. This back-office session will
   continue.* (FR-B3). The warning sits with Save, in view while the form is open (S8c1 ruling 15, round 2 R2). No
   confirmation step for any of these (DESIGN-023: each is reversible and named).
8. **The own changes** (C3 §3 and §4 as S8b built them). Body `{ currentPassword, password }` or `{ currentPassword,
   pin }`. The answers, as S8b's Handoff gives them:
   - success: *{name}'s password changed. This back-office session continues.* / *{name}'s PIN changed. This
     back-office session continues.*; the session is not touched by the client (no reauthentication, no token or cookie
     work, no reread of the session); the next command from this tab simply works;
   - `INVALID_CREDENTIALS` without details: *Incorrect current password. Try again.* on Current password, focused, empty;
   - `INVALID_CREDENTIALS` **with** `retryAfterSeconds`, and `THROTTLED`: **the same cooldown state** (DESIGN-023 round 2
     F2): the focusable notice *Password verification is cooling down* / *Wait {duration}. This is the same cooldown
     used at sign-in.*, the field error *Wait {duration} before trying your current password again.*, Current password
     and Save disabled, the commit help *Wait for the cooldown before saving.*, focus on the notice. `{duration}` is the
     server's `retryAfterSeconds`, counted down locally to zero and written by the **existing** formatter in
     `copy.ts` that BO-01 and M-6 use (no second formatter). At zero, the field and Save come back;
   - **the cooldown belongs to the signed-in manager's account:** closing and reopening an own-change form keeps the
     remaining wait; M-6 and BO-01 recovery by the same manager keeps it; a different manager's sign-in discards it
     (DESIGN-023 round 2 F4). Keep it in the screen model, keyed to the manager's `staffUserId`;
   - `DUPLICATE` `{ field: 'pin' }` on own PIN: New PIN, as on a reset;
   - `UNAUTHENTICATED`: the core ends the session as for any command (the change was not committed, S8b ruling 6);
     nothing special here;
   - unknown: the own-password copy *The list cannot show whether your password changed. For your next change, try the
     new password you chose as Current password first…*, the reread, nothing resent; the own PIN uses the ordinary
     unknown body.
9. **`USER_CHANGED`, `NOT_FOUND` and `OWN_ACCOUNT`** on a move or a reset follow S8c1 ruling 11's form-level behaviour
   (named notice, focused, Save off, *Return to staff list*, one reread for the first two). `OWN_ACCOUNT` is reachable
   only by a crafted or stale request (the own row offers no move or reset); test it with a fake answer.
10. **An unknown move whose reread shows a change** (DESIGN-023 round 2 F5): after an unknown outcome and a successful
    reread, if the person's classification, status or username differs from when the form opened, the context reads
    *When you opened this form, {name}'s classification was {opening}. The staff list now shows {current}[, inactive].
    This may be your change; it is not confirmed.*, the form is blocked as `USER_CHANGED` blocks it, focus on the
    notice. It never says the change is this save's. A reread that shows no change keeps the ordinary unknown form; a
    later successful *Try again* applies the same comparison.
11. **An unknown reset** never claims sessions ended: *The list cannot confirm the reset or whether this person's
    sessions ended.*
12. **The credential scan in the browser** (`e2e/support/scan.ts`'s `OWN_ROUTES`). The map gains: a PIN in
    `users/change-role`, `users/set-pin` and `users/own-pin`; a username in `users/change-role`; a password in
    `users/change-role`, `users/set-password`, `users/own-password` **and `users/own-pin`** (its `currentPassword` is the
    manager's password; C3 *S8c* AC 6's map left that out). Nothing else. Every credential a spec types is recorded in
    the ledger as submitted, through `e2e/support/staff.ts`'s helpers or new ones beside them.
13. **The states to build** (DESIGN-023 *Coverage*): `move-unchosen`, every `move-*`, `saving-move-*`, `saved-move-*`,
    `move-former-manager` and its saving and saved states; `pin-cashier`, `pin-manager`, `password-manager` and their
    saving and saved states; `own-password`, `own-pin` and theirs; `duplicate-pin-move-kitchen-cashier`,
    `duplicate-pin-move-kitchen-manager`, `duplicate-pin-pin-cashier`, `duplicate-pin-pin-manager`,
    `duplicate-pin-own-pin`, `duplicate-username-move-cashier-manager`, `duplicate-username-move-kitchen-manager`;
    `wrong-password-own-password`, `wrong-password-own-pin`, `throttled-own-password`, `throttled-own-pin`,
    `cooldown-started-own-password`, `cooldown-started-own-pin`; `unknown-pin-cashier`, `unknown-password-manager`,
    `unknown-move-cashier-manager`, `unknown-move-applied`, `unknown-own-password`; `invalid-currentPassword-empty`,
    `invalid-currentPassword-long`; and `own-account` reached from a move.
14. **Not built**, as in S8c1 ruling 19: the kitchen-emergency sentences; BO-01's held-draft sentence (S10); the frame's
    focus after a different manager signs in (`OfficeApp.tsx` untouched); the review-only links and response chooser.
    DESIGN-023 F3's save-prompt check stays the lead's and the owner's.
15. **No invented control** (S8c1 ruling 20), extended: no state offers a username change, a reveal, a confirmation
    field, a "view PIN", a role other than Cashier and Manager, or a "last manager" rule; the own row offers no move,
    reset or Deactivate; no move is offered towards the person's current classification.
16. **Test first, for every criterion, in this order:** write the test; run it against the code as it stands before
    your change (S8c1's merged code) and record the failing assertion **before** writing the production code; then
    write the code; then apply the criterion's *Red* to the finished code and record that failure too. Both records go
    in the Handoff. S8b's and S8c1's builders wrote their code first; S8c1's round 2 showed the order works when it is
    followed.

## C3, copied verbatim

The text below is ARCH-020's §2 and its *For the lead*, *S8c*, unedited, with headings moved down one level. The *S8c* criteria are split between S8c1 and this slice as *Acceptance criteria* says; its AC 6 map is completed by ruling 12.

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


## Acceptance criteria, each with its red proof

C3's *S8c* criteria above are split as S8c1 said: **this slice owns its 2 (the own-password half), 4 (D2), 5 (D3) and
6 (the rest of the map, ruling 12)**, and 1 and 7 for its own commands. Each *Red* is a mutation applied to the
finished code, observed failing for the stated reason, and reverted; ruling 16 also asks for the test's failure
against the code before your change.

1. **Row actions** (ruling 2): Ana R. (cashier) offers Change role, Reset PIN, Deactivate; Ratna Ayu (manager) offers
   Change role, Reset PIN, Reset password, Deactivate; S. Halim (kitchen) offers Change role and Deactivate; D. Putra
   (former manager, now a cashier) offers no Reset password; M. Iqbal (own) offers Change my password and Change my PIN
   only; an inactive row offers Reactivate only. *Red:* offer Reset password to a former manager: that case fails.
2. **The move form** (ruling 5): opening it focuses the select on *Choose a new classification* with no field, no
   warning and Save off, and a submit sends nothing, for a manager, a cashier and a kitchen person; each of the six
   moves shows exactly its fields and sends exactly its variant; a former manager's promotion asks for no username and
   shows the retained fact; changing the chosen move empties the credentials. *Red:* send `username` for a former
   manager's promotion: the body assertion fails (and the contract check refuses it).
3. **Warnings** (ruling 7): each command shows its exact sentence by the subject's current classification, beside Save
   and in view. *Red:* use the manager's sentence for a cashier's PIN reset: that case fails.
4. **Resets** (ruling 6): *Reset PIN* sends one `{ staffUserId, pin }`; *Reset password* one `{ staffUserId, password
   }`; each success announces its sentence, closes the form and focuses the row's Change role; a `DUPLICATE` on the PIN
   is on New PIN, naming no one. *Red:* send the reset password to `own-password`: the route assertion fails.
5. **The current password** (ruling 4): the pair test; the local refusals; the input's attributes; emptied with every
   credential. *Red:* trim the current password: the leading-space case fails.
6. **Own changes, the answers** (ruling 8): success announces the *session continues* sentence, closes the form,
   focuses Change my password, and the next command from the same tab is sent and answered with no sign-in in between;
   `INVALID_CREDENTIALS` without details is the plain wrong-password state; with `retryAfterSeconds`, and `THROTTLED`,
   are the cooldown state with the field and Save disabled and the wait counted down in the shared format (`5 min`,
   `4 min 59 s`, `59 s`), and they come back at zero; reopening the form keeps the wait; a different manager's sign-in
   discards it. *Red:* treat `INVALID_CREDENTIALS` with `retryAfterSeconds` as the plain wrong password: the cooldown
   case fails.
7. **Refusals and unknown outcomes** (rulings 9 to 11): `USER_CHANGED` and `NOT_FOUND` on a move and a reset (read
   succeeded and failed), `OWN_ACCOUNT` on a crafted move; `unknown-move-applied` names the opening and current
   classifications and blocks the form; an unknown move whose reread shows no change keeps the unknown form; the unknown
   reset and own-password bodies (C3 *S8c* AC 2's own-password half: an unknown own change rereads, resends nothing and
   empties the password fields). *Red:* say the change applied in `unknown-move-applied`: the copy assertion fails.
8. **Credentials** (S8c1 ruling 5 and round 2 R1, now for every new field): uncontrolled, no `value` attribute in any
   state, in exactly one request body, nowhere in the DOM, storage or console, emptied when the command answers.
   *Red:* hold the current password in React state: the attribute or DOM assertion fails.
9. **Focus** (ruling 3 and DESIGN-023's contract): each form's opening focus (the select for a move, New PIN or New
   password for a reset, Current password for an own change), after a field error, after `DUPLICATE`, after
   `INVALID_CREDENTIALS`, after the cooldown starts, after a success, after Cancel. *Red:* focus the row's first button
   after a success: the own-row case fails.
10. **No invented control** (ruling 15). *Red:* offer *Manager* in the move select of a manager: that case fails.
11. **In the browser** (`e2e/tests/staff.spec.ts`, both engines):
    - (a) **D2** (C3 *S8c* AC 4): `twoProfiles`; profile `a`, manager A at Staff; profile `b`, manager B signed in to
      the back office. A opens *Reset password — {B's name}*, sees the warning, types a new password and saves. B's next
      request in profile `b` is answered `UNAUTHENTICATED` and reaches BO-01 *Session ended* with the working area held;
      B signs in with the new password and is signed in. *Red:* make the client send the reset to nowhere (a test-only
      mutation): B stays signed in.
    - (b) **D3** (C3 *S8c* AC 5): profile `a`, A signed in to the back office; profile `b`, A signed in to the back
      office too. In `a`, A opens *Change my password — {A's name}*, types the current password and a new one, and saves.
      Profile `a` stays signed in and its next command (for example a create) succeeds with no sign-in; profile `b`'s
      next request reaches BO-01 *Session ended*. A signs in at `b` with the new password. *Red:* make the client sign
      out after an own change: profile `a` leaves the signed-in state.
    - (c) **A promotion, for real:** A promotes a cashier with no username to manager, typing a username with upper-case
      letters and a password; the database holds the role and the stored username; the promoted person signs in at the
      back office in profile `b`.
    - The credential scan runs clean in each test, and passes only because the map gained exactly ruling 12's entries.
      *Red:* remove the `own-pin` password entry and drive an own PIN change once: the scan fails.
    - M-6 in a spec: `reauthenticateAtOffice`'s `getByLabel('Password')` also matches an open form's *New password*;
      D1d worked around it inside the spec. Add a helper beside it if you need one; do not change the existing helper.
12. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**, plus ruling 12's map entries in `scan.ts`; any
  other edit to an existing helper's behaviour is a change to every spec: stop and ask. No change to `packages/`,
  `apps/server`, `apps/pos`, `db/` or `docs/`.
- **Test first, as ruling 16 says.** Record both failures for each criterion.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: one has
  stopped a builder for over an hour on an approval prompt. One simple command per shell call.
- Every visible word from DESIGN-023's tables or the shared copy it reuses; every style value from the Frost registry.
- Browser-test rules as in S8c1: random credentials drawn as `people.ts` draws them; requests made by the page;
  assertions on state, accessible names and codes; no screenshots or artefacts committed; every submitted credential
  in the ledger.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- S8c1's staff tests that assert what this slice changes by design, and only those assertions: the own row offering
  no action (`staff.test.tsx`, *the own row says You · Signed in and offers no action*), the reduced focus rule after a
  success (Deactivate focused after create, reactivation and a plain reactivation, `staff.test.tsx`), and any count of
  a row's buttons. Name each changed assertion in the Handoff with its reason.
- `e2e/support/scan.ts`: ruling 12's entries, nothing else.
- New tests under `apps/back-office/test/` (for example `staff-moves.test.tsx`, `staff-resets.test.tsx`,
  `staff-own.test.tsx`, `staff-cooldown.test.tsx`), additions to `staff-fields.test.ts` and `staff-support.tsx`, the
  new tests in `e2e/tests/staff.spec.ts`, and additions to `e2e/support/**`.
- **Nothing else should change**: BO-03, BO-04, BO-05, BO-07 and BO-08's tests, the rail and manifest tests, `decision.
  test.ts`, `boundaries.test.tsx`, S8c1's credential, departure and round 2 tests, and every other e2e spec stay as
  they are. A change anywhere else is reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `599f724` (S8c1 #177 and the lead's #176 merged): `npm run verify` 171 files, 6086 tests (the lead ran it on that commit); `npm run test:e2e:all` 140 passed (S8c1's final tree, the same code). Run `npm run db:migrate` before the server tests (nothing should be pending). Confirm the baseline before you start and state the new counts in the Handoff. Run `npm run test:e2e:all` yourself before you finish.

## Out of scope

- Everything ruling 14 lists. Any server, contract, migration or POS change. The frame's focus (`OfficeApp.tsx`).
- Renaming a person or changing a username (OQ2, FR-B3). A "last manager" rule (Q8).
- DESIGN-023 F3's manual save-prompt check.

## Commit and report

Commit on `agent/phase1-s8c2` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- how the new forms plug into S8c1's model, where the cooldown lives, and what a later credential form copies;
- what was decided and on what evidence; every DESIGN-023 state ruling 13 lists mapped to the test that shows it;
- tests changed and why, each changed S8c1 assertion named;
- for each criterion, **both** failures (before the change, and the *Red* on the finished code);
- what was found and not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verification, 2026-11-09 (before review)

The lead ran these at `6aa685b`; this note is the evidence a reviewer cannot gather (no database, no browser).

- **`npm run verify`:** exit 0; typecheck clean; 176 files, 6223 tests passed (baseline 171 / 6086).
  **`npm run test:e2e:all`:** exit 0; 150 passed, both engines (baseline 140; D2, D2b, D3, D3b, D4 on each). Output in
  `../restaurant-pos-wt/evidence/PHASE1-S8c2/lead/`.
- **Paths:** every changed path is inside `owns`. `scan.ts` gains exactly ruling 12's entries. Changed S8c1 tests: the
  own-row action count and the focus-after-success assertions (ruling 3, by design), and AC 14's banned-name pattern,
  which drops *change role*, *reset* and *change my* because they are now real controls (`show`, `reveal`, `view`,
  `rename` stay banned).
- **Test order:** the Handoff records 135 of 311 assertions failing against S8c1's merged code before production code
  was written, each on a missing control or function; six cases were added after and have no *before* failure.
- **The lead's red proof** (restored from a copy, `git status` clean after): `INVALID_CREDENTIALS` with
  `retryAfterSeconds` mapped to the plain wrong password; `staff-cooldown.test.tsx` 7 failed, 6 passed.
- **Two of the task's *Red* lines were the lead's errors**, and the builder said so (decision 9): the contract does not
  refuse a username on a former manager's promotion (the server does), and "the row's first button" is the right
  target on the own row. Its substitute mutations stand for the same defects.

**For the reviewer.** Review `development...HEAD`. Beyond the review's own reading, the lead asks for a view on:

1. **S8c1 behaviour changed** (Handoff decisions 2, 3 and 5): a form blocked by a refusal is no longer dirty; a
   `DUPLICATE` on a field the form does not show is the general failure; the warning is hidden on a blocked form.
   Is each consistent with DESIGN-023 and C2? Decision 5 in particular departs from "the warning stays with Save while
   the form is open".
2. **The cooldown** (ruling 8): one model-owned wait keyed to the manager, `performance.now` and one timer; is it
   discarded for a different manager in every path, kept across M-6, BO-01 and reopening, and does `THROTTLED` without
   details as the general failure match S8b's answers?
3. **The moves** (ruling 5, C3 §2): exactly each variant's fields, a username only when `UserView.username` is null,
   the unknown-move comparison (ruling 10).
4. **Credentials:** the current password and every new input uncontrolled, emptied on answer (S8c1 round 2 R1), in
   exactly one body; `scan.ts`'s `own-pin` password entry.
5. **D2 and D3:** do they prove C3 *S8c* AC 4 and AC 5 (B reaches BO-01 *Session ended* and signs in with the new
   password; profile `a` stays signed in and its next command succeeds while profile `b` ends)?

## Round 2: the lead's ruling on the review, 2026-11-09

The review is `.agent/reviews/PHASE1-S8c2-review.md` (Codex, one finding; its *Cleared* section settles the lead's
questions 2 to 5). Fix exactly this, test first: write each test, run it against the unchanged round-1 code and record
the failing assertion **before** changing production code; then fix. Nothing else.

- **R1 (F1, P2, accepted).** The account's cooldown deadline is recorded **when the answer arrives**, in `answered()`,
  before the presentation gate, a held departure decision or a session gate, from that moment's monotonic time plus
  the server's `retryAfterSeconds`. Presenting a held answer later shows the wait remaining to that deadline (zero if
  it has passed, so Current password and Save come back), and never starts a new one; `flush()` does not restart it.
  Announcements and focus stay held as now; the different-manager discard stays as now. Tests: (a) a cooldown answer
  arriving while the departure decision is open, the decision left open past the deadline, then *Stay*: no cooldown,
  the field and Save live; (b) the same with the decision left open for part of the wait: the remaining wait is the
  deadline less the elapsed time, not the full wait; (c) the same behind M-6 and behind BO-01, with same-manager
  recovery. *Red:* the round-1 code starts the full wait at presentation (the review's reproduction: `remaining: 300`
  after 301 s).

**The lead's ruling on question 1** (the review did not address it): the builder's decisions 2 (a blocked form is not
dirty), 3 (a `DUPLICATE` on a field the form does not show is the general failure) and 5 (the warning is hidden on a
blocked form, where Save is off and nothing can be sent) are **accepted**; the owner may overturn decision 5, which
reads DESIGN-023's "the warning stays with Save while the form is open" as applying to a form that can still save.

**How to work.** Write and Edit tools only. Run `npm run verify` on a quiet machine, and `npm run test:e2e:all` if a
spec changes; report both counts. Append a *Round 2* section to the Handoff (do not rewrite round 1), with each red's
failing assertion read against the unchanged code, ending with `DONE` or `BLOCKED: <one question>`.

## Round 2: lead review, 2026-11-09 (complete)

A lead review instead of a re-review: the one fix is the review's own, as ruled (R1), done test first. Reviewed at
`a850390`, the tree clean.

- **Diff:** `staff/model.ts` only (`answered()` records the deadline on arrival through `recordDeadline`; presentation
  calls `showCooldown`, which shows what remains or nothing, and focuses Current password when the deadline has
  passed), and the new `staff-cooldown-held.test.tsx` (six cases). No spec changed.
- **Test order:** all six new cases failed against the unchanged round-1 code, as the Handoff quotes.
- **`npm run verify`:** exit 0; 177 files, 6229 tests passed. **`npm run test:e2e:all`:** exit 0; 150 passed, both
  engines. Output in `../restaurant-pos-wt/evidence/PHASE1-S8c2/lead/round2/`.
- **The lead's red proof** (restored from a copy, `git status` clean after): the `recordDeadline` call in `answered()`
  removed; `staff-cooldown-held.test.tsx` 3 failed (the partly elapsed cases, which show the wrong remaining time), 3
  passed (the past-deadline cases, where no cooldown is shown either way, so this mutation cannot fail them; the
  builder's run against round 1 is their red).

**Verdict: complete.** `touches: identity, boundaries`: the owner looks before merge. Lead acceptance of the builder's
decisions 2, 3 and 5 stands (5 the owner's to overturn). DESIGN-023 F3, the headed save-prompt check, is still open.

## Handoff

### What was done

BO-06 Staff, part 2, is built on `agent/phase1-s8c2`. With S8c1 it completes the screen: the six role moves, the reset of another person's PIN and of another manager's password, the manager's own password and own PIN with the current-password field and the account's cooldown, and the browser walks D2 and D3. The code commit's hash is in the line above `DONE`, because a commit cannot name itself; the Handoff and the code are in the same commit and a second commit adds that one line. Paths:

- `apps/back-office/src/staff/model.ts`: five new `Editor.kind` values (`move`, `reset-pin`, `reset-password`, `own-password`, `own-pin`), their `fieldsOf` entries, their branches in `submit`, `openForm`, `setClassification` for a move, the cooldown, and the unknown-move comparison.
- `apps/back-office/src/staff/Staff.tsx`: the row actions, the move select, the Current password input, the stored-username fact, the warning beside Save, the cooldown notice, the new headings and contexts.
- `apps/back-office/src/staff/copy.ts` (every new sentence, each from a DESIGN-023 row; the duration is `waitText` from `../copy.js`, the one BO-01 and M-6 use) and `fields.ts` (`checkCurrentPassword`).
- Tests: new `staff-moves.test.tsx`, `staff-resets.test.tsx`, `staff-own.test.tsx`, `staff-cooldown.test.tsx`, `staff-refusals.test.tsx`; additions to `staff-fields.test.ts` and `staff-support.tsx`.
- E2E: `e2e/tests/staff.spec.ts` (D2, D3, D3b, D2b, D4), `e2e/support/staff.ts` (four helpers that type a form's fields and record each credential in the ledger as submitted), `e2e/support/scan.ts` (ruling 12's entries and nothing else).

### How the new forms plug into S8c1's model, where the cooldown lives, and what a later credential form copies

**Plugging in.** `Editor.kind` is now `create | reactivate | move | reset-pin | reset-password | own-password | own-pin`. `Editor` gained `subject` (the person as the list showed them when the form opened: classification, status, username), `target` (a move's chosen destination, null until chosen) and `changed` (what a reread shows after an unknown move). `fieldsOf` has one case per kind, and `moveFields` is C3 section 2's table: a PIN from kitchen, a password for every promotion to manager, a username only when `subject.username` is null. `submit` checks the fields in displayed order, then builds one request per kind inside the call that sends it and checks it with the contract (`SetPinRequest`, `SetPasswordRequest`, `OwnPasswordRequest`, `OwnPinRequest`, and `ChangeRoleRequest`, whose discriminated union validates the body against the variant its `change` names). Every opener of a row form is `model.openForm(kind, staffUserId)`, which goes through `leave` like the others. The refusal paths are S8c1's, extended: `settle` blocks any kind but create on `USER_CHANGED` and `NOT_FOUND`; `duplicate` places a conflict on a field the form shows or is the general failure; `OWN_ACCOUNT` blocks any form with no reread.

**Focus.** `FocusTarget`'s row form is `{ row, action }` with `action` one of `change-role | reset-pin | reset-password | deactivate | reactivate | change-my-password | change-my-pin`. Every row button carries `data-action`, and the view finds `tr[data-user] [data-action]`. After an authoritative success `resultOf` names the target: Change my password for an own command, Change role for an active person, Reactivate for an inactive one; the view falls back to Add person only if the button is absent. Cancel returns to the opener the form was opened from (Change my PIN returns to Change my PIN).

**The cooldown** lives in `StaffState.cooldown: { staffUserId, remaining } | null`, owned by the model. `startCooldown(staffUserId, seconds)` records the end on `performance.now()`, and one model timer redraws it at each whole-second change and sets it to null at zero; nothing is sent by it. `isCooling(state, editor)` is the single question every consumer asks: an own-change form whose `staffUserId` is the cooldown's. The view derives the notice, the field error, the disabled field, the off Save and the commit help from it, so there is no second copy of the wait in the editor. It belongs to the manager, not to a form: reopening an own form while it runs opens it held, with focus on the notice; M-6 and BO-01 recovery keep the same model; a different manager's sign-in builds a new working area and a new model, so it is discarded with no code of its own (`staff-cooldown.test.tsx` shows each). `INVALID_CREDENTIALS` with `retryAfterSeconds` and `THROTTLED` with it are one state; `THROTTLED` without it is the general failure; the wait is kept even if the form that met it was discarded while its command was out. The countdown format is `waitText`, not a second formatter.

**What a later credential form copies.** The input block for `currentPassword` in `EditorPanel` (a `ref`, no `value`, emptied by the `credentialEpoch` layout effect, read once in `submit`, `onInput` calls `credentialTyped`); an entry in `fieldsOf`; `errorId` for its error line (the id is not always `staff-{field}-error`; Current password's is `staff-current-password-error`); a branch in `submit` that builds the body from the checked values and parses it with its contract schema; an entry in `OWN_ROUTES` for each credential kind its body carries (own PIN carries a password). Nothing the manager types is in React state.

### What was decided, and on what evidence

1. **The notice of the cooldown is `role="status"` with `aria-live="off"`, focusable.** DESIGN-023 draws a focusable notice that changes every second. An alert, or a live status, would announce each tick; focus announces it once. The artifact uses `failure` styling (`data-kind="failure"`), kept.
2. **`dirty()` is false for a blocked form.** After `USER_CHANGED` on a move the chosen destination is kept, which made the form dirty, so *Return to staff list* raised the stay-or-discard decision on a form that could not be saved. S8c1's reactivation form had nothing a decision could lose. A form blocked by a refusal now leaves without asking; an unknown outcome still asks, because `uncertain()` is separate. This changes an S8c1 helper's result for no S8c1 test.
3. **`duplicate()` now refuses any conflict on a field the form does not show.** S8c1 refused only a username conflict on a form without a username. The general rule is what a move needs (a PIN conflict on a promotion from cashier is not placeable). It cannot change an S8c1 case: `staff.test.tsx` and `staff-credentials.test.tsx` pass unchanged.
4. **Choosing a move uses `setClassification`**, extended for `kind === 'move'`. A first choice from the placeholder does not show the retained-choice notice; replacing a choice does (ruling 5, S8c1 ruling 7). The select is off on a blocked form, so a blocked form's notice cannot be cleared by changing the choice.
5. **The warning is hidden on a blocked form.** DESIGN-023 says the warning stays with Save while the form is open; on a blocked form nothing will be sent, so a warning about what saving would end is false. This is my reading; it is one line in `warningOf` if the lead rules otherwise.
6. **After the wait ends, focus does not move.** DESIGN-023 says the field and Save come back at zero and says nothing of focus. Moving focus from the notice would be a surprise; the notice disappears with the field enabled.
7. **The own-password current-password pair test passes for astral characters.** `staff-fields.test.ts` checks `checkCurrentPassword` against `CurrentPassword.safeParse` over nothing, one character, 1024, 1025, astral 1024 and 1025, emoji 1024 and 1025, one space and spaces kept. They agree: zod counts code points here, as S8c1 found for `StaffName`.
8. **`ChangeRoleRequest`'s union is the variant check.** The task says "each checked against its variant schema". `safeParse` on the discriminated union validates against the variant its `change` names, which is the same check.
9. **Two statements in the task are not true of the contract, and I followed the contract.** (a) *Red 2* says the contract check refuses a username on a former manager's promotion; `CashierToManagerRequest` has `username: NewUsername.optional()`, so the schema accepts it and only the server refuses (`USER_CHANGED`). The mutation fails on the body assertion alone, which is the observation the task names. (b) *Criterion 9's Red* says focusing the row's first button after a success fails the own-row case. On the own row the first button is Change my password, which is the right target, so that mutation passes every case. The mutation I used is the real defect it stands for: drop the own case from `resultOf`, which sends focus to Change role and finds no such button on the own row. Both Reds are in the table below.

### Every DESIGN-023 state ruling 13 lists, and the test that shows it

`move-unchosen`: `staff-moves` AC 2 *the move form opens with no destination chosen* (manager, cashier, kitchen). Every `move-*` (kitchen-cashier, kitchen-manager, cashier-manager, manager-cashier, cashier-kitchen, manager-kitchen): AC 2 *each of the six moves shows exactly its fields and sends exactly its variant*. `saving-move-*`: AC 2 *a pending command holds the controls* (manager to cashier; every move shares the one Saving notice). `saved-move-*`: *success announces the change* and *a manager made from a cashier*, and each move's body test. `move-former-manager` and its saving and saved: *a former manager's promotion asks for no username*, the AC 3 warning case for D. Putra, and the success path through `sendMove`. `pin-cashier`, `pin-manager`, `password-manager`, their saving and saved: `staff-resets` AC 3 and AC 4 (the Saving notice is asserted in the Reset PIN success test). `own-password`, `own-pin`, their saving and saved: `staff-own` *the own forms open with exactly their fields* and AC 6 *the own changes, the answers*. `duplicate-pin-move-kitchen-cashier` and `-kitchen-manager`: `staff-moves` AC 2 and 9. `duplicate-pin-pin-cashier` and `-pin-manager`: `staff-resets` (parameterised over Ana R. and Ratna Ayu). `duplicate-pin-own-pin`: `staff-own`. `duplicate-username-move-cashier-manager` and `-kitchen-manager`: `staff-moves` (parameterised). `wrong-password-own-password` and `-own-pin`: `staff-own`. `throttled-own-password` and `throttled-own-pin`, `cooldown-started-own-password` and `-own-pin`: `staff-cooldown` AC 6 *the cooldown state* (each answer on each form), plus the countdown, reopening, M-6, BO-01 and different-manager cases. `unknown-pin-cashier` and `unknown-password-manager`: `staff-refusals` AC 7 *an unknown reset*. `unknown-move-cashier-manager`: *on a promotion keeps the draft…* (cashier to manager); `unknown-move-applied`: *whose reread shows a change* and the `, inactive` and Try again cases. `unknown-own-password`: `staff-own` AC 7. `invalid-currentPassword-empty` and `-long`: `staff-own` AC 5 and `staff-fields`. `own-account` from a move: `staff-refusals` AC 7 (`OWN_ACCOUNT`, with the fake answer).

### Tests changed (and why)

Each is an assertion of S8c1's reduced rule or of an own row with no action, changed by design:

- `staff.test.tsx`: *the own row says You · Signed in and offers no action* is now *…offers the two own changes; every other row offers its actions*: the own row has two buttons and the others three, two, four, three, one and one. Three focus assertions that said Deactivate after an authoritative success now say Change role (create a kitchen person, plain reactivation, reactivation with a new PIN), and their titles say so. The AC 14 helper's `not.toMatch(/^(show|reveal|view|rename|change role|reset|change my)/i)` loses `change role|reset|change my`, because those are now real controls; `show|reveal|view|rename` stay banned, and the `[data-reveal]`, confirmation-field, `select[name="role"]` and last-manager checks are untouched.
- `staff-departure.test.tsx`: one focus assertion, Deactivate to Change role after a held create is presented.
- `e2e/tests/staff.spec.ts`: D1b and D1c each asserted the Deactivate button focused after a success; both now assert Change role.
- `e2e/support/scan.ts`: ruling 12's entries and nothing else.

No assertion was weakened. Every other existing test, including `staff-credentials`, `staff-round2`, `staff-fixture`, the rail and manifest tests, `decision.test.ts` and `boundaries.test.tsx`, is unchanged and passes.

### Red proofs, both failures for each criterion

**Before the change** (every new test written first, then run against S8c1's merged code with the changed assertions already edited; the JSON report was read, not the console). 135 of 311 assertions failed: `staff-fields` 21 (`checkCurrentPassword is not a function`), `staff-cooldown` 12 of 12 (`nothing named Change my password — M. Iqbal`, `…Change my PIN…`), `staff-moves` 35 of 36 (`nothing named Change role — …`; and the row-actions cases `expected [ 'Deactivate — Ana R.' ] to deeply equal [ 'Change role — Ana R.', … ]`), `staff-own` 22 of 22 (no own buttons), `staff-refusals` 26 of 26 (no Change role, Reset PIN or Reset password buttons), `staff-resets` 14 of 15 (no reset buttons; the one that passed asserts a former manager has no password reset), `staff.test` 4 (`expected … to have a length of 2 but got +0` for the own row; `nothing named Change role — Nadia Pratiwi` and `— R. Sari` twice), `staff-departure` 1 (`nothing named Change role — Dewi Lestari`). Every failure is the missing action or the missing function, which is the right reason. I added six cases to the suite afterwards (DUPLICATE on kitchen to cashier, on a cashier's PIN reset; a plain wrong password and a THROTTLED on own PIN; an unknown cashier to manager promotion) and ran them only against the finished code, so they have no *before* failure.

**On the finished code** (each mutation applied, the failing assertions read from the JSON report, the file restored from a copy and `diff` against it empty):

| Criterion | Mutation | Failure read |
|---|---|---|
| 1 | Reset password offered to a former manager (`|| isFormerManager(person)`) | `staff-moves`: `expected [ 'Change role — D. Putra', …(3) ] to deeply equal [ …(2) ]`; `staff-resets`: `expected <button …> to be null`; `staff.test`: `expected …(4) to have a length of 3 but got 4` |
| 2 | send the retained username for a former manager (`{ username: subject.username ?? username }`) | `staff-moves`: `expected { change: 'CASHIER_TO_MANAGER', …(3) } to deeply equal { …(3) }`, and the same for kitchen to manager with a retained login |
| 3 | the manager's surfaces in every reset warning | `staff-resets`: `expected 'Ana R.’s POS and back-office sessions…' to be 'Ana R.’s POS sessions will end on the…'`, and the same for D. Putra |
| 4 | Reset password sent to the `own-password` route | `staff-resets`: `expected +0 to be 1` (the set-password count); `staff-refusals`: six USER_CHANGED, NOT_FOUND and OWN_ACCOUNT cases, whose answers were queued for `set-password` |
| 5 | trim the current password | `staff-own`: `expected 'Cur-marker-pass41' to be '  Cur-marker-pass41  '` (only the leading-space case fails) |
| 6 | treat `INVALID_CREDENTIALS` with `retryAfterSeconds` as the plain wrong password | `staff-cooldown`: seven cases, `expected '' to be 'Password verification is cooling down…'` |
| 7 | say the change applied in `unknown-move-applied` | `staff-refusals`: three cases, `expected 'When you opened this form, Ana R.’s c…' to be 'When you opened this form, Ana R.’s c…'` |
| 8 | hold the current password in React state (`value`, `onChange`, `useState`) | `staff-own`: `expected true to be false` (the `value` attribute is present) |
| 9 | drop the own case from `resultOf` | `staff-own`: two cases, `expected <button …(2)> to be <button …(3)>` (focus is not on Change my password). See decision 9(b) |
| 10 | offer every classification in a move's select | `staff-moves`: four cases, `expected [ 'Kitchen · no sign-in', …(2) ] to deeply equal [ 'Kitchen · no sign-in', 'Manager' ]` and its siblings |
| 11a D2 | the reset sent to nowhere (the client answers `ok` without sending) | Chromium: `Expected: "signed-out" Received: "signed-in"` on B's profile (B stays signed in); the scan too: `a password in 0 request bodies of its own route, but 1 were submitted` |
| 11b D3 | sign out after an own password change (`store.logout()` in an effect) | Chromium: the page status of profile `a` never appears (`element(s) not found` for `#page-status`), because profile `a` left `signed-in`; the `data-session` check that precedes it passed at that instant, so the failure is by the status the signed-out frame no longer draws |
| 11 scan | remove the `own-pin` password entry from `scan.ts`, drive D3b | `a password in a request body outside its credential route` and `a password in 1 request bodies of its own route, but 2 were submitted` |

Criteria 5 (the pair test), 8 (every input in exactly one body and nowhere else) and 12 are covered by the cases above plus `staff-fields.test.ts`. For D2 I moved the `set-password` request-count assertion after B's session check, so that the mutation fails at B's session, not earlier.

### Found and not fixed

- **No headed browser was used.** The Playwright suites (Chromium and WebKit, headless) are the only browser evidence. DESIGN-023 F3's save-prompt check stays the lead's and the owner's.
- **The act warning in `staff-credentials.test.tsx`** (`An update to Staff inside a test was not wrapped in act`) is in the output of S8c1's own test run; I did not touch it. `item.test.tsx` prints the same kind of warning.
- **`BO-06` has no row for a former manager in the kitchen** in the seven-person fixture; the kitchen-with-a-retained-login case is a local person (`T. Kusuma`) in `staff-moves.test.tsx`.
- **The contract comment in `packages/contracts/src/users.ts`** about UTF-16 (S8c1's finding) is unchanged and still wrong; the pair test here is another piece of evidence.
- **S8b's note** (`set-password` on an active manager with no credential row answers `USER_CHANGED`) is a refusal this screen places as any other: the form blocks, the list rereads.

### Real output

`npm run verify`: typecheck clean for all seven projects, then `Test Files 176 passed (176)`, `Tests 6223 passed (6223)`. The baseline, confirmed before I began, was 171 files and 6086 tests, so +5 files and +137 tests.
`npm run test:e2e:all`: `150 passed (2.6m)` (Chromium and WebKit); the baseline was 140, so five new tests on each engine (D2, D3, D3b, D2b, D4).
No formatter was run on any file; every edit was by hand. A shell here-document was not used; every file was written with the Write and Edit tools.

### What the next agent needs and does not have

- The lead's manual save-prompt check (DESIGN-023 F3) in Chrome and Firefox, for a PIN and for another person's password.
- The frame's focus after a different manager signs in (`OfficeApp.tsx` still focuses Log out), BO-01's held-draft sentence (S10), and the kitchen-emergency sentences: all ruling 14.
- Nothing is placeholder in this slice: every state ruling 13 lists is built. The cooldown's timer is the model's own (`performance.now`, `setTimeout`); its tests use vitest's fake timers for those two and the `Date`, not the session harness's clock.

The code and this Handoff are in commit `98fa2a7`; this line is added by the commit after it.

(Round 1 ended `DONE`; round 2 follows.)

### Round 2 (R1 of the review): the cooldown deadline is fixed when the answer arrives

**Test first.** `apps/back-office/test/staff-cooldown-held.test.tsx` (new, six cases, vitest fake timers for `setTimeout`, `Date` and `performance`) holds an own-password save's answer, delivers `INVALID_CREDENTIALS` with `retryAfterSeconds: 300` while the presentation is held, lets time pass, and then presents it. Run against the unchanged round-1 code, all six failed, each for the reason the review gave (the full wait starts at presentation): (a) a departure decision left open 301 s, then Stay: `expected <div id="form-notice" …> to be null` (the cooldown notice is drawn); (b) the decision open 100 s, then Stay: `expected 'Password verification is cooling down…' to be 'Password verification is cooling down…'` (the notice said 5 min, not 3 min 20 s); (c) behind M-6 and behind BO-01, each with 301 s elapsed (`to be null`) and with 100 s elapsed (the same string mismatch), all three after same-manager recovery. After the fix all six pass; the 3 min 20 s cases also show the field and Save live again once the remaining 200 s run out.

**The fix** is in `model.ts` only. `answered()` now records the deadline, `performance.now()` plus the server's seconds, as soon as an own command's answer arrives, ahead of the session branch, the presentation gate, a held decision and the reread paths, through `recordDeadline`. `currentPasswordRefused` no longer starts a wait: it calls `showCooldown`, which reads the seconds left to that deadline, shows them if any remain, and shows no cooldown (and focuses Current password, not the notice) if the deadline has passed. `flush()` and presentation never restart it. Announcements and focus stay held as before, and the different-manager discard is unchanged (the model goes with the working area). A cooldown answer for a command whose form was discarded is still recorded, as in round 1.

**Output.** `npm run verify`: typecheck clean for all seven projects, `Test Files 177 passed (177)`, `Tests 6229 passed (6229)` (round 1: 176 and 6223; +1 file, +6 tests). No spec changed, so I did not rerun `npm run test:e2e:all`; the round-1 result (150 passed) stands for the unchanged specs. No formatter was run, and every file was written with the Write and Edit tools.

The round 2 commit hash is given by `git log` on this branch.

DONE

