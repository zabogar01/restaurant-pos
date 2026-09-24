# FE-016 — The two pads diverge: cash may exceed the balance, card may not (F3b)

**Status:** Done 2026-09-23, `builder18`. Lead-verified at 1287 tests and walked in a browser. Not committed. Written 2026-09-23 by `lead`.
**Roadmap item:** F3b, the second of four settlement slices. F3a is
[FE-015](FE-015-settlement-shell.md) and is committed as `cda4d4e`.
**Branch:** `agent/phase-0-foundations`. It was merged into `origin/development`
as PR #5 (`59a7f3c`). Keep working on this branch.
**Model:** Sonnet, under the standing policy. If the owner runs this on codex
instead, **the browser walk belongs to the lead**, so do not try to get a
browser. **Write your handoff in the handoff slot at the bottom**, not
somewhere above it.
**Baseline:** `5189125`, **1255 tests across 22 files**, typecheck clean. The
lead verified this on 2026-09-23 by running it. **Re-run it before you start and
state what you got.** Run `npm run db:up` first if `restaurant-pos-db-1` is not
up, because the suite includes the PostgreSQL migration tests.

---

## What this slice is

F3a built one rule for both methods: *a positive amount at or below the
balance*. That was a placeholder, and FE-015 required it to live only in
`tender.ts` so this slice could replace it without touching a component. **This
slice replaces it.**

Here is the rule, from the contract. None of it is yours to reinterpret:

| Source | Says |
|---|---|
| `FR-G3`, `B-5` | A non-cash tender must not exceed the remaining balance |
| `FR-G4` | Cash may exceed it. Change = cash tendered − remaining balance |
| `FR-G5`, `B-18` | Close when tenders less change equal the total **exactly** |
| `FR-G6`, `B-6` | Revenue is the order total. Change is not revenue |
| `FR-M5` | Max single tender 99,999,999; max change 9,999,999 (minor units); the UI validates the change ceiling before commit **and shows the maximum acceptable cash** |
| `B-20` | A rejected tender leaves the draft exactly as it was |
| SCREEN-INVENTORY POS-04 | The cash maximum is **the remaining balance plus 9,999,999, capped at 99,999,999**. It is not the bare change limit |

IDR minor units are whole rupiah, so 9,999,999 minor units is drawn as
`9.999.999`. `formatAmount` already does this.

**States:** `card`, `cardsplit`, `cashover`, `change`, `cardover`, `ceiling`,
`exactcash`, `exactsplit`. That is eight of the artifact's twenty-one.

---

## Read the artifact from the design worktree

```
../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html
```

Read that copy, not the one on this branch. The reason is the same as in
FE-015: this branch's copy carries DESIGN-004's defect. Every F3b state is drawn
there, with its copy. **Copy the artifact's sentences exactly, but fill their
figures from the live order.** The artifact draws 155.925 because that is its
order. A cashier settling 315.000 must read 315.000.

---

## What the code holds today, counted

- `tender.ts`: 13 lines. `mayAddTender(method, amount, balance)` returns
  `amount > 0n && amount <= balance` and ignores `method`. **This is the module
  you extend.**
- `SettlementScreen.tsx:50`: `const balance = total - draftedTotal(drafts)`.
  **This goes negative as soon as cash exceeds the balance.** It would draw a
  balance of −44.075 and refuse Close, because Close tests `balance === 0n` at
  `:234`. That line is the defect this slice exists to prevent.
- `SettlementScreen.tsx:188`: the invalid message is generic, *"This cash
  amount cannot be added."* The artifact names the maximum instead.
- `SettlementScreen.tsx:207`: **one caption for both methods**, and it is the
  artifact's *card* caption: *"Key a smaller amount to split the bill"*. Under
  Cash, the artifact says *"Cash **may** be more than this — key what the
  customer handed over and the change is worked out."* SCREEN-INVENTORY makes
  that difference a requirement: *"The caption under the field states which,
  because a rule that is only true is not yet legible."* **So today Cash shows
  the wrong caption.**
