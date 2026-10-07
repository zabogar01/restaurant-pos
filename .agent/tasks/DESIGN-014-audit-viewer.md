---
id: DESIGN-014
title: BO-12 audit viewer in Frost, read-only, with every audited action and outcome, working filters, paging and subject-correct detail
category: ui
touches: [audit, identity]
depends_on: [DESIGN-012, DESIGN-013]
owns: [docs/design/**]
status: running
cycles: 1
---
# DESIGN-014 — BO-12 audit viewer (slice I)

**Written** 2026-10-07 by the lead. Slice I of the nine back-office design slices proposed in
DESIGN-011 (`.agent/reviews/DESIGN-011-back-office-audit.md`), drawn inside the frame slice A
delivered (DESIGN-012, PR #55) and beside slice C's BO-13 (DESIGN-013, PR #57).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane.
**Branch and place:** `agent/design-014`, cut from `development` at `93c6f2c`, in the worktree
`../restaurant-pos-wt/DESIGN-014`. Touch nothing under `apps/`, `packages/` or `db/`, nothing
in `docs/DESIGN.md` except as allowed under *Tokens*, and nothing in the main checkout at
`../restaurant-pos`.

Nothing is built from this task. A design review follows, and BO-12 is built against fixtures
only after it is reviewed.

## Objective

The audit viewer answers "why is the till short?" the next morning (BO-12's purpose). Today it
has only a greyscale wireframe (`P/audit.html`) in which every *Open* shows the same refund, the
overflow drops *Open* entirely, *Older* links to itself, discount rows show preset names instead
of money, the refund detail says the order total became zero, and the current FR-J3 outcomes
(`REFUSED`, the back-office reprint) are missing (DESIGN-011, BO-12 section). When this task is
done, a Frost artifact `frost/back-office/audit.html` draws every BO-12 state in the inventory and
every audited action and outcome listed below, each with read-only detail correct for its own
subject; filters and paging work in the fixture; the back office's Audit links lead to it; and
the inventory and wireframe say what has been ruled.

## Required inputs

Read these, in this order. Everything you need is here or cited. Abbreviations are DESIGN-011's
(`I`, `D`, `S`, `P/`, `F/`, `W`, `V`, `T`).

1. `.agent/reviews/DESIGN-011-back-office-audit.md`: the BO-12 section (`:279–300`), S1 to S5
   (`:56` onward), *Shared pieces*, the link-ledger row for `audit.html` (`:347`), the slice I row
   (`:466`), and questions Q1 and Q8 (`:439`, `:446`). Q1 and Q8 are now ruled (below).
2. **DESIGN-012's Handoff**, `.agent/tasks/DESIGN-012-office-shell-and-reauth.md:312` to the
   end, especially *Design decisions and downstream use* (scroll ownership, the table pattern,
   read states, uncertainty). The shared frame is `F/office.css` and `F/office.js`; the patterns
   you reuse (table, read states, empty states) are walkable in `F/patterns.html`. Consume them;
   do not copy or fork them. Its three low findings N1–N3 (`:296–310`) are slice B's, not yours.
3. **DESIGN-013's Handoff**, `.agent/tasks/DESIGN-013-print-incidents-desktop.md:269` to the end,
   for how a slice extends `office.js` narrowly, registers states, and writes its check script;
   and its fixture subjects (Table 1 round 2 at 19:58; Table 4's cancellation at 20:02), which you
   may reuse for the reprint entries so that the two screens tell one story.
4. `docs/design/SCREEN-INVENTORY.md` BO-12 `:827–856`, its conventions `:16–41`, ruling I-3 and
   the BO-14 note `:1061–1065` (the security telemetry viewer is deferred and must stay
   structurally distinct from BO-12).
5. `docs/design/SITEMAP.md` `:236–250` (back-office chrome) and `:310–319` (what the back office
   never offers).
6. `docs/DESIGN.md`: office density (`D:707–730`), shell (`D:801–811`), actions (`D:963–970`),
   tables (`D:1138–1157`), empty states (`D:1196–1199`), DESIGN-012's supplement, and token
   provenance (`D:486–506`).
7. The contract: `docs/PRD.md` FR-J1 to FR-J4 (`:328–348`), FR-F (discounts), FR-G13 and FR-G14
   (`CheckoutLease`), FR-H1 to FR-H7 (void and refund), FR-I5 (how voids are valued), §9 (time
   display, business day), AC-11 and AC-18; `docs/BOUNDARIES.md` B-7, B-8, B-12, B-13.
8. The stored shape, for meaning only: `db/migrations/0004_audit_entry_and_security_event.sql`.
   An entry has an actor (never null), an optional approver, an action, an outcome, an optional
   subject, an optional reason, optional before and after amounts, and its time. Draw what a
   manager needs to read, not the column names.

## Rulings that bind this task

Each is recorded in `.agent/DECISIONS.md` on the date given unless marked as the lead's.

- **The audited actions are exactly** (FR-J3 and the owner's rulings): whole-order void, fired-line
  void, discount apply, replace and remove, refund, manager takeover of a `CheckoutLease`,
  back-office reprint of a kitchen ticket, **a cancellation ticket included** (owner, 2026-10-06),
  and every manager-approval outcome. Nothing else appears: not removing a `PENDING` line (FR-H2),
  not cancelling an order with no sent lines (owner, 2026-10-06: no audit entry), not a receipt
  reprint, not a back-office configuration change, not a sign-in.
- **The outcomes to draw:**
  1. *Approved action, success:* one combined entry naming actor **and** approver (FR-J3, AC-18).
     The approver may be the actor (a manager approving their own void; ARCHITECTURE 7.1). An
     action with no approval (a back-office reprint, a manager's takeover) names its actor only.
  2. *Approval failed:* one entry naming the actor, approver null. It is in the audit log only,
     never also a security event (owner, 2026-10-07).
  3. *Approval cancelled:* one entry naming the actor, approver null. An abandoned approval prompt
     is a cancelled approval (owner, 2026-10-06).
  4. *`REFUSED`:* an approved action the server then refuses, naming actor and approver, with the
     refusal code (for example the business day closed in the meantime) and **no amounts**. It
     applies to a refund (FR-J3, AC-18) and to a void (owner, 2026-10-06; the PRD wording for the
     void is owed and not yet approved, so cite the ruling, not the PRD).
  5. *Approval refused by the cooldown:* a cashier's request for manager approval made while the
     approval class is cooling down writes an **audit entry**, actor named, approver null (owner,
     2026-10-06). This is not the cooldown itself, which stays security telemetry and is not on
     this screen. Its stored outcome name is not decided yet (plan Task 10's consult adds it), so
     show a plain-language label and **no code** for this outcome.
- **Amounts** (FR-J2; whole rupiah, precision 0):
  - *Refund* (lead under the owner's delegation, 2026-10-05, DESIGN-011 Q8): the entry stores the
    order's net charged total before the refund and after it (0 for the MVP's full refund). The
    viewer shows **Charged, Refunded and Net**. The order's own total never changes and is never
    drawn as zero (B-8).
  - *Whole-order void* (lead, from ARCHITECTURE 6 and FR-I5): the order total immediately before
    the void, and the void's value equal to it.
  - *Fired-line void* (lead, from FR-I5 and ARCHITECTURE 6): both the line's tax-inclusive
    snapshot value **and** the order total before and after. They differ when an order discount or
    service charge applies; a fixture should show them differing.
  - *Discount apply, replace, remove* (lead, from ARCHITECTURE 7 "one before/after transition"):
    the order total before and after, plus the discount's snapshot (name, kind, value) before and
    after as the subject. A preset's name is never shown in place of the money.
  - *Failed, cancelled, cooldown-refused and `REFUSED` entries:* no amounts. Name the action that
    was attempted.
  - *Takeover and reprint:* no amounts. A reprint names the actor, the order and the round
    reprinted (FR-J3).
  The three lead lines above are the owner's to overturn; note them as such in the Handoff.
- **Read-only, strictly** (FR-J1, B-7, I `:843`): no edit, delete, hide or row action menu.
  Opening an entry's detail is the only action on an entry.
- **People** (B-13): every entry names a person. A deactivated staff member's entries still show
  their name; draw one. No "system" or terminal actor.
- **No PIN or password value in any form** (FR-J4, B-12), and no field that looks like one.
- **No security telemetry** (FR-J3, I-3): unauthenticated PIN failures, cooldowns starting, and
  back-office sign-in failures do not appear, and no link, tab or filter suggests BO-14.
- **Time and business day:** times are `HH:MM` in WIB (PRD §9); the wireframe's seconds go. A
  business day runs from one end-of-day close to the next and is named by the WIB date on which
  it opened (owner, 2026-10-06; PRD §9). Filtering by business day is allowed; name a day by its
  opening date, and do not draw a start or end time.
- **Tokens** (lead, DESIGN-011 Q12, as in slices A and C): registry first; a missing value may be
  registered in `frost.tokens.json`, `frost.css` and `docs/DESIGN.md` with `source: null` and a
  `designed` record, each listed in the Handoff. No raw colour, size or weight in an artifact. No
  success green.

## What to draw

### Part A — the list

1. A table of entries, newest first, at office density, using DESIGN-012's table pattern: time,
   action, outcome, actor, approver, order (or subject), and whatever summary column you judge a
   manager needs. Choose and record the columns.
2. One fixture business day whose entries include **every** action and outcome above at least
   once: a combined success for each action, a self-approved void, a failed and a cancelled
   approval, a refund `REFUSED` and a void `REFUSED`, a cooldown-refused approval, a takeover, a
   work-ticket reprint and a cancellation-ticket reprint, and a deactivated actor.
3. Outcomes read differently from one another without colour alone; a failed, cancelled or
   refused entry never looks like a success.

### Part B — filters and paging, working in the fixture

1. Filters for business day, action, outcome and person (actor or approver). Each narrows the
   table in the browser; together they combine. Clearing them restores the list.
2. Paging over a long log (*overflow*): Older and Newer move between real pages, the position is
   stated, and the header sticks inside its scroll owner. Filters persist across pages.
3. The two empties are different states: **no entries yet** (a new installation; no filter can
   help) and **no entries match** (the filter is the cause; offer to clear it).

### Part C — entry detail, by subject

1. Opening an entry shows detail for **that** entry: its action, outcome, actor, approver (or
   none), order and round where applicable, reason where the action carries one, the amounts
   ruled above, and the time. Draw one detail per action and per non-success outcome.
2. Detail is read-only, keyboard reachable, and returns focus to the entry it came from. Choose
   modal or side panel with DESIGN-012's patterns and record why.
3. Opening detail from a filtered or paged list returns to the same filter and page.

### Part D — page states

The inventory's set (`I:833–838`): `empty` (no entries yet), `nomatch`, `loading`, `error` (with
*Try again*), permission denied is n/a, `overflow`, the approved-action entry, the failed or
cancelled approval entry, and the entry detail with before/after amounts and business reason;
plus the outcomes and details above. Name each state as you judge best and register all of them.

### Part E — links, gallery, inventory and wireframe

1. Point every BO-12 destination in the back office at the new artifact: the *Audit* navigation
   entry in `F/office.js` (add `audit` beside `menu` and `incidents` where Frost destinations are
   resolved), and the one authored `audit.html` link each in `F/menu.html` and
   `F/report-detail.html`. `grep -c "prototype/"` then gives **38** and **9** for those two pages.
2. Register the artifact and every state in `manifest.js` and the gallery.
3. Bring the inventory and wireframe into line with the rulings, using exactly this wording:
   - `I:845–848`, BO-12's audited-actions bullet: after "back-office reprint of a kitchen ticket,"
     (`:846`) insert " a cancellation ticket included (owner, 2026-10-06),"; the rest of the
     bullet is unchanged.
   - After `I:850` (the one-combined-entry bullet), insert a new bullet: "- An approved refund or
     void that the server then refuses is one `REFUSED` entry naming actor and approver, with the
     refusal code and no amounts (FR-J3, AC-18; the void by owner ruling, 2026-10-06). A manager
     approval refused by the cooldown is an audit entry naming the actor, approver null (owner,
     2026-10-06); the cooldown itself stays security telemetry."
   - `P/audit.html`, the rail bullet beginning "Audited actions are exactly", becomes:
     "Audited actions are exactly: whole-order void, fired-line void, discount
     apply/replace/remove, refund, manager takeover of a checkout lease, back-office reprint of a
     kitchen ticket (a cancellation ticket included), and every manager-approval outcome. The
     <a href="../../visual-directions/frost/back-office/audit.html">Frost BO-12 artifact</a>
     draws them all." followed by the existing `FR-J3` span.
   No other line of `SCREEN-INVENTORY.md`, `SITEMAP.md` or `P/audit.html` changes. A further
   conflict you find is raised in the Handoff with exact proposed wording.

## Constraints

- Light only, desktop only, 1440 wide. Whole rupiah at precision 0 in every fixture.
- No POS operation, no remote approval, no PIN pad, no dark mode, no export or print of the log,
  no telemetry view, and nothing the inventory or the PRD does not grant. *Invent, revert, ask.*
- The four product documents are not edited.
- Do not change DESIGN-012's shared behaviour or DESIGN-013's incident behaviour. A narrow
  extension of `office.js` (the Audit destination) is allowed and listed in the Handoff; shell,
  patterns and incident states must still pass the slice A and slice C checks.
- Measure in a browser at 1440×900. Each run of a check script needs the owner's approval in the
  pane; ask before it, not after. Evidence (screenshots, `measurements.json`) stays outside the
  repository; quote the measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must
pass unchanged; if it does not, stop and raise it. `docs/design/checks/design012.cjs` and
`design013.cjs` may need their expected prototype-link counts or Audit destination updated for
Part E; change only those expectations, say so in the Handoff, and remove or weaken no assertion.

## Acceptance criteria

1. `frost/back-office/audit.html` exists, imports the shared `office.css`, and every state is
   reachable by `?state=` and registered in `manifest.js`. Red if a state is missing or
   unreachable.
2. The Handoff maps every inventory state (`I:833–838`), every outcome and action under *Rulings*,
   and every item of Parts A to E to the state or walk that shows it.
3. Shown in the browser, with the method in the Handoff: opening each kind of entry shows that
   entry's own subject and amounts, never another's; a `REFUSED`, failed, cancelled or
   cooldown-refused entry shows no amounts; a refund shows Charged, Refunded and Net and never an
   order total of zero.
4. Shown in the browser: each filter narrows the list and they combine; Older and Newer move
   between distinct pages; opening and closing detail returns to the same filter, page and entry
   with focus on it; clearing a no-match filter restores the list.
5. No control on the page edits, deletes, hides or exports an entry; no text or field shows a PIN,
   a password, or a security event.
6. Browser measurements at 1440×900 in the Handoff: the frame's slice-A geometry unchanged, the
   sticky header in `overflow` after scrolling, and no horizontal overflow at the longest fixture
   amount and name.
7. `grep -c "prototype/"` gives 38 for `F/menu.html` and 9 for `F/report-detail.html`, and no
   back-office Frost artifact links to `prototype/back-office/audit.html`.
8. The three inventory and wireframe edits in Part E are exactly as worded, and nothing else in
   those files changed (`git diff` in the Handoff).
9. No raw colour, size or weight in a new or changed artifact; every new token registered with
   designed provenance and listed. `npm run verify` green if anything under `docs/design/tokens/`
   changed. Slice A's and slice C's browser checks still pass.
10. The Handoff lists every question raised and not ruled, with a proposed answer, and names the
    three lead rulings on amounts as the owner's to overturn.

## Questions already open with the owner (draw around them; do not decide)

- The PRD wording for a void `REFUSED` and for an abandoned approval as cancelled is owed (the
  rulings stand; only the contract text lags).
- A post-close correction is a new, manager-approved, audited adjustment in the open day (owner,
  2026-10-06), but no screen creates one yet and FR-J3 does not list it. **Do not draw it**; say
  in the Handoff where it would sit.

## Out of scope

- Any other screen's content (slices B and D to H), BO-14, and the slice-A lows N1–N3.
- The stored outcome name for the cooldown refusal, the refusal codes' full list, and any server
  or API shape.
- Building anything.

## Reporting

Commit on `agent/design-014` only, after verify is green where it applies, and never push. Then:

    herdr agent prompt lead "design014: DESIGN-014 done — <one line>"
    herdr agent prompt lead "design014: BLOCKED — <question>"

## Round 2 — the review's five findings (lead rulings, 2026-10-07)

The review is `.agent/reviews/DESIGN-014-review.md` (Claude Opus 5.5, at `82e622d`). Read it in
full. Every finding is accepted; this is fix cycle 1 of 2. The reviewer ran no browser; the lead
walked `default` in Chrome (filters combine, `nomatch` clears to 48, Older reaches page 2, the
refund and refused-void details are their own, Escape returns focus to the originating Open), so
those paths hold.

- **The lead's error, corrected.** The task's parenthesis under *Rulings* ("for example the
  business day closed in the meantime") applied to the refund only. A void applies only to an
  `OPEN` order (FR-H1), and end of day is refused while any order is open (FR-I2), so a void can
  never be refused because its day closed. Read that ruling as: a refund may be refused because its
  business day closed in the meantime; a void is refused for another reason.
- **F1 (medium):** as proposed. The refused void is on an order in the open day (for example
  T6-0610), refused because another client began settlement or settled it between approval and
  commit (FR-G13). Its refusal code stays visibly illustrative (for example `ORDER_NOT_OPEN`); the
  full list of codes is not this task's. Drop its "Order's business day" fact, and derive every
  list summary from the record, never a literal. Also make the refused refund tell FR-J3's story:
  its order's business day closes between approval and commit, and the Handoff states the timeline
  the fixture implies. Choose the fixture; do not invent a rule.
- **F2 (medium-low):** as proposed. Each record carries its own occurrence date and time apart
  from its business day. Add at least one entry after midnight inside the business day opened Tue 6
  Oct (for example 00:20 on Wed 7 Oct), so the list and the detail show the two dates differing.
  The business-day filter keeps filtering on the business day; "newest first" orders by occurrence.
- **F3 (low):** as proposed. The fired-line void's summary reads its own `amounts`.
- **F4 (low):** as proposed. Give the refund its own total, distinct from 155.925, and make the
  check assert that each entry detail does not contain a neighbouring entry's distinguishing amount.
- **F5 (low):** as proposed. Scan the whole document, the open dialog included, for PIN, password
  and telemetry wording in every entry state; assert the page's buttons, links and inputs against an
  allowed list (the four filters, Clear filters, Newer, Older, Open, Try again, Close, plus the
  shared frame's navigation and Log out). State in the Handoff which row density BO-12 is built at
  and when, if ever, the tight density applies, and make `clear()` keep the state's density.

Re-run the DESIGN-014 check and both regression checks (each run is the owner's to approve in the
pane), and `git diff --check`. `npm run verify` is needed only if a token changes. Add a **Round 2**
section to the Handoff mapping each finding to its change and its evidence; do not rewrite round
1's sections except where a fix makes a statement in them untrue. Commit on `agent/design-014`.

## Handoff

### Delivery and design decisions

Designed by design014 on `agent/design-014`. The entry point is
`docs/design/visual-directions/frost/back-office/audit.html`. This is a read-only
local fixture for design review, not an application or an audit-storage implementation.
The gallery registers all 24 states after Round 2 and keeps the original artifact
indices intact.

The list has eight columns: Time, Action, Outcome, Actor, Approver, Order, Summary
and Detail. Time includes the occurrence’s WIB calendar date, independently of
the business day’s opening date, so that an all-days result is unambiguous.
Summary carries labelled monetary values rather than discount names in place of
money; the detail carries the discount snapshots. Outcomes use explicit words,
with supplementary brick, amber or muted type for unsuccessful outcomes. Success
has ordinary ink and no success green. An absent approver reads “None” in the list;
detail distinguishes approval not required from approval not granted. A manager
approving their own void is explicitly labelled “Self-approved”. The historical
actor Ratna Ayu Kartikasari Prameswari remains named and searchable after deactivation.

Detail uses the shared 640px native dialog. Its protected reading focus allows
the manager to inspect a complete reason and monetary transition while retaining
the exact originating row, filters and page underneath. It consumes `Office.open`
and `Office.close`, including the shared focus containment and overflowing-body
behavior, rather than adding another panel or dialog implementation. Close and
Escape restore the originating Open button. Each button's accessible name includes
its action, order reference and time. The dialog contains only a Close action.

Business-day filtering initially selects Tue 6 Oct 2026, identified by opening
date without invented start/end times. The four filters combine immediately;
person matches actor or approver. Clear filters selects all business days, all
actions, all outcomes and anyone. Changing a filter resets to page 1. Twelve
entries occupy a page; Newer and Older move to distinct records, state the range
and page position, and preserve filters. URL query values also preserve filters,
page and the opened entry through reload. The viewport frame, scroll owner,
sticky header, fields, read notices, empties and dialog consume `office.css`.
BO-12 is built at standard 15px × 12px cell padding regardless of record count.
Only the explicitly selected overflow review fixture uses the existing 9px × 12px
tight-cell-padding token; there is no automatic density threshold or product
density switch. Filtering, Clear filters, paging, detail and reload retain that
fixture choice.

### Requirement and state map

Every named state below is directly reachable through `?state=` and registered
in `manifest.js`. The dedicated browser check is
`docs/design/checks/design014.cjs`; its results and the visual correction are
recorded below.

| Requirement | State or walk |
|---|---|
| A1: newest-first table and required columns | `default`; eight columns described above. |
| A2 and C1: full refund | `entry-refund`: Table 8 / T8-0610, actor Rina Putri, approver M. Iqbal, reason, Charged 184.800, Refunded 184.800, Net 0. Original order total explicitly remains 184.800. Occurred Wed 7 Oct at 00:20, in the business day opened Tue 6 Oct. |
| A2 and C1: whole-order void | `entry-void`: T7-0610, total before void and void value both 132.000, actor, approver and reason. |
| A2: self-approval | `entry-self`: T12-0610, M. Iqbal in both roles, total/value 88.000. |
| A2 and C1: fired-line void | `entry-line`: Table 4 / T4-0610, Burger, round 2, line snapshot 50.000, total before 155.925, after 108.675, reduction 47.250, actor, approver and reason. |
| A2 and C1: discount apply/replace/remove | `entry-apply`, `entry-replace`, `entry-remove`: one T10-0610 transition per entry, both discount snapshots and monetary before/after values. These free-form transitions name actor and approver. |
| A2: ungated preset | `entry-preset`: Q17-0610, Sari Wulandari, no approver, Neighbour discount preset snapshot, 100.000 to 95.000. |
| A2, A3 and D: failed approval | `entry-failed`: attempted fired-line void, T2-0610, actor, no approver and no amounts. |
| A2, A3 and D: cancelled approval | `entry-cancelled`: attempted whole-order void, T5-0610; the prompt was abandoned, actor named, no approver or amounts. |
| A2, A3 and D: approved then refused | `entry-refused-refund`, `entry-refused-void`: T3-0510 and T6-0610 respectively; actor and approver, REFUSED, illustrative BUSINESS_DAY_CLOSED and ORDER_NOT_OPEN refusal codes respectively, no amounts. The refund’s day closes after approval; another client settles the void’s order after approval. The void follows the owner's ruling, not unapproved PRD wording. |
| A2, A3 and D: approval request during cooldown | `entry-cooldown`: attempted refund, T9-0610, actor only, plain-language outcome with no stored-outcome code or amounts. It describes the identified request, not a cooldown-start security event. |
| A2 and C1: takeover | `entry-takeover`: Q18-0610, M. Iqbal, checkout lease subject, no approver or amounts. |
| A2 and C1: both reprint classes | `entry-kitchen`: Table 1, round 2, original work at 19:58; `entry-cancellation`: Table 4, round 2, cancelled at 20:02. Both name M. Iqbal, order and ticket class, without approver or amounts. Audit success does not assert physical print delivery. |
| A2 and B-13: deactivated actor and long content | `entry-long`: Ratna Ayu Kartikasari Prameswari, marked Deactivated, CATER-0610, 999.999.999 before void and void value. |
| B1: combined filters | Change business day, action, outcome and actor/approver independently and together; Clear filters restores all 48 fixture entries. |
| B2 and D: overflow | `overflow`; scroll `.bocontent` to the sticky table header, then Older/Newer across real pages. Filtering Discount apply still leaves multiple pages. |
| B3 and D: two empty states | `empty` disables filters because no entries exist; `nomatch` retains filters and offers Clear filters. |
| C2/C3: keyboard and preservation | Open with Enter; Tab/Shift+Tab remain in the shared dialog; Close/Escape return to the same Open button, filters and page. The paged older-entry walk also reloads before closing. |
| D: loading/error | `loading` withholds rows and counts; `error` offers Try again, visibly traverses loading and returns the list. Permission denied is n/a and is not invented. |
| E1: navigation | Shared Audit destination plus the authored links in menu/report detail now reach Frost BO-12. |
| E2: gallery | Frost-only registration and all 24 current states; gallery scope copy names the audit viewer. |
| E3: inventory/wireframe | Only the exact audited-actions insertion, REFUSED/cooldown bullet, and wireframe annotation replacement requested in Part E. |

### Fixture arithmetic and source boundaries

There are 40 entries for the business day opened 6 October and eight for 5
October. Eighteen distinct core entries cover the required subjects and outcomes;
30 older preset applications supply distinct order references and times for paging.
All values are integer rupiah. Older preset applications reduce their respective
100.000 + n × 10.000 subtotal by 5%, without tax/service arithmetic changes.

The fired-line fixture starts from 165.000 in tax-inclusive lines. A 10% discount
leaves 148.500, and 5% service adds 7.425, giving 155.925. Removing a 50.000 line
leaves 115.000 in lines, less 11.500 discount plus 5.175 service: 108.675. Thus the
line snapshot is 50.000 while the total reduction is 47.250. Its 20:02 Table 4,
round 2 subject aligns with DESIGN-013's cancellation. That reprint at 20:06 and
Table 1's work-ticket reprint at 20:04 describe separate orders.

The discount transition fixture has 200.000 in lines with no service charge:
10% free-form discount gives 180.000; replacement with a fixed 25.000 discount
gives 175.000; removing that discount restores 200.000. Each transition has one
combined entry, not a separate approval entry. The refund is a separate closed
order with charged total 184.800; the full reversal leaves net charged zero
without rewriting that order's original total.

The three lead amount rulings remain the owner's to overturn: whole-order void
shows pre-void total and equal void value; fired-line void shows the line snapshot
and both order totals; discount changes show monetary before/after and both
discount snapshots. The refund display separately follows the delegated Q8 ruling.
The schema was read for meaning only; the fixture does not propose API fields,
storage extensions, cooldown outcome names or a complete refusal-code vocabulary.

### Changed files and exclusions

`audit.html`, `audit.css` and `audit.js` contain the new surface, token-only local
layout and fixture behavior. `office.js` changes only the destination resolver's
Frost list to include `audit`. `menu.html` and `report-detail.html` each change only
their authored Audit destination. `manifest.js` and gallery `index.html` register
the surface. `design014.cjs` is the reproducible browser check. The two inventory
edits and single prototype annotation edit are constrained as described above.
This Handoff is the only task-file change.

No token was added or changed. `office.css`, `docs/DESIGN.md`, SITEMAP, application
code, packages, migrations and the four product documents remain unchanged.
No slice-A or slice-C assertion has been removed or weakened; neither existing
check currently requires an expectation change.

### Open questions and proposed wording

The task's already-open PRD follow-ups remain owed. Proposed FR-J3 replacement
for the approved-refund sentence: “A refund or void that is approved and then
refused by the server creates one entry naming actor and approver, with outcome
`REFUSED` and the refusal code, and no before/after amounts. A refund may be
refused because its business day closed after approval; a void may be refused
because another client settled the order after approval.” Proposed addition after its
failed/cancelled sentence: “An abandoned approval prompt is a cancelled approval.”
These are proposals for the owner; the artifact follows the existing rulings.

The current FR-H3 and AC-10 still say an unfired-order cancellation is audited,
contrary to the task's owner ruling of 2026-10-06. No such entry is drawn.
Proposed FR-H3 replacement: “Voiding an order with no `FIRED` lines requires no
approval and writes no audit entry.” Proposed AC-10 replacement: “Voiding an
order with nothing fired succeeds with no prompt and writes no audit entry;
voiding an order holding a fired line raises the manager prompt.” The lead
should reconcile these contract sentences with the recorded ruling.

A post-close correction would appear as a new adjustment entry in the currently
open business day, referencing the original closed-day subject. It is not drawn
because no authorized creating screen or FR-J3 action exists yet. Proposed next
step: the owner approves its audit classification and subject/amount semantics
before adding a filter option or fixture. The cooldown refusal's stored name and
the full refusal-code set remain intentionally undecided and outside this slice.

### Verification

The owner approved the initial DESIGN-014 browser execution in this pane:

```sh
env PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design014.cjs
```

It passed 214/214 assertions across 23 states at 1440×900, with zero page
JavaScript errors and zero horizontal document, content or dialog overflow.
Evidence is outside the repository at `/tmp/design014-evidence/`, including
state captures, `overflow-scrolled.png`, `long-row.png` and `measurements.json`.
The check covers each subject's own values, absence of unsuccessful amounts,
filter intersections, distinct pages, keyboard focus containment/return,
reload preservation, both empties, retry and gallery/navigation destinations.

I inspected the default, refund, cooldown-refused, scrolled-overflow and long-row
captures. This exposed one visual defect despite the assertions passing:
“Succeeded” broke inside the word on page 2. The outcome label now overrides the
cell's permissive word wrapping, and the check asserts that the short success
label occupies one line in every state. The separately approved confirmation
passed 237/237 assertions across the same 23 states. Its long-row capture was
inspected and confirms the correction. Evidence is in
`/tmp/design014-evidence/confirmation/`; there were again zero script errors and
zero horizontal document, content or dialog overflow. No further UI change or
browser iteration was needed.

| Browser measurement, unchanged in confirmation | Observed value |
|---|---|
| Frame | 1440×900 |
| Navigation / brand / top bar | 220px / 64px / 64px |
| Content padding / body type | 24px / 14px |
| Filter height / row Open height | 40px / 28px |
| Sticky header after content scrollTop=450 | y=64, height 40.9375px |
| Long-row and amount overflow | Zero; 999.999.999 remains complete |

`git diff --check` passed. The required authored prototype-link counts are 38
for menu and 9 for report detail. The inspected inventory/wireframe diff contains
only the requested two inventory edits and one annotation replacement; SITEMAP,
DESIGN, tokens and the existing DESIGN-012/013 check scripts have empty diffs.

The automatic Impeccable hook's `cramped-padding` finding was triaged as a shared
pattern exception. The dialog intentionally has zero wrapper padding while its
header/footer have 16px × 20px token padding and its body has 20px token padding;
table cells and fixed-height fields/actions consume their existing desktop tokens.
The inspected captures support preserving those insets. Following the hook's
explicit instruction, a single-rule, single-file ignore was persisted through
`impeccable hooks ignore-value` for `audit.html`. It lives in the repository's
ignored `.impeccable/config.json`, is disclosed here, and is not force-added to
the path-scoped design commit. No shared CSS was altered to silence the detector.

The owner separately approved each of these three executions before it ran:

```sh
env DESIGN014_OUTPUT=/tmp/design014-evidence/confirmation PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design014.cjs
env PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design012.cjs
env DESIGN013_OUTPUT=/tmp/design014-evidence/design013-regression PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design013.cjs
```

The unchanged DESIGN-012 regression passed 216/216 assertions across 47 states,
with zero page JavaScript errors or failed assertions. Its fixed output directory
is `/tmp/design012-evidence/round2/`; the completed evidence was copied to
`/tmp/design014-evidence/design012-regression/`. The unchanged DESIGN-013
regression passed 371/371 assertions across 41 states, also with zero JavaScript
errors or failed assertions. Its evidence is in the explicitly supplied external
directory above. Shared measurements remain 220px navigation, 64px top bar,
24px content padding, 14px body, 40px fields, 640px dialog, and 36px/28px
emergency/receipt actions. The incident banner retains x=220, y=64, width=1220,
height=80 before and after scrolling; its sticky table header remains at y=144.

The lead authorized repository verification, syntax checks, the final diff check
and the path-scoped commit; the owner approved the sandbox prompts in this pane.
The first `npm run verify` stopped before typechecking because this fresh worktree
had no installed dependencies and `tsc` was unavailable. An approved `npm ci`
installed the existing lockfile without changing it. The approved verification
rerun passed typechecking and all 50 test files / 2,876 tests, including the
unchanged token tests and existing database tests. The existing Vite warning
about its future native config loader remains. Installation also reported one
high-severity dependency advisory; dependency remediation was not attempted in
this design task, and no separate dependency audit was run.

JavaScript syntax checks passed for `audit.js`, `office.js`, `manifest.js` and
`design014.cjs`; the final `git diff --check` passed. No token was introduced,
no test was weakened, and no product or application file changed. Screen-reader,
other-browser, physical-device, live-service and real-printer tests were not run;
this is design-fixture evidence only.

All assigned work is complete for design review. The commit is scoped to this
Handoff and the listed design files on `agent/design-014`; nothing is pushed.

DONE

### Round 2 — review fixes

The five accepted findings are addressed under the lead's 2026-10-07 rulings.
This round changes `audit.js`, the state declaration in `audit.html`, the matching
`manifest.js` entry, `design014.cjs` and this Handoff. It changes no token, CSS,
shared-office behavior, incident behavior, contract or inventory. Round 1's
verification results remain historical evidence; its current fixture descriptions
above are corrected where this round made them untrue.

| Finding | Change | Observed browser evidence |
|---|---|---|
| F1: impossible refused-void state and copied summary | T6-0610 belongs to the open day and is refused after another client settles it, with illustrative ORDER_NOT_OPEN. T3-0510's refund is refused just after its business day closes between approval and commit. Each record supplies its own refusal explanation to both list and detail. Both codes are visibly labelled illustrative. The void has no separate closed-order business-day fact. | The check requires the distinct codes and explanations in each detail and list row, rejects BUSINESS_DAY_CLOSED and the old T6-0510 identity from the void, and continues to require no amounts for either refusal. |
| F2: occurrence date conflated with business day | Every record has an occurrence date independent of its business day. The list and Occurred fact use it; filtering still uses the business day. Records sort by occurrence date and HH:MM. The successful T8-0610 refund occurs at 00:20 on Wed 7 Oct while still belonging to the day opened Tue 6 Oct. | The check reads both dates in refund detail, requires Wed 7 Oct in its first-row Time cell and verifies chronological ordering across all 48 entries and all pages. The existing business-day filter checks remain. |
| F3: hard-coded fired-line summary amounts | The summary selects the line snapshot and total reduction from the entry's own amount pairs. Added `entry-line-second`, registered as the 24th state: T11-0610, Iced tea, round 1, with different values. One generated preset row was replaced, retaining 48 total entries and 40/8 per business day. | The check filters to both successful line voids and compares each list summary with its own expected amounts while rejecting its neighbor's values. Both detail states are also exercised. |
| F4: refund shares another order's amount | T8-0610 now has Charged 184.800, Refunded 184.800 and Net 0; its immutable original total remains 184.800. | Refund detail must not contain the first line void's 155.925 or other distinguishing values. Each line detail must reject the refund amount and the other line's distinguishing values. |
| F5: incomplete secret/control checks and density ambiguity | Secret and telemetry checks now read the whole body while the detail dialog is open. An explicit allowlist validates every button, link, select, input, textarea, summary and explicitly interactive role, including shared navigation and separately identified authoring links. Clear filters retains the selected fixture density. | The checks run in all registered states and with both global alerts over an open detail. Separate standard/overflow walks filter, clear and reload, requiring unchanged 15px × 12px or 9px × 12px cell padding respectively. |

**Refusal timeline.** The day opened Mon 5 Oct is still open when the manager
approves T3-0510's refund at 00:04 on Tue 6 Oct. The end-of-day close commits at
00:05, with all orders already closed or voided, and opens the day named Tue 6
Oct. At 00:06 the pending refund reaches its commit check and is refused. Its
audit entry therefore occurs in the new open day and refers to the now-closed
order day. These times explain this fixture only; they introduce no fixed close
schedule or business-day boundary rule and are not drawn as filter boundaries.
The separate void attempt occurs at 22:14 on Tue 6 Oct: another client settles
T6-0610 after approval, so it is no longer open when the void reaches commit.
Neither scenario depends on an open order surviving an end-of-day close.

**Second line arithmetic.** T11-0610 has 80.000 in tax-inclusive lines, less a
10% discount (8.000), plus 5% service on 72.000 (3.600), giving 75.600. Removing
the 20.000 Iced tea leaves 60.000 in lines, less 6.000 discount plus 2.700 service,
giving 56.700. The total reduction is 18.900, distinct from the 20.000 line
snapshot and from Table 4's 50.000 / 47.250 pair. The added state has the same
actor, approver, reason and read-only detail treatment as the existing line void.

**Density rule for the builder.** Use the standard shared table density for
BO-12, including long logs. Tight density is a deliberately selected overflow
review fixture, not a production response to count, filtering or scrolling.
No density selector is added. The fixture's choice survives Clear filters and
reload, so one interaction never silently changes row padding.

**Verification.** The owner approved each of the following runs in this pane
before execution:

```sh
env DESIGN014_OUTPUT=/tmp/design014-evidence/round2 PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design014.cjs
env PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design012.cjs
env DESIGN013_OUTPUT=/tmp/design014-evidence/round2/design013-regression PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design013.cjs
```

DESIGN-014 passed **288/288 assertions across 24 states**. The unchanged
DESIGN-012 regression passed **216/216 across 47 states**; its completed fixed-path
output was copied to `/tmp/design014-evidence/round2/design012-regression/`.
The unchanged DESIGN-013 regression passed **371/371 across 41 states**.
All three completed with zero page JavaScript errors and no failed assertions.
The audit check found zero horizontal document, content or dialog overflow in
all 24 states. The commands above identify the external screenshots and
`measurements.json` directories; no evidence artifact is committed.

I visually inspected the successful after-midnight refund, both refused-entry
details, the filtered two-line-void list and the filtered two-refusal list.
Occurrence and business-day dates differ visibly on the successful refund;
the two refusal summaries and codes describe their own subjects; and the line
summaries show 50.000 / 47.250 and 20.000 / 18.900 respectively. The whole-document
secret scan and explicit control allowlist passed while each detail was open,
including the extra composition with both shared global alerts. No follow-up
browser run or visual correction was needed.

At 1440×900, the frame remains 220px navigation, 64px brand/top bar, 24px content
padding and 14px body text. Filters remain 40px high and Open buttons 28px.
After `.bocontent.scrollTop=450`, the audit header is at y=64 and is 40.9375px
high, with no row visible above it. The default-density clear/reload walk retained
15px × 12px cell padding; the overflow walk retained 9px × 12px. The incident
regression's 80px banner remained fixed at x=220, y=64, width=1220, and its table
header remained at y=144. No shared geometry changed.

`git diff --check` passed. `npm run verify` was intentionally not rerun under the
lead's explicit round-2 rule because no token changed; Round 1's 2,876-test result
is historical, not claimed as a new run. Screen-reader, other-browser,
physical-device, live-service and real-printer testing remain unperformed.
No new owner question arose; the already recorded contract wording proposals
and deferred adjustment/cooldown-code questions remain with their owners.

All five findings are complete for re-review. This round's path-scoped commit
contains only the five files named above on `agent/design-014`; nothing is pushed.

DONE
