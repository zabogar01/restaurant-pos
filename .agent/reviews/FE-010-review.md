# FE-010 / F2k — independent review

Reviewer: `code-reviewer`. Date: 2026-09-21. Reviewed the uncommitted seven source files and four test files under `apps/pos` on `agent/phase-0-foundations`, against `19b4b8176dc8a24424994246ce472aced579094c`. Read the brief and handoff as claims; applied BOUNDARIES > PRD > reviewed design > task > handoff. Design citations below refer to the worktree at `../restaurant-pos-design`.

**Verdict: do not ship this slice as submitted. Three findings: two P2 implementation/brief defects and one P3 handoff defect.** The FR-F8 gate is correct for the represented orders, and the three named guards have not been weakened. The four requested judgement calls are assessed separately below; the lead makes their rulings.

## Findings, most severe first

### 1. P2 — The task incorrectly makes Send to kitchen leave POS-03; the implementation and tests encode that error

**Locations:** `apps/pos/src/OrderPanel.tsx:399` (also `:81`, `:89`, `:371`); `apps/pos/test/sheets.test.tsx:633`; `apps/pos/test/order-panel.test.tsx:248`; `.agent/tasks/FE-010-opener-fix.md:152` and `:260`.

Every close-bar action carrying a `search` receives `leaves: true`, including Fire. `navigate` therefore pushes a history entry. The new test explicitly requires the history length to increase for Send to kitchen, and the panel test requires `leaves: true`.

The reviewed sitemap is unambiguous. `docs/design/SITEMAP.md:154`, under POS-03, says:

> `│   └── [INLINE] Fire result — ticket printed / FAILED / UNKNOWN  FR-E3`

Its §1 table, `:67`, defines `[INLINE]` as:

> A state of the parent screen. No overlay, no route, no dismissal

The same row sets **Route: No; Back-stackable: No**. By comparison, settlement is explicitly `POS-04 [SCREEN]` at `:156–158`. SCREEN-INVENTORY's POS-03 entry also lists the fire result as an order-workspace state.

**AC7 and the brief's “Send to kitchen and Settle leave POS-03” sentence are the defect in the task.** Satisfying them does not satisfy the reviewed design. Although Fire already pushed before this slice, F2k now explicitly classifies and tests that incorrect exception while claiming to apply the inline-history rule. `fireerror` being an unimplemented fixture destination does not turn it into another screen.

**Recommended correction:** the lead should replace AC7 with: “Category, pending-line removal, and Send to kitchen replace the history entry; Settle pushes when leaving POS-03. Back does not traverse an inline change.” Make only Settle request `leaves: true`; change both tests and the explanatory comments accordingly. This is a document-backed defect, not a judgement call.

### 2. P2 — `appliedNoteFor` invents the actor and timestamp of the Comp application

**Locations:** `apps/pos/src/discountFixtures.ts:73–76` and `:147`; handoff `.agent/tasks/FE-010-opener-fix.md`, judgement call 3.

Reproduction by source trace: open `?state=zero`, press Discount. `COMP.source` is `preset`, so `appliedNoteFor` supplies “Applied by Ana R. at 19:44. Preset, no approval.” Neither the order nor its discount snapshot contains that application history.

The reviewed Frost artifact, `docs/design/visual-directions/frost/pos/order.html:529–531`, attaches that actor/time to **Staff meal — 10%**. It does not attach it to Comp. PRD FR-F2 establishes that applying a preset is ungated; it cannot establish who applied this particular preset or when. FR-F6 distinguishes the actor/approver facts of individual discount events. The same table and same order identity do not make different application events share history.

This violates the review's explicit prohibition on inventing values or copy unsupported by the reviewed artifact. It is not evidence of a newly corrupted audit store—the slice has no such persistence—but it is unsupported factual content in the UI. A `PROVISIONAL COPY` comment does not authorize it. The handoff's claim that this “only stops [strings] being written per state” is incomplete: the function expands their applicability to a new event.

