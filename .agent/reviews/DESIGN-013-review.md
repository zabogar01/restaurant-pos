# DESIGN-013 review — BO-13 print incidents (slice C)

Reviewed 2026-10-06 by the reviewer (Claude Opus 5.5; the designer was Codex
`gpt-6-astra`). Branch `agent/design-013` at `0c9f0f0`, diffed against
`development` (13 files, 833 insertions, 30 deletions).

> **Current verdict (round 2, at `964eca8`): findings** — all eight round-1
> findings and the I-8 wording are closed by reading; three new low findings
> came with the fixes. See *Re-review — round 2* at the end of this file.

## 1. Verdict

**findings** (round 1, at `0c9f0f0`) — eight: two medium, six low. None breaks a boundary outright.
The two medium findings are each a place where the artifact, taken as the
behavioural specification a builder will follow, leads to a wrong or missing
recovery action on a kitchen incident.

No browser was run for this review (see section 3). Every finding below is
derived from reading the source, and is labelled as such. Findings 1 and 2
should be confirmed in a browser before they are acted on; each gives the
exact steps.

## 2. Findings

### F1 (medium) — An `UNKNOWN` incident loses its reprint action after one reprint, and the reread has only a happy ending

**Where:** `docs/design/visual-directions/frost/back-office/incidents.js:60`
and `:88` (reprint refused and disabled while `result` is `unknown`), `:57`
(the reread always resolves to `PRINTED`), and
`docs/design/checks/design013.cjs:40`, which asserts the disabled reprint as
correct.

**What is wrong.** The same delivery state is drawn with two different
affordances. In `kitchen-unknown`, `cancel-unknown` and `receipt-unknown` the
delivery is `UNKNOWN` and *Reprint* is enabled, with "Check the printer before
reprinting". In `kitchen-reprint-unknown`, `cancel-reprint-unknown` and
`receipt-reprint-unknown` the delivery is also `UNKNOWN`, but *Reprint* is
disabled and the only action is *Check delivery status*. The fixture then
resolves every reread to server-confirmed `PRINTED`, so the artifact never
draws what the row looks like when the reread comes back still `UNKNOWN`, comes
back `FAILED`, or cannot be read. As drawn, a reread that stays `UNKNOWN`
leaves the row with a disabled reprint for good; the only exit is the checked
clearance. The disabled state is also written into the URL context
(`incidentResults`) and survives a reload.

**Authority.** FR-E3: `FAILED` and `UNKNOWN` kitchen work are shown as
persistent emergency incidents "with an explicit reprint action". FR-H4 makes
a cancellation with `UNKNOWN` delivery the same kind of incident. The task's
Part B1 asks that the page "rereads before saying more, and never offers an
automatic resend"; a manual reprint after the reread is not an automatic
resend, so B1 does not require the dead end. The incident is application-wide
(FR-E3, AC-33), and the POS counterpart keeps *Reprint cancellation* on its
`UNKNOWN` cancellation (`frost/pos/incidents.html:78–85`), so the same incident
would be reprintable at the POS and not at the desk.

**Failing scenario.** The kitchen printer is out of paper. The manager reprints
Table 1 round 2; the request times out, so the result is `unknown`. The reread
returns `UNKNOWN` again because the printer never reported. The manager refills
the paper and has no reprint action on the row. To confirm in the fixture: open
`?state=kitchen-reprint-unknown` and note that *Reprint ticket* is disabled
while the delivery cell reads `UNKNOWN`; no review control produces a reread
that is not `PRINTED`.

**Proposed fix.** Draw the reread outcomes as states: still `UNKNOWN` (reprint
enabled again, with the check-the-printer wording of the base `UNKNOWN` state),
`FAILED`, and reread failed (with *Try again*). Disable reprint only while a
request or a reread is in flight. Add a review control for the reread response
and change the check at `design013.cjs:40` to assert that reprint is disabled
during the reread and available after a non-`PRINTED` reread.

### F2 (medium) — Focus restoration after a row re-render is not tied to the incident, so keyboard focus can jump to another incident's reprint, or throw

