# FE-022 — independent code review

**Verdict: approve after one fix. Six findings (one P2, five P3).** Reviewed the uncommitted diff on `agent/phase-0-foundations` plus untracked `test/fire-order.test.ts` and `test/one-press-fire.test.tsx` against FE-022 criteria 1–15, ARCH-002 §3, BOUNDARIES, and the design worktree (`frost-order-flow.js`, `order.html`, DESIGN-007). I edited only this report and committed nothing. I used a throwaway probe test to check the items below and deleted it; `git status` shows no stray file.

**`npm run verify`: typecheck clean, 25 files, 1764 tests pass.** This matches the handoff's count (+119 on 1645).

## Criteria 1–15

- **1–8:** each is its own test on `fireOrder` in `fire-order.test.ts`, with a red case. `fireOrder` returns the same `groups` by reference on every refusal, and the transition reads no clock.
- **9–13:** the count, the whole-screen walk, the delivery-wording table, idempotence and history are all covered in `one-press-fire.test.tsx`.
- **14:** see below. **15:** met.
- **The only criterion-level problem is finding 1**, which is about criterion 5's status line, not one of the eight T-tests.

## Findings, most severe first

### 1. P2 — The "Round n sent to the kitchen" status comes back when a pending line is removed

**Location:** `apps/pos/src/OrderPanel.tsx:438-440` (`sentRound !== undefined && nothingToSend`), with `sentRound` set once at `:171` and never cleared.

**Failure scenario, run in a probe:** `fire-ready` → press Send → the status reads *Round 3 sent to the kitchen*. Open a tile and Add (status clears: the test at `one-press-fire.test.tsx:150` covers only this). Then press Remove on the new line. The status reads **"Round 3 sent to the kitchen"** again, and Send is inert. Nothing was sent by that press, yet a polite live region re-announces it. The line is also stale after the cashier has moved on to any later edit.

This is the repo's recurring defect shape: a message tied to a render condition (nothing is pending) instead of to the event that produced it. The handoff's "cleared as soon as a pending line exists again" is true only for the first add.

**Fix:** clear `sentRound` when a pending line appears (an effect on `nothingToSend`), or clear it on the next store change. Add the add-then-remove case to the test.

**Authority:** DESIGN-007 Part C, `fire-queued`: the polite status is the announcement of the press. FE-022 criterion 5.

### 2. P3 — The builder's "fire-heading-width is not a state" is wrong; it is unbuilt and unmeasured

**Location:** builder's "Not done", versus `restaurant-pos-design/docs/design/visual-directions/frost-order-flow.js:203-211` and `order.html:21`.

The artifact defines `fire-heading-width` ("Fire — Round 12, UNKNOWN"): rounds 1–12, and the last heading reads *Round 12 · fired 23:59 · UNKNOWN · may have printed*. DESIGN-007 Part C item 8 and `:363` require it to fit at 1280×800 without wrapping under the tag. No fixture, no jsdom test and no browser check covers it.

The task's criteria do not list it, so this is not a blocker. **The lead should either make it a follow-up or put it under unresolved work.** Neither jsdom nor CSS can answer the width question. The `.round-head` label has no width rule of its own.

### 3. P3 — `fireerror`: the builder's note is accurate, but DESIGN-007 contradicts itself

The builder left `fireerror`'s two-round data. DESIGN-007 `:365` and `:407` say it "aliases / is replaced by the coherent new-round FAILED composition" (the 458.325 family, `:375`). DESIGN-007 `:578` says "Direct; prior failed outcome retained", with a 515.000 subtotal. The task text ("migrate its round") and the builder's choice follow `:578`. No defect in the code. The design conflict is unresolved and belongs in MEMORY under unresolved work, with the ruling left to the human.

**Re-derived figures for the new fixtures:** 135.000 + 30.000 + 240.000 + 2 × 40.000 = 485.000. Staff meal 10% is −48.500, leaving 436.500. Tax is 21.825, so the total is **458.325**. Adding Coffee at 35.000 gives 520.000. Both match the fixtures.

### 4. P3 — `fireblocked` does not scroll the blocking row into view at first draw

**Location:** `OrderPanel.tsx:430-433` (the only `scrollIntoView` is in the *Show* handler).

