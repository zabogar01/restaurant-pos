# PHASE0-002 — Money module

**Status:** Active
**Owner:** `builder2`
**Depends on:** [PHASE0-001](PHASE0-001-monorepo-postgres-migrations.md), complete

## Objective

Build `packages/money`: the only place in this system that rounds, and the only
representation money is allowed to take. Integers in minor units as `bigint`,
half-up division, rate multiplication at one part per million, tax extraction
from a tax-inclusive amount, a canonical base-10 string codec for the wire and
the database, and precision-aware formatting. No domain logic, no database, no
HTTP.

This is **Task 2** of
[the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md).
Work only that task.

## Why this task carries more weight than its size

`B-1` — **money is never a floating-point number, anywhere, ever** — is an
inviolable rule, and this package is where it is either enforced or quietly
lost. Every later task computes through these functions. A rounding error here
is a rounding error in every total, every tax line, and every reconciliation
the product will ever print, and it will be found by a manager whose till does
not balance rather than by a test.

The tax model is settled: **nett**. Tax-inclusive prices, untaxed service
charge, the tax line derived from the total — which is exactly what
`taxIncludedIn` is for. Currency is **IDR at minor-unit precision 0**, but this
package is precision-independent and must stay that way; precision is a
formatting concern and a configuration value, not an assumption baked into
arithmetic.

## Required inputs

