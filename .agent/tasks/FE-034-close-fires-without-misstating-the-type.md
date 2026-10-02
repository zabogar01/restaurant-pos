---
id: FE-034
title: A quick sale's close sends its lines without misstating the order type, and the suite runs without jsdom noise
category: quick
touches: []
depends_on: []
owns: [apps/pos/src/fire.ts, apps/pos/src/close.ts, apps/pos/test/fire-order.test.ts, apps/pos/test/close-order.test.ts, apps/pos/test/floor-quick-sale.test.tsx]
status: active
cycles: 0
---
# FE-034 — Close fires without misstating the type; one quiet test

**Why this task exists.** It is the housekeeping slice the owner asked for on
2026-10-02: two small defects left over from FE-027 and FE-033, neither of
which changes what the POS does. Nothing here is new behavior.

## Objective

Two things become true, and nothing else changes:

1. `closeOrder` (`apps/pos/src/close.ts`) sends a quick sale's PENDING lines
   to one `queued` round **without telling `fireOrder` that the order is a
   table**. The round-building both operations share lives in one function in
   `apps/pos/src/fire.ts` that takes no order type and no lock, and
   `fireOrder` keeps every refusal it has today.
2. `npm run verify` prints no `Not implemented: navigation to another
   Document` line. Today the POS suite prints exactly one.

## Required inputs

- **Defect 1, as it stands.** `apps/pos/src/close.ts:86-90` at `development`
  (`658fdfd`):
  ```ts
  if (orderVariant(order) === 'quick_sale') {
    const fired = fireOrder(order.groups, { type: 'table', unavailable: order.unavailable ?? [], locked: false, firedAt: closedAt });
    if (fired.refused && fired.refused !== 'nothing') return { refused: { reason: 'unavailable' } };
    if (!fired.refused) groups = fired.groups;
  }
  ```
  The branch runs only for a quick sale, and it passes `type: 'table'`. It
  does so because `fireOrder` (`apps/pos/src/fire.ts:152-173`) refuses a
  quick sale first (`if (type === 'quick_sale') return refuse('quick_sale')`),
  which is right for the Send control: PRD FR-E5 says a quick sale "presents
  no fire control at all — settling fires it". So the close lies about the
  type to get past a refusal that was never meant for it, and it passes
  `locked: false` for the same reason. The result is correct today; the call
  is false, and the next reader of `fireOrder`'s `type` cannot trust it.
- **What `fireOrder` does after its two gate checks** (`fire.ts:161-172`): it
  collects `sendableLines`, refuses `'nothing'` when there are none, refuses
  with `fireRefusal(blockingLines(lines, unavailable))` when a PENDING line
  holds an 86'd item (FR-E4, B-17), and otherwise returns the fired rounds
  followed by one new round: `round` is the highest fired round plus one,
  `firedAt` is the argument, `delivery` is `'queued'`, and each sent line has
  `status: 'fired'`. Every refusal returns the very same `groups` reference
  (B-20).
- **The lead's ruling on the shape.** Extract that second half into an
  exported function in `fire.ts`, named `sendPending`:
  ```ts
  export function sendPending<G extends RoundGroup>(
    groups: ReadonlyArray<G>,
    { unavailable, firedAt }: { unavailable: ReadonlyArray<string>; firedAt: string }
  ): { groups: ReadonlyArray<G | RoundGroup>; refused?: undefined } | { groups: ReadonlyArray<G>; refused: FireRefusal | 'nothing' }
  ```
  `fireOrder` keeps its signature, its `FireInput` type and its order of
  refusals (`quick_sale`, then `locked`, then whatever `sendPending`
  answers), and delegates the rest to `sendPending`. `closeOrder` calls
  `sendPending` and no longer imports `fireOrder`. If the generic return type
  cannot be expressed this way without a cast, say so in the Handoff and keep
  the types honest rather than casting.
- **Callers, counted by the lead.** `fireOrder` has two callers in `src`:
  `orderStore.ts:398` (the Send control; unchanged by this task) and
  `close.ts:87`. `OrderPanel.tsx` imports `blockingLines`, `fireRefusal`,
  `holdsUnavailable` and `sendableLines` and is not touched.
- **A refusal nothing pins.** `closeOrder` returns
  `{ refused: { reason: 'unavailable' } }` when a quick sale holds a PENDING
  line whose item is 86'd. No test in `apps/pos/test/` asserts it (the lead
  grepped; the explorer confirmed). This task adds that test, so the refactor
  cannot drop the refusal unseen.
