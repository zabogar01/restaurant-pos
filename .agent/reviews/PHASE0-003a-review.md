# PHASE0-003a review

## Verdict: clean

The task and implementation satisfy the reviewed requirements, including ARCH-006 section 7. There are no findings or remaining blockers. The final reviewed branch is `agent/phase0-003a`, at `f77b871e89eedffade87d84bcad42932af8b05da`, against `development` at `31483c2c391b9b19e30be196fd40243b4d82d168`.

## Findings

None. The previously missing architect input was supplied in commit `f77b871` and has now been reviewed.

## What I ran and what I did not

I ran `npm run verify` myself. It exited successfully: server, money and POS typechecks passed; Vitest reported **41 test files passed and 2,726 tests passed**. This matches the task's baseline of 2,722 tests plus the four new constructor cases. These are suite-wide counts, not a claim that all 2,726 tests belong to the client.

Before and after that green run, `git diff --stat` was empty and `git status --short --branch` showed a clean `agent/phase0-003a` tree. The branch comparison remained four files, 178 insertions and 11 deletions: the task file and the three expected money files. No `apps/` file changed. The review report was written after these stability checks.

That verification ran at `5328c26f98b500117b8836d82af16c9d313dda8b`. On resumption, `git diff 5328c26..HEAD --stat` showed only the addition of `.agent/reviews/ARCH-006-phase0-core-schema.md`; the diff for `packages/money` and `apps/pos` was empty. The only untracked file was this review report. Section 7 adds no requirement that changes the completed checks, so I did not repeat verification, as the follow-up instruction permits.

I independently removed each of the four new error directives in memory, one at a time, using the installed TypeScript compiler API with the money package's parsed tsconfig and `noEmit`. The bare bigint assignment produced TS2322 at `no-number.types.ts:29`; the swapped `mulRate` and `taxIncludedIn` calls produced TS2345 at lines 31 and 33; the number passed to `rateFromPpm` produced TS2345 at line 35. Each run produced exactly that one diagnostic. These were compiler-host mutations in memory, not file edits or four separate `npm run typecheck` invocations. Two initial compiler-import attempts failed before these successful checks.

I read the task, the branch diff, B-1 through B-24, the PRD monetary requirements and worked example, the money source and tests, and the cited unchanged client callers. I checked the package export and typecheck configuration. `rg -n "as Rate" packages/money/src packages/money/test` returned exactly two constructor casts and two deliberate negative-rate test casts.

I subsequently read ARCH-006 section 7, “The `Rate` brand,” at lines 601–658 and compared it with both the task and the implementation. I did not run a browser or claim screen coverage: this task builds no screen or UI state. I did not edit source, tests or the task, and did not commit or push.

## Cleared

ARCH-006 section 7 calls for a separate money slice, a negative-rejecting `rateFromPpm` constructor, deliberate casts only for the negative-rate tests, a compiler-checked argument-swap failure, and an explicit statement that `Money` remains bigint. The task captures those requirements and the build fulfills them. The unchanged client compiles, and the fixture tax and service rates remain explicitly outside this task's scope, consistent with section 7's Phase 2 note.

The brand rejects bare bigint rates and both argument swaps, while `Money` and `RATE_SCALE` retain their specified bigint representation. The public `rateFromPpm` constructor preserves zero, one and the scale and rejects negative input with the required message. Existing number-rejection directives remain intact, supporting B-1 and FR-M2 at the typed API boundary.

For the shared-value check, I examined `RATE_SCALE` across zero-rate extraction, multiplication, inclusive-tax calculation, discount limits and the client's 100% comp detection. The brand does not change bigint arithmetic or comparisons. Negative-rate guards remain independently exercised behind deliberate casts. No wrong-state behavior was found in these paths.

The percent parser's arithmetic, the rounding implementation and all pre-existing runtime expectations are unchanged. This preserves the reviewed behavior under B-2 and FR-M3, the one-part-per-million representation under FR-M5, and included-tax extraction under B-4. The documented limitation is accurate: because `Money` remains bigint, a `Rate` can still occupy the amount position and `mulRate(rate, rate)` is not prevented. That is explicitly allowed by this task, not a defect introduced by the implementation.

## Handoff

The missing-input blocker is resolved. I completed the comparison against ARCH-006 section 7 and updated this report to a clean verdict with zero findings. The earlier verification and four in-memory negative type checks still apply because the intervening commit adds only the architect report. There is no outstanding review work. The lead can use this report as evidence for the task's next gate; no source or task-file changes were made.

DONE
