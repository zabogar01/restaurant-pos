# PHASE1-S7b3 review

## 1. Verdict: findings

There are three findings: one approval-context defect, one focus-recovery defect, and one smaller mismatch with the reviewed footer. The first two arise when the newly live preset list changes underneath the existing manager prompt. The ordinary ungated picker does not expose that interaction.

Reviewed `agent/phase1-s7b3` at `d3dd75b9377688f78a9ab6fa861242fb93bf2d38`. I inspected the branch's diff inventory against `development`, then reviewed the changes against `agent/phase1-s7b2` (`988baa87d574e1a10035d00f9e1c15dcaeddb88b`), as the task explicitly requires. The earlier S7b1 and S7b2 work is not attributed to this slice.

## 2. Findings

### F1 — P1: A changed preset can be applied under an approval prompt describing its old value

**Location:** `apps/pos/src/orderStore.ts:572`, together with `apps/pos/src/DiscountSheets.tsx:95`, `:101` and `:186`.

The prompt captures a display request when the cashier presses a preset, but retains only the preset ID for submission. The new store lookup resolves that ID against the current catalog when the manager confirms. A catalog refresh can therefore change the name, kind or value that will be applied without changing the request shown to the manager.

**Authority:** B-14 authorises one action at the moment approval is given, and FR-F8 makes the approval cover the whole replacement transition. Task ruling 4 preserves that gate in the served picker. Task ruling 2's current-list lookup does not authorise applying a different transition from the one the prompt describes. This is a defect in the client stand-in; it is not a claim that this slice persists an unauthorised server transaction.

**Observed scenario:** Starting at `/pos/order`, I used Discount → Replace with another amount, entered 15, and completed its stand-in approval. I then opened Discount → Replace with another preset and selected a served 10% preset. While the manager prompt was open, I advanced the mocked catalog revision and changed that same preset to a new name and 100%. The prompt still read `Replace Other discount 15% — with Review preset 10% −40.500`. Completing it applied `Changed preset 100%`, deducted `405.000`, and made the total zero. The sheet behind the prompt already displayed the new value. This reproduction used the built served bundle, its real transport decoding and catalog store, and ordinary order controls; it did not enter through a fixture-sheet URL.

**Proposed fix:** Bind a pending approval to the before/after facts it displays. If the selected preset disappears or its relevant facts change while approval is pending, invalidate that pending action and require a fresh selection and approval. Check the facts again at submission so a last-moment change cannot pass. Keep the current-list lookup and the existing manager gate; do not add the deferred Phase 2 catalog-version command. Add a regression covering a value change during the prompt, not just a change while the picker alone is open.

### F2 — P2: Removing the approval opener leaves focus on the body after cancellation

**Location:** `apps/pos/src/DiscountSheets.tsx:334`, especially the cleanup at `:340`, together with the return-focus effect at `:110`.

The removal cleanup records a lost focus target only when the removed preset button is currently active. While its manager prompt is open, focus belongs to the prompt, so removing the preset records nothing. On cancellation, the return-focus effect calls `focus()` on the detached button and clears its reference. The still-open picker receives no replacement focus.

**Authority:** The task's DESIGN-021 focus contract and AC 9 require focus to remain within M-3 and provide the preset heading as the recovery target for removed entries. Ruling 4 introduces the gated served state without relaxing those focus rules.

**Observed scenario:** Through ordinary order controls, apply a free-form discount, select a served preset to open approval, deactivate that preset in the catalog response, let the refresh arrive, and cancel the prompt. In the built bundle running in jsdom, `document.activeElement` is `BODY`, although M-3 remains open and its gated heading exists. The free-form discount remains unchanged, so B-20 holds for the order. The missing focus target is observable; the resulting browser keyboard-navigation behavior was not measured.

**Proposed fix:** When returning from approval, restore focus to the opener only if it is still connected and usable. Otherwise focus the served preset heading after the sheet is no longer inert. Apply the same recovery to a refused submission after deactivation. Add cancellation and refusal cases where the opener disappears while the prompt owns focus.

### F3 — P3: The served picker's Cancel occupies half of the reviewed footer

**Location:** `apps/pos/src/DiscountSheets.tsx:295`, especially the empty sibling at `:300`.

The served picker reuses the two-column footer with Cancel in the first column and an empty span in the second. `apps/pos/src/pos.css:1053` defines that footer as two equal columns, and there is no served-preset override. The reviewed artifact instead explicitly makes this footer a single full-width Cancel action (`docs/design/visual-directions/frost-served-catalog.css:37`–`:38`).

**Authority:** Task ruling 3 requires DESIGN-021's served M-3 layout, and AC 11 distinguishes that layout from the fixture picker. The reviewed artifact is the authority for this visual detail.