The design's `fireblocked` row (DESIGN-007 `:363` area) says the fixed notice "initially scrolls the offending row into view", and *Show Steak* restores it later. FE-022 item 7 asks only for the recovery button, and *Show* is built and tested. The initial scroll is unbuilt. It is minor, and the *Show* button covers the POS-03 question 10 recovery.

### 5. P3 — Test gaps and hygiene

- **Label and inert walk skips item sheets opened from `fire-*` origins.** The walk at `one-press-fire.test.tsx:72` renders each `ORDER_STATES` id but never passes `from`. Only the store refusal is tested from an origin (`:341`).
  - **Real path, probed:** mount `fire-ready`, press Send, open a tile. The panel behind the sheet shows a bare inert `Send to kitchen`, and the frame is `inert`. Correct.
  - **Direct load of `?state=sheet-item-steak&from=<origin>`:** `seed()` uses `ORDER_FIXTURES[view.state]`, so all 19 origins draw *default's* order behind the sheet. Only `eightysix` and `fireblocked` read inert, and that is because of `originFacts`. This is old behavior (`seed` is untouched here), but it is a fifth place the fixture and store disagree. Not caused by FE-022.
- **`fire.test.tsx` "never absent" now uses `/^Send (\d+ )?to kitchen$/`.** Alone it would accept `Send 0 to kitchen` or a wrong count. Net effect: **not loosened**, because `one-press-fire.test.tsx:72-91` pins the exact label in every state.
- **`Element.prototype.scrollIntoView = () => {}` is assigned in `fire.test.tsx` and never restored**, and `one-press-fire.test.tsx` uses `vi.fn()` in `beforeEach` without restoring it either. Later tests in the same worker then cannot notice a missing `scrollIntoView`.
- **The test titled "is the only state whose print wording changes"** now excludes `fire-failed`. The title is out of date, but the assertion is right.

## The five things asked about

1. **Changed existing tests.** Every removed assertion in the diff is one of the named ones (`git diff apps/pos/test | grep '^-'`).
   - No test, `.skip`, `.only` or `.todo` was added or removed.
   - The one weakened form is the label regex in finding 5, and it is compensated.
   - The "no other state" lists were widened for `fire-failed` and `fire-unknown`, which is legitimate because those fixtures share the banner.
   - The `fireblocked` notice test went from "no `a, button, [tabindex]`" to "no `a, [tabindex]` and exactly the `Show Steak` button". That is stricter, not looser.
   - **Verdict: nothing loosened.**
2. **Send label and inert rules.**
   - Over every `ORDER_STATES` id I found no wrong label or wrong liveness.
   - `loading` was the real defect (a live Send over a skeleton), and the builder fixed it.
   - Item sheets from `fire-*` origins are fine on the real path (finding 5).
   - Store and panel read the lock differently: the store reads `view.from ?? view.state`, the panel reads `view.state`. This is unreachable today because no lock state is an item-sheet origin, but it is the same shape as the recurring defect. Worth one shared accessor later.
3. **Live paths to printed, failed or unknown.** None. `fireOrder` writes the literal `'queued'` (`fire.ts:170`) and the store applies only that. `printed`, `failed` and `unknown` come only from fixtures. `Date` is read once, in `browserClock` (`OrderPanel.tsx:314`). `fire.ts`, `orderStore.ts` and `orderFixtures.ts` read no clock. The banner is fixture-driven and not derived from `delivery`, per ARCH-002 §2.3.
4. **Focus and `role=status`.**
   - Focus lands on the new round's heading (`tabIndex=-1`, set only at that moment) and the heading has a focus ring.
   - The status region exists before its text arrives.
   - **The clearing is wrong in the case in finding 1.** The other clearing case, adding a line, works.
   - A press that `fireOrder` refused would leave `firing` set. It is unreachable today, because `fireOff` covers every refusal.
5. **One control or value shared across states.**
   - `loading`: fixed.
   - Origin's 86 list: handled with `originFacts`.
   - Count under a lock or on an empty order: bare label, as DESIGN-007 leaves those states.
   - The status text (finding 1) is where the shape still shows.

## The builder's "Not done" items

