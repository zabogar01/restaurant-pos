# FE-021 — independent code review

**Verdict: request changes. Eight findings (one P1, five P2, two P3).** Reviewed the uncommitted source and test diff on `agent/phase-0-foundations`, including untracked `apps/pos/test/own-items.test.tsx`, against FE-021, PRD, BOUNDARIES, the design worktree's `order.html` and `frost-order-flow.js`, and DESIGN-007's review. I edited only this report and made no commit.

## Findings, most severe first

### 1. P1 — A newly added pending line cannot open its quantity editor

**Location:** `apps/pos/src/OrderPanel.tsx:143–145,215–223` (the new store-backed `SheetView` still receives a sheet chosen from the fixture-backed `order`).

**Failure scenario:** From `default`, Add Fish & Chips, then tap its new pending row. The row comes from `store.order` and calls `openLine("fish-1")`, but `panelLine` searches `shownOrder(default)`, which has only the original fixture lines. It returns `undefined`, so no editor or stepper opens. The new `setQuantity` wiring only works for lines that happened to exist in the fixture. The test at `own-items.test.tsx:300–308` opens the original Steak, so it misses this route.

**Authority:** FE-021 Part B requires every pending line opened from the panel to have `Update to n`; acceptance criteria 4 and 6, PRD FR-D5/FR-M5. The design artifact's `openEdit` operates on the live model's selected row.

### 2. P2 — Item-sheet navigation erases the 86'd state of a held line

**Location:** `apps/pos/src/menuFixtures.ts:152–164`; `apps/pos/src/sheetFixtures.ts:167–175`; `apps/pos/src/OrderPanel.tsx:297–302`.

**Failure scenario:** Start at `?state=eightysix`, with pending Steak marked 86'd and Send blocked. Tap an available item such as Soda. `sheet-item-soda` has `eightySixed: []`; Cancel or Add routes to `default`, also with no 86'd items. The same held Steak remains in `store.order`, but its 86 tag and refusal disappear and Send becomes enabled. This existed with the old shared item destination too; the new per-item destinations and Add-to-`default` routing preserve the defect. The zero/overflow Add tests do not enter from `eightysix`.

**Authority:** B-17 and PRD FR-E4 require a held unavailable line to block firing until voided or restored. FE-021 criterion 7 and DESIGN-007's prior review call for state unrelated to Add to survive it. `MENU_FIXTURES` is currently acting as a view-state fact rather than persistent catalog availability.

### 3. P2 — Quantity edits reprice a historical line from today's menu

**Location:** `apps/pos/src/orderStore.ts:64–67,87–91` (now reachable through `Sheets.tsx:334–336`).

**Failure scenario:** Add a pending Burger with Large (+20.000) and Extra cheese (+15.000) at a resolved unit of 135.000, then change its catalog base from 100.000 to 120.000 before editing its quantity from 1 to 2. `rewriteQuantity` calls `priceOf(l.itemId)` on the current `MENU_ITEMS`, so it writes (120.000 + 35.000) × 2 = **310.000** instead of the snapshotted 135.000 × 2 = **270.000**. The fixture catalog is static today, but the newly exposed edit path depends on a live lookup and the line record has no resolved unit-price snapshot. A catalog refresh must not rewrite an already added line.

**Authority:** B-8 and PRD FR-D4 require the resolved unit price and components to be snapshotted; FR-C7 says a stale-catalog command must be rejected rather than silently charged at a different price. FE-021's quantity rule says to recompute from the line's own unit.

### 4. P2 — A selected zero-delta Size is dropped from the saved line

**Location:** `apps/pos/src/Sheets.tsx:174–179`.

**Failure scenario:** Select `Regular` on Coffee or Beer and press Add. The sheet visibly has `Regular` selected, but `chosenModifiers` filters it out solely because the group's id is `size` and its delta is zero. The resulting order line cannot say which Size the cashier chose. Burger `Regular` has the same problem. The artifact's `openItem` stores every selected option in its line detail, including zero-delta choices; the option-table test checks selections only in the sheet fixture, not the added line.

**Authority:** PRD FR-D4 requires customer-visible variant names in the line snapshot, and B-8 protects those historical facts. FE-021 Part A says to take the option composition from the artifact. Price need not change for a variant to matter to preparation or the customer.

### 5. P2 — The Add stepper is not beside Add in the item sheet

**Location:** `apps/pos/src/Sheets.tsx:187–210`; `apps/pos/src/pos.css:940–948,1011–1013`.

