# PHASE0-011b review

## Verdict

**findings** — one medium-severity finding in the exported error schema's TypeScript output. The session-clock implementation and route-table checks passed review. The full verification run passed.

Reviewed `agent/phase0-011b` at `960c946c3dae35222c7483c2b6b11d66572f8532` against `development` at `e52d0a411d9816632a3e9aff376d0eb2562a05a4` on 2026-10-13.

## Findings

### 1. P2: Preserve the per-code error type in the schema's parsed result

**Location:** `packages/contracts/src/errors.ts:71`, particularly the union construction at line 79.

The `envelope` function receives the entire `ErrorCode` union, so each `z.literal(code)` is typed as that entire union rather than its individual code. The cast to a tuple of `ReturnType<typeof envelope>` preserves this loss of information. The exported schema consequently does not return the existing discriminated `ErrorBody` type. Its parsed result cannot be assigned to that type, and checking a parsed error's code does not make that code's details accessible.

**Authority:** PHASE0-011b's copied ARCH-014 question 4 and rule 4 require client-consumable error-envelope schemas while keeping the existing type names. ADR-010 decision 1 requires details to be typed per code. The separate mapped `ErrorBody` type still satisfies that rule, but the newly supplied parser does not preserve that contract for its consumer.

**Concrete failing scenario:** The 011c API client validates a response with `ErrorBody.parse` and returns it as `ErrorBody`, or switches on `THROTTLED` to read the countdown. Both ordinary uses fail to compile:

```ts
import { ErrorBody, ErrorCode } from '@pos/contracts';

const parsed: ErrorBody = ErrorBody.parse({ error: { code: 'THROTTLED' } });
// TS2322: the schema's output is not assignable to ErrorBody.

const result = ErrorBody.parse({ error: { code: 'THROTTLED' } });
if (result.error.code === ErrorCode.THROTTLED) {
  const seconds = result.error.details?.retryAfterSeconds;
  // TS2339: Property 'details' does not exist on type '{ code: ErrorCode; }'.
}
```

I reproduced both diagnostics with the installed TypeScript compiler using a virtual source file in memory. No file was created or changed for the reproduction. Runtime validation passes; this is a compile-time contract defect that the existing `error-details.types.ts` checks do not exercise.

**Proposed fix:** Construct the schema with individually preserved code literals and their corresponding details shapes, and expose a parser whose output is the existing discriminated `ErrorBody` union. Add compile-time coverage proving that the parse result is assignable to `ErrorBody` and that narrowing to a detail-bearing code exposes its details while a code without details does not. Keep the strict runtime rejection of unexpected fields.

## What I ran and what I did not

- `npm run verify` passed: all typechecks succeeded, followed by **68 test files and 3,269 tests passed**. This is 17 tests and two files above the task's stated baseline of 3,252 tests in 66 files. I did not rerun the development baseline. The run initially waited for the shared database advisory lock and then completed successfully.
- Immediately before and after that green run, `git diff development --stat` reported the same **18 files, 899 insertions and 38 deletions**. Both branch commit IDs were unchanged, and `git status --short --branch` showed a clean worktree. The same status and statistics were checked again before writing this report.
- `git diff --check development` passed. The three source searches confirmed no `Date.now`, `new Date(` or `performance.now` in `domain/session.ts`; no CSRF header literal in server source; and timeout literals only in `SESSION_POLICY`.
- A standalone, file-free runtime probe passed **120 schema assertions**. It covered all 15 error codes, the four codes that permit retry details, unknown codes, extra fields, invalid retry durations, both session-view shapes, invalid roles, and negative or fractional clock values.
- A separate in-memory TypeScript probe reproduced the two diagnostics in finding 1. Its strict compiler and bundler resolution settings match the relevant repository settings. It used the actual contracts sources and installed dependencies.
- I attempted standalone execution of `session-clock.test.ts` through both `npx vitest run apps/server/test/session-clock.test.ts` and `npm run test:unit -- apps/server/test/session-clock.test.ts`. Both attempts failed during setup with `connect EPERM 127.0.0.1:5433`; neither executed tests. The full verification above did execute both new files successfully. I therefore did not independently establish acceptance criterion 2's three consecutive runs of each file alone. The builder's Handoff reports three combined runs of the two files, rather than separate runs of each file.
- I inspected the builder's recorded red proofs but did not rerun those mutations. The TypeScript reproduction above is independent evidence, not a claimed mutation run. No browser checks were performed; this task changes server responses and shared contracts, not a screen.
- I read the binding excerpts copied into the task, the cited session requirements and boundaries, ADR-009, ADR-010, the cited architecture sections, and the relevant merged handoffs. The separately referenced `.agent/reviews/ARCH-014-client-shells.md` is absent from this worktree; the task explicitly supplies its binding sections verbatim, which provided the review authority.

## Cleared

- The SQL computes remaining idle seconds in the same SELECT or UPDATE RETURNING that resolves the session, using PostgreSQL `clock_timestamp()`, rounding down and clamping to the audience limit. No second clock query or JavaScript clock was introduced. The validity predicate, idle predicate, absolute expiry and renewal identity checks remain unchanged.
- I checked the shared clock helpers across fresh sign-in, aged reads, activity, idle sessions and back-office renewal. Fresh sign-in and renewal use the full audience policy as the task explicitly requires; `me` uses its request's database resolution. Neither audience's `me` route becomes interactive. The actor shape remains unchanged, and a refused or idle session gains no actor or successful session view. This preserves FR-A2, FR-A2b, FR-A2c and AC-28 within the changed paths.
- The new clock tests use real sign-in routes and the cookie-jar client before requesting `me`, activity and renewal. Their evidence does not depend on bypassing the production session guard. Existing expiry, audience separation, role, CSRF and renewal tests passed in the full suite.
- The table lists the ten current application API routes, excludes the test probe, and matches the registered routes and their ACTIVE declarations through the `onRoute` hook. Generated HEAD twins are deliberately excluded. Health and non-ACTIVE routes are marked non-interactive.
- Activity, release, logout and error responses are unchanged. The back-office absolute lifetime is not added to the wire. The shared CSRF constant is imported by the guard, with incoming header case normalization retained.
- Runtime schemas are strict and retain the existing error codes and permitted details shapes. No migration, client source, audit behavior, product document or new error code was introduced. Existing test changes are confined to the task's list and the expressly authorized session case 5 change.

Only this review report was written. No source or test file was edited, and nothing was committed or pushed.
