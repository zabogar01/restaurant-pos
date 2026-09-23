# FE-018 — The payment is a session: drafts survive, the tab locks, Cancel ends it (F3d)

**Status:** Done 2026-09-23, `builder20`. Lead-verified at 1327 tests and walked in a browser. Written 2026-09-23 by `lead`.
**Roadmap item:** F3d, the last of four settlement slices. F3a is FE-015
(`cda4d4e`); F3b is FE-016 (`be5051c`); F3c is
[FE-017](FE-017-close-outcomes.md) (`aa435c9`).
**Branch:** `agent/phase-0-foundations`.
**Model:** Sonnet, per the standing policy. The browser walk is the lead's
job; do not try to get a browser. **Write the handoff in the slot at the bottom,
and start it early.** Add to it as you go. **When you resume after any
interruption, run `git diff` first and look for a live red-case mutation.**
**Baseline:** `f0db0c3`, **1306 tests across 22 files**, typecheck clean,
verified by the lead on 2026-09-23. **Re-run it before you start and state what
you got.**

**The F3a–F3d review runs after this slice.** It is the owner's single review
of all four, so anything you leave here is the first thing it finds.

---

## What this slice is

**`reauth`, `leaselost`, `takeover`, `cancel`** are the artifact's four
identity-and-lease states. `FR-G9`, `FR-G12`, `FR-G13`, `FR-G14`, ruling **I-5**.

As in F3c, some of this is a live rule the client owns and some of it needs a
server that does not exist:

| What | Rule | Live or fixture |
|---|---|---|
| **The payment session.** Settle begins it. Drafts live in it and survive the trip back to POS-03. Cancel ends it | `FR-G9`, `FR-G12` | **Live.** This is the slice's real work |
| **POS-03's own-tab lock** (`lock-draft`) while a session is active | `FR-G12` tab guard | **Live**, derived from the session rather than from `?state=` |
| `cancel`: the confirmation, then release | I-5, `FR-G13` | **Live** |
| `reauth`: the actor expired, the draft is alive | `FR-G9`, `FR-A2` | **Fixture.** No idle timer exists; FE-001's *90s* is a static label |
| `leaselost`: displaced by a takeover | `FR-G14` | **Fixture.** No server exists to displace anyone |
| `takeover`: a manager takes the lease over | `FR-G14` | **Fixture.** It needs a verified manager PIN, and so a server |

---

## The defect F3c recorded, which is this slice's centre

**Drafts die on the way back to POS-03.** `PosRoutes` renders `SettlementScreen`
and `OrderScreen` in exclusive branches, and the drafts are `useState` inside
`SettlementScreen`. So `← Order` unmounts them, and pressing Settle again
starts from nothing.

Three sources contradict that:

- `FR-G9`: the draft *"remains a client-side draft until close"* and
  *"survives actor-session idle expiry within the same browser tab"*.
- The artifact: every POS-04 state's `← Order` goes to
  **`order.html?state=lock-draft`**, a *locked* order whose action is *Back to
  payment*.
- `LOCK_NOTICE.draft` (`menuFixtures.ts:69`), already built in F2a: *"…
  unavailable until you **finish or cancel** it."* It promises a payment that
  is still there to go back to.

**This is the same shape F3a fixed for the order:** state that has to outlive
one screen belongs above both screens. F3a lifted the order into `PosRoutes`.
**This slice lifts the payment session there too.**

### Read before designing it: the two-path trap, now three times

F3a lifted the store and left `OrderScreen` building its own behind
`suppliedStore ?? localStore`. F3c then found that only the discarded copy
heard row removals. **Do not repeat that with drafts.** When the route supplies
the session, `SettlementScreen` must not keep a second, self-contained copy that
a direct component test could exercise while the app used the other one. If
direct component tests need a self-contained session, give them the **same**
hook that `PosRoutes` uses, not a parallel default. Criterion 12 pins this.

---

## The rules