**Recommended correction:** retain supported history as explicit fixture metadata tied to the application it describes. Do not derive it from `source`. Obtain a reviewed decision for Comp's missing history or for an omitted note; the existing optional `appliedNote` rendering supports omission technically, but the designer/lead should settle the composition. Reject judgement call 3 as submitted. The pre-existing provisional free-form attribution is carried context, not a new finding charged to F2k.

### 3. P3 — The handoff falsely says verification needs no PostgreSQL

**Location:** `.agent/tasks/FE-010-opener-fix.md:323–325`.

The handoff says “PostgreSQL was not needed; no test in this suite touches it.” `package.json` runs `vitest run` through `npm run verify`. `apps/server/test/migrate.test.ts:13–15` connects to PostgreSQL and resets its schema before each test; all seven migration tests use the database. This contradicts the handoff and the repository's evidence-based verification rule in `CLAUDE.md` / `AGENTS.md`.

My sandboxed verification encountered blocked connections to port 5433. The outside-sandbox run reached those tests successfully. The lead subsequently confirmed the pre-existing `restaurant-pos-db-1` container explains why the implementer's run passed. A passing run on this machine does not demonstrate database independence or clean-clone reproducibility.

**Recommended correction:** replace the claim with: “Verification includes seven PostgreSQL migration tests. PostgreSQL was already running on port 5433; start the repository database with `npm run db:up` when needed.” Do not change or exclude tests to make the original claim true.

## FR-F8: input and reachable paths

**Clean for this fixture slice.** PRD FR-F8 gates the whole transition whenever the applied discount is free-form, even when replacing it with a preset. `needsManager` at `apps/pos/src/discount.ts:54–57` implements exactly that rule:

| Applied discount | Remove | Replace/apply preset | Replace/apply free-form |
|---|---|---|---|
| None | Not offered | Ungated | Gated |
| Preset, including Comp | Ungated | Ungated | Gated |
| Free-form | Gated | Gated | Gated |

`shownOrder` (`voidFixtures.ts:103–112`) carries the fixture's snapshot alongside the same subtotal/removal selection the panel renders. `panelDiscount` (`discountFixtures.ts:144–153`) passes that snapshot unchanged. All 25 order states' represented snapshots agree with their printed discounts; `gone` changes the supported subtotal without changing the discount's source. Empty orders and both locks expose no Discount action. Direct sheet fixtures retain matching discount sources.

Picker selection, free-form Apply, and removal all converge on `DiscountSheets.tsx:53–60`. A gated change creates the approval prompt instead of navigating to its landing. Moving into the picker or free-form editor first is not an approval bypass: the specific replacement must be selected before approval authorizes it. Cancelling the prompt retains the sheet and order. I found no reachable discount action in this slice that bypasses its required prompt.

This establishes the represented UI gate, not backend authorization, persistence, or successful application of the discount. The existing fixture harness does not implement those. In particular, a successful panel-opened change lands back on unchanged figures, as discussed below.

**`other-discount` is not an unsupported invention.** `orderFixtures.ts:344–349` reuses the existing free-form order's lines, snapshot and figures without its sheet. SCREEN-INVENTORY `:161` already includes “discount applied” with its snapshotted name; FE-010 criterion 3 explicitly requests this fixture. It adds a review entry point, not a new domain status, discount value or visual treatment.

## Guard audit

- **I-12:** `order-panel.test.tsx:70–107` still inspects every trailing slot for an anchor/button ancestor and retains all five detector self-tests. The state sweep at `:149–174` still asserts sibling structure and empty fired/voided slots; it gains the new state. Restored source keeps the slot outside the tap target. No selector stopped looking at a formerly protected slot.
- **B-12:** `pin-pad.test.tsx:139–205` and `PinPad.tsx` are unchanged. Both pad mounts still compare complete host markup for different PINs at every partial length and inspect attributes/display and external outputs. Entered digits remain in a ref; rendered entry state exposes count only. No evidence of a new leak or a narrowed guard.
- **Reachability:** `sheets.test.tsx:96–103` retains void detection and adds discount/editor recognition. The original `liveControls` selector, inert filtering, `GATED` set, state sweep and void self-tests remain. No existing assertion has become green by dropping its previous targets. **Its strength is limited:** discount/editor labels are not in `GATED`; the sweep at `:185` does not traverse `other-discount`'s multi-step actions, and the detector does not report an in-place approval prompt. The extension's self-test proves recognition, not approval-before-change. Dedicated discount tests plus the source trace above establish FR-F8; do not advertise this detector as a comprehensive approval oracle.

