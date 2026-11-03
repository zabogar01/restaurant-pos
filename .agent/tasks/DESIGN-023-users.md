---
id: DESIGN-023
title: BO-06 Users in Frost (design slice E2), for S8c
category: ui
touches: [identity, boundaries]
depends_on: [DESIGN-022]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-023 — BO-06 Users (design slice E2)

**Written** 2026-11-02 by the lead. Design slice **E2** of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §1.2 gap **G5**, §4 and *S8*), the BO-06 half
of DESIGN-011's slice E (`.agent/reviews/DESIGN-011-back-office-audit.md:462`). DESIGN-017 drew the BO-05 half (merged
as PR #120). The owner ruled on 2026-10-30 that E2 starts after DESIGN-021, as the next designer task.
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design023`). The review
is Claude Opus's (the other family).
**Branch and place:** `agent/design-023`, cut from `development` at `22be697`, in the worktree
`../restaurant-pos-wt/DESIGN-023`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

Nothing is built from this task directly. A design review follows; then plan slice **S8c** (BO-06 in the back office)
is written from it, after its two server slices, **S8a** and **S8b**. **Neither server slice is built yet.** Every
server fact below comes from **consult C3**, which the owner's rulings have settled; the slices will build what it says.
Draw what it says. Where you need something it does not say, stop and ask; do not draw it.

Abbreviations, as in DESIGN-017 to -022: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C3** = `.agent/reviews/ARCH-020-users-and-credentials.md`;
**C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-009** =
`docs/decisions/ADR-009-back-office-username-and-password.md`; **ADR-011** =
`docs/decisions/ADR-011-browser-clients.md`.

## Objective

When this task is done, BO-06 has a reviewed Frost composition, `F/users.html`, in every state S8c will build, with
every word it will show (ADR-011 rule 24: the builder copies the design's words and invents none). A manager lists
staff, active and inactive; creates kitchen staff, cashiers and managers; moves a person between kitchen, cashier and
manager; resets another person's PIN or password; changes their own password and their own PIN; and deactivates and
reactivates people. The rail gains its entry for BO-06. This is the first back-office screen that takes credentials
other than at sign-in, so the credential fields and the warning before a session-ending command are the new work. The
configuration-form rules already in `D` apply as they stand.

## Required inputs

Read these, in this order.

1. **C3 §10** (*What design slice E2 (BO-06) must draw*), whole: it is this task's checklist, and it is copied into
   *Server facts* and *Rulings* below. Then C3 §2 (the six moves), §5 (own account), §6 (reactivation and a taken PIN)
   and §8 (the field names, the schemas, the nine routes, `UserView`, the codes). C3 *Stale text* item 5 (the
   inventory and sitemap wording you bring in, Part C).
2. **ADR-011 rule 25** (*Credentials in the client*, `:764-780`) and **ADR-009** §1 to §4 (a correct password verifies
   only for an active manager; a username is set once, never changed, never reused; the stored form; the throttle).
3. **`D` *Configuration forms***, all its parts: DESIGN-017 / C2 (from `D:1486`), DESIGN-018 additions (from `D:1628`),
   DESIGN-019 additions (from `D:1788`), DESIGN-020 additions (from `D:1876`), DESIGN-022 additions (from `D:2043`).
   These rules bind: the field-list placement of errors, the departure decision, the unknown outcome without a resend,
   two forms on one screen, a success while the list read stands failed, the state commands.
4. **`D` *Desktop sign-in width — DESIGN-016*** (`D:1779`) and `F/login.html`: the only Frost password fields so far.
   BO-06's password and current-password fields follow them; say where they differ and why.
5. **`F/presets.html`** (DESIGN-022) and **`F/settings.html`'s payment-methods part** (DESIGN-018), the nearest
   precedents: a list of named records with create, deactivate and reactivate, a destructive confirmation decided with
   a reason. Share rather than copy where the pattern is the same. **`F/tables.html`** (DESIGN-017) for the first form.
6. **DESIGN-011 BO-06** (`.agent/reviews/DESIGN-011-back-office-audit.md:168-186`): its P1 (subject-correct walks,
   every row's actions on its own person, kitchen rows never pictured with a PIN effect, field-level styling for the PIN
   refusal without revealing any PIN), and its S2/S3 notes (drop the "shifts and audit trails" line; the empty state's
   "add the first manager" has no meaning in a manager-only session).
7. `I` BO-06 (`:846-868`), the shared general failures (`I:83-124`), and BO-01 (`I:604`; the session-ended and idle states
   the other person's next request reaches). `S` BO-06 (`:309-313`) and **cross-client walk 4** (`S:400-401`). `P/users.html`.
8. The contract, for meaning: PRD FR-A1, FR-A3, FR-A4, FR-B3, FR-J3, FR-J4, AC-32; BOUNDARIES B-11, B-12, B-13, B-24.
9. `D`'s *Shared back-office patterns — DESIGN-012* (from `D:1335`), *Modal and sheet*, *Data table*, *Notices and
   empty states*, *Buttons (back office)*. Use `F/office.css`, `F/office.js` and `F/patterns.html` as they are; do not
   fork them.

## Server facts (consult C3; S8a and S8b not yet built)

- **The record**, `UserView`, is `{ staffUserId, name, classification, isActive, username }`. `classification` is
  `CASHIER`, `MANAGER` or `KITCHEN`. `username` is the stored username or null; it is non-null exactly when the person
  has a back-office credential row, **a former manager's included** (a demoted manager keeps the row, which never
  verifies). Nothing else is answered: never whether a PIN is set (a cashier or manager always has one, kitchen never),
  never a hash, the credential version or the throttle state.
- **The list** is one read answering every user, active and inactive, ordered by creation. There is no reorder. Choose
  the order and grouping the screen shows, and state it as a rule S8c can test.
- **The acting manager is known.** The back-office session view carries the signed-in manager's `staffUserId`, `name`
  and `username`, so the screen can tell which row is their own.
- **Fields, and their rules** (each checked by the form before sending, so the error sits on its field):
  - **name**: trimmed, 1 to 64 code points, no control character. **A name cannot be corrected** (owner, C3 OQ2): a
    mistyped name is fixed by deactivating and re-creating. There is no rename.
  - **PIN**: exactly six ASCII digits. Unique **among active users** (FR-A4).
  - **username**: the form trims it and lower-cases ASCII letters, then checks `^[a-z0-9][a-z0-9._-]{2,31}$` (3 to 32
    characters, starting with a letter or digit). It is unique among every user ever, an inactive one included, and is
    **never changed or reused** once set (FR-B3, ADR-009 §2, §3).
  - **password**: 8 to 128 code points, never trimmed.
  - **current password**: anything from 1 character; judged by the verification, not by the form.
  - Only four credential names travel: `pin`, `password`, `username`, `currentPassword`. **A confirmation field**
    (type the new password or PIN twice) is your call; if you draw one, it is compared in the client and never sent.
- **Create**, by classification: kitchen takes a **name only**; a cashier a **name and PIN**; a manager a **name, PIN,
  username and password**.
- **Change of role is a move**, one of six, each with exactly the fields it needs:

  | Move | Asks for | Effect besides the role |
  |---|---|---|
  | kitchen → cashier | a PIN | the PIN is set |
  | kitchen → manager | a PIN, a password, and a username only if the person has none | PIN and login set |
  | cashier → manager | a password, and a username only if the person has none | login set; a former manager keeps their username, with a new password |
  | manager → cashier | nothing | the login stays and never verifies |
  | cashier → kitchen | nothing | the PIN is removed |
  | manager → kitchen | nothing | the PIN is removed; the login stays and never verifies |

  **Promotion to manager always sets a new password**, even for a former manager.
- **Deactivate** takes the person; **reactivate** takes the person and **optionally a new PIN**. Without one, the person
  keeps their PIN; if another active user now holds it, reactivation is refused and must be resent with a new PIN
  (FR-B3). A kitchen person is reactivated with no PIN at all.
- **Resets of another person:** set a cashier's or manager's PIN; set a manager's password. **Own changes:** own
  password (current password and new password); own PIN (current password and new PIN). There is no standalone "set
  username and password": a login is made only where a manager is made.
- **Who ends whose sessions** (every one on the person's next authenticated request, POS and back office alike):
  deactivation, every move, a PIN reset and a password reset each end **every** session of that person. **Own PIN:** the
  manager's POS sessions end and this back-office session continues. **Own password:** every other session of the
  manager ends and this one continues. Creation and a reactivation alone end nothing.
- **Refusals:**
  - `DUPLICATE` with `details.field` `pin` or `username`: on create, a move, a reactivation, a PIN reset and own PIN.
    The PIN refusal **names no one** (the accepted oracle, ARCHITECTURE §3.2 and §16).
  - `OWN_ACCOUNT`: deactivating oneself, any move of one's own role, and the other-person PIN or password reset aimed
    at oneself. The own row offers none of these, so it is reachable only by a stale or crafted request; it still needs
    a state.
  - `USER_CHANGED`: the person is no longer what the screen showed (another manager moved, deactivated or reactivated
    them meanwhile, or a username appeared or vanished). The client rereads the list.
  - `NOT_FOUND`: the person is unknown.
  - `INVALID_CREDENTIALS` and `THROTTLED` on the current-password field of the own changes, `THROTTLED` with the
    cooldown's seconds; a wrong current password counts towards the manager's own sign-in cooldown.
  - `VALIDATION_FAILED` is a general failure (the form refuses first).
- **Audit:** every successful command except creating kitchen staff writes an audit entry naming the acting manager and
  the person (FR-J3, Q11, C3 OQ1). Nothing on BO-06 needs to show this; if the screen says it, it says nothing more.

## Rulings that bind this task

- **Kitchen is not a role** (FR-A1): a kitchen row has no PIN action and no back-office login; it is shown by its
  classification, never as "role: kitchen". Two authenticating roles only; **no waiter option**.
- **A PIN is never displayed, echoed or recoverable** (FR-A3, FR-J4, B-11, B-12): set and reset only. **No reveal
  control, no "view PIN", no masked echo** for a PIN or a password.
- **Credential fields** (ADR-011 rule 25, C3 §10 item 6): native inputs, uncontrolled, read once on submit, **emptied
  after every response, success included, and at every change of M-6's mode**. `autocomplete="new-password"` on a new
  PIN or password, `current-password` on the current password, so a browser does not offer to save a cashier's PIN as
  a site password. A credential is in no URL, attribute or text node. Draw what the person sees when a held draft comes
  back after M-6 or BO-01: the name and the move are kept, **every credential field is empty and asked for again**.
  Say so in the copy where it matters.
- **The warning before every session-ending command, at the moment of the action** (I BO-06 *Must not invent*,
  ADR-009 *Consequences*, C3 §10 item 4), in the person's own terms: what ends (POS, back office, or both), when (their
  next action), and for the own changes, that this session continues. **Whether the warning is a confirmation step is
  yours.** By the ARCH-002 test none is required, because each of these is reversible by another command. Deactivation
  is the one the lead leans towards confirming, since its effect reaches the floor (walk 4); decide each with a reason.
- **The own row** offers no deactivate and no role change; the own-password and own-PIN forms are reached from the own
  row or the frame, **never from another person's row**. Choose which, and say why.
- **Unknown outcomes** (C2's table, C3 §10 item 8): the draft kept (credentials emptied), the list reread, nothing
  resent. For the own password the reread cannot tell whether the change applied: the copy must say so, and must say
  what to try next, because a resend with the old current password is refused (and counted) if the first one applied.
  For a reset of another person, the copy must not claim that person's sessions ended.
- **A name cannot be corrected; a username never changes** (OQ2, FR-B3). Nothing on BO-06 offers either. Show the
  username in its stored lower-case form once typed. Whether a former manager's retained username shows on a cashier
  or kitchen row is yours; say why.
- **The last manager** (owner Q8): the server refuses only one's own deactivation and demotion. Deactivating or
  demoting **another** manager stays allowed. Draw no "last active manager" rule.
- **Drafts, M-6, BO-01, the departure decision, no `beforeunload`, every person named** (B-13): as `D` says. Do not
  change these rules; apply them. The frame's focus after a different manager signs in is an open question (STATE,
  DESIGN-022's focus contract): say where BO-06 wants it, and the lead decides the frame.
- **Tokens:** use the registry first. A missing value may be registered in `frost.tokens.json`, `frost.css` and `D`
  with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or weight. No success
  green.

## What to draw

### Part A — BO-06, `F/users.html`

1. **Every state, by `?state=`.** List the states you draw in the Handoff. They include:
   - **empty** is not reachable (the signed-in manager is always a row); say so, and draw instead **only the manager**:
     the list holding just the acting manager;
   - **loading**, and **failed to load** with *Try again*;
   - **the list**: kitchen staff, cashiers and managers, active and inactive, the own row marked, a former manager
     among the cashiers or kitchen;
   - **overflow**: a long list in its scroll owner, with a 64-character name and a 32-character username;
   - **create**, for each of the three classifications, including a **classification switch** in the form;
   - **change of role**, each of the six moves, including **a former manager promoted** (no username asked);
   - **PIN reset** (cashier, manager) and **password reset** (manager);
   - **own password** and **own PIN**;
   - **local invalid input**, for every field rule above, and a mismatched confirmation if you draw one;
   - **saving**, and **saved**, for each command;
   - **PIN in use** and **username in use**, on create, on a move, and the PIN on a reset and on own PIN;
   - **current password wrong**, and **throttled** with its seconds;
   - **own account refused** (`OWN_ACCOUNT`), **person changed meanwhile** (`USER_CHANGED`) with the reread, and
     **not found**;
   - **the warning** before each session-ending command, with its confirmation where you decide on one;
   - **deactivate**, then **deactivated**, and the **cross-client outcome** of walk 4 (the cashier's POS at POS-01
     *session invalidated* on their next request; a manager's back office at BO-01 *Session ended*);
   - **reactivate**, **reactivated**, and **reactivation needs a new PIN**, resent with one;
   - **general failure** with the draft kept; **outcome unknown** for a reset, a move and the own password, each with
     the reread and no resend;
   - **the departure decision**; **M-6 over the form**; **BO-01 with a draft held**, and the draft's return with its
     credential fields empty;
   - BO-06's equivalent of **a success while the list read stands failed**.
2. **Subject-correct walks** (DESIGN-011 P1). Every row's action opens that person; a refusal names the right person
   (and no one, for the PIN); a success changes the right row. A kitchen row, a cashier, another manager and the own row
   are each walked. The fixture's counts agree with the rows drawn.
3. **Copy for every state**, in final words, listed in the Handoff as a table S8c can copy: the state, the element,
   the exact text, and the accessible name where a test will drive it. Name every control a test will press:
   - the rail's BO-06 entry and the create control;
   - each row's actions (change role, reset PIN, reset password, deactivate, reactivate) and the own row's own-password
     and own-PIN entries;
   - every field of every form, by its label, with its `autocomplete` value;
   - Save and Cancel, the warning's or confirmation's controls, the reactivation's new-PIN resend;
   - the departure decision's Stay and Discard.
   S8c's browser tests drive a deactivation, a password reset of another manager after the warning, and an own-password
   change (C3 *S8c* D1 to D3); those three walks' names must be in the table.
4. **Focus:** where focus lands when each form opens, after a field error, after `DUPLICATE` (on the field it names),
   after `INVALID_CREDENTIALS` and `THROTTLED`, after `USER_CHANGED` and its reread, after a save, after Cancel, after
   a deactivate or reactivate, after the reactivation asks for a new PIN, and after a form is reopened for the same
   manager.

### Part B — patterns, in `D`

Add a short *DESIGN-023 additions* part for what BO-06 settles that a later form could reuse: the credential field in a
configuration form, and the session-ending warning are the likely ones. Mark each rule as behaviour or as BO-06 copy.
Change no existing rule. If nothing new is needed, say so in the Handoff and add nothing.

### Part C — links, rail, gallery, inventory and sitemap

1. `F/office.js`: add `users` where Frost destinations are resolved, so that the rail's entry and every link to
   `P/users.html` reach `F/users.html`. Report the `grep -c "prototype/"` count for each changed artifact, before and
   after, and confirm that no Frost back-office artifact still links to `P/users.html`.
2. Register the artifact and every state in `manifest.js` and the gallery. Write `docs/design/checks/design023.cjs`.
3. Bring `I` BO-06 and `S` BO-06 into line, using **C3 *Stale text* item 5's wording** where it gives one, and show each
   changed line in the Handoff (`git diff`):
   - `I` *Purpose*: "Manage staff: create, assign a role or the kitchen classification, change it, set and reset PINs,
     set a manager's username and password and reset the password, change one's own password and PIN, deactivate and
     reactivate."
   - `I` *States* gain: *PIN or username in use — refused*; *own account — deactivation and role change refused*; *user
     changed meanwhile — reread*; *current password wrong or throttled*; *reactivation needs a new PIN*; and the warning
     before a session-ending command. Replace *empty* if your states make it unreachable, and say why.
   - `I` *Must not invent*: "unique across users" reads "unique among active users" (FR-A4).
   - `S` BO-06 gains the role-change, password, own-password and own-PIN modals (or whatever form you choose) and a
     reactivate action.
   - `P/users.html` gains a pointer to the Frost artifact.

## Constraints

- Light only, desktop only. No waiter, no rename, no username change, no PIN or password reveal, no "last manager"
  rule, no permissions matrix, no shifts, labour or audit-trail claims (DESIGN-011 S2/S3, PRD §8), no POS operation.
- *Invent, revert, ask:* draw nothing that the inventory, the PRD, ADR-009, ADR-011, C3 or the server facts above do
  not grant.
- No credential value appears in the artifact's DOM as text or as a `value` attribute, in any state, a fixture
  included: a filled field is drawn by its input's own state, not by text.
- Every person is named (B-13). The four product documents, the ADRs, C2 and C3 are not edited.
- Do not change the shared behaviour of DESIGN-012, -013, -014 or -016 to -022, except where Part B adds rules. Their
  checks must still pass (`design012.cjs` to `design014.cjs`, `design016.cjs` to `design022.cjs`).
- **The lead runs the check scripts**, which saves your allowance and the owner's approvals. When you want a run, ask
  through Herdr (`herdr agent prompt lead "design023: please run <script>"`) and wait for the result in your pane. Do
  not run them yourself unless the lead says so. Measure in a browser at 1440×900 and 1920×1080 through the check
  script, and quote the measurements in the Handoff. Evidence goes to `../restaurant-pos-wt/evidence/DESIGN-023/runN/`,
  outside the repository.

## Tests expected to change

None outside `docs/design/`. If you register a token, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
expected prototype-link counts in earlier check scripts may change for Part C. Change only those expectations, say so,
and weaken no assertion.

## Acceptance criteria

1. `F/users.html` imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=` and
   registered. A missing state fails this.