**Failure scenario:** In any available item sheet, the four footer children are Cancel, stepper, Add, bound copy. The unchanged two-column grid places Cancel and the stepper on row one, then Add alone on row two. The stepper sits beside Cancel, not beside the commit it controls. The line editor happens to place its four controls in the intended pairs, which hides this item-sheet-only layout error. The design artifact uses a separate secondary row and a `flow-commit` row containing stepper and Add.

**Authority:** FE-021 Part B explicitly requires `− n +` beside *Add to order*; DESIGN-007 Part B and `frost-order-flow.css` (`.flow-secondary`, `.flow-commit`) define that composition.

### 6. P2 — The 86'd item sheet loses its quantity stepper

**Location:** `apps/pos/src/Sheets.tsx:191–211`.

**Failure scenario:** Open `sheet-item86`. The entire quantity control disappears because the stepper is inside the available-item branch. In the artifact, `openItem(..., unavailable=true)` still builds and paints the stepper; only Add is disabled. The cashier can inspect a drafted quantity and its line amount while reading the unavailability notice, but cannot commit. The handoff calls the omitted stepper a decision to confirm; it is a visible departure from the supplied design, not a consequence of the no-Add rule.

**Authority:** FE-021 Part B's item-sheet composition and the instruction to take copy/composition from DESIGN-007; `frost-order-flow.js` `openItem` and `stepper` near lines 174–192. B-17 supports disabling Add, not removing the quantity display.

### 7. P3 — The existing-quantity preview is missing

**Location:** `apps/pos/src/Sheets.tsx:310–312,353–367`.

**Failure scenario:** Open `sheet-line` or `quick-line` at its current quantity of 1. The app hides Line total, unit arithmetic, and the “After update · not saved yet” totals until a press changes the draft. The artifact paints all three immediately at quantity 1; the handoff acknowledges this difference. Nothing should be written before Update, but the resting sheet still needs the preview to explain the price of the line being edited.

**Authority:** FE-021 Part B says to draw the in-sheet totals where the artifact draws them and to use the artifact's composition. `frost-order-flow.js:163–169` paints the preview on the stepper's initial `paint()` call. The new test at `own-items.test.tsx:271–278` instead asserts the missing-preview behavior.

### 8. P3 — The twelve-tile test does not assert the new line's price

**Location:** `apps/pos/test/own-items.test.tsx:47–65`.

**Failure scenario:** For each tile, the test verifies the new row's id/name and then compares the *sheet fixture's* base price with `MENU_ITEMS`. It never reads the row's amount. A mispriced Wings, Soup, Beer, or Wine line can pass this test; the two quantity-2 examples cover only Burger and Fish. The test comment says it checks the amount, but its assertion does not.

**Authority:** FE-021 acceptance criterion 1 explicitly requires the added pending line's id, name **and price** for every tile; B-8 makes the price written to the line the relevant value.

## Independent checks and handoff decisions

- **Money ruling confirmed.** FR-C2 gives resolved unit `max(0, base + selected deltas)` and line amount `unit × quantity`. Quick Burger's 100.000 + 20.000 + 15.000 = 135.000; quantity 3 is **405.000**, not 335.000. Rewriting 2 → 3 → 2 must give 270.000 → 405.000 → 270.000. The clamp-at-zero code is correct. For `sheet-line`, fired Burger 135.000 + Soda 30.000 + Steak 240.000 × 3 = **885.000** subtotal; 10% Staff meal is **−88.500**, discounted subtotal 796.500; 5% service **39.825**, total **836.325**, and included 10% tax `796.500 / 11`, half-up, **72.409**. Burger Add ×2 gives subtotal 675.000 and total 637.875. Zero's retained 100% comp gives 0 after Soda; overflow's 1.185.000 + Soda 30.000 gives 1.275.750. These figures agree with the changed tests and PRD FR-M3/M4.
- **Option sets confirmed.** I compared all twelve fixture names, base prices, ordered groups, choose-one/choose-any flags, ordered options, deltas, and default selections with the design worktree's `items` table. They match, including Soda's empty groups. Finding 4 concerns the line snapshot after Add, not the option table.
- **Draft URL states:** omitting the six changed/max URL states is reasonable for an in-sheet local draft; the stepper reaches 2 and 99 without a history entry. The resting preview omission is finding 7.
- **Routing:** `sheet-item-<id>` → `default` after Add avoids falsely moving a normal order to the `eightysix` fixture. `sheet-item` retains Burger's old Add → `eightysix` as an artifact alias; when opened directly, it still creates that false 86 display. The larger cross-state availability failure is finding 2.
- **86'd sheet and Size at delta zero:** findings 6 and 4. The former is an artifact mismatch; the latter also loses a required name snapshot.
- **Changed tests:** The two `menu-region` routing expectations were strengthened for per-item destinations. `order-store` AC5's 335.000 → 405.000 change is the FR-C2 correction, with a new 2 → 3 → 2 red case. `order-panel` adds twelve explicit states. `sheets` changes the reachability list and bigint walk for the new fixture shape. I found no existing assertion simply weakened to make the suite green; findings 7 and 8 concern new tests that encode or miss incorrect behavior. The literal FE-021 criterion 9 permits only the old Burger-routing tests to change, while the extra changes are necessary for the lead's money ruling and fixture shape and are named in builder23's handoff.