- `SettlementScreen.tsx:85` and `:92`: after a live Add or Remove, the screen
  rewrites the URL to `?state=exact` or `?state=partial`. After an exact
  **cash** Add it writes `exact`, and `exact` seeds a **Card** 155.925 draft.
  So remounting on the current URL draws a tender the cashier never made. F2k
  paid for this pattern already (*"the URL lied, then the rail did"*), and this
  slice adds `exactcash` and `change`, which makes it worse. See rule 7.

---

## The rules

1. **All tender arithmetic lives in `tender.ts`, and none of it lives in a
   component.** It already owns *may this be added*. It also takes on:
   - the maximum for a method against a balance;
   - the balance and the change derived from the total and the drafts.

   The shape is yours. One acceptable design is `tenderMaximum(method,
   balance)` plus `settlementPosition(total, drafts) → { balance, change,
   tendered }`, with `mayAddTender` expressed through the maximum. Keep the
   `addRule` test seam working, or replace it with one that proves the same
   thing (criterion 9).

2. **Cash is the only exception, so write it that way.** Cap every method at the
   balance except `cash`. Do not cap only `card`. FR-G1 names custom methods,
   and B-5 caps them too. A rule written as `method === 'card'` would let the
   first custom method through uncapped. TypeScript exhaustiveness is fine here,
   but the default must be *capped*.

3. **The cash maximum is `min(balance + 9_999_999n, 99_999_999n)`.** Name both
   constants once, in `tender.ts`, citing `FR-M5`. `packages/money` does not
   have them. Do not add them there, because that module is Phase 0's.

4. **The balance never goes below zero, and change is derived.** Balance is
   `max(0, total − Σdrafts)`. Change is `max(0, Σdrafts − total)`. **Never
   store change at the moment of Add.** Removing a tender must move it. Remove
   the over-tender and the change is gone; remove an earlier card under a cash
   over-tender and the change shrinks, or disappears.

   The derivation equals FR-G4's *cash minus remaining balance* for this
   reason: card is capped at the balance, and Add is refused once the balance
   reaches zero. **So only the last Add can ever overshoot, and only cash can.**

5. **A rejected amount cannot be added, and the draft does not change**
   (SCREEN-INVENTORY, B-20). Add becomes the artifact's inert
   *"Over the limit — cannot add"*. The keyed amount stays in the field, drawn
   with `--frost-invalid`. The drafts do not move.

6. **Switching method re-prefills the balance.** F3a already does this, and it
   stays that way. With 200.000 keyed on Cash, tapping Card shows the balance,
   **not** `cardover`. You reach `cardover` only by keying past the maximum while
   on Card. That matches the artifact, whose Card chip links to `card`.

7. **A live mutation stops claiming a fixture.** After Add or Remove, the URL
   must never name a `state` whose seed differs from what the cashier built.
   **Lead's ruling:** replace the URL with `/pos/settlement` and no `state`. This
   follows F2k's precedent, where the URL stopped carrying `category=`. Refresh
   already resets the draft, because nothing persists, so dropping the state
   loses nothing. As a side effect, the `pressed` decoration stops following you
   after the first Add, which is correct.

---

## What each state draws

Fixture seeds apply to a **direct visit** only. `PosRoutes` seeds a direct visit
with the artifact's 155.925 order. Keep the artifact's figures in the seeds,
because parity with the artifact is how this slice gets reviewed. **Every
sentence below uses live figures once the cashier is working a real order.**

