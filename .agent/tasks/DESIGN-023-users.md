---
id: DESIGN-023
title: BO-06 Users in Frost (design slice E2), for S8c
category: ui
touches: [identity, boundaries]
depends_on: [DESIGN-022]
owns: [docs/design/**, docs/DESIGN.md]
status: review
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

## Lead rulings during the task (2026-11-03)

- **R1, `design019`'s rail list.** Part C's rail entry necessarily changes `design019.cjs`'s F5 expected rail, as
  DESIGN-022's presets entry did. That one expected array may become `["Menu","Tables","Staff","Discount
  presets","Settings"]`, with nothing else in the file changed. It is named in the Handoff beside `design014`'s
  report-detail prototype count (four to three).
- **R2, focus after a different manager signs in.** BO-06 focuses **Add person** (a clean screen, no draft held), as BO-07
  focuses New preset. The shared frame (`OfficeApp.tsx`) is a later build task: state BO-06's target in the Handoff's
  focus rules, and draw nothing in `office.js` for it.

## Handover (lead, 2026-11-03): finish the Codex designer's draft on Claude Opus

The Codex designer (`design023`, `gpt-6-astra`) reached its usage limit after drawing Parts A to C. On the owner's word
the task is finished by a Claude Opus designer, `design023c`, and reviewed by Claude Opus (owner exception, 2026-11-03).

**Where it stopped.** Part B is committed (`ac892e2`). Parts A and C are drawn and **on disk, uncommitted**:
`F/users.html`, `F/users.css`, `F/users.js`, `F/users-states.js`, `docs/design/checks/design023.cjs` (new);
`F/office.js`, `F/report-detail.html`, `docs/design/visual-directions/index.html`, `manifest.js`, `P/users.html`,
`SCREEN-INVENTORY.md`, `SITEMAP.md`, `design014.cjs`, `design019.cjs` (changed); and this file's Handoff below, a draft.
Late in the work it also changed BO-06's long forms to measure the available panel height and scroll the fields, so
that the warning and the footer (Save) stay in view, with a new viewport assertion; no shared CSS changed.

**The lead's runs on that tree** (evidence in `../restaurant-pos-wt/evidence/DESIGN-023/`):
- run1: `design012`, `013`, `014` (failures and errors empty), `design016` 399/399, `design018` 733/733, `design020`
  754/754, `design021` 543/543, `design022` 691/691; `npm run verify` 151 files / 5497 tests. Failed then, fixed since:
  `design023` (a hidden fixture chooser timed out), `design017` 349/350 (`[ACTION]` in the sitemap), `design019`
  995/998 (the rail list, R1). The Impeccable detector: 8 *cramped-padding* warnings, all on shared classes
  (`table-editor`, `office-dialog`, `office-emergency`, `office-notice`), none on `users.css`.
- run2: `design023` **1866/1866**, 122 states; `design017` **350/350**.
- run3: `design019` **998/998** with R1's one-line change.

**What is left, in this order:**
1. Read the task above and the draft. Do not redesign; check the drawn states, the copy table and the rules against the
   task, C3 §10 and the rulings, and fix only what is wrong or missing. Say what you changed and why.
2. Commit Parts A and C as their own commits, path-scoped.
3. Bring the Handoff up to date: replace *Validation, measurements and unresolved questions* with the runs above and
   the final run's results and measurements; name the two earlier-check changes (R1, `design014`); record R2 in the
   focus rules; say what the panel-height change does and why; say the detector's warnings are on shared classes and
   were not forked away.
4. Ask the lead for the final run (`design023` and every earlier check, and `npm run verify` if anything under
   `docs/design/tokens/` changed), quote it, and end with `DONE`.

## Lead verify (2026-11-03)

For the reviewer, who cannot run a browser or the design checks. At `e65b1bf`, the tree clean:

- `git log development..HEAD`: `736112d` (task file), `ac892e2` (Part B), `67c62be` (R1, R2, handover), `51f2d5a`
  (Part A), `a02f699` (Part C), `e65b1bf` (Handoff). `git diff --name-only development...HEAD`: every path is under
  `docs/design/`, `docs/DESIGN.md` or this task file; nothing under `apps/`, `packages/`, `db/`, `e2e/` or
  `docs/design/tokens/`. `git diff --check`: trailing whitespace only, on blank context lines inside the Handoff's diff
  excerpt.
- **run4, run by the lead at `a02f699`** (the Handoff's last commit changes only this file), evidence in
  `../restaurant-pos-wt/evidence/DESIGN-023/run4/`: every script exit 0, failures and errors empty. `design023`
  1874/1874 over 122 states; `design012` 421 checks; `design013` 371; `design014` 287/287; `design016` 399/399;
  `design017` 350/350; `design018` 733/733; `design019` 998/998; `design020` 754/754; `design021` 543/543; `design022`
  691/691. `npm run verify` (run1, before the finishing pass): 151 files, 5497 tests; nothing it covers changed since.
- The earlier-check changes are exactly the two the Handoff names: `design019.cjs` one expected array (R1) and
  `design014.cjs` one count (four to three), both seen in `git diff`.
- **The Handoff was read whole.** Two points for the reviewer to judge: *Rules for S8c* gives the current-password
  limit as "at most 1024 UTF-16 units", but zod 4.6.5 counts code points (a known defect elsewhere in the repo); and
  the sitemap's new `[MODAL] Depart — Stay or Discard` node cites "C2", which reads as FR-C2 rather than consult C2.
- **Authorship:** Parts A to C were drawn by Codex (`design023`); the finishing pass and the Handoff are Claude Opus's
  (`design023c`). The review is Claude Opus by the owner's exception (DECISIONS 2026-11-03).

## Handoff

### Delivery and implementation boundary

The Frost composition is `docs/design/visual-directions/frost/back-office/users.html`.
It uses `office.css`, `office.js`, `entry.css`, `tables.css` and `settings.css`
unchanged except for the requested Staff destination and rail registration in
`office.js`. `users.css`, `users.js` and `users-states.js` supply BO-06's local
composition and review walks. These are illustrative records and responses,
not authentication, server code or seeded restaurant configuration. S8a and S8b
remain prerequisites for S8c. No production path, token or accepted ADR changed.
The independent design review remains the next gate.

Part A provides the list, forms, confirmations, refusals, recovery and session
walks below. Part B appends DESIGN-023 additions to `docs/DESIGN.md` without
rewriting an existing rule. Part C registers every state in the gallery, resolves
Staff destinations to Frost, adds the wireframe pointer, updates inventory and
sitemap, and supplies `docs/design/checks/design023.cjs`. Two earlier-check
expectations change, and nothing else in either file: `design019.cjs`'s F5
expected Phase 1 rail becomes `["Menu","Tables","Staff","Discount
presets","Settings"]` (lead ruling R1), and `design014.cjs`'s authored
prototype-link count for report-detail falls from four to three, because its
Staff link now reaches `users.html`. Both assertions are retained.

**The panel-height change.** BO-06's longest forms (create manager, kitchen to
manager, own password with a refusal notice) are taller than the 1440×900
content pane. The shared non-modal panel would then push the session warning
and Save below the fold, so a manager could press Save without having seen the
warning that is the reason it needs none. `users.js` therefore measures the
space from the panel's top to the content pane's bottom (less that pane's own
bottom padding) and sets it as the panel's `max-height`, on open, on resize and
on scroll; `users.css` makes the panel a column whose field body scrolls while
the heading, the warning and the footer stay in view. This is measured geometry,
not a new size token, and no shared CSS changed. `design023.cjs` asserts it in
every state at both sizes ("commit controls visible"). S8c should reproduce the
behaviour, not the number: the warning and Save are always in view while a form
is open.

**Finishing pass (design023c, Claude Opus).** Checked against the task, C3 §10
and the rulings; three things were wrong and were fixed, nothing redesigned:

1. *Session warnings named surfaces a cashier does not have.* Every warning for a
   cashier said “POS and back-office sessions”. A cashier has POS sessions only;
   the task asks for the person's own terms (what ends: POS, back office, or
   both), and Part B's rule says to name the affected surfaces. The warning now
   says “POS sessions” for a cashier and “POS and back-office sessions” for a
   manager. The inventory's two BO-06 lines that said the same were corrected.
2. *Walk 4's review links ignored the person.* After deactivating a kitchen
   person the fixture offered “Cashier's POS — session ended”, and a cashier's
   deactivation also offered the manager's BO-01 link. The links now follow the
   classification: none for kitchen, POS-01 for a cashier, POS-01 and BO-01 for a
   manager (DESIGN-011 P1, subject-correct walks).
3. *The cooldown used a different format from sign-in.* BO-06 said “Wait 300
   seconds” (and would reach “1 seconds”) while claiming to be “the same cooldown
   used at sign-in”, which BO-01 and M-6 show as “5 min”, “4 min 59 s”, “59 s”
   (`D`: omit zero minute and second parts). BO-06 now uses that formatter.

Each fix is asserted in `design023.cjs` (subject-correct warnings for a cashier
reset, move and deactivation and a manager deactivation; walk-4 links for each
classification; the cooldown format).

### Rules for S8c

The list groups active before inactive, preserving the server's creation order
within each group (the server breaks creation-time ties by identity). An
answered create appends at the end of the active group; a state change preserves
its underlying creation position. Counts include all returned rows. A failed
read withholds counts. A success while that read still fails draws the known
rows including the answered row and the partial-list warning. No list reread
follows authoritative success. There is no search, sort, reorder or staff number.

M. Iqbal is the initial actor. The own row says “You · Signed in” and offers only
Change my password and Change my PIN. These own changes live on the own row,
where the subject is explicit and the actions cannot be confused with a reset
of someone else. Kitchen is labelled “Kitchen” with “No sign-in”, never a role
with permissions. A former manager shows the retained username and “No
back-office access”; it explains why promotion does not ask for a new username.
The empty state is unreachable because the active manager is always in the list.
`only-manager` draws the real minimum: one manager and Add person.

The following is the complete command-field matrix. Name and credentials appear
in this order; Classification is a separate native select for create and move.
No confirmation field is drawn: typing a secret twice would add work to a
reversible operation. The session warning already makes each change explicit.
A username is asked only when UserView.username is null.

| Command | Fields | Other information and effect |
|---|---|---|
| Create kitchen | Name | Classification = Kitchen; no credential fields. |
| Create cashier | Name, New PIN | Classification = Cashier. |
| Create manager | Name, New PIN, Username, New password | Classification = Manager. |
| Kitchen → cashier | New PIN | Set a PIN. |
| Kitchen → manager | New PIN, Username if absent, New password | Set PIN and login; retained username is a fact if present. |
| Cashier → manager | Username if absent, New password | Keep PIN; always set a new password. |
| Manager → cashier | None | Keep PIN; retained login no longer verifies. |
| Cashier → kitchen | None | Remove PIN. |
| Manager → kitchen | None | Remove PIN; retained login no longer verifies. |
| Reset another cashier/manager's PIN | New PIN | No username or current password. |
| Reset another manager's password | New password | No current password. |
| Change own password | Current password, New password | This back-office session continues; every other session ends on its next action. |
| Change own PIN | Current password, New PIN | POS sessions end on their next action; this back-office session continues. |
| Deactivate | None | Named confirmation. |
| Reactivate | None initially | Immediate row command, keeping PIN; kitchen never has a PIN. |
| Reactivate after PIN collision | New PIN | Reactivate with new PIN sends one explicit command with that PIN. |

Name is trimmed, 1–64 Unicode code points, with no Unicode Cc character. Its
spelling cannot be changed after saving. A PIN is exactly six ASCII digits;
there is no maxlength truncation or numeric conversion. Username is trimmed
and ASCII A–Z lowercased before validation, and the native field shows that
stored form on blur and submit. Validate `^[a-z0-9][a-z0-9._-]{2,31}$`.
It can never be changed or reused, including for inactive people. New passwords
are 8–128 Unicode code points, never trimmed, without composition rules.
Current password is nonempty and at most 1024 UTF-16 units (C3 §8's request
shape), otherwise judged by verification rather than new-password policy.
Validate only the selected classification/move's fields, in displayed order.
Local errors send nothing. Editing a field removes its obsolete error and
aria-describedby error reference. DUPLICATE uses details.field, never guesses
from the submitted values and never names a PIN holder.

Every credential field is native and uncontrolled. Read its value once at
submit; keep no React state, fixture command ledger secret, URL, storage, text
echo or value attribute. New PIN and password use password inputs; no reveal
control exists. Username is public account identity in UserView and is shown
on saved rows, as C3 requires; typed credentials are not echoed in notices.
Every form declares POST, prevents native submission and has a form-action
none backstop. The local fixture never sends any request.

Clear every credential field after every response, success and refusal
included; on Cancel/Discard/unmount; on a classification or move change;
on entering M-6 or BO-01; on each M-6 mode change; and before restoring the
same manager's draft. A local invalid-input result is not a server response:
the native input keeps its own text for correction. Switching classification
keeps the non-secret name and selected choice, but clears all credentials,
even those also needed in the new choice. Switching back restores none.
A held response is not lost when inputs clear. No session recovery resends.

Deactivation confirms, because removing a person can interrupt floor work.
Keep active is the safe initial focus and Escape means Keep active. Resets,
each move, own changes and credential-bearing reactivation have their warning
beside Save and no additional modal: all are reversible, and another modal
would repeat an already named decision. Plain reactivation ends no session and
needs no confirmation. Kitchen deactivation mentions no PIN effect or session
invalidation. No “last manager” restriction is drawn.

USER_CHANGED rereads once and preserves the non-secret choices against their
original subject. It does not silently change the origin of a move or expose
credentials. Save stays disabled; Return to staff list lets the manager choose
an action on the current person. NOT_FOUND also rereads and offers that path.
OWN_ACCOUNT refuses at form level and points to the own-row entries. General
failure keeps the form and permits a fresh explicit Save with re-entered
credentials. Unknown outcomes reread once, keep the form and remain unknown
even after a successful read retry. Resets never claim sessions ended on an
unknown answer. Own-password uncertainty explicitly says the list cannot
resolve it, and explains which password to try at a subsequent change. The
ordinary Save is the only command path; there is no automatic or separate resend.

### Exact copy and accessible names

Braces below are substitution slots, not literal UI text. `{name}` is the
subject's full saved name; `{classification}` is exactly Kitchen, Cashier or
Manager; `{username}` is the stored lower-case username; `{duration}` is the
remaining server-supplied wait (`retryAfterSeconds`), decremented locally to
zero and written as BO-01 and M-6 write it: whole minutes as “{m} min”,
remaining seconds as “{s} s”, a zero part omitted (“5 min”, “4 min 59 s”,
“59 s”). The table is the
copy contract, including the three S8c browser walks D1–D3. Where no separate
accessible name is listed, visible text is the accessible name. No fixture-only
response chooser is part of S8c's UI.

| State / scope | Element | Exact text | Accessible name / autocomplete |
|---|---|---|---|
| Frame / all | Rail entry; screen heading | Staff | Staff |
| List / only-manager | Create control | Add person | Add person |
| List | Intro | Cashiers and managers sign in. Kitchen staff have no PIN and do not sign in. | — |
| List | Counts | {active} active · {inactive} inactive | — |
| List | Caption | Active first · Oldest created first within each status | — |
| List | Column headings | Person; Classification; Status; Actions | Same as visible |
| Own row | Marker | You · Signed in | — |
| Kitchen row | Classification detail | No sign-in | — |
| Manager row | Account fact | Username: {username} | — |
| Former manager row | Account fact | Retained username: {username} · No back-office access | — |
| Rows | Status | Active; Inactive | — |
| Active other row | Role opener | Change role | Change role — {name} |
| Active cashier/manager | PIN opener | Reset PIN | Reset PIN — {name} |
| Active other manager; D2 | Password opener | Reset password | Reset password — {name}; D2: Reset password — Ratna Ayu |
| Active other row; D1 | Deactivate opener | Deactivate | Deactivate — {name}; D1: Deactivate — Ana R. |
| Inactive row | Reactivate opener | Reactivate | Reactivate — {name} |
| Own row; D3 | Own password opener | Change my password | Change my password — {name}; D3: Change my password — M. Iqbal |
| Own row | Own PIN opener | Change my PIN | Change my PIN — {name} |
| Create | Form heading | Add person | Add person (non-modal dialog) |
| Move | Form heading | Change role — {name} | Same as visible |
| Reset | Form heading | Reset PIN — {name}; Reset password — {name} | Same as visible |
| Own change | Form heading | Change my password — {name}; Change my PIN — {name} | Same as visible |
| Reactivation PIN | Form heading | Reactivate — {name} | Same as visible |
| Create | Context | Create a named person. Choose the classification before entering credentials. | — |
| Move | Context prefix | Current classification: {classification}. | — |
| Promotion | Context suffix | Promotion always sets a new password. | — |
| Move to kitchen | Context suffix | The PIN is removed. | — |
| Move to cashier | Context suffix | The POS PIN is set. / The POS PIN is kept. | Set from kitchen; kept from manager |
| Reset / own change | Context | {name} · {classification} | — |
| Reactivation PIN | Context | Set a new PIN to reactivate {name}. | — |
| Create and move | Select label | Classification | Classification / off |
| Create and move | Select choices | Kitchen · no sign-in; Cashier; Manager | Same as visible; move omits current classification |
| Create | Classification help | Kitchen needs a name only. Cashiers need a PIN. Managers also need a back-office login. | — |
| Move | Classification help | Choose the new classification. Changing this choice clears every credential field. | — |
| Former manager promotion | Read-only fact | Retained username: {username} · This username cannot change. | — |
| Every create | Field label / help | Name / 1–64 characters. Check the spelling: a name cannot be changed after saving. | Name / off |
| Create cashier/manager; moves from kitchen; PIN resets; own PIN; reactivation PIN | Field label / help | New PIN / Exactly six digits, 0–9. PINs must differ among active staff. | New PIN / new-password |
| Create manager; promotion without retained username | Field label / help | Username / 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit. It can never be changed or reused. | Username / username |
| Create manager; every promotion; password reset; own password | Field label / help | New password / 8–128 characters. Spaces count and are kept exactly as typed. | New password / new-password |
| Own password and own PIN | Field label / help | Current password / Enter your current back-office password. | Current password / current-password |
| All command forms except reactivation PIN | Commit / cancel | Save; Cancel | Save; Cancel |
| Reactivation PIN | Commit / cancel | Reactivate with new PIN; Cancel | Same as visible |
| Resting form | Commit help | Nothing is sent until you save. | — |
| Saving | Commit help | Wait for the save result. | — |
| Credential clearing | Retained-choice notice | Enter the credentials again. The name and classification choices are kept. | — |
| Invalid name | Field error | Enter a name. / Use 64 characters or fewer. / Remove control characters from the name. | Name with associated error |
| Invalid PIN | Field error | Enter exactly six digits, 0–9. | New PIN with associated error |
| Invalid username | Field error | Use 3–32 characters: a–z, 0–9, dot, underscore or hyphen. Start with a letter or digit. | Username with associated error |
| Invalid new password | Field error | Use 8–128 characters. Spaces count. | New password with associated error |
| Invalid current password | Field error | Enter your current password. / Use 1024 characters or fewer. | Current password with associated error |
| DUPLICATE PIN | Field error | That PIN is already in use. Choose a different PIN. | New PIN with associated error |
| DUPLICATE username | Field error | That username is already in use. Choose another username. | Username with associated error |
| DUPLICATE reactivation PIN | Field error | That PIN is already in use. Enter a new PIN to reactivate this person. | New PIN with associated error |
| INVALID_CREDENTIALS | Field error | Incorrect current password. Try again. | Current password with associated error |
| THROTTLED | Field error | Wait {duration} before trying your current password again. | Current password with associated error |
| THROTTLED | Notice title / body | Password verification is cooling down / Wait {duration}. This is the same cooldown used at sign-in. | Focusable notice |
| THROTTLED | Commit help | Wait for the cooldown before saving. | — |
| Loading | Status | Loading staff… | status |
| Load failed | Title / body / action | Staff could not be loaded / Try again to read the staff list. / Try again | Try again |
| Partial success | Title / body / action | The staff list may be out of date / The rows below are the ones this page knows, including your latest change. Try again to read the full list. / Try again | Try again |
| Saving form | Title / body | Saving… / Wait for the result. Your draft is kept. | Focusable status |
| Pending status command | Page status | Deactivating {name}… / Reactivating {name}… | Focusable status |
| Saved create | Page result | {name} added. | status |
| Saved move | Page result | {name} changed to {classification}. | status |
| Saved other reset | Page result | {name}’s PIN changed. / {name}’s password changed. | status |
| Saved own change | Page result | {name}’s PIN changed. This back-office session continues. / {name}’s password changed. This back-office session continues. | status |
| Deactivated / reactivated | Page result | {name} deactivated. / {name} reactivated. | status |
| General definite failure | Notice title / body | Something went wrong / Nothing was saved. Your draft is kept. Enter credentials again, then press Save to try again. | Focus returns to first field |
| Status-command definite failure | Page status | Something went wrong. {name} was not changed. Use its row action to try again. | Focusable status |
| OWN_ACCOUNT | Notice title / body | This action cannot change your own account / Use Change my password or Change my PIN on your own row. You cannot deactivate yourself or change your own role. | Focusable alert |
| USER_CHANGED | Notice title | {name} changed while you were editing | Focusable alert |
| USER_CHANGED, read succeeded | Notice body | Nothing was saved. The staff list has been refreshed. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person. | — |
| USER_CHANGED, read failed | Notice body | Nothing was saved. The staff list could not be refreshed. Try again reads the list only. Your choices are kept and credentials are empty. Return to the staff list and choose an action on the current person. | — |
| NOT_FOUND | Notice title | {name} could not be found | Focusable alert |
| NOT_FOUND, read succeeded | Notice body | Nothing was saved. The staff list has been refreshed. Return to the staff list to choose another person. | — |
| NOT_FOUND, read failed | Notice body | Nothing was saved. The staff list could not be refreshed. Return to the staff list to choose another person. | — |
| OWN_ACCOUNT / USER_CHANGED / NOT_FOUND | Return / disabled Save help | Return to staff list / Return to the staff list and choose an action on the current person. | Return to staff list |
| Unknown | Title | Outcome not confirmed | status |
| Unknown, reread succeeded | Body prefix | {name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again. | — |
| Unknown, reread failed | Body prefix | {name}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again. | — |
| Unknown form | Body continuation | Your draft is kept; enter credentials again. | — |
| Unknown PIN/password reset | Final continuation | The list cannot confirm the reset or whether this person’s sessions ended. | — |
| Unknown own password | Final continuation | The list cannot show whether your password changed. For your next change, try the new password you chose as Current password first. If it is refused, try your previous password. Each wrong attempt counts towards your sign-in cooldown. | — |
| Discarded pending command | Page status | Waiting for an earlier save to finish. Nothing will be sent again. | status |
| Status session refusal, after recovery | Page status | {name} was not changed. Use its row action to try again. | status |
| Form session refusal, after recovery | Title / body | Nothing was saved / Enter credentials again, then press Save. | — |

Warnings are exact complete sentences beside the commit controls, or in the
deactivation confirmation. Their wording is classification-specific, and the
rule S8c tests is: the subject's current classification decides the surfaces
named, “POS sessions” for a cashier (a former manager's retained login never
verifies, so it has no back-office session) and “POS and back-office sessions”
for a manager; a kitchen subject has none. Creation, plain reactivation and
reactivation with a new PIN end nothing and carry no warning.

| Command / subject | Exact warning |
|---|---|
| Reset PIN of a cashier / promotion from cashier | {name}’s POS sessions will end on their next action. They must sign in again. |
| Reset PIN or password of a manager | {name}’s POS and back-office sessions will end on their next action. They must sign in again. |
| Cashier deactivation | {name}’s POS sessions will end on their next action. They cannot sign in while inactive. You can reactivate this person later. |
| Manager deactivation | {name}’s POS and back-office sessions will end on their next action. They cannot sign in while inactive. You can reactivate this person later. |
| Manager → cashier | {name}’s POS and back-office sessions will end on their next action. Their back-office login will no longer work. They can sign in at the POS. |
| Cashier → kitchen | {name}’s POS sessions will end on their next action. Their PIN will be removed. They will no longer sign in. |
| Manager → kitchen | {name}’s POS and back-office sessions will end on their next action. Their PIN will be removed. They will no longer sign in. |
| Kitchen → cashier | {name} currently has no sign-in sessions. After this change, they must sign in to use the POS. |
| Kitchen → manager | {name} currently has no sign-in sessions. After this change, they must sign in to use the POS or back office. |
| Kitchen deactivation | {name} will be inactive. Kitchen staff have no PIN or sign-in sessions. You can reactivate this person later. |
| Own PIN | Your POS sessions will end on their next action. This back-office session will continue. |
| Own password | Your other POS and back-office sessions will end on their next action. This back-office session will continue. |

| Modal / session state | Element | Exact text | Accessible name / autocomplete |
|---|---|---|---|
| Deactivation; D1 | Title | Deactivate {name}? | Named dialog; D1: Deactivate Ana R.? |
| Deactivation | Keep / commit | Keep active; Deactivate | Keep active — {name}; Deactivate {name}; D1: Deactivate Ana R. |
| Dirty departure | Title / body | Discard unsaved changes? / Your edits have not been saved. Stay to keep editing, or discard them before leaving. | Named dialog |
| Pending/unknown departure | Body | The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave. | — |
| Departure | Actions | Stay; Discard | Stay; Discard |
| Logout departure | Title / body | Log out and discard your changes? / The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session. | Named dialog |
| Logout departure | Actions | Keep this draft; Discard changes and log out | Same as visible |
| Pending/unknown logout | Extra context | The save may or may not have succeeded. Leaving does not send it again. | — |
| Modal kitchen notice | Repeated emergency | Kitchen printing needs attention / {incident identity} | Existing shared emergency |
| Deactivation kitchen context | Context | Decide whether to keep or deactivate this person before opening print incidents. | — |
| Departure kitchen context | Context | Decide whether to stay or discard before opening print incidents. | — |
| M-6 kitchen context | Context / action | Continue your session to open print incidents. / Open print incidents after sign-in | Same as visible |
| M-6 | Title / body | Your session timed out / Your unsaved changes are kept. Continue as {username} to resume them. | Named dialog |
| M-6 | Fields | Username; Password | Username / username, fixed property; Password / current-password |
| M-6 | Actions | Sign in as a different manager; Log out; Continue | Same as visible |
| M-6 missing password | Field error | Enter your password. | Password |
| Different-manager acknowledgement | Title / body | Sign in as a different manager? / The current manager’s unsaved changes will not be available to the manager signing in. | Named dialog |
| Different-manager acknowledgement | Actions | Stay with current manager; Continue to sign-in | Same as visible |
| Different-manager sign-in | Title / body | Sign in as a different manager / Enter your own username and password. The current manager’s unsaved changes will not be available to you. | Named dialog |
| Different-manager sign-in | Actions | Back to {username}; Log out; Sign in | Same as visible |
| BO-01 with draft held | Heading / intro | Back office / Sign in with your manager username and password. | — |
| BO-01 with draft held | Notice | Your session has ended / Sign in again to continue. / The previous session’s unsaved changes are stored on this tab and are not submitted automatically. | alert |
| BO-01 | Fields / action | Username; Password; Sign in | Username / username; Password / current-password; Sign in |
| BO-01 missing fields | Errors | Enter your username.; Enter your password. | Associated field |

### Focus and interruption contract

| Event | Focus target and retained state |
|---|---|
| Create opens | Name, empty. |
| Move opens | Classification; only the move's fields exist visibly. |
| Other reset opens | New PIN or New password. |
| Own change opens | Current password. |
| Reactivation needs new PIN | Empty New PIN, with associated refusal. |
| Classification/move switch | First credential the new choice needs, or Classification if it needs none. Name stays. |
| Local error | First invalid field in displayed order. |
| DUPLICATE | The field named by details.field, empty after the response. |
| INVALID_CREDENTIALS | Empty Current password. |
| THROTTLED | The focusable cooldown notice; Current password and Save are disabled until zero. Reopening preserves the wait. |
| USER_CHANGED / NOT_FOUND / OWN_ACCOUNT | Focusable form notice; Save disabled. Reread itself never commits or changes the move. |
| Read retry after a blocked refusal | Form notice; the manager still chooses a row action. |
| Pending form / status command | Saving notice / page status; duplicate commands and all row openers are inert. |
| Authoritative success | Affected row's first available action: Change role if active and other, Reactivate if inactive, Change my password if own. Fall back to Add person if absent. |
| Cancel or Discard | Original opener; opening a different record then focuses the new form. |
| Dirty departure opens / Escape | Stay; Escape also means Stay. |
| Stay | First form field (Classification for moves), or Saving status if still pending. |
| Deactivate confirmation opens / Escape | Keep active; Escape closes and restores that person's Deactivate opener. |
| Deactivated / reactivated | That person's new first action: Reactivate / Change role. |
| Unknown / definite general failure | First field, preserving non-secret choices and clearing credentials after the response. |
| Same-manager M-6 / BO-01 restoration | First form field; no credential or secret selection is restored. A held confirmation reopens on Keep active; a held departure on Stay. Pending focuses its status; a held result follows its ordinary result focus. |
| Different-manager sign-in | **Add person**, in a clean working area; no old draft, pending notice or focus is delivered (lead ruling R2, as BO-07 focuses New preset). The shared frame (`OfficeApp.tsx`) is a later build task; nothing is drawn in `office.js` for it. |
| Late answer after explicit Discard | Apply answered row silently; do not reopen a form, announce or move focus. |

M-6 retains the mounted form, visible and inert, and cannot be escaped. BO-01
hides the entire working area and closes its live dialogs while retaining their
state; same-manager recovery reopens a held modal before restoring focus.
The different-manager acknowledgement stays explicit. Rail, logout, incident
navigation, Escape, browser Back/Forward and another row all use the same
single-form departure guard. There is no beforeunload handler. A pending or
unknown command requires departure acknowledgement even if its secrets were
cleared. Stay never resends. Discard never cancels an already-sent command.

### Coverage and review states

The 122 registered states below are available directly through `?state=`.
The manifest and artifact carry identical state lists.

| State | Review picture |
|---|---|
| `default` | Active and inactive staff |
| `only-manager` | Only the signed-in manager |
| `loading` | Reading staff |
| `load-error` | Staff read failed |
| `overflow` | Long list · 64-character name and 32-character username |
| `create-kitchen` | Create kitchen |
| `saving-create-kitchen` | Saving · create kitchen |
| `saved-create-kitchen` | Saved · create kitchen |
| `create-cashier` | Create cashier |
| `saving-create-cashier` | Saving · create cashier |
| `saved-create-cashier` | Saved · create cashier |
| `create-manager` | Create manager |
| `saving-create-manager` | Saving · create manager |
| `saved-create-manager` | Saved · create manager |
| `move-kitchen-cashier` | Move kitchen cashier |
| `saving-move-kitchen-cashier` | Saving · move kitchen cashier |
| `saved-move-kitchen-cashier` | Saved · move kitchen cashier |
| `move-kitchen-manager` | Move kitchen manager |
| `saving-move-kitchen-manager` | Saving · move kitchen manager |
| `saved-move-kitchen-manager` | Saved · move kitchen manager |
| `move-cashier-kitchen` | Move cashier kitchen |
| `saving-move-cashier-kitchen` | Saving · move cashier kitchen |
| `saved-move-cashier-kitchen` | Saved · move cashier kitchen |
| `move-cashier-manager` | Move cashier manager |
| `saving-move-cashier-manager` | Saving · move cashier manager |
| `saved-move-cashier-manager` | Saved · move cashier manager |
| `move-manager-kitchen` | Move manager kitchen |
| `saving-move-manager-kitchen` | Saving · move manager kitchen |
| `saved-move-manager-kitchen` | Saved · move manager kitchen |
| `move-manager-cashier` | Move manager cashier |
| `saving-move-manager-cashier` | Saving · move manager cashier |
| `saved-move-manager-cashier` | Saved · move manager cashier |
| `move-former-manager` | Move former manager |
| `saving-move-former-manager` | Saving · move former manager |
| `saved-move-former-manager` | Saved · move former manager |
| `pin-cashier` | Pin cashier |
| `saving-pin-cashier` | Saving · pin cashier |
| `saved-pin-cashier` | Saved · pin cashier |
| `pin-manager` | Pin manager |
| `saving-pin-manager` | Saving · pin manager |
| `saved-pin-manager` | Saved · pin manager |
| `password-manager` | Password manager |
| `saving-password-manager` | Saving · password manager |
| `saved-password-manager` | Saved · password manager |
| `own-password` | Own password |
| `saving-own-password` | Saving · own password |
| `saved-own-password` | Saved · own password |
| `own-pin` | Own pin |
| `saving-own-pin` | Saving · own pin |
| `saved-own-pin` | Saved · own pin |
| `classification-switch` | Classification changed · name kept, credentials empty |
| `duplicate-pin-create-cashier` | PIN in use · create cashier |
| `duplicate-pin-create-manager` | PIN in use · create manager |
| `duplicate-pin-move-kitchen-cashier` | PIN in use · move kitchen cashier |
| `duplicate-pin-move-kitchen-manager` | PIN in use · move kitchen manager |
| `duplicate-pin-pin-cashier` | PIN in use · pin cashier |
| `duplicate-pin-pin-manager` | PIN in use · pin manager |
| `duplicate-pin-own-pin` | PIN in use · own pin |
| `duplicate-username-create-manager` | Username in use · create manager |
| `duplicate-username-move-cashier-manager` | Username in use · move cashier manager |
| `duplicate-username-move-kitchen-manager` | Username in use · move kitchen manager |
| `wrong-password-own-password` | wrong password · own-password |
| `throttled-own-password` | throttled · own-password |
| `wrong-password-own-pin` | wrong password · own-pin |
| `throttled-own-pin` | throttled · own-pin |
| `deactivate-cashier` | Confirm deactivation · cashier |
| `deactivated-cashier` | Deactivated · cashier |
| `deactivate-manager` | Confirm deactivation · manager |
| `deactivated-manager` | Deactivated · manager |
| `deactivate-kitchen` | Confirm deactivation · kitchen |
| `deactivated-kitchen` | Deactivated · kitchen |
| `reactivate-cashier` | Reactivating · cashier |
| `reactivated-cashier` | Reactivated · cashier |
| `reactivate-manager` | Reactivating · manager |
| `reactivated-manager` | Reactivated · manager |
| `reactivate-kitchen` | Reactivating · kitchen |
| `reactivated-kitchen` | Reactivated · kitchen |
| `reactivate-pin-needed` | Reactivation refused · a new PIN is needed |
| `saving-reactivate-pin` | Saving reactivation with a new PIN |
| `saved-reactivate-pin` | Reactivated with a new PIN |
| `failure` | Failure |
| `not-found` | Not found |
| `user-changed` | User changed |
| `user-changed-read-failed` | Person changed · reread failed |
| `own-account` | Own-account command refused |
| `unknown-pin-cashier` | Unknown outcome · pin-cashier |
| `unknown-password-manager` | Unknown outcome · password-manager |
| `unknown-move-cashier-manager` | Unknown outcome · move-cashier-manager |
| `unknown-own-password` | Unknown outcome · own-password |
| `unknown-read-failed` | Unknown reset · list could not be refreshed |
| `pending-deactivate` | Pending · deactivate |
| `unknown-deactivate` | Unknown · deactivate |
| `failure-deactivate` | Failure · deactivate |
| `pending-reactivate` | Pending · reactivate |
| `unknown-reactivate` | Unknown · reactivate |
| `failure-reactivate` | Failure · reactivate |
| `partial` | Saved while full staff read still fails |
| `unsaved` | Stay or Discard |
| `unsaved-logout` | Log out with a draft |
| `leave-pending` | Leave while saving |
| `leave-unknown` | Leave after unknown outcome |
| `reauth` | M-6 over inert draft |
| `bo01-draft` | BO-01 with isolated draft |
| `draft-restored` | Same manager returns · credential fields empty |
| `reauth-decision` | M-6 over departure decision |
| `bo01-decision` | BO-01 with departure held |
| `reauth-confirm` | Session gate over deactivation |
| `bo01-confirm` | Session gate over deactivation |
| `invalid-name-empty` | Local refusal · name-empty |
| `invalid-name-long` | Local refusal · name-long |
| `invalid-name-control` | Local refusal · name-control |
| `invalid-pin-empty` | Local refusal · pin-empty |
| `invalid-pin-short` | Local refusal · pin-short |
| `invalid-pin-format` | Local refusal · pin-format |
| `invalid-username-empty` | Local refusal · username-empty |
| `invalid-username-short` | Local refusal · username-short |
| `invalid-username-long` | Local refusal · username-long |
| `invalid-username-format` | Local refusal · username-format |
| `invalid-password-short` | Local refusal · password-short |
| `invalid-password-long` | Local refusal · password-long |
| `invalid-currentPassword-empty` | Local refusal · currentPassword-empty |
| `invalid-currentPassword-long` | Local refusal · currentPassword-long |


| Authority / requested item | Evidence |
|---|---|
| I BO-06 minimum, loading, failed read, overflow | only-manager, loading, load-error, overflow. Permission-denied remains n/a. |
| I BO-06 active/inactive and kitchen | default; every kitchen row has no PIN/password action. |
| I BO-06 create / moves / own changes | create-*; move-*; own-password; own-pin. |
| I BO-06 validation / saving / saved / refusals | invalid-*; saving-*; saved-*; duplicate-*; own-account; user-changed; not-found; wrong-password-*; throttled-*. |
| I BO-06 status and cross-client | deactivate-*; deactivated-*; reactivate-*; reactivated-*; reactivate-pin-needed; saved-reactivate-pin. Deactivated states expose review-only links, inside the review fixtures, by classification: deactivated-cashier to POS-01 *session invalidated*; deactivated-manager to POS-01 and BO-01 *Session ended*; deactivated-kitchen to none. |
| I BO-06 uncertainty / draft/session states | failure; unknown-*; unsaved; leave-pending; leave-unknown; reauth; bo01-draft; draft-restored; partial. |
| C3 §10.1 kitchen | create-kitchen; default halim and wibowo; deactivate-kitchen; reactivate-kitchen. |
| C3 §10.2 create | create-kitchen/cashier/manager and their saving/saved states. Normalization is walked by the check script. |
| C3 §10.3 six moves / former manager | move-kitchen-cashier, move-kitchen-manager, move-cashier-manager, move-manager-cashier, move-cashier-kitchen, move-manager-kitchen, move-former-manager. |
| C3 §10.4 warnings | Warning table above; every affected form, deactivation dialog, and own-change form. |
| C3 §10.5 own account | Own row; own-password; own-pin; own-account crafted-request refusal. |
| C3 §10.6 credentials | Native field matrix and clearing rules; classification-switch; draft-restored; marker and value-attribute checks. |
| C3 §10.7 refusals | duplicate-*; wrong-password-*; throttled-*; own-account; user-changed; not-found; reactivate-pin-needed. |
| C3 §10.8 unknown outcomes | unknown-pin-cashier; unknown-password-manager; unknown-move-cashier-manager; unknown-own-password; unknown-read-failed. |
| C3 §10.9 remaining inventory | loading; load-error; overflow; deactivated-*; reactivate-*; default inactive group; review cross-client links. |
| Ruling: kitchen is not a role | Classification heading; Kitchen · no sign-in option; no kitchen credential actions. |
| Ruling: no reveal or echo | Password input types; no value attributes, reveal or confirmation controls; DOM marker assertions. |
| Ruling: current credential lifecycle | Every response/gate clears credentials; local-only native corrections; POST forms. |
| Ruling: warning / confirmation choice | Deactivation confirms for floor consequence; other reversible commands warn beside Save. |
| Ruling: own row restrictions | Only own-change entries; no own deactivate, move or other-person resets. |
| Ruling: unknown outcomes | Unknown read never establishes credential outcome; own-password next-step copy; no automatic resend. |
| Ruling: immutable names and usernames | Create hint; no rename; retained username fact at promotion. |
| Ruling: no last-manager rule | Another manager can be deactivated or demoted in the row walks. |
| Ruling: drafts and named identity | reauth*, bo01*, draft-restored, unsaved*, late-answer walk; named results and dialog headings. |
| Ruling: tokens | No added or changed tokens; every CSS dimension/color/weight uses the existing registry or a structural ratio. |
| Part A.1 state completeness | Full state table above. |
| Part A.2 subject correctness | Script walks every action of every initial row, including kitchen, cashier, other manager and own manager; counts are checked in both sizes. |
| Part A.3 exact copy | Copy, warning, modal and field tables above; D1–D3 accessible names explicit. |
| Part A.4 focus | Focus table and scripted error, duplicate, cooldown, recovery, Cancel and success walks. |
| Part B | DESIGN.md's appended DESIGN-023 section, each reusable rule marked behaviour and local composition marked BO-06 copy. |
| Part C.1 | office.js resolves users locally and inserts Staff in authored Phase 1 rails; report-detail's explicit link migrated. |
| Part C.2 | manifest.js and gallery register every state; design023.cjs supplies browser evidence. |
| Part C.3 | Inventory and sitemap diff below; historical P/users.html gets the current Frost pointer. |

### Prototype-link ledger and changed inventory/sitemap lines

Counts are the number of lines containing `prototype/`, equivalent to
`grep -c "prototype/"`. A shared fallback line stays for other undrawn screens;
Staff no longer takes it. No Frost back-office HTML or JavaScript artifact
contains an authored `prototype/back-office/users.html` destination. The check
also follows the rendered rail on every existing Frost back-office screen.

| Changed artifact | Before | After |
|---|---:|---:|
| F/office.js | 1 | 1 |
| F/report-detail.html | 4 | 3 |
| F/users.html | absent | 0 |
| F/users.js | absent | 0 |
| F/users.css | absent | 0 |
| F/users-states.js | absent | 0 |
| visual-directions/manifest.js | 0 | 0 |
| visual-directions/index.html | 0 | 0 |
| P/users.html | 0 | 0 |

The exact inventory and sitemap changes follow. Other sections of both documents
are untouched.

```diff
diff --git a/docs/design/SCREEN-INVENTORY.md b/docs/design/SCREEN-INVENTORY.md
index 7334ec1..6e70e82 100644
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -845,27 +845,45 @@ No table merge, transfer, or split (out of scope).
 
 ## BO-06 — Users
 
-**Purpose.** Manage staff: create, assign role, set and reset PIN, deactivate.
+**Purpose.** Manage staff: create, assign a role or the kitchen classification, change it, set and reset PINs, set a manager's username and password and reset the password, change one's own password and PIN, deactivate and reactivate.
 
 **Reached by / from.** Manager, from navigation.
 
-**States.** *empty* · *loading* · *error* · *permission-denied* (n/a) ·
-*overflow* · *PIN not unique — rejected* (FR-A4) · *deactivation invalidates
-that user's POS session on its next authenticated request* (FR-B3, AC-32) ·
-*kitchen staff listed without a PIN* (FR-A1).
-
-**Requirements.** FR-A1, FR-A3, FR-A4, FR-B3, FR-J4.
+**States.** *only the signed-in manager* (empty is unreachable in a manager-only session) ·
+*loading* · *failed to load* · *permission-denied* (n/a) · *overflow* ·
+*active and inactive staff* · *kitchen staff listed without a PIN* ·
+*create by classification* · *six classification moves, including a former manager* ·
+*reset another person's PIN or password* · *own password and own PIN* ·
+*local invalid input* · *saving and saved* · *PIN or username in use — refused* ·
+*own account — deactivation and role change refused* · *user changed meanwhile — reread* ·
+*not found* · *current password wrong or throttled* ·
+*warning before every session-ending command* · *deactivation confirmation and result* ·
+*deactivation invalidates that person's sessions (POS, and back office for a manager) on their next authenticated request* ·
+*reactivating and reactivated* · *reactivation needs a new PIN* ·
+*general failure with draft kept* · *outcome unknown, reread, no resend* ·
+*departure decision* · *M-6 over inert work* · *BO-01 with isolated draft* ·
+*same-manager return with credential fields empty* · *success while the list read still fails*.
+The [Frost BO-06 artifact](visual-directions/frost/back-office/users.html) and
+DESIGN-023's Handoff specify the exact words and focus targets.
+
+**Requirements.** FR-A1, FR-A3, FR-A4, FR-B3, FR-J3, FR-J4, AC-32.
 
 **Must not invent.**
 - Two authenticating roles only: cashier and manager. **Kitchen is a
   non-authenticating classification** with no PIN and no permissions (FR-A1).
   Waiter is deferred — no waiter option.
-- PINs are six digits and unique across users, because an audit actor must be
+- PINs are six digits and unique among active users, because an audit actor must be
   unambiguous (FR-A1, A4, B-13).
 - A PIN is **never displayed, echoed, or recoverable** — set and reset only,
   never "view" (FR-A3, J4, B-11, B-12). No masked-reveal control.
-- Deactivating a user or resetting a PIN has an immediate floor consequence
-  (FR-B3). The manager must be told that, at the moment of the action.
+- Deactivation, every role change, and another person’s PIN or password reset
+  end every session that person has (a cashier's POS sessions; a manager's POS
+  and back-office sessions) on their next action. Own PIN
+  changes end POS sessions; own password changes end every other session. This
+  back-office session continues for both own changes (C3 §10). Explain the effect
+  before the command. Kitchen staff have no sign-in sessions to end.
+- A name cannot be corrected and a username cannot be changed or reused.
+  The own row offers neither deactivation nor a role change. No last-manager rule.
 
 ---
 
diff --git a/docs/design/SITEMAP.md b/docs/design/SITEMAP.md
index e2bd7d4..b904601 100644
--- a/docs/design/SITEMAP.md
+++ b/docs/design/SITEMAP.md
@@ -307,10 +307,16 @@ reports and audit.
 │   └── [INLINE] Deactivate rejected — holds OPEN order (Phase 2) FR-C8
 │
 ├── BO-06 [SCREEN] Users ................................. FR-B3, A1, A3, A4
-│   ├── [MODAL] User create / edit — role assignment ..... FR-B3, A1
-│   ├── [MODAL] Set / reset PIN ......................... FR-B3, A3, A4, J4
-│   │   └── [INLINE] PIN not unique — rejected ........... FR-A4
-│   └── [MODAL] Deactivate — invalidates POS session ..... FR-B3
+│   ├── [INLINE] Create person — classification form .... FR-B3, A1
+│   ├── [INLINE] Change role — six classification moves . FR-B3, A1
+│   ├── [INLINE] Reset another person's PIN / password .. FR-B3, A3, A4, J4
+│   │   └── [INLINE] PIN or username in use — refused ... FR-A4, B3
+│   ├── [INLINE] Change own password / own PIN .......... FR-B3
+│   │   └── [INLINE] Current password wrong / throttled . FR-A5b
+│   ├── [MODAL] Deactivate — ends sessions on next action FR-B3, AC-32
+│   ├── [INLINE] Reactivate ............................. FR-B3
+│   │   └── [INLINE] New PIN required — reactivate ...... FR-B3, A4
+│   └── [MODAL] Depart — Stay or Discard ................ C2
 │
 ├── BO-07 [SCREEN] Discount presets ...................... FR-B5, F5
 │   ├── [INLINE] Preset create / edit — non-modal panel . FR-B5
@@ -399,6 +405,9 @@ prototype.
    walk this, even though the two clients do not link to each other.
 4. **User deactivation → POS.** BO-06 deactivate → POS-01 shows the
    session-invalidated state on the next authenticated request (FR-B3, AC-32).
+   A manager’s back office reaches BO-01 *Session ended* on its next request.
+   DESIGN-023 supplies both review links outside the product frame; the clients
+   do not navigate to each other.
 5. **Lease → back office.** An active CheckoutLease on a quick-sale order
    causes BO-03's 86 toggle to be rejected, naming the order (FR-G13, AC-29).
    This refusal arrives in Phase 4; DESIGN-019 marks it separately from S5.
```

### Validation, measurements and unresolved questions

The designer ran no check script; the lead ran every one. Evidence is outside
the repository, under `../restaurant-pos-wt/evidence/DESIGN-023/runN/`.

**Earlier runs on the Codex draft.** run1: `design012`, `013`, `014` with
failures and errors empty; `design016` 399/399, `design018` 733/733,
`design020` 754/754, `design021` 543/543, `design022` 691/691; `npm run verify`
151 files / 5497 tests. It also failed three scripts, all fixed before run2 and
run3: `design023` (a hidden fixture chooser timed out), `design017` 349/350 (an
`[ACTION]` node in the sitemap, now `[INLINE] Reactivate`) and `design019`
995/998 (the rail list, settled by R1). run2: `design023` 1866/1866, 122
states; `design017` 350/350. run3: `design019` 998/998 with R1's one-line change.

**Final run, run4, at `a02f699` (tree clean at start;
`evidence/DESIGN-023/run4/designNNN/`).** Every script exited 0 with no failures
and no page errors:

| Script | Result | States |
|---|---|---:|
| `design023` | 1874/1874 | 122 |
| `design012` | 421 checks, failures and errors empty | 116 |
| `design013` | 371 checks, failures and errors empty | 41 |
| `design014` | 287/287 | 24 |
| `design016` | 399/399 | — |
| `design017` | 350/350 | 74 |
| `design018` | 733/733 | 130 |
| `design019` | 998/998 | 74 |
| `design020` | 754/754 | 124 |
| `design021` | 543/543 | 63 |
| `design022` | 691/691 | 58 |

`design023` grew from 1866 to 1874 with the finishing pass's eight new
assertions (four subject-correct warnings, three walk-4 link sets, one cooldown
format). `npm run verify` was not rerun: nothing under `docs/design/tokens/`
or outside `docs/design/` changed, and no token was added.

**Measurements (run4, `measurements.json`, every one of the 122 states at both
sizes).** Horizontal overflow is zero everywhere: the document's and the
content pane's `scrollWidth − clientWidth` is 0 at the maximum over all states,
`overflow` (the 64-character name and 32-character username) included, and
every table cell fits. Boxes are x,y width×height in CSS pixels:

| State | 1440×900 | 1920×1080 |
|---|---|---|
| default, list | rail 0,0 220×900; table 244,233 1172×763 | rail 240,0 220×1080; table 484,233 1172×763 |
| overflow | table 1172×4902 in its scroll owner; sticky header held at the pane's top after scrolling | same, at x 484 |
| create-manager | table 689 wide; panel 957,233 459×643; Save 1335,823 60×36; focus Name | panel 1197,233 459×802; Save 1575,982; focus Name |
| move-kitchen-manager | panel 459×643; Save 1335,823; focus Classification | panel 459×775; Save 1575,955 |
| throttled-own-password | panel 459×643; Save 1335,823; focus the cooldown notice | panel 459×660; Save 1575,841 |
| deactivate-cashier | dialog 400,341 640×218; focus Keep active | dialog 640,431 640×218 |

At 1440×900 the measured panel height (643) is what keeps Save inside the
viewport (its bottom at 859 of 900); “commit controls visible” passed in every
form state at both sizes.

**The Impeccable detector** (run1) reported eight *cramped-padding* warnings, all
on shared classes (`table-editor`, `office-dialog`, `office-emergency`,
`office-notice`) and none on `users.css`. They were not forked away: the task
forbids forking `office.css`, and a BO-06-only padding would make the shared
panel differ between screens. They belong to a shared-pattern pass if the lead
wants one.

**Not claimed.** Physical-device and assistive-technology testing. The
independent design review (Claude Opus, by the owner's exception) is still
required before S8c, and S8a and S8b remain prerequisites.

**Questions raised and not ruled.** None remain open from this task. R1 and R2
settled the two the draft raised. No product, server, audit or boundary question
was raised. For the lead to note, not to rule here: C3 §8 calls the absence of a
standalone “set username and password” route a reading for the lead to confirm;
BO-06 draws none, as the task's server facts say.

**What S8c must know beyond the tables above.** The warning's surfaces come
from the subject's classification, never from `username` (a former manager's
retained login never verifies). The panel-height rule is behaviour (warning
and Save always in view), not a pixel value. The fixture's response chooser,
cross-client links and fixture buttons are review-only and are not product UI.

DONE
