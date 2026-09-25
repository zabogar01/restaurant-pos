# FE-027 — POS-04: Close actually closes, and the table comes free

**Status:** Written 2026-09-25 by `lead`. This is **F4c**. The owner asked for
it on 2026-09-25.
**Found by:** writing FE-026. The live *Close order & print receipt*
(`SettlementScreen.tsx:974`) has **no handler**. Every close rule built in F3
(exact settlement, `FR-G5`; pending refusal, `FR-G10`; zero total) decides
whether the button is live. Pressing it then does nothing.
**Source:** PRD `FR-G5` to `FR-G10`, `FR-E5` and `FR-G7`/`FR-G8`;
SCREEN-INVENTORY POS-04 (`:247–341`) and POS-02 (*"returned to after close"*).
**Branch:** `agent/phase-0-foundations`.

---

## The lead's rulings

1. **A pure `closeOrder`** in `close.ts`, next to `closeRefusal`. It takes the
   order, the drafts and the time, and returns either the refusal (reusing
   `closeRefusal`, never a second copy of the rules) or a **closed order**:
   - `status: 'closed'` and `closedAt`;
   - **tenders** equal to the drafts at close. `FR-G9`: no tender exists
     before close; from close they are the order's.
   - **change** from `tender.ts`'s existing arithmetic. Change is not revenue
     (`FR-G6`), and the recorded total is the order total.
   - A **zero-total** order closes with **no tenders**.
2. **A quick sale's pending lines** become one `queued` round at close
   (`FR-E5`: a quick sale fires at close). **Reuse `fireOrder`'s round
   construction; do not duplicate it.** `queued` means *sent*, never *printed*
   (ARCH-002). A table order can never close with pending lines, because
   `FR-G10` already refuses it.
3. **The book keeps closed orders.** They are marked closed, **not deleted**.
   POS-05 (closed orders, DESIGN-009) will list them. The floor treats a table
   whose only order is closed as **free**, so a new press starts a new order
   with a new id. `FR-D1`'s at-most-one limit applies to **open** orders.
4. **The payment session for that order ends** at close. Its drafts are now
   the tenders.
5. **Where Close lands: the floor**, `/pos/floor`, with **`replaceState`**,
   not a push. The artifact links Close to `prototype/pos/closed-order.html`
   (POS-06), which is unbuilt and has no Frost design. The inventory says the
   floor is *"returned to after close"*. **Lead ruling: the floor, until
   DESIGN-009 settles POS-06.** Record the conflict in the handoff. It is not
   yours to resolve.
6. **A closed order is never editable or re-closable.** Browser Back after a
   close must not put a live Close, Add, Send or line control in front of that
   order. If the active order is closed, the order and settlement routes
   **replace** themselves with `/pos/floor`. That is navigation only, with no
   new copy. **Red case:** close Table 9, then press Back twice. There is no
   second close, and the book holds exactly one closed Table 9.
7. **Idempotent** (inventory: *"must not be double-fired"*). A double press
   closes once. Apply it through the functional updater, as `fire` does.
8. **The receipt:** there is no printer, so **draw nothing about it**. Do not
   add a *printed* claim, and do not add a receipt incident. `FR-G8`: a
   receipt failure never blocks the close. `loading` and `error` stay the
   fixture-only states F3c made them.

## Acceptance criteria

1. **`closeOrder` table test:**
   - exact card;
   - cash over-tender with change;
   - split tender;
   - zero total, with no tenders;
   - quick sale with pending lines, which gains one `queued` round;
   - the refusals: pending on a table order, balance outstanding, locked.

   **Red case:** make `closeOrder` compute its own refusal. The refusal-parity
   test against `closeRefusal` fails.
2. **The walk, in one document:**
   - `/pos/floor` → Table 9 → Settle → Card 173.250 → Close;
   - you land on `/pos/floor`, and Table 9 reads **Free**;
   - press Table 9 again, and it is a **new, empty** `Order · T9`;
   - the book holds the closed Table 9 and the new open one.
3. **Rule 6's red case**, and a double press closes once.
4. A payment on another table is untouched by this close (FE-026's
   per-order sessions).
5. The existing 2203 tests pass unmodified. Any that must change, stop and
   ask. `npm run verify` is green, with counts stated.
6. The handoff names the owner's walk.

## Do NOT

- Build POS-05 or POS-06, or any receipt UI.
- Add audit events. There is no audit log in the client; the backend owns it.
- Touch the lease, reauth or takeover fixtures.
- Touch `docs/`, `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

## Reporting

Commit nothing. Append a handoff below. Then run
`herdr agent prompt lead "<your name>: FE-027 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder29 — 2026-09-25 — BLOCKED on two existing tests; everything else built