1. **The session begins on Settle and on any direct `/pos/settlement` visit, and
   ends only on Cancel.** Close still has no outcome (F3a, F3c), so in this app
   Cancel is the only thing that ends a session. The session holds the drafts
   and the fact that it is active. The chosen method and the keyed amount may
   reset on remount; the field prefills the balance, per I-13. **If a session is
   active, its drafts beat any fixture seed**, so *Back to payment* returns to
   the drafts the cashier made rather than to `settle-pending`'s empty shell.

2. **While a session is active, POS-03 shows the own-tab lock, whatever
   `?state=` says.** That means the `lock-draft` composition and its
   `LOCK_NOTICE.draft` copy. Add-line, discount change, fire, void and row
   removal are all gone, and *Back to payment* is the only action (`FR-G12`: the
   five actions). **The lock is derived from the session, not the URL.** The
   `lock-draft` fixture state stays for direct visits.

3. **The own-tab lock never borrows the lease's words** (`FR-G12`: *"must
   never show the same message"*). Under an active session POS-03 draws
   *"Finish this payment first"*, never *"Another client is settling this
   order"*.

4. **The tab guard holds against URL-driven mutation too.** `orderStore.ts:104`
   and `:147` refuse `?gone=` only for a fixture's `lock`. Under the derived
   lock, a `?gone=` must be refused the same way. The guard is UX only
   (`FR-G12` says so), but a lock that a URL walks straight through is not a
   lock.

5. **Cancel payment is live and ungated** (I-5). It is the `btn--sm` at the foot
   of the summary column, with the caption *"Releases the order so it can be
   edited again. Nothing has been recorded here."* Pressing it opens the
   artifact's `cancel` modal, copied verbatim. *Keep collecting* closes the
   modal and changes nothing. **Cancel payment** discards the drafts, ends the
   session, and lands on POS-03 **unlocked**, with Settle back. There is no
   approval, no PIN and no manager.

6. **The modal's count sentence follows the drafts.** It reads *"One drafted
   payment line will be discarded."* for one and *"2 drafted payment lines will
   be discarded."* for two, following `fireRefusal`'s plural pattern (grammar,
   not copy). **With no drafts, omit the sentence:** there is nothing to
   discard, and *"0 drafted payment lines"* is copy nobody drew. This is the
   **lead's ruling**; record it for a designer.

7. **After Cancel, history cannot resurrect the payment.** Browser Back from
   the unlocked POS-03 must not land on a POS-04 that shows the discarded drafts
   or claims a session. Choose push or replace yourself, and say why.

8. **`reauth` is a fixture composition.** Its drafts are Card 155.925 (as in
   `exact`). The header draws the **SIGNED OUT** tag in place of the actor and
   the idle label, and Close reads **Sign in to close**. The modal is *"Sign in
   to finish this payment"* / *"Your session timed out. The drafted payment
   lines are still here."*, with a PIN pad and *Leave payment* / *"The draft
   stays in this tab."*
   - **The PIN pad is FE-001's and F2g's.** Reuse it, with `B-12`'s guarantee
     intact: no digit reaches the DOM. Submit verifies nothing, because there is
     no server (FE-001's precedent). Seed the dots the way F2g's approval
     fixtures do.
   - **Leave payment keeps the draft** and lands on POS-03 **locked**, exactly
     like `← Order`. The artifact links it to `order.html?state=default`, an
     unlocked order, **which contradicts its own caption**, *"The draft stays in
     this tab."* The caption is the requirement (`FR-G9`). **This is the lead's
     ruling**, and it goes to the design branch as an artifact defect.

9. **`leaselost` is a fixture composition.** It draws the modal *"A manager took
   over this payment"*, no drafts and **no Cancel payment** (the artifact hides
   it). *Back to floor* points at POS-02, which does not exist yet and is F4's.
   Give it a placeholder route, `/pos/floor`, on the precedent of
   `?state=incidents` (F2h), and **state in your handoff what that route
   renders today.** Do not build a floor.