- **`fire-heading-width` is a state in the design.** Refuted as "not a state"; see finding 2.
- **`fireerror` data:** confirmed left as it was. The design conflicts with itself (finding 3).
- **The time zone is still open (PRD §9).** `browserClock` is local `HH:MM`, and tests inject a clock. Confirmed.
- **No browser check was run.** Also a gap for the focus ring and for heading width.

## Round 2

**Verdict: approve. Finding 1 is fixed, and items C, E and F hold. Two new P3 findings, neither a blocker.** `npm run verify`: typecheck clean, 25 files, **1792 tests pass**, matching builder24's count. B and D are the lead's to measure in the browser. I read the diff and the code and made no browser check. Nothing was edited except this report.

### Finding 1 — fixed, and the status now belongs to the press

`sentRound` is set once, in the layout effect at `OrderPanel.tsx:170-175`, together with `sentGroups.current = store.order.groups`. A second effect (`:176-178`) clears it when `store.order.groups !== sentGroups.current`. I walked the questions you asked.

- **Can the fire itself clear it?** No. On the fire's own commit, effect 1 stores the new groups and effect 2 runs with `sentRound` still `undefined`. The next render has `sentRound = n` and identical groups, so nothing clears it.
  - A second fire (fire, add, fire) is ordered the same way: effect 1 runs first and updates `sentGroups`, so effect 2 sees them equal, and the status goes n → n+1 with no gap.
  - A refused fire returns `prev` (`orderStore.ts:234`), keeps the identity, and touches nothing.
- **Can a store update that is not an order change clear it early?** Yes, in theory; see new finding 1 below. In the UI I found no path.
- **Add then Remove:** the status is cleared by the Add, and it does not return on the Remove. This is the case I reproduced in round 1.

### C — confirmed

`fireblocked` and any first draw with a refusal reveal the first blocked row once, on mount (`OrderPanel.tsx:417-421`). `default` has no blocking line, so nothing scrolls. *Show <name>* scrolls the row's `li` and focuses the button with `preventScroll`. The `[]`-dependency effect fires on mount only, which is right for "when the state is first drawn". The store is also seeded once per mount, so no in-app state switch changes the order under it.

### E — confirmed

- `scrollIntoView` is saved and restored in both files. `delete` is used when jsdom had none, so a stub cannot leak (round 1, finding 5).
- The stale test title was renamed, and the control, status and banner walk now opens an item sheet from all 7 `fire-*` origins (this closes the gap in round-1 finding 5).
- `fire-heading-width` was added to the three test lists.

### F — confirmed, with a limit

`originFacts` now returns `lock`, and both the panel (`:376`) and `store.fire` (`orderStore.ts:226`) read it. The red case in the handoff builds `sheet-item-steak` from `lock-draft` by hand. `orderViewFrom` would strip that `from` (`lock-draft` is not in `ITEM_SHEET_ORIGINS`), so the divergence is not reachable through the URL. The fix is defensive, and correct as far as it goes.

## New findings

### 1. P3 — `sentRound` is cleared on groups identity, but two store helpers allocate a fresh array without changing the order

**Location:** `orderStore.ts:95-97` (`dropLine`) and `:106-111` (`rewriteQuantity`). Both always return a new array, even when the id matches nothing.

**Failure scenario:** after a fire, `?gone=<an id that is not on the order>` (a stale link, or a replay) or a second Remove on the same line in one tick makes `setData` produce new `groups` with identical content. The status line then disappears without the order changing.

I found no UI path to it. The line editor's *Update to n* is off while the draft equals the line, and Remove is offered only on pending lines. It only trips the identity rule the builder chose, and the failure is that the status goes early, which is the safer direction. **Cheapest fix:** have those helpers return `groups` itself when nothing matched. That would also make the identity rule exact.

### 2. P3 — The lock is still read from `ORDER_FIXTURES[view.state]` in three other places

**Location:** `orderStore.ts:115` (the seed's `?gone=` drop), `:195` (the post-mount `gone` guard) and `MenuRegion.tsx:49`.

Round 2 moved the panel and the fire to `originFacts`. These three still read the sheet's own state. It is the same divergence shape as round-1 review item 2, and it is unreachable for the same reason as F: no lock state is an item-sheet origin. It is a note for whoever next adds an origin that carries a lock. The clean version is one accessor that everything reads.