2. The Handoff maps every `I` BO-06 state (as amended), every ruling above, every item of C3 §10 and every item of
   Parts A to C to the state or walk that shows it, and gives the copy table of Part A item 3.
3. The Handoff states each of these as a rule S8c can test:
   - the field rules as the forms check them, including the username's normalisation;
   - which fields each create and each move asks for, and what the form does on a classification switch or a change
     of move (which typed values are kept; credentials are never kept);
   - the list's order and grouping, and how the own row and a former manager are shown;
   - the warning before each session-ending command, and which are confirmations, with the reason;
   - where `DUPLICATE`, `INVALID_CREDENTIALS`, `THROTTLED`, `OWN_ACCOUNT`, `USER_CHANGED` and `NOT_FOUND` are placed;
   - when every credential field is emptied.
4. Shown in the browser:
   - a kitchen row with no PIN or login action, beside a cashier and a manager;
   - each of the six moves, with exactly its fields;
   - *PIN in use* naming no one, and *username in use*;
   - deactivate, its warning, the result, and walk 4's cross-client outcome; reactivate, and reactivation needing a new
     PIN;
   - own password with a wrong current password, then throttled;
   - M-6 over a form, with the form inert, and the held draft's return with its credentials empty;
   - BO-01 with a draft held.
5. No state offers a waiter, a rename, a username change, a reveal, a "view PIN" or a last-manager rule; the own row
   offers no deactivate and no role change; no credential value is in the DOM (the check asserts it).
6. Measurements at 1440×900 and 1920×1080 show no horizontal overflow at the longest name and username.
7. No raw colour, size or weight; any new tokens registered and listed; `npm run verify` green if anything under
   `docs/design/tokens/` changed. The earlier checks pass.
8. The Handoff lists every question raised and not ruled, each with a proposed answer, and anything S8c must know.

## Out of scope

- The POS side of a deactivation beyond walk 4's existing POS-01 state; POS-01's own design. BO-01 and BO-02's own
  design (DESIGN-016). The audit viewer's rendering of user entries (BO-12). The server. Building anything.

## Reporting

Commit on `agent/design-023` only, with path-scoped `git add`, after verify is green where it applies, and never push.
Commit as you finish each part, so the work survives an allowance limit. Write the Handoff below in full prose, ending
with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design023: DESIGN-023 done — <one line>"
    herdr agent prompt lead "design023: BLOCKED — <question>"

## Handoff

