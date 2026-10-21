---
id: PHASE1-S1b
title: BO-05 Tables in the back office — the route manifest, the rail, the first configuration form, and AC-35 in the browser (plan S1b, consult C2, design E1)
category: ui
touches: [boundaries, identity]
depends_on: [PHASE1-S1a, DESIGN-017]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/tables.spec.ts, e2e/support/**]
status: active
cycles: 0
---
# PHASE1-S1b — BO-05 Tables in the back office

**Written** 2026-10-21 by the lead, from slice S1 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S1*), **consult C2**
(`.agent/reviews/ARCH-019-first-back-office-form.md`) and **design slice E1** (DESIGN-017, merged 2026-10-21 as PR
#120). The server half is built and merged (PHASE1-S1a, PR #119): the five table routes exist and behave as C2 says. The
consult's *For the lead, S1b* section is copied below verbatim, followed by the sections it relies on. **Where DESIGN-017
decided something C2 left open or worded generically, the lead rulings below say which wins; where this file, C2 and
DESIGN-017 still differ, stop and write `BLOCKED: <question>`.**

## Objective

A signed-in manager opens **Tables** from the back office's rail and, on BO-05, sees the floor's tables (or the empty
first-run state), creates a table, renames one, deactivates and reactivates one, through the five S1a routes, with every
word from DESIGN-017. The form is the first back-office form, so this slice also builds, once, the client pattern every
later configuration form copies: validation placed on fields before anything is sent, the result table for every answer
(including an outcome that could not be confirmed, with no resend), one command at a time, the unsaved-work departure
decision, and the working-area dialog rule at BO-01. AC-35's last sentence closes here in a real browser: the same
manager gets an unsaved edit back through M-6 and through BO-01; a different manager never sees it.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **Consult C2**, `.agent/reviews/ARCH-019-first-back-office-form.md`, whole once; §2, §6, §7 and §9 are quoted below.
3. **DESIGN-017's Handoff**, `.agent/tasks/DESIGN-017-tables.md` from `## Handoff` to the end, and above all
   **"Exact product copy and accessible names for S1b"** (the copy table). Every product word comes from that table
   (ADR-011 rule 24); the M-6 and logout rows quote `apps/back-office/src/copy.ts`, which stays the one source for them.
   Read its round sections too: they changed behaviour (status commands open no form; Discard keeps a late answer; a
   different manager's area starts with no pending command).
4. **`docs/DESIGN.md`, "Configuration forms — DESIGN-017 / consult C2"** (`:1486-1626`): the binding behaviour for every
   configuration form (Part B dialogs and identity, Validation and refusal, Command results, Status commands,
   Departure) and BO-05's choices (layout, order, focus, labels). The section heading still says "awaiting review"; it
   was reviewed and merged with DESIGN-017 and binds this task.
5. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/tables.html` with `tables.css`, `tables.js`
   and the shared `office.css`: the composition to build. Open it with `?state=<name>` (37 states; the gallery lists
   them). It is a review fixture: its row state, ids, response selector and fixture disclaimers are not product and are
   not copied. Its CSS values are ported only through tokens already in `docs/design/tokens/frost.css`
   (`apps/back-office/test/no-invented-values.test.ts` enforces this).
6. **PHASE1-S1a's Handoff**, `.agent/tasks/PHASE1-S1a-tables-server.md`, *What the next agent needs*: the route names,
   `ROUTES` names, contract names (`TableView`, `TableLabel`, `CreateTableRequest`, `UpdateTableRequest`,
   `DeactivateTableRequest`, `ReactivateTableRequest`, `TableResponse`, `TablesResponse`), the no-op rule, and that
   `DUPLICATE` reaches the client in the general-failure group of `realSession.ts`'s switch, to be read at the call site.
7. **ADR-011** (`docs/decisions/ADR-011-browser-clients-and-sessions.md`), rules 9, 11, 16, 19 to 24, 27 and 28.
8. **The existing back office**: `apps/back-office/src/OfficeApp.tsx` (the keyed working area, its header comment),
   `Reauth.tsx` (M-6, its logout confirmation), `session/` (the store, `api.ts`, `realSession.ts`, `fixtureSession.ts`,
   `source.ts`), and the tests beside them. **The browser harness**: `e2e/support/**`, `e2e/tests/reauthenticate.spec.ts`
   and `idle.spec.ts` (how a spec signs in, ages a session, moves both clocks and scans).
9. The contract, for meaning only: PRD FR-B2, FR-A2b, AC-28, AC-35; BOUNDARIES B-13, B-20, B-24.

## Decided: do not reopen

- **Owner, 2026-10-20 (DECISIONS):** tables may be **reactivated**; **no seat count** (Q10). The refusal to deactivate a
  table holding an open order arrives with **Phase 2** (Q13). Tables are not audited (Q11).
- **Owner, drafts (2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back; a different manager's sign-in destroys it; a reload destroys it.
- **C2, binding:** ids in `POST` bodies; the list read is not interactive, the four commands are; the client replaces
  or inserts the record a command answers and does not reread after success; `VALIDATION_FAILED` carries no details and
  the field list is built in the back office from the form's own check (§2); the result table of §6; no resend, ever;
  no `beforeunload` prompt; the manifest, rail, keyed working area and modal-dialog rule of §7.
- **DESIGN-017, reviewed and merged:** the copy table and `D`'s configuration-form rules, as read in *Required inputs*
  3 and 4.

## Lead rulings (2026-10-21) — where C2 and DESIGN-017 meet

1. **The table form is a non-modal panel, not a modal `<dialog>`** (DESIGN-017's decision under C2 §7 *For E1*). It is a
   `role="dialog"` with `aria-modal="false"`, named `New table` or `Edit {label}`, beside the list (3:2 split). The
   rail, *Log out* and the list stay live while it is open. Wherever C2 says "the edit dialog", read this panel. Being
   in the hidden `<main>`, it is hidden at BO-01 with the working area and shown again only for the same manager, with
   focus on *Table label* holding the unsaved value.
2. **The modal-dialog rule of C2 §7 applies to every modal dialog the working area opens**: in S1b, the departure
   decision (*Discard unsaved changes?*) and the top-bar logout confirmation (ruling 4). At BO-01 each is closed with
   `close()`, its React state kept, and the close is not treated as Cancel or as a choice. When the same manager signs
   in again, the departure decision is reopened with `showModal()` with focus on *Stay*; the top-bar logout
   confirmation is not reopened (closing it is the same as *Keep this draft*: nothing destructive happens without the
   person). Under M-6 a modal stays open, behind M-6 and inert. A different manager's sign-in destroys it with the key.
3. **Deactivate and Reactivate open no form** (DESIGN-017 round 2, F1; `D` *Status commands*). They act directly, with
   no confirmation; pending, unknown, definite failure, session refusal and success are page-status results, exactly as
   `D` *Status commands* and the copy table word them. C2 §6's table applies to them with "the draft" read as "nothing":
   there is no draft to keep or discard, and navigation stays live.
4. **The top bar's *Log out*.** With no dirty form and no pending or unknown command it behaves as today (no
   confirmation). With a dirty form, or a command pending or unknown, it opens the built logout confirmation with the
   **same constants** M-6 uses (`DISCARD_TITLE`, `DISCARD_BODY`, *Keep this draft*, *Discard changes and log out*, from
   `copy.ts`; do not duplicate the strings), plus, only for pending or unknown, the separate paragraph "The save may or
   may not have succeeded. Leaving does not send it again." M-6's own logout confirmation gains that paragraph under
   the same condition and is otherwise unchanged. *Keep this draft* returns to the caller with the draft and focus
   intact; *Discard changes and log out* logs out as the existing flow does.
5. **Navigation.** Signing in still lands on the Phase 0 frame's empty content pane at `/back-office/` (DESIGN-017
   Handoff: "S1b retains the Phase 0 landing"). The rail gains one group, labelled *Configuration*, with one link,
   *Tables*, at the client path **`/back-office/tables`** (the server already answers any extensionless path under
   `/back-office/` with the entry point). The page heading is *Tables*. An unknown client path is replaced
   (`replaceState`) by `/back-office/`. A reload at `/back-office/tables` signs in (if the session is live) to BO-05.
6. **List order** (`D`, BO-05 choices): active first, then inactive; within each, labels in natural, case-insensitive
   order (`Intl.Collator` with `numeric: true` and `sensitivity: 'base'`, so *T2* precedes *T10*), ties by `tableId`.
   Counts read `{active} active · {inactive} inactive`, computed from all rows.
7. **Not built in S1b**, even though DESIGN-017 draws it: the Phase 2 *deactivation rejected — open order* state; the
   kitchen-emergency sentences in the departure decisions (the built frame has no incident action until a later
   slice); BO-01's held-draft sentence "The previous session's unsaved changes are stored on this tab…" (DESIGN-016's
   BO-01, built in plan slice S10); any business-day indicator (none exists in the built frame). Say in the Handoff that
   each was left out on purpose.
8. **Copy additions** go in `apps/back-office/src/copy.ts` (or a BO-05 copy module beside it), as the existing constants
   are, each traceable to a row of DESIGN-017's copy table. No zod message, server text, error code or submitted value
   ever becomes visible text.
9. **The C5 measurement** (C2 §9). Measure the build half yourself: ten consecutive warm edits, each a one-line visible
   change to a BO-05 component, timing save to the `vite build --watch` completion line; the median and slowest; the cold
   build separately; the machine; the built bundle's size. The save-to-visible half needs a signed-in manager at BO-05:
   measure it if you can with a person created the harness's way (never the owner's credentials, never `db/dev.env`
   values, never writes to the development database `pos`); otherwise say it was not measured and why, and the lead
   measures it. Describe in words what a reload loses (C2 §9 item 3). Revert every timing edit.

## From consult C2, *For the lead* — S1b (verbatim)

- **Touches:** `boundaries` (B-24: the empty list as the starting state; FR-A2b and the owner's
  2026-10-05, 10-14, 10-16 and 10-20 draft rulings through AC-35), `identity` (the keyed working
  area, M-6, BO-01 with the draft held). The browser suite runs before merge.
- **Depends on:** S1a merged; design **E1** (BO-05, with the reactivation and label-in-use states,
  the decision on a modal or non-modal form and *Log out* under it, the unsaved-departure copy and
  the outcome-unknown copy) reviewed; DESIGN-016's accepted Handoff (the rail and the landing).
- **Owns** (globs): `apps/back-office/src/**`, `apps/back-office/test/**`, `e2e/tests/<new spec>`,
  and additions to `e2e/support/**` (the absolute-stamp helper).
- **Scope.**
  1. The route manifest and the rail (section 7); the landing per DESIGN-016.
  2. The store's `config` member, typed to the configuration routes only, and its hook; the fixture
     session's `config` answering `unavailable`.
  3. BO-05: loading, empty, failed to load with *Try again*, the list (active and inactive), create,
     rename, deactivate and reactivate, all copy from E1.
  4. The form: the field-list helper of section 2 before every call; placement on fields; the
     result table of section 6; one command at a time; the departure decision; the dialog rule at
     BO-01.
  5. The browser spec C1 to C3 (section 7), in Chromium and WebKit.
  6. The C5 measurement (section 9), in the Handoff.
- **Acceptance criteria, each with its red proof:**
  1. The rail shows Tables, and pressing it shows BO-05 at its manifest path; a manifest test holds
     every path under `/back-office/`, none with a first segment `assets` and none with a dot in the
     last segment. *Red:* add `/back-office/tables.html`: the test fails.
  2. A screen cannot name an `/auth/` route through `config` (a type test with `@ts-expect-error`),
     and the existing source scans still pass (one core instance, `activity` sent only from the
     listener).
  3. BO-05 against stubbed responses: the empty state when the list is empty; the failed state and
     *Try again* when it fails; a create, a rename, a deactivation and a reactivation each replacing
     the row with the record answered.
  4. Field placement: a draft with an empty label sends nothing and marks the label field invalid
     with its designed sentence; the error text contains no zod message and not the typed value; a
     body with an extra key never puts that key's name anywhere in the DOM. *Red:* return every
     `path[0]`, unfiltered: the extra-key case fails.
  5. `DUPLICATE` keeps the draft, places the refusal on the label and rereads the list.
  6. A command answered 500 (health 200) and one with no response (health unreachable) each keep
     the draft, send exactly one list reread and no second command, and show *outcome unknown*.
     *Red:* resend the command once after a fault: the count of command requests becomes 2.
  7. A second Save press while a command is pending sends nothing.
  8. `SESSION_IDLE` on Save opens M-6 over the form; after the same manager resumes, the draft is
     there and no command was resent.
  9. With a dirty form, Cancel, *Escape* and browser back each show the stay-or-discard decision,
     and *Stay* keeps the draft and the path; with a clean form none does.
  10. A working-area dialog open when the session reaches BO-01 is closed with its state kept, and
      reopened for the same manager; a different manager's sign-in destroys it (client test with
      stubs).
  11. In the browser (C1 to C3, both engines): the three cases of section 7, with their red proofs.
  12. Fixture mode: BO-05 shows the failed-to-load state and makes no request; the built-bundle
      proofs (plain and with `NODE_ENV=development`) still find no fixture marker.
  13. `npm run verify` green; `npm run test:e2e:all` green, the new spec included.
- **Tests expected to change:** `apps/back-office/test/sign-in.test.tsx` (its assertion that the
  rail is empty, `:57`); `OfficeApp.tsx`'s header comment ("there is no navigation entry"). The
  e2e specs that select `.bonav`, `.botop` and `.bocontent` should pass unchanged; if one does not,
  the Handoff says why.
- **The Handoff must carry forward:** the accessible names the spec drives (from E1); the dialog
  rule at BO-01 and whether either engine showed the blocking; the C5 numbers; what a later form
  copies (the helper, the result table, the departure decision, the dialog rule).

## How the criteria above read after DESIGN-017 (lead)

Each C2 criterion stands; these say what it means against the reviewed design, and add what DESIGN-017 settled.

- **AC 1:** the rail link is `Tables` in a group labelled *Configuration*; the path is `/back-office/tables` (ruling 5).
- **AC 3** also covers: the loading state (`Loading tables…`); the counts line; the order of ruling 6; a deactivation
  and a reactivation shown as page results with focus on the affected row's Edit; *Try again* on a failed read repeats
  the read only.
- **AC 4** covers all three local errors (empty, 33 UTF-16 units, a control character such as U+0007), checked on Save
  after trimming, in `D`'s order, focus on the first invalid field, the error cleared when the field is edited.
- **AC 5:** create and rename place "An active table already uses this label. Choose another label."; a refused
  reactivation opens that inactive table's editable label with "An active table already uses this label. Rename this
  inactive table, save, then reactivate it."; the holder row carries the visible text *Label in use* in its label cell
  (not a link); focus on *Table label*.
- **AC 6** covers the three *unknown* variants: form (reread complete, and reread failed with *Try again* repeating the
  read only), and status command (page status, "Nothing was sent again."). The reread never establishes success.
- **AC 7** also: while any command is pending, *New table* and every row action are inert; after an unknown outcome they
  are live again, and opening another record with a dirty draft goes through the departure decision.
- **AC 8** also: a status command refused by `SESSION_IDLE` shows, after the same manager resumes, "{label} was not
  changed. Use its row action to try again." A command in flight across M-6 or BO-01 settles by §6's table when it
  answers, and the answer is presented after the same manager resumes (`D`, Command results); a different manager's area
  starts with no pending command, and the previous manager's answer may update the list silently but is never
  announced or focused in it (DESIGN-017 round 3, N1).
- **AC 9** also: a rail entry and browser Forward with a dirty form show the decision; a pending or unknown command
  requires it even with an unchanged draft, with the pending/unknown body; *Escape* in the decision means *Stay*;
  *Discard* closes the panel once, returns focus to its opener, and a late authoritative answer still inserts or
  replaces its record silently (no reopened form, no focus move, no announcement); while that discarded save is still
  outstanding, the page status reads "Waiting for an earlier save to finish. Nothing will be sent again." and clears
  silently when it settles. The top-bar *Log out* with a dirty form opens the confirmation of ruling 4.
- **AC 10** reads against rulings 1 and 2: the panel is hidden with the working area and reshown with its value for the
  same manager; the departure decision is closed at BO-01 and reopened with focus on *Stay*; the top-bar logout
  confirmation is closed and not reopened; a different manager destroys all of it.
- **AC 11 (C1 to C3)** drives the accessible names of DESIGN-017's copy table: link `Tables`, button `New table`,
  textbox `Table label`, the row-scoped button `Edit {label} — active`, buttons `Save`, `Cancel`, `Stay`, `Discard`,
  and M-6's and BO-01's existing named controls. "The edit dialog is open" means the non-modal panel named
  `Edit {label}` is visible. C3's "leaving the dialog open at BO-01" red proof applies to the departure decision: have
  C3's same-manager run open the decision (a dirty form, then Cancel) before the session ends, and make the red
  mutation skip its `close()` at BO-01.
- **AC 12:** fixture mode also renders the rail and BO-05's failed-to-load state with no request.

## From consult C2 §2 — the field list (verbatim, *Recommended*)

- **The field list is built in the back office, from the form's own check, before the core is
  called.** One helper in one module of `apps/back-office` (for example
  `src/forms/fieldsInError.ts`): given a request schema from `@pos/contracts` and a candidate
  body, it runs `schema.safeParse`, takes `issue.path[0]` of each issue, keeps only values that
  are among `Object.keys(schema.shape)`, deduplicates, and returns them **in the schema's key
  order**. Its return type is `ReadonlyArray<keyof S['shape'] & string>`, the union of the
  schema's literal keys. An `unrecognized_keys` issue has path `[]` and so can never contribute;
  the issue objects, their messages and their `keys` are read for nothing else and are never
  stored, rendered or logged. The back office needs no zod dependency for this: the schema and its
  `safeParse` come from `@pos/contracts` (rule 9 keeps zod a dependency of the contracts only).
- **The form places each listed field's error from the design's copy** (rule 24): the field is
  marked `aria-invalid="true"` and described by its own designed sentence, as DESIGN-012's field
  pattern draws it. No message from zod, no message from the server, and no value appears in any
  error text; the value the manager typed stays in their own field and nowhere else.
- **Only when the list is empty does the form call the core.** An `invalid-request` from the core
  after that is a defect (the helper and the core disagree) and is shown as the general failure,
  draft kept.
- **A server `VALIDATION_FAILED` is shown as the general failure, draft kept**, with the designed
  "something went wrong" state that ARCH-014 §9 assigned to the codes an honest client never
  causes. The draft is not cleared and nothing is resent.
- **The server is unchanged:** `parseBody` keeps dropping the result, and `VALIDATION_FAILED`
  keeps no entry in `ErrorDetailsByCode`.

The schema distinguishes over-long from empty only by issue kind, which the helper does not read: the form's own
designed messages (empty, over-long, control character) come from its own check of the trimmed value in `D`'s order;
the helper decides **whether** the field is in error and is the gate before the core. Both must agree; a test proves a
label the form accepts is accepted by `CreateTableRequest`, and one it refuses is refused.

## From consult C2 §6 — the result table (verbatim, *Recommended*)

| The core's result for a command | Applied? | What BO-05 does |
|---|---|---|
| `ok` | Yes | Replace or insert the record; close the form; *saved* |
| `refused` with `DUPLICATE` | No | Keep the draft; place the refusal on the label; reread the list |
| `refused` with `NOT_FOUND` | No | Keep the draft; the general failure; reread the list |
| `refused` with `VALIDATION_FAILED` | No | Keep the draft; the general failure (section 2) |
| `refused` with `SESSION_IDLE` | No (the guard refused before the handler) | M-6 opens over the form; after the same manager resumes, the draft is there and **nothing is resent**; the manager presses Save again |
| `refused` with `UNAUTHENTICATED` or `FORBIDDEN`, or `session-gone` | No (refused before the handler, or not retried) | The session's own handling (BO-01; the working area kept or destroyed by rule 22) |
| `failed` or `unavailable` | **Unknown** | Keep the draft and the form open; reread the list (a `GET`, not interactive); then show *outcome unknown* with the reread list behind it; offer Save and Cancel as ever, and no "send again" control |

- **The client never infers success from the reread.** A row that now carries the new label may be
  this command or another manager's. The notice says the outcome could not be confirmed and the
  list is current; the manager judges.
- **One command at a time per form**: while one is pending, Save is inert and a second press sends
  nothing (rule 19's discipline, applied to commands).
- **A manager's own resend is always harmless in S1, by design of the commands**: a repeated
  create is refused `DUPLICATE` (the uniqueness rule is also the duplicate guard), a repeated
  rename sets the label it already has, and a repeated deactivation or reactivation is a no-op
  answered with the record. This is why S1 needs no idempotency key (ARCHITECTURE §8 lists none for
  configuration, and plan §5 places the idempotency design in Phase 2). **A command that would
  change nothing writes nothing and answers the record**: deactivating an inactive table,
  reactivating an active one, renaming to the same label.
- **By the ARCH-002 test** (does the step prevent an irreversible harm the server cannot prevent?),
  neither deactivation nor reactivation needs a confirmation step: both are reversible, and in
  Phase 2 the server itself refuses the one harmful case. E1 may still draw one; architecture does
  not require it.

## From consult C2 §7 — the manifest, the store, the hazard, departure and the browser cases (verbatim)

**The manifest and the rail.**

- **A route manifest of the back office's own**, one module (for example `src/routes.ts`): a
  constant list of `{ path, screen }` with an exhaustive screen type, routed by `history.pushState`
  and `popstate`, with no router dependency for two destinations. A test holds every manifest path
  under `/back-office/`, none with a first segment `assets` and none with a dot in its last segment
  (rule 11). An unknown client path is replaced (`replaceState`) by the landing, which needs no
  copy. **A client path names a screen and nothing else**: no record id, no draft, no query
  string; nothing is read from `location.search` in either build.
- **The rail lists only destinations that exist** (DESIGN-016 Part B 4): Tables from S1b, and the
  landing if DESIGN-016's Handoff places one. Whether a signed-in manager lands on BO-02's empty pane
  or on Tables is DESIGN-016's call (plan §4).
- **The screen is mounted inside the keyed working area** (`children` of `OfficeApp`'s keyed
  `div`), so a different manager's sign-in destroys BO-05's state with the key, as rule 22 says.
  The current path may live outside the key: the path holds no draft.

**How the screen reaches the one core instance.** The core is constructed in `realSession.ts`,
which also holds the API module (rule 16). The session store gains one member, for example
`config`, typed as the API module's configuration routes only (a mapped type over the paths under
`/api/back-office/config/`), so a screen can call the table routes and **cannot** call sign-in,
logout, re-authentication or `activity`. That keeps the existing source scan's property that the
input listener is the only caller of `activity`. Screens read it through a hook beside
`useSession`.

**Fixture mode** (rule 23: the Vite server, no API call). The fixture session's `config` answers
every call `unavailable`, so BO-05 shows its designed failed-to-load state there, writes nothing
and imports no request module. It lives in the fixture-session module, so the existing built-bundle
marker proof covers it. *Rejected*: an in-memory fake of the table commands, which would
reimplement uniqueness and no-ops in a second place and drift from the server; E1's Frost artifact
is where BO-05's states are reviewed, and served mode is where they are built.

**The hazard: a modal dialog in a hidden working area.** The sitemap draws *Table create / edit*
as a modal, and DESIGN-012's dialog pattern is a native modal dialog. Per HTML §6.3.1, the topmost
modal dialog in the top layer makes every other node inert, and CSS Position 4 §3.1 says a
top-layer element under a `display: none` ancestor is not rendered while it keeps its top-layer
place. At BO-01 the working area's `<main>` is `hidden` (`OfficeApp.tsx`). A table form left open
there would, by the specification, draw nothing and still block BO-01's username and password
fields: the manager could not sign in to get their draft back. Under M-6 the problem does not
arise, because M-6's own dialog is opened later and is topmost.

**Rule for S1b and every later working-area dialog:** a modal dialog inside the working area is
open only while the frame is shown. When the session leaves `signed-in` or `idle` for BO-01, the
dialog is closed with `close()`, its React state left mounted, and the `close` event is not treated
as Cancel; when the same manager signs in again it is reopened with `showModal()` before focus is
restored. Under M-6 it stays open behind M-6, visible and inert, as DESIGN-012's `reauth` state
draws. A different manager's sign-in destroys it with the key. The browser test below is the
evidence, because jsdom cannot show a modal's inertness.

**Unsaved-work departure.** The form is dirty when its draft differs from the record it was opened
from (or from empty, for a create). With a dirty form, every in-app departure goes through
DESIGN-012's stay-or-discard decision: Cancel, *Escape* (the dialog's `cancel` event is
prevented and replaced by the decision), a rail entry if the form is non-modal, and browser
back or forward (on `popstate` the client restores the path with `pushState` and shows the
decision). While a command is pending or its outcome unknown, the decision's copy says so and that
leaving does not send it again (DESIGN-012 F1). **No `beforeunload` prompt**: its wording is the
browser's, not the design's (rule 24), and rule 22 already states that a reload destroys the
working area. Log out with a dirty form follows E1.

**What S1b's browser test asserts for AC-35** (rules 27 and 28; people through the domain
functions with random credentials; both clocks; requests by the page; state, accessible names and
codes; the credential scan runs as in every test):

- **C1, the same manager through M-6.** Manager A signs in, opens Tables from the rail, sees the
  empty state (B-24), creates a table through the form (a random label) and sees its row. A opens
  that table's edit form, types a new label, and leaves the caret in the field without saving. The
  session is aged by the policy's idle limit plus one second and the page clock moved by the same
  amount; `#root[data-session]` becomes `idle` and M-6's dialog is shown. A enters their password.
  Then: `data-session` is `signed-in`, the edit dialog is open, its label field holds the unsaved
  value and has focus, and pressing Save succeeds and the row shows the new label (the first
  command after a renewal, under the new anti-CSRF token).
- **C2, another manager through M-6.** As C1 up to M-6; manager B uses *Sign in as a different
  manager*. Then: `data-session` is `signed-in`, no edit dialog is open, no input on the page holds
  A's unsaved value, and the list shows the table under its saved label only.
- **C3, the same and another manager through BO-01 with the form open.** As C1 up to the unsaved
  edit; the session's absolute stamp is aged past the policy's absolute limit (relatively, one row,
  from `SESSION_POLICY`, never a literal; a new harness helper beside `ageSession`), and the tab's
  next request is caused the way the existing specs cause one (an input after the activity window,
  with both clocks moved by the same amount), which the server answers `UNAUTHENTICATED`, so the
  tab reaches BO-01 *Session ended* with the working area held. Then: BO-01's
  username and password fields accept typing and its sign-in succeeds (the hazard above). Signing
  in as A shows the edit dialog with the unsaved value (owner, 2026-10-14); a second run signing in
  as B shows none of it (owner, 2026-10-20).
- **Red proofs**, each reverted: a constant working-area key makes C2 and C3's B variant fail;
  leaving the dialog open at BO-01 makes C3 fail at BO-01's fields in at least one engine (if it
  does not fail in either, the Handoff says so, and the rule stays as defence in depth).

Validation placement, `DUPLICATE`, unknown outcomes and departure are **client tests**, not browser
tests (rule 28): they are a component's behaviour against stubbed responses, which jsdom proves.

## From consult C2 §9 — the C5 measurement (verbatim)

S1b's builder records, on their machine, with the server and the back office's watch build running and BO-05 open
and signed in:

1. ten consecutive warm edits, each a one-line visible change to a BO-05 component, timing from the
   file save to the watch build's completion line and from the save to the reloaded page showing
   the change, signed in, at BO-05;
2. the median and the slowest of each, the first (cold) build separately, the machine, and the
   built bundle's size;
3. in words, what the reload loses: the open form and its draft are destroyed by every reload
   (rule 22), so working on a form state means re-opening and re-typing it each time.

(Lead ruling 9 says how far to take item 1's second timing.)

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions** (the absolute-stamp helper and anything the new
  spec needs); an edit to an existing helper's behaviour is a change to every spec: stop and ask. If the code needs a
  path outside `owns` (a contracts change, a server change, a token), stop and write `BLOCKED: <question>`.
- **No change to `packages/contracts`, `packages/api-client`, `apps/server` or `docs/`.** S1a's routes and schemas are
  what BO-05 uses; if one is wrong for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code. Each *Red* line is a mutation you apply, observe failing, revert, and report.
- Every visible word from DESIGN-017's copy table or `copy.ts`; every style value from the Frost registry.
- Browser-test rules (ADR-011 rules 27 and 28, the 012a/012b Handoffs): people through the harness's domain functions
  with random credentials (never `makePeople` from the server tests); both clocks moved together; requests made by the
  page; assertions on state, accessible names and codes; no screenshots or artefacts committed; sign-ins through the
  existing helpers so the credential ledger counts them; the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/back-office/test/sign-in.test.tsx` `:57`, the assertion that the rail is empty: it now holds the *Configuration*
  group with *Tables*.
- `apps/back-office/src/OfficeApp.tsx`'s header comment ("There is no navigation entry …", "Phase 0 has no form"): update
  it to say what is now true.
- New tests are expected under `apps/back-office/test/` (manifest, the field-list helper, the `config` type test, BO-05
  states and commands, departure, the dialog rule, the logout confirmation) and the new spec `e2e/tests/tables.spec.ts`.
- **Nothing else should change.** In particular `reauth.test.tsx`, `session-lifecycle.test.tsx`, `boundaries.test.tsx`,
  `fixture-session.test.tsx`, the `built-session*` tests and every existing e2e spec should pass unedited. A change
  anywhere else is reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `da7c270` (S1a #119, DESIGN-017 #120, C3 #121 merged). Lead verify of S1a's tree: `npm run verify` 97
files, 3790 tests; `npm run test:e2e:all` 58 passed. Confirm the baseline before you start and state the new counts in
the Handoff. Run `npm run test:e2e:all` yourself before you finish (both engines; the new spec included).

## Out of scope

- Any server, contract or transport-core change; any other back-office screen (BO-02's content, BO-03 onwards); the
  rebuilt BO-01 of DESIGN-016 (S10); the items of lead ruling 7.
- A server-side field list for `VALIDATION_FAILED`; an idempotency key; a single-record read; polling.
- Designing C5 (the faster development loop): this task only measures.

## Commit and report

Commit on `agent/phase1-s1b` only, after verify is green, and never push. Conventional Commits, explaining why; more
than one commit is fine if it reads better. Write the Handoff below in full prose: what was done (paths, commits), what
was decided and on what evidence, tests changed and why, each red proof (mutation, failure read, reverted), what was
found and not fixed, the real `verify` and `test:e2e:all` output, the C5 numbers, and what C2's *The Handoff must carry
forward* names. End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify (2026-10-21)

At `5fea2f8`, in this worktree. `git diff --name-only development...HEAD`: the task file and paths in `owns` only.
Existing tests changed: `sign-in.test.tsx` (`:57`, listed, and `:64`, the frame's link count, for the same reason: the
rail's one link; not weaker) and `session-harness.tsx` (an optional second argument to `mount`, every existing call
unchanged). Both accepted. Lead runs: `npm run verify` 102 files, 3922 tests, green; `npm run test:e2e:all` 68 passed
(50.7 s), the five `tables.spec.ts` cases in each engine. The C5 numbers (median save-to-visible 91 ms, slowest 105 ms)
are far below C2 §9's five-second trigger: **C5 is not needed**; the lead records that. Not done by the lead: a walk in
a real window (needs a manager's password; the owner's look before merge covers it).

**Lead rulings on the Handoff's two questions** (yours to overturn, owner):

1. **Decision 1 is accepted.** Ruling 4's "a command pending or unknown" meant a form's command. A status command has no
   draft (`D`, *Status commands*: navigation stays live), so the top bar's *Log out* does not ask for one.
2. **Decision 3 is accepted.** A client path holds no data (C2 §7), so showing the screen the address names after any
   sign-in is harmless, and it is the same rule that makes a reload land on BO-05. Ruling 5's "lands on `/back-office/`"
   describes signing in from the landing; no reset is added.

Decision 2 (*Keep this draft* returns focus to the label, as `D` says for *Stay*) is accepted. Sent to review
(`touches: boundaries, identity`); the owner looks before merge.

## Round 2 — the review's four findings (lead rulings, 2026-10-21)

Codex reviewed `ffd6b42` (`.agent/reviews/PHASE1-S1b-review.md`): four P2 findings, each with a reproduced scenario.
**All four are accepted.** Read the report whole; each finding's *Observed scenario* is the red test to write first.
(Correction to *Required inputs* 7: ADR-011's file is `docs/decisions/ADR-011-browser-clients.md`.)

- **F1, the top-bar logout confirmation survives a different manager.** Give the confirmation and its hold the
  identity lifetime of the working area: when the signed-in `staffUserId` changes (through M-6 or BO-01), the
  confirmation is gone and the hold released; the same manager's M-6 and BO-01 behaviour stays as ruling 2 says. Red
  test: the review's scenario (dirty form, top-bar Log out open, M-6, sign in as another manager through the
  different-manager flow): no `Log out and discard your changes?` dialog, no hold.
- **F2, leaving Tables loses an outstanding command.** A command's lifetime is the keyed working area's, not the
  screen's. Own the BO-05 model (its rows, its in-flight command, its held answer) at the working-area level, created
  once per key (for example in `Screens` or a provider inside the keyed `div`), so that unmounting `Tables` for the
  landing does not stop it; Discard drops only the draft. Returning to Tables before the answer settles shows the
  waiting status ("Waiting for an earlier save to finish. Nothing will be sent again."), *New table* and every row
  action inert; the late answer then replaces or inserts its record silently. A different manager's key still destroys
  it all (N1). Red test: the review's scenario through the real router and rail, for a rename and for a create; also
  through browser Back.
- **F3, a delayed refusal reread overwrites a later success.** A list read must not undo a record a command answered
  after that read began. Track, per record, the point at which a command's authoritative answer was applied (the model's
  sequence is enough); when a read settles, take its rows, but keep (and insert, if the read lacks it) any record whose
  answer was applied after the read started. No success-triggered reread. Red test: the review's scenario (DUPLICATE,
  reread held, corrected Save succeeds, the held read arrives): the list keeps *Window 1*.
- **F4, a success after a failed reread stays hidden.** No designed state covers it, so the lead rules, from parts the
  design already has, yours and the designer's to overturn. After an authoritative success while the collection read is
  failed: show the rows the client knows (the last rows it held, with the answered record applied), announce the named
  result and focus that row's Edit, keep the read-failure alert ("Tables could not be loaded" / "Try again to read the
  table list." with *Try again*, which repeats the read only) above the list, and **withhold the counts line** until a
  read succeeds, so nothing claims the list is current. *New table* is live again (no command is pending). A successful
  *Try again* then replaces the rows as any read does (F3's rule applies). Red test: the review's scenario (fault, failed
  reread, Save succeeds): the row *Window 1* is present and focused, the alert is present, no counts line.

*Lead note, 15:30:* the first resume of round 2 (15:19) never reached the builder: the prompt was sent before the resumed CLI was ready, and the dispatcher read round 1's `DONE` as this round's. Nothing changed in the worktree. The lead fixed the dispatcher (it now waits for the resumed CLI, and refuses an unchanged round's verdict) and set the round counter back, so round 2 is still this one.

Touch only `owns`. Keep every existing assertion; a test that changes because the model moved says so in the Handoff.
Re-run each earlier red proof that the move could affect (AC 6, 7, 8, 9, 10 and the constant-key proof) and say which
you re-ran. Run `npm run verify` and `npm run test:e2e:all`; commit on `agent/phase1-s1b`; append a *Round 2* section to
the Handoff (what changed per finding, where, the red proofs, the counts) ending `DONE` or `BLOCKED: <question>`; report
to the lead through Herdr.

## Round 3 — two items from the lead's review of round 2 (lead rulings, 2026-10-21)

The lead read `1ac6aa8` against the four rulings: F1 to F4 are met as ruled, the new tests are the review's scenarios,
and no existing test changed. Two items remain; this is the last fix round (`max_fix_cycles` 2). Codex then re-reviews
rounds 2 and 3 together.

1. **Every visit to Tables reads the list.** Moving the model to the working area made `shown()` read the list only the
   first time per manager; before, each visit read it. Opening Tables from the rail must show a list read on that visit:
   the first visit reads as now (loading shown); every later visit starts a reread that does not hide the rows already
   held (as the reread after a refusal does), and the F3 merge keeps any record answered after it began. A visit while a
   command is pending reads too; the command's answer still wins by F3. No reread on any other trigger (C2 §3: none after
   success, no polling). Test: leave Tables, change the server's list behind it, return: one list read is sent and the
   new row is shown; while that read is held, the old rows stay visible with no loading state.
2. **Formatting.** `apps/back-office/src/tables/Tables.tsx`: `useEffect(() => model.shown(), [model]);` and the
   `workGuard.register` effect share one line; put each on its own line.

Touch only `owns`. Run `npm run verify` and `npm run test:e2e:all`; commit; append a *Round 3* section to the Handoff
(what changed, the red proof for item 1, the counts) ending `DONE` or `BLOCKED: <question>`; report through Herdr.

## Handoff

### What I did

BO-05 is built, with the rail, the route manifest, the `config` member of the session store, the first configuration form
and the browser spec for AC-35. It is one commit on `agent/phase1-s1b` (`git log -1` names it; a commit cannot hold its own
hash); nothing was pushed. I changed only paths under `owns`, plus this Handoff.

New source, all in `apps/back-office/src/`: `routes.ts` (the manifest, one row per screen, `Record<Screen, string>`, so a
screen without a path does not compile); `router.ts` (`pushState`, `popstate`, an unknown path replaced by the landing, and
the Back and Forward restore); `Rail.tsx` and `Screens.tsx`; `forms/fieldsInError.ts` (C2 section 2, as written);
`tables/label.ts` (the form's own check: trim, then empty, over 32 UTF-16 units, control character); `tables/model.ts` (the
behaviour of BO-05, apart from how it is drawn); `tables/Tables.tsx` (the view); `work/guard.ts` (what the frame needs to know
of the screen in its working area). Changed: `OfficeApp.tsx` (rail, router start, the top bar's logout confirmation, header
comment), `Reauth.tsx` (the paragraph), `copy.ts` (every BO-05 sentence, each a row of DESIGN-017's copy table),
`office.css` (ported from Frost's `office.css` and `tables.css`; the no-invented-values test passes), `main.tsx` (the served
build gives the working area `<Screens />`), and in `session/`: `api.ts` (`ConfigApi`, `configApi`), `types.ts`, `realSession.ts`,
`fixtureSession.ts`, `useSession.tsx` (`useConfig`). New tests: `routes.test.ts`, `fields-in-error.test.ts`,
`tables.test.tsx`, `tables-departure.test.tsx`, `config-api.test.tsx`, `tables-support.tsx`; new browser spec
`e2e/tests/tables.spec.ts` and helper `e2e/support/absolute.ts`.

### How it works, and what a later form copies

**The model** (`tables/model.ts`) is a plain store read by `useSyncExternalStore`, one per working area. A later form copies
its shape: `meaningOf(answer)` is C2 section 6's table as one `switch` (`ok`, `duplicate`, `not-found`, `session`, `general`,
`unknown`); `send` calls the core exactly once and never again; `command` is the one command in flight and every opener is
inert while it is non-null; an answer that arrives while the session is away or a decision is open is held and presented
later (`gate`, `held`, `flush`); a `session` answer is never held, because it is definite and applied nothing; `present`
applies the answer; the reread (`load(false)`) follows `unknown`, `DUPLICATE` and `NOT_FOUND` and never establishes success.

**The field list and the form's own check.** `fieldsInError(schema, body)` is the gate before the core is called; `label.ts`
decides which designed sentence. A test proves `checkLabel` and `CreateTableRequest` agree for 13 labels. If they ever
disagree the form shows the general failure and sends nothing. Copy the pair, not the message text.

**The departure decision** is a modal `<dialog>` in `Tables.tsx` (`Decision`), driven by `state.decision`. **The dialog rule at
BO-01** is the `wanted` boolean: open only for `signed-in` or `idle`; `close()` in a layout effect when it turns false; the
`close` handler reopens it only when `wanted` is still true; React state is untouched, so the same manager gets it back with
`showModal()` and focus on Stay, and a different manager's key destroys it. `OfficeApp` has the same logic for the top bar's
logout confirmation. A later form with a modal copies `Decision` verbatim.

**`work/guard.ts`** is how the frame asks the screen: `status()` (`clean`, `dirty`, `uncertain`), `leave(proceed)` for the
router, `focus()` after "Keep this draft", and `hold(on)` so the screen holds an answer while the frame's own confirmation
is open. One screen registers at a time. **`router.ts`** asks it before a rail entry and on `popstate`; on a held Back it
puts the path back with `pushState` and pushes the destination again only on Discard.

**Accessible names the browser spec drives (from DESIGN-017):** link `Tables` (group `Configuration`), heading `Tables`,
button `New table`, non-modal dialogs named `New table` and `Edit {label}`, textbox `Table label`, buttons `Save`, `Cancel`,
`Stay`, `Discard`, row buttons `Edit {label} — active` / `— inactive`, `Deactivate {label}`, `Reactivate {label}`, modal
dialog `Discard unsaved changes?`, `Log out and discard your changes?` with `Keep this draft` and `Discard changes and log
out`, and M-6's existing `Your session timed out`, `Sign in as a different manager`, `Continue to sign-in`.

### What I decided, and on what evidence

1. **The top bar's Log out asks only when a form is open and unsaved, pending or unknown.** Ruling 4 says "a command pending or
   unknown"; `D` *Status commands* says a status command has no draft and navigation stays live. A confirmation titled "discard
   your changes" over a pending Deactivate would be false, so a pending or unknown status command does not ask. If the lead
   meant otherwise it is one condition in `work/guard.ts` consumers (`model.status()`).
2. **"Keep this draft" returns focus to the label** (or the Saving notice while pending), as `D` says for Stay. Ruling 4's
   "returns to the caller with ... focus intact" could also be read as the Log out button; I followed `D`.
3. **The path is not reset by a sign-in.** Ruling 5 says signing in lands on the Phase 0 frame at `/back-office/`. A fresh
   sign-in with the address still `/back-office/tables` (a deep link, or a logout then a sign-in without navigating) shows
   BO-05, because the path is read from the address bar and the same rule makes a reload at `/back-office/tables` land on
   BO-05, which ruling 5 also requires. Resetting to the landing on a *fresh* sign-in is one `replaceState` in `OfficeApp`;
   I did not add it because it would contradict the reload rule for a user who is already signed in. **Question for the
   lead, not blocking.**
4. **A session refusal of a status command** (`SESSION_IDLE`, `UNAUTHENTICATED`, `FORBIDDEN`, `session-gone`) sets the page
   status "{label} was not changed. Use its row action to try again." at once, so it is what the same manager sees after M-6.
   For a save the same refusal clears the Saving state and keeps the draft with no message.
5. **A list read refused or failed is "failed to load"**, whatever the reason, including a session refusal; Try again repeats
   the read. This is also what a reread that fails after `unknown` shows (the list is withheld, `unknown-unread` copy).
6. **Holder match** ("Label in use") compares `toLowerCase()` of the draft to each active row's label; the server uses
   `lower()`. They agree for ordinary labels; a locale-specific case folding could differ, and the holder mark would then be
   missing while the refusal sentence is still right.
7. **Chromium's second Escape.** Like `Reauth`, the decision and the logout confirmation reopen themselves if closed by
   anything but this component. I have not seen that behaviour in either engine here; it is defence copied from M-6.

### Not built on purpose (lead ruling 7)

The Phase 2 "deactivation rejected, open order" state; the kitchen-emergency sentences in the departure decisions (the built
frame has no incident action); BO-01's held-draft sentence "The previous session's unsaved changes are stored on this tab...";
any business-day indicator. None is drawn and none has a hook.

### Existing tests I changed, and why

- `apps/back-office/test/sign-in.test.tsx`: **two** assertions, not the one the task named. `:57` (the rail is empty) now reads
  that the rail holds `ConfigurationTables` and the one link to `/back-office/tables`. `:64` (`querySelectorAll('a')` has
  length 0 in the signed-in frame) failed for the same reason, the rail's new link; it now says the only link is `Tables` and
  there is none in the top bar or the content pane. Neither is weaker in what it guards: the frame still has no link other
  than the one destination that exists.
- `apps/back-office/test/session-harness.tsx`: `mount(store, screen = <TestChild />)` gained an optional second argument and
  `ReactNode` import; every existing call is unchanged. This file is under `test/**`, which `owns` lists, but it is shared by
  every back-office test, so I say so.
- `OfficeApp.tsx`'s header comment updated as the task required. `reauth.test.tsx`, `session-lifecycle.test.tsx`,
  `boundaries.test.tsx`, `fixture-session.test.tsx`, the `built-session*` tests and every existing e2e spec pass unedited.
  The e2e specs that select `.bonav`, `.botop` and `.bocontent` passed unchanged.

### Red proofs (each a mutation I applied, the failure I read, and the revert)

1. **AC 1.** `PATHS.tables` set to `/back-office/tables.html`: `routes.test.ts` failed three tests, "holds no path with a dot in
   its last segment" (`/back-office/tables.html: expected true to be false`) among them. Reverted.
2. **AC 2.** `ConfigApi` mapped over `keyof OfficeApi` instead of `ConfigPath`: `tsc -p apps/back-office` failed with TS2578
   "Unused '@ts-expect-error' directive" at all six lines of `config-api.test.tsx`, and TS2740 in `api.ts` and
   `fixtureSession.ts`. Reverted.
3. **AC 4.** `fieldsInError` returning every `path[0]` unfiltered (`named.add(String(issue.path[0]))`): "never names a key the
   schema does not have" failed with `expected [ 'undefined' ] to deeply equal []` for the extra-key body. (The extra key has an
   empty path, so the unfiltered mutation leaks `undefined`, not the key's name; the key name cannot reach `path[0]` for a strict
   object, which is the property the filter protects.) Reverted.
4. **AC 5.** The reread dropped from the `DUPLICATE` path: three tests failed (`expected 1 to be 2` list reads, and the
   `[LIST, CREATE, LIST]` call order). Reverted.
5. **AC 6.** `send` calling the command once more after `failed` or `unavailable`: six tests failed with `expected 2 to be 1`
   (the count of command requests became 2). Reverted.
6. **AC 7.** The `state.command !== null` guard removed from `save()`: "a second Save press while a command is pending sends
   nothing" failed with `expected 3 to be 1`. Reverted.
7. **AC 8, 9.** The hold removed from `answered` (an answer presented at once, behind M-6 or a decision): three tests failed
   ("an answer that arrives while the decision is open waits for it", "a command in flight when the session goes idle ...",
   "holds an answer that arrives behind it"). Reverted.
8. **AC 10 (client).** The decision's `close()` removed: five tests failed, the BO-01 one at `departure.open` (`expected true to be
   false`). Reverted.
9. **Constant working-area key** (`key="one"`), client: "through M-6 as a different manager ..." and "a different manager's
   sign-in destroys the form and the decision with the key" failed. In the browser, rebuilt: **C2 and C3's B variant failed in
   both Chromium and WebKit** (`toHaveCount(0)` received 1, the unsaved edit dialog). Reverted and rebuilt.
10. **Leaving the decision open at BO-01** (skip its `close()` when the phase is `signed-out`), rebuilt: **C3 failed in both
    engines**, at BO-01's Username field (`toHaveValue('x')` timed out, "waiting for getByLabel('Username')") for the
    same-manager case, and at `signInAtBackOffice` ("signing in at the back office failed") for the B variant. Both engines
    showed the blocking; a modal left open in the hidden area does block BO-01's fields. The "AC-18 scan found credentials where
    they do not belong" line that follows in those failing runs is the harness noticing a sign-in that was typed and never
    sent; it is a consequence, not a second defect. Reverted and rebuilt.

### Found and not fixed

- **The sentence "awaiting review"** still heads `docs/DESIGN.md:1486` ("Configuration forms — DESIGN-017 / consult C2"). It
  was reviewed and merged; the lead's task file already says so. I did not touch the document.
- **Dev server** (`npm run dev -w apps/back-office`, fixture mode) was not opened in a browser. The fixture-mode behaviour is
  proved in jsdom (`config-api.test.tsx`, AC 12) and the built-bundle tests; I did not look at it served by Vite.
- **Layout.** The e2e proves behaviour and names, not appearance. I did not open BO-05 beside the Frost artifact to compare
  spacing; the CSS is ported rule by rule from `office.css` and `tables.css` and passes the registry test. A look by a person
  is still worth doing for the 3:2 split, the sticky header and the overflow case (60 rows).
- **Process.** Early on I ran one compound shell command with a `cd` and, once, a heredoc to append `copy.ts`. Neither touched
  anything outside the worktree, and I stopped; the rest used the file tools.

### The C5 measurement (consult C2 section 9)

Machine: Apple M4, 16 GB, macOS (Darwin 25.5.0), Node v26.10.0, Vite 8.3.0. Server and the back office's `vite build --watch`
running; headless Chromium signed in as a harness-made manager (random credentials, the e2e database, never `pos`) at BO-05.
Measured by a temporary Playwright spec that was deleted afterwards (nothing of it is committed; `Tables.tsx` was restored and
compared byte for byte with a copy taken before).

- **Cold build:** 255 ms from starting `vite build --watch` to its first "built in" line.
- **Ten consecutive warm edits**, each a one-line visible change to the page heading in `Tables.tsx`:
  - save to the watch build's completion line: 58, 62, 71, 62, 76, 62, 60, 59, 66, 61 ms. **Median 62 ms, slowest 76 ms.**
  - save to the reloaded page showing the change (signed in, at BO-05, `page.reload()`): 88, 98, 101, 97, 105, 91, 90, 84, 91,
    83 ms. **Median 91 ms, slowest 105 ms.**
- **Built bundle** (the production build of this commit): `index-*.js` 281.90 kB (84.86 kB gzip), `index-*.css` 15.20 kB
  (3.52 kB gzip).
- **What a reload loses**, in words: the page is a new document, so the React tree is gone. The signed-in session survives
  (its cookie), and the reload lands on BO-05 at the same path, but the open form, whatever the manager typed in it, any
  pending or unknown outcome, the page status and the departure decision are destroyed (rule 22). Working on a form's
  appearance means opening it again and retyping it after every save, and states that need a particular server answer (the
  failures, the unknowns) cannot be reached by reload at all; the Frost artifact is where those are reviewed.

### Verification

`npm run verify`: typecheck clean (all seven projects) and **102 test files, 3922 tests passed** (baseline at `da7c270`:
97 files, 3790 tests, confirmed by running it before I changed anything; +5 files, +132 tests).
`npm run test:e2e:all`: **68 passed** in Chromium and WebKit (baseline 58; +10: five cases in each engine). The built-bundle
proofs (plain and `NODE_ENV=development`) find no fixture marker, inside the unit run. `git diff --check` is clean. I ran no
formatter.

### What the next agent needs and does not have

- A person's eyes on BO-05 served, signed in, in a real window (see "Found and not fixed").
- A ruling on decision 3 (does a fresh sign-in reset the path to `/back-office/`?) and, if the lead reads ruling 4 literally,
  on decision 1.
- The `work/guard.ts` registry is a module singleton. It is correct for one screen at a time; the first slice that has two
  screens with unsaved work at once (none planned) needs it keyed.
- Server, contracts and transport core are untouched, as the task required. `DUPLICATE` reaches the client through the
  general-failure group of `realSession.ts`'s switch and is read at the call site in `model.ts`, as S1a said.

### Round 2 — the review's four findings

All four applied as ruled. New tests are in `apps/back-office/test/tables-round2.test.tsx` (seven cases, each the review's own
scenario); the red proofs are below. No earlier assertion was edited or weakened.

- **F1, the logout confirmation survives a different manager.** `OfficeApp.tsx`: the state is now `askedFor`, the `staffUserId`
  the confirmation was opened for, and `asking` is true only while that equals the working area's key. A layout effect drops it
  for good when the key changes, so the dialog closes, `workGuard.hold` is released, and the first manager signing in later
  does not get it back. The same manager's M-6 and BO-01 behaviour is as before.
- **F2, leaving Tables loses an outstanding command.** The model is now made once per key in `Screens.tsx` (which sits inside
  the keyed `div` and stays mounted across routes), with the gate (`setGate`) and `start`/stop there. `Tables` takes the model
  as a prop. `model.shown()` replaces the model's own first load: Tables reads the list the first time it is shown, and drops a
  stale result on return, keeping only `waiting`, `deactivating` and `reactivating`. Because the landing no longer loads the
  list, the landing still sends no request. The view ignores focus requests made while it was not on screen (`handled`).
  Discard drops only the draft; returning before the answer shows the waiting sentence with New table and every row action
  inert, and the late answer lands silently, whether Tables is on screen or not.
- **F3, a delayed refusal reread overwrites a later success.** `model.ts`: each applied authoritative answer is recorded with a
  counter (`appliedClock`, `applied`); `load` remembers the counter when it starts and, when it settles, replaces the rows with
  its own but upserts any record whose answer was applied after the read began. No reread follows a success.
- **F4, a success after a failed reread stays hidden.** `model.ts` adds `partial` to the state: set when an authoritative
  success is applied while `read` is `failed`, cleared by any successful read. `Tables.tsx` draws the rows when `read` is `ready`
  or `partial`; the read-failure alert and its Try again stay above the list; the counts line stays withheld; New table is
  live. The rule is mine from the design's parts, as the ruling said; the designer may overturn it.

**Red proofs, round 2 (mutation, failure, reverted).** F1: `asking` as a bare boolean and the clearing effect removed: "a
different manager through M-6 meets no confirmation" failed. F2: `Tables` also calling `model.start()` (its unmount stops the
model, as the per-screen model did): "a create, left through browser Back ... lands in the list silently" failed. The rename
case ("waiting, inert") is red only against the old per-screen construction itself, which I did not rebuild; I do not claim a
mutation for it. F3: the merge disabled: both F3 cases failed (the older read restored Table 1; the created record vanished).
F4: `usable` back to `read === 'ready'`: the F4 case failed.
**Earlier proofs re-run on the moved model:** AC 6 (resend after a fault: 7 tests failed), AC 7 (guard removed from `save`: 1),
AC 8 and 9 (answers not held: 3), AC 10 (decision never closed: 5), and the constant working-area key (2, "through M-6 as a
different manager" and "destroys the form and the decision with the key"). All reverted. I did not re-run the two browser red
proofs (constant key, decision left open at BO-01); the browser suite passes unchanged on the new code, and the browser code
paths they mutate (`OfficeApp`'s key, `Decision`'s `close()`) were not changed.

**Counts.** `npm run verify`: typecheck clean, **103 files, 3929 tests** (was 102 and 3922; +1 file, +7 tests).
`npm run test:e2e:all`: **68 passed**, Chromium and WebKit, unchanged.

DONE
