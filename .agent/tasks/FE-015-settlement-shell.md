# FE-015 — POS-04 exists: the balance, the draft, and an exact close (F3a)

**Status:** Ready, unassigned. Written 2026-09-22 by `lead`.
**Roadmap item:** F3a — the first of four settlement slices. **F3 was split
2026-09-22**; see *Why this is a quarter of F3* below.
**Branch:** `agent/phase-0-foundations`
**Model:** codex / `gpt-5.6-sol` (owner's instruction for this session).
**Baseline:** `193f72b`, **1216 tests across 20 files**, typecheck clean
(lead-verified 2026-09-22 by running it). **Re-run it before you start and state
what you got.** The suite includes seven PostgreSQL migration tests, so run
`npm run db:up` first if `restaurant-pos-db-1` is not up.

---

## Why this is a quarter of F3, not all of it

Counted rather than guessed, which is the check that has changed a task three
times on this project:

| Screen | Artifact | Distinct states | Outcome |
|---|---|---|---|
| POS-01 lock | — | 8 | one slice, 114 tests |
| POS-03 order | 664 lines | ~26 | **eleven slices**, 1022 tests |
| **POS-04 settlement** | **352 lines** | **21** | **four slices** |

21 states, and SCREEN-INVENTORY lists seventeen behaviours plus a walkable
tender walk. F3 as one task is the same mistake F2 was before it was split.

**The four slices, by authority rather than by component** — the lesson F2c paid
for:

- **F3a (this task).** The screen exists: the balance, the draft, an exact
  close. `empty`, `pressed`, `partial`, `exact`, `overflow`.
- **F3b.** The two pads diverge — cash may exceed the balance, card may not
  (`FR-G3`, `FR-G4`, `B-5`, `FR-M5`). `card`, `cardsplit`, `cashover`,
  `cardover`, `ceiling`, `change`, `exactcash`, `exactsplit`.
- **F3c.** Close outcomes: `loading`, `error`, `zero`, `pending`.
- **F3d.** Lease and identity: `reauth`, `leaselost`, `takeover`, `cancel`.

---

## Read the artifact from the design worktree. This matters more here than anywhere.

```
../restaurant-pos-design/docs/design/visual-directions/frost/pos/settlement.html
```

**This branch's copy carries DESIGN-004's critical defect and you must not read
it.** The lead diffed the two, so the defect is stated here concretely rather
than as a warning:

In the branch's copy the `error` state — *"the order changed while you were
collecting payment"* — draws **the same totals as every other state** (total
155.925) and a **balance of `0`**. A close offered on a stale balance, with
nothing outstanding shown, at the exact moment the order underneath has changed.

The worktree's remediated copy gives `error` its own figures — subtotal 205.000,
discount −20.500, service charge 9.225, **total 193.725**, tax 16.773 — and a
balance of **37.800**, which is 193.725 − 155.925: what is actually still owed
after the order grew under the cashier.

`error` is **F3c's**, not yours. It is described here because it is the reason
the path above is not a formality.

---

## The problem the roadmap line does not mention, and it is this slice's real work

**POS-04 is a `[SCREEN]` — its own route (SITEMAP §1, SCREEN-INVENTORY POS-04:
*"Its own route"*), and the only place POS-03 ever leaves for.** Two facts
collide:

1. `main.tsx:10` picks the screen **once, at module load**:
   `const orderScreen = /\/order\/?$/.test(window.location.pathname)`.
2. `SETTLE_BTN` (`OrderPanel.tsx:558`) carries `search: '?state=settle'` with
   `leaves: true`, and `navigate` does a same-document `pushState`. **No
   document load happens, so nothing re-evaluates that regex** and the screen
   never changes.

And the third fact that makes it interesting: **the order lives in
`useOrderStore`, which is `useState` inside `OrderScreen` (`orderStore.ts:130`).
Unmounting POS-03 destroys the order.** A settlement screen that cannot see the
order the cashier just built is the whole point missed.

**So this slice lifts the store above both screens and routes between them
client-side.** That is the work. Expect roughly:

- A small route component owning `useOrderStore` and choosing POS-03 or POS-04
  from the path, re-evaluated on `popstate` and on in-app navigation.
