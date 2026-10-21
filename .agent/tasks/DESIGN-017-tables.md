---
id: DESIGN-017
title: BO-05 Tables in Frost (slice E1), the first back-office form, with consult C2's dialog, outcome and departure rules
category: ui
touches: [identity]
depends_on: [DESIGN-016]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 1
---
# DESIGN-017 — BO-05 Tables (slice E1)

**Written** 2026-10-20 by the lead. Design slice **E1** of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4: "E1 (BO-05) first, because S1 sets the
pattern and waits on nothing else"), split from DESIGN-011's slice E (`.agent/reviews/DESIGN-011-back-office-audit.md:462`).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design017`).
**Branch and place:** `agent/design-017`, cut from `development` at `3749fb7`, in the worktree
`../restaurant-pos-wt/DESIGN-017`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`, and nothing in the main
checkout.

Nothing is built from this task directly. A design review follows; then the frontend slice **S1b** is written from it.
S1b's server half (S1a) is being built now against consult C2, so **the server's behaviour is fixed**: draw what it does.

Abbreviations, as in DESIGN-011 and DESIGN-016: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`.

## Objective

When this task is done, BO-05 has a reviewed Frost composition, `F/tables.html`, in every state S1b will build, with
every word S1b will show (ADR-011 rule 24: the builder copies the design's words; it invents none). Because BO-05 is
the **first back-office form**, the slice also settles the form patterns every later configuration screen copies:
field-level validation, a definite refusal, a pending save, an outcome that could not be confirmed, the unsaved-work
departure decision, and how a working-area dialog behaves when the session goes to M-6 or to BO-01. The rail gains its
first real destination, Tables.

## Required inputs

Read these, in this order.

1. **Consult C2 in full**, above all §3 (what a command answers; the list's order and grouping are yours), §4 (labels),
   §6 (unknown outcomes: the result table and the bullets under it), §7 (the manifest, the rail, the keyed working area,
   **the modal-dialog hazard and its rule**, *For E1, not decided here*, unsaved-work departure, and the browser cases
   C1 to C3 that S1b will run against your accessible names), and *Stale text* 2.
2. `.agent/reviews/DESIGN-011-back-office-audit.md`, BO-05 (`:150-165`) and slice E (`:462`). Its P1 (subject-correct
   walks for create, edit, refusal and success) and P2 (fixture counts) apply.
3. **DESIGN-012's task file and Handoff** (`.agent/tasks/DESIGN-012-office-shell-and-reauth.md`): the frame, the table
   pattern, read states, scroll ownership, the dialog pattern, Part C 5 (pending, saved, refused, outcome unknown) and
   Part C 6 (stay-or-discard), the **F1 ruling** (no page state makes *Log out* or the kitchen emergency action inert)
   and **N2** (as it now reads in `D`: a modal decision may defer the emergency action). Consume `F/office.css`,
   `F/office.js` and `F/patterns.html`; do not fork them.
4. **DESIGN-016's Handoff** (`.agent/tasks/DESIGN-016-login-and-today.md`, from *Handoff*): the rail, the landing, the
   `phase0` flag, BO-01's states (C2's hazard is about BO-01's fields), and how it registered states and wrote
   `design016.cjs`.
5. `I` BO-05 (`:738-753`) and the shared general failures (`I:83-124`); `S` BO-05 (`:265-267`); `P/tables.html`.
6. `D`: *Modal and sheet*, *Data table*, *Navigation (back office)*, *Notices and empty states*, *Buttons (back
   office)*, *Shared back-office patterns — DESIGN-012*, *Layout*, token provenance.
7. The contract, for meaning: PRD FR-B2 (now "create, edit, deactivate and reactivate"), FR-C8, FR-A2b, AC-32, AC-35;
   BOUNDARIES B-13, B-20, B-24.

## Rulings that bind this task

- **Owner, 2026-10-20 (DECISIONS), Q10:** tables may be **reactivated**; **no seat count**. Draw no seats anywhere
  (`P/tables.html` still draws them; fix that prototype's annotation, see Part C).
- **Owner, Q13:** the refusal to deactivate a table holding an `OPEN` order arrives with **Phase 2**. Draw it, name the
  order as `I` requires, and **mark it in the gallery and the Handoff as Phase 2** so S1b does not build it.
- **C2 §3, lead ruling:** no area column; nothing groups tables by area. `TableView` is `{ tableId, label, isActive }`
  only: draw nothing else per row (no seats, no current order, no timestamps).
- **C2 §4:** a label is 1 to 32 characters, no leading or trailing whitespace (the form trims before checking), no
  control character; unique among **active** tables, case-insensitively. Refusal code `DUPLICATE` for create, rename,
  and **reactivation** into a held label. Renaming an **inactive** table is allowed (the way out of a refused
  reactivation). Several inactive tables may share a label. *"If E1 draws a different length, E1 wins"*: if you change
  32, say so first in the Handoff, because S1a is being built to 32.
- **C2 §6:** the result table is binding behaviour; you write its words. A refused `NOT_FOUND` or `VALIDATION_FAILED`
  from the server is the *general failure*, draft kept. *Outcome unknown* keeps the draft and the form open, shows the
  reread list behind it, and offers Save and Cancel as ever, with **no "send again" control**; the client never claims
  success from the reread. One command at a time: Save is inert while pending.
- **C2 §6, last bullet:** architecture requires **no confirmation step** for deactivation or reactivation (both are
  reversible). You may draw one; if you do, say why in the Handoff.
- **C2 §7, the modal-dialog rule** (copy it into `D`'s shared back-office patterns, Part B): a modal dialog inside the
  working area is open only while the frame is shown; at BO-01 it is closed with its state kept, and reopened for the
  same manager; under M-6 it stays open behind M-6, visible and inert; a different manager's sign-in destroys it.
- **C2 §7, *For E1, not decided here*:** decide whether the table form is a **modal decision under N2** (and whether
  *Log out* is deferred the same way while it is open) or a **non-modal panel** (so *Log out* and the rail stay live).
  Either is buildable. Give your reason against DESIGN-012's F1.
- **Drafts (owner, 2026-10-14, 2026-10-16, 2026-10-20):** the same manager resuming through M-6 or signing in again at
  BO-01 gets the unsaved draft back; a different manager destroys it. C2's browser cases C1 to C3 assert this against
  your accessible names.
- **No `beforeunload` prompt** (C2 §7): a reload destroys the working area by rule 22; the browser's wording is not ours.
- **Tokens (lead, as in slices A, B, C, I):** registry first; a missing value may be registered in `frost.tokens.json`,
  `frost.css` and `D` with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or
  weight. No success green.

## What to draw

### Part A — BO-05, `F/tables.html`

1. **Every state, by `?state=`:** empty (B-24: a real starting state, with the way to create the first table); loading;
   failed to load, with *Try again*; the list (active and inactive together, your order and grouping, recorded);
   overflow (a long floor, the header sticking inside its scroll owner, the longest 32-character label); create;
   rename; local invalid input (empty label; over-long; a pasted label with a control character, if the field can
   receive one); saving (pending); saved; **label in use** for create, for rename, and for reactivation (each placed on
   the label, with the list reread behind it so the holder is visible); deactivated; reactivated; general failure
   (draft kept); **outcome unknown** (draft kept, list reread, no resend); the **stay-or-discard decision** from Cancel,
   *Escape*, browser back and (if non-modal) a rail entry, including its pending and outcome-unknown copy ("leaving does
   not send it again", DESIGN-012 F1); **M-6 over the form** (the form visible and inert behind it); **BO-01 with a draft
   held** (the form closed, BO-01's fields live, per the dialog rule); and the Phase 2 **deactivation rejected — table
   holds an OPEN order** state, marked Phase 2.
2. **Subject-correct walks** (DESIGN-011 P1): every Edit opens that row's own label; a refusal names the right table; a
   success changes the right row. Fixture counts agree with the rows drawn (P2).
3. **The modal or non-modal decision** above, drawn, with *Log out*'s behaviour while the form is open.
4. **Copy for every state**, final words, listed in the Handoff as a table S1b can copy (state, element, exact text,
   accessible name where a test will drive it). Name the controls S1b's browser cases press: the rail's Tables entry,
   New table, a row's edit control, the label field, Save, Cancel, Deactivate, Reactivate, and the decision's Stay and
   Discard.
5. **Focus**: where it lands on opening the form, after a field error, after `DUPLICATE`, after save, after Cancel, and
   after the dialog is reopened for the same manager (C2 C1 says: the label field, holding the unsaved value).

### Part B — the patterns, in `D`

1. Add to *Shared back-office patterns* the rules this slice settles for every later form: field-level validation
   placement; the refusal on a field; pending; saved; outcome unknown (no resend, no inferred success); the departure
   decision; and **C2's modal-dialog rule**, verbatim in substance. Say plainly which are behaviour (binding on every
   form) and which are BO-05's copy.

### Part C — links, rail, gallery, inventory and wireframe

1. `F/office.js`: add `tables` where Frost destinations are resolved, so the rail's Tables entry and every authored link
   to `P/tables.html` reach `F/tables.html`. Report the `grep -c "prototype/"` counts before and after for each changed
   artifact, and that no Frost back-office artifact still links to `P/tables.html`.
2. Register the artifact and every state in `manifest.js` and the gallery. Write `docs/design/checks/design017.cjs`.
3. Bring `I` BO-05 and `S` BO-05 into line, in C2's *Stale text* 2 wording or better: purpose "create, edit, deactivate
   and reactivate"; the states *label in use — create, rename or reactivation refused* (FR-B2) and *reactivated table*;
   *deactivation rejected* kept and marked as arriving with Phase 2's orders (Q13); the sitemap gains "[INLINE] Label in
   use — refused" and the reactivate action. `P/tables.html` gains a pointer to the Frost artifact and loses seats and
   anything else Q10 or C2 removed. Show each changed line in the Handoff (`git diff`).

## Constraints

- Light only, desktop only. No seat count, no area, no merge, transfer or split (I BO-05), no POS operation.
- *Invent, revert, ask:* nothing the inventory, the PRD or C2 does not grant.
- Every person is named (B-13): the top bar shows the real manager's name in the fixture.
- The four product documents are not edited; C2 and the ADRs are not edited.
- Do not change DESIGN-012's or DESIGN-016's shared behaviour except as Part B adds rules; slices A, B, C and I must
  still pass their checks (`design012.cjs`, `design013.cjs`, `design014.cjs`, `design016.cjs`).
- Measure in a browser at 1440×900 and 1920×1080. Each run of a check script needs the owner's approval in the pane; ask
  before it, not after. Run the checks with `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node
  docs/design/checks/designNNN.cjs`. Evidence stays outside the repository; quote measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
earlier check scripts may need their expected prototype-link counts updated for Part C; change only those expectations,
say so, and weaken no assertion.

## Acceptance criteria

1. `F/tables.html` exists, imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=`
   and registered. Red if one is missing.
2. The Handoff maps every `I` BO-05 state (as amended), every ruling above and every item of Parts A to C to the state
   or walk that shows it, and gives the copy table of Part A item 4.
3. Shown in the browser: the form's modal-or-non-modal behaviour as decided, with *Log out*'s; focus as Part A item 5
   says; M-6 over the form with the form inert; BO-01 with the form closed and BO-01's fields accepting input.
4. No seats, area or Phase 2 state presented as Phase 1; the Phase 2 state is marked.
5. Measurements at 1440×900 and 1920×1080: no horizontal overflow at the longest label; the sticky header in overflow.
6. No Frost back-office artifact links to `P/tables.html`; counts in the Handoff. No raw colour, size or weight; new
   tokens registered and listed; `npm run verify` green if anything under `docs/design/tokens/` changed. Slices A, B, C,
   I checks pass.
7. The Handoff lists every question raised and not ruled, each with a proposed answer.

## Out of scope

- BO-06 (slice E2), BO-07 and BO-08 (F), BO-03 and BO-04 (D); any server or API shape; building anything.

## Reporting

Commit on `agent/design-017` only, after verify is green where it applies, and never push. Write the Handoff below in
full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design017: DESIGN-017 done — <one line>"
    herdr agent prompt lead "design017: BLOCKED — <question>"

## Round 3 — the re-review's N1 to N3 and two cosmetic notes (lead rulings, 2026-10-21)

The Claude re-review of `dbf371e` (`.agent/reviews/DESIGN-017-review.md`, rewritten in place) found F1 to F10 resolved
and five new items the fixes created. **All five are accepted.** This is the last fix round (`max_fix_cycles` 2); the
lead reviews it, not a third Claude round. The words below are ruled; use them exactly.

- **N1 (medium), a command crosses a different manager's sign-in.** In `resume(false)` (a different manager), mark any
  in-flight command `discarded` whatever its kind, and start the new manager's area with no pending command (`pending`
  false, no `inFlight`). A late answer may update the list silently; it is never announced to the new manager and
  never moves their focus. Add to `D`'s modal-dialog paragraph: *"A different manager's working area starts with no
  pending command; the previous manager's command is never announced or focused in it."* Add the different-manager
  case to the F4 loop in `design017.cjs`.
- **N2 (low), inert page after Discard during a pending save.** While a discarded save is still outstanding, the page
  status reads exactly: **"Waiting for an earlier save to finish. Nothing will be sent again."** It clears silently
  when the answer settles (F3). Add the row to the copy table and the sentence to `D` *Command results*.
- **N3 (low), stale "Deactivating {label}…" after `SESSION_IDLE`.** When a status command is refused by a session
  refusal, after the same manager resumes the page status reads exactly: **"{label} was not changed. Use its row action
  to try again."** Add it to `D`'s *Status commands* paragraph and the copy table.
- **Cosmetic 1.** `SITEMAP.md:47`: add the blank line before the dated BO-05 note.
- **Cosmetic 2.** In the logout decision with a kitchen emergency, the emergency sentence reads exactly: **"Decide
  whether to keep this draft or discard it before opening print incidents."** The form departures keep their current
  sentence.

Then re-run only `design017.cjs` (the owner approves), add a *Round 3* section to the Handoff (what changed per item,
the count), commit on `agent/design-017`, never push, and report as *Reporting* says.

## Handover (lead, 2026-10-21): finish round 2 on OpenCode

Codex reached its usage limit with round 2's fixes made but **not committed**. The owner chose an OpenCode stand-in for
the finish only. **Do not redesign, re-review or re-run any check.** The uncommitted paths are: this task file,
`docs/DESIGN.md`, `docs/design/SITEMAP.md`, `docs/design/checks/design017.cjs`, and `F/tables.css`, `F/tables.html`,
`F/tables.js`.

The lead ran all five checks on that uncommitted tree at 10:13 on 2026-10-21, and they pass: `design017.cjs` 305/305;
`design016.cjs` 399/399; `design014.cjs` 288/288; `design013.cjs` and `design012.cjs` no failures or errors. The
re-measured geometry (from `design017.cjs`'s `measurements.json`), at 1440×900: frame 1440 wide at x 0, rail 220, top
bar 1220×64, content padding 24px, form panel 459×292 at x 957, label field 417×40; overflow scrolls 650px inside its
owner (1220×836), with the table header sticky at y 64. At 1920×1080: the frame stays 1440 wide, centred at x 240,
with the same rail, top bar, panel and field sizes, and the sticky header at y 64 in an owner 1220×1016. The
`state geometry overflow` and `counts match overflow` checks pass at both sizes, with the 32-unit longest label.

**What is left, and only this:**

1. Finish the *Round 2* section at the end of the Handoff (Codex began it; its last paragraph is about F4). Make sure
   it names, for each of F1 to F10, what changed and where, in one or two lines each; replace any round 1 measurement
   or count that is now stale with the figures above, and say they were taken by the lead. End the Handoff with `DONE`.
2. `git add` exactly the seven paths above and commit on `agent/design-017` (Conventional Commits, explaining why).
   Never push.
3. Run `herdr agent prompt lead "design017b: DESIGN-017 round 2 done — <one line>"`.

## Round 2 — the review's ten findings (lead rulings, 2026-10-21)

The Claude Opus review of `026ef6e` (`.agent/reviews/DESIGN-017-review.md`) found ten. **All ten are accepted.** Read the
report whole; each finding has a failing scenario you can walk. Where the reviewer offered a choice, the lead chose:

- **F1 (high), status commands.** Take the reviewer's first fix: **no form panel for Deactivate or Reactivate.** While
  pending, that row's own action is disabled and the page status says what is happening ("Deactivating {label}…" /
  "Reactivating {label}…", your words). An unknown outcome is shown in the page status region over the reread list
  (no "save", no "draft"; "Nothing was sent again"); the row's own button, which reflects the reread, is the manager's
  explicit and harmless path. No Save or resend control anywhere for a status command. Add the status-command rule to
  `D` beside the form rule.
- **F2 (high), M-6 copy.** M-6, its different-manager acknowledgement and form, and the M-6 Log out confirmation are
  **built and reviewed** (`apps/back-office/src/copy.ts:50-64`, DESIGN-015, DESIGN-012 `F/shell.*`): reproduce their
  titles, bodies and actions verbatim in the fixture, and in the copy table either quote them exactly with a pointer to
  `copy.ts` or remove those rows and point to it. Do not change them. **The top-bar Log out with a dirty table form
  reuses the built logout confirmation verbatim** ("Keep this draft" / "Discard changes and log out"), so one title
  never has two bodies. "Stay" / "Discard" remain only for the form's own departures (Cancel, Escape, browser Back, a
  rail entry).
- **F3 (medium).** After Discard, a late authoritative answer still replaces or inserts its record in the list,
  silently: it does not reopen the form, move focus or announce. Say so in `D`; make the fixture do it.
- **F4 (medium).** Delete the "Pending interrupted by session" state and the answer-dropping in `expire()`. A command in
  flight across M-6 or BO-01 settles by C2 §6's table when it answers (`ok` applied, `SESSION_IDLE` definite with the
  draft kept, the rest as the session handles them). Draw nothing new.
- **F5 (medium).** Use a 32-unit longest label (`'Terrace ABCDEFGHIJKLMNOPQRSTUVWX'`); `invalid-long` becomes exactly
  33. Add a length assertion to `design017.cjs`; re-measure overflow at 1440×900 and 1920×1080 and correct the Handoff.
- **F6 (low).** The page result is cleared when a form opens or a new command is sent; `#phase-note` hides with it.
  State it in `D`.
- **F7 (low).** Use the sitemap's existing tags: `[INLINE] Table create / edit — non-modal panel`, and fold reactivate
  into the screen's line or an `[INLINE]` row action. Add no new tag.
- **F8 (low).** For BO-05's definite general failure, **remove the "Try again" button** (it sent nothing) and write a
  body for a signed-in manager, with no "ask a manager": your words, saying nothing was saved, the draft is kept, and
  Save tries again. The read failure's "Try again" (which does repeat the read) stays. Do not edit the shared `I:88`
  row; record the back-office wording in BO-05's copy and in `D` as BO-05's.
- **F9 (low).** Specify and draw focus: during pending, on the form's status notice (focusable) or another live
  control; after a failure or an unknown outcome, the label; after Discard, the opener, as clean Cancel does. Remove the
  double `closeForm`.
- **F10 (low).** (1) **While a command is pending**, New table and every other record's actions are inert (one command
  at a time, as the fixture does); **after an unknown outcome** they are live again and opening another record goes
  through the departure decision. Make `D` say exactly that. (2) Reconcile `D:1471-1474` (DESIGN-012's "Leave without
  resending") with the new section: configuration forms use "Discard", and the pending or unknown departure body says
  leaving does not send it again; point the old lines at the new section rather than rewriting DESIGN-012's history.
  (3) Suppress the business-day indicator on `tables.html` (the day arrives in Phase 5). (4) Mark the duplicate's holder
  row with a text marker or the selected-row treatment, exposed to assistive technology, not an underline.

Then: re-run `design017.cjs` and the four regression checks (owner approves each), update the Handoff with a *Round 2*
section (what changed per finding, the new measurements, the counts), commit on `agent/design-017`, never push, and run
exactly one of the two `herdr agent prompt lead` lines in *Reporting*.

## Lead verify (2026-10-21)

At `599c795`, in this worktree. `git diff --name-only development...HEAD`: the task file and paths under
`docs/design/**` and `docs/DESIGN.md` only; nothing under `apps/`, `packages/`, `db/`, `e2e/` or the tokens. `git diff
--check` clean. Lead runs: `design017.cjs` 249/249; `design016.cjs` 399/399; `design014.cjs` 288/288 (expected link
counts 36/7 to 35/6, the only change to it); `design012.cjs` and `design013.cjs` no failures; `npm run verify` 94 files,
3753 tests. Decisions to review: the non-modal panel (Log out and the rail stay live; only the departure decision is
modal), no confirmation for deactivate or reactivate, active-first natural label order, the reactivation-refusal
recovery (rename, then reactivate), and the copy table. Sent to the Claude reviewer (Codex built it).

## Handoff

### Delivery and decisions

Designed by `design017` on `agent/design-017`. The entry point is
`docs/design/visual-directions/frost/back-office/tables.html`, with `tables.css`
and `tables.js`. It imports the existing `office.css` and `office.js`; BO-01's
held-draft composition also consumes `entry.css`. These are local design
fixtures for review, not application source or a second implementation of the
server. S1b must use the real configuration API and the existing session store.
No password is prefilled, recorded, persisted or sent by this fixture.

The label limit remains **32 UTF-16 units**, unchanged from S1a/C2. Labels are
trimmed before submit-time validation. No new token is registered, and nothing
under `docs/design/tokens/`, `apps/`, `packages/`, `db/` or `e2e/` changed.

The form is a **non-modal panel**, exposed as a named `role="dialog"` with
`aria-modal="false"`, beside the table list. A 3:2 fractional split uses the
existing content width; the form uses the existing 40px fields, 36px actions,
20px body inset and 16px/20px head/footer inset. The shell remains 1440px wide,
centred on wider windows, with its 220px rail, 64px header and 24px content
padding. Log out, rail and incident links remain reachable during editing,
pending and uncertainty. This satisfies F1 without extending N2 to an ordinary
form. Only a departure decision is modal; it repeats an existing kitchen
emergency until Stay or Discard resolves it. M-6 repeats that emergency above
the scrim and queues its destination behind authentication and departure.

Deactivate and Reactivate act directly: no confirmation step is added because
both are reversible and the server prevents the Phase 2 harmful case. Their
pending/unknown result is page-level and opens no form. The reread row's ordinary
Deactivate or Reactivate action is the only explicit command path; no Save or
resend control is provided (corrected in Round 2, F1).
A refused reactivation instead opens the inactive record's editable label.
Saving there only renames it; the manager separately presses Reactivate on its
row. No rename-and-reactivate command is implied.

The list is one table: active first, then inactive; natural case-insensitive
label order within each status, stable id order for ties. No area grouping.
The only columns are Label, Status and Actions. The default fixture has three
active and one inactive row; overflow has 52 active and eight inactive rows.
The longest label, “Terrace ABCDEFGHIJKLMNOPQRSTUVWX”, is exactly 32 units.
Counts derive from the drawn rows, including after creation and status changes.
The Phase 1 drawing's rail contains Tables only; the existing `phase0` flag and
its empty rail remain unchanged. Earlier gallery artifacts retain their future
navigation, now resolving Tables to Frost. S1b retains the Phase 0 landing and
adds Tables to its built-destination manifest; it does not build Today’s
future order content, business-day reads or incident routes from this drawing.
The business-day indicator is suppressed on BO-05 (Round 2, F10). Optional
alert fixtures remain shared review context, not new Phase 1 data requirements.

### Requirement, ruling and state map

Every state listed below is directly addressable with `?state=` and registered
in both the artifact and gallery manifest (37 states total).

| Requirement or ruling | Drawing or walk |
|---|---|
| I BO-05 empty; B-24 real starting state | `empty`; one New table action opens a blank field and creation adds the first row. No seed data is proposed. |
| I loading / error | `loading`, `load-error`; unread counts withheld; Try again repeats the read. `failure` retains a command draft. Permission denied stays n/a, handled by BO-01 session rules. |
| I overflow; Part A measurements | `overflow`; 60 rows, longest permitted label, sticky header inside `.bocontent`. |
| I inactive history / reactivated; FR-B2 and Q10 | `deactivated`, `reactivated`, `rename-inactive`; the row remains and inactive labels are editable. |
| I label in use; C2 uniqueness | `duplicate-create`, `duplicate-rename`, `duplicate-reactivate`; each retains its own draft, focuses the field and rereads the active holder. Reactivation recovery renames the inactive record, then separately reactivates it. |
| I deactivation refused; Q13 / FR-C8 / AC-32 | `rejected-phase2` names Table 3 and order ORD-1042, leaves the row active, and is marked **Phase 2 only** in the artifact and gallery. S1b does not build it. The response selector also walks the refusal on whichever table was selected. |
| C2 TableView / no area / no seats | Every row contains label, status and actions only. No current-order or timestamp column. The prototype's old incompatible table/form are replaced by pointers to the complete Frost walks. |
| C2 §4 local schema rules | `invalid-empty`, `invalid-long`, `invalid-control`; Save trims, checks empty, length and Unicode Cc in that order, sends nothing when invalid, and does not truncate. Native input sanitisation may remove newline/tab before validation; the control fixture uses U+0007, which survives. |
| C2 §6 authoritative success | `create`, `rename`, `rename-inactive`, `saved`; every row's Edit opens its own label, Save replaces that row, and creation inserts one row. Focus moves to the saved row's Edit. No successful-command reread. |
| C2 one command at a time | `saving` disables Save and the label, with focus on its status notice, Cancel and global departure available. `pending-deactivate` and `pending-reactivate` disable row actions with a named page status and no form. A second form submission sends nothing. |
| C2 definite general failure | `failure`; designed title/body above the retained draft: “Something went wrong” / “Nothing was saved. Your draft is kept. Press Save to try again.” No dismiss-only button; explicit Save sends the next command. The Record not found review response also performs one reread. Server `VALIDATION_FAILED` and local transport disagreement use this same general failure, never a field list from the server. |
| C2 unknown outcome | `unknown`, `unknown-deactivate`, `unknown-reactivate`; the local reread deliberately shows an applied result, while the form still says Outcome not confirmed. No inferred success, automatic command or resend control. Save/Cancel remain available for editable forms. Status commands have no form; only their ordinary reread row actions are available. |
| Reread itself unavailable | `unknown-read-failed`; the list is withheld and the notice truthfully says it could not be refreshed. Try again repeats only the list read. Its successful recovery keeps the outcome unknown and the draft open. |
| Part A departure, F1 and N2 | `unsaved`, `unsaved-escape`, `unsaved-back`, `unsaved-rail`, `unsaved-logout`, `leave-pending`, `leave-unknown`. The interactive check presses Cancel, Escape, actual browser Back, Tables and Log out. Kitchen/receipt/rail/logout all remain live through pending and unknown; each asks before departure. Stay retains state and focus; Discard follows the selected destination. Logout uses the reviewed Keep this draft / Discard changes and log out confirmation. No `beforeunload`. |
| Response while departure decision is open | A settled fixture response is held until the decision is acknowledged. It cannot close the dialog or choose a destination. Stay then applies the authoritative response. Discard drops the draft without sending another request; a held or late authoritative answer still updates the list silently (Round 2, F3). |
| C2 §7 / AC-35 C1, same manager M-6 | `reauth`; edited table visible and inert. The interactive walk edits, opens M-6, resists Escape/background focus, resumes the same manager with the value focused, then saves explicitly. |
| C2 C2, different manager M-6 | Sign in as a different manager acknowledges that the draft will not be available, then exposes Username/Password inside M-6. Successful different-manager fixture destroys the old field value and closes its form. It never adopts the draft. |
| C2 C3, BO-01 hazard | `bo01-draft`; frame and form hidden, all modal dialogs closed, BO-01 fields accept typing. Same-manager sign-in restores the panel and focused unsaved value; another manager gets none of it. |
| C2 working-area modal rule | `reauth-decision` retains the departure dialog under the topmost M-6; `bo01-decision` closes it without Cancel and preserves its state. Same-manager sign-in reopens it before focusing Stay. The label regains focus when Stay resolves it. |
| Part B shared rules | DESIGN's configuration-form section records validation, refusal, pending, success, uncertainty, departure and the modal-dialog rule. Binding behaviour is separated from BO-05 copy/layout. Historical `patterns.html` reconciliation is explicitly not the configuration contract; its fixture/check behaviour is untouched. |
| Part C links / rail / gallery | `office.js` resolves Tables to Frost; Menu and Report detail's authored links are migrated. `manifest.js` registers all 37 states and the gallery describes Tables and its marked Phase 2 state. |
| Part C inventory / sitemap / prototype | Purpose, reactivation, label refusal, non-modal form and Phase 2 refusal are aligned; the exact diff follows. |
| B-13 / B-20 | M. Iqbal is named in the header; the other-manager fixture names Ratna Ayu. A refusal changes no subject row. No audit rule, approval gate or transaction boundary is changed. |

### Exact product copy and accessible names for S1b

Braces denote values from the record or collection, never server-supplied error
text. A visible row action is scoped to its row in tests. For labels shared by
inactive records, scope by record identity; no id is displayed as extra row data.
These rows are product copy. Review selectors, the fixture disclaimer and Phase 2
build annotation are outside the product and are not copied into S1b.

| State / context | Element | Exact text | Accessible name / test target |
|---|---|---|---|
| Frame | Rail link / page title | Tables | link `Tables`; heading `Tables` |
| Frame | Section label | Configuration | Navigation group label |
| Frame | Brand | Back office | Existing frame |
| Frame | Manager / logout | `{manager name} · Manager` / Log out | link `Log out` |
| List | Count | `{active} active · {inactive} inactive` | Plain collection context |
| List | Caption | Active tables first · Labels in order | Table caption |
| List | Headers | Label / Status / Actions | Column headers |
| List | Row status | Active / Inactive | Row text |
| List | Row edit | Edit | `Edit {label} — active` or `Edit {label} — inactive` |
| List | Row status action | Deactivate / Reactivate | `Deactivate {label}` / `Reactivate {label}` |
| List / empty | Create action | New table | button `New table` |
| Empty | Heading | No tables yet | Empty-state heading |
| Empty | Body | Create your first table to set up the floor. | Empty-state text |
| Loading | Status | Loading tables… | status region |
| Read failed | Title | Tables could not be loaded | alert region |
| Read failed | Body | Try again to read the table list. | alert region |
| Read failed | Action | Try again | button `Try again`; read only |
| Create | Form title | New table | non-modal dialog `New table` |
| Create | Context | Choose the label staff will see on the floor. | Form context |
| Rename | Form title | `Edit {label}` | non-modal dialog `Edit {label}` |
| Rename active | Context | Active table. Changes keep this table’s history. | Form context |
| Rename inactive | Context | Inactive table. Saving its label does not reactivate it. | Form context |
| All forms | Field label | Table label | textbox `Table label`; name `label` |
| All forms | Helper | 1–32 characters. Active tables must have different labels. | `label-help` description |
| All forms | Primary / cancel | Save / Cancel | buttons `Save`, `Cancel` |
| Empty label | Error | Enter a table label. | `label-error`, described invalid field |
| Over-long label | Error | Use 32 characters or fewer. | Same |
| Control character | Error | Remove control characters from the label. | Same |
| Create / rename duplicate | Error | An active table already uses this label. Choose another label. | Same; field focused |
| Reactivate duplicate | Error | An active table already uses this label. Rename this inactive table, save, then reactivate it. | Same; editable inactive label |
| Pending | Title / body | Saving… / Wait for the result. Your draft is kept. | Form status; Save disabled |
| Saved | Result | `{label} saved.` | Page status; focus saved row's Edit |
| Deactivated | Result | `{label} deactivated. It is kept for history.` | Page status; focus affected row's Edit |
| Reactivated | Result | `{label} reactivated.` | Page status; focus affected row's Edit |
| Status command pending | Page result | `Deactivating {label}…` / `Reactivating {label}…` | Focusable page status; no form or Save |
| Status command unknown | Page result | `{label}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.` | Focusable page status; ordinary row action reflects reread |
| Status unknown, read failed | Page result | `{label}: the outcome could not be confirmed. The list could not be refreshed. Nothing was sent again.` | Page status; Try again repeats the list read only |
| Status definite failure | Page result | `Something went wrong. {label} was not changed. Use its row action to try again.` | Focusable page status |
| Duplicate holder | Label-cell marker | Label in use | Visible text in the holder's cell, not a link |
| General failure | Title / body | Something went wrong / Nothing was saved. Your draft is kept. Press Save to try again. | Form alert |
| Unknown, reread complete | Title | Outcome not confirmed | Form status |
| Unknown, reread complete | Body | The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again. | Form status |
| Unknown, reread failed | Body | The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again. | Form status; read failure has Try again |
| Ordinary departure | Title | Discard unsaved changes? | modal dialog `Discard unsaved changes?` |
| Logout departure (top bar and M-6) | Title | Log out and discard your changes? | Named modal dialog; reviewed `DISCARD_TITLE` |
| Logout departure (top bar and M-6) | Body | The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session. | Reviewed `DISCARD_BODY` |
| Logout departure | Actions | Keep this draft / Discard changes and log out | Exact button names; first focused |
| Pending / unknown logout | Additional request context | The save may or may not have succeeded. Leaving does not send it again. | Separate paragraph; built body/actions unchanged |
| Ordinary departure | Body | Your edits have not been saved. Stay to keep editing, or discard them before leaving. | Dialog description |
| Pending / unknown departure | Body | The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave. | Dialog description |
| Form departure except logout | Actions | Stay / Discard | buttons `Stay`, `Discard`; initial focus Stay |
| Departure with emergency | Additional sentence | Decide whether to stay or discard before opening print incidents. | Repeats the shared incident title/identity above it |
| M-6 | Title | Your session timed out | modal dialog `Your session timed out` |
| M-6 | Body | `Your unsaved changes are kept. Continue as {username} to resume them.` | Dialog description |
| M-6 | Labels | Username / Password | Read-only username, secret `Password` |
| M-6 | Missing secret | Enter your password. | Field error |
| M-6 | Actions | Continue / Log out / Sign in as a different manager | Buttons with these exact names |
| Other-manager acknowledgment | Title | Sign in as a different manager? | Reviewed `CHOOSE_OTHER_TITLE` |
| Other-manager acknowledgment | Body | The current manager’s unsaved changes will not be available to the manager signing in. | Reviewed `CHOOSE_OTHER_BODY` |
| Other-manager acknowledgment | Actions | Stay with current manager / Continue to sign-in | Exact button names; first action focused |
| Other-manager form | Title | Sign in as a different manager | Reviewed `OTHER_TITLE` |
| Other-manager form | Body | Enter your own username and password. The current manager’s unsaved changes will not be available to you. | Reviewed `OTHER_BODY` |
| Other-manager form | Actions | Sign in / `Back to {username}` | Exact button names; editable Username and Password |
| M-6 emergency | Context / action | Continue your session to open print incidents. / Open print incidents after sign-in | Exact button name |
| M-6 queued emergency | Body | `Continue as {username} to open print incidents. Your unsaved changes are kept.` | Dialog description |
| BO-01 held draft | Heading / intro | Back office / Sign in with your manager username and password. | Existing BO-01 composition |
| BO-01 held draft | Notice title / body | Your session has ended / Sign in again to continue. | alert region |
| BO-01 held draft | Additional sentence | The previous session’s unsaved changes are stored on this tab and are not submitted automatically. | No prior manager identity or draft content exposed |
| BO-01 held draft | Labels / action | Username / Password / Sign in | Exact field/button names |
| BO-01 local empty | Field messages | Enter your username. / Enter your password. | Invalid fields described by their messages |
| Phase 2 refusal only | Named refusal | `{label} was not deactivated. Order {order identity} is open at this table. Settle or void that order at the POS, then try again.` | Page status; no POS action link |

The M-6 strings above quote `apps/back-office/src/copy.ts:46–71` and the action
labels in DESIGN-012's `shell.html`, verbatim after Round 2 F2. S1b reuses the
already reviewed BO-01/M-6 failure, cooldown and logout handling;
this slice illustrates only their table-draft composition and identity transition.
It grants no second credential implementation. C2's C1–C3 should drive `Tables`,
`New table`, the row-scoped `Edit {label} — active`, `Table label`, `Save`, and
M-6/BO-01's existing named controls. A non-modal table panel replaces C2's generic
“edit dialog” wording; its role and name remain testable without a focus trap.

### Verification and evidence

The first owner-approved DESIGN-017 browser run passed **243/243 assertions**,
74 state/viewport combinations, with no page errors. Evidence is in
`/tmp/design017-evidence/round1`. Visual inspection covered the editor, refused
reactivation, M-6 over the held decision, and the scrolled overflow table.
A bounded finishing batch added visible creator focus after empty Cancel,
shared general-failure Try again, the not-found reread walk, correct direct-state
logout destination, spacing in M-6 and preservation of an unacknowledged
departure while a command answer arrives. The confirmation results follow.

The Impeccable detector ran once, with owner approval, over the three new
artifact files. It exited 2 with seven `cramped-padding` warnings: the panel,
notice, two dialogs and their emergency sections. These are static import/
wrapper false positives. Their text-bearing children inherit the reviewed
`office.css` head/body/footer, notice and emergency padding; screenshots show
the insets. No raw pixel, colour or weight value or new token was added.

### Link migration

`grep -c "prototype/"` counts lines, not individual links. Before / after:

| Changed artifact | Before | After |
|---|---:|---:|
| `F/menu.html` | 36 | 35 |
| `F/report-detail.html` | 7 | 6 |
| `F/office.js` | 1 | 1 |
| `F/tables.html` (new) | 0 | 0 |
| `F/tables.js` (new) | 0 | 0 |
| `F/tables.css` (new) | 0 | 0 |

The two authored Tables links change destination; `office.js` keeps its one
fallback for future screens but adds Tables to Frost resolution. No Frost
back-office artifact contains a link to `P/tables.html`, and the new browser
check verifies both authored and rendered destinations. DESIGN-014's expected
Menu/Report counts change from 36/7 to 35/6; no assertion is weakened or removed.

### Questions and limits

No unresolved owner or contract question was raised. The task explicitly grants
the modal/non-modal choice; the proposal is the non-modal panel above. The
32-character rule is unchanged, and no extra status confirmation is proposed.
The Phase 2 refusal is drawn but excluded from S1b. Historical shared sample
reconciliation remains untouched for the regression gate; C2 supersedes it for
real configuration forms, explicitly documented in DESIGN.

The fixtures do not test real credentials, server locks, transactions, production
routing or the keyed React mount. C2 C1–C3 against S1b in Chromium and WebKit
remain the builder's required evidence. Mobile, physical devices and a screen
reader are outside this desktop design run.

### Exact inventory, sitemap and prototype changes

The diff below records every changed line requested by Part C. Blank diff
context lines omit the otherwise trailing space in this Markdown quotation.

```diff
diff --git a/docs/design/SCREEN-INVENTORY.md b/docs/design/SCREEN-INVENTORY.md
index 896c8e5..803508d 100644
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -737,21 +737,28 @@ the first order, FR-B1, M1).

 ## BO-05 — Tables

-**Purpose.** Define the floor: create, edit, deactivate tables.
+**Purpose.** Define the floor: create, edit, deactivate and reactivate tables.

-**Reached by / from.** Manager, from navigation.
+**Reached by / from.** Manager, from navigation. The [Frost BO-05 composition](visual-directions/frost/back-office/tables.html)
+(DESIGN-017, awaiting review) supplies every form state and its exact copy.

 **States.** *empty* (no tables — a real starting state, B-24) · *loading* ·
-*error* · *permission-denied* (n/a) · *overflow* · *deactivation rejected —
-table holds an OPEN order* (FR-C8, AC-32) · *deactivated table retained for
-history*.
-
-**Requirements.** FR-B2, FR-C8.
-
-**Must not invent.** A table holding an OPEN order cannot be deactivated
-(FR-C8) — the rejection must name the order, because the manager's next step
-is to go and settle it at the POS. No table merge, transfer, or split (out of
-scope).
+*error* (read failed or command failure, draft kept) · *permission-denied* (n/a) ·
+*overflow* · *label in use — create, rename or reactivation refused* (FR-B2) ·
+*deactivated table retained for history* · *reactivated table* · *deactivation
+rejected — table holds an OPEN order* (FR-C8, AC-32; arrives with Phase 2's
+orders, Q13; not built in S1b). Forms also show local validation, pending,
+saved, outcome unknown, stay-or-discard and the retained draft through M-6 / BO-01.
+
+**Requirements.** FR-B2, FR-C8, FR-A2b, AC-35.
+
+**Must not invent.** Rows show only label, active status and actions: no seats,
+area, current order or timestamps (Q10, C2). Labels are 1–32 characters after
+trimming, without control characters, and unique among active tables without
+regard to case. Inactive tables may share labels and may be renamed. A table
+holding an OPEN order cannot be deactivated (FR-C8) — the Phase 2 rejection
+must name the order, because the manager's next step is to settle it at the POS.
+No table merge, transfer, or split (out of scope).

 ---

diff --git a/docs/design/SITEMAP.md b/docs/design/SITEMAP.md
index bc90915..6268c91 100644
--- a/docs/design/SITEMAP.md
+++ b/docs/design/SITEMAP.md
@@ -263,8 +263,11 @@ reports and audit.
 │       └── [MODAL] Archive item — snapshots unaffected ... FR-C8, B-8
 │
 ├── BO-05 [SCREEN] Tables ................................ FR-B2, C8
-│   ├── [MODAL] Table create / edit ...................... FR-B2
-│   └── [INLINE] Deactivate rejected — table holds OPEN order  FR-C8
+│   ├── [PANEL] Table create / edit — non-modal ........... FR-B2
+│   ├── [INLINE] Label in use — refused .................. FR-B2
+│   ├── [ACTION] Deactivate / reactivate ................. FR-B2
+│   ├── [MODAL] Stay or discard unsaved changes .......... FR-A2b
+│   └── [INLINE] Deactivate rejected — holds OPEN order (Phase 2) FR-C8
 │
 ├── BO-06 [SCREEN] Users ................................. FR-B3, A1, A3, A4
 │   ├── [MODAL] User create / edit — role assignment ..... FR-B3, A1
diff --git a/docs/design/prototype/back-office/tables.html b/docs/design/prototype/back-office/tables.html
index 2d142de..1f9f5c9 100644
--- a/docs/design/prototype/back-office/tables.html
+++ b/docs/design/prototype/back-office/tables.html
@@ -4,7 +4,7 @@
 <title>BO-05 Tables</title>
 <link rel="stylesheet" href="../wireframe.css">
 <script>window.WF={id:'BO-05',client:'bo',nav:'tables',name:'Tables',reqs:'FR-B2, C8, AC-32',states:[
-['default','Table list'],['rejected','Deactivation rejected'],['empty','No tables'],['editor','Modal — create/edit']]};</script>
+['default','Table list'],['rejected','Phase 2 — deactivation rejected'],['empty','No tables'],['editor','Create/edit — see Frost panel']]};</script>
 <script defer src="../wireframe.js"></script>
 </head><body>
 <header class="wfbar"></header>
@@ -35,54 +35,15 @@
     <div class="botop"><b>Tables</b><span class="muted">The floor plan the POS shows</span></div>
     <div class="bocontent">

-      <div class="banner" data-when="rejected">
-        <div class="banner__t">Table 1 was not deactivated</div>
-        <div>It is holding an open order (opened 19:38, 15.59). Settle or void that order
-        at the POS, then try again.</div>
-      </div>
-
-      <div class="bohead"><h1>Tables</h1><span class="muted">12 active &middot; 2 inactive</span>
-        <span style="margin-left:auto"></span>
-        <a class="bobtn bobtn--primary" href="tables.html?state=editor">New table</a></div>
-
-      <div class="empty" data-when="empty" style="padding:60px">
-        <div style="font-weight:700;margin-bottom:6px">No tables yet</div>
-        <div>Quick sales work without tables. Dine-in orders need at least one.</div>
-      </div>
-
-      <table class="dtable" data-unless="empty">
-        <thead><tr><th style="width:20%">Name</th><th>Seats</th><th>Status</th><th>Current order</th><th style="width:180px"></th></tr></thead>
-        <tbody>
-          <tr><td>Table 1</td><td>4</td><td><span class="tag">ACTIVE</span></td><td>Open &mdash; 15.59</td>
-            <td><a href="tables.html?state=editor">Edit</a> &middot; <a href="tables.html?state=rejected">Deactivate</a></td></tr>
-          <tr><td>Table 2</td><td>2</td><td><span class="tag">ACTIVE</span></td><td>&mdash;</td>
-            <td><a href="tables.html?state=editor">Edit</a> &middot; <a href="tables.html">Deactivate</a></td></tr>
-          <tr><td>Table 3</td><td>4</td><td><span class="tag">ACTIVE</span></td><td>Open &mdash; 8.00</td>
-            <td><a href="tables.html?state=editor">Edit</a> &middot; <a href="tables.html?state=rejected">Deactivate</a></td></tr>
-          <tr><td>Table 4</td><td>6</td><td><span class="tag">ACTIVE</span></td><td>&mdash;</td>
-            <td><a href="tables.html?state=editor">Edit</a> &middot; <a href="tables.html">Deactivate</a></td></tr>
-          <tr><td>Table 5</td><td>2</td><td><span class="tag">ACTIVE</span></td><td>&mdash;</td>
-            <td><a href="tables.html?state=editor">Edit</a> &middot; <a href="tables.html">Deactivate</a></td></tr>
-          <tr style="color:var(--ink4)"><td>Terrace 1</td><td>4</td><td><span class="tag">INACTIVE</span></td><td>&mdash;</td>
-            <td><a href="tables.html">Reactivate</a></td></tr>
-        </tbody>
-      </table>
-    </div>
-  </div>
-
-  <div data-when="editor">
-    <div class="scrim" style="position:absolute;inset:0"></div>
-    <div class="modal modal--bo">
-      <div class="modal__head"><h2>Table</h2></div>
-      <div class="modal__body">
-        <div class="kv">
-          <span>Name</span><div class="field field--sm">Table 2</div>
-          <span>Seats</span><div class="field field--sm">2</div>
-        </div>
-      </div>
-      <div class="modal__foot">
-        <a class="bobtn" href="tables.html">Cancel</a>
-        <a class="bobtn bobtn--primary" href="tables.html">Save</a>
+      <div class="bohead"><h1>Tables</h1></div>
+      <div class="empty">
+        <h2>This historical drawing has moved to Frost</h2>
+        <p>Create, edit, deactivate and reactivate tables in the current behavioural fixture.</p>
+        <a class="bobtn bobtn--primary" href="../../visual-directions/frost/back-office/tables.html">Open Tables in Frost</a>
+        <p><a href="../../visual-directions/frost/back-office/tables.html?state=empty">No tables yet</a> ·
+        <a href="../../visual-directions/frost/back-office/tables.html?state=create">New table</a> ·
+        <a href="../../visual-directions/frost/back-office/tables.html?state=rename">Edit table</a> ·
+        <a href="../../visual-directions/frost/back-office/tables.html?state=rejected-phase2">Phase 2 only — deactivation refused</a></p>
       </div>
     </div>
   </div>
@@ -90,11 +51,12 @@
 </div></div><div class="device__caption">Back office &mdash; 1440 wide</div></div>

 <aside class="rail">
+  <div class="ann"><p>DESIGN-017: the <a href="../../visual-directions/frost/back-office/tables.html">Frost artifact</a> is the current behavioural authority. Q10 and C2 remove seat counts, area and current-order columns. A row contains label, active status and actions only. Labels are 1–32 characters; inactive tables remain editable. The form is a non-modal panel, with a modal stay-or-discard decision.</p></div>
   <h2>Purpose</h2>
-  <div class="ann"><p>Define the floor: create, edit, deactivate tables.</p></div>
+  <div class="ann"><p>Define the floor: create, edit, deactivate and reactivate tables.</p></div>
   <h2>Fixed by the PRD</h2>
   <div class="ann ann--fixed"><ul>
-    <li>A table holding an open order cannot be deactivated, and the rejection names
+    <li>Phase 2 only (Q13): a table holding an open order cannot be deactivated, and the rejection names
       the order &mdash; the manager's next step is to go and settle it at the POS.
       <span class="req">FR-C8, AC-32</span></li>
     <li>No table merge, transfer, or split. Out of MVP scope.</li>
```

### Final measurements

Quoted from `/tmp/design017-evidence/round2/measurements.json`. Values are CSS
pixels. The editor measurements use `rename`; sticky measurements use
`overflow` after a 650px content scroll.

| Measurement | 1440×900 | 1920×1080 |
|---|---|---|
| Frame `(x, y, width, height)` | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` |
| Rail `(x, y, width, height)` | `(0, 0, 220, 900)` | `(240, 0, 220, 1080)` |
| Top bar `(x, y, width, height)` | `(220, 0, 1220, 64)` | `(460, 0, 1220, 64)` |
| Content padding | `24px` | `24px` |
| Editor `(x, y, width, height)` | `(956.797, 165.422, 459.203, 292.266)` | `(1196.797, 165.422, 459.203, 292.266)` |
| Label field `(width, height)` | `(417.203, 40)` | `(417.203, 40)` |
| Sticky first header `(x, y, width, height)` | `(244, 64, 578.875, 40.938)` | `(484, 64, 578.875, 40.938)` |
| Scroll owner `(x, y, width, height)` | `(220, 64, 1220, 836)` | `(460, 64, 1220, 1016)` |
| Scroll offset | `650` | `650` |

All 37 states at both target sizes reported zero document horizontal overflow,
no content horizontal overflow, one active main landmark and empty password
fields. This initial measurement used a 33-unit label, incorrectly described as 32;
Round 2 F5 corrects the fixture and records new measurements below. The header
was at its scroll owner's
`y=64` at both widths, with no gap revealing rows above it. At 1920px the frame
keeps 240px of canvas on either side; the form and table retain their geometry.

### Completed checks

Each browser execution below was separately approved by the owner. Evidence
stays outside the repository; no screenshot or generated measurement is staged.

| Check | Result | Evidence |
|---|---|---|
| DESIGN-017 confirmation | 249/249 assertions; 74 state/viewport combinations; no errors or failures | `/tmp/design017-evidence/round2` |
| DESIGN-012 regression | 293 assertions; 52 states; no errors or failures; exit 0 | `/tmp/design012-evidence/design017` |
| DESIGN-013 regression | 371 assertions; 41 states; no errors or failures; exit 0 | `/tmp/design013-evidence` |
| DESIGN-014 regression | 288/288 assertions; 24 states; no errors or failures; exit 0 | `/tmp/design014-evidence/design017` |
| DESIGN-016 regression | 399/399 assertions; no errors or failures; exit 0 | `/tmp/design016-evidence/design017` |

DESIGN-013 uses `DESIGN013_OUTPUT`, so the supplied generic evidence variable
was ignored and its successful run wrote to its default `/tmp/design013-evidence`.
The output location above is the actual one; no repeat run was needed.

The supplementary Impeccable finish reviewer inspected source, C2, the Handoff
and seven required screenshots, returned **ship**, and reported no material
findings. Its first attempt was interrupted by the usage limit; after reset the
same read-only assignment completed. This is supplementary QA, not the formal
lead design review. The separate documentation pass found no corrections needed
and edited nothing. Neither reviewer ran a browser or check script.

The final `git diff --check` passed. The prototype-link counts were re-read as
35, 6, 1, 0, 0 and 0, matching the table above; a source search found no
`prototype/back-office/tables.html` link anywhere under Frost back-office.

The owner-approved `npm run verify` exited 0: typechecking passed, followed by
**94 test files and 3,753 tests passed**, including the unchanged token tests.
The existing Vite warning about future native config loading remains; no
verification failure occurred. No token was added or changed. All required
browser regressions and the repository verification gate are green.

Completed in this worktree only, with edits confined to `docs/design/`,
`docs/DESIGN.md` and this task's Handoff. Staging and the commit are submitted
for the owner's explicit approval on `agent/design-017`; no push is performed.
The lead's formal design review is the next workflow step before S1b.

DONE

### Round 2 — the review's ten findings

Applied the ten accepted findings in `.agent/reviews/DESIGN-017-review.md` and
the lead's rulings above. The current copy table and DESIGN rules have been
corrected in place; the first round's verification is historical evidence and
is not evidence for these changes. In particular, its claimed 32-unit label
was actually 33 units. The corrected fixture is
`Terrace ABCDEFGHIJKLMNOPQRSTUVWX` (32 UTF-16 units), and `invalid-long` adds
one `Z` to make exactly 33.

Implementation locations below use `F` for
`docs/design/visual-directions/frost/back-office`. F1 is in `F/tables.js`
and `docs/DESIGN.md`; F2 is in `F/tables.html` and `F/tables.js`; F3 and F4
are in `F/tables.js`; F5 and F6 are in `F/tables.js`; F7 is in
`docs/design/SITEMAP.md`; F8 is in `F/tables.html` and `F/tables.js`; F9 is
in `F/tables.js`; F10 is in `F/tables.js`, `F/tables.css` and
`docs/DESIGN.md`. All ten have dedicated coverage in
`docs/design/checks/design017.cjs`, as detailed below.

| Finding | Change | Dedicated verification in `design017.cjs` |
|---|---|---|
| F1 — status commands masqueraded as Save | Removed the status-command form entirely. The clicked row's status action becomes inert; pending and unknown use the page status. A reread determines the row's ordinary Deactivate/Reactivate action. No Save or resend control is shown for these commands. DESIGN and the copy table now distinguish forms from one-click commands. | Both pending status commands show the correct verb, no form and no visible Save. Unknown performs one reread, uses no save/draft wording, and changes the row action to match the observed record. Only pressing that ordinary row action issues the next command. |
| F2 — M-6 copy drift | Different-manager acknowledgement and form now use the exact reviewed titles and bodies from `apps/back-office/src/copy.ts` and DESIGN-012's shell. Both top-bar and M-6 logout use the reviewed title, body, Keep this draft and Discard changes and log out. Pending/unknown logout adds a separate request-context paragraph without changing those strings. | Exact title/body assertions for both other-manager steps and both logout callers. Keep returns to the caller. The acknowledgment hides Log out as the reviewed shell does. |
| F3 — Discard dropped authoritative answers | Each sent command captures its record identity, label and originating editor independently of the form DOM. Discard marks that draft departed, without cancelling its answer. A held or late successful response inserts/replaces its record silently, with no reopened form, focus change or result announcement. | Create and rename, each with the answer arriving before Discard and after Discard. All four walks assert the saved row, closed form, absent announcement and preserved focus. |
| F4 — session transition invented unknown | Removed generation-based answer cancellation and the invented pending-interrupted copy. The fixture holds answers behind the session gate and processes them according to C2 on resumption. A definite session refusal clears pending, keeps the draft and makes no reread; only a real unknown result rereads. No command is resent. | Pending rename across M-6 and BO-01, each answered success, SESSION_IDLE or unknown. Checks distinguish each result, assert one command, and require a reread only for unknown. |
| F5 — invalid longest label | Corrected the overflow record to 32 units and the invalid fixture to 33. Historical measurement wording is corrected above; new geometry is recorded below. | Length assertions at both viewports, successful save of the unchanged longest stored label, and exact 33-unit invalid fixture. |
| F6 — stale page announcement | Form opening and command submission clear the prior page result and Phase 2 annotation. | Saved result followed by another form and an unknown save; Phase 2 refusal followed by a new status command. No old success/refusal remains. |
| F7 — undefined sitemap tags | Create/edit is `[INLINE] Table create / edit — non-modal panel`; row actions are `[INLINE]`. Added a dated change note using the existing vocabulary. | Source assertion rejects `[PANEL]` and `[ACTION]` and requires the defined inline entry. |
| F8 — dismiss-only retry | Removed the form failure's Try again button. BO-05's definite failure says “Nothing was saved. Your draft is kept. Press Save to try again.” The shared inventory row is unchanged; read failure still offers a real Try again. | Failure retains the draft with no Try again button; explicit Save sends exactly one command. Existing failed-read recovery still runs. |
| F9 — missing focus states | Pending form focus goes to the focusable status notice; failure/unknown return to Table label. Discard closes once and returns to its own opener, as clean Cancel does. Pending record actions remain inert; an Edit opener may receive programmatic focus without becoming actionable. | Pending and both result-focus paths, clean Cancel, dirty Cancel → Discard to the same row, and late-answer focus preservation. |
| F10 — pattern inconsistencies | New table and record actions are inert during pending; after unknown they are live, with another record behind departure. DESIGN points historical Leave without resending at the current configuration rule. BO-05 removes the Phase 5 day indicator. The duplicate holder has readable “Label in use” text instead of link-like underlining. | Pending control-state assertion; unknown → another record → Discard opens the right label; day indicator absent; holder text present with no link. |

The 37 registered states remain unchanged. `pending-deactivate`,
`pending-reactivate`, `unknown-deactivate` and `unknown-reactivate` now show
page results over the full-width table instead of a form. No new token or
shared artifact behaviour is introduced. Only BO-05's own files, its check,
DESIGN, the sitemap and this Handoff change in Round 2.

Focus and command lifetime are intentionally separate. During a pending
command, the opening Edit control is `aria-disabled` and outside the tab order;
its click handler is inert. It can receive programmatic focus after Discard
while the answer is still outstanding. In the empty-create case the visible
New table opener remains present through the outstanding answer. A late row
replacement preserves the current control's identity rather than shifting focus
or announcing success for a departed draft.

For S1b, session management remains the existing implementation. This fixture
models a selected answer being held behind its gate; it does not cancel a
network request, infer a result from a session transition, or introduce a new
session outcome. A different manager still destroys the prior editor state.
The immutable command snapshot exists only to consume the eventual authoritative
record; it is not offered to the next manager as a draft.

### Round 2 verification and replacement measurements

The lead ran all five checks against the uncommitted Round 2 tree at 10:13
on 2026-10-21: `design017.cjs` passed 305/305, `design016.cjs` passed
399/399, `design014.cjs` passed 288/288, and `design013.cjs` and
`design012.cjs` reported no failures or errors. These are the lead's results;
design017b did not rerun checks during the paperwork-only finish.

The following measurements were taken by the lead from `design017.cjs`'s
`measurements.json`. They supersede the Round 1 geometry and counts above
for the current tree, including the corrected 32-unit longest label.

| Measurement | 1440×900 | 1920×1080 |
|---|---|---|
| Frame width and x | 1440px at x 0 | 1440px at x 240, centred |
| Rail width | 220px | 220px |
| Top bar | 1220×64px | 1220×64px |
| Content padding | 24px | 24px |
| Form panel | 459×292px at x 957 | 459×292px |
| Label field | 417×40px | 417×40px |
| Overflow owner | 1220×836px | 1220×1016px |
| Sticky table header | y 64 | y 64 |

At 1440×900, overflow scrolls 650px inside its owner. The lead confirmed
that `state geometry overflow` and `counts match overflow` pass at both
sizes with the corrected 32-unit longest label.

DONE