**Failing scenario:** Open the served picker in any read state. Its only footer action receives approximately half of the available footer width rather than the reviewed full width. This conclusion follows from the rendered structure and CSS; I did not obtain a browser measurement.

**Proposed fix:** Make this served footer's Cancel span the full grid, or give this footer the artifact's one-column treatment, without changing the fixture or other sheets' footers.

## 3. What I ran and what I did not

**Observed checks:**

- `npm run verify` exited 0. Typecheck passed. Vitest reported **158 files passed and 5,733 tests passed**, in 117.81 seconds.
- `npx vitest run --project client` exited 0: **121 files passed and 4,820 tests passed**. I started this narrower check while the full run had not yet returned output; it is additional evidence, not a replacement for the full result.
- `npm run test:e2e:all` built both clients successfully, then exited 1 in harness setup with `connect EPERM 127.0.0.1:5433 - Local (0.0.0.0:0)`. **No browser tests ran in my invocation.** The task records the lead's 132 passing browser cases; that is the lead's evidence, not my result.
- `git diff --stat` was empty before verification and after its green completion. The tracked tree remained clean through the additional probes, and HEAD remained `d3dd75b`. `git diff --check` also exited 0. The report is the only authored file change.
- I executed the built POS JavaScript in jsdom with in-memory session/catalog HTTP responses. Valid catalog responses passed through the bundle's normal decoder and real catalog store. Refreshes were triggered through the store's normal window-focus path. I observed ordinary and gated final-row removal recovering to the preset heading, then reproduced F1 and F2 through ordinary order controls. Only response data changed; no source or test file was mutated.

**Limits and inference:**

I did not repeat the builder's mutation matrix or claim its red results as mine. I read the added tests, changed assertions, browser case P11 and its BO-07 helpers. P11 uses ordinary POS controls and actual BO-07 creation/deactivation controls; its presence alone does not substitute for a successful run here. The test called “on the screen the sheet stays when the store refuses” only polls away the entry; it does not actually press a stale entry and observe a screen-level refusal. The separate hook test does exercise the current-list refusal.

A direct Chromium launch failed with a macOS permission denial at `bootstrap_check_in`. The browser tool also required approval that this session's policy does not allow. I therefore did not visually inspect or measure the 40-entry layout, longest names, gated value column, or browser focus behavior. F3 is a static layout finding; F1 and F2 are executed DOM/state observations. These limitations do not turn the lead's browser results into reviewer-owned evidence.

## 4. Cleared

The exact bigint conversion and decimal-comma display satisfy the cited B-1, FR-M3 and task ruling 5 paths. The suite covers the specified round trips and fractional display in the picker, accessible name, change sheet and totals. Fixed values remain uncapped in the picker and are capped at application under FR-M5. Applied discounts remain snapshots when catalog presets are edited or deactivated (FR-F4, FR-F5 and B-8). Presets retain server order, include zero values, and are neither selected automatically nor stacked (FR-F7, B-21 and B-22).

The fixture list moved behind the existing build-command switch. The two bundle tests, including their new preset needles, passed in verification. A served `?state=sheet-discount` uses the real catalog's presets; the retained order snapshots and discount-sheet fixture metadata do not restore a fixture pick-list. No new catalog-version field, server command, persistence or audit behavior was introduced, consistent with OQ1 and ADR-012 rule 12.

Before the first successful read, both the picker and `presetsAt` see no presets, and the picker offers no preset entry. Loading, both failure copies and the empty state preserve Other amount. Failure copy comes from the shared reviewed wording. After a successful read, refresh failures retain the held list and rely on the existing out-of-date band.

For the lead's specific questions: ordinary edited rows preserve identity and focus; ordinary removed rows recover to the group heading, including the final row and the gated label, as additionally exercised in memory. F2 describes the uncovered approval-overlay case. The `valueText` callers receive preset values from the exact adapter, validated free-form values, or valid literal snapshots; closed-order/refund display retains those snapshots. I found no reachable malformed-percent regression. A deliberately malformed hand-built snapshot can still throw, but that is not evidence of an application path.

The gated suffix and dashed treatment reuse `NEEDS_MANAGER` and the existing fixture gate semantics. My reading is that this reuses authored wording under ADR-011 rule 24 rather than inventing a new sentence; I found no copy violation in the reuse. Its visual fit remains unmeasured, as noted above. The more material shared-state problem is that the live picker and the frozen approval request can disagree (F1).

The existing test changes are the documented preset import moves and the FR-F5 test helper's catalog-provider adaptation. Their assertions were not weakened. The new browser helper uses BO-07's controls; `presets.spec.ts` is unchanged. All implementation changes in the task-base diff are within the declared ownership paths.