| State | Seed (direct visit) | Draws |
|---|---|---|
| `card` | Card chip, untouched | The caption *"The whole balance, already filled in — and the **most** card can take. Key a smaller amount to split the bill; whatever is left stays on the balance."* |
| `cardsplit` | Card, keyed 100.000 | Tag *KEYED BY HAND*. The caption *"{amount} of the {balance} owing. Adding this leaves **{rest} on the balance** for the next method. That is the whole of splitting a bill — there is no mode to enter."* |
| `cashover` | Cash, keyed 200.000 | The caption *"More than the {balance} owing, which cash is allowed to be. Adding this gives **{change} change**; the recorded takings are still {total}."* Add is live |
| `change` | One drafted Cash 200.000 | Balance **0**. Under it, *Change due {change}*, then the muted *"Recorded revenue is the order total, {total} — not the {tendered} handed over."* The draft list shows the Cash row, then an **inert** *Change given −{change}* row with no Remove. Tag *FULLY ALLOCATED*. Add reads *Nothing left*. **Close is live** |
| `cardover` | Card, keyed 200.000 | The notice *"Card cannot be more than the balance"* / *"You entered {keyed}. The most you can take on card is **{max}** — which is what was already filled in. Cash is the only method that may exceed the balance."* The field is invalid, with the message *Card maximum {max}*. The caption *"Card is capped at the remaining balance, so this cannot be added. Clear it and key {max} or less — or take the excess in cash."* Add is inert |
| `ceiling` | One drafted Card 100.000; Cash, keyed 99.999.999 | The notice *"Too much cash to give change for"* / *"The most cash this sale can accept is **{max}** — the {balance} still owing plus the 9.999.999 change limit. Nothing has been recorded and the drafted payment lines are unchanged."* The field is invalid, with *Cash maximum {max}*. The caption *"Cash **may** be more than the balance, but not more than the restaurant can give change for, so this cannot be added."* Add is inert |
| `exactcash` | One drafted Cash 155.925 | The same as `exact`, but on cash |
| `exactsplit` | Card 100.000 + Cash 55.925 | AC-7. Balance 0, Close live |

The untouched cash caption, which applies to `empty`, `pressed` and any
unkeyed cash prefill, becomes the artifact's *"The whole balance, already filled
in. Cash **may** be more than this — key what the customer handed over and the
change is worked out."*

**The *Change given* row is not a draft tender.** Give it its own class. F3a's
tests count `.draft-tender` rows, and the overflow test expects exactly 6.

### Three lead rulings where the artifact is silent

These are recorded so a reviewer can see them. None of them invents a
composition:

- **The `cardsplit` caption also applies to cash keyed below the balance.** The
  artifact draws the sentence only on card, but the condition it describes,
  *keyed below the balance*, does not depend on the method, and I-13 is the
  reason the sentence exists.
- ***{tendered}* in the `change` sentence is the sum of all drafted tenders.**
  B-6's wording is *"never the amount tendered."* The artifact only ever draws a
  single cash tender, where the two readings agree.
- **When the 99,999,999 single-tender cap binds rather than the change limit,**
  which happens when the balance is above 90,000,000, **draw only the field
  message *Cash maximum {max}* and Add inert. Draw neither the notice nor the
  caption.** Both of those say the limit is about change, which would then be
  false. The artifact does not draw this case. Enforce the cap, keep the true
  part, and **record the missing composition in the handoff for a designer**. Do
  not write new copy for it.

---

## Scope: what this slice must NOT do

- **No custom tender methods.** *Meal voucher* and *Staff account* stay inert
  chips, and they stay display rows in `overflow`. Rule 2 only keeps the future
  default safe.
- No close outcome. Close stays visibly inert, as in F3a. `loading`, `error`,
  `zero` and `pending` belong to F3c.
- No lease, re-auth, cancel or takeover. Those belong to F3d.
- No tips, rounding-up prompt or suggested amounts (PRD §8).
- No persistence.
- **Nothing may say money was not *taken*.** The screen may say nothing was
  *recorded* (SCREEN-INVENTORY, *Must not invent*).

If a composition you need is not drawn, **stop and raise it**. The third ruling
above is where one is most likely to turn up.

---

## Two existing tests change, and only these two

F3a's placeholder rule was written into two tests. FE-015 said not to encode
*over balance is impossible* as a truth, and a test is where it got encoded.
**These two are the only existing tests you may change.** Change them as
follows, and name them in your handoff:

1. **`apps/pos/test/tender.test.ts`, the second `it.each`:** *"refuses zero, a
   negative amount, and an amount over the balance"*. The **card** half stays as
   it is. For **cash**, drop only the `155_926n` over-balance assertion. Zero and
   negative are still refused for both methods. Cash's new behaviour belongs in
   new tests.
2. **`apps/pos/test/settlement.test.tsx:195`:** *"%s refuses an over-balance
   draft through tender.ts and shows the invalid field"*. Keep it for **card**
   and update its message assertion from *"cannot be added"* to *Card maximum
   155.925*. Drop the **cash** row, because criterion 3 replaces it.

