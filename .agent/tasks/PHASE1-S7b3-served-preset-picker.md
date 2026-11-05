---
id: PHASE1-S7b3
title: The POS preset picker reads the real active presets (plan S7, consult C4, OQ1)
category: ui
touches: [money, boundaries]
depends_on: [PHASE1-S7b2]
base: agent/phase1-s7b2
owns: [apps/pos/src/DiscountSheets.tsx, apps/pos/src/discountFixtures.ts, apps/pos/src/discount.ts, apps/pos/src/discountChange.ts, apps/pos/src/orderFixtures.ts, apps/pos/src/orderStore.ts, apps/pos/src/OrderPanel.tsx, apps/pos/src/menuFixtures.ts, apps/pos/src/session/source.ts, apps/pos/src/catalog/**, apps/pos/src/pos.css, apps/pos/test/**, e2e/tests/pos-catalog.spec.ts, e2e/support/**]
status: not-started
cycles: 0
---
# PHASE1-S7b3 — The POS preset picker reads the real active presets

**Written** 2026-11-05 by the lead. Sources:
- slice S7 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S7*);
- **consult C4** (`.agent/reviews/ARCH-021-pos-catalog.md`): decision 9 (*The POS preset picker*), decision 10, *For
  DESIGN-021* section 7, and *For the lead*, *S7b3*, copied below where they bind;
- **the owner's ruling on C4 OQ1** (DECISIONS 2026-11-02): in Phase 1 the served POS discount picker shows the real
  active presets from the catalog projection, applied into the client discount stand-in; the stand-in's gates are
  unchanged, nothing is stored, and the stand-in goes when Phase 2's discount command arrives;
- **DESIGN-021** (`.agent/tasks/DESIGN-021-pos-catalog-states.md`): its Handoff rule 12, its copy table's M-3 and preset
  rows, its focus rules, and the reviewed served picker states in `docs/design/visual-directions/frost/pos/order.html`
  (`?state=served-presets`, `served-presets-empty`, `served-presets-many`, `served-presets-removed`,
  `served-presets-loading`, `served-presets-error`, `served-presets-error-internal`, `served-presets-changed`), whose
  behaviour is in `docs/design/visual-directions/frost-served-catalog.js` (`openPresets`);
- **PHASE1-S7b1 and PHASE1-S7b2** (their Handoffs): the catalog store, `useCatalog`, the source switch, the fixture-only
  module and its bundle needles, `served-harness.tsx`; S7b2's *What S7b3 needs*;
- PRD FR-F1 to FR-F8, FR-M3, FR-M5; B-1, B-8, B-20, B-21, B-22, B-24; ADR-011 rules 23, 24 and 27; ADR-012 rule 12.

Where this file and C4 or DESIGN-021 differ, this file wins. Where this file and an accepted ADR differ, or the code
cannot do what this file says, stop and write `BLOCKED: <question>`.

This branch is cut from S7b2's, `agent/phase1-s7b2` (frontmatter `base:`), so its diff against `development` includes
S7b1's and S7b2's commits until those merge. Review and report against `agent/phase1-s7b2`.

## Objective

In a served build, the discount picker (M-3) lists the active presets the catalog projection carries, in the server's
order, and applying one puts its snapshot on the client stand-in order exactly as a fixture preset does today. The
picker follows the live list between polls. It draws DESIGN-021's loading, failed and no-presets states, with *Other
amount* always offered. The fixture preset list leaves served bundles (B-24). FR-F8's gates, the manager prompt and the
free-form path do not change. Nothing is written to the server.

## Decided: do not reopen

- **Owner:** OQ1 yes (above); Q13 (no Phase 1 POS command carries the catalog version); Q14.
- **The store** (S7b1): `useCatalog(view)` gives `{ store, snapshot, … }`; `snapshot.menu` is one immutable object
  replaced whole and carries `presets: CatalogPreset[]` (`catalog/types.ts`), `{ id, name, value: { kind: 'PERCENTAGE',
  rate: Rate } | { kind: 'FIXED', amount: Money } }`, already decoded, active only, in the server's order. The fixture
  store's menu has `presets: []` today.
- **S7b2's Handoff, *What S7b3 needs*:** the picker's entry is `discountOpened` / `panelDiscount` in `OrderPanel.tsx`
  and `DiscountSheet`; `changeDiscount` in `orderStore.ts` still passes the fixture `PRESETS` (`orderStore.ts:572`),
  which this task replaces.
- **No line, order or discount carries the catalog version**, and no parameter is added for it (C4 item 10, Q13).

## C4's decisions, copied

### The POS preset picker (C4 item 9, *If yes*)

The projection carries `presets`. `orderStore.ts`'s `PRESETS` input comes from the catalog store at the press.
`ratePpm` is converted to the `percent` string `discount.ts` holds by a pure, exact function, tested by the round trip
`rateFromPercent(percentFromPpm(p)) === p`, with no float. `Preset.active` is true for everything served. The stand-in's
rules are unchanged: FR-F8's gates, no audit, and the fixed amount capped by `discountAmount` when applied. Fixture
orders' `STAFF_MEAL` and `COMP` become literal snapshots in the order fixtures, since those are order stand-ins, not a
pick-list, and `PRESETS` joins the fixture-only module.

### The discount picker's served states (C4 *For DESIGN-021* 7)

- **What it shows:** active presets only, in the server's order (oldest created first, as BO-07). A zero-valued preset
  is shown. Nothing is approval-gated (FR-F2). The free-form path and FR-F8's gates do not change.
- **Loading** and **first read failed:** the presets are read with the menu, so these are the same two facts as the
  menu's. *Other amount* stays offered in both.
- **No active presets:** *Other amount* stays.
- **Values:** a percent can carry four decimal places. Show it with a decimal comma and no trailing zeros, as BO-07
  does (owner, DESIGN-018 Q6). The fixture `10%` form is the whole-number case. A fixed amount larger than the
  subtotal is listed as stored and capped when applied (FR-M5), with the capped figure on the totals.
- **Between polls:** the open picker follows the live list. A deactivated preset's row goes and an edited preset's row
  updates, with no notice and no in-place rule, because applying the wrong preset is replaced without approval. An
  applied preset is a snapshot on the order and is unaffected (FR-F4, FR-F5).

## DESIGN-021's rules that bind this slice

Its Handoff rule 12, its copy table's M-3 and preset rows, and its focus rules for M-3, **copied exactly** (ADR-011
rule 24). In short:

- **Rule 12.** Active presets keep the server's oldest-created-first order, including zero values. Percentages use a
  decimal comma without trailing zeros: 12,3456%, 100%, 0%. Fixed amounts show their stored value, including 0 and
  99.999.999. A value above the subtotal is still listed as stored; application caps it in the totals. No ranking,
  suggestion, scheduling or new approval appears. Loading, failure and no active presets keep *Other amount*. The
  picker shares the menu's first-read outcome and both of its failure copies; it never invents a held preset list when
  the catalog read has not succeeded. Changed entries update and removed entries leave silently. An already applied
  preset stays the order's snapshot.
- **Copy** (the table, exactly):

  | State | Element | Exact text | Accessible name / test target |
  |---|---|---|---|
  | M-3 | Title / note | Discount / One per order | Dialog labelled by `flow-title` |
  | M-3 | Group | Presets — no approval needed | `preset-heading` |
  | Preset read | Loading label | LOADING PRESETS | Status, same |
  | Preset unavailable read | Title / body / action | The system is unavailable / Wait a moment, then try again. / Try again | Alert; action `preset-retry` |
  | Preset unexpected read failure | Title / body / action | Something went wrong / Try again. If the problem continues, ask a manager for help. / Try again | Alert; action `preset-retry`; same classification and words as the menu |
  | No active presets | Body | No active presets. A manager can add or activate a preset in the back office. | Same |
  | Percent preset | Entry | {preset name} — {percentage}% | Same; visible name and value occupy separate columns |
  | Fixed preset | Entry | {preset name} — {amount} off | Same |
  | M-3 secondary path | Label / action | Anything else / Other amount — needs a manager | Same |
  | M-3 footer | Action | Cancel | Same; `served-preset-cancel` |

  Test targets follow the codebase's convention for served targets (`data-action="served-retry"`, S7b2's
  `served-show-blocked`); the copy and the accessible names are exact.
- **Focus.** M-3 opens on its heading, keeps the readable order inert, and contains Tab and Shift-Tab, even when the
  read failed; its *Try again* does not take opening focus. A failure moves focus to *Try again* only if focus is on the
  body or on a control that read removed. A successful picker retry replaces its removed retry control with focus on
  *Presets — no approval needed*. A poll changing a preset's value or name keeps focus where it was. **A removed
  focused preset sends focus to *Presets — no approval needed*.** Escape and Cancel return to the opener.

## The lead's rulings for this slice

These fill gaps C4 and DESIGN-021 leave; the owner may overturn them.

1. **Where the presets come from, in both modes.** The picker and the store read presets from the catalog store, in
   fixture mode as in a served build, through one pure adapter from `CatalogPreset` to `discount.ts`'s `Preset`
   (`active: true`; `PERCENTAGE` → `{ kind: 'percent', percent: percentFromPpm(rate) }`; `FIXED` → `{ kind: 'fixed',
   amount }`). The fixture store's menu carries the four fixture presets, so the fixture picker keeps its list through
   the same code. **`PRESETS` moves into the fixture-only side** that S7b1 keeps out of built bundles (beside the
   fixture menu, behind the same constant), and `DiscountSheetFixture` stops carrying `presets`. `discountFixtures.ts`,
   which built bundles still hold, then names no fixture preset list.
2. **The picker reads the live list at every render; the store reads it at the press**, from the catalog store's
   current snapshot, the way `addLine` reads availability (`unavailableAt`). A preset deactivated between the render
   and the press is refused by the store as `unknown-preset`; the sheet stays, nothing is applied, and no sentence is
   added (DESIGN-021 dropped *Nothing was applied* under C4).
3. **The served picker is DESIGN-021's M-3; the fixture picker keeps its reviewed layout.** In a served build the
   picker draws the served states above (two-column entries, *Anything else*, the footer's Cancel). The fixture
   pictures (`?state=sheet-discount`, `sheet-freeform`, `sheet-remove`, `sheet-remove-freeform`) and every fixture
   discount test keep what they assert today, as S7b2 kept the fixture item sheets.
4. **FR-F8's gate in the served picker.** Over an applied free-form discount the presets need a manager, and the served
   picker's group label is the fixture picker's reviewed gated label (`PRESETS_GATED`), with the same manager prompt.
   DESIGN-021 draws no served picture of this; nothing else about the gate changes.
5. **The decimal comma everywhere a percent is shown.** `valueText` renders every percent with a decimal comma and no
   trailing zeros (12,3456%, 100%, 0%); the stored `percent` string stays the canonical form `rateFromPercent` parses
   (`12.3456`). Every reviewed fixture percent is a whole number, so no reviewed picture changes. A free-form percent
   with a fraction now reads with a comma, consistent with IDR's grouping; no fixture draws one.
6. **Out of date.** The picker draws nothing of its own for *Possibly out of date*: the list it holds stays, and POS-03's
   band already says it (as C4's sheet table rules for M-2).

## Acceptance criteria, each with its red proof

Write each test first, run it against the unchanged code, and record the failing assertion; then the code. Each *Red*
is a mutation you apply, observe failing for the stated reason, revert, and report. C4's numbers are in brackets.

1. **[1]** Served: the picker lists only the projection's presets, in its order, a zero-valued percent and a zero fixed
   amount included; no fixture preset appears; and the fixture preset list's marker (a new `FIXTURE_PRESETS_MARKER`, a
   needle in `built-session-support.ts`) and the fixture-only names *Regular customer* and *Service recovery* are
   absent from both built bundles (`NODE_ENV=production` and `development`). *Red:* keep `PRESETS` in the store's or the
   picker's served path.
2. **[2]** `percentFromPpm` is exact: `rateFromPercent(percentFromPpm(p)) === p` for 0, 1, 10000, 123456 and 1000000,
   and the strings are `0`, `0.0001`, `1`, `12.3456`, `100`. *Red:* divide with a float: 123456 fails.
3. **Rule 5's display:** a preset of 123456 ppm reads *12,3456%* in the picker entry, its accessible name, the change
   sheet and the totals label once applied; 1000000 reads *100%*; 0 reads *0%*; a fixed 99.999.999 reads *99.999.999
   off*. *Red:* print the canonical string.
4. **[3]** A preset applied keeps its snapshot (name and value on the order and the totals) when it is later edited or
   deactivated (FR-F4, FR-F5). *Red:* read the preset at render.
5. **Applying a served preset:** pressing an entry applies it with no approval over an order with no discount, the
   totals show the discount, and a fixed amount above the subtotal is capped in the totals while the entry still shows
   the stored value (FR-M5). *Red:* cap the entry's figure.
6. **Ruling 2:** a preset deactivated after the picker rendered and before the press is refused by the store
   (`unknown-preset`), the order is the same object (B-20), and the sheet stays. Driven at the hook, with a stub store
   changing the list between render and press. *Red:* read the list captured at render.
7. **[4]** Loading, both first-read failures (each with its own copy) and no active presets, each with *Other amount —
   needs a manager* live and leading to the free-form sheet; *Try again* (`preset-retry`) calls the catalog store's
   `retry`, and a successful retry draws the list. FR-F8's table is unchanged: every existing `needsManager` and gated
   test passes untouched. *Red:* hide *Other amount* while loading.
8. **Between polls:** with the picker open, an edited preset's row updates in place with no notice, a deactivated
   preset's row leaves with no notice, a new preset appears in the server's order, and the last one leaving draws the
   no-presets state. *Red:* snapshot the list when the picker opens.
9. **Focus:** M-3 opens on its heading in the ready, loading and failed states (never on *Try again*); a successful
   retry with focus on *Try again* moves focus to *Presets — no approval needed*; a deactivated preset that had focus
   sends focus there; an edited one keeps focus; Tab and Shift-Tab stay inside; Escape and Cancel return focus to the
   opener. *Red:* leave focus on the removed row's position.
10. **Ruling 4:** over an applied free-form discount, the served picker's label is the gated one and a preset asks for
    the manager prompt; over a preset or no discount it does not. *Red:* skip the gate in the served picker.
11. **Ruling 3, both paths pinned:** the four fixture discount pictures and every fixture discount test assert what they
    assert today; the served picker has `served-preset-cancel` and *Anything else*, the fixture picker does not. *Red:*
    render the served picker on the fixture path.
12. **[5] In the browser, both engines** (`e2e/tests/pos-catalog.spec.ts`): with the POS open on an order and the picker
    open, a preset created through BO-07's controls (as `e2e/tests/presets.spec.ts` drives them) appears in the picker
    after `runFor(2000)`, and one deactivated through BO-07 leaves after `runFor(2000)`; applying a served preset shows
    it on the totals. If the harness cannot drive BO-07 beside the POS, write `BLOCKED` rather than set it up through
    domain functions. *Red:* snapshot the list when the picker opens (AC 8's mutation): the new preset does not appear.
    (C4's red for this criterion, omitting presets from the catalog version's advance, is a server mutation; the server
    is out of scope, and S6a already proves that advance.)
13. `npm run verify` green, with counts. The lead runs `npm run test:e2e:all` before review and before merge; run it
    too and report it.

## Tests expected to change

- `discount.test.tsx`, `discount-apply.test.tsx`, `discount-change.test.ts` (C4): presets now reach the picker and
  the store from the catalog store; the fixture picker's assertions stay.
- `built-session-support.ts`: the new needles (additions only).
- `served-harness.tsx`: served presets (additions only).
- Mechanical only, if they import `PRESETS`, `STAFF_MEAL` or `COMP` from where they move, or build a
  `DiscountSheetFixture` with `presets`: `order-store.test.tsx`, `own-items.test.tsx`, `void-apply.test.tsx`,
  `refund-screen.test.tsx`, `sheets.test.tsx`. An import move is not a change of meaning; say so for each.
- `e2e/tests/pos-catalog.spec.ts` (the new case). `e2e/tests/presets.spec.ts` is not changed; reuse its way of driving
  BO-07 through `e2e/support/**` if a helper must move there.
- **Nothing else should change.** A change anywhere else is reported with its reason; a weakened assertion is not
  acceptable. `discountChange.ts` is in `owns` only in case a type must move: change its behaviour and stop.

## Rules

- Touch only the paths in `owns`. If the code needs another file, stop and write `BLOCKED: <question>`.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: S7b2's
  first round stopped for over an hour on an approval prompt for a heredoc.
- The fixture path keeps working through the source switch; nothing in a served build imports the fixture menu or the
  fixture preset list (S7b1's needles and the new ones stay green).
- Money is `Money` (bigint) and a rate is `Rate` end to end; no `Number()`, `parseFloat` or float division on an amount
  or a rate (B-1).
- No ranking, sorting, suggestion or preselection of a preset (FR-F7, B-21); one discount per order (B-22).
- Buttons and openers turn off with `aria-disabled`, never native `disabled`.
- Format by hand, matching each file; there is no formatter config.

## Baseline

`agent/phase1-s7b2` at `988baa8`, as reviewed: `npm run verify` 157 files, 5696 tests; `npm run test:e2e:all` 130
passed. Confirm the baseline before you start and state the new counts in the Handoff.

## Out of scope

- Any server change. Phase 2's discount command, its audit and its approval, and `CATALOG_CHANGED` at the POS.
- The free-form sheet, the change sheet and the manager prompt, beyond reading presets from the new source.
- Redrawing any fixture picture; a served picture of the gated picker (ruling 4 uses the reviewed label).

## Commit and report

Commit on `agent/phase1-s7b3` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose: what was done; what was decided and on what evidence; tests changed and why; each red
proof; what was found and not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff

