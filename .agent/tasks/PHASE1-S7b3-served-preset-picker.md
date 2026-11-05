---
id: PHASE1-S7b3
title: The POS preset picker reads the real active presets (plan S7, consult C4, OQ1)
category: ui
touches: [money, boundaries]
depends_on: [PHASE1-S7b2]
base: agent/phase1-s7b2
owns: [apps/pos/src/DiscountSheets.tsx, apps/pos/src/discountFixtures.ts, apps/pos/src/discount.ts, apps/pos/src/discountChange.ts, apps/pos/src/orderFixtures.ts, apps/pos/src/orderStore.ts, apps/pos/src/OrderPanel.tsx, apps/pos/src/menuFixtures.ts, apps/pos/src/session/source.ts, apps/pos/src/catalog/**, apps/pos/src/pos.css, apps/pos/test/**, e2e/tests/pos-catalog.spec.ts, e2e/support/**]
status: complete
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

## Round 2: the lead's rulings on the review, 2026-11-05

The review is `.agent/reviews/PHASE1-S7b3-review.md` (Codex, three findings). Read it whole; its *Cleared* section
settles the lead's five questions. Fix exactly these, each test first with its red proof recorded, and nothing else.

- **R1 (F1, P1, accepted).** A manager approval covers the transition it displays (B-14, FR-F8), so a preset that
  changes under an open prompt must never be applied with its new facts. Two parts, both required:
  - **At submission, the store is the control.** A preset change carries the snapshot the screen displayed (name and
    value, as `snapshotOf` gives them), and `changeDiscount` refuses it as `unknown-preset` unless the preset resolved
    from the current list at the press gives exactly that snapshot. The order is the same object (B-20). Reuse
    `unknown-preset`; add no refusal code. This applies to a direct press too, where it is trivially met.
  - **While the prompt is open,** if its preset leaves the live list or its snapshot changes, the prompt closes as a
    refused submission closes today (`settle`'s refusal path): the sheet stays, nothing is applied, and **no sentence is
    added** (DESIGN-021 adds none for a preset edit or removal; ADR-011 rule 24). The cashier picks again, and a gated
    pick asks for a fresh approval.
  - Tests, at the screen through ordinary controls (the review's scenario): over an applied free-form discount, pick a
    served preset, change its value by a poll while the prompt is open, and assert the prompt has closed and the order
    still carries the free-form discount; the same with the preset deactivated; and at the hook, a submission whose
    displayed snapshot no longer matches is refused with the same order. Also press a stale entry at the screen and see
    the refusal there (the review notes the current screen test only polls the entry away). *Red:* resolve by id alone
    at submission.
- **R2 (F2, P2, accepted).** When the prompt closes (cancelled, refused, or closed by R1), focus returns to its opener
  only if the opener is still connected; otherwise it goes to *Presets — no approval needed* (`preset-heading`, whatever
  its gated label), once the sheet is no longer inert. Tests: cancel and refusal after the opener was removed while the
  prompt held focus, and R1's closure; focus is on the heading, never the body. *Red:* focus the detached opener.
- **R3 (F3, P3, accepted).** The served picker's footer is one full-width Cancel, as the artifact draws it
  (`docs/design/visual-directions/frost-served-catalog.css:37-38`): no empty sibling, scoped to the served picker so no
  other sheet's footer changes. Test the structure (one child, the served footer class); the lead measures it in the
  browser run. *Red:* restore the empty sibling.

**How to work.** Create and change files with the Write and Edit tools only. Run `npm run verify` on a quiet machine,
not beside another suite, before you commit, and run `npm run test:e2e:all` and report its count. Append a *Round 2*
section to the Handoff (do not rewrite round 1), ending with `DONE` or `BLOCKED: <one question>`.

## Round 2: lead review, 2026-11-05 (complete)

A lead review instead of a re-review: every round-2 fix is the review's own, as ruled (R1 to R3). Reviewed at `e6b837f`
(code `dd1c1d2`), the tree clean.

- **Diff:** six source and test files, all inside `owns`. R1: a preset pick carries `shown`, the snapshot the sheet
  resolved from the live list; the store refuses an otherwise accepted change as `unknown-preset` unless the list at the
  press gives exactly that snapshot (`sameSnapshot`), closed and locked keeping their place; a layout effect closes the
  prompt by the refusal path when its preset changes or leaves, adding no sentence. `discountChange.ts` changes its type
  only. R2: the closing effect focuses the opener only if it is connected, else `#preset-heading`. R3: one Cancel with
  `grid-column: 1 / -1`, scoped to its class. The one existing assertion changed (`discount.test.tsx`, the change now
  carries `shown: STAFF_MEAL`) follows from R1.
- **`npm run verify`:** exit 0; 158 files, 5743 tests passed. **`npm run test:e2e:all`:** exit 0; 132 passed, both
  engines. Output in `../restaurant-pos-wt/evidence/PHASE1-S7b3/lead/round2/`.
- **The lead's red proof on the new code** (reverted, tree clean after): the store's `stale` check and the prompt's
  closing effect both disabled: 7 tests fail in `served-presets.test.tsx`, the hook refusal, all four R1 screen cases
  and both R2 closure cases.
- **Known, not fixed:** `shown` is optional on `DiscountChange`, so the store's check binds only callers that pass it.
  The one preset caller, `DiscountSheet.change`, always does when the preset resolves, and an unresolved preset is
  refused as `unknown-preset` anyway; Phase 2's discount command replaces this stand-in. The served picker's layout
  (two columns, 40 entries, the 32-code-point name, the full-width Cancel, the gated value column) is unmeasured in a
  real browser; the owner's look covers it.

**Verdict: complete.** `touches: money, boundaries`: the owner looks before merge. Its PR follows #169 and #170.

## Lead verification, 2026-11-05 (before review)

The lead ran these in this worktree at `3708338`; this note is the evidence a reviewer cannot gather.

- **`npm run verify`:** exit 0; typecheck clean; 158 files, 5733 tests passed. **`npm run test:e2e:all`:** exit 0; 132
  passed, both engines, P11 included. Output in `../restaurant-pos-wt/evidence/PHASE1-S7b3/lead/`.
- **Paths:** every changed path is inside `owns`. Test changes are as the Handoff lists them; `discount.test.tsx`'s
  FR-F5 block now reaches its presets through a stub catalog store instead of the removed `DiscountSheetFixture.presets`.
- **Red proofs repeated by the lead** (reverted, tree clean after): `valueText` printing the stored string (AC 3) and
  `ServedPicker`'s `presetsGated` forced to `false` (AC 10), together: 7 tests fail in `served-presets.test.tsx`,
  including both AC 3 tests and the AC 10 free-form test.

**For the reviewer.** Review `agent/phase1-s7b2..HEAD`. Beyond the review's own reading, the lead asks for a view on:

1. **The gated served entry.** Over a free-form discount each served entry's value column and accessible name append
   ` — needs a manager` (`NEEDS_MANAGER`, the fixture picker's reviewed marker) and take the fixture's dashed gated
   style. DESIGN-021 draws no gated served picker; ruling 4 named only the group label. Is reusing the reviewed marker
   within ADR-011 rule 24, and is the visible form right?
2. **`valueText` now throws** on a percent string `rateFromPercent` rejects, where it once printed it. Is any caller
   reachable with a non-canonical or malformed percent (a free-form entry, a fixture snapshot, a refund or receipt
   path)?
3. **Before a first read,** `presetsAt` gives an empty list, so a press is `unknown-preset`. Can the served picker offer
   an entry in that window?
4. **`?state=sheet-discount` in a served build** opens `ServedPicker` (fixture pictures are still honoured there, as
   before this task). Does anything in that path reach a fixture preset or a fixture-only module?
5. **AC 8 and 9 under a poll:** does a deactivated preset holding focus send focus to the heading in every case,
   including the gated label and the last preset leaving?

## Handoff

**Builder: Claude Sonnet 5.5.** One commit on `agent/phase1-s7b3`, `f9c253b` (`feat(pos): the served preset picker reads the catalog's active presets`), 18 files, after `npm run verify` and `npm run test:e2e:all` were green. Nothing was pushed. This Handoff is committed separately.

### What I did

- **The conversion and the display** (`apps/pos/src/discount.ts`). `percentFromPpm(rate)` turns parts per million into the canonical percent string with whole-number bigint arithmetic (`0`, `0.0001`, `1`, `12.3456`, `100`), and `presetOf(CatalogPreset)` is the one pure adapter to `discount.ts`'s `Preset` (`active: true`, `PERCENTAGE` to `{ kind: 'percent', percent: percentFromPpm(rate) }`, `FIXED` to `{ kind: 'fixed', amount }`). `valueText` now renders every percent as `percentFromPpm(rateFromPercent(percent))` with the point replaced by a comma (ruling 5), so a stored `12.50` also reads `12,5%`. The stored `percent` string is unchanged.
- **Where the presets come from** (rulings 1 and 2). `presetsAt(store)` in `apps/pos/src/catalog/useCatalog.tsx` reads `store.getSnapshot().menu?.presets` through `presetOf`. `orderStore.ts`'s `changeDiscount` calls it at the press and passes the result to `applyDiscountChange`; the fixture `PRESETS` import is gone from the store. Before a first read has answered the list is empty, so a press then is `unknown-preset`. `DiscountSheet` reads the same store with `useSyncExternalStore` at every render and derives `presets` with `useMemo` over `held.menu`; nothing is copied into state.
- **The fixture side** (`menuFixtures.ts`, `catalog/fixtureCatalog.ts`). `PRESETS` and a new `FIXTURE_PRESETS_MARKER` moved into `menuFixtures.ts`, beside the fixture menu. `fixtureCatalog.ts` builds the fixture menu's `presets` from them (`rateFromPercent` for a percent), behind the same `__FIXTURE_SESSION__` switch, and carries the marker on `fixtureMenuFacts`. `discountFixtures.ts` no longer names a preset list: `STAFF_MEAL` and `COMP` are literal snapshots, `DiscountSheetFixture` and `panelDiscount` no longer carry `presets`.
- **The served picker** (`DiscountSheets.tsx`, `catalog/menuCopy.ts`, `pos.css`). `DiscountSheet` chooses `ServedPicker` when `catalog.kind === 'real'` and the old `Picker` (now taking `presets` instead of `fixture.presets`) otherwise. `ServedPicker` draws DESIGN-021's M-3: `served` `SheetFrame` (opens on the heading, contains Tab), the group label as `#preset-heading`, two-column entries (`data-preset`, `aria-label="{name} — {value}"`), `LOADING PRESETS` as a status, the failure notice with the menu's own `READ_FAILURE` words and `data-action="preset-retry"` calling the catalog store's `retry`, the no-presets sentence, *Anything else* with *Other amount — needs a manager* always present, and the footer's Cancel as `data-action="served-preset-cancel"`. Focus: a retry control or a preset row that is removed while it holds focus sets a ref in its layout-effect cleanup (the pattern `MenuRegion`'s `ReadFailed` uses); after the commit the picker sends focus to the heading if the read is ready, and leaves it to the new *Try again* if the read failed again (that control takes focus only when focus is on the body, and the heading's passive effect wins at opening). Copy constants are in `menuCopy.ts`; the failure title, body and action are the menu's.
- **Tests.** New `apps/pos/test/served-presets.test.tsx` (37 tests) covers AC 1 to 11; `served-harness.tsx`'s `menuOf` takes an optional fourth argument of served presets. `built-session-support.ts` gets three needles. `e2e/support/catalog.ts` gets `openOfficePresets`, `createPresetAtOffice` and `deactivatePresetAtOffice`, which drive BO-07's own controls (the ones `presets.spec.ts` drives; that file is not changed), and `e2e/tests/pos-catalog.spec.ts` gets case P11.

### What I decided, and on what evidence

- **A gated served entry says so in its visible value column too.** DESIGN-021 draws no served picture of the gated picker (ruling 4). I kept the label-in-name rule: over a free-form discount the entry's `aria-label` is `{name} — {value} — needs a manager`, the value column reads `{value} — needs a manager`, and the entry is dashed (`discount-option--gated`), as the fixture picker's buttons are. If the designer wants other words for a served gated entry, it is one line in `PresetEntry`.
- **`?state=` fixture sheets over a served catalog.** `DISCOUNT_FIXTURES[view.state]` is still honoured in a served build (it was before), so `?state=sheet-discount` draws `ServedPicker` over the served presets. The tests use that to open the picker directly. I did not change it: `discountFixtures.ts` stays in built bundles by design and now names no preset.
- **The `held.failure ?? 'failed'` fallback.** `failure` is non-null whenever `read === 'failed'`; the fallback only picks the generic copy if that ever broke, and invents no wording.
- **E2E P11 starts from `/pos/order`**, which in a served build seeds the default fixture order (it carries Staff meal), so Discount opens the change sheet there. The case presses *Replace with another preset* when it is present and otherwise sees the picker directly, so it does not depend on which order the screen seeds.

### Existing tests I changed, and why

- `discount-change.test.ts`, `discount-apply.test.tsx`, `void-apply.test.tsx`: **import move only** (`PRESETS` from `menuFixtures.js` instead of `discountFixtures.js`). No meaning changed.
- `discount.test.tsx`: the import move, plus **the FR-F5 describe block** ("a preset deactivated or edited after it was applied"). Those tests passed `presets` through `DiscountSheetFixture`, which no longer has the field, so `renderSheet` takes an optional `presets` argument and wraps the sheet in a `CatalogProvider` over a small stub store (`storeWith`) holding exactly those presets. Each test asserts what it asserted before. No other assertion changed.
- `served-harness.tsx`: addition only (`ServedPreset`, `menuOf`'s optional fourth parameter; the default is the old empty list).
- `built-session-support.ts`: additions only (`FIXTURE_PRESETS_MARKER`, `Regular customer`, `Service recovery`). I first renamed the test title to mention the preset list and reverted it to keep the change additions-only.
- Nothing weakened. The other fixture discount tests (`discount.test.tsx`'s picture and FR-F8 tests, `sheets.test.tsx`, `refund-screen.test.tsx`, `own-items.test.tsx`, `order-store.test.tsx`) passed untouched.

### The red proofs

Each was a mutation applied, observed failing for the stated reason, and reverted. Where my first mutation did not reach the real path I say so.

1. **AC 1.** `orderStore.ts` read `PRESETS` from `menuFixtures.js` in `changeDiscount`. Both built-bundle tests failed: `AssertionError: Regular customer in …/assets/index-….js: expected true to be false`, for `NODE_ENV=production` and `development`.
2. **AC 2.** My first mutation, `String(Number(rate) / 10000)`, **passed** (the double prints `12.3456` exactly). The float path that drifts is `String(Number(rate) * 0.0001)`: it failed `123456n ppm is 12.3456` with `expected '12.345600000000001' to be '12.3456'`.
3. **AC 3.** `valueText` printed `${value.percent}%`: `expected '12.3456%' to be '12,3456%'` in `valueText` and in the entry, name, change sheet and totals test.
4. **AC 4.** The store's `order` read the applied discount's name and value from the live preset by `presetId` at render. It only failed once the store hook also subscribed to the catalog (without a subscription the parent does not re-render on a poll, so the first mutation missed); then the totals test failed: `expected [[Subtotal…]…] to deep equally contain ['Regular guest 12,3456%', '−50.000']`.
5. **AC 5.** The entry's visible value was capped at the subtotal. My first test only read the `aria-label`, so the mutation **passed**; I added the visible-text assertion and it then failed: `expected 'Service recovery405.000 off' to be 'Service recovery99.999.999 off'`.
6. **AC 6.** `changeDiscount` used the list captured at render: `expected {} to deeply equal { refused: 'unknown-preset' }`.
7. **AC 7.** *Other amount* hidden while loading: `TypeError: Cannot read properties of undefined (reading 'click')`.
8. **AC 8.** The list was held from the first read that had a menu: four tests failed (an edited row stayed `Regular guest — 12,3456%`, a deactivated row stayed, the last-one-leaving case kept one row, focus did not move). The first attempt, a snapshot taken at mount before any menu, broke 14 tests for the wrong reason and proved nothing, so I redid it.
9. **AC 9.** The `heading.current?.focus()` after a removal was dropped: the retry-success test and the removed-focused-preset test both failed with `expected <body>… to be <span class="sheet__label" …>`.
10. **AC 10.** `presetsGated = false` in `ServedPicker`: `expected 'Presets — no approval needed' to be 'Presets — need a manager'`.
11. **AC 11.** `served = catalog.kind === 'real' || true`: the pinned fixture-picker test failed (`expected <button …> to be null`, the served Cancel on the fixture path) and four existing fixture discount tests failed too.
12. **AC 12.** The AC 8 snapshot mutation, run through `npm run test:e2e -- -g P11`: `expect(locator).toBeVisible() failed … getByRole('button', { name: 'Crew-… — 10%' }) … element(s) not found`.

### Verify output

- Baseline, before my edits: 157 files, 5696 tests (the task's figure; the run I started in the background overlapped with my first edits but reported the same).
- `npm run typecheck`: clean (all seven `tsc` projects).
- `npx vitest run` (the whole of `test:unit`), run alone on a quiet machine: **158 files passed, 5733 tests passed** (+1 file, +37 tests, all in `served-presets.test.tsx`).
- `npm run test:e2e:all`: **132 passed** in 2.0 minutes (130 baseline plus P11 on chromium and webkit).

### What I found and did not fix

- **Two odd full-suite runs, both from the shared test database and a loaded machine, not from this change.** The first `npm run verify` after the e2e runs failed two tests in `apps/server/test/pos-sign-in.test.ts` (the whole security log gained a `PIN_FAILURE` row that test did not expect); that file passes alone (21 tests). A later `npm run verify` took 930 s (the baseline took 135 s) and reported 11 failures in 6 files while the machine's load average was above 6; the same `vitest run` on a quiet machine passed in full. The lead should run `verify` on a quiet machine, not beside another suite or `test:e2e`.
- **The picker is not looked at in a browser.** The CSS for `.served-preset` (two columns, wrapping, 40 entries, a long name) is jsdom-unmeasurable; P11 proves behaviour, not layout. A designer or reviewer should check `?state=` equivalents against the reviewed `served-presets-many` picture in a real browser.
- **`valueText` throws on a percent string `rateFromPercent` rejects.** It is only called with stored values (a preset from `percentFromPpm`, or a free-form value `parseFreeForm` already validated), but a hand-built snapshot with a malformed percent now throws at render where it once printed it.
- I issued one shell heredoc to `/dev/null` by mistake early on (it did nothing); every file was written with the file tools.
- No formatter was run on any file.

### What the next agent needs and does not have

- Nothing blocks the review. For the reviewer: report against `agent/phase1-s7b2` (the task's `base`); this branch's diff includes S7b1 and S7b2 until those merge.
- DESIGN-021 draws no served picture of the gated picker; the gated entry wording above is mine, and so is the dashed treatment. Worth a designer's glance.
- The server is untouched, and nothing is stored: the stand-in's gates, the manager prompt and the free-form path are unchanged.

DONE

### Round 2 (builder: Claude Sonnet 5.5)

One code commit, `dd1c1d2` (`fix(pos): bind a preset pick to the snapshot displayed, and keep focus when its prompt closes`), plus this Handoff committed separately. Nothing pushed. Tests were written first and run against the unchanged code (R1's, R2's and R3's new tests failed as expected, 8 of them, with the rest of the file failing in cascade from a test that left its screen mounted); then the code.

**What I did**

- **R1, part 1: the store is the control.** `DiscountChange`'s preset variant (`discountChange.ts`, a type only; the operation's behaviour is unchanged and it never reads the field) gained an optional `shown?: DiscountSnapshot`. `DiscountSheet.change()` fills it from the snapshot it resolves from the live list for that pick, so both a direct press and a prompt's submission carry what the screen displayed. `orderStore.ts`'s `changeDiscount` resolves the preset from the list at the press (`snapshotFor`) and, when `shown` is present, refuses an otherwise accepted change as `unknown-preset` unless `sameSnapshot(resolved, shown)` (new in `discount.ts`: source, name, `presetId`, kind and value compared exactly). The refusal returns the very order (B-20). Closed and locked keep their place first. No refusal code was added.
- **R1, part 2: the open prompt.** A layout effect in `DiscountSheet` re-resolves the prompt's preset on every presets change; if it has left the list or its snapshot differs from `shown`, the prompt closes by the refusal path (`promptOpen` false, `setPrompt(undefined)`), the sheet stays, nothing is applied and no sentence is added. A fresh pick asks for a fresh approval.
- **R2.** The prompt-closing focus effect now focuses the opener only if `opener.isConnected`, otherwise `#preset-heading` inside the sheet (found through a ref on the `discount-flow` wrapper, after the sheet is no longer inert), whatever the heading's gated label.
- **R3.** The served picker's footer is now one child, `<button class="action served-preset-cancel" data-action="served-preset-cancel">`; `pos.css` gives only that class `grid-column: 1 / -1`, so no other sheet's footer changes. I did not use the artifact's `:has()` rule; the grid-column rule has the same effect and is scoped to the one button. Not measured in a browser, as you said.

**Tests** (all in `served-presets.test.tsx`, now 47 tests; `controllable` and `served` were hoisted to module level and `controllable.set` gained a `notify` flag for the moment between a store change and its render)

- R1: at the screen over the free-form 15% order, pick a served preset to open the prompt, then a poll that changes its value, one that changes its name, and one that deactivates it each close the prompt with the sheet kept and `Other discount 15% −60.750` still on the totals; a poll that changes nothing about the preset leaves the prompt open; a change made in the store with no render before the manager confirms is refused and the prompt closes; at the hook, a submission whose `shown` no longer matches is refused with the same order and one whose snapshot matches is applied.
- Stale press: the round 1 screen test only polled the entry away, as the review said. It is replaced by one that changes the store without notifying the screen and then presses the still-drawn entry; the store refuses, the sheet stays, nothing is applied, no `.notice`.
- R2: cancel returns focus to the opener; closure by a changed preset with the opener still listed returns to it; closure by a deactivated preset (opener detached, `isConnected` false) puts focus on the heading, `Presets — need a manager`, never the body.
- R3: the footer has exactly one child, the served Cancel.

**Existing test changed:** `discount.test.tsx`, "a preset is applied at once: the store is asked directly…". It asserted the exact change handed to the store, `{ kind: 'preset', presetId: 'staff-meal' }`; that change now carries `shown: STAFF_MEAL` (R1 says a preset change carries the displayed snapshot). Its other assertions (no prompt, the landing) are unchanged. Nothing else changed.

**Reds**, each applied, observed, reverted

- **R1 store:** `stale = false` (resolve by id alone): the hook test failed `expected {} to deeply equal { refused: 'unknown-preset' }`, and the instant-of-approval screen test failed (the preset was applied, so the sheet had closed: `expected null not to be null`).
- **R1 prompt:** the closing effect disabled: five tests failed, four with `expected <div class="modal" …> to be null` (value, name, deactivation, and the focus case that depends on the closure) and the deactivation focus test.
- **R2:** `if (true) opener.focus()`: `expected <body>… to be <span class="sheet__label" …>` in the deactivated-preset focus test.
- **R3:** the empty `<span />` restored: `expected …(2) to have a length of 1 but got 2`.

**Why no test cancels a prompt whose opener was removed while the prompt stays open:** with R1 in place that state cannot be reached for a preset pick, because a removal of the opener's preset closes the prompt in the same commit; the deactivation case above is the reachable form (opener detached, prompt closed by R1). The `isConnected` guard still covers any other opener.

**Verify output** (quiet machine, load average about 2): `npm run verify`: typecheck clean, **158 files, 5743 tests passed** (+10 tests over round 1). `npm run test:e2e:all`: **132 passed**, both engines.

**Found, not fixed:** nothing new. Round 1's note stands that the served picker's layout (now including the full-width Cancel) is unmeasured in a real browser.

DONE