- `OrderScreen` and the new settlement screen both receiving the store.
- `main.tsx` rendering that component instead of branching once.

**Do not reach for a router library.** This app has none and needs none; the
existing `navigate`/`popstate` pair already does history correctly, including
the `[SHEET]`/`[INLINE]` replace-versus-push rule this project ruled on twice.
Extend it; do not replace it.

### The three placeholder route names, reconciled

| Placeholder | Where | Becomes |
|---|---|---|
| `?state=settle` | `OrderPanel.tsx:558` and `:562` | the real POS-04 route |
| `?state=settle-pending` | `menuFixtures.ts:74`, *Back to payment* | POS-04, the lock's route out |
| `?state=settle-takeover` | `menuFixtures.ts:83`, *Manager: take over payment* | POS-04 — **but the takeover modal itself is F3d.** Land on the screen; do not build the modal |

**`?state=incidents` is not yours.** It points at POS-07, which is F4's. Leave it
exactly as it is.

---

## What this slice builds

`empty`, `pressed`, `partial`, `exact`, `overflow` — five of the artifact's
twenty-one.

From the artifact's own vocabulary (classes and controls the lead read out of
it): an order summary with `totals`, a pinned balance, method chips **Cash** and
**Card** (`btn--sm`, the selected one `btn--primary`), an amount `field` with a
`keypad`, an **Add cash** / **Add card** control, drafted tenders as `listrow`s,
and **Close order & print receipt**.

### The rules that are not decoration

- **Ruling I-13 — the amount field prefills with the remaining balance, for
  every method, and stays editable in place.** There is **no split mode, tab or
  toggle**. Keying an amount below the balance *is* the split (`FR-G2`); the
  remainder stays on the balance and the pad is ready for the next method.
- **`FR-G5` and `B-18` — close only at exactly zero outstanding.** No tolerance,
  no "close anyway", no rounding allowance. `partial` exists to draw the close
  refused.
- **`FR-G9` — no Tender record exists before close.** The draft is client-side
  and tab-local. Nothing you build may present a drafted tender as something the
  server has recorded.
- **`FR-G6`, `B-6` — revenue is the order total, never the amount tendered.**
- **`overflow`** is many split tenders: the draft list scrolls and **the balance
  and total stay pinned**. Same shape as the order panel's own overflow.
- **No tips, definitively** (PRD §8). No tip line, no rounding-up prompt, no
  suggested amounts.

### The totals come from the store, and that is the point of FS

The order summary reads the store's `ShownOrder`. Do not re-derive totals and do
not read `ORDER_FIXTURES` for them. FS exists so that the balance a cashier
settles is the balance they built.

**`--frost-invalid` is consumed here.** A9 landed it, the 13px round tag and
`--frost-invalid-border` unused on purpose, for this screen. The artifact's
`field field--invalid` with `field__msg` is where it lands — but see the scope
line below.

---

## Scope: what this slice must NOT do

- **No over-balance behaviour.** Cash-may-exceed, card-may-not, the change
  computation and the change ceiling are all **F3b** (`FR-G3`, `FR-G4`, `B-5`,
  `FR-M5`). In this slice **Add accepts an amount at or below the balance**.
- **Do not encode "over balance is impossible" as a truth anywhere.** Put the
  question in a pure module from the first line — `tender.ts`, beside `fire.ts`,
  `discount.ts` and `void.ts` — answering *may this amount be added, for this
  method, against this balance?* F3b extends that module. If F3b has to unpick a
  component that decided for itself, this slice was built wrong. **This is the
  single most important constraint in the task**, and it is the one four
  previous slices have each paid for.
- No lease, no renewal, no expiry, no takeover modal, no re-authentication.
- No close outcome: pressing Close does nothing visibly, on FE-001's PIN
  precedent and F2h's fire precedent. `loading`, `error` and the closed result
  are F3c's, and minting a close result needs a time and a receipt outcome the
  app cannot supply.
- No `zero`, no `pending`, no `cancel`.
- No persistence. Refresh resets, as it does on POS-03.

If a composition you need is not drawn in the artifact, **stop and raise it**.
Eight of the last ten slices found one, and every one was worth more raised than
filled. Two were found in FE-014 *before a line was written*, which is the
standard to hold.

