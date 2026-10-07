# PHASE0-006b review

## Verdict

**clean** — no actionable findings.

Reviewed `agent/phase0-006b` at `7c6d55f4820b918d49bb6c2ebd5d6cca4c7cd5ca` against
`development` at `20ae39e97fcc21a9923cba6b35bbf8b47c96a968`, using the task file,
ARCH-007 §8 and its PIN reuse task instructions, FR-A4 and FR-B3, B-12 and B-13,
and the PIN reuse and reactivation rulings dated 2026-10-06 and 2026-10-07.

## Findings

None.

## What I ran and what I did not

I ran `npm run verify` from this worktree. It exited successfully: typechecking
passed, and **49 test files and 2,844 tests passed**. That is six more tests than
the task's recorded development baseline of 49 files and 2,838 tests, matching
the five added PIN tests and one added schema test. The output did not break
counts down by project. I did not independently rerun the client project alone;
the task's 40 client-project files and 2,719 tests are baseline figures, not a
separately observed result from this review. No client code or tests changed.
The run emitted a Vite warning about future native configuration loading, but
no check failed.

I checked the branch diff, the implementation commit `4128484`, and
`git diff --check development`, which passed. Before and after the green verify
run, `git diff --stat development` was identical: five files, 251 insertions,
and two deletions. `git status --short --branch` showed a clean tree both times,
and both branch commit IDs remained unchanged. The report was added only after
those checks.

I read the production PIN functions, the original staff migration, the new
migration, the migration runner, and the relevant tests and database harness.
The tests use the real domain functions and application pool for user creation
and lookup; owner connections perform the expressly permitted fixture changes.
Each test resets the test database and applies the real migrations in order.

I did not rerun either mutation proof. The builder's Handoff reports 15 of 27
PIN tests failing when the conflict predicate was removed, and cases 2–5 plus
the added schema case failing when the index predicate was removed. Those are
builder-reported results, not mutation runs observed by this reviewer. The
reviewed tree contains both predicates. I did not run `npm run db:migrate`
against the development database, perform browser testing, commit, or push.
There is no screen or visual design artifact in this task.

## Cleared

- `db/migrations/0006_staff_user_active_pin_lookup.sql:6` replaces the old index
  with the required unique index over active rows. Existing migrations and
  grants remain untouched. The runner applies each migration transactionally,
  so the index replacement is atomic.
- `apps/server/src/domain/pin.ts:69` includes the matching conflict predicate.
  It landed in the same implementation commit as the migration and is the only
  change in that module. Active duplicates still take the fixed `PIN already
  in use` path; database failures still discard PostgreSQL error details,
  preserving B-12. Existing error-exposure coverage passed.
- I specifically checked the shared PIN value across active, inactive, reused,
  and attempted-reactivation states. The index enforces uniqueness only among
  active holders (FR-A4), while `findUserByPin` selects only an active row and
  verifies that row's hash. The reused-PIN test checks the new holder's ID,
  role, and credential version, preserving the identity needed by B-13.
- The reactivation fixture receives `23505` naming
  `staff_user_active_pin_lookup_key`, and the old row stays inactive. This
  matches the owner's 2026-10-07 reactivation ruling. No reactivation command
  was added; user-management commands remain outside this task's FR-B3 scope.
- The added tests cover all six task cases, including two inactive holders
  followed by a new active holder. Schema case 15 changes only its expected
  index name and gains the requested adjacent case. The privilege map and all
  other existing cases remain unchanged. The Handoff maps the six cases to
  their test names.
