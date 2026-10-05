---
id: PHASE0-003a
title: Brand Rate so a swapped rate and amount no longer compile
category: feature
touches: [money]
depends_on: []
owns: [packages/money/**]
status: not-started
cycles: 0
---
# PHASE0-003a — Brand `Rate`

**Written** 2026-10-05 by the lead, from the architect consult ARCH-006
(`.agent/reviews/ARCH-006-phase0-core-schema.md`, section 7). First of three slices of Phase 0
Task 3; 003b (test harness and database roles) and 003c (schema) follow and do not depend on it.

## Objective

In `packages/money`, `Rate` and `Money` are both plain `bigint`, so `mulRate(rate, amount)` with
its arguments swapped compiles and silently computes the wrong figure. The lead ruled on
2026-09-14 to brand `Rate` and leave `Money` as `bigint`. When this task is done, `Rate` is a
branded `bigint` that only the module's two constructors produce, the swap fails
`npm run typecheck`, and a compile-time test proves it.

## Required inputs

- `packages/money/src/index.ts` (`Rate`, `RATE_SCALE`, `rateFromPercent`, `mulRate`,
  `taxIncludedIn`), `src/codec.ts` (`Money`).
- `packages/money/test/money.test.ts` and `packages/money/test/no-number.types.ts` (the
  compile-time B-1 test: checked by `npm run typecheck`, never executed; read its header).
- ARCH-006 section 7 (*The `Rate` brand*), which this file follows.
- Client callers, which must keep compiling **unchanged**: `apps/pos/src/discount.ts:1,74-76,
  96-97,114,121,143-147`, `apps/pos/src/discountChange.ts:66`, `apps/pos/src/closedOrders.ts:215`.
  Every rate there comes from `rateFromPercent`, and each compares a `Rate` with `RATE_SCALE`.

## What to build

1. **The brand.** `Rate` becomes a branded `bigint` (for example
   `bigint & { readonly __rate: unique symbol }`, or an equivalent declared brand). `Money`
   stays plain `bigint` (lead's ruling, 2026-09-14). A `Rate` must still compare with and
   multiply as a `bigint`, so `rate > RATE_SCALE` and the arithmetic inside `mulRate` and
   `taxIncludedIn` compile without casts.
2. **Two constructors, and the only casts.** `rateFromPercent(percent: string): Rate` keeps its
   behaviour and gains the one cast at its return. Add `rateFromPpm(ppm: bigint): Rate`, which
   rejects a negative with the same message `rateFromPercent` uses (`'rate must not be
   negative'`) and otherwise returns its argument branded. It is how a rate read from a `bigint`
   column, a property test's generated rate, or a fixture rate becomes a `Rate`. Export it from
   the package's public surface. No other `as Rate` anywhere in `src/`.
3. **Leave `RATE_SCALE` a plain `bigint`.** It is a scale, not a rate.
4. **The runtime guards stay.** `mulRate` and `taxIncludedIn` still throw on a negative rate:
   the type cannot stop a cast.

## Tests expected to change

Only these two files. Any other test that changes: stop and raise it.

- `packages/money/test/money.test.ts`:
  - the negative-rate cases `mulRate(1485n, -1n)` (`:75`) and `taxIncludedIn(1485n, -1n)`
    (`:116`) keep **one deliberate `as Rate` cast each**, with a comment that they test the
    runtime guard behind the type;
  - `taxIncludedIn(1485n, 0n)` (`:112`) uses `rateFromPpm(0n)`;
  - the three property tests that pass an `fc.bigInt` as the rate (`:91-92`, `:123-129`,
    `:139-140`) wrap it in `rateFromPpm`;
  - add cases for `rateFromPpm`: returns its argument for `0n`, `1n` and `RATE_SCALE`; throws
    `'rate must not be negative'` for `-1n`.
- `packages/money/test/no-number.types.ts`:
  - `const rate: Rate = 100_000n;` (`:25`) no longer compiles; make it
    `rateFromPpm(100_000n)`;
  - add, each under its own `// @ts-expect-error` with a reason: a bare `bigint` literal is not
    a `Rate`; `mulRate(rate, amount)` (the swap, with `amount: Money` and `rate: Rate` as already
    declared there); `taxIncludedIn(rate, amount)`; `rateFromPpm(100_000)` (a `number`).

`apps/pos/test/discount.test.tsx:482-485` asserts the source text of `discount.ts`
(`rateFromPercent(value.percent)`, `mulRate(subtotal, rate)`); `discount.ts` must not change, so
that test must not either.

## Constraints

- **Touch only `packages/money/`.** No file under `apps/`, `db/` or the root. If the compiler
  names an error in `apps/pos`, stop and raise it rather than editing the client.
- B-1: no `number` reaches money or a rate; nothing here may weaken an existing
  `@ts-expect-error` in `no-number.types.ts`.
- B-2 and FR-M3: rounding is untouched. Do not edit `rounding.ts`, `codec.ts` or `format.ts`.
- **Stated limit, say it in the Handoff:** `Money` stays `bigint`, so a `Rate` is still accepted
  where `Money` is wanted (`mulRate(rate, rate)` compiles). The brand catches the swap and a bare
  `bigint` passed as a rate, and nothing else.

## Acceptance criteria

1. `npm run typecheck` passes, and fails with a type error if the directive above any one of the
   new `@ts-expect-error` lines is removed (the Handoff shows one such run). Red if
   `mulRate(rate, amount)` compiles.
2. `grep -n "as Rate" packages/money/src` shows exactly the cast(s) inside `rateFromPercent` and
   `rateFromPpm`; `grep -rn "as Rate" packages/money/test` shows exactly the two negative-rate
   cases.
3. `npm run verify` is green with the same client test-file and test counts as before the change
   (2722 tests in 41 files on `31483c2`, plus only the new `rateFromPpm` cases). No file under
   `apps/` is in `git diff --name-only development...HEAD`.
4. `rateFromPpm(-1n)` throws `'rate must not be negative'`; `rateFromPpm(0n)`,
   `rateFromPpm(1n)` and `rateFromPpm(RATE_SCALE)` return their argument.
5. All existing `money.test.ts` expectations keep their values.

## Out of scope

- Branding `Money` (ruled against). Any `Money` constructor.
- Any database, server or client change, including `discount.ts:96-97`'s two literal rates
  (a fixture stand-in that Phase 2 removes).
- FR-M3 and B-2's "half-up" wording (owner's, QUEUE 12).

## Handoff

**What I did.** In `packages/money/src/index.ts`, `Rate` is now `bigint & { readonly __rate: unique symbol }`. `rateFromPercent` keeps its behaviour and carries one cast at its return. A new exported `rateFromPpm(ppm: bigint): Rate` throws `'rate must not be negative'` for a negative and otherwise returns its argument branded; it holds the only other `as Rate` in `src/`. `RATE_SCALE` stays a plain `bigint`, and the runtime negative-rate guards in `mulRate` and `taxIncludedIn` are unchanged. In `packages/money/test/money.test.ts` I added `rateFromPpm` cases (`0n`, `1n` and `RATE_SCALE` returned unchanged; `-1n` throws), wrapped the generated rates of the three property tests and the `0n` rate in `rateFromPpm`, and gave the two negative-rate cases one commented `as Rate` cast each. In `packages/money/test/no-number.types.ts`, `rate` is now `rateFromPpm(100_000n)`, and I added four `@ts-expect-error` lines, each with a reason: a bare `bigint` is not a `Rate`, `mulRate(rate, amount)` (the swap), `taxIncludedIn(rate, amount)`, and `rateFromPpm(100_000)` (a `number`). `bareRate` was added to the trailing `void [...]` list so it is not an unused variable. Nothing is committed in this handoff text itself; the commit is on `agent/phase0-003a` (see `git log`).

**Evidence for the decisions.** Red proof for acceptance criterion 1: I removed the directive above `mulRate(rate, amount)` and ran `npm run typecheck`. It failed with `packages/money/test/no-number.types.ts(30,17): error TS2345: Argument of type 'bigint' is not assignable to parameter of type 'Rate'.` I then restored the directive. I proved only this one of the four new directives red, as the task asked for one run. The `grep -rn "as Rate" packages/money` output is exactly four lines: `src/index.ts:48` and `:57` (the two constructors) and `test/money.test.ts:88` and `:130` (the two deliberate negative-rate casts), which meets criterion 2. No file under `apps/` changed, and the client callers compiled unchanged.

**Existing tests changed.** Only the two files the task lists. In `money.test.ts` the changes were the ones above, and every existing expectation keeps its value. In `no-number.types.ts`, `const rate: Rate = 100_000n` no longer compiled, so it became `rateFromPpm(100_000n)`. No existing `@ts-expect-error` was weakened.

**Stated limit.** `Money` stays a plain `bigint` (lead's ruling, 2026-09-14), so a `Rate` is still accepted where `Money` is wanted, and `mulRate(rate, rate)` compiles. The brand catches a swapped rate and amount and a bare `bigint` passed as a rate, and nothing else.

**Found and not fixed.** Nothing. I did not run Prettier and no formatter touched any file.

**`npm run verify` output.** Typecheck of `apps/server`, `packages/money` and `apps/pos` is clean. Vitest: `Test Files 41 passed (41)`, `Tests 2726 passed (2726)`. That is the baseline 2722 tests in 41 files plus the four new `rateFromPpm` cases (three returns-unchanged cases and one throw).

**Next agent.** Nothing outstanding. 003b and 003c do not depend on this. When Phase 2 reads a rate from a `bigint` column, it should go through `rateFromPpm`. No browser was needed or used.

DONE