**Verification:** I ran `npm run verify` and read the output: typecheck passed; **23 test files, 1,577 tests passed**. `git diff --check` also passed. No browser layout run was performed; finding 5 follows from the rendered child order and the two-column CSS grid.

## Round 2

**Verdict: request changes. Two new P2 findings; original finding 3 remains partially open.** I reviewed builder23's Round 2 handoff and the current uncommitted diff, including the untracked test file. The lead's ruling to return an item sheet to its origin state fixes the named `eightysix` path, but sharing that origin with every menu fixture state introduces a false notice after a successful Add.

### New findings, most severe first

#### 9. P2 — A successful Add retains a rejection notice that says the order is unchanged

**Location:** `apps/pos/src/OrderPanel.tsx:149–151`; `apps/pos/src/menuFixtures.ts:106–110,213–214`; `apps/pos/src/MenuRegion.tsx:91–124,139–146`.

**Failure scenario:** Open `?state=error`, whose live grid is expressly for trying the add again. Tap Soda and press Add. The sheet carries `&from=error`, `store.addLine` appends Soda, and `go(sheet.add)` returns to `?state=error`. `menuFixtureFor` then redraws **“Could not add that line”** and **“The order is exactly as it was. Nothing was half-applied.”** beside the newly added Soda. The same origin handling also retains `catalog`'s “Nothing was added” notice after a successful Add. The Round 2 tests cover `eightysix`, `zero`, and `overflow`, not either notice state.

**Authority:** B-20 makes the rejection notice a claim that no state changed; PRD FR-C7 requires a catalog rejection to be distinguishable from a successful add. The SITEMAP classifies those notices as `[INLINE]` states, not permanent properties of the order. This is the recurring shared-value shape: `from` correctly preserves 86 availability but also preserves a now-false transient notice.

#### 10. P2 — `from` accepts overlay and lock fixture states as return origins

**Location:** `apps/pos/src/orderFixtures.ts:749–763`; `apps/pos/src/menuFixtures.ts:42–43,213–214`; `apps/pos/src/OrderPanel.tsx:149–151`.

**Failure scenario:** `orderViewFrom('?state=sheet-item-soda&from=sheet-line')` accepts `sheet-line` because the parser rejects only ids starting with `sheet-item`. Cancel then navigates to `?state=sheet-line`, opening a *different* sheet rather than returning to the workspace. `from=quick-line`, `sheet-discount`, `approval`, and `lock-lease` are similarly accepted despite being impossible tile origins. In the lock case the menu can draw a lock notice behind an actionable item sheet while the panel reads the item-sheet fixture's unlocked state. The UI's `itemDestination` usually passes a reachable origin, but the URL parser is the boundary for bookmarked, edited, or stale URLs; no test checks its accepted set.

**Authority:** The Round 2 handoff promises a “real non-sheet state”; SITEMAP §1 says sheets and modals are overlays and not return destinations, and FR-G12/G13 block adding under a settlement lock. `from` uses `replaceState`, so it does not create a new history entry by itself; the issue is accepting a value that changes the overlay topology or misstates the lock.

### Status of the original eight findings