- **Defect 2, as it stands.** `apps/pos/test/floor-quick-sale.test.tsx:175-186`
  ("Resume opens that order client side; a modified click opens nothing")
  dispatches a `metaKey` click on the strip's Resume link and lets jsdom
  attempt the navigation, which prints the line to stderr. It fails nothing.
  The older test of the same behavior, `apps/pos/test/floor.test.tsx:503-518`,
  shows the pattern to follow: a listener on `document.body` records
  `event.defaultPrevented` (proving the app left the click alone) and then
  calls `preventDefault()` itself, so jsdom never navigates.
  Reproduce with `npx vitest run test/floor-quick-sale.test.tsx` in
  `apps/pos`; the whole POS suite prints the line once.
- **Requirements cited.** `docs/PRD.md` FR-E4 and FR-E5 (lines 177-181);
  `docs/BOUNDARIES.md` B-16 (a fire sends only lines not previously fired),
  B-17 (an unavailable item never reaches the kitchen) and B-20 (no action
  leaves partial state).

## Constraints

- **No behavior changes.** No screen, copy, route, fixture or CSS is touched.
  The only source files edited are `fire.ts` and `close.ts`.
- **The money in `closeOrder` is not touched.** `kept`, `position`,
  `closeRefusal`, `tenders`, `change` and `total` (`close.ts:79-83` and
  `91-99`) stay exactly as they are. If you find you need to change any of
  them, stop and end BLOCKED.
- `fireOrder`'s refusals, their order, and the same-reference return on a
  refusal (B-20) are unchanged. A quick sale still cannot be fired by the
  Send path (FR-E5).
- `sendPending` reads no clock and takes no order type, no lock and no
  variant. It is not handed to any component.
- Do not silence the jsdom line by filtering stderr, by a vitest
  `onConsoleLog`, or by a global jsdom setting. Fix the one test.
- No formatter. This repository has no Prettier config; do not run Prettier
  or any other formatter over a file. Match the file's formatting by hand.
- Update the doc comments on `fireOrder` and `closeOrder` so they describe
  the new split truthfully. `close.ts:67-68` says the round is "built by
  `fireOrder`"; after this task that is false.

## Tests expected to change

- `apps/pos/test/floor-quick-sale.test.tsx:175-186` — the modified-click
  half of that one test is rewritten to the body-listener pattern. Its
  assertions on the plain press (the path, the title, the count and the
  total) stay as they are.
- **No other existing test changes.** `apps/pos/test/fire-order.test.ts`
  (T-1 to T-8 and the two untitled cases) and
  `apps/pos/test/close-order.test.ts` pass unmodified; you only **add** tests
  to those two files. If any other test goes red, stop and end BLOCKED with
  its name: it means behavior moved.

## Acceptance criteria

1. **The close no longer misstates the type.** `apps/pos/src/close.ts` holds
   no `type: 'table'` and no `fireOrder`; it calls `sendPending`. Red case:
   `grep -n "type: 'table'\|fireOrder" apps/pos/src/close.ts` prints a line.
2. **One round builder.** `fireOrder` contains no round-building of its own:
   the `sendableLines`, `blockingLines` and new-round code appears once in
   `fire.ts`, inside `sendPending`. Red case: a second copy in `fireOrder`.
3. **`sendPending` answers as `fireOrder` did for a table.** New tests in
   `fire-order.test.ts`, each comparing `sendPending(groups, { unavailable,
   firedAt })` against `fireOrder(groups, { type: 'table', unavailable,
   locked: false, firedAt })` with `toEqual`, for: lines pending after a
   fired round; nothing pending (refused `'nothing'`, and `groups` is the
   same reference by `toBe`); and a PENDING 86'd line (the refusal, and
   `groups` the same reference by `toBe`). Red case: any of the three
   differs.
4. **`fireOrder` still refuses a quick sale and a lock before anything
   else.** The existing T-4 cases pass unmodified, and a new case shows a
   quick sale that also holds a PENDING 86'd line is refused `'quick_sale'`,
   not the 86 refusal. Red case: the order of refusals changed.
5. **The unpinned refusal is pinned.** A new test in `close-order.test.ts`:
   closing a `quick_sale` whose PENDING line has `itemId: 'steak'`, with
   `unavailable: ['steak']` and a tender covering the total, returns
   `{ refused: { reason: 'unavailable' } }` and no `closed`. A second new
   test: the same order with `unavailable: []` closes, with one `queued`
   round stamped `closedAt`. Red case: the first closes, or the second
   refuses.
6. **A quick sale with nothing pending still closes.** New test: a
   `quick_sale` whose only group is a fired round closes with `groups` the
   same reference as the input (`toBe`). Red case: a refusal, or a new round.
