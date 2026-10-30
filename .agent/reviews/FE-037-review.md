# FE-037 review

## Verdict

**clean**. No actionable findings in `agent/fe-037` at `7b4dd7fdf1e097fca331b27188e5c0c22b132198`, reviewed against `development` at `b258bfa75a4136139c8f00658a84f1bdd38e3f00` and the task's Round 2 amendment.

## Findings

None.

## What I ran and what I did not

- `npm run verify` passed: typechecking completed, **149 test files and 5,453 tests passed**. Vitest reported 105.69 seconds. This is five tests above the task's 5,448-test baseline.
- While the full runner had not yet reported results, I also started `npm run test:unit -- --project client`: **113 files and 4,563 tests passed**. The focused run `npm run test:unit -- --project client apps/back-office/test/menu-versions.test.tsx --pool threads --maxWorkers 1` passed **1 file and 33 tests**.
- `git diff --check development...agent/fe-037` passed.
- Before and after verification, `git diff --stat` was empty and HEAD remained `7b4dd7f`. The comparison with development remained **3 files changed, 344 insertions and 15 deletions**: the task file, `menu/model.ts` and `menu-versions.test.tsx`. The tree was clean before this report was written. No existing test body or assertion was changed; the test diff adds imports and five cases.

I read FE-037, the cited S6b review's F1 and Round 3 rulings and Handoff, the cited S4c1 Handoff, the corresponding presets implementation, ADR-012 rule 13, the relevant menu requirements in the PRD and the boundaries. I inspected the menu model, the test harness and production screen lifecycle, and BO-04's read and save handoff paths. FE-037 changes no view or design artifact; this was not a fresh visual audit of the inherited menu design.

The passing screen tests are observed evidence. They mount the real `Screens` inside `OfficeApp`, send archive or 86 through row controls, and revisit Menu through the Tables and Menu rail links. Production keeps the model in `Screens` and calls `shown()` when Menu mounts, so this overlap does not depend on a test-only route into a normally inaccessible state.

I did not rerun the builder's mutations. The Handoff records failures from restoring unconditional category and item overlays and unconditional command replacement, including the Round 2 replacement mutation. Those are supplied evidence, not mutation runs I performed. I also did not run `npm run test:e2e:all` or a manual browser review. The task's reviewer-specific lead verification note supplies **108 passing browser tests in both engines at `3dd51d5`**; I do not claim those as my run. An attempted process inspection with `ps` was denied by the environment; it did not affect the completed verification.

## Cleared

- `menu/model.ts:391` initializes separate category and item provenance maps from each successful full snapshot. The overlays at lines 396 and 402 require both application after the read began and an answer version strictly greater than the snapshot version, as FE-037 ruling 2 requires. Equal or newer snapshots retain their own values.
- `menu/model.ts:467` and `:478` apply the Round 2 `<=` rule independently to each returned record. Older answers cannot replace rows established by newer reads, while an equal-version no-op answer remains supported. Multi-record answers use the same check per record. The applied-record maps retain the newer command answer.
- The shared value most likely to conceal a wrong state is the standing catalog version used by a newly opened editor. The new category tests check both arrival orders and the inverse older-snapshot case, including the next rename's outgoing `expectedVersion`. Item tests check both arrival orders using visibly different name and availability values. These cover the stale-value/current-version mismatch prohibited by **ADR-012 rule 13**, which is the back-office authority; FR-C7 and AC-31 alone describe the POS stale-command rule.
- `adopt()`, partial-list handling, command serialization, gates, result copy and focus behavior are unchanged. In the read-first category and item cases, tests explicitly confirm that the older command's result is still announced while the newer row remains displayed, as FE-037 ruling 3 requires.
- `receiveItem()` and `releaseFromSave()` still pass answered items through `apply()`, so they receive the same provenance checks. `host()` inserts only an absent category and assigns no provenance or applied-record entry. The next successful full read replaces that hosted row, preserving ruling 1.
- Inspection of BO-04's own `readSubject()`, `readAgain()` and successful-save handoff found no equivalent unconditional applied-record overlay to report. This is limited static inspection, not an independent concurrency test of every BO-04 path.
- The change preserves integer-string prices and existing order snapshots and adds no hard-coded production configuration, consistent with B-1, B-8 and B-24. It changes no authentication, authorization, audit or order-transition path. No boundary violation was found in the changed reconciliation behavior.

Only this review report was written. No source or test was edited, and nothing was committed or pushed.
