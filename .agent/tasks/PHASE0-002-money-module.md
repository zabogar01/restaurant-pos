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
