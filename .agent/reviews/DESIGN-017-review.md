# DESIGN-017 review — BO-05 Tables (slice E1)

Reviewer: Claude (Opus 5.5), 2026-10-21. Branch `agent/design-017` at `026ef6e`, in the worktree
`restaurant-pos-wt/DESIGN-017`, against `development...HEAD`. Built by a Codex designer (`design017`).

Authorities read: the task file `.agent/tasks/DESIGN-017-tables.md` with its Handoff and the lead's verify note;
consult C2 (`.agent/reviews/ARCH-019-first-back-office-form.md`) in full; PRD FR-B2, FR-C8 and AC-35;
BOUNDARIES B-13, B-20 and B-24; `docs/design/SCREEN-INVENTORY.md` (the shared general failures at `:83-107` and
BO-05); `docs/design/SITEMAP.md` §1 and BO-05; `docs/DESIGN.md`'s shared back-office patterns (`:1457-1474`) and the
new configuration-forms section (`:1484` onwards). To check the copy table against what is already reviewed and built,
I also read `F/shell.html`, `F/shell.js`, `F/login.html`, `F/login.js` and `apps/back-office/src/copy.ts`.

## 1. Verdict

**findings** — ten findings. Two are of high severity: a status-command panel whose Save re-sends the command, and a
copy table that contradicts M-6 copy already reviewed and built. Three are of medium severity: an authoritative answer
dropped after Discard, an invented unknown-outcome state with no reread, and a "longest permitted" label that is 33
units long. Five are of low severity. Nothing breaks a boundary. The non-modal decision, the modal-dialog rule, the
reactivation-refusal recovery, the absence of seats and area, and the marking of the Phase 2 state are sound.

## 2. Findings

### F1 (high) — The status-command panel turns Save into a "send again" control, and its copy speaks of a save and a draft

