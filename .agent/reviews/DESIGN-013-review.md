# DESIGN-013 review — BO-13 print incidents (slice C)

Reviewed 2026-10-06 by the reviewer (Claude Opus 5.5; the designer was Codex
`gpt-6-astra`). Branch `agent/design-013` at `0c9f0f0`, diffed against
`development` (13 files, 833 insertions, 30 deletions).

## 1. Verdict

**findings** — eight: two medium, six low. None breaks a boundary outright.
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
