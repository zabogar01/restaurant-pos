# DESIGN-012 review — back-office shell, global alerts, M-6 and shared patterns

**Reviewer:** Claude Opus 5.5 (the designers were Codex and OpenCode on `gpt-6-astra`).
**Reviewed:** branch `agent/design-012` at `b0ee42f`, diff against `development` (17 files).
**Date:** 2026-10-06.

## 1. Verdict

**findings** — nine findings: one I rate high, three medium, five low. No boundary in
`docs/BOUNDARIES.md` is broken. The frame, the four alert states, the M-6 state set, the token
work and the gallery registration are sound. The findings are in behaviour that later slices will
copy from the shared patterns, so they are cheaper to fix now than after slices B to I consume
them.

I did not run a browser. Every finding below is from reading the committed source; where a
finding depends on browser behaviour that I could not observe, it says **inferred** and names the
test that would settle it.

## 2. Findings

### F1 (high) — A pending or unknown command silently kills the kitchen alert's action and *Log out*

**Location:** `docs/design/visual-directions/frost/back-office/patterns.js:74`, with `:36–39`;
asserted as correct by `docs/design/checks/design012.cjs:67`.

**What is wrong.** The shared click handler is
`if(a&&(dirty||busy)){e.preventDefault();if(!busy)leave(a.href,a);}` and matches every link
inside `.bo`. While `busy` is true (states `pending` and `unknown`) every such link is cancelled
and nothing else happens: no dialog, no message, no explanation. The links inside `.bo` include
the kitchen banner's *Open print incidents* (`office.js:44`), the receipt chip (`office.js:47`)
and the top bar's *Log out* (`office.js:30–36`). One guard is shared by all navigation, and it
hides the one state in which it is wrong: the emergency.

**Authority.** FR-E3 requires failed kitchen work to be a persistent emergency "with an explicit
reprint action, so a manager working in the back office cannot miss a failed kitchen ticket".
Part A2 of the task requires the banner to carry "one action that opens print incidents" in a
form that is "identical on any page". FR-A2b grants "explicit logout". Part C5 and Q11 ask only
that an unknown outcome is never resent automatically; neither asks for navigation to be blocked.
The task's own Part B treats the same collision correctly: M-6 queues the incident route instead
of swallowing it.

