# PHASE1-S3a review

## Verdict

**clean**. No actionable findings in the server half of tender-method configuration. Reviewed `agent/phase1-s3a` at `a7a35915a5083f82c5a638fe347fead866946f14` against `development` at `d164a23dc2a5055eb2720f71e18299f798b2c78c`, using the task file, its cited requirements and rulings, consult C2, the relevant DESIGN-018 handoff and method-state implementation, and the applicable architecture and ADR rules.

Independent full verification was limited by this reviewer's database access. The task's **Lead verify (2026-10-22)** explicitly permits the recorded lead run as server evidence and rules out a blocked verdict solely for that limitation. The distinction between independent results and supplied evidence is recorded below.

## Findings

None.

## What I ran and what I did not

**Observed independently.** I ran `npm run verify`. Its complete typecheck stage passed and it advanced to `vitest run`, but the unit runner produced no test results. A separate bounded TCP probe to `127.0.0.1:5433` failed with `EPERM`. I interrupted the stalled verify process, which exited 130. This was not a green full verify, and it supplied no completed unit-test count.

I then ran `npx vitest run --project client`: **83 test files passed, 3,617 tests passed**, exit 0. This includes the new tender-method contract tests and the generic route-path checks. `git diff --check development...HEAD` also passed. The Vite configuration emitted its existing warning about a future native configuration loader; it did not fail the client run.

**Tree stability.** Before verification and after the last green client run, `git diff --stat` was empty. Both observations had the same HEAD and development commits above and the same HEAD tree, `a492eba08273781ebbaf55562bffb5241e1e084f`. The tree was clean before this report was added. The branch diff contains the task file and the specified implementation/test paths only. The only change from the lead-tested implementation commit `09e23d9` to reviewed HEAD is the task file.

**Supplied evidence, not my execution.** The task's lead verification records a green `npm run verify` at `09e23d9`: **116 files, 4,367 tests**, with typecheck clean. The builder handoff separately records the eleven applied and reverted red mutations. I inspected the corresponding tests and assertions, but did not rerun those mutations and do not claim their recorded failures as my observations.

I did not run `npm run test:e2e:all`, a browser, `db:up`, or `db:migrate`. The full browser suite remains the lead's pre-merge check under task criterion 13. I did not edit implementation, tests, the task file, or memory, and did not commit or push.

## Cleared

- **Configuration and scope.** FR-B7, B-24, C2 section 8, and the owner's 2026-10-20 reactivation and 2026-10-21 naming rulings are implemented: custom methods start empty, cash and card have no seeded or protected rows, and their display names remain valid custom names. There is no tendering, fee, ordering field, new error code, audit command, or screen in this slice. The grants allow table-level SELECT and INSERT and UPDATE of only `name` and `is_active`; the added schema tests check the privilege map and forbidden operations.
- **State-dependent behavior.** I specifically traced the shared name value across active and inactive states. The partial `lower(name)` unique index permits inactive duplicates and inactive renames into occupied names, while activation into an occupied name fails without changing the row. The test sequence renames that inactive method to an available name and then reactivates it. Identical rename, already-inactive deactivation, and already-active reactivation all lock before deciding and return without UPDATE; a case-only rename writes. This matches task shape 4, criteria 5, 8 and 9, and C2 sections 4, 5 and 8.
- **Atomicity and answers.** Each mutating command uses the existing transaction wrapper, with the locking read as its first statement when a row already exists. Duplicate failures are classified only by SQLSTATE `23505` and the exact active-name index; other errors become a fixed error without a cause. Responses come from RETURNING or the locked no-op row, with no later read substituting another command's result. The list includes both states and orders by `created_at, id`. These satisfy B-20's no-partial-state principle, task criteria 5 and 10, and ARCHITECTURE section 13's authoritative-response rule.
- **HTTP access and contracts.** All five production registrations are inside the guarded API context, require ACTIVE BACK_OFFICE access, and explicitly distinguish non-interactive reads from interactive commands. The common guard enforces the current manager role and POST anti-CSRF checks. Fixed paths, body UUIDs, the shared strict schemas, unchanged `parseBody`, and detail-free errors follow ADR-010 rules 1 and 2 and ADR-011 rules 1, 9 and 16. The code-point length and control-character checks match the task's explicit correction to older design wording. The five transport specifications and office API functions map to the correct routes; the documented ConfigApi exclusion leaves screen integration to S3b.
- **Test relevance.** The new route tests sign in through the real authentication route and call the registered handlers through `buildServer` and the cookie-jar harness. They do not replace the domain or bypass the session guard. The existing route equality test still checks actual production registrations, and the generic path test already covers every new entry. The concurrency tests use the required table barrier and distinct waiting-backend count; the no-op lock tests release their competing transaction before assertions. The row snapshots include `xmin`, the duplicate marker scan captures logger output and stdout, and the audit-count guard matches the owner's Q11 ruling. These are sound test designs on inspection; their database execution is supported by the lead's run, not independently reproduced here. No screen behavior is claimed from these tests.
