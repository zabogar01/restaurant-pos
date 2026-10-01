# FE-032 review

## Verdict

**findings** — one medium finding. Reviewed `agent/fe-032` at `c225d7d834d9c99b290f7674401d604507df9649` against `development` at `1fc0f6c4deabe5ab8458cfd7933455b55d18d0ba`, the task's requirements and rulings, and its cited contract and design material.

## Findings

### F1 — Medium: An unavailable order hides the refund refusal outcome

**Location:** `apps/pos/src/ClosedOrderScreen.tsx:165`, with the unavailable branch at line 176 and the detail guard at `apps/pos/src/closedOrderDetail.ts:348`. The coverage gap is at `apps/pos/test/refund-screen.test.tsx:901`.

The refund outcome is rendered only inside `Body`, which requires a closed-order detail. If the book answers `not-closed` and now holds an open order, or answers `unknown-order` and no longer holds that order, `bookDetail` returns `undefined`. The approval closes, but the screen renders only “Could not load this order / No order details are available. Try again.” The recorded failure outcome is invisible. The cashier is not told that the refund was refused and nothing was refunded.

**Authority:** FE-032's *Architect consult and owner rulings*, rule 12, explicitly requires `zero-total`, `not-closed`, and `unknown-order` to show “Refund failed · the order is unchanged / Nothing was refunded.” without a refund control, over whatever the book holds. Acceptance criterion 13 requires the screen to draw the book's refusal. This is a failure of that explicit client requirement, not a claim that this task must implement server concurrency or authentication.

**Reproduction observed:** Mount the detail for a closed `table-5` using the existing stub-book helper. Enter a valid allocation, reason, and six digits. Have the stub's refund callback either change the held entry to `status: 'open'` and return `not-closed`, or remove the entry and return `unknown-order`. Both cases draw the generic load error and omit the required refund-failure notice. I ran both cases through an in-memory Vitest transform; both failed the assertion that the screen contains the failure title. The existing test whose title names all three refusals actually returns only `zero-total` and keeps the closed, refundable entry unchanged, so it cannot expose this branch.

**Proposed fix:** Render the refund outcome independently of whether order detail exists, including the unavailable composition, while keeping refund/review actions absent for these refusals. Extend the tests to cover each named refusal with the corresponding book state. The shared `detail` gate currently hides exactly the states in which the outcome rendering is wrong.

## What I ran and what I did not

- I ran `npm run verify` twice, including once after the in-memory checks. Both runs passed typechecking and **36 test files, 2,515 tests, 0 failures**. The final run began at 21:49:09 local time on 2026-10-01.
- Immediately before and after the final green run, `git diff --stat` was empty and both branch hashes remained the values above. `git status --short` was also empty before writing this report. The reviewed tree was stable.
- I ran `git diff --check development...agent/fe-032`; it passed. I inspected the branch diff, refund operation and UI, shared approval changes, route/status readers, tests, design artifact, and the cited rules. The existing-test edits match the task's two named changes plus the lead's explicit additional ruling.
- For F1, I used `startVitest` with a temporary in-memory transform that appended two tests to the loaded refund-screen test module. The run reported **2 failed and 65 skipped**. Only the stub book's data changed in memory; no source or test file was edited, and no production-code mutation was run.
- I attempted `npm run dev -w apps/pos -- --host 127.0.0.1`. The sandbox rejected the listener with `EPERM` on port 5173. I did not independently walk or measure the browser layout. The task's *Lead verify* section records browser measurements, but those are the lead's observations, not mine. CSS and DOM assertions do not establish pixel fit.
- I did not run server/PostgreSQL acceptance checks, printing, real PIN verification, or audit checks. As task rule 16 requires, this review does not close AC-11, AC-14, AC-18, AC-25, or AC-34. I did not run Prettier, commit, or push.

## Cleared

The operation uses bigint amounts, validates original tender positions and exact totals, permits allocations above a tender's contribution, drops zero rows, trims the reason, and preserves original sale facts. Its refusal ordering and unchanged-book identity are covered, as is a second refund in the same tick. The effective-contribution walk handles cash change and repeated tender rows.

The thirteen fixture states and selected-order combinations have explicit assertions. Refund controls are absent for zero-total, refunded, and closed-day orders. Cancel behavior preserves or discards the draft as ruled, and a fresh approval has empty dots. POS-06 uses the shared M-1 dialog; the six-digit completeness option leaves POS-03's existing behavior intact. Fixture confirmations do not write to the book, and session refunds name no approver, as O5 and O6 require.

The successful edited-allocation test uses `PosRoutes`, closes an order through the floor/order/settlement flow, refunds it, and reads its record through detail and list routes. It does not substitute a fixture approval for that path. The refunded status is included in list/detail readers and the Back guard, while the original closed-order edit guard remains in place. These checks passed; the refusal rendering gap above remains.
