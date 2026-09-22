# F2h / F2d — independent review

Reviewer: Codex. Date: 2026-09-22. Reviewed `456c37f` (F2h) and `2ed74aa` (F2d) on `agent/phase-0-foundations`, using `12e9ca6` (`456c37f^`) as the source/test baseline. The checkout is at `63f74a6`; changes after `2ed74aa` are coordination documents only, and `git diff --exit-code 2ed74aa -- apps/pos` passed. Read CLAUDE.md, coordination context, FE-011/FE-012 and their handoffs as claims; applied BOUNDARIES > PRD > confirmed design > task > handoff. Design citations below refer to `../restaurant-pos-design`, not this branch's older copies. Separate read-only spec and guard reviews informed this report.

**Verdict: request changes. Two P2 findings: one reproducible order-preservation defect in F2h and one coverage gap in F2d's claimed reachability guard.** The unavailable-item refusal and the distinction between inert table fire and absent quick-sale fire are correct for the represented fixtures. Verification passes, but does not catch the interaction in finding 1 or cover the static sheet exits in finding 2.

## Findings, most severe first

### 1. P2 — Dismissing the rejection restores a line the cashier already removed

**Locations:** `apps/pos/src/MenuRegion.tsx:104`; `apps/pos/src/menuFixtures.ts:186`; missing interaction coverage at `apps/pos/test/fire.test.tsx:468`.

Try again navigates to `fixture.rejected`, which is `{ state: 'default' }` for the error fixture. It discards the current view's `gone` selection. The order remains editable while the rejection notice is displayed, so this is reachable using ordinary controls:

1. Open `/pos/order?state=error`.
2. Press Steak's trailing remove control. The URL becomes `?state=error&gone=steak`; Burger and Soda remain, with total **155.925**.
3. Press **Try again**. The URL becomes `?state=default`; **Steak returns and the total becomes 382.725**.

I reproduced those exact rows, totals and URLs by mounting the submitted `OrderScreen` in JSDOM and pressing its actual controls. History length remained unchanged throughout; replacing history is correct but does not preserve the order.

SCREEN-INVENTORY POS-03 (`docs/design/SCREEN-INVENTORY.md:137`) defines the rejected-command state as leaving the order exactly as it was, citing B-20. The notice itself promises that nothing was half-applied. FE-011 §3 also explicitly requires Try again to clear the notice and retain the order. Moving the destination constant into a fixture does not meet that requirement if current order state is lost on the way there.

The existing preservation test starts from the untouched error fixture. Its before/after equality passes because the default and error fixtures initially share the same lines. It never exercises a supported removal before dismissal.

**Recommended correction:** preserve the current order selection when clearing the rejection, including `gone` in this fixture harness. Add the remove-then-retry sequence and assert retained rows, totals, discount, absence of the notice, and unchanged history depth. This requires no new figures or unsupported multi-removal behavior.

### 2. P2 — The quick-line reachability test never follows its controls, and the real sweep omits it

**Locations:** `apps/pos/test/quick-sale.test.tsx:307`; changed exclusion at `apps/pos/test/sheets.test.tsx:501`; positive sweep at `apps/pos/test/sheets.test.tsx:185`, using the fixed list at `:63`.

F2d correctly changes the negative “no sheet in any other state” sweep to exclude every key in `SHEET_FIXTURES`. However, the positive reachability sweep still enumerates the three F2c sheets plus the discount sheets. **`quick-line` belongs to neither sweep that follows controls.** Its new dedicated block claims “nothing gated is reachable” but only checks button markup and whether the background Void order control has an inert ancestor. It presses no button.

The distinct code paths matter. The static review fixture supplies Back and Remove line at `apps/pos/src/sheetFixtures.ts:138–139`. The interactive quick-sale editor tests instead open a row from `quick`, exercising destinations constructed separately by `panelLine` at `:176–177`. Those tests cannot validate the static fixture's exits.

A concrete escaping regression, by source trace, is setting only the static quick-line `remove` destination to `{ state: 'approval' }`. The sheet still has the same buttons and inert background; the dynamic quick editor tests still use their separate correct destination; the positive reachability sweep never visits the modified fixture. Likewise, a static Back target returning to the table workspace would escape these checks despite C-2 and the confirmed quick-editor return rule.

**The submitted destinations are currently correct.** This finding is a blind guard, not an observed approval bypass. I did not alter files or inject this regression, and do not claim a mutation-run result.

**Recommended correction:** derive the ungated-sheet reachability cases from `SHEET_FIXTURES`, assert that the covered set includes every such fixture, and actually follow quick-line's Back, close and Remove controls. Keep the detector self-tests. Separate generic reachability assertions from the existing table-specific panel-content assertions so adding the quick form does not require weakening either.

## Rules cleared against the sources

**B-17 really is the authority for the refusal.** `docs/BOUNDARIES.md:113–115` explicitly says that a pending line holding an unavailable item blocks the fire. `docs/PRD.md:177–178` (FR-E4) independently says it remains blocked until the line is voided or the item restored. This is not a paraphrase inferred from “never reaches the kitchen.” `fire.ts:34–35` checks PENDING status and item membership in the unavailable list; the panel uses its currently displayed lines after the supported removal (`OrderPanel.tsx:187–220`). FIRED and VOIDED lines do not block. Applying the refusal in `eightysix`, `sheet-item86` and `fireblocked` corrects the artifact's inconsistency. The tagged line and refusal read the same fact.

The two resolutions are distinguished correctly. Removing Steak from `fireblocked` clears the refusal but also removes the last PENDING line, so fire remains inert for a different reason. Removing Coffee from `fireblocked-overflow` leaves pending work and makes fire available. Restored item availability is covered at the pure-rule level. The extra overflow fixture supplies a meaningful case without inventing new order figures.

