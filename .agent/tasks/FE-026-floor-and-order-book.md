# FE-026 — POS-02: the floor, and a store that holds one order per table

**Status:** Written 2026-09-25 by `lead`. This is **F4b**. The owner asked for
it on 2026-09-25.
**Source:** the reviewed and accepted Frost artifact
`../restaurant-pos-design/docs/design/visual-directions/frost/pos/floor.html`
(nine states), plus four new states in `frost/pos/order.html`: `open-t7`,
`open-t9`, `open-t12` and `quick-new` (DESIGN-008, committed `016a669`).
SCREEN-INVENTORY POS-02 (`docs/design/SCREEN-INVENTORY.md:85–122`).
**Branch:** `agent/phase-0-foundations`.

---

## Why this is more than a screen

`useOrderStore` (`orderStore.ts:179`) holds **one** order. It is seeded once
from the fixture at mount and never reseeded (`:16–28`, deliberately). A floor
whose tiles open *their own* order breaks that. Go floor → Table 9 client-side,
and the store would still show whatever it was seeded with. The review of
DESIGN-008 found that exact defect in the artifact: three tables opening
Table 1's order. **This slice gives an order an identity, so the code cannot
reproduce it.**

## The lead's rulings

### 1. The order book

- `OrderFixture` gains an optional **`orderId`**. It defaults to `'table-1'`,
  in one helper, the way `type` defaults to `'table'` (`orderFixtures.ts:146`).
  The fifty-odd existing fixtures are **not touched**, because they all are
  Table 1.
- The four new fixtures are ported from the artifact with its data and copy
  verbatim, and its arithmetic (the DESIGN-008 round 3 handoff table):
  - `open-t7` → `'table-7'`, drawn with the `lock-draft` composition;
  - `open-t9` → `'table-9'`;
  - `open-t12` → `'table-12'`;
  - `quick-new` → a fresh quick sale.
  `quick` and `quick-line` → `'quick-1'`.
- The store becomes a **book**: orders keyed by `orderId`, plus an **active
  id**.
  - **`useOrderStore`'s return shape does not change.** It is the active
    order's store, so every consumer and every existing test is untouched.
    **The safety property is FE-014's: a book holding one order is the old
    store. All 2135 tests pass unmodified.** Any test you believe must change,
    stop and ask.
  - An order is seeded from its fixture **the first time** it becomes active.
    After that, its mutations persist while other orders are active.

### 2. The active order lives in the store, not in the URL

The URL keeps selecting *fixture states* (sheets, overlays and the rest,
through `OrderPanel.tsx:235`). Putting the order's identity in the URL would
make every URL builder carry it, which is the `&from=` lesson of FE-021 again.
So:

- The active id is set **only** by the initial URL at mount (its fixture's
  `orderId`) or by a floor press.
- In-order navigation (`?state=` changes) **never** changes it. That is
  today's no-reseed rule, kept.
- **Known edge, accepted:** browser Back across a floor press can show a URL
  whose fixture names another order, while the active order stays the one last
  opened. Pin it with a test that asserts the active order, and note it in the
  handoff. Do not build history-state machinery for it.

### 3. POS-02 at `/pos/floor`

- It replaces `FloorPlaceholder` (`PosRoutes.tsx:83`).
- The fixture state comes from `?state=`, using the artifact's nine ids.
  Unknown resolves to `default`.
- Put the fixtures in a new `floorFixtures.ts`, with copy and data verbatim.
- Port styling into `pos.css` using registry tokens only.
- **Table tiles:**
  - **An occupied tile** makes its order active, seeding it from its fixture
    on the first open, and goes to `/pos/order?state=<its fixture>`
    client-side. The destinations are `default` for Table 1, and `open-t7`,
    `open-t9` and `open-t12`.
  - **A free tile** creates a new empty **table** order in the book: its own
    `orderId` (`table-<n>`), its own title (*Table n*), no groups. It makes
    that order active and goes to `/pos/order?state=empty`. The panel title
    comes from the store (`OrderPanel.tsx:436`), so it reads *Table n*, not
    Table 1. **Red case:** press Table 2, and the heading says *Table 2*.
  - **A tile reads from the book** whenever the book holds that table's order:
    the total from `orderTotals` and the status line derived from its groups.
    Otherwise it shows the fixture. **Criterion:** open Table 2, add a Burger,
    go `← Floor`. Table 2 is now open at 100.000, derived rather than
    hard-coded, and the other tiles are unchanged.
