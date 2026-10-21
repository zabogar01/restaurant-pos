# PHASE1-S2a review

## Verdict

**findings — two findings.** The production settings implementation follows the required transaction order and passed my verification run. The findings are a regression-coverage gap and the dependency declaration already identified in the task's Handoff and Lead verify note. Neither is an observed failure of the settings routes in the current workspace installation.

Reviewed `agent/phase1-s2a` at `3242251f06b13ed596d8b9b7205e5afd8948c524` against `development` at `00069324e16b4a1352c032cc7e09cd09850755fe`, using `.agent/tasks/PHASE1-S2a-settings-server.md` and its cited authorities.

## Findings

### 1. Medium: the stale-before-identical test does not distinguish the required check order

**Location:** `apps/server/test/settings.test.ts:196`.

The test creates version 2 with footer `Sampai jumpa`, then submits version 1 with the original footer `Terima kasih`. Those values differ from the current version. Consequently, comparing values before checking the version still produces `STALE`, and the assertion passes. The test's title claims to establish an ordering that its input cannot establish.

**Authority:** ADR-012 rule 4 explicitly requires stale refusal before the identical-values comparison; task Ruling 8 fixes that same order. This is missing regression evidence for that rule, not a defect in the present implementation: `apps/server/src/domain/settings.ts:127` checks the version first correctly.

**Failing scenario:** another tab has already saved the manager's intended values as version 2. The original tab submits those same values with `expectedVersion: 1`. If the checks are reversed, it receives success as unchanged instead of 409 `SETTINGS_CHANGED`. The existing test would not catch that regression. In a Node probe using the comparison and branches copied from the domain, the existing fixture returned `STALE` with either order; a stale submission equal to version 2 returned `STALE` with the original order and `UNCHANGED` with the reversed order.

**Proposed fix:** submit `save(1, { footer: 'Sampai jumpa' })` after creating version 2, and assert the exact 409 envelope and unchanged stored rows. Retain the different-values stale case separately. Prove that reversing the two checks makes this corrected test fail.

### 2. Low: the server's new runtime dependency is absent from its manifest

**Locations:** `apps/server/src/domain/settings.ts:2`, `apps/server/src/http/routes/back-office-settings.ts:4`, and `apps/server/package.json:12`.

The server now imports `@pos/money` at runtime, but its dependencies declare only `@pos/contracts` among the internal packages. The root workspace links make the imports resolve in the tested installation, so the green suite does not prove the server dependency declaration is complete. This confirms the builder's reported issue; it is not a newly discovered route failure.

**Authority:** task Rulings 3 and 4 require the server to consume the shared rate codec and installation constants, and the task's Lead verify section explicitly identifies this missing declaration as unresolved. This is a package dependency issue, not a separate money or audit boundary violation.

**Failing scenario:** an installation or packaging step that includes only dependencies declared by the server omits `@pos/money`, and loading the newly registered settings plugin fails module resolution before the server starts. This consequence is inferred from the imports and manifest; I did not run an isolated deployment experiment, and the normal full-workspace installation passed.

**Proposed fix:** add `"@pos/money": "*"` to the server's dependencies and update the corresponding lockfile entry. The lead must assign the manifest and lockfile paths, which are outside this builder task's ownership.

## What I ran and what I did not

### Observed

- `npm run verify` exited successfully. Typechecking passed, followed by **107 test files and 4,006 tests passed**. Despite the task's environment warning, this review run completed the server tests; it did not remain blocked on database access.
- `npm run test:unit -- --project=client` also exited successfully: **75 test files and 3,285 tests passed**.
- `git diff --check development...agent/phase1-s2a` passed.
- Before and after verification, `git diff --stat` was empty. The branch diff remained **22 files changed, 1,909 insertions, one deletion**. The recorded branch and development hashes were unchanged at the end. The tree was stable during the review; this report was created afterwards.
- I ran the branch-order probe described in finding 1 with Node, entirely in memory. It used copied comparison logic and fixtures; it was not a mutation of the repository module or an HTTP integration test. Earlier attempts to evaluate the probe in the file-tool runtime failed because that runtime disallows generated code; the successful evidence is the later Node probe.

### Not run or not established

I did not run browser E2E tests, launch the design in a browser, run a migration against the development database, install dependencies, or repeat concurrency tests in a stress loop. The task records the lead's **68 passing E2E tests**; that is the lead's evidence, not my run. I read the relevant design source and settings inventory for the server contract; this slice builds no screen, so this review does not certify S2b's future screen behavior.

I did not repeat the builder's full mutation catalogue. Its Handoff remains the source for those historical red-proof claims. No source, test, task, manifest, or memory file was edited, and nothing was committed or pushed.

## Cleared

- The shared save path handles the empty installation, a changed current version, an identical current submission, and stale submissions. The production code checks staleness first, compares every editable field, and inserts the next version in one transaction. Only SQLSTATE `23505` on `settings_version_pkey` becomes stale; other failures become a neutral error. The concurrent-insert test exercises that mapping through the registered HTTP route.
- The migration starts empty, grants SELECT and only the ten permitted INSERT columns, excludes `created_at` from application writes, and refuses UPDATE, DELETE, and TRUNCATE even on an empty table. Schema tests cover the rates, policy, version key, text guards, control characters, and exact columns. This supports ADR-012 rules 1, 2, and 5–8 and B-24.
- Rates remain exact bigint values in the domain and canonical integer strings on the wire. Both rate schemas enforce 0–1,000,000. The bound refinement checks syntax and length before invoking BigInt, so invalid syntax does not throw. The codec deliberately leaves the business ceiling to the request schema. This follows FR-M5, ADR-012 rule 7, and task Ruling 3.
- The request schema refuses untrimmed text, forbidden controls, excessive lengths or address line feeds, forbidden extra fields, and a slash in the phone. The older design fixture still permits a phone slash; the implementation correctly follows the later owner ruling recorded in the task rather than that fixture.
- Both routes require an active back-office manager session; the save requires CSRF and is interactive, while the read is not. Attribution comes from the session, never the body. Responses carry the full database-derived version and installation constants, including the existing version for an identical save. Tests exercise real sign-in and the production route registration rather than a screen fixture.
- Settings operations add no audit entries. The error envelope carries no settings-change details, and the marker tests cover invalid and stale submissions without exposing their text in logs or refusal responses. The relevant authorities are the task's Q11 ruling and S2-24/S2-25, and ADR-010 rules 1 and 2.
- Excluding settings from `ConfigApi` is consistent with task Ruling 9's limited client scope: `OfficeApi`, transport specifications, route names, and exhaustive error maps are wired, while no screen calls them. The Handoff explicitly carries the required `ConfigApi` and fixture changes forward to S2b.