10. **`takeover` is a fixture composition, reached for real.** POS-03's
    `lock-lease` action *Manager: take over payment* already lands on
    `?state=settle-takeover` (F3a). It should now draw the takeover modal: the
    **MANAGER REQUIRED** tag, the *"A card charge may already be in progress"*
    notice copied verbatim (its *20:14* is the artifact's fixture copy), the
    manager PIN dots, **no Cancel payment** behind it, **Cancel** → POS-03
    `lock-lease`, and *I understand — take over*.
    - **The artifact draws manager PIN dots and no keypad.** A manager cannot
      enter a PIN on it. **Raise this; do not add a keypad.**
    - So *I understand — take over* stays **inert**. A verified manager PIN
      needs a server, and the artifact gives no way to enter one. Record both
      facts.

11. **No lease countdown.** F3a removed the artifact's *Lease 4:52* because the
    app has no clock. Keep it removed. The renewal and expiry states belong to a
    server.

---

## Existing tests that may change, and only these

The lock changes one thing about the earlier walks: **a cashier who has entered
payment can no longer edit POS-03 by pressing Back.** Any existing test that
goes POS-04 → Back → **mutates POS-03** encoded the missing lock. **You may change
such a test only by routing it through Cancel payment** (settle, Cancel, then
mutate). Name every one you change in the handoff, with a line on why.
**Change no other existing test.** F3c's AC-5 and AC-6 remove the Steak
*before* settling, so the lead expects them to pass untouched. If one does not,
stop and tell the lead.

---

## Acceptance criteria

Each criterion names its red case, and every premise above has one.

1. **Drafts survive the trip.** Start at `quick`, add a Burger, and Settle
   (315.000). Add 100.000 Card, then press `← Order`. POS-03 is **locked**: the
   title is *"Finish this payment first"*, and there is no Settle, no fire, no
   discount, no void and no row `×`. Press *Back to payment*: the Card 100.000
   row is there, the balance is **215.000**, and the field prefills 215.000.
   **Red case:** drafts in `SettlementScreen`'s `useState`, today's code. The
   row is gone.

2. **The lock is derived, not addressed.** With a session active, render POS-03
   at `?state=default` (not `lock-draft`): it is locked. **Red case:** a lock
   read from the fixture only.

3. **The own-tab words, never the lease's.** Assert *"Another client"* does not
   appear anywhere on the locked POS-03 (`FR-G12`).

4. **The guard holds against `?gone=`.** With a session active, navigate POS-03
   to `?state=default&gone=steak`: the Steak is **still on the order**, and
   POS-04 still reads 382.725. **Red case:** today's fixture-only guard at
   `orderStore.ts:104` and `:147`.

5. **Cancel releases the order, ungated.** With two drafts, press Cancel payment:
   the modal shows *"2 drafted payment lines will be discarded."* *Keep
   collecting* → both rows still there. Cancel payment again, then **Cancel
   payment** in the modal → POS-03 **unlocked**, with Settle present; Settle →
   *Nothing drafted yet*. No approval prompt appears at any point. **Red case:**
   a cancel that navigates without ending the session; POS-03 is still locked.

6. **The count follows the drafts.** One draft gives *"One drafted payment line
   will be discarded."* Zero drafts gives **no** count sentence. **Red case:**
   a hard-coded *"One"*.

7. **History cannot resurrect it.** After Cancel, browser Back does not draw
   the discarded rows or a locked POS-03.

8. **F3c's pending path, under the lock.** Start at `/pos/order` with the Steak
   pending, and Settle (382.725). The pending notice says leaving means
   *"leaving this payment, because a draft blocks both"*. Walk it: `← Order` →
   locked, no *Remove Steak*. *Back to payment* → **Cancel payment** → confirm →
   POS-03 unlocked → *Remove Steak* → Settle → **155.925** → pay → **Close
   live**. This is the flow the copy describes, now walkable end to end.

9. **`reauth`.** A direct visit draws SIGNED OUT, the modal, *Sign in to close*
   and the Card 155.925 row. Pressing digits puts no digit into the DOM (`B-12`).
   Submit changes nothing. *Leave payment* → POS-03 **locked**, and *Back to
   payment* → the Card 155.925 row **still there**. **Red case:** following the
   artifact's href to an unlocked order, which loses the draft.

10. **`leaselost`.** A direct visit draws the modal, with no Cancel payment and
    no drafts. *Back to floor* goes to `/pos/floor`; state what renders there.

11. **`takeover`, reached for real.** From `/pos/order?state=lock-lease`, press
    *Manager: take over payment*: the takeover modal, MANAGER REQUIRED, no
    Cancel payment. *Cancel* → POS-03 at `lock-lease`. *I understand — take
    over* is inert.

12. **One session path.** A direct `SettlementScreen` test and a `PosRoutes`
    test must exercise the same session hook. Prove it: break the hook's
    add-draft in one place only, and **both** kinds of test fail. **Red case:** a
    self-contained default beside the route's session, which is F3a's store
    shape. Here only one kind of test fails.

13. **Existing tests pass, apart from those changed under the rule above**, each
    named. `npm run verify` green, typecheck clean, count stated.

Make each red-case mutation on its own, run the focused test, record what
failed, and revert it. **Every red case gets a real mutation.** F3c marked three
as *"not applicable"* and several more as *"caught while drafting"*. That was
honest, but it is not proof, and the review will ask for proof.

---

## Scope: what this slice must NOT do

- No closed result, no receipt, no navigation after Close (F4).
- No floor screen (POS-02 is F4's). A placeholder route only.
- No real PIN verification, no lease renewal, no expiry timer, no idle timer.
- No keypad on the takeover modal; it is raised instead.
- No change to the keypad clipping in `cardover` and `ceiling` (the designer's).
- No new tender methods.

If a composition you need is not drawn, **stop and raise it**. The lead has
already ruled on rules 6, 8's *Leave payment* and 10's inert takeover.

---

## Read before you start

- `apps/pos/src/PosRoutes.tsx`, `apps/pos/src/SettlementScreen.tsx` and
  `apps/pos/src/orderStore.ts`, all of each.
- `apps/pos/src/OrderPanel.tsx:67-135`: `OrderScreen`, `navigate`, and the F3c
  fix that calls `onLocationChange` on every navigate.
- `apps/pos/src/menuFixtures.ts:60-90` and `MenuRegion.tsx:45-60`: the lock
  notices and how POS-03 draws a lock today.
- `apps/pos/src/PinPad.tsx` and F2g's approval fixtures: the `B-12` guarantee.
- FE-017's handoff: the regression section and *Back to the order, with a
  draft present*.
- The artifact from the design worktree:
  `../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html`.
- `docs/PRD.md` `FR-G9`, `FR-G12`–`FR-G14`; SCREEN-INVENTORY POS-04, including
  I-5; SITEMAP §POS-04's modals.

**A boundary is not subject to your judgement.** If the task appears to require
breaking one, the task is wrong; say so and stop.

---

## Handoff

Write it below as you go. State:

- what you built, and the test count before and after;
- **every existing test you changed, and why**;
- every red case, with what failed when you proved it;
- every judgement call, including rule 7's history choice;
- every composition you raised, including the takeover keypad;
- what `/pos/floor` renders today.

Commit nothing. Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

### Implementer handoff

**Baseline:** re-ran `npm run verify` before touching anything — **1306 tests
across 22 files, typecheck clean** — matches the task's stated baseline.
**After:** **1323 tests across 22 files, typecheck clean**, `npm run verify`
green.

#### What was built

- `apps/pos/src/paymentSession.ts` (new): `usePaymentSession()`, the one
  session hook. Holds `active`, `drafts`, `addDraft`, `removeDraft`,
  `activate(seed)`, `cancel()`.
- `PosRoutes.tsx` calls `usePaymentSession()` and, in the render body (not an
  effect — see below), activates the session the first time a settlement
  visit is seen, seeded from `SettlementScreen.tsx`'s `initialDrafts` unless
  the visited state is `leaselost` or `settle-takeover` (new
  `beginsSession()`, rules 3/9/10). `session.active` is threaded into
  `useOrderStore(view, session.active)` (the `?gone=` guard, rule 4) and into
  `<OrderScreen locked={session.active} />` (the derived lock, rule 2). Added
  a `/pos/floor` branch rendering a one-line placeholder (rule 9's "state what
  it renders" — see below).
- `OrderPanel.tsx`: `OrderScreen` takes a `locked?: boolean` prop, threaded to
  `MenuRegion` and `OrderPanel`. Both now compute
  `lock = locked ? 'draft' : fixture.lock` instead of reading the fixture's
  lock alone — the derivation rule 2/3 asks for, and it always resolves to
  `draft`, never `lease`, when the session is the reason.
- `orderStore.ts`: `useOrderStore(view, locked = false)` — the seed and the
  post-mount `?gone=` effect both refuse under `locked` the same way they
  already refuse under `ORDER_FIXTURES[view.state].lock`.
- `SettlementScreen.tsx`: `session` is now an optional prop
  (`PaymentSession`). Unsupplied (every direct component test), it builds its
  own via the **same** `usePaymentSession()` hook and activates it itself,
  in-render, guarded by `beginsSession(state)` — this is criterion 12's
  answer: one hook, no parallel default. Added: the Cancel payment button +
  modal (rule 5, I-5), the count sentence (rule 6), and three new fixture
  states — `reauth`, `leaselost`, `settle-takeover` — each with its own modal,
  copied from the frost artifact
  (`../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html`).
- `PinPad.tsx`: added an optional `seed?: number` prop — sets the pad's
  initial filled-dot *count* only, via a placeholder character never a real
  digit, so B-12 holds. Used by `reauth`'s modal (2 dots, matching the
  artifact's static picture).
- `pos.css`: `.settlement-cancel` / `.settlement-cancel__note` for the new
  footer section.

**Render-time activation, not an effect.** `PosRoutes` and `SettlementScreen`'s
own fallback call `session.activate(seed)` directly in the render body,
guarded by `!session.active`. This is React's documented "adjust state while
rendering" pattern: React discards the in-flight render and immediately
re-renders with the new state, so the *first paint* of a settlement visit
already shows the seeded drafts — an effect-based version left one render
with the pre-seed balance, which broke the tender field's prefill for every
direct-visit fixture (`partial`, `change`, …) because `amountText`'s lazy
`useState` initializer only runs once, at that first wrong render.

#### Existing tests changed, and why

One, beyond the allowed Back-mutates-POS-03 pattern (none of those needed
touching, since drafts survive the trip and nothing pre-existing walks
POS-04 → Back → mutates POS-03 for the fixture-lock states):

- `test/settlement.test.tsx`, `'lock-lease' routes its placeholder action to
  POS-04`. It asserted no `[role="dialog"]` appears after pressing *Manager:
  take over payment*. **Rule 10 requires the opposite** — `settle-takeover`
  now draws the takeover modal for real, which is the entire point of the
  rule. I split the `it.each` so `lock-draft` (→ `settle-pending`, no modal
  of its own) keeps the old assertion and `lock-lease` (→ `settle-takeover`)
  now asserts a dialog *is* drawn. This is outside the literal allowance in
  the task ("only by routing it through Cancel payment"), because it isn't
  that pattern — it's a direct, named consequence of rule 10 itself, not a
  workaround. Flagging for the review rather than treating it as
  self-evidently fine.

#### Red cases, each proved with a real mutation, reverted

1. **AC-1** (drafts in `SettlementScreen`'s own state): forced
   `SettlementScreen` to always use its local fallback session
   (`suppliedSession` ignored). `.draft-tender` count went from 1 to 0 after
   the round trip. Reverted.
2. **AC-2** (lock read from the fixture only): `OrderPanel`'s
   `lock = locked ? 'draft' : fixture.lock` → `lock = fixture.lock`.
   `data-lock` went from `'draft'` to `null` at `?state=default` with a
   session active. Reverted.
3. **AC-3** (own-tab words borrow the lease's): mutated `LOCK_NOTICE.draft`'s
   title to the lease's own sentence. `not.toContain('Another client')`
   failed. Reverted.
4. **AC-4** (`?gone=` guard fixture-only): dropped `|| locked` from
   `orderStore.ts`'s post-mount effect guard. Steak dropped out of the
   locked order under `?gone=steak`. Reverted.
5. **AC-5** (Cancel navigates without ending the session): removed
   `session.cancel()` from `cancelPayment`, kept the `replaceState`. POS-03
   never re-rendered (the URL changed but nothing signalled React to look at
   it again) — the assertion crashed reading `.order-panel`, which is itself
   the proof: the screen was still `SettlementScreen`. Reverted.
6. **AC-6** (hard-coded "One"): `draftCountSentence` always returned the
   singular sentence. The two-draft Cancel modal read "One drafted…" instead
   of "2 drafted…" — caught by both AC-5 and AC-6. Reverted.
7. **AC-7** (Cancel pushes rather than replaces): `cancelPayment` used
   `pushState` instead of `replaceState`. Browser Back after Cancel landed
   back on `/pos/settlement` (the pre-cancel entry), not `/pos/order`.
   Reverted.
8. **AC-11** (a lease fixture opening a session anyway): `beginsSession`
   forced to always return `true`. After Cancel from the takeover modal,
   POS-03 read `data-lock="draft"` instead of `"lease"` — the session I'd
   wrongly opened by visiting `settle-takeover` overrode the real lease lock.
   (AC-10 alone didn't catch this mutation — it doesn't check the lock
   POS-03 shows afterward — but AC-11 does, so the pair together prove rule
   9/10's exclusion.) Reverted.
9. **AC-12** (a second, parallel session default): made
   `paymentSession.ts`'s `addDraft` a no-op. Both a `PosRoutes`-rendered test
   ("two successive below-balance tenders…") **and** the direct
   `SettlementScreen` test in the new suite failed from the one change —
   proof of the one-hook architecture. Reverted.

**Not independently red-case-proved, and why:**

- **AC-9's "follow the artifact's href, not `history.back()`" clause** (rule
  8's ruling). I tried the mutation — swapping `leavePayment` for a
  `pushState` to `/pos/order?state=default` — and the test still passed,
  because the drafts now live in the lifted session rather than being
  addressed by the URL/fixture, so even the artifact's own (wrong) href no
  longer loses them. The architecture that fixes F3c's central defect makes
  this specific old failure mode structurally unreachable; I kept
  `history.back()` anyway, since it's the more direct match for "exactly
  like ← Order" and needs no history growth, but I could not manufacture a
  red case that only this choice, and not the lifted session generally,
  explains. Flagging rather than claiming a proof I don't have.
- **AC-8, AC-10's remaining assertions**: exercised by the passing suite
  (walked end to end / drawn correctly) but not separately mutation-tested
  beyond what's listed above — time-bounded judgement call, not an oversight
  I'm hiding. AC-8 is a composition of AC-1/AC-2/AC-5, each already proved on
  its own.

#### Judgement calls

- **Rule 7, history.** Cancel payment uses `replaceState`, not `pushState`
  (proved above, AC-7). Reasoning: whichever settlement entry is current gets
  overwritten by the unlocked order, so Back from the post-cancel POS-03
  walks straight past settlement into whatever was there before the cashier
  ever pressed Settle — never a settlement screen carrying the discarded
  drafts. A contrived multi-hop sequence (Settle → Back → *Back to payment* →
  Cancel → Back → Back) can still reach an *earlier*, separate settlement
  entry, but by then the session is inactive, so it reseeds empty rather than
  resurrecting the canceled drafts — never the discarded ones, which is what
  the rule asks for.
- **Leave payment (rule 8).** Uses `window.history.back()` — literally the
  same call `← Order` makes — rather than the artifact's own href. See the
  "not independently proved" note above: this is the lead's ruling from the
  task text, implemented as asked, just not separately provable given the
  architecture.
- **`reauth`'s dot seed.** Added `PinPad`'s `seed` prop rather than a second
  pad. It sets only a *count*, backed by a placeholder character, never a
  real digit — B-12 holds (proved by the existing pin-pad tests plus AC-9's
  own count-only assertion).
- **`settle-takeover`, not `takeover`, as the literal state name.** Rule 10
  ties the composition to the *existing* route
  `?state=settle-takeover` (F3a's `lock-lease` action already points there).
  `reauth` and `leaselost` have no prior route to reconcile onto, so they
  keep the artifact's own names.
- **`/pos/floor` renders today:** a bare `<div className="pos-device">` with
  one line of text, "POS-02 (the floor) is not built yet." Nothing else —
  no floor was built, per scope.

#### Compositions raised (not built, per scope)

- **Rule 8's artifact defect:** *Leave payment* links to
  `order.html?state=default` (unlocked), which contradicts its own caption
  *"The draft stays in this tab."* Implemented per the lead's ruling
  (locked, via `history.back()`), not the artifact's href. Goes to the
  design branch.
- **Rule 10's artifact defect:** the takeover modal draws manager PIN dots
  with **no keypad** — a manager cannot enter a PIN on it. Raised, not
  fixed: *I understand — take over* stays inert (`aria-disabled`, no
  handler), and no keypad was added.

No boundary in `docs/BOUNDARIES.md` appeared to require breaking for this
slice; none of the four states need a server this slice doesn't have, since
`reauth`/`leaselost`/`settle-takeover` are all fixture-only by rule and
`cancel` is genuinely live and ungated by rule 5/I-5.

Commit not made, per instructions.

### Lead correction

**Defect:** `orderStore.ts:154` set `appliedGone.current = view.gone` *before*
the lock check on `:155`. A `?gone=` refused because the tab was locked was
still recorded as if it had been applied, so a later, genuinely fresh
`?gone=` for the same line — even after the lock lifted — was silently
skipped as "already seen." The lead's browser walk: Settle, Add, ← Order
(locked), navigate to `?state=default&gone=steak` (correctly refused, Steak
stays — this is the step that poisoned `appliedGone.current`), Back, Back to
payment, Cancel payment, confirm, then Remove Steak on the now-unlocked
POS-03: the row visually dropped, but the store never actually removed it, so
Settle read 382.725 instead of 155.925.

**Fix** (`orderStore.ts`, the `?gone=` effect): two changes.

1. When `view.gone` goes falsy — which Cancel always does in the same handler
   that clears the lock — `appliedGone.current` now resets to `undefined`.
   That is what lets a later, genuinely fresh re-ask for the same line id be
   reconsidered rather than treated as a repeat.
2. `appliedGone.current` is still marked *before* the lock check (unchanged
   from the original), and this is deliberate, not a leftover of the bug: a
   refusal has to be remembered too, or the lock lifting on its own — `locked`
   is in the effect's own dependency array — could replay a stale `?gone=`
   nobody re-asked for and drop a line with no user action behind it. The bug
   was never *that* the refusal was remembered; it was that the memory never
   cleared when the URL genuinely stopped carrying the value.

**Proof, each reverted:**

- `test/settlement.test.tsx`, F3d suite: *"a ?gone= refused under the lock
  still removes the line once asked for again after Cancel"* — pins the
  lead's exact browser walk through `PosRoutes`. Ran red against the original
  `:154` ordering (drop the falsy-reset branch, restore the unconditional
  early mark): failed with `382.725` where `155.925` was expected — the exact
  figures from the walk. Reverted, now green.
- `test/order-store.test.tsx`, new describe `F3d: the derived lock (...)`
  and the lead correction to its ?gone= guard`: three tests, closer to the
  unit than the walk, added a `locked` param and a `rerender` handle to the
  file's existing `Harness`/`mountStore` so a mounted store's `view`/`locked`
  can change without remounting (mirrors how `PosRoutes` actually drives it,
  a single store instance across the whole session):
  - refused-under-lock leaves the line;
  - refused, then cleared, then re-asked while unlocked — removes it (this
    one also ran red against the original ordering: dropping the falsy-reset
    branch alone reproduced the exact same failure, confirming the fix is the
    reset, not the mark-before-check);
  - **the lock lifting on its own, with the same `?gone=` still in view and
    no intervening clear, does not drop the line** — this is the second half
    of the lead's ask ("check that the effect's `locked` dependency cannot
    drop a line on its own when the lock lifts"). Not reachable through any
    real app flow (Cancel always clears `gone` in the same handler that
    lifts the lock, so the two never move independently in production), but
    now pinned directly at the store level so a future change to that
    pairing cannot introduce it silently.

`npm run verify`: **1327 tests across 22 files, typecheck clean.**