---

## Acceptance criteria

Each names the case where a right answer differs from a wrong one. This project
has recorded four times that a criterion phrased only as *"prove it red"* is
satisfiable without being met.

1. **Settle leaves POS-03 and arrives with the order intact.** From
   `/pos/order?state=quick`, add a Burger through the item sheet, then press
   Settle: POS-04 draws **subtotal 300.000, service charge 15.000, total
   315.000** — the figures the cashier just made, not a fixture's.
   **The red case:** a settlement screen that seeds from `ORDER_FIXTURES` shows
   165.000. That is the whole slice in one assertion; write it first.

2. **Back returns to the order, still mutated.** Settle pushes (it is the one
   departure — `[SCREEN]`, not `[INLINE]`), so Back returns to POS-03 with the
   added Burger still there.
   **The red case:** a `replaceState` leaves no entry to go back to; a remount
   loses the line. Assert the line, not just the URL.

3. **The amount field prefills with the balance, for both methods.** On an
   untendered order the field reads the full balance; choose the other method
   and it still does.
   **The red case:** a prefill wired to one method only passes every
   single-method test. Assert both.

4. **Keying below the balance splits it.** Add an amount less than the balance:
   a drafted tender appears, the balance drops by exactly that amount, **and the
   field re-prefills with the new balance.** No mode was entered.
   **The red case:** a field that keeps the old prefill, or a balance computed
   from the total rather than from total-minus-drafts, both still look right on
   a single full-balance tender. Use **two** successive part tenders.

5. **Close is refused until the balance is exactly zero** (`FR-G5`, `B-18`).
   Live at zero; unavailable at `partial`; unavailable with the balance one
   minor unit short.
   **The red case:** a `>= 0` or a tolerance passes at exact and at one-short.
   Assert the one-short case explicitly — it is the only one that separates
   them.

6. **The draft is client-side and says so.** Nothing renders a drafted tender as
   recorded, saved, or submitted (`FR-G9`).

7. **`overflow` scrolls the draft and pins the balance and total.** With many
   tenders the list scrolls while the balance and total stay visible.

8. **The rule lives in `tender.ts`, not in a component.** Prove it by making the
   module refuse every amount and watching the component refuse too, with no
   component change. **The red case:** a component that decides for itself keeps
   accepting.

9. **The 1216 existing tests pass, unchanged.** Not adjusted, not loosened, not
   deleted. FE-014's parity sweep must stay green — if lifting the store breaks
   it, the lift is wrong, not the sweep.

10. **`npm run verify` green**, typecheck clean, and state the count.

---

## Read before you start

- `apps/pos/src/orderStore.ts` — the whole file. `useOrderStore` is `useState`
  in a component today; you are lifting it.
- `apps/pos/src/OrderPanel.tsx:66-178` — `OrderScreen`, `navigate`, the
  push-versus-replace rule and why only Settle pushes. `:550-575` — `ActionDef`
  and `SETTLE_BTN`.
- `apps/pos/src/main.tsx` — all 16 lines. The routing that must change.
- `apps/pos/src/voidFixtures.ts:103-138` — `ShownOrder`, and `shownOrder`, which
  still feeds the sheets.
- `apps/pos/src/discount.ts:108` — `orderTotals`. The balance is derived from
  its `total`; write no money arithmetic of your own.
- `docs/design/SCREEN-INVENTORY.md`, POS-04 — all of it, including **Must not
  invent**, which is long and every line of which is load-bearing.
- `docs/BOUNDARIES.md` — `B-18` (exact settlement), `B-6` (revenue is the
  total), `B-20` (a rejected command changes nothing).

**A boundary is not subject to your judgement.** If the task appears to require
breaking one, the task is wrong — say so and stop.

---

## Handoff

Write your handoff into the section below **before you report done.** An empty
handoff section is the cheapest signal this project has that a task did not
finish, and it has caught a silent failure once already.

State: what you built, the test count before and after, each red case you proved
and what failed when you proved it, every judgement call, and every composition
you raised rather than built.

`git log` is the check, not the handoff. Commit nothing unless the lead asks.
Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md` — those are the lead's.

### Implementer handoff

_(empty — to be written by the implementer)_