- ***New quick sale*** creates a new quick-sale order from `quick-new` with a
  fresh id (`quick-<n>`), makes it active and goes to
  `/pos/order?state=quick-new`. **An open quick sale has no place on the
  floor** in the design. List that as a design question; do not invent a
  place for it.
- ***Closed orders*** goes to `/pos/closed-orders`, which is a
  **placeholder** route: the bare device frame and no copy, following
  `FloorPlaceholder`'s precedent. POS-05 is DESIGN-009's.
- **Release** (to the lock screen) is drawn in the artifact. It ends the
  actor's session, which is POS-01 and `FR-A` territory that this slice does
  not own. **Leave it out, and name the omission.** Do not draw it inert.
- Floor states other than the live composition (`loading`, `error`, `empty`,
  `clear`, `overflow` and `dayclosed`) are fixture pictures. Tiles still open
  orders the same way wherever they are drawn.

### 4. `← Floor` on the order screen

The artifact's order bar has `← Floor` (`order.html:42`). The code has no link
back at all. Add it, client-side through `navigation.ts`, on every order state
that the artifact draws it on.

### 5. The payment lock belongs to one order

`usePaymentSession` has no order identity, so a payment begun on Table 1 would
lock Table 9. **The session records the `orderId` it began on, and the lock
applies only while that order is active.** **Red case:** start paying Table 1,
go to the floor, open Table 9. Table 9 is unlocked, and Table 1's tile still
shows its payment lock when reopened. `open-t7`'s own lock comes from its
fixture's lock facts (`originFacts`) and needs no session.

## Out of scope, named

- **Close does nothing today.** The live *Close order & print receipt*
  (`SettlementScreen.tsx:974`) has no handler. A closed order leaving the book
  and freeing its table is **F4c**. Do not start it.
- Release, POS-05, POS-06, and the FE-025 incident follow-ups.

## Acceptance criteria

1. The nine floor states render as the artifact draws them, checked by a table
   test. Unknown resolves to `default`.
2. **Each occupied tile opens its own order.** The heading and total match the
   tile for Tables 1, 7, 9 and 12. **Red case:** collapse the book to one
   order, and the test fails.
3. **Free tile:** a new order with the right title. Mutations persist across
   floor round trips. Two free tables stay independent.
4. **Book-derived tiles**, as in rule 3.
5. **Payment lock per order**, as in rule 5.
6. **New quick sale** opens an empty quick sale with no fire control
   (FE-012).
7. **Client-side everywhere.** No floor or order transition reloads the
   document. Assert on `pushState` and a stable module instance, as FE-025
   did.
8. The existing 2135 tests pass **unmodified**. `npm run verify` is green,
   with counts stated.
9. The handoff names the owner's walk: `npm run dev -w apps/pos`, then
   `/pos/floor`, then Table 2, add a Burger, `← Floor`, Table 9, `← Floor`.
   It also names the edge from rule 2.

## Do NOT

- Put the order id in the URL.
- Touch Close, Release, POS-05 or POS-06.
- Invent copy, or a place on the floor for open quick sales.
- Touch `docs/`, `.agent/MEMORY.md` or `.agent/ROADMAP.md`.

**If this does not fit one session, stop at a green boundary and say so.** The
natural cut is rules 1–2 plus rule 5 first, then the floor. Do not leave a
half-migrated store.

## Reporting

