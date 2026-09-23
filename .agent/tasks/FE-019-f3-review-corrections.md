# FE-019 — F3 review corrections: one owner per state, and three smaller fixes

**Status:** Ready, unassigned. Written 2026-09-23 by `lead`.
**Source:** [the F3 review](../reviews/F3-settlement-review.md), `f3-reviewer`
on codex `gpt-6-sol`. The verdict was *request changes*, with three P2 findings
and one P3. Read the review in full before you start; it is the specification
for findings 1–4.
**Branch:** `agent/phase-0-foundations`.
**Model:** Sonnet. The browser walk is the lead's, so do not try to get a
browser. **Write the handoff in the slot at the bottom, starting early, and add
to it as you go. When you resume after an interruption, run `git diff` first
and look for a live red-case mutation before doing anything else.**
**Baseline:** `d2d07eb` plus the review report: **1327 tests across 22
files**, typecheck clean. Re-run it before you start and state what you got.

---

## 1. One owner per piece of state (review finding 1, and the shape behind it)

**The defect.** Under `PosRoutes`, `OrderScreen` keeps `view` in
`useState(initial)` and switches off its own `popstate` listener. Browser Back
between two POS-03 URLs therefore leaves the screen stale. The reviewer
reproduced a URL reading `?state=lock-lease` over an **unlocked** panel with a
**live Settle**.

**The shape behind it has now caused three defects, so this slice removes the
shape rather than patching the symptom:**

- `OrderScreen`: `suppliedStore ?? localStore`, plus its own `view` state. This
  caused F3c's regression (a removed line still billed) and this finding.
- `SettlementScreen`: `suppliedSession ?? localSession` (F3d). It has not failed
  yet, but only because the session hook has no URL effect.

In each case a component builds its own copy of some state, and the app then
discards that copy in favour of the one the route passes down. **Afterwards,
no component may call a state hook whose result it can throw away.**

**The rule, and it is the lead's ruling:**

- Split each screen in two. **A controlled component** takes its view, its
  store or session, and its navigate callback as props, and owns none of them.
  **A thin wrapper** owns exactly one of each and renders the controlled
  component.
- **`PosRoutes` renders the controlled components**, passing the view it
  derives from the URL on every render and on every `popstate`.
- **The wrappers keep today's exported names** (`OrderScreen`,
  `SettlementScreen`), so the ~30 direct component tests keep rendering what
  they render today and **do not change**. Name the controlled components
  however you like.
- The optional `store?` and `session?` props and both `??` defaults are
  deleted. A wrapper is standalone or it is not used; there is no mix.
- **Out of scope:** the sheets still read `shownOrder(view)` fixture data. The
  review notes that this predates F3 and does not charge it. Do not change it.

## 2. The seeded PIN pad submits placeholders (review finding 2)

`PinPad`'s `seed` writes `•` characters into the digit store. With `seed={2}`
and **1 2 3 4** keyed, `onSubmit` receives `••1234`, and the pad stops after
four real digits. `B-12` holds, but `FR-A1`'s six-digit numeric PIN does not.

**Fix:** keep seeded dots purely visual. Draw them without putting anything in
the digit value. A seeded pad must still accept **six real digits** and submit
**only those digits**. The reviewer's correction is the specification.

## 3. The rejected-close notice goes too early (review finding 3)

**This one is the lead's error.** Two of the lead's rulings collided, and no
criterion tested the point where they meet. FE-016 rule 7 drops `?state=` from
the URL after a live Add. FE-017 rule 8 keeps the rejection notice while any
balance is owing. The implementation gates the notice on `state === 'error'`
(`SettlementScreen.tsx:596`), so the **first partial Add clears it**, even
though 27.800 is still owed.

**Fix:** the rejection is a fact about **this payment session**, not about the
URL. Hold it in the session. It clears when the balance reaches zero, when the
payment is cancelled, or when the session ends. Its figures stay live. Nothing
about it may read `?state=` after mount. **Rule 8 itself stands as written.**

## 4. `/pos/floor`'s invented sentence (review finding 4, P3)

Remove *"POS-02 (the floor) is not built yet."* **The lead's ruling:** the
placeholder route renders the empty POS device frame (`pos-device`) with **no
copy at all**. The floor's placeholder wording belongs to a designer. Keep the
route.

---

## Acceptance criteria

1. **The reviewer's history walk goes red, then green.** Through `PosRoutes`,
   with `/pos/order?state=lock-lease` below `/pos/order?state=default` in
   history, mount on `default` and press browser Back. The result must be the
   **lease** notice (*"Another client is settling this order"*), the panel
   carrying `data-lock`, and **no live Settle**. Then press an available control
   (*Manager: take over payment*) and land on the takeover modal. **Red case:**
   today's `useState(initial)`. Run it first and watch it fail.

2. **Forward works too.** From that state, browser Forward returns to an
   **unlocked** `default` with live Settle and *Remove Steak*.

3. **No discarded state hook remains.** In the source, no component calls
   `useOrderStore` or `usePaymentSession` and then chooses another value over
   it. List every call site of both hooks in the handoff; each must be the only
   owner in its tree. **Red case:** add back `suppliedStore ?? localStore`
   anywhere, and a test of your choosing must fail. Say which test, and prove it
   by running that mutation.

4. **Every earlier routed walk still holds.** F3a's add-then-settle, F3c's
   remove-then-settle, and F3d's lock, *Back to payment*, Cancel and refused
   `?gone=` sequences all pass **unchanged**.

5. **A seeded pad takes six digits and submits only digits.** With `seed={2}`:
   keying six digits is accepted, and `onSubmit` receives exactly those six
   characters, all numeric. The dots show the seed before any keying. **Red
   case:** today's `••` prefix.

6. **`B-12` still holds on the seeded pad.** No keyed digit appears in the DOM,
   by the existing guarantee's own test style.

7. **The notice survives a partial correction.** On `error`, add Card 10.000:
   the notice stays, and it reads **27.800** still owing. Add the remaining
   27.800: the notice goes and Close goes live. **Red case:** today's
   `state === 'error'` gate.

8. **The notice does not come back.** After the notice clears at zero, remove
   a draft so a balance is owed again. The notice stays gone, because the
   rejection was answered once the cashier covered it. Cancel also clears it.
   *This is the lead's ruling; say in the handoff if you think it is wrong.*

9. **`/pos/floor` renders no copy.** Its text content is empty.

10. **Existing tests pass unchanged.** The one exception: if a pin-pad or
    settlement test asserts the old seeded behaviour or the floor sentence, you
    may change that assertion only, and you must name it. Then run
    `npm run verify`, confirm it is green with typecheck clean, and state the
    count.

Make every red case a real mutation, run it on its own, and revert it
afterwards.

---

## Scope: what this slice must NOT do

- No change to the sheets' `shownOrder(view)` reads.
- No change to tender, close or pending rules, which the review cleared.
- No keypad clipping fix, no takeover keypad, no new copy anywhere. Those are
  for the design branch.

**A boundary is not subject to your judgement.** If the task appears to require
breaking one, the task is wrong. Say so and stop.

---

## Handoff

Write it below as you go. State:

- what you built;
- the count before and after;
- every hook call site (criterion 3);
- every red case, and what failed when you proved it;
- every judgement call;
- any existing test you changed, and why.

Commit nothing. Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

### Implementer handoff

_(empty — to be written by the implementer)_