**Inert table fire and absent quick-sale fire are compatible rulings.** C-1 itself (`SCREEN-INVENTORY.md:926`) concerns zero-total refunds; it is not literally a universal rule prescribing every disabled control. The temporary/permanent interpretation is explicitly recorded in I-12 (`:917`). FR-D3 permits adding lines after a previous fire, so “nothing pending” is temporary. Keeping table fire inert is consistent with that interpretation and with FR-E1/E2/B-16. C-2 (`:927`, also POS-03 `:199–203`) and FR-E5 (`PRD.md:179–183`) directly require the quick-sale control to be absent. `actionsFor` at `OrderPanel.tsx:560–563` implements that requirement, with settlement carrying the kitchen meaning. Cite C-2/FR-E5 directly for this case, rather than treating C-1 alone as its authority.

**Failed printing does not undo fired work or block settlement.** The standalone `fireerror` fixture retains FIRED lines, marks round 2 not printed, and leaves Discount, Void order and Settle available. That agrees with FR-E3, B-15 and I-7. The round-header correction resolves a contradiction with the banner. This fixture is not evidence that the default order's Steak was successfully fired: fire execution is deliberately absent, and the button no longer navigates to this different order.

**Quick-sale identity and represented editor paths are correct.** The counter fixture has no table and only PENDING lines. Count, pending heading, close-bar composition and dynamically opened editor form derive from the order type. Both row-opened editors name and remove their own line, retain the quick workspace and use ungated pending removal (FR-D2, FR-E5, FR-H2). Fired-line and fired-order paths still use the existing reason/manager flow (FR-H1/H4); quick-order void is classified through the existing no-fired-work rule (FR-H3).

**Catalog and history behavior remain consistent within this slice.** The 86'd tile remains disabled in its existing position; the already-open item sheet retains its choices and disabled Add. The catalog-change notice remains separate from generic rejection. No new stale-price addition path was introduced. Retry replaces history; fire does not navigate; settlement retains the screen-departure behavior. FR-C6's polling/server revalidation and FR-C7's actual rejection/refresh transaction are not implemented or proven by these fixture screens.

## Guard audit

- **Fire parameterization: cleared.** `fire.test.tsx:66–78` classifies all 31 registered states using the order type. The tests at `:665–706` require nonempty table/quick sets, an exhaustive partition, agreement with the raw quick-sale type field and corresponding rendered presence/absence. `order-panel.test.tsx:113` independently enumerates the registered state list. Quick-sale states have not silently vanished from the checks when excluded from table-only availability assertions.
- **Repeated rendering: cleared.** Fire, quick-sale and sheet tests increment `OrderScreen`'s React key on every render (`fire.test.tsx:38–43`, `quick-sale.test.tsx:34–37`, `sheets.test.tsx:41–44`). Its `useState(initial)` therefore cannot make a loop inspect the first fixture repeatedly. The I-12 suite renders stateless `OrderPanel` directly and creates a fresh root for each parameterized test.
- **I-12: cleared for the submitted markup.** The all-state sweep still includes every new state and retains the swallowed-slot detector's positive self-tests. Targets and slots remain siblings; unavailable pending lines retain removal in their slot and put the 86 tag in the name. Locked rows remain inert with empty slots. Loading legitimately has no rows; its dedicated skeleton assertions account for that case. The general structural loops alone should not be advertised as proof of row cardinality.
- **B-12: cleared.** Both pad mounts still use complete host-markup comparisons for different PINs at each partial length, positive keypad checks, attribute/display checks and external-output checks. The banner extraction did not change PIN handling or narrow those guards.
- **Reachability: partial, with finding 2 outstanding.** F2h explicitly checks its new notice/banner actions rather than excluding live order screens' intentionally reachable void actions. The older detector's inability to recognize every in-place approval path was already disclosed in FE-010; it is not newly charged here. The new static quick-line omission is separate from that carried limitation.

## Verification and limits of the handoff evidence

I ran **`npm run verify`: exit 0; typecheck clean; 19 files, 1127 tests passed**. The seven PostgreSQL migration tests passed with the existing database available; no `db:up` was needed. I also ran the read-only JSDOM interaction reproduction described in finding 1 against the submitted component, without creating or editing source/test files. An initial attempt to use esbuild for that reproduction failed because it is not installed; the successful reproduction used the installed TypeScript transpiler in memory.

I did not rerun historical mutation counts, inject defects into the checkout, replay the implementers' browser sessions, or verify visual layout, touch geometry or screen-reader announcements. The test suite's own in-memory fixture changes run as part of normal verification; they do not edit repository files.

One rule limitation should remain explicit: `OrderLine.itemId` is optional and `holdsUnavailable` treats a missing identity as nonblocking (`orderFixtures.ts:46–51`, `fire.ts:30–35`). The pending Cheesecake has no identity because it lacks a displayed menu tile. **A missing tile does not establish availability.** There is no represented unavailable-Cheesecake case here, so I am not counting a second reachable B-17 failure, but the current fixture rule must not be promoted into a production guarantee for every item without resolving that identity gap.

Actual fire execution, UNKNOWN delivery composition, shared incident persistence, reprint/settlement destinations, empty/locked quick-sale compositions and backend enforcement remain held work. The pre-existing single-`gone` removal limitation, focus trapping and stacked scrims also remain carried issues. These are not fixes delivered by this review, and a passing fixture suite is not end-to-end fulfillment of the PRD.

Only this review report was written. No source/test or coordination files were edited; no staging, commits, checkout, stash or merge operations were performed.
