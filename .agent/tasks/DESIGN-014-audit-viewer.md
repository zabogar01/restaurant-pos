---
id: DESIGN-014
title: BO-12 audit viewer in Frost, read-only, with every audited action and outcome, working filters, paging and subject-correct detail
category: ui
touches: [audit, identity]
depends_on: [DESIGN-012, DESIGN-013]
owns: [docs/design/**]
status: running
cycles: 0
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

## Handoff

*(The designer writes this section.)*
