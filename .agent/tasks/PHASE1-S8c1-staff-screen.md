---
id: PHASE1-S8c1
title: BO-06 Staff in the back office, part 1 — the screen, the list, create in all three classifications, deactivate and reactivate, and AC-32 in the browser (plan S8, consult C3, DESIGN-023)
category: ui
touches: [identity, boundaries]
depends_on: [PHASE1-S8b]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/staff.spec.ts, e2e/support/**]
status: not-started
cycles: 0
---
# PHASE1-S8c1 — BO-06 Staff, part 1: the list, create, deactivate and reactivate

**Written** 2026-11-06 by the lead. Sources:
- slice S8 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S8*);
- **consult C3** (`.agent/reviews/ARCH-020-users-and-credentials.md`): §10 and *For the lead*, *S8c*, **copied
  verbatim below**;
- the server halves **PHASE1-S8a** and **PHASE1-S8b** (merged as #173 and #174). Their Handoffs
  (`.agent/tasks/PHASE1-S8a-users-server.md`, `.agent/tasks/PHASE1-S8b-credentials-server.md`) are the server's
  contract for you: the routes, `ROUTES` names, schemas, codes and where each is emitted;
- the design **DESIGN-023** (merged; `F/users.html` and the Handoff of `.agent/tasks/DESIGN-023-users.md`, as amended
  by its round 2), and `D`'s *Configuration forms — DESIGN-023 additions* (`docs/DESIGN.md:2168`);
- the client slice whose code this one copies most: **PHASE1-S6b** (BO-07, `.agent/tasks/PHASE1-S6b-presets-screen.md`,
  and `apps/back-office/src/presets/`).

**This is the first of two slices.** C3 planned S8c as one task; DESIGN-023 draws 126 states over nine commands and
three browser walks, more than any earlier back-office slice, so the lead split it, as BO-04 was split into S4c2a and
S4c2b. **S8c1 (this file)** builds the screen, the list, create in all three classifications, deactivate and
reactivate (with the new-PIN path), every shared state, and browser walk D1 (AC-32's POS half). **S8c2** adds the role
change (six moves), the PIN and password resets of another person, the own password and own PIN, and walks D2 and D3.
C3's *S8c* criteria below are split accordingly in *Acceptance criteria*.

Where this file and DESIGN-023 differ, this file's rulings say which wins; where they still differ, or the merged code
cannot do what this file says, stop and write `BLOCKED: <question>`.

Abbreviations: `D` = `docs/DESIGN.md`; `F/` = `docs/design/visual-directions/frost/back-office/`; **C2** =
`.agent/reviews/ARCH-019-first-back-office-form.md`; **C3** = `.agent/reviews/ARCH-020-users-and-credentials.md`.

## Objective

A signed-in manager reaches **Staff** (BO-06) from the rail, at `/back-office/staff`, and sees every person the
restaurant employs, active first and inactive second, each group in the server's creation order, with the manager's
own row marked. The manager adds kitchen staff, a cashier or a manager; deactivates another person after a named
confirmation that says, in that person's terms, which sessions end; and reactivates a person, giving a new PIN when
another active person now holds theirs. Every word comes from DESIGN-023. Every credential field is a native,
uncontrolled input, read once on submit and emptied after every response. In the browser, a cashier signed in at the
POS in another profile is signed out on their next request after the manager deactivates them (AC-32).

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-023's Handoff**, `.agent/tasks/DESIGN-023-users.md`, from `## Round 2 (lead rulings` to the end: the round 2
   rulings, then the Handoff's *Delivery and implementation boundary* (the panel-height behaviour), *Rules for S8c*
   (every rule binds for the commands this slice builds), *Exact copy and accessible names* (every product word comes
   from it, ADR-011 rule 24), *Focus and interruption contract*, and *Coverage and review states*.
3. **`D`**, *Configuration forms*: the DESIGN-017 / C2 part (from `:1486`), the DESIGN-018, -019, -020 and -022
   additions (from `:1628`, `:1788`, `:1876`, `:2043`), and the **DESIGN-023 additions** (from `:2168`: credentials
   inside a configuration form, session-ending warnings, BO-06 copy and composition).
4. **The Frost artifact**, `F/users.html` with `users.css`, `users.js`, `users-states.js`, and the shared `office.css`,
   `tables.css`, `settings.css`, `entry.css` it imports. Open it with `?state=<name>`. It is a review fixture: its
   fixture data, response chooser, simulation controls, review-only cross-client links and disclaimers are not
   product and are not copied. Port CSS only through tokens already in `docs/design/tokens/frost.css`
   (`apps/back-office/test/no-invented-values.test.ts` enforces this).
5. **PHASE1-S8a's and PHASE1-S8b's Handoffs** (paths above): *Names to carry forward*, the codes and where each is
   emitted, `DUPLICATE`'s `details.field`, and that the back-office API functions for all nine users routes already
   exist in `session/api.ts` and answer `unavailable` in the fixture session.
6. **PHASE1-S6b's task file and Handoff**, `.agent/tasks/PHASE1-S6b-presets-screen.md`: its rulings 1, 2, 14 to 18
   and 20 to 22, and its Handoff's *how it works*. **BO-06's list, panel, confirmation and state commands are BO-07's,
   without a version.**
7. **The existing back office**: `apps/back-office/src/` (`presets/`, `settings/`, `forms/`, `work/guard.ts`,
   `copy.ts`, `Rail.tsx`, `routes.ts`, `Screens.tsx`, `SignIn.tsx` for the only credential inputs so far, `session/`),
   and the tests beside them. **The browser harness**: `e2e/support/**`, `e2e/tests/presets.spec.ts`,
   `e2e/tests/identity.spec.ts` (the POS's `data-lock-state="invalidated"` and the two-profile fixture).
8. The contract, for meaning only: PRD FR-A1, FR-A3, FR-A4, FR-B3, FR-J4, AC-18, AC-32; BOUNDARIES B-11, B-12, B-13,
   B-24; ADR-011 rules 20, 24 and 25.

## Decided: do not reopen

- **The owner's rulings** (DECISIONS 2026-10-20, 10-21): kitchen staff are a classification with no PIN and no sign-in,
  not a role (FR-A1, Q9); a PIN is unique among active staff, and the refusal names no one (Q7, the accepted oracle);
  the server refuses a manager deactivating their own account, and another manager may be deactivated (Q8; no
  "last manager" rule); reactivation keeps the PIN unless another active person holds it, and then a new PIN is set
  (Q6a, FR-B3); creating a cashier or a manager is audited and creating kitchen staff is not (C3 OQ1; nothing on the
  screen says so); a name cannot be corrected and a username never changes (C3 OQ2, FR-B3).
- **The server (S8a, S8b, merged):** the nine users routes, `UserView` `{ staffUserId, name, classification, isActive,
  username }`, the list in creation order, `DUPLICATE` with `details.field` `pin` or `username` on the users routes,
  `OWN_ACCOUNT`, `USER_CHANGED`, `NOT_FOUND`. A no-op (deactivating the inactive, reactivating the active) answers the
  record and writes nothing. There is no version on any users route.
- **DESIGN-023, accepted with its round 2:** every rule of its *Rules for S8c* for the commands this slice builds,
  including the order and grouping, the own row, the former manager's retained username, the credential lifecycle,
  the deactivation confirmation and its classification-specific warning, and the reactivation conflict.
- **ADR-011 rule 25 and B-11, B-12:** a credential is in no URL, attribute, text node, storage, console line or React
  state; it is read from its native input once, at submit.
- **C2 §6 and ADR-011 rule 20:** an unknown outcome rereads and never resends; the client never infers success from a
  reread; there is no "send again" control.
- **Drafts (owner, 2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back (here: its name and classification, **never its credentials**); a different
  manager's sign-in destroys it; a reload destroys it.
- **Lengths are code points.** Count with `[...value].length`, never `value.length`. Do not write "UTF-16 units" in any
  new comment.
- **S1b's to S6b's patterns**, as merged: reuse `fieldsInError`, `work/guard.ts`, the router's guard,
  `forms/Decision.tsx`, `forms/answer.ts` and the logout confirmation as they are. Change one only if BO-06 cannot work
  otherwise, and then say why.

## Lead rulings (2026-11-06)

1. **The screen and its place.** A new `Screen` `'staff'` at **`/back-office/staff`** in `routes.ts`, rendered by
   `Screens.tsx`, with a rail entry **Staff** between Tables and Discount presets (the order DESIGN-023 drew and
   `design019.cjs` asserts: Menu, Tables, Staff, Discount presets, Settings), `aria-current="page"` when current. The
   screen's heading is *Staff*. The path names the screen and nothing else. (The design's file is `users.html` and the
   server's routes say `users`; the client path follows the visible name, as `/presets` follows *Discount presets*.)
2. **One screen model, in its own folder.** `apps/back-office/src/staff/`: `model.ts` (one model, one `workGuard`
   registration, one command slot for the whole screen, one departure decision), `Staff.tsx`, `copy.ts`, and pure
   helpers in their own files (for example `fields.ts` for the four field checks, `order.ts` for the order and counts).
   Copy the shape of `presets/model.ts` without its version; do not import it, and do not refactor it.
3. **What S8c1 renders, and what it leaves for S8c2.** Each row renders only the actions this slice builds: an active
   other person **Deactivate**; an inactive person **Reactivate**; the own row its marker *You · Signed in* and no
   action. **Change role, Reset PIN, Reset password, Change my password and Change my PIN are not rendered** (S8c2
   adds them), and no placeholder, disabled control or text stands in for them. The focus rule *Authoritative success →
   the affected row's first available action* therefore reads, in this slice: Deactivate for an active other person,
   Reactivate for an inactive one, Add person for the own row or when the row is absent. S8c2 changes it to DESIGN-023's
   full rule.
4. **The four field checks**, each in its own pure function, each refusing in the copy table's order with its exact
   sentence, each with a pair test against the contract schema S8a exported (`StaffName`, `NewPin`, `NewUsername`,
   `NewPassword` from `@pos/contracts`) over the boundary values:
   - **Name:** trim, then refuse empty, over 64 code points, then any Unicode Cc character; send the trimmed name. Write
     it new (BO-06's bound is 64; the existing name checks are 32): do not change or consolidate `menu/name.ts`,
     `settings/methods.ts` or `item/name.ts`. Boundary values: empty, spaces only, 64 and 65 code points including 64
     and 65 emoji, a tab, ESC, U+0007, U+009B, an inner space, leading and trailing spaces.
   - **New PIN:** exactly six ASCII digits, no trimming, no `maxlength` truncation, no numeric conversion. Values:
     `012345`, `12345`, `1234567`, `12 345`, full-width digits, `+12345`, an empty field.
   - **Username:** trim and lower-case ASCII letters only, then `^[a-z0-9][a-z0-9._-]{2,31}$`; the field shows the stored
     form on blur and on submit (the input's own value is set through its property, never an attribute); the request
     carries the stored form. Values: `Ab`, `abc`, 32 and 33 characters, `.abc`, `ABC.def`, `  Ana.R  `, `ana r`, a
     non-ASCII letter.
   - **New password:** 8 to 128 code points, never trimmed. Values: 7 and 8, 128 and 129 (with astral characters),
     leading and trailing spaces kept.
   The create form validates only the selected classification's fields, in displayed order (Name, New PIN, Username,
   New password), and focuses the first invalid one. A local refusal is not a response: the native input keeps its text
   for correction.
5. **The credential fields** follow `D`'s *Credentials inside a configuration form* exactly: native `<input>`,
   uncontrolled (a ref, never React state, never a `value` or `defaultValue` prop), `type="password"`, read once at
   submit. New PIN: `autocomplete="new-password"`, `inputmode="numeric"`. New password: `autocomplete="new-password"`.
   Username: `autocomplete="username"`, `autocapitalize="none"`, `spellcheck={false}`; it is not a secret but it is a
   credential name in the request, so it too is uncontrolled and read once. **Emptied** after every response (success
   and refusal included), on Cancel, Discard and unmount, on a classification change, on entry to M-6 or BO-01, on each
   M-6 mode change, and before the same manager's draft is restored; a draft restored after M-6 or BO-01 keeps the
   name and the classification and shows DESIGN-023's *Enter the credentials again…* notice. Every form declares
   `method="post"` and prevents native submission. No reveal control, no confirmation field, no echo in any notice.
6. **The list.** One table: active people first, inactive second, **each group in the order the server answered**
   (creation order). Hold the rows in server order; an answered create is appended (it is the newest); a state change
   keeps the row's creation position and moves it between groups for display only. The own row is the one whose
   `staffUserId` equals the session's `Person.staffUserId`. A manager row shows *Username: {username}*; a row whose
   classification is not `MANAGER` but whose `username` is not null is a former manager and shows *Retained username:
   {username} · No back-office access*; a kitchen row shows *Kitchen* with *No sign-in*. The counts line `{active}
   active · {inactive} inactive` and the caption are withheld unless the list read succeeded. **No reread follows an
   authoritative success.** The empty state is unreachable (the signed-in manager is always listed); if a read answers
   no rows at all, show the *only-manager* composition with Add person and no rows, and say so in the Handoff.
7. **Create.** *Add person* opens the non-modal panel with Classification on **Kitchen · no sign-in** (DESIGN-023's
   default), focus on Name. Switching the classification keeps the name, clears every credential field (even one the
   new choice also needs), shows the retained-choice notice when a previous choice is replaced, and focuses the new
   choice's first credential field, or Classification if it needs none. The request is `CreateUserRequest` with exactly
   the selected classification's fields: `{ classification: 'KITCHEN', name }`, `{ classification: 'CASHIER', name, pin
   }`, `{ classification: 'MANAGER', name, pin, username, password }`. Create carries no warning (it ends nothing).
8. **`DUPLICATE`** places its error by `details.field` only, never by guessing from the values sent: `pin` on New PIN,
   `username` on Username, each with its sentence, focus on that field (empty after the response, as every credential
   is). No reread and no holder marked: the PIN refusal names no one (Q7). A `DUPLICATE` without `details` (unreachable
   from these routes) is the general definite failure.
9. **Deactivation** opens DESIGN-023's named confirmation as a native modal `<dialog>` (*Deactivate {name}?*), with the
   classification-specific warning from the warning table (cashier, manager, kitchen), focus on *Keep active*; Escape
   and *Keep active* send nothing and return focus to that row's Deactivate; *Deactivate* sends `{ staffUserId }`. It
   follows the working-area dialog rule exactly as BO-07's deactivation confirmation does (`presets/Presets.tsx`):
   closed with its state kept at BO-01, reopened for the same manager on *Keep active*, left open and inert behind M-6,
   destroyed for anyone else. Copy that lifecycle; if you extract a shared confirmation component instead, say why.
10. **Reactivation.** *Reactivate* sends `{ staffUserId }` at once, with no confirmation and no warning. On `DUPLICATE`
    `{ field: 'pin' }` it opens that inactive person's non-modal form, *Reactivate — {name}*, with the context *Set a new
    PIN to reactivate {name}.*, an empty New PIN carrying *That PIN is already in use. Enter a new PIN to reactivate this
    person.*, focused, and the commit *Reactivate with new PIN*, which sends `{ staffUserId, pin }` once. A `DUPLICATE`
    on that resend shows the same error. A kitchen person never reaches this form (the server cannot answer it a PIN
    conflict). Nothing is ever resent automatically.
11. **Form-level refusals** (`OWN_ACCOUNT`, `USER_CHANGED`, `NOT_FOUND`) on the reactivation-PIN form follow
    DESIGN-023 exactly: the named notice, focusable and focused, Save off, *Return to staff list*; `USER_CHANGED` and
    `NOT_FOUND` reread once (`user-changed`, `user-changed-read-failed`, the two `NOT_FOUND` bodies). **On a row status
    command** (Deactivate, a plain Reactivate) these three codes are unreachable from the screen (the own row offers no
    Deactivate; a no-op answers the record; nothing deletes a person): treat each as the status command's definite
    failure, with DESIGN-023's *Something went wrong. {name} was not changed. Use its row action to try again.* and one
    reread, and say so in the Handoff. No new copy.
12. **Unknown outcomes** (`failed`, `unavailable`): one reread, never a resend. Create: DESIGN-023's *Outcome not
    confirmed* with the reread-succeeded or reread-failed body and *Your draft is kept; enter credentials again.*; the
    draft kept with credentials emptied. A status command: DESIGN-023's `unknown-deactivate` and `unknown-reactivate`
    words. A general definite failure keeps the draft (credentials emptied), focus on the first field.
13. **One form and one command per screen** (S6b ruling 16): every opener goes through the departure decision when the
    open form is dirty, pending or unknown, and simply closes a clean form; while any command is pending every opener is
    inert and a second press sends nothing; a discarded pending save shows *Waiting for an earlier save to finish.
    Nothing will be sent again.* and its late answer updates the row silently. `aria-disabled` on buttons and openers,
    never native `disabled` on them; fields use `disabled` while a save is pending. A form is dirty when its name or
    classification differs from how it opened, or when any credential field has been typed in.
14. **The working-area rules, unchanged** (S6b ruling 17): the panel is non-modal; under M-6 visible and inert; at BO-01
    hidden with the draft held; the same manager gets it back with focus where the *Focus contract* says; after each
    asynchronous reread, recheck the session gate and the open decision before presenting, and hold a finished result to
    present once on the same manager's return. **The frame's focus after a different manager signs in is not this
    task:** `OfficeApp.tsx` focuses Log out today, DESIGN-023 R2 asks for Add person, and the frame is a queued lead
    task. Do not change `OfficeApp.tsx`; test only that a different manager gets a clean screen with no draft, no notice
    and no held result.
15. **The panel's height** (DESIGN-023 *Delivery*, `D:2168` part): while a form is open, its heading, any warning and
    its commit controls stay in view; the field body scrolls inside the panel. Reproduce the behaviour, not the
    artifact's numbers or its script; use existing tokens and layout (no new size token). The browser spec asserts it
    for the create-manager form (rule 17 (b)).
16. **The read.** Every visit to BO-06 reads (one `GET`, not interactive), following S6b ruling 18: a failed visit read
    keeps a newer success; a read that began before a command was answered never undoes the answered record; the
    partial state when a command succeeds while the list read stands failed (DESIGN-023 `partial`); *Try again* repeats
    the read only. `loading`, `load-error` and `only-manager` as drawn. Fixture mode answers `unavailable` (S8a, S8b), so
    it shows the read failure; there is no fixture staff list.
17. **The credential scan in the browser** (`e2e/support/scan.ts`'s `OWN_ROUTES`, C3 *S8c* AC 6). The lead rules this
    one edit to an existing helper: the map gains **exactly** the routes this slice submits, a PIN in
    `/api/back-office/config/users/create` and `/api/back-office/config/users/reactivate`, a username and a password in
    `/api/back-office/config/users/create`, and nothing else (S8c2 adds its own). Every credential a spec types into
    BO-06 is recorded in the ledger as submitted, through a new helper beside the existing sign-in helpers, so the scan
    counts it. Credentials typed in specs are drawn as `people.ts` draws them (random, independent of the name), never
    derived.
18. **Copy** goes in `staff/copy.ts`, each string traceable to a row of DESIGN-023's copy, warning or modal tables, or to
    the shared `copy.ts` where DESIGN-023 reuses its words (departure, logout, M-6, BO-01, the general failure).
    Interpolated values are names, classifications and usernames the read or an answer returns. No zod message, server
    text or error code ever becomes visible text. A credential is never interpolated.
19. **Not built in S8c1**, though DESIGN-023 draws them: everything of rule 3's S8c2 list and its states (`move-*`,
    `pin-*`, `password-*`, `own-*`, `wrong-password-*`, `throttled-*`, `cooldown-started-*`, `unknown-pin-*`,
    `unknown-password-*`, `unknown-move-*`, `unknown-own-password`, the `duplicate-*` states of moves, resets and own
    PIN); the kitchen-emergency sentences in the confirmation, the departure decision and M-6; BO-01's held-draft
    sentence (S10); the frame's focus (ruling 14); the review-only cross-client links; the artifact's response chooser.
    Say in the Handoff that each was left out on purpose.
20. **No invented control.** A test asserts that no BO-06 state this slice renders offers a rename, a username change, a
    reveal or "show" control, a "view PIN", a confirmation field, a waiter or other role, a permissions matrix, or a
    "last manager" message, and that the own row offers no Deactivate.
21. **DESIGN-023 F3, the save prompt**, is not yours: whether Chrome or Firefox offers to save a cashier's PIN or another
    manager's password from these fields is a manual check the lead and the owner make after this slice, in headed
    browsers. Do not try to suppress a prompt beyond the `autocomplete` values above.

## C3, copied verbatim

The text below is ARCH-020's §10 and its *For the lead*, *S8c*, unedited, with headings moved down one level. §10 item 4's own-PIN sentence is narrower than PRD FR-B3; DESIGN-023 round 2 F1 follows FR-B3 (S8c2's concern). Its AC 6 map is split by ruling 17.

### 10. What design slice E2 (BO-06) must draw

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

C3's *S8c* criteria above are split: **this slice owns its 1, 2 (the reactivation half), 3 (D1), 6 (the map for create
and reactivate) and 7**; S8c2 owns 2's own-password half, 4 (D2) and 5 (D3). Each *Red* line is a mutation you apply,
observe failing for the stated reason, revert, and report. Write each test first and run it against the unchanged code.

1. **The rail and the route.** The rail reads Menu, Tables, Staff, Discount presets, Settings, with hrefs
   `/back-office/menu`, `/back-office/tables`, `/back-office/staff`, `/back-office/presets`, `/back-office/settings`; a
   press on Staff opens BO-06, marks it `aria-current="page"`, shows the heading *Staff* and sends one read. *Red:* put
   Staff after Discount presets: the rail-order test fails.
2. **Order, grouping and rows** (ruling 6). With people created in the order M. Iqbal (manager, the actor), Ana R.
   (cashier), S. Halim (kitchen), Ratna Ayu (manager), D. Putra (cashier, with a username: a former manager), R. Sari
   (cashier, inactive), B. Wibowo (kitchen, inactive), the table reads Iqbal, Ana, Halim, Ayu, Putra, then Sari, Wibowo;
   Iqbal's row carries *You · Signed in* and no action; Halim shows *Kitchen* and *No sign-in* and no PIN wording;
   Putra shows *Retained username: …* · *No back-office access*; the counts read `5 active · 2 inactive`. Deactivating
   Ana moves her to the inactive group at her creation position (Ana, Sari, Wibowo). *Red:* sort each group by name: the
   order test fails.
3. **Read states.** `loading` withholds rows and counts; a failed read shows the read-failure alert with *Try again*
   (one read, nothing else) and withholds the counts; fixture mode shows the read failure; a read of the actor alone is
   *only-manager*. *Red:* show the counts on a failed read: that test fails.
4. **The checks** (ruling 4): the four pair tests; the UI refusals in order with DESIGN-023's sentences, `aria-invalid`
   with the error in `aria-describedby`, focus on the first invalid field of the selected classification; nothing is
   sent while anything is invalid; the request carries the trimmed name and the stored username. *Red:* count the name
   with `name.length`: the 64-emoji case fails. *Red:* send the username as typed: the `ABC.def` request fails.
5. **The credential fields** (ruling 5, C3 *S8c* AC 1): every credential input is uncontrolled and has no `value`
   attribute in any state; after a success, a refusal, a classification switch, Cancel, M-6's entry and a BO-01 return,
   each is empty; a typed marker PIN, username and password appear in exactly one request body and nowhere in the DOM's
   text or attributes, `localStorage`, `sessionStorage` or the console; a restored draft keeps name and classification
   and shows the credentials notice. *Red:* hold the PIN in React state: the attribute or DOM assertion fails.
6. **Create** (ruling 7): each classification sends exactly its body; the answered row is appended to the active group,
   announced *{name} added.*, and focused per ruling 3; a classification switch keeps the name, empties the credentials,
   shows the notice and focuses per the rule; Cancel on a dirty form meets the departure decision. *Red:* keep the PIN
   across a switch from Cashier to Manager: the emptied-field assertion fails.
7. **`DUPLICATE`** (ruling 8): `{ field: 'pin' }` marks New PIN only and `{ field: 'username' }` Username only, each with
   its sentence and focus, one request per press, no reread. *Red:* place every `DUPLICATE` on New PIN: the username
   case fails.
8. **Deactivation** (ruling 9): the dialog's title and warning name the person, in that person's terms (cashier: *POS
   sessions*; manager: *POS and back-office sessions*; kitchen: no session or PIN), focus on *Keep active*; Escape and
   *Keep active* send nothing and return focus to that row's Deactivate; *Deactivate* sends one `{ staffUserId }`; the
   row moves to the inactive group, *{name} deactivated.*, focus on its Reactivate. The own row has no Deactivate.
   *Red:* use the manager's sentence for every classification: the cashier case fails.
9. **Reactivation** (ruling 10, C3 *S8c* AC 2's second half): a plain reactivation sends one `{ staffUserId }` with no
   dialog; a `DUPLICATE` `{ field: 'pin' }` opens the named form with the empty, focused New PIN and its sentence; its
   commit sends `{ staffUserId, pin }` once; a second `DUPLICATE` shows the same error; success moves the row to the
   active group, *{name} reactivated.*, focus on its Deactivate. *Red:* resend the plain reactivation automatically
   after the conflict: the request count is 2.
10. **Refusals and unknown outcomes** (rulings 11, 12): on the reactivation-PIN form, `OWN_ACCOUNT`, `USER_CHANGED` (read
    succeeded and read failed) and `NOT_FOUND` show their notices, focused, Save off, *Return to staff list*, with one
    reread for the last two; on a status command each is the definite failure with one reread; a create or a status
    command answered `failed` or `unavailable` rereads once and never resends, with each drawn variant; a definite
    failure keeps the draft with credentials emptied. *Red:* resend once after `failed`: the command count is 2.
11. **One form, one command** (ruling 13): with a dirty draft, Add person, Deactivate and Reactivate each meet the
    departure decision; with a clean form they hand over; while a command is pending every opener is inert and a press
    sends nothing; a discarded pending create shows its status and its late answer appends the row silently, without
    announcing or moving focus. *Red:* let Reactivate ignore the command slot: the count test fails.
12. **Partial** (ruling 16): a command succeeds while the read stands failed: the known rows with the answered record,
    the result announced, the counts withheld, the partial alert; *Try again* reads only. *Red:* show the plain
    read-failure copy in the partial state: that test fails.
13. **Departure, M-6 and BO-01** (ruling 14): the departure decision from Cancel, Escape, browser Back, the rail and Log
    out with a draft, and its pending and unknown bodies; M-6 over the panel (visible, inert) and over the confirmation;
    BO-01 with a draft held, returned to the same manager with name and classification kept and credentials empty;
    destroyed for a different manager; a command's result arriving while M-6 is up is held and presented once on return.
    *Red:* present the held result while signed out: the M-6 test fails.
14. **No invented control** (ruling 20), over every state the unit tests reach. *Red:* render a "Show" button beside New
    password: the test fails.
15. **In the browser** (`e2e/tests/staff.spec.ts`, both engines, the harness's rules):
    - (a) **D1, AC-32's POS half** (C3 *S8c* AC 3): `twoProfiles`; profile `a`, manager A signs in to the back office
      and opens Staff; profile `b`, cashier C signed in at the POS. A deactivates C through the confirmation (by the
      accessible names *Deactivate — {C's name}* and *Deactivate {C's name}*). C's next request in profile `b` is
      answered `UNAUTHENTICATED`, and the POS shows `[data-lock-state="invalidated"]`. The database holds C inactive
      (read through `listUsers` in `apps/server/src/domain/users.ts`). *Red:* make the client's deactivation send
      nothing (a test-only mutation): C stays signed in.
    - (b) **Create, for real.** A creates a cashier with a typed random name and PIN, and a manager with a typed name,
      PIN, a username typed with upper-case letters and leading and trailing spaces, and a password; the database holds
      both, the manager's username in its stored lower-case form; the new cashier signs in at the POS in profile `b`
      with the typed PIN, and the new manager signs in at the back office there with the stored username. While the
      create-manager form is open, Save and Cancel are inside the viewport (ruling 15).
    - (c) **Reactivation needing a new PIN.** C (deactivated) holds PIN p; a second cashier created through the domain
      takes p; A presses Reactivate on C: the form asks for a new PIN; A types q and presses *Reactivate with new PIN*:
      C is active in the database and signs in at the POS with q. Exactly one plain reactivation and one with a PIN were
      sent.
    - The credential scan (ruling 17) runs clean in each test, and passes only because the map gained exactly ruling
      17's entries. *Red:* remove the reactivate entry from the map: (c) fails the scan.
    - Assert changes, not absolute counts; nothing is deleted, so names are random per run.
16. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**, plus ruling 17's one edit to `scan.ts`'s map;
  any other edit to an existing helper's behaviour is a change to every spec: stop and ask. No change to `packages/`,
  `apps/server`, `apps/pos`, `db/` or `docs/`: if a route or schema is wrong for the screen, that is a question, not a
  fix.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: a
  builder's heredoc stopped S7b2's first round for over an hour on an approval prompt, and S8a's on one too. One simple
  command per shell call.
- Every visible word from DESIGN-023's tables or the shared copy it reuses; every style value from the Frost registry.
- Browser-test rules (ADR-011 rules 27 and 28; the 012a and 012b Handoffs): people through the harness's domain
  functions with random credentials (never `makePeople` from the server tests); requests made by the page; assertions
  on state, accessible names and codes; no screenshots or artefacts committed; sign-ins through the existing helpers so
  the credential ledger counts them; the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/back-office/test/routes.test.ts`: the manifest list gains `staff`, and `PATHS.staff` is `/back-office/staff`.
- The rail's exact text or link list, which gains *Staff* between Tables and Discount presets: `sign-in.test.tsx`,
  `settings.test.tsx`, `menu.test.tsx`, `item.test.tsx`, `menu-fixture.test.tsx`, and the presets tests that assert it
  (`presets.test.tsx`, `presets-departure.test.tsx`, `presets-fixture.test.tsx`, `presets-versions.test.tsx`,
  `presets-support.tsx`). Only the expected list changes, and any count of rail entries in a comment.
- `e2e/tests/presets.spec.ts` only if it asserts the whole rail; say so if it does.
- `e2e/support/scan.ts`: ruling 17's map entries, nothing else.
- New tests under `apps/back-office/test/` (for example `staff.test.tsx`, `staff-fields.test.ts`,
  `staff-credentials.test.tsx`, `staff-departure.test.tsx`, `staff-support.tsx`), the new spec
  `e2e/tests/staff.spec.ts`, and additions to `e2e/support/**`.
- `config-api.test.tsx` and `fixture-session.test.tsx` should **not** change: the nine users paths are already there.
- **Nothing else should change**: BO-03, BO-04, BO-05, BO-07 and BO-08's behaviour tests, `decision.test.ts`,
  `boundaries.test.tsx` and every other e2e spec stay as they are. A change anywhere else is reported in the Handoff with
  its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `e90a265` (S8a #173 and S8b #174 merged): the lead's runs of S8b's final tree: `npm run verify` 164
files, 5814 tests; `npm run test:e2e:all` 130 passed. Run `npm run db:migrate` before the server tests (nothing should
be pending). Confirm the baseline before you start and state the new counts in the Handoff. Run `npm run test:e2e:all`
yourself before you finish.

## Out of scope

- Everything ruling 19 lists, and S8c2's routes in the credential map.
- Any server, contract, migration or POS change. The frame's focus (`OfficeApp.tsx`).
- Consolidating the name checks, or the code-point comments elsewhere (queued cleanup).
- DESIGN-023 F3's manual save-prompt check (ruling 21).

## Commit and report

Commit on `agent/phase1-s8c1` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- **how it works**: the model's state, the command slot, where credentials live and when they are emptied, and **what
  S8c2 needs**: where its openers, forms and states plug in, which helpers it reuses (the field checks, the credential
  input, the refusal notices, the unknown-outcome handling), and the focus rule it must change (ruling 3);
- what was decided and on what evidence; every DESIGN-023 state this slice builds mapped to the test that shows it,
  and every one it does not mapped to ruling 19;
- tests changed and why; each red proof (mutation, failure read, reverted);
- what was found and not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