**Where:** `incidents.js:107`.

**What is wrong.** When a row is re-rendered, the code looks at
`document.activeElement` anywhere in the document, reduces it to the word
`reprint` or `check`, and then focuses the control of that kind in the row
being re-rendered. It never checks that the focused control belonged to that
row. Two consequences follow from the code as written:

1. Focus moves from one incident's *Reprint* button to a different incident's
   *Reprint* button when the second incident's result arrives.
2. If the focused control is another row's *Check delivery status* and the
   re-rendered row has no such button (its result is `failed` or `printed`),
   `next` is `null` and `next.disabled` throws. The throw happens after the row
   is replaced but before `O.setIncidents(rows)` at `:57` or `:67`, so the
   global banner and the URL context keep the old delivery state.

**Authority.** Acceptance criterion 3 (a reprint "reports the result on the
incident it came from; no path turns a cancellation into work") and the task's
objective that each incident keeps its own identity through every result. The
reason B-16 gives applies directly: paper cannot be un-printed. A reprint is a
single ungated action on this page (ruling I-8), so a misdirected Enter key
prints.

**Failing scenario (not run; steps to confirm).** Open `?state=default`, set
*Next reprint response* to *Failed again*. Activate *Reprint cancellation*.
Before the result arrives, press Shift+Tab until focus is on *Reprint ticket*
in the kitchen row. When the cancellation's result arrives, its *Reprint
cancellation* button is enabled again and takes focus. The manager presses
Enter meaning to reprint the kitchen ticket and reprints the cancellation. The
fixture's 650 ms delay makes the window short; a real printer round trip will
not. For the throw: give the kitchen row a `sent` result, Tab to its *Check
delivery status*, and let another row's reprint resolve to *Failed again*.

**Proposed fix.** Restore focus only when `old.contains(document.activeElement)`,
and guard the missing control. State the rule in the Handoff for the builder:
an asynchronous result never moves focus away from a different incident.

### F3 (low) — The global emergency names one class and counts both, says `PRINTED` under "needs attention", and words the same incident two ways

**Where:** `office.js:84–85` and `:38`.

**What is wrong.** Three things share one banner string.

- With a kitchen ticket and a cancellation outstanding (the `default` state),
  the banner reads "Kitchen ticket needs attention · 2 unresolved · Table 1,
  round 2 · 19:58 · FAILED". The count includes the cancellation; the title and
  identity do not. In `overflow` it is "Kitchen ticket … 14 unresolved" for
  seven tickets and seven cancellations. The cancellation becomes visible in
  the global alert only once every work ticket is cleared.
- The banner appends the first incident's raw delivery. After a confirmed
  reprint that the manager has not yet cleared, it reads "Kitchen ticket needs
  attention · 1 unresolved · … · PRINTED". While a reprint is pending or sent
  it still says `FAILED` although the row says "Sending…" or "Awaiting result".
- The same incident (Table 1, round 2, 19:58) is "Kitchen ticket did not print
  · 1 failed ticket · … · Sent 19:58" on any back-office page before BO-13 has
  been opened, and "Kitchen ticket needs attention · 1 unresolved · … · 19:58 ·
  FAILED" on the same page afterwards. A builder is left with two wordings.

**Authority.** Task Part A2 ("visibly a cancellation in every state"), FR-H4
and B-16 for the first point; the task's constraint that slice A's shared
behaviour is extended only narrowly for the third. This is the shape the role
prompt asks reviewers to look for: one value shared across states that hides
the state where it is wrong.

**Proposed fix.** Give the banner per-class counts ("1 kitchen ticket · 1
cancellation"), choose one title wording and use it for both the default and
the carried context, and replace the raw delivery suffix with wording that is
true for an uncleared `PRINTED` incident ("printed, not yet cleared") or drop
it.

### F4 (low) — An incident cleared on the POS takes keyboard focus and reflows the table under the pointer

**Where:** `incidents.js:48–53` and `:118–120` (`remove(r, true)`).

**What is wrong.** The cleared-elsewhere path reuses the manager's own clear
path: it rebuilds every row and moves focus to the status notice. For an event
the manager did not cause, that takes focus away from whatever they were doing.
The row also disappears at once, so the next row moves up into its place. In
the `default` fixture the row that moves under a pointer aimed at *Reprint
ticket* is the cancellation's, with *Reprint cancellation* in the same
position.

**Authority.** Task Part B4 asks that the incident "leaves the table without
claiming the manager did it"; behaving exactly as if the manager had cleared it
(focus included) is a weaker form of the same claim. The misdirected one-click
reprint is the B-16 concern again.

**Proposed fix.** Announce through the live region without moving focus, and
keep a non-interactive "Cleared on the POS" row in place until the next read or
the manager's next action, so rows do not shift under a pointer.

### F5 (low) — The default composition offers a reprint of a work ticket whose line has since been cancelled, and the question is not raised

**Where:** `incidents.js:6–7`.

**What is wrong.** The fixture pairs `ticket-1` (round 2, 19:58, "1 × Burger,
1 × Fries", `FAILED`) with `cancel-1` (round 2, 20:02, "1 × Burger",
`UNKNOWN`). The kitchen row lists the Burger with no sign that it was voided
four minutes later, and offers *Reprint ticket* at full strength. Whether a
reprint of an immutable kitchen ticket (FR-E3) carries a line that has since
been voided, and what the page should say when it does, is not answered by
FR-E3, FR-H4 or B-16. The pairing is inherited from the POS artifact, so it is
not this designer's invention, but BO-13 is the first surface that shows the
two side by side with their lines.

**Authority.** Acceptance criterion 9 (every question raised and not ruled is
listed with a proposed answer). The Handoff's last section says no additional
product conflict was found.

**Proposed fix.** Raise it with the owner. A proposed answer for the lead to
weigh: the ticket is immutable and reprints as fired, and the kitchen row marks
a line that has an outstanding or delivered cancellation ("Burger — cancelled
20:02, see cancellation") so the manager reprints both knowingly. Until ruled,
a fixture that does not pair the two would avoid drawing an answer.

### F6 (low) — The cancellation row shows "Round 2" beside the cancellation's time under a "Round / time" header

**Where:** `incidents.js:78–79`, `incidents.html:19`.

**What is wrong.** The kitchen row reads "Round 2 · 19:58 WIB" and the
cancellation row reads "Round 2 · 20:02 WIB" under the same header, so round 2
appears to have two fire times. The Handoff explains that 20:02 is the
cancellation's time; the screen does not.

**Authority.** Task Part A1 ("the fire round and its time") and Part D's
decision record for table columns.

**Proposed fix.** Label the cancellation's time ("Cancelled 20:02 WIB") in the
cell.

### F7 (low, inferred from CSS) — *Check delivery status* inside an emergency row's result notice has a white border on a pale field

**Where:** `incidents.css:16`.

**What is wrong.** `.emergency-table .office-button:not(:disabled)` sets a
white border, which is right on solid red. The result notice inside the row is
the shared `.office-notice` (pale grouping blue), and the *Check delivery
status* button sits inside it, so a white button with a white border is drawn
on pale blue and its edge depends on the fill difference alone. I did not see a
capture; this is read from the stylesheet.

**Proposed fix.** Exclude buttons inside `.incident-result` from the emergency
border override so they keep the shared control stroke.

### F8 (low) — Fixture robustness: three paths that break a registered state

**Where:** `incidents.js:39`, `:120`, `:118`.

- `:39` dereferences `rows.find(...)` without a guard. Any reprint-result state
  opened with an `alerts` value that excludes its class (for example
  `?state=cancel-reprint-sent&alerts=kitchen`) throws and renders nothing. No
  authored link produces that URL today; line 40 has the guard and line 39 does
  not.
- `cleared-elsewhere` writes the remaining incident IDs into the URL, so a
  reload of that state shows two rows and no "cleared on the POS" notice. The
  state is no longer what its name says after one reload.
- The review control *Simulate Table 1 kitchen clearance on POS* is enabled in
  `loading` and `error`, where it renders the table underneath an unread page.

These affect the reviewability of the artifact, not the design. Guard line 39,
keep the notice when the state is `cleared-elsewhere`, and disable the control
until the list has been read.

### Note for the lead (not a finding against the work)

The I-8 row now ends "Whether a cancellation-ticket reprint counts is open with
the owner", exactly as the task worded it, under a table whose introduction at
`SCREEN-INVENTORY.md:979` says "Nothing below is open." The designer
followed the mandated wording; the contradiction is in the task's text and is
the lead's to resolve.

## 3. What I ran and what I did not

**Ran and observed.**

- `npm run verify` at `0c9f0f0`: typecheck passed; **46 test files, 2,758
  tests, all passed**. The Vite native-config-loader warning is present, as the
  Handoff says. No file under `docs/design/tokens/` changed, so this is a
  regression check only.
- Tree stability: `git status --porcelain` was empty and `HEAD` was `0c9f0f0`
  both before the first read and after the verify run.
- `git diff development...HEAD` for every changed file outside the new
  artifact, read in full; `incidents.html`, `incidents.css`, `incidents.js`,
  `office.js`, `mockup.js` and `design013.cjs` read in full.
- `grep -c "prototype/"`: **39** for `menu.html`, **10** for
  `report-detail.html`. A recursive grep of `frost/back-office` for
  `prototype/back-office/incidents` returns no match.
- Token existence: every custom property used by `incidents.css` that I
  sampled (emergency, emergency-text, emergency-secondary, warning,
  warning-surface, table-cell-tight-padding, text-13, text-18) is defined in
  `docs/design/tokens/frost.css`.

**Did not run.**

- **No browser check.** I did not run `docs/design/checks/design013.cjs` or
  `design012.cjs`. The task requires the owner's approval in the pane before
  each run, and this review ran unattended. The Handoff's 185/185 and 216/216
  results, the measurements table, and the claims for acceptance criteria 3, 4
  and 5 are therefore **not independently confirmed**.
- **No evidence inspection.** `/tmp/design013-evidence/` is outside the
  directories this session may read, so I saw no capture and no
  `measurements.json`. Every statement here about appearance is inferred from
  the stylesheets.
- **No mutation run** of any kind. Findings 1, 2, 4, 7 and 8 are inferred from
  the code paths cited; none was reproduced.
- No screen-reader, other-browser or device test.

**A limit of the committed check worth knowing.** `design013.cjs` drives every
reprint with the pointer and waits for each result before the next action, so
it cannot reach the interleaving in F2. It asserts the disabled reprint in F1
as the expected result (`:40`), and its "unknown rereads" assertion is
`check(true, …)`, which cannot fail. Its return path from BO-13 to the four
source pages uses the review-control links, which is the only path those pages
have, so I accept it.

## 4. Cleared

- **Acceptance criterion 1.** The artifact exists, imports `office.css` (which
  imports the tokens), and declares 29 states; `manifest.js` registers the same
  29 in the same order. State chips use a bare `?state=` link outside `.bo`, so
  switching state drops the carried incident context and each state starts from
  its own fixture. I checked this specifically because the URL context is a
  value shared across states.
- **Acceptance criterion 6.** Counts as above; the navigation entry, the banner
  action and the chip in `office.js` all target `incidents.html`.
- **Acceptance criterion 7.** The three inventory edits match the task's
  wording character for character, and the diff has exactly those three hunks.
  The wireframe annotation is one sentence with a correct relative link.
  `SITEMAP.md` is unchanged, and so are the four product documents.
- **Acceptance criterion 8, by reading.** No raw colour, size or weight in
  `incidents.css`, `incidents.html` or the changed parts of `office.js`. No new
  token. No success green: results use the shared neutral notice.
- **Rulings.** The reprint is one action with no gate, dialog or PIN (I-8,
  I-11). No audit wording appears on any result or notice. No report incident,
  row or third class is drawn (Q7). Times are `HH:MM WIB`; no business-day
  bounds are drawn.
- **B-16 and FR-H4 within the table.** A cancellation keeps `kind=cancel`, its
  own title, the "Stop the cancelled work" line, its own button label and its
  own result wording through every result; no code path changes a row's kind.
- **FR-E6 and AC-23.** Receipts are a separate lower table in pale amber with
  28px actions and a one-action *Dismiss*; emergencies are solid red with 36px
  actions and a checked acknowledgement before *Clear*. Placement, weight and
  dismissal all differ.
- **`UNKNOWN` versus `FAILED`.** `UNKNOWN` reads "May already have printed" and
  never says the kitchen has not seen the work; only `FAILED` says "Did not
  print".
- **Clearance.** *Clear* is disabled until the box is ticked and is refused in
  code as well (`incidents.js:49`); a new reprint unticks the box; no reprint
  result removes a row, including `PRINTED`, which matches the POS artifact's
  `reprint-printed` state.
- **Empty copy** states "Nothing outstanding / No unresolved print incidents"
  and makes no claim that anything printed. FR-G8 is stated on the receipt
  section and on every receipt result.
- **Shared-frame change.** `office.js` now writes the banner text with
  `textContent` rather than `innerHTML`, so the new URL-carried strings cannot
  inject markup. `shell.js` reads `O.kitchenIncident` and `O.kitchen` at load
  and is unaffected. The `design012.cjs` change relaxes one assertion from full
  URL equality to path plus `alerts`, as the Handoff discloses; nothing was
  removed.
- **Scope.** Nothing under `apps/`, `packages/` or `db/` changed, and the POS
  incidents artifact is untouched.

---

# Re-review — round 2

Re-reviewed 2026-10-06 by the same reviewer. Fix commit `964eca8`, diffed
against the round-1 commit `0c9f0f0`; `HEAD` was `6f142bd`, which differs from
`964eca8` only in the task file. Read against the task file's *Round 2*
rulings and the Handoff's *Round 2 — review fixes* section.

## R1. Verdict

**findings** — three new, all low. All eight round-1 findings and the I-8
inventory wording are **closed by reading the source**. No browser was run in
this round either, so the Handoff's 371/371 and 216/216 results remain the
designer's evidence, not mine. Of the three new findings, N1 is the one I
would fix before the artifact is built from: it is the round-1 theme (an
uncertain outcome worded as a known failure) on a path that F1's fix opened.

## R2. Round-1 findings

| Finding | Status | What I checked |
|---|---|---|
| F1 reprint dead end on `UNKNOWN` | **Closed** | `incidents.js:93` and `:121` disable reprint only while `result` is `pending` or a reread is in flight. The reread takes its response from a new review control (`:83`) and draws `read-unknown`, `read-failed` and `read-error` (*Try again*), with twelve new registered states. `design013.cjs:40` and `:50–70` now assert the busy state, the actual outcome and the restored reprint; the `check(true, …)` is gone. See N1 for a path the fix opened. |
| F2 focus crosses incidents or throws | **Closed** | `incidents.js:141–148` restores focus only when the old row contained it (`old.contains(active)`), looks up the control inside the new row, and falls back to that row's result region or the row itself when the control is missing or disabled. No unguarded dereference remains. The builder rule is stated in the Handoff. `design013.cjs:72–92` adds the keyboard interleaving with fixture timers paused. |
| F3 banner | **Closed** | `office.js:38` uses one fixed title; the default identity and the identity `setIncidents` builds for a single kitchen ticket are the same string. Counts are per class (`:84–86`), and no delivery value is appended. `design012.cjs` has no assertion on the old title and is unchanged; `shell.js` reads the title at load and follows it. |
| F4 cleared on the POS | **Closed as ruled** | `incidents.js:66–77` leaves the row in place as a disabled, muted *Cleared on the POS* marker, announces through a separate visually hidden live region, and does not move focus. See N2 for the moment the marker retires. |
| F5 fixture pairing | **Closed** | `cancel-1` is Table 4 (`incidents.js:7`). No kitchen row in `default` or `overflow` shares an order and round with a cancellation row. The question, my proposed answer and the POS artifact's identical pairing are in the Handoff. |
| F6 cancellation time | **Closed** | `incidents.js:112` renders "Cancelled 20:02 WIB"; the banner uses the same word. |
| F7 result-button border | **Closed** | `incidents.css:16` excludes buttons inside `.incident-result` from the emergency override, so they keep the shared stroke and text colour. |
| F8 fixture robustness | **Closed** | `:42` and `:44` guard the missing class; `:168` restores the marker when `cleared-elsewhere` is reloaded; the POS simulation is disabled in the markup and guarded by `listRead` until the list has been read. See N3 for one sibling. |
| I-8 wording | **Closed** | The I-8 ruling cell is exactly the lead's round-2 wording. The round-2 diff of `SCREEN-INVENTORY.md` is that one line. |

## R3. New findings

### N1 (low) — A reread that fails after a *sent* reprint puts "FAILED · Did not print." back in the delivery cell

**Where:** `incidents.js:88` (a read error keeps `r.delivery`), `:116–117`
(the delivery cell falls back to `r.delivery` once `result` is no longer
`sent`), reached from `:98–99` (a `sent` response does not change
`r.delivery`).

**What is wrong.** While a reprint is `sent`, the delivery cell correctly
reads "Awaiting result · Reprint sent; delivery is not confirmed." If the
manager then presses *Check delivery status* and the read fails, `result`
becomes `read-error` and the cell shows `r.delivery` again, which for the
kitchen ticket and the receipt is still the original `FAILED` with "Did not
print." That value describes the first print, not the reprint that has just
been sent and may have printed. The notice beside it says "The last known
delivery is kept", which is accurate but does not undo the cell, and
*Reprint ticket* is live next to it. The registered `*-reread-error` states
do not show this, because they set the delivery to `UNKNOWN` directly
(`:44`); only the interactive path from `sent` reaches it, and the check
exercises rereads from `*-reprint-unknown` only (`design013.cjs:51`). This is
the shape the role prompt names: one value (`r.delivery`) shared by the
before-reprint and after-reprint states, wrong in the one state the drawn
fixtures hide. Derived from reading; not run.

**Authority.** Task Part A1 (`FAILED` and `UNKNOWN` read differently; `UNKNOWN`
is never worded as the kitchen not having the work), DESIGN-011's BO-13 P1
("UNKNOWN cannot be presented as known failure"), and the reason B-16 gives: a
duplicate ticket is duplicated food.

**Failing scenario.** Open `?state=default`. Leave *Next reprint response* on
*Sent*, set *Next reread response* to *Read failed*. Press *Reprint ticket*,
then *Check delivery status*. Expected by this finding: the delivery cell
reads "FAILED · Did not print." while a reprint is in transit. The manager
believes it and reprints again.

**Proposed fix.** Once a reprint has been sent, the first print's delivery is
no longer the last known state of the paper. Keep "Awaiting result" (or
`UNKNOWN` with the may-already-have-printed wording) in the cell through a
read error, and add a check that rereads from `*-reprint-sent` with each
response.

### N2 (low) — The *Cleared on the POS* marker retires on the manager's click, so the rows shift under the pointer at that moment

**Where:** `incidents.js:164` and `:55–62`.

**What is wrong.** The marker is removed in the capture phase of the
manager's next click anywhere in the page. The click itself still reaches the
control that was aimed at, which is correct. But the rows below the marker
move up by one row height during that click, so the pointer now rests on the
next incident's control in the same column. In `overflow`, where rows are the
same height, a double-click on *Reprint ticket* sends the second click to the
next incident's reprint. When the last emergency was the one cleared, the
banner's 80px is held as blank space until that same click and then
collapses, shifting the whole page. Derived from reading; not run.
`design013.cjs:104` asserts only that the marker is gone after the next
action.

**Authority.** The round-2 ruling for F4 allows retirement at "the next read
or the manager's next action", and the work follows it, so this is a residual
of the ruling rather than a departure from it. The underlying concern is the
one F4 raised: a single ungated reprint must not land on a different incident
(acceptance criterion 3; B-16's reason).

**Proposed fix.** For the lead to weigh: retire the marker only on the next
list read or navigation, or give the marker row its own *Dismiss* so its
removal is a deliberate action aimed at that row.

### N3 (low) — `*-reread-pending` is no longer a pending reread after one reload

**Where:** `incidents.js:44`.

**What is wrong.** The three `*-reread-pending` states set `reading` only when
the URL carries no `incidentIds`. The first render writes `incidentIds` into
the URL, and `reading` is not part of the carried context, so a reload shows
the idle `reprint-unknown` composition (reprint and *Check delivery status*
both live) under a state named "Reread pending". This is the sibling of the
`cleared-elsewhere` reload in F8, which was fixed. It affects reviewability
only.

**Proposed fix.** Apply the state's `reading` flag whether or not
`incidentIds` is present, as line 46 already does for the `-checked` states.

### Observation for the lead (follows the ruling; not a finding)

Under the F1 ruling, *Reprint* is live in every completed state, including
`sent` ("Awaiting result") and server-confirmed `PRINTED`. That matches the
POS artifact, which keeps its reprint link after `reprint-printed`. It does
mean one click prints a second copy of a ticket the server has confirmed. If
the owner wants a different rule for confirmed paper, it is a product
question and belongs with the F5 question.

## R4. What I ran and what I did not

**Ran and observed.**

- `npm run verify` at `6f142bd`: typecheck passed; **46 test files, 2,758
  tests, all passed**; the Vite native-config-loader warning is present.
- Tree stability: `git status --porcelain` empty before the first read and
  after the verify run; `HEAD` `6f142bd` throughout. `git diff --stat 964eca8
  HEAD` shows the task file only.
- `git diff 0c9f0f0 HEAD` for the inventory, `incidents.css`,
  `incidents.html`, `office.js` and `manifest.js`, read in full; the current
  `incidents.js` and `design013.cjs` read in full.
- `grep -c "prototype/"`: 39 for `menu.html`, 10 for `report-detail.html`.
- A path-limited diff from `0c9f0f0` over `design012.cjs`, `office.css`,
  `docs/design/tokens`, `docs/DESIGN.md`, the four product documents,
  `SITEMAP.md`, `apps`, `packages` and `db` is empty.

**Did not run.** Neither browser check (each run is the owner's to approve,
and this review ran unattended). No evidence capture was read; the evidence
directory is outside this session's readable paths. No mutation run. N1 and N2
are therefore inferred from the code paths cited, and the closures in R2 are
closures by reading. I did not confirm the 41-state manifest against
`WF.states` mechanically; the twelve added entries match by eye, in order, and
the check asserts equality at `design013.cjs:19`.

**On the request to update the Handoff.** The dispatch asked both that I write
only this report and that I update the Handoff with a last line of `DONE` or
`BLOCKED`. The Handoff is part of the task file, which the reviewer role and
the same dispatch forbid me to edit, so I have not touched it. This report's
last line carries the status instead.

## R5. Cleared in round 2

- No raw colour, pixel size or weight in the round-2 CSS; the marker and the
  live region use registered tokens only. No new token.
- The marker row overrides the emergency row's red by specificity
  (`.incident-table .incident-cleared` over `.emergency-table tbody tr`), so a
  cleared incident does not stay solid red. Its controls are disabled and
  hidden, and its message does not say the manager cleared it.
- The banner held as blank space uses `visibility: hidden`, so it is out of
  the accessibility tree and Playwright's `isHidden()` in both checks still
  reads true.
- In-flight timers for a row cleared on the POS stop at `rows.includes(r)`
  (`incidents.js:86`, `:97`), so a late result cannot revive the marker row.
- Still no audit wording, no gate, no report class, and no success green.
- Round 1's Handoff sections were corrected only where round 2 made them
  untrue (fixture order, state count, reread rule, clearance behaviour).

DONE
