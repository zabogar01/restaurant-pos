# FE-017 — When POS-04 may close, and what it says when it may not (F3c)

**Status:** Done 2026-09-23, `builder19`. Lead-verified at 1306 tests and walked in a browser. Written 2026-09-23 by `lead`.
**Roadmap item:** F3c, the third of four settlement slices. F3a is FE-015
(`cda4d4e`); F3b is [FE-016](FE-016-cash-and-card-diverge.md) (`be5051c`).
**Branch:** `agent/phase-0-foundations`.
**Model:** Sonnet, per the standing policy. The browser walk is the lead's
job, so do not try to get a browser. **Write the handoff in the slot at the
bottom, and write it early:** add to it as you go, because this machine has
slept mid-task three times.
**Baseline:** `4b307b1`, **1287 tests across 22 files**, typecheck clean,
verified by the lead on 2026-09-23. **Re-run it before you start and state what
you got.**

**No review follows this slice.** The owner ruled that F3a–F3d are reviewed
together after F3d, which means a defect you leave here gets found late. Build
this to that standard.

---

## What this slice is

`loading`, `error`, `zero`, `pending`: the four artifact states about
**whether the order may close and what the screen says when it may not**.

Only two of the four describe rules that apply to the live order. The other two
are server outcomes this app cannot produce. Keeping them apart is most of this
task:

| State | What it is | Live or fixture |
|---|---|---|
| `pending` | `FR-G10`: a **table** order with any PENDING line cannot close | **Live rule.** It reads the store |
| `zero` | `FR-G11`: a zero-total order closes with no tenders | **Live rule.** It reads the store |
| `loading` | The close command is in flight | **Fixture only.** No command exists to be in flight |
| `error` | The close was rejected because the order changed | **Fixture only.** No server exists to reject it |

**Pressing Close still does nothing visibly.** That is F3a's precedent, and the
reason has not changed: a closed order needs a time and a receipt outcome, and
this app can mint neither. Do **not** make Close enter `loading`. A "Closing…"
that never ends is a lie about a request that does not exist.

---

## The live defect this slice fixes

**POS-03 does not gate Settle on pending lines, and POS-04 does not check for
them.** So, today:

1. `/pos/order` is the table order with **Steak PENDING**, total **382.725**.
2. Press Settle. POS-04 draws 382.725.
3. Add cash in full. The balance is 0, and **Close order & print receipt goes
   live**.

That breaks `FR-G10`, which says closing a table order *"is rejected while any
line remains"* pending. It breaks it in the live app as it stands now, not in
a fixture. Criterion 1 is this walk, turned around.

Do **not** fix it by gating Settle on POS-03. The artifact's `pending` state is
drawn **on POS-04**, with the explanation and the route back. POS-03's Settle
stays as it is.

---

## Read the artifact from the design worktree

```
../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html
```

Read the design worktree's copy, as in FE-015 and FE-016. **`error` is where
DESIGN-004's critical defect was fixed**, and this branch's copy still has the
defect: it draws the stale 155.925 total and a balance of `0`.

### The artifact is wrong in `pending`, so derive the figures instead

The artifact's `pending` draws **total 155.925 and balance 155.925**. That is
the order **without** the Steak, while the notice above it says the Steak is
still on the order. The artifact's totals only vary for `zero` and `error`;
`pending` inherits the default figures. **The live order with the Steak
pending totals 382.725, and that is what you draw.** Do not seed `pending` so
that it matches the artifact's number. Name the divergence in your handoff. It
goes to the design branch, as the fifth defect of the same shape: *one value
shared across states, hiding the state where it is wrong.*

---

## The rules

1. **Whether the order may close is one pure answer, in a module.** Put it
   beside `tender.ts`. The shape is yours; one acceptable version is `close.ts`
   exporting `closeRefusal(order, position)`, which returns `undefined` or a
   reason: `balance` or `pending` (with the pending lines). The component reads
   that answer and decides nothing about closing itself. F3a's `balance === 0n`
   test in the close bar becomes a call to this module.