| Input | Path | Why |
|---|---|---|
| The plan, Task 2 | [the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Names every file, export, and test, including the worked example |
| Task 1's handoff | [PHASE0-001](PHASE0-001-monorepo-postgres-migrations.md) | What exists, how to run it, and five things found and not fixed |
| Monetary policy | [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) §10, [ADR-004](../../docs/decisions/ADR-004-versioned-exact-nett-monetary-policy.md) | Accepted. Versioned exact nett policy |
| Requirements | [docs/PRD.md](../../docs/PRD.md) §4 and `FR-M1`–`FR-M5` | Precision configured once and immutable after the first order; the cash ceiling |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | `B-1` above all, and `B-2` on rounding |
| Process | [.agent/WORKFLOW.md](../WORKFLOW.md) | Handoff format and ownership |

Run order: `npm run db:up` → `npm run db:migrate` → `npm run verify`. This task
needs no database, but `verify` runs the whole suite and Task 1's migration
tests are in it.

## Rulings from the lead, made on Task 1's findings

These are decided. Apply them; do not re-open them.

1. **Upgrade vitest from `^2.1.0` to 4.** Task 1 reported five advisories, all
   in the vitest 2 dev-server and UI chain — one critical, one high. None is
   reachable the way this repository runs tests today, and none ships. It is
   still the right time: one test file exists now and eleven tasks' worth exist
   later, and a dev-only advisory is exactly the kind of thing that is cheap
   today and an argument in three weeks. The plan's `^2.1.0` is superseded.
   If the upgrade turns anything red, stop and raise it rather than pinning
   back silently.
2. **Add `"engines": { "node": ">=22" }` to the root manifest.**
   `docs/ARCHITECTURE.md` calls for Node LTS; this machine runs 25.2.1, which
   is not LTS, and everything passes on it. The field makes the expectation
   explicit instead of implied. Do not add a `.nvmrc` and do not pin a patch.
3. **Enforce `B-1` at the type level, mechanically.** A rule nothing checks is
   a rule that will be broken by an agent in a hurry. `packages/money`'s public
   surface must make passing a `number` where a `Money` or `Rate` belongs a
   compile error, and that must be proven by type-level tests using
   `@ts-expect-error` that run under `npm run typecheck`. A test that passes
   because the code compiles proves nothing unless something also fails to
   compile on purpose.

## Constraints

- **Follow the plan's paths and exports exactly** — `Money`, `Rate`,
  `RATE_SCALE`, `divHalfUp`, `mulRate`, `taxIncludedIn`, `encodeMoney`,
  `decodeMoney`, `formatMoney`, `rateFromPercent`. Ten later tasks import them.
- **`divHalfUp` is the only rounding in the system** (`B-2`). If you find
  yourself rounding somewhere else, that is the bug.
- **Test-first, and property tests where the plan asks for them.** The worked
  example in the plan is an acceptance case, not an illustration.
- **No `number` for money or rates.** Not in a signature, not in an
  intermediate, not in a test fixture that stands in for real money.
- **Do not edit the contract documents**, `docs/ARCHITECTURE.md`,
  `docs/decisions/`, `.agent/MEMORY.md`, or `.agent/ROADMAP.md`.
- **Do not start Task 3.** The schema and its append-only grants belong to the
  next implementer, and two unresolved items are waiting on my ruling before
  it starts.
- **Branch `agent/phase-0-foundations`.** Never `main`. Do not touch the
  worktree at `../restaurant-pos-design`; a designer is working there.

## Acceptance criteria

1. `npm run verify` passes, and its **verbatim output** is in your handoff.
2. The plan's worked example produces the plan's figures exactly.
3. `divHalfUp` is proven correct on negatives and on exact halves in both
   directions, by tests that fail if the implementation truncates instead.
4. Encode/decode round-trips, and malformed input is rejected rather than
   coerced.
5. Passing a `number` where `Money` or `Rate` is expected fails to compile,
   proven by `@ts-expect-error` tests under `npm run typecheck`.
6. vitest 4 is in place and the suite — Task 1's migration tests included —
   still passes.
7. Nothing in `packages/money` imports a database, a framework, or a clock.

## Out of scope

- Tasks 3 through 12. Schema, PIN, audit, throttling, sessions, HTTPS, auth
  routes, approval, client shells, acceptance tests.
- Currency configuration and the immutability rule in `FR-M1`. The module takes
  precision as an argument; storing and freezing it is a later task.
- Tax *policy* — which rate applies to what. This task extracts tax from an
  amount; it does not decide the amount.
- Design tokens. `packages/tokens` is Task 11's, and its placeholder palette is
  superseded by `docs/DESIGN.md`.

## Handoff

Written by `builder2`. What was done with paths, what was decided and on what
evidence, what was found and not fixed, and what the next implementer needs and
does not have. Include the verbatim verification output. A handoff that says
only "done" has failed.

### 2026-09-14 — `builder2`, Task 2 finished

Three commits on `agent/phase-0-foundations` carry this task. Not merged.

- `412e196`: vitest 4 and the `engines` field (rulings 1 and 2).
- `261129d`: the runtime package. **The lead committed this, not me**, by
  sweeping up my working tree in a docs commit while the task was still in
  progress. I checked it: `git diff HEAD -- packages/money package-lock.json`
  came back empty straight afterwards, so the committed files are
  byte-identical to the ones I verified. No mutation-test mutant was caught
  in it. It is still worth knowing that committing a whole tree while an
  implementer is mid-mutation-run could have committed a deliberately broken
  file.
- `c995851`: the type-level tests and the `typecheck` wiring (ruling 3).

#### What was done

| Path | What |
|---|---|
| `package.json` | `vitest` `^2.1.0` → `^4.1.11`, which resolves to 4.1.11. It is the newest 4.x; 5.0.0 exists, but the ruling said 4. Added `"engines": { "node": ">=22" }`. `typecheck` now also runs `tsc -p packages/money --noEmit` |
| `packages/money/package.json`, `tsconfig.json` | The plan's text, verbatim. `fast-check` `^3.22.0` resolves to 3.23.2 |
| `packages/money/src/rounding.ts` | `divHalfUp`, the plan's code verbatim |
| `packages/money/src/codec.ts` | `Money`, `encodeMoney`, `decodeMoney`, the plan's code verbatim |
| `packages/money/src/format.ts` | `formatMoney`, the plan's code verbatim |
| `packages/money/src/index.ts` | `Rate`, `RATE_SCALE`, `mulRate`, `taxIncludedIn` as the plan has them. **`rateFromPercent` differs from the plan: it takes a string** (decided below) |
| `packages/money/test/rounding.test.ts` | 9 tests. The plan's six, plus exact halves on both sides of zero, a tie-breaking property, a symmetry property, and a check that a negative denominator is rejected |
| `packages/money/test/codec.test.ts` | 24 tests. Round trip, values above 2^53, a property that decoding accepts nothing except a canonical encoding, 18 malformed strings, and a JSON number arriving where a string belongs |
| `packages/money/test/money.test.ts` | 39 tests. `rateFromPercent`, `mulRate`, `taxIncludedIn`, `formatMoney`, and the PRD worked example with every receipt figure checked |
| `packages/money/test/no-number.types.ts` | 21 `@ts-expect-error` assertions. This file is type-checked but never executed |

Acceptance, criterion by criterion:

1. Passes. Output is quoted below.
2. The worked example produces 1650, 165, 1485, 135, 74 and 1559. At
   precision 2 those format as `16.50 1.65 14.85 1.35 0.74 15.59`, which are
   the PRD §4 figures.
3. Negatives and exact halves in both directions are tested, and a
   truncating implementation fails 5 of 9 tests (see the mutation check
   below).
4. The codec round-trips and rejects malformed input. Coercion is shown to be
   caught: a decoder that routes through `Number` goes red.
5. Proven by mutation. Widening a type to accept `number` makes tsc fail with
   TS2578.
6. vitest 4.1.11 is in place, with all 7 Task 1 migration tests among the 79
   that pass.
7. The only imports in `packages/money/src` are the package's own files, and
   the manifest has no runtime dependencies.

#### What was decided, and on what evidence

- **`rateFromPercent(percent: string)`, not `(percent: number)`.** Two
  instructions collided here. The plan's signature takes a `number`, and the
  task says "No `number` for money or rates. Not in a signature", with ruling
  3 requiring a number in a rate position to be a compile error. I kept the
  export name and changed the parameter type. The evidence came from running
  the plan's implementation in a scratch probe:
  - `rateFromPercent(1.0000000000001)` returned `10000n`. An input finer than
    one part per million was silently rounded, against the plan's own test
    "rejects a rate finer than one part per million".
  - `rateFromPercent(1e21)` returned `10000000000000000905969664n`, a
    binary-float artefact baked into a Rate.
  - `rateFromPercent(-0.00001)` threw the precision error, not the negative
    error.

  The string version parses digit by digit, so it is exact. It accepts
  `'10'`, `'12.5'` and `'0.0001'`, plus trailing zeros such as `'10.0'`
  (same value). It rejects anything finer than 1 ppm (`'rate precision'`),
  negatives (`'rate must not be negative'`), and any other shape: exponent,
  sign, leading zero, `%`, whitespace, a separator, or a JSON number
  (`'invalid rate'`). **No consumer breaks:** no later task in the plan calls
  `rateFromPercent` (grep of plan lines 762 onwards). A rate typed into a
  back-office form arrives as a string anyway. **Lead: confirm or overrule.
  This is the one place I departed from the plan's interface.**
- **The plan's worked-example test is arithmetically wrong, so I did not
  copy it.** It builds the subtotal as `1350n + 200n + 150n + 300n` and
  asserts `1650n`, but that sum is 2000. PRD §4 lists the burger line as
  10.00 + 2.00 + 1.50 = 13.50, so the plan counted the variant and cheese
  twice. The test now builds `burger = 1000n + 200n + 150n` and
  `soda = 300n`. Copied verbatim, the plan's acceptance case goes red at its
  second assertion.
- **Ties round away from zero, as the plan's code does:** 2.5 → 3,
  −2.5 → −3. Half-even, truncation and floor-based rounding (ties toward +∞)
  each fail at least 3 tests. See the note on contract wording below.
- **`formatMoney`'s precision stays a `number`.** ADR-004 and ARCHITECTURE §10
  say "ordinary counts remain `number`". Precision is a digit count from 0 to
  6, validated as an integer, and it never takes part in arithmetic.
- **`Money` and `Rate` stay plain `bigint` aliases.** The plan's interface
  says `type Money = bigint`, and ruling 3 only asks that a number be
  rejected, which a bigint alias already does. Branding the types would
  change what ten later tasks write. Its consequence is listed under "Found
  and not fixed".
- **The type tests live in `test/no-number.types.ts`.** vitest's default
  include is `*.{test,spec}.*`, so vitest never executes the file. That
  matters, because executing it would throw on `bigint * number`. `tsc`
  includes `test/` through the package tsconfig. The old `typecheck`
  (`apps/server` only) exited 0 even with a `rateFromPercent` that accepted
  `number`, which is why the script had to change.
- **The type tests were written after the runtime code, not before.** The
  runtime source was the plan's code, already green. For them I proved RED
  by mutation instead:
  - `Money = bigint | number` → 5 × TS2578.
  - `Rate = bigint | number` → 4 × TS2578.
  - `decodeMoney` taking and returning `number` → 2 × TS2578.
  - `divHalfUp` widened → 2 × TS2578.
  - `rateFromPercent(string | number)` → 2 × TS2578.

  Every mutant exited 2, and the restored code exited 0. For the runtime
  files I saw RED as a missing module before each implementation.

**Mutation check, runtime.** Each mutant was run and then restored. Every
one turned at least one test red:

- **`divHalfUp`:** truncation (5 red), half-even (3), ties toward +∞ (4).
- **Codec:**
  - dropping the `typeof` guard (1 red)
  - `^-?[0-9]+$`, which admits `01` and `-0` (2)
  - an unanchored end (8 or more)
  - `BigInt(Number(s))` (2)
- **Operations and format:**
  - `taxIncludedIn` dividing by `RATE_SCALE` instead of `RATE_SCALE + r` (5)
  - `mulRate` truncating (2)
  - no precision check (1)
  - no negative-rate guard (1)
  - `RATE_SCALE = 100_000n` (4)
  - no trailing-zero strip (1)
  - `formatMoney` dropping the sign (1)

#### Verification, verbatim

The run was on a fresh `git clone` of `c995851` into a path containing a
space, with Docker's PostgreSQL already up: `npm ci` (`found 0
vulnerabilities`), then `npm run db:migrate` (`applied:
0001_extensions.sql`), then `npm run verify`:

```
> verify
> npm run typecheck && npm run test:unit


> typecheck
> tsc -p apps/server --noEmit && tsc -p packages/money --noEmit


> test:unit
> vitest run


 RUN  v4.1.11 /private/tmp/claude-501/-Users-fajars-Work-Dev-POS-System-restaurant-pos/aba67508-f3c6-4593-a1df-3cdd6e5a61e1/scratchpad/clean checkout/restaurant-pos


 Test Files  4 passed (4)
      Tests  79 passed (79)
   Start at  15:59:01
   Duration  764ms (transform 88ms, setup 0ms, import 232ms, tests 670ms, environment 0ms)
```

`verify exit=0`. The working tree gives the same result. vitest 4's default
reporter no longer lists files, so `npx vitest run --reporter=verbose` was
used for the breakdown:

| Test file | Tests |
|---|---|
| `apps/server/test/migrate.test.ts` | 7 |
| `packages/money/test/codec.test.ts` | 24 |
| `packages/money/test/money.test.ts` | 39 |
| `packages/money/test/rounding.test.ts` | 9 |

`npm audit` found 0 vulnerabilities, down from 5. Nothing was skipped.

#### Found and not fixed

1. **The plan's Task 2 text is still wrong in two places.** It is the lead's
   file, so I left it.
   - The worked example sums to 2000 (above).
   - `rateFromPercent` still reads `(percent: number)`, with float code and
     `rateFromPercent(10)` in its tests.

   Proposed replacements: Step 11's subtotal line becomes
   `const burger = 1000n + 200n + 150n; const subtotal = burger + 300n;`,
   and the interface line becomes `rateFromPercent(percent: string): Rate`.
2. **`Money` and `Rate` are the same type,** so `mulRate(rate, amount)`
   compiles with the arguments swapped, and so does adding a rate to a total.
   Branded types (`bigint & { readonly __brand: 'Money' }`) would catch this,
   but every literal would then need a constructor, and the plan's
   `type Money = bigint` interface would change. That is an interface
   decision for the lead or architect, not one to take inside this task.
3. **The type tests only guard the surface that exists today.** A new
   function added later with a `number` money parameter is caught by
   nothing. This is still `builder1`'s open item 6: a lint rule would need a
   decision on ESLint.
4. **The contract says "half-up" but never says what that means below
   zero.** `B-2` and `FR-M3` write "half-up". The code, and now the tests,
   use half away from zero, so −74.5 → −75. That keeps a refund the exact
   negation of its sale, whereas floor-style half-up would give −74 and a
   refund one rupiah short of the sale. **Proposed wording for FR-M3,** for
   the owner and not applied by me: "Computed fractions round **half away
   from zero** (0.5 → 1, −0.5 → −1) at the point of becoming a stored or
   displayed value."
5. **`FR-M5`'s ceilings are enforced nowhere yet:** 99,999,999 for a line,
   order or tender, and 9,999,999 for change. `decodeMoney` accepts any
   integer, including negatives, which refunds need. The bounds are domain
   validation for a later task. They do not belong in the codec.
6. **`formatMoney` does no grouping and adds no currency symbol.** It
   renders `15590`, not `Rp 15.590`. The frontend (FE-001 onwards) will want
   grouping. Checked on this machine:
   `new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0})`
   formats a **bigint** exactly (`Rp 9.007.199.254.740.993`). Wrapping the
   value in `Number(...)` first prints `Rp 9.007.199.254.740.992`. Any
   display helper must pass the bigint straight in, never `Number(m)`. That
   is a `B-1` trap waiting for a UI agent.
7. **`@pos/money` ships TypeScript source** (`"main": "src/index.ts"`). It
   resolves through the workspace symlink under tsx, vitest, and Vite's
   bundler resolution. Checked: `tsx` importing `@pos/money` from
   `apps/server` gives `15.59 135n`. Plain `node` cannot import it.
8. **`builder1`'s items 1 and 2 are unchanged.** One is parallel test files
   racing on one database, the other the superuser pool. vitest 4 still runs
   files in parallel. The money tests are pure and add no race.

#### What the next implementer needs and does not have

- **Import from `@pos/money`.** Rates come in as decimal-percent strings
  through `rateFromPercent('10')`. Money crosses JSON as a canonical string
  through `encodeMoney` and `decodeMoney`, and is never `Number()`-ed.
  `divHalfUp` is the only rounding function in the system. If you write `/`
  on money anywhere else, that is the bug.
- **`taxIncludedIn` is display-only (`B-4`).** Nothing adds it to a total.
  The nett order of operations is in ARCHITECTURE §10, and the worked-example
  test is its executable form.
- **To add a type-level guard for a new export,** add a `@ts-expect-error`
  line to `packages/money/test/no-number.types.ts`. `npm run typecheck`
  picks it up. Adding a new package means adding its `tsc -p` call to
  `typecheck`, because the script lists projects explicitly.
- **Task status still reads `Active`.** Moving it is the lead's call.
