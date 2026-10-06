---
id: DESIGN-013
title: BO-13 print incidents in Frost, the desktop incident table with every urgency, delivery, reprint and clearance state
category: ui
touches: [audit]
depends_on: [DESIGN-012]
owns: [docs/design/**]
status: not-started
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