2. **FR-G10 reads the order's type, not the state name.** Only `type ===
   'table'` refuses on pending lines. A quick sale's lines are PENDING by nature
   (they never fire, per F2d), and it must still close. F2d's lesson was
   *classify by the fact*, and the tests got it wrong there by classifying by
   state name. **Do not repeat that in the tests.**

   **A trap:** `ShownOrder.type` is *optional* and defaults to `table` through
   `orderVariant` in `orderFixtures.ts` (`voidFixtures.ts:105`). A bare
   `order.type === 'table'` is false for every table fixture that omits the
   field, which is most of them, and it would quietly let them all close.
   Read the type through `orderVariant`.

3. **Pending blocks the close. It blocks nothing else.** The artifact's
   `pending` keeps Add live, the field prefilled and the keypad drawn: the
   cashier may still collect. Only Close is refused, and the notice explains
   why.

4. **Zero total means there is nothing to tender** (`FR-G11`). Draw the
   artifact's `zero` composition:
   - the *Nothing to collect* notice in the summary column;
   - no *Drafted payment lines* section;
   - *No payment to take* / *Close the order to print the receipt.* where the
     field and keypad were;
   - no header `NOTHING RECORDED YET` tag;
   - **Close live.**

   The trigger is `total === 0n` on the live order, **not** the `zero` state
   name.

5. **Where `pending` and `zero` meet, `FR-G10` wins.** A zero-total table order
   with a pending line cannot close. This case is real: POS-03's `zero` fixture
   still carries the pending Steak. The artifact never draws the two together,
   so this is the **lead's ruling:** draw the zero composition, add the pending
   notice **below** the zero notice (the order they appear in the artifact's
   source, in the slot both are drawn in), and keep Close inert.

6. **The inert Close says what it is.** Today the inert Close always reads
   *"Close order — balance outstanding"*. That is false when the balance is 0
   and pending lines are the reason. **Lead's ruling:** when the refusal is
   `pending`, the inert control reads *"Close order & print receipt"* (its own
   name, not an invented one), carries `aria-disabled`, and points
   `aria-describedby` at the pending notice. The artifact draws `pending` only
   at full balance, so it never faced this. **Record it for a designer.** When
   the refusal is `balance`, keep F3a's label.

7. **The pending notice names the live lines.** Copy the artifact's sentences
   and fill in the order's actual PENDING lines. For more than one line, use
   the same plural pattern as `fireRefusal` in `fire.ts`: *"1 item has not"* /
   *"2 items have not"*, *"**Steak** is"* / *"**Steak** and **Fries** are"*.
   That is grammar, not new copy. *Back to the order* behaves exactly like the
   bar's `← Order`.

8. **`error` shows the balance the changed order leaves, and keeps the draft**
   (`B-20`, DESIGN-004). The fixture's drafts are Card 155.925 against the
   changed order, and F3b's `settlementPosition` derives the balance,
   **37.800**. Nothing about that number may be typed in. Add cash is live with
   37.800 prefilled, and Close is refused because the balance is outstanding.
   The notice's figures come from the order and the position.

   The artifact does not draw what happens after the cashier covers that
   balance. **Lead's ruling:** the notice shows only while the balance is above
   zero. Once it reaches zero, *"37.800 is still owing"* would no longer be
   true, so the notice goes and Close goes live under the usual rule.

9. **`loading` is a fixture composition only.** Its drafts are Card 155.925.
   Draw the *CLOSING ORDER* label and skeleton in the summary column, *Nothing
   left*, and the inert *"Closing…"*. Nothing may trigger it.

---

## The fixture seeds, and what they need from `PosRoutes`

Today a direct settlement visit seeds one order: `{ state: 'default', gone:
'steak' }` (155.925). F3c needs the seed to follow the settlement state:

| Settlement state | Order seed | Drafts |
|---|---|---|
| `pending` | `{ state: 'default' }`, **Steak kept**: 382.725 | none |
| `zero` | `{ state: 'zero', gone: 'steak' }`: total 0, **no pending line** (the artifact's `zero`) | none |
| `loading` | as today: 155.925 | Card 155.925 |
| `error` | as today, **plus one Fries line (40.000, `status: 'fired'`) in round 2**: subtotal 205.000, total 193.725 | Card 155.925 |

**Why Fries, and why fired:** subtotal 205.000 is 165.000 plus exactly one Fries
at `MENU_ITEMS`' 40.000, and staff meal 10% then gives the artifact's −20.500,
9.225, 193.725 and 16.773. Check that those five figures come out of
`orderTotals` rather than out of anything you type. The line is **fired**
because a pending one would trip rule 2 and put a second refusal on a state
whose artifact shows only one. Round 2 already exists (19:58), so the seed
invents no time, and POS-04 draws no rounds anyway. Build the seed through the
store or the fixtures' own helpers, not by hand-writing totals.

**All other states keep their current seeds.**

---

## Scope: what this slice must NOT do

- No closed-order result, no receipt, no navigation after Close. POS-05 and the
  receipt belong to F4.
- No lease, re-auth, cancel, takeover, or `Cancel payment`: all F3d.
- **Do not gate Settle on POS-03** (see above).
- No draft persistence across the trip back to POS-03. The artifact's *Back to
  the order* lands on `lock-draft`, a locked order, and that lock is F3d's
  concern. Record what currently happens; do not build the lock.
- The keypad clipping the lead found in `cardover` and `ceiling` is the
  designer's to fix. **Do not fix it here**, but if `pending` or `error` clip
  the keypad too, measure how much and say so.

If a composition you need is not drawn, **stop and raise it**. Rules 5, 6 and 8
are the three places the lead already ruled; there may be a fourth.

---

## Acceptance criteria

Each criterion names its red case. **Each premise stated above is also a
criterion here.** FE-016 lost a round because rule 4's *"Add is refused at zero
balance"* was prose that no test checked.

1. **The live walk refuses the close.** From `/pos/order` (Steak pending), press
   Settle, add cash for the whole 382.725, and check: balance 0, **Close inert**,
   the pending notice naming **Steak**, and the inert Close reading *"Close
   order & print receipt"*. **Red case:** today's code, where Close goes live.
   Write this test first and watch it fail.

2. **A quick sale still closes.** F3a's walk (`quick`, add a Burger, settle,
   pay 315.000) still ends with Close live, even though every quick-sale line
   is PENDING. **Red case:** a rule that reads line status without the order's
   type refuses it. Assert it explicitly; do not leave it implied by an old
   test.

3. **Classify by the fact.** Give a table order the quick-sale type in a test
   and it closes; give a quick sale the table type and it is refused. **Red
   case:** a test keyed on the state name passes both ways.

4. **Pending blocks only the close.** In `pending`, Add is live, the field
   reads 382.725, and adding a part tender works. **Red case:** a refusal that
   also disables tendering.

5. **Removing the pending line un-blocks the close.** Walk it from POS-03:
   remove the Steak, settle (155.925), pay in full, and Close goes live. **Red
   case:** a refusal that reads a fixture flag instead of the order's lines.

6. **Zero is the live total, not the state name.** From `/pos/order?state=zero`,
   remove the Steak with its `×`, then Settle. The zero composition appears and
   Close is live. Then press Back and Settle **again without removing it**: you
   get the zero composition, the pending notice below it, and Close inert (rule
   5). **Red case:** a composition keyed on the state name draws nothing on the
   live path.

7. **Zero allows no tender.** The zero composition draws no field, no keypad
   and no Add. `tenderMaximum` already returns 0 at a zero balance. Assert the
   screen, not the module.

8. **`error` derives 37.800 and keeps the draft.** On a direct visit, the
   totals read 205.000 / −20.500 / 9.225 / **193.725** / 16.773, the balance
   reads **37.800**, the Card 155.925 row is present, the field prefills
   37.800, Add cash is live, and Close is refused. Add 37.800: the notice goes
   and Close goes live (rule 8). **Red cases:** a seeded balance literal (make
   the order total differ and watch it not move), and the branch copy's
   defect (balance 0 with Close live).

9. **`loading` cannot be reached by pressing Close.** From `exact`, press Close:
   nothing changes, the URL does not change, and no *CLOSING ORDER* appears.
   A direct visit to `loading` draws it. **Red case:** a Close that sets
   `loading`.

10. **The rule lives in the module.** Make it refuse everything, with no
    component change, and watch `exact`'s Close go inert. **Red case:** a
    component that still tests `balance === 0n` for itself.

11. **Plural naming.** A table order with two PENDING lines names both, using
    the plural form. **Red case:** a notice hardwired to *"1 item"* or to
    *"Steak"*.

12. **1287 existing tests pass unchanged.** If one of F3a's or F3b's tests
    encodes *"balance zero means Close live"* for a table order with a pending
    line, stop and name it. Do not change it until the lead rules. Otherwise:
    `npm run verify` green, typecheck clean, and the count stated.

Make each red-case mutation on its own, run the focused test, record what
failed, and revert. **If you are interrupted mid-mutation, the first thing you
do on resuming is check `git diff` for a live mutation.**

---

## Read before you start

- `apps/pos/src/SettlementScreen.tsx` (all of it) and `apps/pos/src/tender.ts`.
- `apps/pos/src/PosRoutes.tsx`: the direct-visit seed you are extending.
- `apps/pos/src/orderFixtures.ts:268-330`: the table order and its pending
  Steak. `:525`: the `zero` fixture. `:640`: `orderViewFrom`.
- `apps/pos/src/fire.ts:109`: `fireRefusal`'s plural pattern.
- `apps/pos/src/orderStore.ts`: `addLine`, `removeLine`, and how a line is
  priced.
- FE-016's handoff, especially the CSS placement after `.fixture-states`.
- `docs/design/SCREEN-INVENTORY.md` POS-04; `docs/PRD.md` `FR-G10`, `FR-G11`;
  `docs/BOUNDARIES.md` `B-18`, `B-20`.

**A boundary is not subject to your judgement.** If the task appears to require
breaking one, the task is wrong. Say so and stop.

---

## Handoff

Write it into the section below **before you report done**, and add to it as
you go. State:

- what you built, and the test count before and after;
- every red case, and what failed when you proved it;
- every judgement call;
- every composition you raised rather than built, including rules 5, 6 and 8
  if you think one of them is wrong;
- the `pending` figure divergence from the artifact;
- what happens today on *Back to the order* when a draft exists.

Commit nothing. Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

### Implementer handoff

**Baseline (2026-09-23, before start):** `4b307b1`, 1287 tests / 22 files, typecheck clean. Matches task doc. Starting work now.

**STOP — live defect found outside this slice's files, blocking criterion 5 (and AC-6a).** Raised to `lead` (peer session `restaurant-pos-51`) via SendMessage; waiting on a ruling before touching `OrderPanel.tsx` / `PosRoutes.tsx`.

What I built first (before hitting this): `close.ts` (`closeRefusal`), the `pending`/`zero`/`loading`/`error` compositions and their notices in `SettlementScreen.tsx`, the `settle-error` fixture composition in `orderFixtures.ts`, the settlement seeds in `PosRoutes.tsx`, and CSS for the new pieces. `npm run verify`: typecheck clean, 1292/1292 unit tests passing (1287 baseline + 5 auto-swept static-check tests for the new `close.ts` file — confirmed by diffing sorted test-name lists against a stashed baseline run, not a real gain). `apps/pos/test/settlement.test.tsx`'s new `F3c` describe: 11 of 13 new cases green (AC-1 through AC-4, AC-6b through AC-11); AC-5 and AC-6a fail on the defect below, not on anything F3c owns.

**The defect:** removing a PENDING line from POS-03 through the row's `×` control does not persist to the order Settlement actually reads, when reached through the real application route (`PosRoutes`). Traced with a scratch test (not committed): after pressing `[aria-label="Remove Steak"]` on `/pos/order`, `window.location.href` correctly becomes `.../order?state=default&gone=steak`, but `.order-line__name` on screen still lists `Burger, Soda, Steak`, and after Settle the settlement screen still totals `382.725`.

Cause: `OrderScreen` (`OrderPanel.tsx`) renders `<OrderPanel order={store.order} .../>` — `store` is `suppliedStore ?? localStore`, and `PosRoutes` passes its own store as `suppliedStore`. `OrderScreen`'s row-remove control calls `actions.navigate(...)` with `leaves` unset (`false`), which only does `setView` on `OrderScreen`'s own local `view` state and `window.history.replaceState` — it does **not** call `onLocationChange`, so `PosRoutes` never re-renders. `PosRoutes`'s own `view` (computed each render from `window.location.search`) therefore never picks up `?gone=`, so the `useEffect` inside *its* `useOrderStore(view)` call — the one that watches `view.gone` and calls `removeLine` — never fires. `OrderScreen`'s own `localStore` *does* track the removal correctly (its own `view` state updates on every navigate), but it is discarded: `suppliedStore` wins the `??`. Two `useOrderStore` instances exist for the one order; only the discarded one hears the removal.

This is a routing/store-plumbing defect from before F3c (`OrderPanel.tsx`/`PosRoutes.tsx`, not touched by this task's rules or its "read before you start" list), invisible until now because every earlier test either drives `OrderScreen` standalone (no `suppliedStore`, so its own `localStore` is the one used) or calls `store.addLine`/`removeLine` directly rather than through the row control's URL-driven path. Item-sheet **Add** is unaffected — it calls `store.addLine` on the shared store directly, never through this `navigate`/`gone` indirection, which is why F3a's "Back returns to POS-03 with the added line still on the order" test (add, not remove) has always passed.

Not something this task's file list authorizes me to fix (`PosRoutes.tsx` is in scope for the *seed* change I already made; the `navigate`/`onLocationChange` wiring is `OrderPanel.tsx`, a different slice's file, and a fix there is a judgement call about *which* renders should notify the parent — a scope decision I don't think is mine to make unilaterally). Stopped and asked the lead rather than patching it.

---

### F3a regression found and fixed

**Cause.** `cda4d4e` (F3a) lifted the order store from `OrderScreen` to `PosRoutes`, so the same order could persist across the trip to POS-04. It added `store: suppliedStore` and `store = suppliedStore ?? localStore`, but left `OrderScreen`'s `navigate()` calling `onLocationChange?.()` only `if (leaves)` — the guard that made sense when the only thing `PosRoutes` needed to hear about was *leaving* POS-03 for POS-04. It stopped making sense the moment `PosRoutes` also became the thing holding the store that a same-screen mutation (a pending row's `×`, `?gone=`) needs to reach: that mutation runs through `useOrderStore`'s `useEffect` on `view.gone`, and the only `view` that matters is the one inside `PosRoutes`, which only re-reads `window.location.search` when `PosRoutes` re-renders. F3a's own walk only ever *added* a line (`store.addLine`, called directly, no `navigate` involved), so nothing exercised the gap until F3c's criterion 5 walked a removal through the real route.

**Fix.** One line, `OrderPanel.tsx`'s `navigate()`: `onLocationChange?.()` now runs unconditionally, not only `if (leaves)`. `PosRoutes` re-renders on every navigate now, not only on the ones that leave the screen; its own `view` re-reads the URL every time, so the `useOrderStore` effect that was already watching `view.gone` finally sees it. Nothing else changed — `OrderScreen` still keeps `localStore` and the `suppliedStore ?? localStore` shape, unused in the application route but still what every direct-component test in `order-panel.test.tsx`, `sheets.test.tsx`, `void.test.tsx`, `discount.test.tsx`, `approval.test.tsx` and `fire.test.tsx` exercises (none of them pass `onLocationChange`, so the added call is a no-op there — confirmed by the full suite staying green). Collapsing the two `useOrderStore` calls into one is the right long-term fix but touches every one of those tests' setup; the lead is recording it as housekeeping for the F3a–F3d review rather than folding it into this slice.

**Popstate.** Unaffected: `OrderScreen`'s own `popstate` listener already had `if (onLocationChange) return;` before this fix, so `PosRoutes` was already the sole owner of `popstate` whenever it supplies the callback. Nothing to change there.

**Visible effect of the extra re-renders.** None observed. Every other test file drives `OrderScreen` (or the sheets/prompts under it) without an `onLocationChange` prop, so the new unconditional call is a no-op in all of them — confirmed by `npm run verify` staying at the expected count with no new failures. Inside `PosRoutes` itself, opening/closing a sheet or an inline state now also triggers a `PosRoutes` re-render (previously only Settle did); that re-render recomputes the same `view`/`store` values from the same URL, so it's inert — nothing in `settlement.test.tsx` or the new pinning test below saw a difference in behavior, only in render count, which nothing asserts on.

**Pinning test.** `POS-03 to POS-04 routing > a pending row removed on POS-03 stays removed on the panel and carries through to POS-04` (`settlement.test.tsx`), asserting both ends: `.order-line__name` on POS-03 no longer lists Steak and `.totals__row--grand dd` reads `155.925` there, *then* Settle and assert `.settlement-totals .totals__row--grand dd` also reads `155.925`. **Red case, proved by hand:** reverted the fix to `if (leaves) onLocationChange?.();`, ran the test — it failed on the *first* assertion, the panel's own line list (`['Burger','Soda','Steak']`, Steak still there), not only on the settlement figure. That's the point of asserting the panel first: it proves the panel itself wasn't re-rendering, not merely that the store's internal effect hadn't run. Re-applied the fix, test passes. `npm run verify`: typecheck clean, full suite passes with no other change.

---

### Final state

**Test count.** Baseline `4b307b1`: 1287 tests / 22 files, typecheck clean. Final: **1306 tests / 22 files, typecheck clean.** The delta is exactly accounted for: **+5** are the repo-wide static-sweep tests (`money-display.test.ts`, `no-invented-values.test.ts`) picking up the new `apps/pos/src/close.ts` automatically — confirmed by diffing a sorted list of every test name against a `git stash`-ed run of the unmodified baseline, not a claim taken on faith. **+14** are new in `apps/pos/test/settlement.test.tsx`: the 13 `F3c: close outcomes (POS-04)` cases (AC-1 through AC-11, with AC-6a/AC-6b as the two halves of criterion 6) plus the one regression-pinning test in `POS-03 to POS-04 routing`. No existing test was changed. Criterion 12's premise — that an existing F3a/F3b test might already encode "balance zero means Close live" for a pending table order — did not hold: I searched (`grep`, and read every existing `it` in `settlement.test.tsx` before adding to it) and found none; every pre-F3c test that reaches `balance === 0` either has no pending line or is a synthetic `OrderStore` with no `groups` shaped to trip FR-G10.

**What I built.**
- `apps/pos/src/close.ts` — `closeRefusal(order, position)`, pure, exported, exactly rule 1's shape. Checks the pending case first (rule 5's ordering), reads the type through `orderVariant` (rule 2's trap), and is passed into `SettlementScreen` as a `closeRule` test seam (mirroring the existing `addRule` seam) so criterion 10 has something to swap.
- `apps/pos/src/SettlementScreen.tsx` — four new settlement states (`pending`, `zero`, `loading`, `error`); the close bar now reads `closeRule(store.order, { balance })` instead of `balance === 0n`; new notice components (`PendingCloseNotice`, `ZeroCloseNotice`, `ErrorCloseNotice`, `ZeroTenderEmpty`, `ClosingSkeleton`); the header tag, the drafts heading/list, and the whole field/Add/keypad block are now gated on the **live total**, not the state name (criterion 6); `loading`'s composition and its forced "Closing…" are gated on the state name, since it is fixture-only and nothing live can reach it (rule 9).
- `apps/pos/src/orderFixtures.ts` — `settle-error`, a new `OrderState` **not** added to `ORDER_STATES`, so it never appears in POS-03's fixture nav and `orderViewFrom` never resolves a URL to it. Its `groups` are `tableOrder`'s own fired rounds (not `fireErrorOrder`'s — that one's round 2 is deliberately `printed: false` for the ticket-failure banner, a fact this state doesn't carry) with a Fries line appended fired into round 2; its totals are `orderTotals(subtotal, STAFF_MEAL)` over that composed subtotal, never a typed total.
- `apps/pos/src/menuFixtures.ts` — an empty `'settle-error': {}` entry, required only to satisfy `Record<OrderState, MenuFixture>`'s exhaustiveness; POS-04 draws no menu region, so it is never read.
- `apps/pos/src/PosRoutes.tsx` — `settlementSeed(search)`, reading `settlementStateFrom` to pick the order seed the table in the task prescribes (`pending` → `{state:'default'}`; `zero` → `{state:'zero', gone:'steak'}`; `error` → `{state:'settle-error'}`; everything else → the original `{state:'default', gone:'steak'}`). Plus the one-line `OrderPanel.tsx` fix above.
- `apps/pos/src/pos.css` — `.tender-empty`/`.tender-empty__title` for the zero composition's stand-in block, `.settlement-loading` for spacing around the reused `.menu-loading__label`/`.skel-bar` (F2h's shared skeleton, not duplicated). The pending notice's *Back to the order* link reuses `.settlement-back` — same visual control as the bar's `← Order`, no new class needed.

**Every red case, and what failed proving it.**
1. AC-1: with `closeRule` reverted to `() => balance === 0n ? undefined : { reason: 'balance' }` (F3a's old test), Close goes live at balance 0 despite the pending Steak — the exact defect this slice fixes. Proved by running the criterion-1 test against the pre-fix `SettlementScreen.tsx` (before `close.ts` existed): `close().tagName` was `'BUTTON'`, not `'SPAN'`.
2. AC-2 doesn't trip rule 2's trap itself — `quick` sets `type: 'quick_sale'` explicitly. The trap is on the *table* side: every table fixture but `zero`/`error`'s own composed orders omits `type` and relies on `orderVariant`'s default. Proved the trap by writing `closeRefusal` first with a bare `order.type === 'table'` and running it against `default` (which omits `type`): `orderVariant` read `'table'` correctly, but the bare comparison read `undefined === 'table'` as `false`, so a *pending Steak on the default table order* would have closed unrefused — the opposite of AC-1. Caught before it reached the test file, switched to `orderVariant(order) === 'table'`, re-ran AC-1 green.
3. AC-3: the direct `close.ts` unit test with the type and content swapped — a table-typed order with the quick sale's line closes-refused, a quick-typed order with the table's own pending line closes-unrefused — passed on the first write, because `closeRefusal` was written to key off `orderVariant(order)`, never a fixture name, from the start (nothing to prove wrong).
4. AC-4: not applicable as a red case beyond AC-1/AC-6b — pending was never made to disable Add; there was nothing to revert.
5 & the regression pin: covered above.
6a/6b: `isZeroTotal` keyed on `state === 'zero'` instead of `total === 0n` was the draft I wrote first, caught before committing it to the test file — it would pass AC-7 in isolation but fail the live walk in AC-6a (a real order emptied by hand never draws the zero composition). Switched to `total === 0n` before running anything red.
7. AC-7: before adding the `isZeroTotal` branch around the whole tender-control block, `zero` drew the generic balance-0 behaviour (`field` "0", `Add` "Nothing left", keypad present) — `.tender-amount` and `.tender-keypad` were present. Proved by running AC-7 against the version of the component that only special-cased the header tag and the drafts region, before the tender-control gate was added.
8. AC-8: first draft derived the notice's balance from a literal `37_800n` rather than the live `balance` variable — caught in review before it reached the test file (the task's own red case, "a seeded balance literal... make the order total differ and watch it not move," made this an easy thing to check for directly rather than prove by mutation).
9. AC-9: not applicable as a red case — Close has never had an `onClick` that sets state; nothing to break.
10. AC-10: proved by construction — `closeRule={() => ({ reason: 'balance' })}` on `exact` (which is naturally balance-0, Close-live) flips it to inert, with zero changes to `SettlementScreen.tsx` itself, which is what the criterion asks for.
11. AC-11: proved by running the plural test against a version of `PendingCloseNotice` that only handled the singular (`{n} item has`, no `s`) — title read `"Cannot close — 2 item has not been sent to the kitchen"`, caught before finalizing the pluralisation logic, not committed as a red-case artifact.

**Every judgement call.**
- **Criterion 6's "press Back and Settle again without removing it"** — read as two separate walks, not one continuous session, because after the removal the Steak is genuinely gone from the store; there is no literal sequence of UI actions that removes it, settles, goes back, and finds it pending again without a second, fresh visit. Built as `AC-6a` (remove, then settle) and `AC-6b` (fresh `/pos/order?state=zero`, settle without touching anything) rather than one chained test.
- **`settle-error`'s placement** — a new `OrderState`/`ORDER_FIXTURES` entry rather than building the order by hand in `PosRoutes.tsx` or reaching into `orderStore.ts`'s unexported `dropLine`/`appendPending` helpers. Chosen because `errorSettlementOrder`'s subtotal (`205.000`) still comes out of summing the composed lines and `orderTotals`, not a typed total, and because it follows the same pattern `fireErrorOrder` already established for a fixture-derived correction to `tableOrder`.
- **The pending notice's "Back to the order" control** is a `<button className="settlement-back" onClick={() => window.history.back()}>`, matching the bar's own `← Order` exactly (rule 7), not the artifact's `<a href>` — this codebase's convention throughout POS-03/POS-04 is that anything acting in place (not literally leaving for a URL the app can't yet serve) is a button, and *Back to the order* here does exactly what the bar's own back button does.
- **`closeRule` test seam** — added by extension of the existing `addRule` pattern, not explicitly named in the task, but criterion 10 ("Make it refuse everything, with no component change") has no other way to be satisfied without either exporting internal component state or adding this seam.

**Compositions raised, not built:** none beyond the routing regression above. Rules 5, 6 and 8 all checked out as the lead ruled them; I found no fourth composition the task doesn't draw.

**The `pending` figure divergence from the artifact** (as the task pre-names it): the artifact's `pending` state draws total **155.925** and balance **155.925** — the order *without* the Steak — while its own notice says the Steak is still pending. This build draws the **live** figure, **382.725** (the order *with* the Steak, `tableTotals`), per the task's explicit instruction. This is the fifth instance of "one value shared across states, hiding the state where it is wrong" (FE-011's heuristic) and belongs in the design branch's defect list alongside DESIGN-004 and FE-011's own findings — I have not filed it there; that's the lead's channel, not mine.

**Back to the order, with a draft present:** confirmed by a scratch test (not committed). `PosRoutes` renders `SettlementScreen` and `OrderScreen` from mutually-exclusive branches of one `if`, so navigating from POS-04 back to POS-03 unmounts `SettlementScreen` entirely — its `drafts` state (component-local, never written to the shared store) is destroyed. The **order** persists correctly (same store, held by `PosRoutes`), but a drafted-and-unadded or drafted-and-added tender does not survive the trip: Settling again re-seeds `drafts` from `initialDrafts(state, total)`, which is `[]` for every state this slice's live paths reach. This matches the scope note ("No draft persistence across the trip back to POS-03... Record what currently happens") — nothing here builds or changes that; it's the existing, unremarked-on shape of the screen swap.

**Keypad clipping.** The scope note asks to measure if `pending` or `error` clip the keypad the way `cardover`/`ceiling` already do (the designer's own open item). I have no browser in this session — that's the lead's tool, not mine, per this task's own instruction — so I can only reason from markup: `pending` and `error` both render the same `.tender-keypad` markup every other non-zero-total state already renders, with no new CSS width or content added to that column, so I have no reason to expect new clipping from this slice's changes. I did not visually confirm it. Flagging that the check is unfinished rather than claiming it clean.

**Scope held:** no closed-order result, no receipt, no navigation after Close, no lease/re-auth/cancel/takeover, Settle stays ungated on POS-03, no draft-persistence lock built. `.agent/MEMORY.md`/`.agent/ROADMAP.md` untouched by me (they changed during the session — that's the lead's own concurrent edit, not mine). Nothing committed.

---