**Failing scenario.** Open `patterns.html?state=unknown&alerts=kitchen`. The red banner says
*Kitchen ticket did not print* and offers *Open print incidents*. Clicking it does nothing.
Clicking *Log out* does nothing. In the direct `unknown` state this lasts until the manager
finds *Check saved sample*; in production an unknown outcome lasts as long as the network fault
that caused it, which is exactly when a print failure is likely to arrive. The Handoff presents
this as a deliberate finishing change ("Prevent shared-pattern navigation during pending or
unknown command outcomes"), and the check script locks it in with the assertion
`unknown prevents navigation during reread`, so a green check run is evidence for the defect, not
against it.

**Proposed fix.** Never cancel a click silently. During `pending` and `unknown`, route navigation
through the leave decision with copy that states the truth ("The save may or may not have
succeeded. Leaving does not send it again."), and let the alert links and *Log out* reach that
decision in every state. Change the check's assertion to match. Record in `docs/DESIGN.md` that
no page state may make the emergency action or *Log out* inert.

### F2 (medium, inferred) — M-6's resistance to *Escape* rests on one `preventDefault()` that Chrome does not always honour

**Location:** `frost/back-office/shell.js:70`; the claim at `docs/DESIGN.md` (DESIGN-012
supplement, "It cannot be dismissed with Escape or a click outside"); the test at
`docs/design/checks/design012.cjs:39`.

**What is wrong.** The only thing keeping the re-authentication dialog open is
`dialog.addEventListener('cancel',e=>e.preventDefault())`. Chrome routes *Escape* on a modal
dialog through a close watcher, and my understanding of the HTML Standard's close-watcher rules is
that the `cancel` event is cancelable only when the page holds fresh user activation, which the
event then consumes. If that is right, two cases close M-6 with no credential: a second
consecutive *Escape*, and a first *Escape* on a page that has had no interaction since load
(for example `shell.html?state=reauth` opened directly). Nothing listens for `close`, so the
dialog would simply vanish and leave the draft form live with the state still reading `reauth`.

**How sure I am.** Not certain. I asked the librarian to confirm; it could reach only MDN and
could not fetch the HTML Standard or the Chrome documentation, so it confirmed only that
`closedby="none"` exists and makes a dialog dismissible "only with a developer-specified
mechanism". The cancelability rule is from memory in both my reading and the librarian's. The
check script cannot tell either way: it presses *Escape* once, immediately after `Alt+I`, which
is the one sequence in which the event is certainly cancelable.

**Authority.** Task Part B, state `reauth`: "No close button, and *Escape* does not dismiss it."
FR-A2b places the preserved draft "behind re-authentication".

**Proposed fix.** First settle it in the browser: press *Escape* twice in a row in `reauth`, and
once on a direct load of `?state=reauth` before any other input. Whatever the result, do not
leave one cancelable event as the only defence in a pattern slices will copy. Add
`closedby="none"` to `#reauth-dialog`, cancel the *Escape* `keydown` while it is open, and add a
`close` listener that reopens the dialog while re-authentication is still required. Extend the
check with both sequences.

### F3 (medium, inferred) — The long dialog's body cannot be scrolled from the keyboard

**Location:** `frost/back-office/office.js:64` and `:67–74`; `patterns.html:30`;
`office.css:73`; the test at `design012.cjs:61–63`.

**What is wrong.** The focus loop builds its list from
`a[href],button,input,select,textarea,summary,[tabindex="0"]`. In the long dialog that list has
one member, *Close*. *Close* is therefore both first and last, so `Tab` and `Shift+Tab` are both
cancelled and focus never leaves it. *Close* sits in the footer, outside
`.office-dialog__body`, and the dialog itself is `overflow: hidden`, so arrow keys, *Page Down*
and *Space* have no scrollable ancestor to act on. Chrome would normally put a scroller with no
focusable children into the tab order, but this loop cancels the `Tab` that would reach it. A
keyboard user can read the first screen of the dialog and nothing below it.

**How sure I am.** The loop's behaviour is read directly from the code. That keyboard scrolling
follows the focused element's scrollable ancestors is standard behaviour that I did not observe
here. The check does not exercise it: it scrolls the body with `scrollTop = scrollHeight` from
script, a path no user has, and its trap assertion ("focus stays inside") is trivially true when
focus cannot move at all.

**Authority.** Task Part C2: "*Tab* and *Shift+Tab* stay inside, focus returns to the opener on
close, the body scrolls inside the viewport while the head and actions stay." A body that scrolls
only for a pointer does not meet it on a seated, keyboard-first desktop client.

**Proposed fix.** When the body overflows, give `.office-dialog__body` `tabindex="0"`,
`role="region"` and an `aria-labelledby` pointing at the dialog title, and include it in the
loop's list. Add a check that presses *Page Down* and asserts the body's `scrollTop` changed.

### F4 (medium, identity) — `reauth-other` tells a guesser that the password is valid for someone else, and counts toward the lockout

**Location:** `frost/back-office/shell.js:7` (the `other` string) and `:81` (`failures++` on
both refusals).

**What is wrong.** The refusal reads "This password belongs to another manager. Log out to
switch." Shown to whoever is at the keyboard, that confirms a guessed secret is a live credential
for a different manager account. To produce it at all, the server would have to test the
submitted secret against every manager, not only the named one. The same branch increments the
failure counter, so a different manager's correct credential also moves the installation toward
the five-minute lockout.

**Authority.** There is no boundary or requirement that names this directly, and I am not citing
one that does not carry it. It is a defect against the intent of FR-A5, which exists to make
guessing expensive, and it sits on the two rulings the task records as binding: same manager only
(Q3) and an undecided credential (Q4). The task did require the state to be drawn; it did not
require this wording. The Handoff already notes that the state is unreachable if the credential
is checked only against the named manager, which is the conventional design and the one this
wording argues for.

**Failing scenario.** M. Iqbal's session idles. A second person tries a password they have seen
another manager type. The dialog replies that the password belongs to another manager. They log
out and sign in as that manager.

**Proposed fix.** Use one refusal string for both cases, the existing "Incorrect password. Try
again.", and keep "Log out to switch" in the dialog's standing description, where it already is
(`shell.html:37`). Keep the `reauth-other` state as a named fixture so the ruling stays visible,
with a note that it is indistinguishable from `reauth-error` by design. Put the question "does a
different manager's valid credential count as a LOGIN failure?" to the owner alongside Q4.

### F5 (low) — Logging out during the lockout discards the draft and lands on a login that is locked too

**Location:** `frost/back-office/shell.js:31` and `:61–65`.

**What is wrong.** FR-A5 makes the `LOGIN` throttle installation-wide. During
`reauth-throttled` the dialog says "Log out is still available", and its standing copy says "To
sign in as someone else, log out." Nobody can sign in for the remaining minutes, whoever they
are. The discard confirmation that follows uses the ordinary wording and does not mention it, so
a manager can destroy the preserved draft to reach a screen that refuses them for the same
reason.

**Authority.** FR-A5 ("installation-wide throttle classes"); FR-A2b (the draft is what M-6
exists to keep).

**Proposed fix.** In the throttled state, make the confirmation say that sign-in is unavailable
for the time remaining and that waiting keeps the draft.

### F6 (low, inferred) — Rows are visible above the sticky table header

**Location:** `frost/back-office/office.css:27` and `:85`.

**What is wrong.** The header is `position: sticky; top: 0` inside `.bocontent`, which has 24px
of padding. The Handoff's own measurement puts the stuck header at y = 88, which is the top bar
(64) plus that padding, so there is a 24px band between the frame and the header through which
scrolling rows remain visible. I did not see the rendering; the measurement is the designer's and
the conclusion is mine. The capture the check takes for this state is made before it scrolls, so
no committed evidence shows it either way.

**Authority.** Task Part C7 ("a sticky header inside its scroll owner"); `docs/DESIGN.md`
`:1138–1157`.

**Proposed fix.** Look at `patterns.html?state=table` after scrolling. If rows show above the
header, pull the header up by the content padding using the existing
`--frost-office-content-padding` token, or move the padding to an inner wrapper so the scroll
owner's edge and the sticky edge coincide. Capture the state after scrolling.

### F7 (low) — "Exactly as before" holds only on the `Alt+I` path

**Location:** `frost/back-office/shell.js:18` and `:21–24`.

**What is wrong.** `resumeFocus` starts as `#draft-limit` and `selection` as `[0,6]`, and both
are refreshed only while focus is inside the form. If the timeout fires while focus is elsewhere
(the navigation, the top bar, or the *Simulate 30-minute idle timeout* button itself), resuming
moves focus to a field that did not have it, with a selection recorded at the moment that field
was last entered, not the selection it had when it was left. A real idle timeout does not move
focus first, so the `Alt+I` path the check uses is the faithful one and it passes; the button in
the review fixtures is the path a human reviewer will use, and it does not show what it claims.

**Authority.** Acceptance criterion 4 ("the focused field … identical before `reauth` and after
`resumed`"); task Part B, state `resumed`.

**Proposed fix.** Record `document.activeElement` at the timeout whatever it is, and restore to
it. Update the stored selection on `selectionchange`, or drop the button in favour of `Alt+I`
with a line saying why.

### F8 (low) — `docs/DESIGN.md` now contradicts itself

**Location:** `docs/DESIGN.md:489–501`, `:1267–1272`, `:1293–1294`, against the appended
DESIGN-012 supplement.

**What is wrong.** The body still says four tokens are designed, that select and other controls
are "absent", and that the "eleven remaining back-office screens" have no Frost appearance. The
supplement says five tokens, draws a select and a radio group, and states that it "replaces the
earlier statement" without changing it. A reader who lands on the earlier section gets the old
answer with no pointer to the new one. The file is the designer's to edit, so nothing prevented
correcting the statements in place.

**Authority.** The task's token ruling requires a new token to be registered in
`docs/DESIGN.md`; `docs/DESIGN.md:488–489` itself says the two provenance counts are stated
there.

**Proposed fix.** Correct the three passages in place, each with a short "updated by DESIGN-012,
awaiting review" note, and keep the supplement for the new material only.

### F9 (low) — Smaller items, grouped

1. **Visible label is not in the accessible name.** `patterns.js:13` shows *View sample* and
   names the button "View Sample 02". A speech-input user who says the visible words gets no
   match. Make the accessible name start with the visible text ("View sample: Sample 02"), or
   put the subject in the visible label, which is what "named row actions" in Part C7 reads as.
2. **The read-only state can become dirty.** In `fields-readonly` an attempted change on the
   select fires `change`; `patterns.js:59` sets `dirty` before `:88` reverts the value, so
   leaving a form that cannot be edited asks whether to discard changes.
3. **The incident's identity is written twice.** `office.js:44` and `shell.html:35` each hold
   "1 failed ticket · Table 1, round 2 · Sent 19:58". Part A2 requires the identity to read the
   same everywhere; today it does, by coincidence of two literals. Render the in-dialog copy
   from `Office`.
4. **State names drift after a dialog closes.** Closing a row detail or cancelling a removal
   sets `fields` (`patterns.js:66`, `:69`) even from page 2 of the table; declining to leave the
   shell sets `resumed` (`shell.js:87`) when no re-authentication happened, and opening the
   leave decision sets `reauth-logout` (`shell.js:68`) for plain navigation. A reload of the
   resulting URL shows a different screen from the one the reviewer was looking at.
5. **`alerts` overrides a named alert state.** `office.js:38` prefers the query parameter, so
   `shell.html?state=receipt&alerts=kitchen` shows the kitchen banner under the label *Receipt
   warning*. Reachable only by hand; worth one sentence in the Handoff.
6. **Paper's *All screens* link now switches direction.** `mockup.js:60` is shared, so the link
   on a Paper back-office page returns to the gallery with `direction=frost`. The gallery's
   default direction also changed from Paper to Frost (`review.js:5`), which the task did not
   ask for; it is reasonable given the owner's choice of Frost, and the lead should know it
   happened.

## 3. What I ran and what I did not

**Observed.**

- `npm run verify` at `b0ee42f`: typecheck clean, **45 test files and 2,737 tests passed**. The
  only output besides the counts was Vite's existing `configLoader: 'native'` warning.
- The tree did not move: `git status --short` was empty and `git rev-parse HEAD` returned
  `b0ee42febd7691f0352837f27822b021bee2b0c0` both before and after the verify run.
- `grep -c "prototype/"`: `menu.html` **40**, `report-detail.html` **11**, `shell.html` 1 (the
  logout confirmation), `patterns.html` 0, `office.js` 3, `shell.js` 0, `patterns.js` 0.
- No `style=` attribute remains in the four pages, and no literal pixel value appears in
  `office.css`, `office.js`, `shell.js` or `patterns.js`.
- Every `--frost-*` name that `office.css` references exists in `docs/design/tokens/frost.css`.
  I listed the references with `grep -o` and compared them against the file by reading.
- I read in full: the task file; `office.css`, `office.js`, `shell.html`, `shell.js`,
  `patterns.html`, `patterns.js`, `design012.cjs`, `mockup.js`; the diff of `menu.html`,
  `report-detail.html`, `manifest.js`, `review.js`, `index.html`, both token files and
  `docs/DESIGN.md`; `docs/BOUNDARIES.md`; PRD FR-A2b, FR-A2c, FR-A5, FR-E3, FR-E6;
  `SITEMAP.md:230–354`; `SCREEN-INVENTORY.md` M-6 and ruling I-11.

**Not run, and why.**

- **No browser.** The check script needs the owner's approval for each run and this was an
  unattended session. I therefore did not reproduce any measurement in the Handoff, did not see
  any state rendered, and did not confirm F2, F3 or F6 in Chrome. The Handoff's measurements are
  the designer's report, not my observation.
- **No evidence captures.** `/tmp/design012-evidence/` is outside the directories this session
  may read.
- **No mutation run.** Nothing here was re-proven by mutating code, in memory or otherwise.
- **Librarian.** `.agent/bin/ask.sh librarian` exited non-zero (it suggested a rate limit), so I
  used the librarian subagent as the script directs. It could fetch only MDN; the close-watcher
  rule behind F2 and the focusable-scroller behaviour behind F3 remain unconfirmed by citation.
- I did not read `.agent/reviews/DESIGN-011-back-office-audit.md` in full, FR-I1 beyond the
  business-day indicator's wording, or `docs/DESIGN.md` beyond `:484–506`, `:1262–1320` and the
  supplement. The inline widths removed from the menu table (`menu.html` diff, the `th` cells)
  change its column layout; I could not see the result.

## 4. Cleared

- **Boundaries.** No POS operation, PIN pad, approval wording or approval-granting control
  appears anywhere (FR-A2c, B-14, I-11; `SITEMAP.md:313–319`). Neither alert offers a dismissal,
  and nothing implies that opening BO-13 clears an incident (FR-E3, B-15). Amounts are whole
  rupiah with dot grouping and no `Rp` in cells; times are 24-hour.
- **Part A.** Navigation order and destinations match `menu.html:18–33`. The top bar carries
  title, business day by opening date with no time, manager and *Log out*. The four alert states
  exist; kitchen and receipt differ in weight, placement and size (AC-23, FR-E6). The banner sits
  outside `.bocontent`, the only page scroll owner, so it cannot scroll away.
- **Part B.** All eight M-6 states are present and reachable. The dialog names the manager, has
  one *Password* field and no close control. The wrong-credential path clears and refocuses the
  field. The lockout disables *Continue* and keeps *Log out*, and survives *Keep this draft*.
  The emergency is repeated inside the dialog above the scrim and in the logout confirmation,
  and its action queues navigation without bypassing sign-in. No absolute-expiry state and no
  SSO are drawn. The draft is the same DOM form throughout, so values, selection and the invalid
  message cannot diverge.
- **Credential strings.** All four are in `credentialCopy` (`shell.js:3–8`), as the Handoff
  lists.
- **Part C.** Field states, error association by `aria-describedby`, the fieldset and legend,
  native `disabled` and `readonly`; the destructive confirmation names its subject, starts focus
  on the keeping action and uses the destructive palette at 36px; loading withholds count and
  rows; empty shows zero and *Create sample*; a failed read offers *Try again*; a refusal keeps
  edits; an unknown outcome disables resubmission and rereads; paging changes rows and range.
- **Part D.** Both existing pages import the shared stylesheet and script and gain a `kitchen`
  state whose content matches `default` (I checked every `data-when` and `data-unless`).
  Manifest and artifacts agree at 12, 20, 10 and 4 states; `category-invalid` is registered. The
  *All screens* link resolves to the gallery. The currency suffix in `mockup.js:120` still
  reaches the Paper report's top bar and the Frost report's sub-bar.
- **Tokens.** One new token, `--frost-office-form-columns`, in both token files and
  `docs/DESIGN.md`, with `source: null` and a `designed` record. No new colour, no success
  green. The token tests pass unchanged.
- **Handover rulings.** No evidence is committed, and the check script takes its Playwright
  path from `PLAYWRIGHT_MODULE`.