The final diff cannot establish whether the detector was extended *before* the implementation, nor reproduce historical injection counts. I did not mutate source or tests. During this review, the lead independently injected the wrong applied snapshot and reports seven failures. I directly observed verification fail on the lead's separate I-12 mutation: 101 tests failed, including the slot guards. That mutation also converted the remove button to a span, so its failure count is not comparable to the handoff's narrower “22” injection. The lead confirmed both files were restored byte-for-byte before the final green run. Other claimed injection counts remain unverified by this review.

## Opinions on the four judgement calls

1. **Category rail versus grid — judgement call; recommend holding criterion 6.** `MenuRegion.tsx:27,47,56` now presents Drinks as current while retaining the Mains grid. SITEMAP describes a category-to-items browser, so selection communicates content, not merely receipt of a click. Preserve the order-retention fix, but have the lead/designer settle the undrawn category behavior. Merely restoring the selected CSS class while still writing `category=drinks` would restore the old contradiction. Do not invent a catalogue. Given the explicitly accepted fixture limitation, I am not counting this recommendation as a separate implementation defect.
2. **Discount landing on the current view — accept narrowly as a fixture limitation.** `discountFixtures.ts:153` follows the explicit no-recomputation scope and avoids replacing the order. The cost is real: Comp from `default` no longer reaches the available zero-total result; remove/replace likewise do not update the applied snapshot or totals. Obtain explicit acceptance of that interaction regression and describe it as preserved context, not a completed discount mutation. It must be resolved before production use.
3. **Extending provisional history to zero — reject.** This is finding 2, a factual-content defect. Reusing words cannot establish a different event's actor/time.
4. **Preserving `gone` and `category` on close — accept.** `cancel: view`, `landsOn: () => view`, and `panelLine`'s `back: view` preserve the screen beneath an overlay, consistent with SITEMAP §1 and cancellation leaving the order unchanged (B-20). The existing single-`gone` removal limitation remains; it is not newly introduced by the editor. Query-string state is still a review harness, not proof that production reload semantics are implemented.

## Verification and limits of the handoff evidence

After restoration, I ran **`npm run verify`: exit 0; typecheck clean; 17 files, 892 tests passed**, with the existing PostgreSQL instance available. The `apps/pos` diff SHA-256 was identical immediately before and after: `a1f77cc6df13fde1d0615b006467d9e81520dc1c8b278c6a7bdf0ed2ecc2d3c0`.

The source supports order-preserving discount opening, line-specific editor titles/quantities/removal targets, category order retention, and replacement of category/removal history entries. Changed test assertions follow those changes without weakening the named guards; the exception is the positively incorrect Fire expectation in finding 1. Source/test file counts and absence of CSS changes match the handoff.

I did not independently replay its browser session, touch-device behavior, screen-reader announcements, rings or screenshots; did not rerun the historical baseline; and cannot confirm author attribution, chronology of edits, or historical mutation counts from the working-tree diff. The claimed pre-code lead ruling is not established by this diff, although opening the existing change sheet for an applied discount is a reasonable composition. “No new CSS” does not prove that newly combined states/copy were reviewed. Existing focus trapping, stacked scrims, the held menu-tile opener, and fixture-only mutation limitations remain carried issues, not fixes delivered here.

Only this review report was written by the reviewer. No source/test edits, staging, commits, checkout or stash operations were performed.