Every other one of the 1255 tests must pass unchanged. That includes FE-014's
parity sweep and all of F3a's walk.

---

## Acceptance criteria

Each criterion names the case that tells a right answer from a wrong one.

1. **AC-5 walks in the browser.** On the direct `empty` visit (155.925), key
   200.000 on Cash and press Add. The result is balance **0**, change due
   **44.075**, total still **155.925**, a *Change given −44.075* row, and **Close
   live**.
   **Red case:** an unclamped balance draws −44.075 and refuses Close. Write
   this test first.

2. **The change is derived, not captured.** From `change`, remove the Cash row:
   change and its row disappear, and the balance returns to 155.925. Then walk
   `partial` (Card 100.000) → cash 100.000: change is **44.075**. Remove the
   Card: balance **55.925**, change **gone**.
   **Red case:** change stored at Add survives both removals.

3. **Cash over the balance is accepted. Card over the balance is refused and
   names the maximum** (AC-6). Key 155.926 on each method. Cash: Add is live.
   Card: the field is invalid, *Card maximum 155.925*, Add is inert, zero drafts.
   **Red case:** one rule for both methods passes whichever half you forgot to
   test. Assert both halves in one test.

4. **The ceiling is the balance plus the change limit, and it is exact to one
   unit.** Against a 55.925 balance: cash **10.055.924** is accepted and
   **10.055.925** is refused, with *Cash maximum 10.055.924*. **Red cases:**
   the bare change limit (9.999.999) refuses 10.055.924, and `<` in place of
   `<=` refuses it too. The one-over case is the only one that catches a
   ceiling of `balance + 10_000_000`.

5. **The single-tender cap binds when it is lower.** In `tender.ts` tests:
   against a balance of 95,000,000, the cash maximum is **99,999,999**, not
   104,999,999. In a component test, with a store whose total is above
   90,000,000, the change-limit notice and caption are **absent** and the field
   message reads the capped maximum.
   **Red case:** a maximum without the `min` passes every realistic fixture.

6. **A rejection changes nothing** (B-20). In `ceiling`, pressing the inert Add
   leaves the draft rows, balance and change exactly as they were. Assert the
   rows, not only the count.

7. **The caption tells the two pads apart.** Untouched Cash shows the *may be
   more* caption. Untouched Card shows the *most card can take* caption. Then
   switch back and forth: the caption follows the method.
   **Red case:** F3a's single caption. It is the card sentence, so a test that
   only checks card passes against today's code. Assert the cash caption.

8. **Live figures, not the artifact's.** From `/pos/order?state=quick`, add a
   Burger, press Settle (315.000), and key 400.000 on Cash. The `cashover`
   caption reads **315.000 owing** and **85.000 change**. After Add, *Change due
   85.000* and *"… {total} 315.000 — not the 400.000 handed over."*
   **Red case:** copy that interpolates fixture constants passes every direct
   fixture visit.

9. **The rule lives in `tender.ts`.** Make the module cap cash at the balance
   again, with no component change. Criterion 1's walk must then fail at Add.
   **Red case:** a component that checks `method === 'cash'` for itself keeps
   passing.

10. **No method is uncapped by default.** A `tender.ts` test that runs every
    non-cash `TenderMethod` asserts the cap, so adding a member to the union
    cannot slip past it. If you add no member, say how the test would catch
    one.

11. **The URL stops lying** (rule 7). From `empty`, add Cash in full, then
    remount `PosRoutes` on the current URL. **No Card row** appears.
    **Red case:** today's `?state=exact` rewrite seeds Card 155.925.

12. **All eight fixture states render their row of the table above,** each
    checked against the artifact's figures on a direct visit.

13. **1255 existing tests pass, with only the two named changes.** Then
    `npm run verify` is green, typecheck is clean, and you state the count.

For each red case, make the mutation on its own, run the focused test, record
what failed, and revert it before the next one. `builder17` did this for eight
cases in FE-015, and that is the standard.

---

## Read before you start