**Where.** `F/tables.js:135`: a row's Deactivate or Reactivate opens a panel (`openForm(id, 'deactivate'|'reactivate')`)
and submits at once. `F/tables.js:28-33` gives that panel a read-only label and the ordinary `Save`
(`F/tables.html:26`). `F/tables.js:81` (pending notice), `:58` with `copy.unknown` (unknown notice) and `:91`
(departure body) reuse the edit form's words. Copy table rows at task file `:313`, `:317-319`, `:323` and `:329`;
`docs/DESIGN.md` *BO-05 choices and copy* ("Pending or unknown status commands retain a panel with a read-only label,
Save to issue the same explicit command"). The Handoff (`:221-223`) says "Save deliberately issues the same status
command after pending ends".

**What is wrong.** One control (`#save-table`, named "Save") and one set of notices serve two different kinds of
command, and the one they do not fit is hidden behind the one they do.

- For a rename, "Save and Cancel as ever" (C2 §6, the `failed`/`unavailable` row) means the manager's own draft can be
  submitted again. A deactivation has no draft. The panel exists only because the command was sent, and after an
  unknown outcome its one enabled action re-issues that same command. That is the "send again" control C2 §6
  forbids, under another name. The harmless manual resend C2 relies on ("a repeated deactivation or reactivation is a
  no-op answered with the record") is already available from the row's own Deactivate or Reactivate button, which
  reflects the reread state.
- The copy is wrong for this command. During a pending deactivation the panel says "Saving… / Wait for the result.
  Your draft is kept." After an unknown outcome it says "Your draft is kept; nothing was sent again." The departure
  dialog says "The save may or may not have succeeded … Stay to keep the draft". Under ADR-011 rule 24, S1b copies
  these words.
- The shared rule in `D` (the *Command results* paragraph at `:1514`) is written for forms with drafts. It does not say
  what a one-click status command shows.

**Authority.** C2 §6, the result table's unknown row ("offer Save and Cancel as ever, and no 'send again' control") and
its bullet on manual resends. ADR-011 rule 24, by way of the task's Objective (every word S1b shows).

**Failing scenario.** On `?state=unknown-deactivate` the panel is titled "Deactivate Table 2", with a read-only label,
the notice "Outcome not confirmed … Your draft is kept; nothing was sent again.", and an enabled **Save**. Pressing
Save sends a second deactivation (`submit` → `commands++`). A manager reading "Save" in a deactivation panel cannot
tell that it re-sends the command. S1b, copying the table, would build "Saving…" for a deactivation.

**Proposed fix.** Do not open a form panel for a status command. Show pending as the row's own action disabled, with
a page-level status such as "Deactivating {label}…". Show the unknown outcome in the page status region with the reread
row behind it ("{label}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again."),
and leave the row's own button, which reflects the reread, as the manager's explicit and harmless path. If the
designer keeps a panel, its primary action must be named after the command ("Deactivate" / "Reactivate"), and the
pending, unknown and departure copy must be written per command, with no "save" or "draft". Either way, `D` should
state the status-command rule beside the form rule.

### F2 (high) — The copy table contradicts the reviewed and built M-6 copy, while the Handoff says S1b reuses it

**Where.** Copy table rows at task file `:327-330` (logout departure), `:337-339` (other-manager acknowledgement and
form), and `F/tables.js:124-128`, `:132`. Compare `apps/back-office/src/copy.ts:50-64` (built in PHASE0-011d2 from
DESIGN-015) and `F/shell.js:67-68`, `:119-120`, `F/shell.html:50-53` (DESIGN-012, reviewed).

**What is wrong.** The same decisions carry different words in the two places:

| Decision | Built and reviewed (copy.ts, shell) | DESIGN-017 copy table |
|---|---|---|
| Different-manager acknowledgement, title | "Sign in as a different manager?" | unchanged "Your session timed out" |
| Acknowledgement, body | "The current manager's unsaved changes will not be available to the manager signing in." | "Your unsaved changes will not be available to the manager signing in. Continue to sign in with a different manager's username and password." |
| Other-manager form, title and body | "Sign in as a different manager" / "Enter your own username and password. The current manager's unsaved changes will not be available to you." | no title or body change; only the actions are listed |
| Log out with a draft (from M-6), body | "The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session." | "Your edits have not been saved. Stay to keep editing, or discard them before leaving." |
| Log out with a draft, actions | "Keep this draft" / "Discard changes and log out" | "Stay" / "Discard" |

The Handoff (`:349-351`) says "S1b reuses the already reviewed BO-01/M-6 failure, cooldown and logout handling; this
slice illustrates only their table-draft composition". The table above it then gives different words as "Exact
text". In the fixture, M-6's own Log out (`#idle-logout`, `F/tables.js:132`) opens the table's Stay/Discard decision,
not the built confirmation. The two sources cannot both be followed.

**Authority.** ADR-011 rule 24 (the builder copies the design's words, so two designs for one control are a defect).
The task's Constraints: "Do not change DESIGN-012's or DESIGN-016's shared behaviour except as Part B adds rules".

**Failing scenario.** S1b's builder copies the table's acknowledgement body into `Reauth.tsx`. That changes built M-6
copy and breaks its existing client tests. Or the builder keeps the built copy, and C2 C2's browser case, driven by the
table's accessible names, is written against words the screen does not show. The same title, "Log out and discard your
changes?", ends up with two bodies and two button pairs, depending on whether Log out was pressed in M-6 or in the top
bar.

**Proposed fix.** Remove the M-6 rows from the copy table, or replace them with the built strings and a pointer to
`copy.ts`/DESIGN-015. Make `#different-manager`, `#choose-manager` and `#idle-logout` in the fixture reproduce the
built titles, bodies and actions. For the top-bar Log out with a draft, either reuse the built logout confirmation
verbatim ("Keep this draft" / "Discard changes and log out") or state in `D` why the top-bar path differs. The task
names "Stay" and "Discard" only for the form's departure decision.

### F3 (medium) — An authoritative answer that arrives after Discard is dropped, leaving the list stale

**Where.** `F/tables.js:36` (`closeForm` increments `generation` and clears `settledResponse`), `:82` (a response is
applied only if `stamp===generation`), `:62` and `:102` (a response held during the decision is thrown away on
Discard). `D` *Departure* (`:1528`): "Discard drops the local draft … Neither cancels an already-sent server command".

**What is wrong.** Discard is meant to drop the draft. In the fixture it also drops the server's answer to a command
already sent. When the departure stays on BO-05 (Cancel, Escape, browser Back, or the rail's own Tables entry), the list
keeps showing the old record, although the server has committed the new one. `D` says nothing about the late answer,
so S1b has only the fixture to go by.

**Authority.** C2 §3: "The client replaces its copy of the record with the answer." ARCHITECTURE §13 as C2 quotes it:
"Responses return authoritative state."

**Failing scenario.** On `?state=rename`, type "Window 2", press Save, then press Cancel while pending. The decision
opens. The fixture's answer, `saved`, arrives after 450 ms and is held. Press Discard. The list still shows "Table 2"
Active, while the modelled server holds "Window 2". If the manager then creates a table named "Window 2", it is refused
`DUPLICATE`, and no visible row explains why.

**Proposed fix.** Add to `D`: after Discard, a late authoritative answer still replaces or inserts its record in the
list. It does not reopen the form, does not move focus, and announces nothing (or, if the designer prefers, triggers one
non-interactive list reread). Make the fixture do the same.

### F4 (medium) — "Pending interrupted by session" invents an unknown outcome with no reread

**Where.** `F/tables.js:105`: when `expire()` runs while pending, it increments `generation`, which drops the in-flight
answer, and sets the result to `unknown` with the copy "The outcome could not be confirmed. Your draft is kept;
nothing was sent again." `F/tables.js:116`: the same manager's resumption shows that state and does no reread. Copy
table row at task file `:325`.

**What is wrong.** C2 §6's table is the binding mapping from the core's result to what BO-05 does. Nothing in that table
turns a session transition into an unknown outcome. A command in flight when M-6 or BO-01 appears still gets an answer:
`ok`, which is applied; `SESSION_IDLE`, which is definite with nothing applied ("the manager presses Save again"); or
`UNAUTHENTICATED`, which the session handles itself. The fixture discards that answer and declares the outcome unknown.
Its unknown state also skips the reread that C2's `failed`/`unavailable` row and `D` *Command results* ("reread once")
require for every unknown outcome.

**Authority.** C2 §6, the result table, including its `SESSION_IDLE` row and its unknown row. `D` *Command results*
(`:1514`).

**Failing scenario.** On `?state=saving`, press Alt+I, then resume as m.iqbal. The form shows "Outcome not confirmed"
over a list that was never reread. In the fixture, the pending `saved` answer was silently discarded. An S1b that
follows the fixture would abort or ignore in-flight answers when the session changes. That is behaviour no consult
has decided, and it can hide a committed change.

**Proposed fix.** Delete the "Pending interrupted by session" row and the `generation++` in `expire()`. Let the held
answer settle by C2's table after resumption, as the departure decision already does with `settledResponse`. If the
designer believes a real transition can lose the answer, raise it as a question for the architect rather than drawing it.

### F5 (medium) — The "longest permitted" label is 33 UTF-16 units, so the 32-unit boundary is never drawn

**Where.** `F/tables.js:6`: `longest='Terrace ABCDEFGHIJKLMNOPQRSTUVWXY'`, used by `overflow` (`:156`) and
`invalid-long` (`:167`, `longest+'Z'`). The Handoff (`:232`) says "exactly 32 units", and the measurements section
(`:588-590`) says "The 32-unit label remains intact".

**What is wrong.** "Terrace " is 8 units, and A through Y is 25 letters, so the label is 33 units. I confirmed this with
`grep -noE "'Terrace [A-Z]{25}'"`, which matches line 6. The form itself refuses this value: Save trims it, finds a
length over 32, and shows "Use 32 characters or fewer." The overflow state therefore shows a record the server's schema
and check constraint cannot hold. The `invalid-long` state draws 34 units, not 33. The check script asserts only that
the text is present (`design017.cjs:30`), never its length, so the green run did not catch this.

**Authority.** C2 §4 (a label is 1 to 32 characters, in UTF-16 units). The task, Part A item 1 ("the longest
32-character label") and acceptance criterion 5.

**Failing scenario.** On `?state=overflow`, press "Edit Terrace ABCDEFGHIJKLMNOPQRSTUVWXY — active" and then Save
without changing anything. The field shows "Use 32 characters or fewer." on a value that the list showed as stored.
Copying the fixture into S1b's test data would produce a row the server refuses.

**Proposed fix.** Use `'Terrace ABCDEFGHIJKLMNOPQRSTUVWX'`, which is 32 units. `invalid-long` then becomes exactly 33,
the real boundary. Add a length assertion to `design017.cjs`, re-measure, and correct the Handoff's quoted measurements.
The overflow measurements were taken at a longer label, so their "no horizontal overflow" result will very likely hold,
but it should be re-observed.

### F6 (low) — The page's result announcement is never cleared, so an old success sits beside a later failure

**Where.** `F/tables.js:15` (`status()`) is set by `applyCommand`, by the Phase 2 refusal and by the initial states. It
is cleared only by `resume(false)`. `openForm`, `closeForm` and `submit` never clear it, and `#phase-note` is never
hidden again. `D` does not say when the result is withdrawn.

**What is wrong.** One region holds every command's result, and the region is never reset, so the state in which it is
wrong never appears in a freshly loaded drawing. Every check starts from a fresh `?state=` load (for example
`design017.cjs:41` asserts that `#table-status` is hidden on a fresh `rename`), so the suite never observes this.

**Authority.** C2 §6 ("The client never infers success …"; the notice says the outcome could not be confirmed). The
task's Objective (every word S1b shows, which includes when it stops showing them).

**Failing scenario.** On `?state=default`, edit Table 1 to "Patio" and save; the page shows "Patio saved." Then edit
Table 2, choose "Unknown; list reread", and save. The form says "Outcome not confirmed" while the page status above it
still says "Patio saved.", so a success and an uncertainty are shown together.

**Proposed fix.** In `D`, state that the page result is cleared when a form opens or a new command is sent. Make the
fixture do the same, and hide `#phase-note` with it.

### F7 (low) — The sitemap introduces node types its own §1 does not define

**Where.** `docs/design/SITEMAP.md:266` (`[PANEL]`) and `:268` (`[ACTION]`). The node-type table at `:62-68` defines
only `[SCREEN]`, `[MODAL]`, `[SHEET]`, `[INLINE]` and `[GLOBAL]`. The document's header records every retyping and
added node with a dated note (`:11-46`), and this change adds none.

**What is wrong.** The task asked for "[INLINE] Label in use — refused" and a reactivate action. The diff does that, but
it retypes the create/edit node to an undefined `[PANEL]` and adds an undefined `[ACTION]`. §1 says "the distinction
below is the whole point of this document".

**Authority.** SITEMAP §1. The task, Part C item 3.

**Failing scenario.** A downstream reader looks up `[PANEL]` in §1 and finds nothing. By §1's own definitions, the
non-modal panel is an `[INLINE]` state (no overlay, no route), and the action is not a node at all.

**Proposed fix.** Use `[INLINE] Table create / edit — non-modal panel` and fold the reactivate action into the
screen's line (or write it as an `[INLINE]` row action). Alternatively, add the two tags to §1 with a dated note in the
header, as the 2026-09-14 retyping did.

### F8 (low) — One name, "Try again", means two different things, and the general failure tells a manager to ask a manager

**Where.** `F/tables.js:16`: the general failure's "Try again" dismisses the notice and focuses the label; it sends
nothing. `F/tables.js:22-23`: the read failure's "Try again" repeats the read. Copy table rows at task file `:320-321`.
The body text comes from `I:88`'s shared row: "Try again. If the problem continues, ask a manager for help."

**What is wrong.** The same accessible name, `button "Try again"`, does what it says in one state and does nothing in
the other. After pressing it in the failure state the form looks exactly like a fresh edit, with no sign of what
happened. Separately, the body's "ask a manager for help" was written for POS-01 and BO-01, where the person may not be
a manager. On BO-05 the reader is always a signed-in manager.

**Authority.** The inventory, `I:94` ("choose recovery by the operation"). The task's Objective (every word).

**Failing scenario.** On `?state=failure`, press "Try again". The notice disappears, nothing is sent, and the draft
looks the same as before the failed Save. The manager may believe the retry happened.

**Proposed fix.** Either make the failure's action resubmit the draft (the refusal was definite, so a resend is
harmless), or remove the button and write the body as "Your draft is kept. Press Save to try again." Propose
manager-appropriate wording for `I:88` when the surface is the signed-in back office. That is the designer's file, but
the row is shared, so the lead should rule on it.

### F9 (low) — Focus after pending, failure, unknown and Discard is unspecified, and the fixture loses it

**Where.** `F/tables.js:80` disables Save and the label while Save holds focus, so focus falls to `<body>`. `unknown()`
(`:53-60`) and the failure branch (`:66`) do not place focus. `F/tables.js:102` together with `:137` calls `closeForm`
twice on Discard. The second call has no `editor`, so focus goes to New table instead of the row's Edit.

**What is wrong.** Part A item 5 names focus after field error, after `DUPLICATE`, after save, after Cancel and after
reopening; all of these are handled. But the same "after Cancel" path, when it goes through Discard, lands on a
different control, and focus after pending ends is undefined. A keyboard user is returned to the top of the document.

**Authority.** The task, Part A item 5.

**Failing scenario.** On `?state=rename`, type, press Cancel, then Discard. Focus is on "New table", not on "Edit
Table 2 — active". Separately, Save with "Unknown; list reread" leaves `document.activeElement` as `<body>` when the
notice arrives.

**Proposed fix.** In `D`: during pending, move focus to the form's status notice (made focusable) or keep it on a
non-disabled control. After a failure or an unknown outcome, focus the label. After Discard, focus the opener, as clean
Cancel does. Remove the double `closeForm`.

### F10 (low) — Small inconsistencies between `D`, the fixture and the Phase 1 drawing

1. `D` *Departure* (`:1528`) lists "another record" among the departures that need Stay or Discard while pending or
   unknown. The fixture instead disables every row's Edit, Deactivate and Reactivate, and New table, while pending
   (`F/tables.js:21`, `:26`). Either is defensible; S1b needs one rule.
2. `D:1473`, from DESIGN-012, still calls the pending/unknown action "Leave without resending". The new section and the
   copy table call it "Discard". Reconcile `D:1471-1474` with the new section.
3. Every state of the Phase 1 drawing shows "Business day · Tue 6 Oct" (`F/office.js:36`). The business day arrives with
   Roadmap Phase 5, and `phase0` removes the indicator. The Handoff disclaims it (`:239-240`), but the artifact does not.
   Acceptance criterion 4 asks that no later-phase state be presented as Phase 1. Proposed fix: suppress `.office-day`
   on `tables.html`, or label it as review context in the artifact itself.
4. The duplicate's holder row is marked only by an underline (`F/tables.css:16`). An underline reads as a link, and the
   mark is not exposed to assistive technology. Consider a text marker, or the selected-row treatment.

## 3. What I ran and what I did not

**Observed.**

- `git status --porcelain` was empty before and after my runs, and `git rev-parse HEAD` returned
  `026ef6eea38fd59e02709ca47e64c35e71d6ce69` both times. The tree did not move during the review.
- `git diff --stat development...agent/design-017`: 15 files. Only the task file, `docs/DESIGN.md` and paths under
  `docs/design/**` changed. Nothing under `apps/`, `packages/`, `db/`, `e2e/` or `docs/design/tokens/`.
- `npm run verify`: typecheck passed; **94 test files, 3,753 tests passed**. The only warning was the existing Vite
  native-config warning.
- `grep -noE "'Terrace [A-Z]{25}'"` on `tables.js` matched line 6, which confirms the 33-unit label (F5).
- Every custom property `tables.css` uses is defined under `docs/design/tokens/`. The four utility classes
  `tables.html` adds (`office-push`, `office-space-top`, `office-small-space`, `office-empty-title`) exist in
  `office.css`. I found no raw colour, size or weight in `tables.css`.
- The copy comparisons in F2 and F8 are direct reads of `apps/back-office/src/copy.ts`, `F/shell.js`, `F/shell.html`,
  `F/login.html` and `F/login.js`.

**Not run.**

- **No browser check ran.** I tried `design017.cjs` once (with `PLAYWRIGHT_MODULE` set and the evidence directed to
  `/tmp/design017-review`), and the permission layer refused it as needing approval. The task requires the owner's
  approval for each run. I did not run `design012.cjs`, `design013.cjs`, `design014.cjs` or `design016.cjs` either.
  Their pass counts in the Handoff and the lead's note are theirs, not mine. I have not observed any geometry,
  stickiness, overflow or focus in a browser.
- **No mutation run.** Each failing scenario above is traced from the source line by line: `generation`/`stamp` for
  F3 and F4, `status()` call sites for F6, the `closeForm` double call for F9, and the `#save-table` reuse for F1. I
  did not execute them. F5 is the only finding confirmed mechanically. I did not mutate in memory either; every
  scenario can be re-proven in a browser by following its steps.
- I did not read `.agent/DECISIONS.md`, as a worker. Owner rulings are taken as the task file quotes them.

## 4. Cleared

- **Boundaries.** No seats, area, current order or timestamp anywhere (Q10, C2 §3). The rows hold Label, Status and
  Actions only. The empty state is a real starting state with a creation path, and nothing is seeded (B-24). A refusal
  changes no row (B-20). The real manager is named in the top bar, and the other-manager path names Ratna Ayu (B-13 as
  the task applies it). `P/tables.html` lost its seats, its current-order column and its modal.
- **The non-modal decision** is argued against DESIGN-012 F1 and drawn. Log out, the rail and the incident actions stay
  reachable through editing, pending and unknown, and each goes through the departure decision. Only the departure
  decision is modal, and under N2 it repeats the kitchen emergency. This is a legitimate choice, explicitly granted by
  C2 §7's *For E1*.
- **C2 §7's modal-dialog rule** is copied into `D` faithfully in substance: closed at BO-01 with state kept and not
  treated as Cancel, reopened with `showModal()` for the same manager before focus, kept behind M-6 visible and inert,
  destroyed by a different manager. The fixture's `bo01-decision` and `reauth-decision` walks follow it (by reading
  `expire()` and `resume()`).
- **The label rules** follow C2 §4: trim, then check empty, then length in UTF-16 units, then Unicode Cc; no `maxlength`
  truncation; uniqueness among active labels only, case-insensitively; renaming an inactive table allowed; inactive
  labels may repeat. F5 is a fixture-data error, not a rule error. The 32-unit limit is unchanged.
- **The reactivation refusal recovery** (rename the inactive record, then reactivate it separately) matches C2 §4.
  Reactivation never takes a label.
- **No confirmation for deactivate or reactivate**, argued as C2 §6's last bullet allows.
- **`DUPLICATE`** is placed on the label, the draft is kept, the list is reread and the holder is shown. `NOT_FOUND`
  and `VALIDATION_FAILED` use the general failure with the draft kept, and `NOT_FOUND` rereads. One command at a time:
  `submit` returns while pending.
- **An unknown outcome on a rename or create** keeps the draft and the form, rereads, never infers success and never
  resends automatically. A reread failure says the list could not be refreshed. The objection in F1 is to the status
  panel only.
- **Subject-correct walks** (DESIGN-011 P1): every Edit opens its own row's label, and Save replaces that row; counts are
  derived from the drawn rows (P2). Checked by reading `openForm`, `applyCommand` and `renderList`.
- **The Phase 2 refusal** names the table and the order, leaves the row active, and is marked "Phase 2 only" in the
  artifact (`#phase-note`), the manifest label and the gallery text.
- **Part C links.** `office.js` resolves `tables` to Frost. `menu.html` and `report-detail.html` each changed one
  authored link. The only edit to `design014.cjs` is its expected-count change from 36/7 to 35/6; no assertion was
  removed. `manifest.js` registers the 37 states, matching `WF.states` in `tables.html`.
- **The inventory and sitemap text** for BO-05 carry C2's *Stale text* 2 wording: the reactivate purpose, "label in use
  — create, rename or reactivation refused", "reactivated table", and the Phase 2 refusal kept and marked. F7 concerns
  only the sitemap's node tags.
- **The BO-01 held-draft copy** matches DESIGN-016's `login.html` word for word.
- **No `beforeunload`** handler anywhere in the fixture. No password is prefilled or kept: the fixture clears the
  password fields on every transition.
