---
id: DESIGN-013
title: BO-13 print incidents in Frost, the desktop incident table with every urgency, delivery, reprint and clearance state
category: ui
touches: [audit]
depends_on: [DESIGN-012]
owns: [docs/design/**]
status: review
cycles: 0
---
# DESIGN-013 — BO-13 print incidents (slice C)

**Written** 2026-10-06 by the lead. Slice C of the nine back-office design slices proposed in
DESIGN-011 (`.agent/reviews/DESIGN-011-back-office-audit.md`), drawn inside the frame slice A
delivered (DESIGN-012, merged as PR #55).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane.
**Branch and place:** `agent/design-013`, cut from `development` at `2ee2285`, in the worktree
`../restaurant-pos-wt/DESIGN-013`. Touch nothing under `apps/`, `packages/` or `db/`, nothing
in `docs/DESIGN.md` except as allowed under *Tokens*, and nothing in the main checkout at
`../restaurant-pos`.

Nothing is built from this task. A design review follows, and BO-13 is built against fixtures
only after it is reviewed.

## Objective

A manager at a desk must not be able to miss a failed kitchen ticket (FR-E3), and must be able
to recover it without confusing a cancellation with new work (B-16, FR-H4) or a receipt with
either (FR-E6, AC-23). Slice A drew the two global alerts that lead to BO-13; BO-13 itself has
only a greyscale wireframe (`P/incidents.html`) that ties every reprint to the wrong subject,
has no clearance or dismissal path, no receipt `UNKNOWN`, and an empty message that would be
false (DESIGN-011, BO-13 section). When this task is done, a Frost artifact
`frost/back-office/incidents.html` draws every BO-13 state in the inventory, each incident keeps
its own identity and class through every result, the global alerts and navigation of every
back-office artifact lead to it instead of the wireframe, and the screen inventory's I-8 entries
say what the PRD now says.

## Required inputs

Read these, in this order. Everything you need is here or cited. Abbreviations are DESIGN-011's
(`I`, `D`, `S`, `P/`, `F/`, `W`, `V`, `T`).

1. `.agent/reviews/DESIGN-011-back-office-audit.md`: the BO-13 section (`:302–323`), S1, S2, S4
   and S5 (`:56–66`), *Shared pieces*, row *Incident recovery* (`:405`), the token row *Office
   emergency/receipt recovery dimensions* (`:427`), the link ledger row for `incidents.html`
   (`:352`), and questions Q1, Q7 and Q9 (`:439`, `:445`, `:447`).
2. **DESIGN-012's Handoff**, `.agent/tasks/DESIGN-012-office-shell-and-reauth.md:312` to the
   end: *Files and entry points*, *Design decisions and downstream use* (desktop urgency, scroll
   ownership, uncertainty), and the three low findings N1–N3 at `:296–310` (not yours; slice B
   takes them). The shared frame is `F/office.css` and `F/office.js`; the patterns you reuse —
   table, read states, command result, destructive confirmation — are walkable in
   `F/patterns.html`. Consume them; do not copy or fork them.
3. `docs/design/SCREEN-INVENTORY.md` BO-13 `:860–883`, its conventions `:16–41`, and rulings
   I-8 and I-11 in the table from `:984`.
4. `docs/design/SITEMAP.md` `:236–250` (back-office chrome), `:310–319` (what the back office
   never offers), `:325–349` (the two incident classes, cross-client).
5. The POS counterpart, which is the established meaning to carry over, not a component to
   reuse (NFR-5): `docs/design/visual-directions/frost/pos/incidents.html` and its states,
   especially the checked kitchen clearance and the separate receipt *Dismiss* (`:57–115`).
6. `docs/DESIGN.md`: office density (`D:707–730`), shell (`D:801–811`), actions (`D:963–970`),
   tables (`D:1138–1157`), the emergency rules (`D:539–553`, `D:1161–1179`), empty states
   (`D:1196–1199`), DESIGN-012's supplement, and token provenance (`D:486–506`).
7. The contract: `docs/PRD.md` FR-E3, FR-E3b, FR-E6 (`:162–186`), FR-G8, FR-H4, FR-J3
   (`:334–345`), AC-22, AC-23, AC-33; `docs/BOUNDARIES.md` B-15, B-16.

## Rulings that bind this task

- **I-8 is settled: a back-office reprint of a kitchen ticket is audited** (owner, 2026-09-24,
  recorded in DECISIONS.md; PRD FR-J3 now lists it, naming the actor, the order and the round
  reprinted). DESIGN-011 Q1 is closed by this. **It is not gated:** the back-office session is
  already a manager's, no PIN gate or confirmation has been granted, and I-11 keeps PIN gates on
  the POS. Draw the reprint as one action.
- **No audit wording on any reprint result.** The artifact does not tell the manager what is
  recorded. Whether a back-office reprint of a *cancellation* ticket is a "kitchen ticket" for
  FR-J3 is open with the owner (below); drawing no audit claim keeps the artifact true either
  way. A receipt reprint is not in FR-J3.
- **Report-print failures are not BO-13's** (Q7 is open with the owner). Draw no report
  incident, no report row and no third class. `F/report-detail.html`'s promise of a receipt-class
  report incident is slice H's to settle; leave it.
- **Desktop recovery sizes** (Q9): slice A kept the 36px office action for the kitchen banner
  and 28px for the receipt chip, with an 80px-minimum solid-red field doing the urgency work.
  Use the same on this page unless the browser review at 1440 shows a reason not to; argue any
  change in the Handoff.
- **Business-day and time display:** times are `HH:MM` in WIB; no business-day start or end is
  drawn (Q2 is open). The top bar keeps slice A's indicator.
- **Tokens** (lead, DESIGN-011 Q12, as in slice A): registry first; a missing value may be
  registered in `frost.tokens.json`, `frost.css` and `docs/DESIGN.md` with `source: null` and a
  `designed` record, each listed in the Handoff. No raw colour, size or weight in an artifact. No
  success green.

## What to draw

### Part A — the incident table, by class

1. **Kitchen work** (emergency, FR-E3): a table of failed kitchen tickets naming the order (table
   or quick sale), the fire round and its time, the lines it carries, and the delivery state.
   `FAILED` and `UNKNOWN` read differently: `UNKNOWN` never says the kitchen has not seen it.
2. **Cancellation tickets** (emergency, FR-H4, B-16): their own rows, visibly a cancellation in
   every state, with the cancelled lines. A cancellation is never offered, drawn or resulted as
   new work. Its own `FAILED` and `UNKNOWN`.
3. **Receipts** (warning, FR-E6, FR-G8): a lower-urgency section after both emergency classes,
   never with the same weight, placement or dismissal behaviour. `FAILED` and `UNKNOWN` (the
   wireframe has no receipt `UNKNOWN`). The order is closed whatever the receipt did (FR-G8).
4. Section priority and placement follow FR-E6 and AC-23 at desktop density; decide the table
   columns and row actions with DESIGN-012's table pattern and record them.

### Part B — recovery, per incident

1. **Reprint** for each class, with a result tied to **that** incident and class: *sent* (never
   "printed"), *failed again*, *outcome unknown* (the page rereads before saying more, and never
   offers an automatic resend, DESIGN-012 Q11), and a server-confirmed printed result. A
   cancellation's reprint result is a cancellation's; a receipt's is a receipt's.
2. **Kitchen and cancellation clearance:** an explicit, checked acknowledgement that the kitchen
   has the paper, then *Clear*, the desktop counterpart of the POS meaning, not its touch cards.
   Clearing is never implied by a reprint.
3. **Receipt dismissal:** one action, distinct from kitchen clearance.
4. **Cleared elsewhere** (FR-E3, AC-33: one incident, both clients): an incident resolved on the
   POS while this page is open leaves the table without claiming the manager did it.
5. When the last kitchen or cancellation incident clears, the global emergency is gone on every
   back-office artifact; when the last receipt is dismissed, the chip is gone. Walk it.

### Part C — page states

The inventory's set (`I:868–871`): `empty`, `loading`, `error` (with *Try again*), permission
denied is n/a, `overflow` (many incidents of mixed classes; the emergency classes stay first and
the header sticks inside its scroll owner), and the state per class and delivery above. The
empty copy states the fact (nothing outstanding), not that everything printed: a dismissed
receipt did not print. Name each state as you judge best and register all of them.

### Part D — links, gallery and inventory

1. Point every BO-13 destination in the back office at the new artifact: the emergency action and
   the receipt chip in `F/office.js`, the *Printing* navigation entry, and the one `incidents.html`
   link each in `F/menu.html` and `F/report-detail.html`. Carry the current alert context
   (`alerts`), so arriving from a kitchen banner shows that incident. `grep -c "prototype/"`
   then gives 39 and 10 for those two pages.
2. Register the artifact and every state in `manifest.js` and the gallery.
3. Bring the inventory into line with FR-J3 and DECISIONS 2026-09-24, using exactly this wording:
   - `I:991`, the I-8 row's ruling cell, becomes: **Audited** (owner, 2026-09-24; FR-J3): the
     entry names the actor, the order and the round reprinted. No gate is added: none is granted,
     and I-11 keeps PIN gates on the POS. Drawn on BO-13. Whether a cancellation-ticket reprint
     counts is open with the owner.
   - `I:882–883`, the BO-13 bullet, becomes: A back-office reprint of a kitchen ticket is audited
     and not gated (FR-J3, I-8). The screen makes no claim about what is recorded.
   - `I:845–847`, BO-12's list, inserts "back-office reprint of a kitchen ticket," after
     "manager takeover of a CheckoutLease,".
   - `P/incidents.html:110–113`: the *Open — I-8* annotation is replaced by one sentence saying
     I-8 is settled (audited, FR-J3) and pointing to the Frost artifact.
   No other line of `SCREEN-INVENTORY.md` or `SITEMAP.md` changes. A further conflict you find is
   raised in the Handoff with exact proposed wording.

## Constraints

- Light only, desktop only, 1440 wide. Whole rupiah at precision 0 in every fixture.
- No POS operation, no cashier view, no remote approval, no PIN pad, no dark mode, no report
  incident, and nothing the inventory or the PRD does not grant. *Invent, revert, ask.*
- The four product documents are not edited.
- Do not change DESIGN-012's shared behaviour. A narrow extension of `office.css` or `office.js`
  that BO-13 needs (a link target, an alert identity field) is allowed and listed in the Handoff;
  shell and patterns states must still pass slice A's check.
- Measure in a browser at 1440×900. Each run of a check script needs the owner's approval in the
  pane; ask before it, not after. Evidence (screenshots, `measurements.json`) stays outside the
  repository; quote the measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must
pass unchanged; if it does not, stop and raise it. `docs/design/checks/design012.cjs` may need its
expected link counts and BO-13 destinations updated for Part D; say so in the Handoff.

## Acceptance criteria

1. `frost/back-office/incidents.html` exists, imports the shared `office.css`, and every state is
   reachable by `?state=` and registered in `manifest.js`. Red if a state is missing or
   unreachable.
2. The Handoff maps every inventory state (`I:868–871`) and every item of Parts A to D to the
   state or walk that shows it.
3. Shown in the browser, with the method in the Handoff: a reprint from each of the three classes,
   from a page holding all three, leaves the other incidents unchanged and reports the result on
   the incident it came from; no path turns a cancellation into work.
4. Shown in the browser: clearing the last kitchen incident removes the emergency on `shell.html`,
   `patterns.html`, `menu.html` and `report-detail.html`, and dismissing the last receipt removes
   the chip. Arriving from a kitchen banner shows that same incident.
5. Browser measurements at 1440×900 in the Handoff: the frame's slice-A geometry unchanged, the
   recovery action sizes chosen, the sticky header in `overflow` after scrolling.
6. `grep -c "prototype/"` gives 39 for `F/menu.html` and 10 for `F/report-detail.html`, and no
   back-office Frost artifact links to `prototype/back-office/incidents.html`.
7. The four inventory and wireframe edits in Part D are exactly as worded, and nothing else in
   those files changed (`git diff` in the Handoff).
8. No raw colour, size or weight in a new or changed artifact; every new token registered with
   designed provenance and listed. `npm run verify` green if anything under `docs/design/tokens/`
   changed. Slice A's browser check still passes.
9. The Handoff lists every question raised and not ruled, with a proposed answer.

## Questions for the owner, already raised (draw around them; do not decide)

- Is a back-office reprint of a cancellation ticket a "kitchen ticket" reprint for FR-J3?
  (Lead's proposed answer: yes, it prints at the kitchen and B-16 makes it the higher-risk paper.)
- Q7: does a failed report print belong on BO-13 at all?

## Out of scope

- Any other screen's content (slices B and D to I), BO-14, and the three slice-A lows N1–N3.
- Printed ticket and receipt layouts, and fiscal receipt content (PRD §9).
- The POS incidents artifact: not edited.
- Building anything.

## Reporting

Commit on `agent/design-013` only, after verify is green where it applies, and never push. Then:

    herdr agent prompt lead "design013: DESIGN-013 done — <one line>"
    herdr agent prompt lead "design013: BLOCKED — <question>"

## Handoff

### Delivery and entry points

Designed by design013 on 2026-10-06 on `agent/design-013`. This is a local Frost
fixture for design review, not an application implementation. The entry point is
`docs/design/visual-directions/frost/back-office/incidents.html?state=default`.
The gallery entry is
`docs/design/visual-directions/index.html?direction=frost&screen=back-office/incidents.html&state=default`.
All 29 declared states are registered in the manifest and reachable directly.

| File | Change and purpose |
|---|---|
| `frost/back-office/incidents.html` | BO-13 structure, five-column emergency table, separate receipt table, read/result regions, and labelled fixture controls. |
| `frost/back-office/incidents.css` | Token-only incident treatment layered on the imported shared office stylesheet. The emergency rows remain solid red; receipts remain pale amber. |
| `frost/back-office/incidents.js` | Incident-specific reprint, delivery reread, checked clearance, receipt dismissal and simulated POS clearance. |
| `frost/back-office/office.js` | Narrow alert-context extension: Frost BO-13 destinations, incident identities/results in the URL, updated remaining-incident banner/chip, and explicit `alerts=none` after the final resolution. Shared authentication, dialog and form behavior is unchanged. |
| `frost/back-office/menu.html`, `report-detail.html` | Each authored Printing link now points to `incidents.html`. No page content changed. |
| `manifest.js`, `index.html` | Frost-only BO-13 gallery registration, all 29 states, and gallery scope copy. |
| `docs/design/SCREEN-INVENTORY.md` | Only the three requested I-8/BO-12/BO-13 edits. |
| `docs/design/prototype/back-office/incidents.html` | Only the requested I-8 annotation replacement, with a link to Frost. |
| `docs/design/checks/design013.cjs` | Re-runnable 1440×900 state, identity, recovery, navigation and geometry checks; external evidence only. |
| `docs/design/checks/design012.cjs` | Its uncertain-navigation destination assertion now compares the destination pathname and retained `alerts` context. BO-13 adds its incident context to the URL when read; exact full-URL equality would reject that intended extension. No assertion was removed. |

Paths beginning `frost/`, `manifest.js` and `index.html` above are relative to
`docs/design/visual-directions/`. `office.css`, the tokens, `docs/DESIGN.md`, the
four product documents, SITEMAP, the POS artifact and all application files are
unchanged. No new token was needed.

### Requirement and state map

| Requirement | State or demonstrated walk |
|---|---|
| A1: kitchen work, order/round/time/lines | `default`, `kitchen-failed`, `kitchen-unknown`; `overflow` includes table and quick-sale orders. Table 1 round 2 at 19:58 contains one Burger and one Fries. |
| A2: cancellation identity and cancelled lines | `cancel-failed`, `cancel-unknown`, and the cancellation row in `default`. Table 1 round 2's cancellation at 20:02 contains only one Burger and says “Stop the cancelled work.” |
| A3: receipt FAILED/UNKNOWN, closed order | `receipt-failed`, `receipt-unknown`, and the receipt row in `default`. Table 1 closed at 20:14; total 155.925 IDR. The receipt section states that these orders are closed. |
| A4: unequal urgency and desktop density | `default`: work and cancellation in the upper solid-red table; receipts in a separate lower amber table. Emergency recovery is 36px; receipt recovery/dismissal is 28px. |
| B1: reprint outcomes for all three classes | `kitchen-reprint-{pending,sent,failed,unknown,printed}`, `cancel-reprint-{pending,sent,failed,unknown,printed}`, `receipt-reprint-{pending,sent,failed,unknown,printed}`. Each composition retains all three original incidents and places its result only on the named incident. |
| B1: live subject preservation | From `default`, choose each response under Review controls and reprint each class in turn. The browser compared the other two rows' complete HTML before and after each of the 12 combinations; all were unchanged. A cancellation always retained `kind=cancel` and its cancellation result. |
| B1: uncertainty | `*-reprint-unknown` disables reprint and offers “Check delivery status”, a read only. In the interactive Unknown fixture, the request is followed by a simulated reread that resolves to server-confirmed PRINTED. No resend occurs. Direct states hold for inspection until the read action is taken. |
| B2: explicit kitchen/cancellation clearance | `kitchen-checked`, `cancel-checked`; unchecked Clear is disabled. Check “I checked: the kitchen has this ticket/cancellation.”, then Clear. No reprint outcome checks the box or removes the row. |
| B3: separate receipt dismissal | `receipt-failed` or `receipt-unknown` → Dismiss. One action, no kitchen acknowledgement or confirmation dialog. |
| B4: cleared elsewhere | `cleared-elsewhere`, or `default` → Review controls → Simulate Table 1 kitchen clearance on POS. Only `ticket-1` leaves; the notice says it “was cleared on the POS.” The cancellation and receipt remain. |
| B5: last incident and cross-page alerts | The browser walked the kitchen banner from shell, patterns, menu and report detail to the same Table 1 round 2 at 19:58. It checked and cleared that ticket, returned to each source and verified emergency absence with the receipt chip still present. It then followed the chip, dismissed the receipt, returned, and verified both alerts absent. |
| C: empty | `empty`, or clear/dismiss all rows: “Nothing outstanding” / “No unresolved print incidents.” No claim that every paper printed. |
| C: loading/error/retry | `loading`, `error`; Try again visibly traverses loading and returns the mixed table. Counts and rows are withheld while unread. Incoming known global alerts remain visible. |
| C: overflow | `overflow`: 21 incidents, seven per class, with work then cancellation then receipts; compact table padding and a header sticky inside `.bocontent`. |
| C: permission denied | Not drawn, as the inventory says n/a for the manager-only back office. |
| D1: every BO-13 destination | Shared banner, receipt chip and Printing navigation target Frost; menu/report authored links do too. `alerts` and incident context survive navigation. No Frost back-office file references the old prototype BO-13 destination. |
| D2: gallery | All 29 states registered. The browser opened the gallery directly at `cancel-reprint-unknown` and verified its iframe destination. |
| D3: settled I-8 text | The inventory's I-8 ruling and BO-13 bullet use the task's exact wording; BO-12 receives the requested audit-list insertion. The wireframe annotation is one sentence saying I-8 is settled/audited under FR-J3 and linking to Frost. |

### Decisions a builder needs

The emergency table columns are Ticket/order, Round/time, Lines on the ticket,
Delivery, and Recovery. Cancellation rows retain their own ticket class and
cancelled lines in every result. The time is the ticket's time: original work at
19:58 or cancellation at 20:02, with the original round identified in both.
Receipts have Order, Closed at, Total, Delivery, and Recovery. Totals are bare
whole-rupiah figures; IDR appears once in the receipt caption. Both tables consume
`.office-table`; intrinsic column sizing permits wrapping without truncating
identity, lines or recovery copy.

The shared table's sticky header and existing 36px/28px office actions are reused,
not forked. No new modal is necessary: reprint is one action, the kitchen
acknowledgement is explicit within the row, and receipt dismissal is one action.
The destructive-confirmation pattern was read but is not added where the task
has granted no extra gate. Pending/sent results say neither failed again nor
printed; the delivery cell reads “Sending…” or “Awaiting result”. Only the
server-confirmed fixture says PRINTED. Results use the shared neutral blue notice,
never success green, and make no audit claims.

A sent, pending, unknown or confirmed-printed reprint disables another reprint.
Pending/sent/unknown offer “Check delivery status”; a definite failed-again result
permits a new explicit attempt. Kitchen clearance still requires the checked
paper acknowledgement, including after PRINTED. Receipt dismissal remains
available independently of its print result. Checking paper acknowledges this
particular incident; it does not fire, void, close or otherwise operate an order.

The alert context extends DESIGN-012's URL-scoped fixtures, without browser
storage. It carries remaining IDs, deliveries, results and the first outstanding
emergency/receipt identity; `alerts=none` takes precedence over a named kitchen
state after clearance. A cleared work ticket cannot hide a remaining cancellation:
the banner switches to that cancellation. Navigation and reload preserve cleared
rows and outcome uncertainty. This demonstrates shared incident meaning and
incoming POS updates locally; no real cross-client transport or persistence
contract is implemented. Already-open independent browser tabs are not a service
simulation.

### Verification and browser evidence

The owner approved the DESIGN-013 browser command in this pane before execution:

```sh
PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design013.cjs
```

The committed check requires an installed Playwright module through
`PLAYWRIGHT_MODULE`, with an optional `CHROME_PATH`; it contains no machine-specific
module default. It ran installed headless Chrome at 1440×900, passed **185/185
assertions across 29 states**, and found **zero page JavaScript errors** and
**zero horizontal document or content overflow**. Evidence is outside the repo
at `/tmp/design013-evidence/`, including every state capture,
`overflow-scrolled.png` and `measurements.json`.

| Measurement | Observed |
|---|---|
| Frame | 1440×900 |
| Navigation / top bar | 220px / 64px |
| Content padding / body type | 24px / 14px |
| Emergency banner | x=220, y=64, width=1220, height=80 |
| Kitchen recovery | 36px high; default Reprint ticket width 110.671875px |
| Receipt recovery | 28px high; default Reprint receipt width 102.046875px |
| Overflow sticky header | y=144 after content scrollTop=450; header height 56.875px |
| Banner after overflow scroll | Exactly the same rectangle as before scrolling |

The header begins at the content owner's visible edge immediately below the
banner; the browser's hit test at (300,145) finds a header cell, not a row in a
gap. I visually inspected the default, cancellation-unknown result,
receipt-unknown and scrolled-overflow captures. The receipt-only state retains
lower visual weight even when there is no emergency. No visual iteration or
second DESIGN-013 run was necessary.

`npm run verify` first failed because the sandbox refused the existing PostgreSQL
connection at 127.0.0.1:5433. The approved rerun passed typechecking and **46 test
files / 2,758 tests**, including the unchanged token tests. The existing Vite
future-native-config-loader warning remains. JavaScript syntax checks and
`git diff --check` passed. Impeccable context and craft guidance were used; its
context loader selected the historical comparison DESIGN, so the task's
`docs/DESIGN.md` remained authoritative. The one mechanical detector run returned
an empty findings list. No raw color, pixel size or numeric font weight was found
in the new artifacts or the changed office runtime.

The authored prototype-link counts are **39** in menu and **10** in report detail.
`git diff -- docs/design/SCREEN-INVENTORY.md docs/design/prototype/back-office/incidents.html`
was inspected: exactly three inventory hunks and one annotation hunk, with no
other changes in either file. `git diff -- docs/design/SITEMAP.md` is empty.
Screen-reader, physical-device, real-printer and other-browser tests were not run.

### Unresolved owner questions and proposed answers

- Cancellation-ticket reprint audit classification under FR-J3 remains open.
  Proposed answer: yes, as already proposed by the lead, because it prints at the
  kitchen and B-16 makes its correction identity critical. The artifact makes no
  audit statement and introduces no gate.
- Q7, report-print incidents, remains open. Proposed answer: keep failure and
  explicit retry local to the report until the owner grants a BO-13 class. No
  report row or third urgency class is drawn; the existing report promise is
  unchanged for slice H.
- Q2, full business-day labeling, remains open. Proposed interim answer: retain
  slice A's opening-date indicator and HH:MM WIB ticket times. No start/end is
  inferred.
- No additional product conflict or token proposal was found. The task's Q9
  presentation answer remains the existing 36px/28px desktop recovery sizes,
  supported by the measurements above. DESIGN-012 lows N1–N3 remain slice B's.

### DESIGN-012 regression and completion

After a separate owner approval in this pane, I ran:

```sh
env PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design012.cjs
```

The regression passed **216/216 assertions across 47 states**, with zero page
JavaScript errors and no failed assertions. Its external evidence remains in
`/tmp/design012-evidence/round2/measurements.json` and the adjacent captures.
Navigation remains 220px, brand/top bar 64px, content padding 24px and body text
14px; emergency/receipt actions remain 36px/28px, fields 40px, and the dialog
640px wide at y=24–876. The shared table header remains at y=64 when scrolled
without a banner. I inspected its scrolled-table capture. This confirms slice A's
shell, forms, re-authentication, uncertain-command departure, table and gallery
checks still pass with Frost BO-13 as their incident destination.

All assigned work is complete for design review. The path-scoped commit includes
only this task's Handoff and the design files listed above; nothing is pushed.

DONE