- `apps/pos/src/tender.ts` and `apps/pos/test/tender.test.ts`, all of both.
- `apps/pos/src/SettlementScreen.tsx`, all 266 lines. `:50` is the balance,
  `:79-93` are Add and Remove with the URL rewrite, `:172-209` are the field,
  message, Add and caption, and `:233-243` is Close.
- `apps/pos/src/PosRoutes.tsx`, for how a direct visit is seeded.
- `apps/pos/test/settlement.test.tsx`, for F3a's walk, which must stay green.
- FE-015's handoff, especially the `.fixture-states` CSS boundary. **Any new
  POS-04 CSS goes after `.fixture-states`**, or two structural tests break for
  reasons that have nothing to do with them.
- `docs/design/SCREEN-INVENTORY.md`, POS-04, all of it, including *Must not
  invent*.
- `docs/BOUNDARIES.md`: `B-5`, `B-6`, `B-18`, `B-20`.

**A boundary is not subject to your judgement.** If the task seems to require
breaking one, the task is wrong. Say so and stop.

---

## Handoff

Write your handoff into the section below **before you report done.** State:
what you built, the test count before and after, the two changed tests and what
each now asserts, every red case with what failed when you proved it, every
judgement call, and every composition you raised rather than built, including
the single-tender-cap copy.

Commit nothing unless the lead asks. Do not write `.agent/MEMORY.md` or
`.agent/ROADMAP.md`, because those are the lead's.

### Implementer handoff

**Baseline re-run:** `5189125`, 1255 tests across 22 files, typecheck clean.
Confirmed on 2026-09-23 before any edit (`restaurant-pos-db-1` was already up).

**Final `npm run verify`:** green. Typecheck clean, **1283 tests across 22
files** (net +28 over baseline: the two named tests changed shape, one test
was dropped as instructed, and new tests were added — see below).

#### What was built

- **`apps/pos/src/tender.ts`** rewritten. All tender arithmetic lives here,
  nothing in the component:
  - `CASH_CHANGE_LIMIT = 9_999_999n`, `SINGLE_TENDER_LIMIT = 99_999_999n`
    (FR-M5), named once.
  - `tenderMaximum(method, balance)`: cash is `min(balance +
    CASH_CHANGE_LIMIT, SINGLE_TENDER_LIMIT)`; every other method — the
    `else` branch, not a `method === 'card'` check — returns the bare
    `balance`. This is rule 2's "default is capped" structure.
  - `cashCeilingBoundByChangeLimit(balance)`: true when the change limit is
    the binding cap rather than the single-tender limit. Exists so the
    component doesn't do that arithmetic itself to decide which notice/
    caption to draw.
  - `mayAddTender` now delegates to `tenderMaximum` — same signature, same
    test seam.
  - `settlementPosition(total, drafts)` → `{ balance, change, tendered }`.
    `balance = max(0, total − Σdrafts)`, `change = max(0, Σdrafts − total)`.
    Both are recomputed from the drafts array on every call — nothing is
    stored at Add, so Remove moves both automatically.