7. **The suite is quiet.** In `apps/pos`, the output of `npx vitest run`
   holds no `Not implemented` line. Read the output yourself (a pipe to
   `grep` is not on your allowlist and would stop on a permission prompt);
   the lead checks it with `grep -ci "not implemented"`, which must print
   `0`. Red case: the line is printed once, as it is at `658fdfd`.
8. **The modified-click test still proves its point.** It asserts that the
   app did not prevent the default of the `metaKey` click
   (`defaultPrevented` false when the body listener sees it) and that the
   path is still `/pos/floor`. Red case: `isPlainClick` treating a `metaKey`
   click as plain makes it fail.
9. `npm run verify` is green from the repository root (the server's
   migration tests need `npm run db:up`; say so if they could not run). The
   baseline at `658fdfd` is 2537 tests in 37 files; the count rises only by
   the tests you add.

## Out of scope

Each of these is deliberate, not forgotten.

- **`closeOrder` accepting a non-cash tender above the balance** (B-5,
  ARCH-003 question 9.6). It is a money rule and gets its own task with an
  architect consult. Do not add a tender check.
- **Copy for the `unavailable` close refusal.** On the settlement screen a
  quick sale holding an 86'd PENDING line has a live-looking Close that does
  nothing. The settlement design draws no such state, so it goes to the
  designer first. Do not add a notice, a reason or an `aria-describedby`.
- **The reopened book-only order landing on `?state=default`**
  (`FloorScreen.tsx:182`). It needs an order identity in the URL, which
  waits on the server's order ids.
- **`orderStore.ts`, `OrderPanel.tsx`, `SettlementScreen.tsx`** and every
  other source file.
- Prettier configuration, and the other modified-click tests
  (`floor.test.tsx`, `closed-orders.test.tsx`, `closed-order.test.tsx`,
  `incidents.test.tsx`), which already print nothing.

## Handoff

**What I did.** In `apps/pos/src/fire.ts` I extracted the round-building into an exported `sendPending(groups, { unavailable, firedAt })` with exactly the signature the task gave; no cast was needed, the generic return type expresses cleanly. `fireOrder` keeps its signature, `FireInput` and its refusal order (`quick_sale`, then `locked`, then whatever `sendPending` answers) and delegates the rest; the `sendableLines`, `blockingLines` and new-round code now appears once, inside `sendPending`. `apps/pos/src/close.ts` imports and calls `sendPending` and no longer holds `type: 'table'` or `fireOrder`; the `kept`, `position`, `closeRefusal`, tender, change and total lines are untouched. Doc comments on `fireOrder` and `closeOrder` were rewritten to describe the split. In `floor-quick-sale.test.tsx` the modified-click half of the Resume test now uses the `document.body` listener pattern from `floor.test.tsx:503-518`; its plain-press assertions are unchanged.

**Tests added.** `fire-order.test.ts`: a quick sale holding a pending 86'd line is refused `'quick_sale'`; a `sendPending` describe with three cases (pending after a fired round, nothing pending, pending 86'd line), each `toEqual` against `fireOrder` with `type: 'table'`, and `toBe` on `groups` for the two refusals. `close-order.test.ts`: a quick sale with an 86'd pending line refuses `{ reason: 'unavailable' }` with no `closed`; the same order with `unavailable: []` closes with one `queued` round stamped `closedAt`; a quick sale with only a fired round closes with `groups` the same reference.

**Existing tests changed.** Only the one the task listed, `floor-quick-sale.test.tsx` "Resume opens that order client side; a modified click opens nothing". No other existing test was modified.

**Red proofs.** (1) Dropping the `unavailable` refusal from `closeOrder` made the new close test fail ("expected undefined to deeply equal { reason: 'unavailable' }"). (2) Moving `sendPending` ahead of the gate checks in `fireOrder` made the new quick-sale-plus-86 test fail (received the 86 refusal object, not `'quick_sale'`). (3) Removing `event.metaKey` from `isPlainClick` in `navigation.ts` made the rewritten modified-click test fail at `expect(preventedByUs).toBe(false)`. All three mutations were reverted; `git status` shows only the five owned files modified. I did not mutate the `sendPending` equality tests separately (criterion 3).

**Found, not fixed.** Nothing new. The out-of-scope items (non-cash tender above balance, copy for the `unavailable` close refusal, reopened book-only order URL) are untouched.

**Verify.** `npm run verify` from the root: typecheck clean; 37 files, 2544 tests passed (baseline 2537 plus my 7 added). The output holds no `Not implemented` line (read by eye; I did not grep). The server migration tests are part of that run and passed; I did not separately run `db:up`. No formatter was run; formatting was matched by hand. No browser was needed or used.

**Next agent.** Nothing missing.

DONE