| Original | Round 2 result | Evidence |
|---|---|---|
| 1. New pending line cannot open editor | **Fixed** | `panelLine` now receives `store.order`; the Fish add → open → Update to 2 test reaches 400.000. |
| 2. 86 availability lost | **Fixed for the named path** | `&from=eightysix`, `menuFixtureFor`, and Add/Cancel return preserve Steak's 86 tag and refusal. Finding 9 is a new origin-state defect. |
| 3. Edit reprices from today's menu | **Partially open, P2** | `addLine` now snapshots `unitPrice`, and the catalog-change test proves new Burger lines remain 270.000. But `unitOf` at `orderStore.ts:82–85` still falls back to **current `MENU_ITEMS`** for any legacy fixture line with a known `itemId`. Change Burger's menu base from 100.000 to 120.000, then edit the pre-existing `quick` Burger: its 135.000 historical unit becomes 155.000. Because the preview's arithmetic label in `Sheets.tsx:308,359–360` uses old `amount ÷ qty`, it can even show `135.000 × 1 = 155.000` at rest. B-8 and PRD FR-D4 require the line's own historical price. The no-menu-item fallback `amount ÷ qty` works for overflow Cheesecake and stays stable across repeated edits; valid FR-C2 lines have an integral unit. |
| 4. Zero-delta Size omitted | **Fixed** | All chosen options now enter the line snapshot; Coffee and Burger Regular have direct tests. |
| 5. Stepper separated from Add | **Fixed in markup/CSS** | Both controls share `.sheet__commit`, with Cancel in `.sheet__secondary`. Browser geometry was not run. |
| 6. 86'd sheet lacks stepper | **Fixed** | The stepper and total remain active while Add remains a non-control span. |
| 7. Resting preview absent | **Fixed** | `previewQuantity` now runs at the current quantity and the table/quick resting tests assert the preview. The legacy catalog-price mismatch is covered under original finding 3. |
| 8. Twelve-tile test omits line price | **Fixed** | Each tile now asserts the added row amount against the independently transcribed artifact table's base plus selected deltas. |

**Named changed tests:** `sheets.test.tsx`'s “only way out is Cancel” still checks the only exit in `.sheet__secondary` and presses every `.sheet__commit` button to prove none exits; the selector change is warranted by the restored stepper and is not a loosening. `menu-region.test.tsx` now expects `itemDestination(id, 'eightysix')`, which matches the new URL contract; the separate Add/Cancel 86 tests prove the origin survives beyond that shared helper. The new price test asserts the row amount, rather than only fixture data.

**Verification:** I ran `npm run verify` and read the output: typecheck passed; **23 test files, 1,588 tests passed**. `git diff --check` passed. No browser layout check was run. I appended only this Round 2 section and made no commit.

## Round 3

**Verdict: request changes. One new P2 finding.** Builder23's Round 3 changes close findings 9 and 10 and the remaining part of finding 3. I reviewed the current uncommitted diff and the Round 3 handoff; this section supersedes Round 2's status for those findings.

### 11. P2 — The persistent fire-failure banner disappears while an item sheet is open

**Location:** `apps/pos/src/OrderPanel.tsx:212–214`; `apps/pos/src/orderFixtures.ts:675–682,747`.

**Failure scenario:** Start at `?state=fireerror`, where the unresolved Round 2 kitchen-print failure draws the emergency banner. Tap Soda. The URL becomes `?state=sheet-item-soda&from=fireerror`; `ORDER_FIXTURES[view.state].incident` now reads the item-sheet fixture, which has no incident, so the banner is removed from the DOM while the sheet is open. Add or Cancel restores it by returning to `fireerror`. The incident itself was never resolved. `menuFixtureFor(view)` carries the origin's menu facts but the banner still reads only `view.state`. The new origin table marks `fireerror` as `keeps`, yet its test checks only the destination after Add and never the open sheet.

**Authority:** PRD FR-E3 makes unresolved kitchen incidents persistent and application-wide. SITEMAP POS-03 places the emergency banner in `[GLOBAL]` chrome. `OrderPanel.tsx:205–210` explicitly says the incident remains visible, but inert, behind an open sheet; `fire.test.tsx` proves that behavior for a void sheet opened without changing the URL. The item sheet must preserve the same incident visibility.

### Requested re-checks

| Origin | Add classification | Independent result after a successful Add |
|---|---|---|
| `default` | keeps | Ordinary table order; no transient message to invalidate. |
| `overflow` | keeps | Long order, prior rounds, and voided Caesar Salad stay in the store. |
| `zero` | keeps | Applied 100% Comp remains; the new line still gives total zero. |
| `other-discount` | keeps | The applied free-form discount snapshot remains an order fact. |
| `quick` | keeps | The same order remains a quick sale with no fire control. |
| `eightysix` | keeps | Held Steak remains unavailable; the 86 tag and fire refusal remain true. |
| `fireblocked` | keeps | The held unavailable Steak still blocks fire after another available item is added. |
| `fireblocked-overflow` | keeps | Held unavailable Coffee still blocks fire; adding another item does not restore it. |
| `fireerror` | keeps | The unresolved print failure is still true after Add; its banner returns then, but disappears during the sheet (finding 11). |
| `empty` | clears | Add creates a pending line; the empty draw would be false. Lead confirmed. |
| `pressed` | clears | The held tap has ended; retaining its pressed ring would be false. Lead confirmed. |
| `catalog` | clears | Its “Nothing was added” refresh notice becomes stale after a successful Add. |
| `error` | clears | Its rejected-command notice becomes false after a successful Add. |