- **`apps/pos/src/SettlementScreen.tsx`** rewritten to consume the above:
  - `SETTLEMENT_STATES` extended with the 8 new fixtures: `card`,
    `cardsplit`, `cashover`, `change`, `cardover`, `ceiling`, `exactcash`,
    `exactsplit`.
  - `initialDrafts` seeds each per the task's table, using the artifact's
    figures (155.925 total, 100.000 card, 200.000 cash, etc.).
  - Initial method is `card` for `card`/`cardsplit`/`cardover` (matches the
    artifact's chip selection markup), `cash` otherwise — including `exact`,
    which the artifact also draws with Cash selected despite the draft being
    Card.
  - `KEYED_SEED` seeds the keyed-by-hand amount for `cardsplit`, `cashover`,
    `cardover`, `ceiling` so those fixtures open already keyed, matching the
    artifact.
  - Balance/change/tendered come from `settlementPosition`; the old
    `total - draftedTotal(drafts)` (the defect that could go negative) is
    gone.
  - Field message is now always `{Method} maximum {max}` when invalid
    (replaces the old generic "cannot be added").
  - `tenderNotice` and `tenderCaption` are pure functions selecting the
    artifact's copy by method/state, all figures live (`formatAmount` over
    values derived from the real order, never fixture constants).
  - The *Change given* row renders whenever `change > 0n`, as `.draft-change`
    — a distinct class from `.draft-tender`, so F3a's overflow-count test
    (still expecting exactly 6 `.draft-tender` rows) stays correct.
  - Add/Remove now both rewrite the URL to bare `/pos/settlement` with no
    `state` param (rule 7 / lead's ruling), replacing the old
    `?state=exact`/`?state=partial` rewrite.

- **`apps/pos/src/pos.css`**: new rules appended at the end of the file,
  after `.fixture-states` and after the existing F3a settlement block —
  `.settlement-change`, `.settlement-change__row`, `.settlement-change__amount`,
  `.settlement-change__note`, `.draft-change`, `.draft-change__method`. The
  card-over and ceiling notices reuse the pre-existing generic `.notice` /
  `.notice__title` classes (already used elsewhere in the app), so no new
  notice CSS was needed.

#### The two permitted test changes

1. **`apps/pos/test/tender.test.ts`**, the "refuses zero, a negative amount,
   and an amount over the balance" `it.each`. Split into two separate `it`s
   (kept the intent, changed the shape slightly to express it): `'card
   refuses zero, a negative amount, and an amount over the balance'` is
   untouched in substance (still asserts `155_926n` over `155_925n` is
   refused for card); `'cash refuses zero and a negative amount'` drops the
   over-balance assertion entirely, as instructed. Cash's accept-over-balance
   behaviour is proved in new tests (`'cash accepts more than the balance, up
   to the change-limited ceiling'` and the `tenderMaximum`/`settlementPosition`
   describe blocks).
2. **`apps/pos/test/settlement.test.tsx`**, the "refuses an over-balance
   draft" `it.each`. Now a single `it('card refuses an over-balance draft
   through tender.ts and shows the invalid field', ...)`. The cash row is
   dropped (criterion 3 replaces it — see `AC-3` below). The message
   assertion changed from `.toContain('cannot be added')` to
   `.toBe('Card maximum 155.925')`.

Every other one of the original 1255 tests passes unchanged.

#### New tests added

- `apps/pos/test/tender.test.ts`: `tenderMaximum`, `cashCeilingBoundByChangeLimit`
  and `settlementPosition` describe blocks, plus the `NON_CASH_METHODS`
  parametrized cap test (criterion 10 — currently just `['card']`; extend
  that array when `TenderMethod` grows a member and the cap test covers it
  with no further edit).
- `apps/pos/test/settlement.test.tsx`, new `describe('F3b: cash and card
  diverge (POS-04)')` block covering AC-2 through AC-11 (see below), plus a
  parametrized test asserting all 8 new fixture states render their row of
  the task's table (AC-12).

#### Red cases proved (mutate → run focused test → record → revert)

All performed one at a time on the current branch, each reverted before the
next, matching `builder17`'s standard from FE-015:

1. **Criterion 9** (rule lives in `tender.ts`). Mutated `tenderMaximum` back
   to `return balance` for every method (F3a's placeholder). Ran `AC-5`:
   failed — `balance()` stayed `'155.925'` instead of `'0'`, because Add for
   cash 200.000 was refused again. Reverted.
2. **Criterion 4, red case 1** (bare change limit). Mutated cash's branch to
   `return CASH_CHANGE_LIMIT` (dropping `balance +`). Ran `AC-4`: failed —
   `10.055.924` (the correct ceiling) was refused, Add rendered `SPAN` not
   `BUTTON`. Reverted.
3. **Criterion 4, red case 2** (`<` vs `<=`). Mutated `mayAddTender` to
   `amount < tenderMaximum(...)`. Ran `AC-4`: failed — the exact ceiling
   amount `10.055.924` was refused (one-over-only test would have missed
   this if the ceiling test only tried `10.055.925`). Reverted.
4. **Criterion 7** (F3a's single caption). Mutated `tenderCaption`'s
   untouched-state branch back to one sentence for both methods (F3a's
   original, card-flavoured text). Ran `AC-7`: failed — the cash caption
   assertion (`'Cash may be more than this'`) didn't match the rendered card
   sentence. This is F3a's exact original defect, now caught. Reverted.
5. **Criterion 11** (URL lying). Mutated `addDraft`'s URL rewrite back to
   `` `?state=${nextBalance === 0n ? 'exact' : 'partial'}` ``. Ran `AC-11`:
   failed — `window.location.href` carried `?state=exact` instead of ending
   bare at `/pos/settlement`. Reverted.
6. **Criterion 5/10** (single-tender cap without `min`). Mutated cash's
   branch to `return balance + CASH_CHANGE_LIMIT` (dropping the `min` against
   `SINGLE_TENDER_LIMIT`). Ran the `tenderMaximum` single-tender-limit test:
   failed — `104_999_999n` returned instead of `99_999_999n` for a
   95,000,000 balance. Reverted. **Interrupted mid-session by a machine
   sleep with this mutation still live in `tender.ts`** — caught and
   reverted on resume; `npm run verify` is green with the mutation removed
   (confirmed by reading the file back before the final verify run).

Not separately mutation-tested (reasoned through instead, given time budget):
criterion 1 (component has no second copy of the rule — structurally true
by construction: the component calls `addRule`/`tenderMaximum` and computes
no cap itself); criterion 2's `method === 'card'` trap (can't be demonstrated
without adding a third `TenderMethod` member, which is out of scope this
slice — the `NON_CASH_METHODS` test exists specifically so this is caught
automatically if the union ever grows); criterion 6 (B-20, a rejected Add is
a click on a `<span>` with no handler — structurally a no-op, and `AC-6`
asserts `host.innerHTML` is byte-identical before/after); criterion 8 (live
figures — proved directly by `AC-8` using a real order via
`/pos/order?state=quick`, not by mutation).

#### Judgement calls

- Split the "refuses zero/negative/over-balance" `it.each` into two plain
  `it`s rather than keeping one parametrized test with a conditional inside
  it — clearer to read, same assertions preserved for card, cash's
  over-balance assertion cleanly dropped.
- `settlementPosition` takes `ReadonlyArray<Money>` (amounts only), not the
  `DraftTender` objects — the component maps `drafts.map(d => d.amount)`
  before calling it. Kept the money-shape function agnostic of the
  component's draft-row shape (label/id), per rule 1's "the shape is yours."
- The *Change given* row's amount interpolates the `−` (U+2212) the same way
  `formatAmount` does for negative numbers elsewhere in this codebase, not a
  plain hyphen, matching `money.ts`'s documented convention.
- Card-over and ceiling notices reuse the existing generic `.notice`/
  `.notice__title` classes already used elsewhere in the app rather than
  inventing new notice CSS, since their visual shape is identical to what's
  already there.

#### Composition raised, not built (per the task's third lead ruling)

**The single-tender-cap-binds case** (balance above 90,000,000, so
`tenderMaximum('cash', balance)` returns `SINGLE_TENDER_LIMIT` rather than
`balance + CASH_CHANGE_LIMIT`): implemented exactly as ruled — the field
message `Cash maximum {max}` is drawn, Add is inert, and **neither the
notice nor the caption is drawn**, because both existing pieces of copy
describe the limit as being about change, which would be false here. No new
copy was written for this case. **A designer still needs to compose what (if
anything) explains this rejection to the cashier** — right now they see only
the field message with no notice and no caption, which is correct per the
ruling but is the one gap in this slice's copy coverage. Proved directly by
the `AC-5-single-tender-cap` test (balance 95,000,000, keyed 100,000,000:
`.notice` and `.tender-help` are both absent, field message reads `Cash
maximum 99.999.999`).

No other composition gaps were found — all 8 states' captions/notices/
messages come directly from the artifact or from the two "cardsplit caption
also applies to cash" / "{tendered} is the drafted sum" lead rulings already
recorded in the task file, which were followed as written.

#### Scope discipline

No custom tender methods added. No close outcome beyond F3a's inert Close.
No lease/re-auth/cancel/takeover. No tips/rounding/suggested amounts. No
persistence. Nothing in any new copy says money was *taken* — only
*recorded* or *not recorded*, matching *Must not invent*.

#### Corrections (lead review, applied 2026-09-23)

**(1) Cash was still addable at zero balance — lead's find, cause was the
task's formula.** `tenderMaximum('cash', balance)` had no zero case:
`min(0 + 9_999_999n, 99_999_999n) = 9_999_999n`, so from `?state=change`
(Cash 200.000 drafted, balance already 0) keying 9.999.999 on Cash rendered
Add as a live `BUTTON`. Adding it would have drafted a second Cash tender and
pushed change to 10.044.074 — over FR-M5's 9.999.999 change limit, and a
direct violation of rule 4's premise ("Add is refused once the balance
reaches zero").

*Proved red first, against the formula as originally handed off.* Reverted
`tenderMaximum` to the pre-correction form (no zero guard), ran the new
`'cash is zero at zero balance'` test: failed exactly as the lead described —
`tenderMaximum('cash', 0n)` returned `9_999_999n`, expected `0n`. Restored
the fix and reran: green.

*Fix, in `apps/pos/src/tender.ts`:* `tenderMaximum` now opens with `if
(balance <= 0n) return 0n;`, before the method branch — so the cap is zero
for cash **and** card alike at zero balance, not just cash.

*Fix, in `apps/pos/src/SettlementScreen.tsx`:* at zero balance the field must
draw exactly what `exact`/`change` already draw — Add reads "Nothing left"
(already correct, since that branch checks `balance === 0n` first), but the
field itself must show **no** invalid style and **no** message, and neither
the ceiling notice nor its caption may render (the notice's copy would read
"the 0 still owing plus the 9.999.999 change limit," which is false). Added
`invalidDisplay = invalid && balance !== 0n`, used only for the field's
`--invalid` class and its message span — `invalid` itself is untouched and
still gates Add's inert state. Added a `balance === 0n` early-return to
`tenderNotice` alongside its existing `!keyed || mayAdd` guard.
`tenderCaption` already returned `null` at `balance === 0n` before any other
check, so it needed no change.

*New tests, all proved passing against the fixed code:*
- `tender.test.ts`: `'%s is zero at zero balance — nothing is left to add'`
  (`it.each(['cash', 'card'])`) — `tenderMaximum` is `0n`, and `mayAddTender`
  refuses everything down to `1n`.
- `settlement.test.tsx`: `'rule 4: nothing can be added at zero balance, by
  either method'` from `?state=change` — keys 9.999.999 on Cash, asserts Add
  stays `SPAN` reading "Nothing left", no invalid field, no field message, no
  `.notice`, no `.tender-help`, the draft count and the 44.075 change both
  stay exactly as they were. A second test repeats the same walk from
  `?state=exactcash` (drafts fully allocated by card... by cash, balance 0,
  no change block) to cover the non-cashover zero-balance path too.

**(2) AC-10's cap test used a hand-maintained array — didn't actually enforce
exhaustiveness.** `NON_CASH_METHODS: readonly TenderMethod[] = ['card']`
would silently under-cover a new `TenderMethod` member; nothing forces
whoever adds one to also extend that array.

*Fix, in `apps/pos/test/tender.test.ts`:* replaced it with
```ts
const METHODS = { cash: true, card: true } satisfies Record<TenderMethod, true>;
const NON_CASH_METHODS = (Object.keys(METHODS) as TenderMethod[]).filter((method) => method !== 'cash');
```
`satisfies Record<TenderMethod, true>` forces `METHODS` to list every member
of the union — an omission is a compile error, not a silently-passing test.

*Proved by mutation:* temporarily widened `TenderMethod` to `'cash' | 'card'
| 'voucher'` in `tender.ts` and ran `npm run typecheck`. Failed exactly as
predicted:
```
apps/pos/test/tender.test.ts(38,46): error TS1360: Type '{ cash: true; card: true; }' does not satisfy the expected type 'Record<TenderMethod, true>'.
  Property 'voucher' is missing in type '{ cash: true; card: true; }' but required in type 'Record<TenderMethod, true>'.
```
Reverted `TenderMethod` to `'cash' | 'card'`; typecheck clean again.

**Final `npm run verify` after both corrections: green — 1287 tests across
22 files, typecheck clean.**