`npm run verify`: typecheck clean; **2224 tests / 32 files, 2222 pass, 2 fail** (baseline 2203 / 30; +21 tests, +2 files: `test/close-order.test.ts` 10, `test/close.test.tsx` 7, and 4 added to `test/order-book.test.tsx`). Nothing committed.

**The block.** Two existing tests in `apps/pos/test/settlement.test.tsx` pin *"Close does nothing"*, which this task reverses. I did not edit them.
- `:298` *Close at exact settlement intentionally produces no visible result in F3a* — asserts `innerHTML` unchanged and path still `/pos/settlement` after pressing Close.
- `:738` *AC-9: loading cannot be reached by pressing Close* — same two assertions, plus `.menu-loading__label` is null.

Proposed change: replace `expect(host.innerHTML).toBe(before)` and `expect(window.location.pathname).toBe('/pos/settlement')` in each with `expect(window.location.pathname).toBe('/pos/floor')`. AC-9 keeps its real subject (`.menu-loading__label` null); the F3a test's title becomes stale ("intentionally produces no visible result") and would need renaming to e.g. *Close at exact settlement lands on the floor*.

**Built so far:** `closeOrder` in `close.ts` (reuses `closeRefusal` and `fireOrder`; adds `locked` and `unavailable` refusals); the book keeps closed orders (`closed` on the stored order; `orders()`, `openOrderIdOf`, `hasOrderFor`; a table's new order takes `table-9-2`, …); `store.close` returns whether it closed; Settlement's Close handler closes, `replaceState`s `/pos/floor` and ends that order's session; `PosRoutes` replaces a closed active order's order/settlement route with the floor; floor tiles treat a table with only closed orders as free. Red case run: `closeOrder` computing its own refusal fails 2 tests (refusal parity, pending).

### builder29 — Round 2 — 2026-09-25 — done

`npm run verify`: typecheck clean; **2224 tests / 32 files, all pass** (baseline 2203 / 30; +21 tests: `close-order.test.ts` 10, `close.test.tsx` 7, 4 in `order-book.test.tsx`). Nothing committed.

**Existing tests changed** (lead-approved; the task should have named them), both in `apps/pos/test/settlement.test.tsx`:
1. `:298` renamed *Close at exact settlement closes the order and lands on the floor*; asserts `pathname === '/pos/floor'` (was: innerHTML unchanged, still on settlement).
2. `:738` *AC-9: loading cannot be reached by pressing Close* keeps its subject: `pathname === '/pos/floor'`, `location.search` does not contain `state=loading`, `.menu-loading__label` is null.

**Red cases run:** `closeOrder` computing its own refusal → 2 fail (parity, pending). Closed-order redirect in `PosRoutes` disabled → the Back-twice test fails. Closed-order mutation guard in `update` removed → 1 book test fails. Removing the pre-check in `store.close` alone changes nothing (the updater guards too), so that double press test is pinned by the updater, not the return value.

**Design notes for the lead**
- `store.close` (optional on `OrderStore`, since hand-built test stores omit it) returns whether it closed; Settlement navigates only on true, so a refused close leaves drafts and screen intact (B-20).
- `closeOrder` adds two refusals beyond `closeRefusal`: `locked` (lease only; this tab's own session never refuses) and `unavailable` (B-17, an 86'd item on a quick sale, which fires at close). The Close button has no drawn state for these; no copy invented.
- `closedAt` is an ISO string from `new Date()` in SettlementScreen; the quick-sale round's `firedAt` takes the same value (fired rounds elsewhere use `HH:MM`). Nothing displays a closed order yet; POS-05 should decide the format.
- Table ids: first order `table-9`, then `table-9-2`, … The floor reads the open one via `openOrderIdOf`.
- **Conflict for the lead:** the artifact links Close to POS-06 (`closed-order.html`, unbuilt). Built to ruling 5: the floor via `replaceState`, until DESIGN-009 settles it.
- Closed orders sit in the book (`book.orders()`) with tenders, change and `closedAt`, for POS-05.
- Named omission: no receipt UI, no audit event, no *printed* claim.

**Owner's walk.** `npm run dev -w apps/pos` → `/pos/floor` → Table 9 → Settle → Card → Add card (173.250) → Close order & print receipt → you land on the floor, Table 9 reads Free → press Table 9: a new empty `Order · T9`. Then Back twice: the floor, no Close control, one closed Table 9 in the book.
