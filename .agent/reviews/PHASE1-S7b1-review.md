# PHASE1-S7b1 review

## Verdict: findings

Reviewed `agent/phase1-s7b1` at `d9dd8980cd76ed50d5d3e7a8d4d8979ef5e12ae7` against `development` at `22be697d0fff41d826742aa0e31d59a6b09fab75`, the dispatched task, its cited requirements, boundaries, architecture rules, upstream handoff, and DESIGN-021's served artifact and rules. There are three findings: two medium-priority behavioral defects and one low-priority layout defect. Full verification passed; the browser suite could not start its tests in this environment.

## Findings

### 1. P2 — A completed retry steals focus from subsequent order work

**Location:** `apps/pos/src/MenuRegion.tsx:65`, with the pending focus flag set at `apps/pos/src/MenuRegion.tsx:253`.

When a focused Try again button disappears into loading, its cleanup sets `refocus.current`. There is no category or empty-catalog target yet, so the flag survives. On success, the layout effect focuses the category without checking whether the cashier has since focused a persistent order control.

**Authority:** The task's Focus rules and acceptance criterion 15; DESIGN-021's Handoff, Focus and keyboard rules, explicitly require a user already working in a persistent order control to retain focus (`.agent/tasks/DESIGN-021-pos-catalog-states.md:808`).

**Failing scenario, observed:** Start with the first read failed, focus and press Try again, hold its response, and focus an existing `.order-line__target` while loading. Deliver a successful menu. The line still exists, but `document.activeElement` becomes the Meals category button. The existing retry test delivers immediately and never exercises the intervening order work.

**Proposed fix:** Cancel the pending fallback when focus moves to a surviving control, or check the current focus before applying the fallback. Retain the category/empty-message fallback when focus is still lost. Add a held-response test that moves focus during the retry, including an order dialog if applicable.

### 2. P2 — An availability announcement survives later unrelated projections

**Location:** `apps/pos/src/MenuRegion.tsx:77`.

The announcement's lifetime is keyed only to `availabilityChanges` and `outOfDate`. A newly accepted projection that changes price, name, ordering, or membership without toggling availability changes neither value, so the previous availability announcement remains indefinitely.

**Authority:** DESIGN-021 rule 5, copied into the task and its acceptance criterion 13; `docs/DESIGN.md:2112` requires the announcement to end at the next changed projection, an out-of-date warning, or departure from POS-03. An unchanged poll alone retains it.

**Failing scenario, observed:** Load version 1, accept version 2 with Nasi Goreng marked unavailable, then accept version 3 changing only its price to 50.000. The tile updates, but the band still says “Menu availability updated.” Accepting version 4 with no categories or items also leaves that announcement beside the empty-catalog message. The existing silent-price/archive tests begin with an empty band, which hides this shared-state defect.

**Proposed fix:** Track adoption of the menu projection as well as availability changes. On a changed projection, clear the old announcement unless that projection itself warrants a new availability announcement; preserve it on unchanged revision checks. Test 86 followed by price-only change, archive, and an empty projection.

### 3. P3 — The status band is not anchored to the bottom in the no-grid states

**Location:** `apps/pos/src/pos.css:860`; the alternative bodies are selected at `apps/pos/src/MenuRegion.tsx:185`.

Only `.menu-grid` grows to consume the menu area's remaining height. Loading, first-read failure, and empty catalog replace that grid with an intrinsic-height block. The shared status band has neither an automatic top margin nor another layout rule anchoring it, so in those states it follows the block near the top instead of occupying the menu's bottom edge. This is a conclusion from the rendered structure and CSS, not a browser measurement.

**Authority:** DESIGN-021 rule 5 and task acceptance criterion 13 require a fixed 72px band reserved at the menu's bottom edge; `docs/DESIGN.md:2108` states the same placement.

**Failing scenario:** Open a served POS with no categories, or hold/fail the initial menu request. The component still renders the band, but nothing above it consumes the unused vertical space. The unit test checks only that the band exists in these states; P1 measures its geometry only with a populated grid.

**Proposed fix:** Anchor the band independently of which body is rendered, for example with a suitable automatic margin or a common growing content region. Check its bottom coordinate and 72px height for loading, both failures, empty catalog, and populated catalog.

## What I ran and what I did not

- `npm run verify` passed: typechecking completed, **153 test files passed and 5,612 tests passed**. Reported duration: 131.24 seconds.
- `npm run test:unit -- --project=client` passed: **116 files and 4,699 tests**. This separate run was started while the full verification output was still pending.
- `npm run test:unit -- --project=client --pool=threads --maxWorkers=1 apps/pos/test/catalog-store.test.tsx apps/pos/test/served-menu.test.tsx` passed: **2 files and 90 tests**.
- `npm run test:e2e:all` built both clients, then failed during startup with `connect EPERM 127.0.0.1:5433 - Local (0.0.0.0:0)`. **No browser test passed in this run.** I did not rerun B6/B8 five times in either engine, and do not independently confirm the Handoff's browser counts or geometry claims. A separate browser geometry probe was also unavailable because that tool required approval under the current never-approve policy.
- I reproduced findings 1 and 2 using the existing real catalog store and served React harness in jsdom, loading TypeScript in memory and driving the injected clock and held responses. No source or test file was edited. These were transition reproductions against the implementation, not mutation runs. I did not repeat the builder's mutation experiments.
- Before verification, `git status --short --branch` showed a clean task branch and `git diff --stat` was empty. After the green runs, both were unchanged; HEAD and development still matched the hashes above. The branch comparison remained **32 files, 3,163 insertions, 352 deletions**. The review report is the only subsequent authored file.

## Cleared

The poll receives only revision/menu reads, schedules after settlement, coalesces refreshes, and rejects stopped-epoch answers before a follow-up menu read. The source and passing tests support immediate start/focus/visibility refresh, hidden-tab timer pause, first-read recovery, and two-failure staleness without disabling a held menu. Inspection of PosRoutes confirms that the lifecycle is above individual screens and tied to the session's signed-in state; standalone harness tests are not claimed as browser proof of that wiring.

The served projection replaces version and contents together, accepts a lower restored version, preserves server order, and decodes monetary values with the shared exact codecs (B-1, ADR-012 rule 11). Fire and close read current unavailable IDs at the press; fixture names do not match served IDs, and order snapshots are not repriced (B-8, B-17 and the task's Phase 1 scope).

The fixture source split, both built-bundle marker checks, served query-state isolation, focusable guarded 86 tiles, category selection by ID, empty-order action rules, failure copy variants, and existing fixture behavior passed the relevant checks. Available served tiles opening nothing is explicitly deferred to S7b2 by the task and is not a finding. No server command, migration, commit, or push was made.
