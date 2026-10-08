# DESIGN-014 review — BO-12 audit viewer (slice I)

Reviewed 2026-10-07 by the reviewer (Claude, the other family from the Codex designer).
Commit under review: `82e622d` on `agent/design-014`, diffed against `development`.

## 1. Verdict

**findings** — five, none of them a boundary breach in what is drawn on screen: one medium
(a drawn state the contract makes impossible), one medium-low (a value shared between two
fields), and three low. The artifact is otherwise sound against the task's rulings, and the three
inventory and wireframe edits are exactly as worded.

One limit on this verdict matters more than any finding: **I did not run a browser.** The task
says each run of a check script needs the owner's approval in the pane, and this review ran
unattended, so `design014.cjs`, `design012.cjs` and `design013.cjs` were not executed. Everything
below about behaviour is from reading `audit.js`, `audit.html`, `audit.css`, `office.js` and
`office.css`, not from observing the page. The Handoff's 237/237, 216/216 and 371/371 counts and
its measurements are the designer's, unconfirmed by me.

## 2. Findings

### F1 (medium) — The refused void is drawn as an open order in a closed business day, which the contract makes impossible

**Where:** `docs/design/visual-directions/frost/back-office/audit.js:16` (the `refused-void`
record: `code:'BUSINESS_DAY_CLOSED'`, `orderDay:'2026-10-05'`), `audit.js:60` (the list summary),
and `audit.js:86` (the detail's "Order's business day" and "Refusal code" facts).

**What is wrong:** The state `entry-refused-void` shows a whole-order void of T6-0510 attempted at
22:14 in the business day opened 6 October, refused with `BUSINESS_DAY_CLOSED`, with the order's
business day given as Mon 5 Oct 2026. A void applies only to an `OPEN` order (FR-H1). End-of-day
close is refused while any order is still `OPEN` (FR-I2), and an order belongs to the business day
open when it was created (FR-I1). So an order that can still be voided always belongs to the day
that is currently open; its business day cannot have closed, in the meantime or otherwise. The
refusal code and the "Order's business day" fact were copied from the refund record on the line
above, where they are valid (a refund applies to a `CLOSED` order, whose day can close; FR-H7).

This is the shared-value shape: one refusal code serves both refusals, and it is right for one and
wrong for the other. It is reinforced at `audit.js:60`, where the list summary for any entry with
a code is the literal `'Business day closed.'` rather than something derived from the record, so a
second refusal reason could not be drawn without also reading "Business day closed."

**Authority:** FR-H1, FR-I1 and FR-I2 (`docs/PRD.md:261`, `:297–303`); B-9 states the same
immutability from the other side. The owner's ruling of 2026-10-06 (`.agent/DECISIONS.md:110`)
grants a `REFUSED` entry for a void but names no reason for it. In fairness to the designer, the
task's own wording ("the refusal code (for example the business day closed in the meantime) …
applies to a refund … and to a void") invites exactly this reading; the task file shares the
defect.

**Failing scenario:** A builder builds BO-12 from this artifact and a fixture author copies the
record. The first integration test that tries to produce a void refused for a closed day cannot,
because FR-I2 refuses the close first. A manager reading the screen is told a 5 October order was
still open and voidable on the evening of 6 October, which contradicts the end-of-day report they
closed.

**Proposed fix:** Give the refused void a reason a void can actually meet, drawn from what the PRD
already says blocks a void: the order was settled or leased by another client between approval and
commit (FR-G13 blocks void while a `CheckoutLease` is active). Keep the order in the open day
(for example T6-0610), drop its "Order's business day" fact, and derive the list summary from the
record. The list of refusal codes is out of scope for this task, so the code string should stay
visibly illustrative, and the lead may prefer to ask the architect (ARCH-005 carried the ruling)
which refusal a void can receive before the fixture names one. Correct the task's parenthesis so
slice builders do not inherit it.

A smaller point on the refund beside it (`audit.js:15`): T3-0510's day closed at least seven hours
before the 22:16 attempt (the 6 October day has entries from 15:23), so "closed in the meantime"
(FR-J3) is not what the fixture shows; it shows a refund attempted against a day already long
closed, which FR-H7 says is blocked and which the POS presumably never offers. An order from the
day that closes at the moment of the attempt would tell the story FR-J3 describes. This is
plausibility, not a contract breach.

### F2 (medium-low) — The date an entry occurred is the business day's opening date, under another label

**Where:** `audit.js:79` (the Time cell's second line, `days[r.day]`) and `audit.js:86`
(`fact('Occurred',days[r.day]+' · '+r.time+' WIB')` immediately followed by
`fact('Business day',days[r.day])`).

**What is wrong:** A record carries one date, `day`, which is its business day. The list prints it
under the time as though it were the calendar date, and the detail prints it twice, once as
"Occurred" and once as "Business day". The Handoff says "Time includes its WIB date so that an
all-days result is unambiguous", but the value shown is not the WIB date of the event. A business
day runs from one close to the next and is only *named* by the date it opened (PRD §9,
`docs/PRD.md:561–564`; owner, 2026-10-06). The two dates differ for every entry written after
midnight in a day that trades late or is closed the next morning. No fixture entry crosses
midnight, so the artifact never shows the case where its own binding is wrong.

**Authority:** PRD §9 ("Restaurant time zone") and FR-I1; FR-J2 (an entry records its timestamp).

**Failing scenario:** The day opened Tuesday 6 October is closed at 00:40 on Wednesday. A refund at
00:20 is drawn as "00:20 · Tue 6 Oct" and sorts, newest first, above the 22:18 entry while
carrying a date that makes it look twenty-two hours older. This is the till-is-short question the
screen exists to answer, and the entries nearest the close are the ones it misdates.

**Proposed fix:** Give fixture records their own occurrence date, separate from the business day,
and add one entry after midnight (for example 00:20 on Wed 7 Oct inside the business day of Tue 6
Oct) so the list and the detail both show the two values differing. The business-day filter keeps
filtering on the business day.

### F3 (low) — The list summary for a fired-line void is two literals, not the record's amounts

**Where:** `audit.js:61`: `r.action==='line'?[['Line value',50000],['Order reduction',47250]]:…`.

**What is wrong:** Every successful fired-line void would show Table 4's 50.000 and 47.250 in the
Summary column whatever its own amounts are. Only one such record exists, so nothing is wrong on
screen today, but this is the defect the task was written to remove ("every *Open* shows the same
refund"), moved from the detail to the list. The detail is correct: it reads `r.amounts`.

**Authority:** Task Part C1 and acceptance criterion 3 (each entry's own subject and amounts,
never another's); FR-J2.

**Failing scenario:** A second fired-line void is added to the fixture, or a builder ports the
summary function: both rows read 50.000 and 47.250.

**Proposed fix:** Select the two values from `r.amounts` by label, as the other actions do.

### F4 (low) — Three different orders share the total 155.925, so "its own amounts" cannot be told apart

**Where:** `audit.js:14` (refund, T8-0610, Charged 155.925), `audit.js:28` (fired-line void,
T4-0610, Order total before 155.925), and DESIGN-013's `incidents.js:8` (Table 1's failed receipt,
155.925). `docs/design/checks/design014.cjs:19` and `:22` assert the same string for two subjects.

**What is wrong:** Acceptance criterion 3 asks for evidence that an entry shows its own amounts and
never another's. With the refund and the line void sharing a figure, the assertion that the refund
detail contains "155.925" would still pass if it showed Table 4's total, and the reverse. The
Handoff notes the coincidence ("a separate closed order with charged total 155.925") without
treating it as a weakness. The two screens are also meant to tell one story, and in that story
Tables 1, 4 and 8 each owe the same amount.

**Authority:** Task acceptance criterion 3.

**Proposed fix:** Give the refund its own total, and assert in the check that each detail does not
contain a neighbouring entry's distinguishing amount.

### F5 (low) — The check script does not look where two of its claims live

**Where:** `docs/design/checks/design014.cjs:53` and the script as a whole.

**What is wrong:** (a) The "no secret or security telemetry" assertion reads the text of `.bo`.
The detail dialog is a sibling of `.bo` (`audit.html:28`), so in all seventeen entry states the
text a manager is actually reading is not scanned. (b) Nothing in the script asserts acceptance
criterion 5's first half: that no control edits, deletes, hides or exports. (c) The `overflow`
state is the same forty entries and four pages as `default`; the only difference is the tight cell
padding (`audit.js:78`), and `clear()` at `audit.js:90` silently resets it to the default density.
DESIGN.md `:1149` grants the tight row "for the overflow fixture", so this is permitted, but a
builder is left with two densities for one list and no rule for choosing.

By reading, (a) and (b) hold: the dialog's text has no PIN, password or telemetry wording, and the
page's only controls are four filters, Clear filters, Newer, Older, Open, Try again and Close. The
finding is that the green count does not prove them.

**Authority:** Task acceptance criteria 5 and 9; FR-J1, FR-J4, B-7, B-12.

**Proposed fix:** Scan `document.body` (or the dialog too) in entry states; assert the full set of
buttons, links and inputs on the page against an allowed list; and say in the Handoff which
density BO-12 is built at.

## 3. What I ran and what I did not

**Ran and observed:**

- `npm run verify`: typecheck clean; **50 test files passed, 2,876 tests passed**, exit code 0.
  The Vite native-config-loader warning appears, as the Handoff says. Nothing under
  `docs/design/tokens/`, `packages/`, `apps/` or `db/` changed on this branch, so this run is
  regression evidence only and says nothing about the artifact.
- Tree stability: `git rev-parse HEAD` gave `82e622d` and `git status --short` was empty both
  before the verify run and after it. The tree did not move.
- `git diff --stat development...HEAD`: twelve files, 790 insertions and 8 deletions; I read the
  whole diff except the task file's unchanged lead-written sections.
- `git diff --stat development...HEAD` restricted to the four product documents, `docs/DESIGN.md`,
  `SITEMAP.md`, `docs/design/tokens`, `design012.cjs`, `design013.cjs`, `apps`, `packages` and
  `db`: empty.
- `grep -c "prototype/"`: **38** for `frost/back-office/menu.html` and **9** for
  `frost/back-office/report-detail.html`.
- `grep -rn "prototype/back-office/audit.html" docs/design/visual-directions`: two hits, both under
  `paper/`, none under `frost/`.
- Token and shared-class existence by `grep` in `frost.css` and `office.css`.

**Did not run:**

- Any browser check (`design014.cjs`, `design012.cjs`, `design013.cjs`), for the reason given in
  the verdict. I therefore did not observe the dialog, focus return, the sticky header, wrapping,
  horizontal overflow or the 1440×900 geometry, and did not see the evidence in `/tmp`.
- Any mutation, in memory or otherwise. F3 and F4 are argued from the source, not demonstrated.
- Contrast measurement for the brick, amber and muted outcome text.

**Inferred from reading, not observed:** every statement in section 4 about filters, paging,
reload, detail content and focus.

## 4. Cleared

- **Part E wording.** The inventory insertion at `SCREEN-INVENTORY.md:846`, the new bullet at
  `:851–854` and the wireframe rail bullet match the task's wording exactly, and nothing else in
  either file changed. `office.js` changes one array literal (`:20`).
- **Audited actions (FR-J3 and rulings).** All nine actions are drawn and nothing outside the list
  appears: no pending-line removal, no unsent-order cancellation, no receipt reprint, no
  configuration change, no sign-in, no post-close correction.
- **Outcomes.** Combined success with actor and approver; self-approval labelled; failed,
  cancelled and cooldown-refused with approver absent; `REFUSED` with actor, approver and code.
  The cooldown entry has a plain label and no code. Each outcome has distinct wording, so colour is
  supplementary; no success green.
- **Amounts.** Refund shows Charged, Refunded and Net with the order total stated as unchanged
  (B-8, the delegated ruling at `DECISIONS.md:98`). Whole-order void shows the pre-void total and
  an equal value. I recomputed the line void (165.000 less 10% plus 5% service is 155.925;
  115.000 gives 108.675; reduction 47.250 against a 50.000 line) and the discount chain
  (200.000, 180.000, 175.000, 200.000); both are right, and the 31 generated presets are whole
  rupiah. Non-success entries render no amounts block (`audit.js:86` gates on success), and the
  takeover and reprints carry none.
- **Discounts.** The list shows money, not a preset name; the detail carries the snapshot name,
  kind and value before and after, which also satisfies AC-8 for the preset entry. The ungated
  preset naming only its actor matches FR-F2 and FR-F6.
- **Read-only (FR-J1, B-7).** The only action on an entry is Open; the dialog has only Close.
- **People (B-13) and secrets (FR-J4, B-12).** Every record names a person; the deactivated actor
  keeps her name and is filterable; no "system" actor; no PIN, password or field resembling one;
  no telemetry entry, link, tab or filter.
- **Reprints.** Table 1 round 2 at 19:58 and Table 4's cancellation at 20:02 match DESIGN-013's
  fixture (`incidents.js:6–7`), and each names actor, order and round. The takeover names its
  actor and the lease; it does not name whose checkout was displaced, which FR-G14 and the stored
  shape do not grant either, so I do not count it as a defect.
- **Filters, paging and detail.** Four filters combine in one predicate; person matches actor or
  approver; a filter change resets to page one; Older and Newer slice distinct records and state
  the range; detail opens through the same `open()` whether reached by click or by `?state=`, so
  the check's URL path is the production path; Close and Escape pass the originating button to
  `Office.close`. The two empties are separate branches and only `nomatch` offers Clear filters.
- **Shared frame.** The artifact consumes `office.css` and `Office.open`/`Office.close` without
  forking them. `audit.css` has no raw colour, size or weight, and every token it names is
  registered. No token was added.
- **Handoff.** It maps the inventory states, outcomes and Parts A to E, names the three lead
  rulings on amounts as the owner's to overturn, and says where a post-close correction would sit.
  Its report that FR-H3 and AC-10 still say an unfired-order void is audited is accurate
  (`docs/PRD.md:266–267`, `:504`) against the ruling at `DECISIONS.md:114`; that contract edit is
  the lead's to draft.

## 5. Re-review — round 2

Re-reviewed 2026-10-08 at head `8b532ac` (fix commit `3a2a3cd`), against the lead's *Round 2*
rulings in the task file and the designer's *Round 2 — review fixes* Handoff section.

### Verdict

**clean.** All five findings are closed, and I found nothing the fixes broke. One wording
observation is recorded below for the lead to rule on; I do not count it as a finding.

The same limit as round 1 applies and is not softened by the fixes: **I still did not run a
browser.** The check scripts need the owner's approval per run and this review ran unattended. The
designer reports 288/288 across 24 states for `design014.cjs`, 216/216 for `design012.cjs` and
371/371 for `design013.cjs`, and the lead walked the refused void, the refused refund, the
after-midnight refund and both line voids in Chrome. Those are their observations. Mine are from
reading `audit.js`, `audit.html`, `manifest.js` and `design014.cjs` at `8b532ac`.

### Each finding

- **F1 (refused void in a closed day) — closed.** `audit.js:16` now draws T6-0610, an order in the
  open day, refused with `ORDER_NOT_OPEN` because another client settled it between approval and
  commit; it has no `orderDay`, so the detail's "Order's business day" fact is absent for it
  (`audit.js:88`). The list summary is derived from the record's own `refusal` text and code
  (`audit.js:62`); the literal "Business day closed." is gone. Both codes are labelled
  illustrative in the list and in the detail. The refused refund (`audit.js:15`) now tells FR-J3's
  story: it occurs at 00:06 on Tue 6 Oct, in the day that opened a minute earlier, against an
  order of the day that had just closed. I checked the Handoff's timeline against the fixture: the
  eight entries of the 5 October day run from 14:15 to 15:23 on 5 October, before the 00:05 close,
  and every entry of the 6 October day falls at or after 00:06 on 6 October, so no open order
  survives a close and no entry sits on the wrong side of it (FR-H1, FR-I1, FR-I2).
- **F2 (occurrence date bound to the business day) — closed.** Every record carries
  `occurredDate` apart from `day` (`audit.js:32`, `:34`). The list's date and the detail's
  "Occurred" read the occurrence (`audit.js:81`, `:88`); "Business day" and the filter read the
  business day (`audit.js:47`). The successful refund occurs at 00:20 on Wed 7 Oct inside the
  business day of Tue 6 Oct, so both places show the two dates differing. Records sort by
  occurrence (`audit.js:35`). The business-day select is still authored in `audit.html` with two
  days, so adding Wed 7 Oct to the label map did not create a business day that never opened.
- **F3 (literal line-void summary) — closed.** `audit.js:63` selects the line snapshot and the
  reduction from the record's own `amounts` by label. A second fired-line void, T11-0610, is
  registered as `entry-line-second` in both `audit.html` and `manifest.js`. I recomputed it:
  80.000 less 10% plus 5% service is 75.600; 60.000 gives 56.700; reduction 18.900 against a
  20.000 line. The fixture still holds 48 entries, 40 and 8 by business day (18 core plus 30
  generated, 22 and 8).
- **F4 (shared 155.925) — closed.** The refund is 184.800 (`audit.js:14`), shared with no other
  entry and whole rupiah. `design014.cjs:73–74` asserts that the refund and each line-void detail
  do not contain the others' distinguishing amounts.
- **F5 (check gaps and density) — closed.** `design014.cjs:16–39` scans the whole `body`, the open
  dialog included, in every state and once more with both global alerts over an open detail, and
  compares every button, link, select, input, textarea and summary against an allowed list that
  defaults to rejecting anything unrecognised. `clear()` no longer resets the density
  (`audit.js:92`), and the Handoff states the rule a builder needs: BO-12 is built at the standard
  density at any length, and the tight row is the overflow review fixture only.

### Looked for regressions

- The sort moved the refused refund from the first page to the last entry of the 6 October day.
  A deep link to `entry-refused-refund` still resolves, because the page is computed from the
  entry's index in the sorted, filtered list (`audit.js:108–109`), and the `nomatch` fixture
  (refund by the deactivated actor) is still empty.
- Non-success entries still render no amounts block; the cooldown entry still has no code; the
  refund still states that the order's total is unchanged.
- Only `audit.js`, `audit.html`, `manifest.js`, `design014.cjs` and the task file changed since
  `82e622d`, apart from this report as the lead committed it. The four product documents,
  `docs/DESIGN.md`, `SITEMAP.md`, the tokens, `office.css`, `design012.cjs`, `design013.cjs`,
  `apps`, `packages` and `db` have empty diffs against `development`.
- The Handoff's round 1 sections were corrected where the fixes made them untrue (state count,
  refund total, refusal subjects, entry counts) and left alone elsewhere.

### Observation, not a finding

`audit.js:10` gives both refusals one sentence: "Approval succeeded, but the server refused the
action. The order was unchanged." For the refund this is PRD wording (`docs/PRD.md:452–453`). For
the void it sits above the note "Another client settled the order after approval", so the detail
says the order was unchanged and that it was settled. Both are true, since the void changed
nothing, but a manager may read them as contradicting each other. "This action did not change the
order" would serve both states. This is copy, it breaks no requirement, and it is the lead's call
whether it is worth a change.

### What I ran and what I did not

**Ran and observed:**

- `npm run verify`: typecheck clean; **50 test files passed, 2,876 tests passed**. As in round 1
  this is regression evidence only, because nothing under `apps`, `packages`, `db` or the tokens
  changed.
- Tree stability: `git status --short` was empty before and after the verify run, and
  `git rev-parse HEAD` gave `8b532ac` after it.
- `git diff --check development...HEAD`: no output.
- `git diff --stat 82e622d..HEAD` and the restricted `--stat` over the protected paths, as
  described above.

**Did not run:** any browser check, any mutation in memory or otherwise, and any contrast
measurement. The statements above about rendering, focus, ordering on screen and the check
script's pass count are inferred from the source or reported by the designer and the lead.

**On the instruction to update the Handoff:** the re-review request asked both that I write only
this report and that I update the Handoff. The Handoff belongs to the builder and the task file to
the lead, so I changed neither; this section is my whole output.

DONE