**Finding 9 closed.** `OrderPanel.tsx:152–155` returns successful Adds from `error` and `catalog` to `default` while Cancel returns to the origin. The store retains the actual order; the new tests assert the added row and absence of both notices. No `keeps` origin has a notice or banner that becomes *false after Add*. Finding 11 concerns visibility while the sheet is open.

**Finding 10 closed.** `orderViewFrom` accepts `from` only for `sheet-item-*` and only when the value is a key of `ITEM_SHEET_ORIGINS`. The table test at `own-items.test.tsx:460–480` independently computes expected pressability from `SHEET_FIXTURES`, `APPROVAL_FIXTURES`, `DISCOUNT_FIXTURES`, `VOID_FIXTURES`, and the menu lock/loading flags; it does not read `ITEM_SHEET_ORIGINS`. It covers every `ORDER_STATES` id and named invalid strings. The rule is independent of the parser, though it naturally shares the repository's fixture definitions as its behavioral evidence. `from=sheet-line` now cancels to `default`.

**Finding 3 closed.** `unitOf` at `orderStore.ts:82–84` is exactly `line.unitPrice ?? line.amount / BigInt(line.quantity)`. `rewriteQuantity` and the sheet's arithmetic label both call it; `priceOf` is called only when a new line is added. The pre-existing quick Burger remains 135.000 per unit after a simulated catalog change and becomes 270.000 at quantity 2. The no-menu Cheesecake fallback is also correct; all existing fixture lines with quantity greater than one have amounts divisible by their quantity, and the quantity bound excludes zero.

**Verification:** I ran `npm run verify` and read the output: typecheck passed; **23 test files, 1,638 tests passed**. `git diff --check` passed. I edited only this report and made no commit.

## Round 4

**Verdict: request changes. Finding 11 is fixed; one new P3 finding remains.** `originFacts(view)` correctly selects `view.from ?? view.state`, and `OrderPanel` uses it for the application-wide incident banner. The red case now proves the banner stays present and inert while the item sheet is open; the derived test is non-vacuous and checks every allowed origin with an incident (currently `fireerror`). The dedicated test's title says “after Cancel and Add,” but its body only exercises Cancel. The origin-derived implementation covers both destinations; adding the missing Add assertion would make that regression test match its title.

The lead's reasoning about `lock` and `loading` is correct: `orderViewFrom`'s allow-list excludes both, so reading them from `view.state` cannot currently hide an allowed origin's lock or loading state. The reasoning about `pressedLineId` is factually incorrect: `pressed` is in `ITEM_SHEET_ORIGINS` as `clears`. It is reasonable for the prior held-row indicator to disappear while the sheet is open, because opening the sheet ends that tap; however, Cancel routes back to `pressed` and restores its pressed-row indicator after the tap has ended.

### 12. P3 — Cancel restores a stale pressed-row state

**Location:** `apps/pos/src/OrderPanel.tsx:149–155,275–280`; `apps/pos/src/orderFixtures.ts:738–752`.

**Failure scenario:** Open an item sheet from `?state=pressed`. `from=pressed` is accepted, but the sheet's panel reads `pressedLineId` from its own item-sheet state, so the highlight disappears. Press Cancel: `cancelTo` returns to `pressed`, and the Soda row is marked pressed again even though the menu-tile interaction that opened the sheet has ended. Successful Add correctly classifies this origin as `clears` and returns to `default`; Cancel should also avoid resurrecting the transient held-tap visual.

**Authority:** The `ITEM_SHEET_ORIGINS` comment defines `pressed` as “a held tap” and `clears` as “a draw that Add makes false”; the line comment in `OrderPanel` identifies `pressedLineId` as a held-down row visual. Round 3's confirmed “pressed clearing” decision and the `pressed` fixture's transient interaction meaning support clearing it once the item-tile interaction has happened. The allow-list does include this origin, contrary to the Round 4 handoff's exclusion claim.

**Verification:** I ran `npm run verify` and read the output: typecheck passed; **23 test files, 1,641 tests passed**. No existing test failed. The Round 4 banner regression tests cover the open-sheet and Cancel banner cases, but do not assert their title's stated Add path. No other files were edited and no commit was made.