Commit nothing. Append a handoff below. Then run
`herdr agent prompt lead "<your name>: FE-026 done — <tests> tests, <one line>"`.
If you are blocked, run
`herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff

### builder28 — 2026-09-25 — BLOCKED on one existing test; everything else built

**State.** `npm run verify`: typecheck clean; **2191 tests / 30 files, 2190 pass, 1 fails** (baseline 2135 / 28; +56 tests, +2 files: `test/floor.test.tsx` 39 and `test/order-book.test.tsx` 6 are new;
the other 11 are existing tests whose loops now also walk the four new fixtures — all pass unmodified). Nothing is committed. No file in `docs/`, `.agent/MEMORY.md`
or `.agent/ROADMAP.md` was touched by me (both show as modified in `git status`; that is not from this session).

**The block — an existing test cannot stay as written.**
`apps/pos/test/settlement.test.tsx:1011` (*AC-10: … Back to floor goes to the placeholder*) asserts `host.textContent === ''` at `/pos/floor`.
It pins `FloorPlaceholder`, which this task replaces (rule 3: "It replaces `FloorPlaceholder`"). The two cannot both hold. I did not edit it.
Proposed change (one assertion): replace line 1011 with `expect(host.querySelector('.floor')).not.toBeNull();` — the test's real subject
(*Back to floor* lands on `/pos/floor`, line 1010) is untouched. Every other existing test passes unmodified.

**What was built**
- `orderFixtures.ts`: `orderId?` + `orderIdOf` (the one `?? 'table-1'`); `quick`/`quick-line` → `quick-1`; four new fixtures `open-t7`, `open-t9`, `open-t12`,
  `quick-new` with the design's arithmetic (all via `orderTotals`); `FLOOR_ORDER_STATES` — resolved by `orderViewFrom` but **not in `ORDER_STATES`**
  (`order-panel.test.tsx:115` pins that list exactly, and the fixture nav / every walk over it would have gained four states). `menuFixtures.ts` gains their entries.
- `orderStore.ts`: the book. `useOrderStore` is unchanged in shape (`useOrderBook` returns `{ store, book }`; `useOrderStore` is `.store`). Orders seed on first
  activation; `?state=` never changes the active id. A floor page passes `showing=false` so nothing is seeded at mount (else Table 1's tile would read a book nobody opened).
- `paymentSession.ts`: `orderId`, recorded by `activate(…, orderId)`; `PosRoutes` locks only while that order is active (`Locked` may be a function of the active id).
- `FloorScreen.tsx`, `floorFixtures.ts`, `pos.css` (registry tokens; hover inside `@media (hover: hover)`, placed after `.fixture-states` because the void/discount CSS tests slice up to it).
- `← Floor` on the order bar, client-side, on every state in the routed app. **Only when `PosRoutes` asks (`showFloorLink`)**: the standalone `OrderScreen` keeps its bare bar,
  because ~30 unmodified tests assert the exact anchors / tab stops on it.
- `/pos/closed-orders`: bare device frame, no copy. `navigation.ts` gains `isPlainClick`.

**Red cases run** (each fails its named test, then restored): book collapsed to one id → 5 fail (four different orders, Table 12 persistence, lock, Back edge, ids); free-table title
`Table 1` → 5 fail (heading *Table 2*, persistence, independence…); lock as one session flag → the Table 9 / Table 1 lock test fails; `← Floor` removed → 12 fail.

**Findings — for the lead, none built around**
1. **Table 1's tile disagrees with its own order.** Artifact tile: `2 rounds fired · 1 line pending`, **155.925**. The code's `default` (Table 1) is the locked-state order with the Steak pending: **382.725**.
   (The artifact's own `default` state draws 2 items, no Steak, at 155.925.) The tile is verbatim before Table 1 is opened and book-derived (382.725) after. Criterion 2's "total matches the tile" is asserted for Tables 7, 9, 12 only. Needs a ruling.
2. **Criterion 4's "100.000" is not what a Burger yields.** The Burger the item sheet adds is 135.000 with its default modifiers; + 5% service → **141.750**. The test asserts the tile equals the order's own derived total, and that a second Burger moves it.
3. **Panel title vs the task's title.** Fixtures keep the artifact's panel title (`Order · T7`); a free table's is `Table n` as the task says. The two conventions now coexist on the panel.
4. **Item counts.** Artifact Table 9 says `5 items` (3 Coffee + 2 Soda — units); the panel counts lines, so it reads `2 items`. Artifact Table 12 says `3 lines`; the panel says `3 items`. The tile counts units (`5 items`) to match the artifact; the panel's existing rule was left alone.
5. **Copy not in the artifact:** a table holding only pending lines (Table 2 after adding a Burger) reads `1 line pending` — the pattern with the zero-rounds clause dropped.
6. **A payment session belongs to one order, but Settle on a different order** (Table 1 mid-payment, then Table 9 → Settle) reaches the settlement with Table 1's drafts, because `!session.active` guards the seeding. Not named in this task; not built. Wants its own slice.
7. **Item sheets opened from `open-t9` / `open-t12` / `quick-new`** return to `default` on Cancel/Add (they are not in `ITEM_SHEET_ORIGINS`; adding them touches tests that walk it). The order shown stays right (it is the store's); the view-level facts (Table 9's incident banner) fall away.
8. **Design question:** an open quick sale has no place on the floor — once left, it is in the book with no way back to it.
9. Named omissions: **Release** is not drawn (POS-01 / FR-A). The order bar's artifact `h1` (*Table 7*), tag and actor are not drawn — only `← Floor`.

**The accepted edge (rule 2), pinned.** `floor.test.tsx` › *Back across a floor press…*: floor → Table 1 → floor → Table 9, then Back twice lands on `/pos/order?state=default`
while the order shown is still **Table 9** (the last opened). No history-state machinery.

**Owner's walk.** `npm run dev -w apps/pos` → `/pos/floor` → press **Table 2** (heading *Table 2*, empty) → add a Burger → **← Floor** (Table 2 is now `1 line pending · Open · 141.750`; the other tiles unchanged)
→ **Table 9** (`Order · T9`, FAILED banner, Send inert) → **← Floor**. Also: Table 7 opens locked from its own fixture; Table 12's Fries × removes to 80.325 and stays removed.

### builder28 — Round 2 — 2026-09-25 — done

`npm run verify`: typecheck clean; **2203 tests / 30 files, all pass** (round 1 was 2190/2191; +12 from round-2 tests and from existing loops that now also walk the new rows). Nothing committed.

1. **Existing test changed, as ruled:** `apps/pos/test/settlement.test.tsx:1011` (AC-10) now asserts `host.querySelector('.floor')` is not null instead of `textContent === ''`. **Rule 3 replaces `FloorPlaceholder`, which that test pinned; the task did not name it.** No other existing test was touched.
2. **Tiles derive from their fixture's order** before it is opened, without seeding the book (`fixtureOrder`: `orderTotals` over its groups; `statusOf` over its groups). `OpenTable` no longer carries `status` or `total`; only Table 7's `drafted` stays fixture data. Table 1's tile reads 382.725, before and after opening. **Red:** hard-coding a tile total fails 8 tests (the default/overflow/incident/receipt-warning rows, Table 12, both derived-total tests, Table 1 before-open).
3. Finding 2 (141.750): test kept.
4. **Free-table title is `Order · T<n>`.** **Red:** reverting to `Table n` fails 5 tests (heading, persistence, independence, emptied table, modified click).
5. **Payment sessions keyed per order id.** `usePaymentSessions()` holds one session per order; `PosRoutes` hands the screens the active order's (`forOrder`), and `usePaymentSession()`'s return shape is unchanged (`orderId` from round 1 removed). The lock is `isActive(activeId)`; the floor reads `draftsOf(id)`. **Red case:** Table 1 mid-payment (one Card draft), open Table 9, Settle: no drafts, balance 173.250; back to Table 1: locked, its draft intact. Forcing a single shared session fails that test and the round-1 lock test.
6. **`open-t9`, `open-t12`, `quick-new` added to `ITEM_SHEET_ORIGINS` as `keeps`;** a sheet Cancel returns to its own state (tested). No test pins the list; the loops that walk it only gained rows.
7. Findings 4, 5, 8, 9 recorded as design questions, unchanged: tile counts units vs the panel's lines; `1 line pending` copy; no floor place for an open quick sale; Release and the order bar's `h1` not drawn.
