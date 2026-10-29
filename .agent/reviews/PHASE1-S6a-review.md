# PHASE1-S6a review

## 1. Verdict: blocked

The source and contract review is complete, with one finding below. The required independent green `npm run verify` could not be obtained because this review environment refuses PostgreSQL connections with `EPERM`. This report does not substitute the builder's or lead's recorded test results for a reviewer run.

Reviewed `agent/phase1-s6a` at `16dd23b22edeb09c020027a8ae596ce781437b3e` against `development` at `a6e682dd389d0a4623df4596f5c3899fcc48bfe5`, using `.agent/tasks/PHASE1-S6a-presets-server.md`, its cited requirements and boundaries, the Phase 1 plan's S6, consult C1 sections 0 and 4, and the cited ADR rules. This slice has no screen or reviewed visual artifact.

## 2. Findings

### P2 — Correct the Phase 2 lock contract before handing off the reader

**Location:** `apps/server/src/domain/discount-preset.ts:75`, repeated in `.agent/tasks/PHASE1-S6a-presets-server.md:289` and originating in the task's ruling 10 at line 141.

The exported reader's documentation tells Phase 2 to take `catalog_revision FOR KEY SHARE` and attributes that instruction to ADR-012 rule 14. The accepted rule explicitly requires `FOR SHARE` for preset-discount application and explicitly prohibits `FOR KEY SHARE` (`docs/decisions/ADR-012-versioned-configuration.md:380`). The task itself makes ADR-012 authoritative over conflicting task instructions at lines 20–22.

The concrete failing handoff scenario is a Phase 2 builder implementing preset application by following this helper's comment and the supplied Handoff: the resulting caller takes a lock mode the binding architecture forbids. The ADR explains the underlying hazard: a key-share lock does not exclude a non-key-column update to the revision. This is a documentation and integration-contract defect, not an observed race in the current preset commands; those correctly acquire the stronger `FOR UPDATE` lock through `catalogWrite`, and Phase 2 application is not implemented here.

**Proposed fix:** Have the lead correct ruling 10 to `FOR SHARE`, and have the builder correct the helper comment and its Handoff to match ADR-012 rule 14. Keep `readPreset` free of a second lock and keep the current write locking unchanged. No accepted ADR needs modification.

## 3. What I ran and what I did not

**Observed results:**

- I ran `npm run verify`. Its complete typecheck stage succeeded and it entered `vitest run`, but it produced no completed test totals before I interrupted the stalled run. The interrupted command exited 130. There is no reviewer full-suite pass or full-suite test count.
- I ran `npm run test:unit -- --project client` successfully: **108 test files passed, 4,380 tests passed**, exit 0. This includes the new preset contract tests and the existing client integration and boundary tests selected by that project.
- A bounded connection probe using `pg.Client` and the repository's `serverTestEnv()` returned `connect EPERM 127.0.0.1:5433`. `docker ps` also failed because access to the Docker socket was not permitted. Neither probe changed the database.
- A direct in-memory call to `DiscountAmount`, `CreatePresetRequest`, and `decodeMoney` confirmed that fixed amounts ending in LF, CR, CRLF, or a space are refused. This was an input probe, not a source mutation.
- Before verification, `git diff --stat` was empty and the branch comparison reported **17 files changed, 1,556 insertions, 3 deletions**. After the last green client run, both outputs were unchanged, the working tree was clean, and both commit IDs above were unchanged. The review therefore examined a stable tree. Only this report was subsequently added.

**Not independently observed:** I could not execute the database-backed schema, route, access, concurrency, no-op `xmin`, or log-scan assertions. I did not run `npm run test:e2e:all`, migrate the development database, or perform any mutation run. The Handoff records mutation results and the task records prior full verification and browser results; those are their authors' evidence, not mine. The log-scan Handoff also explicitly records that a `console.log` mutation escaped its stdout capture, whereas a direct `process.stdout.write` mutation failed; I do not treat that as proof that the test captures console output under Vitest.

The lead still needs an independent full verification run in an environment that can reach the test database before the review's verification gate can be cleared.

## 4. Cleared

The following server conclusions are from source and test inspection, with runtime confirmation limited as stated above.

- The migration starts empty, declares exactly the seven requested columns and the requested grants, and exposes no delete or immutable-column update grant. Its explicit non-null checks close the SQL CHECK-null hole in the task sketch while satisfying acceptance criterion 3. There are no scheduling, automatic-application, stacking, or reorder fields (B-21, B-22, B-24).
- Both values remain integers: database `bigint`, domain `bigint`, and canonical wire strings through the existing codecs. The strict discriminated union refuses mixed kinds and JSON numbers, and the new contract tests passed. Bounds and zero values match FR-M5 and the task's rulings.
- Every preset write uses the existing `catalogWrite` transaction and revision lock. Edits carry the expected version; creates and state commands do not. No-op paths return without a row update or version advance. Duplicate errors use the new partial-index mapping and roll back through the existing transaction wrapper (ADR-012 rules 9, 10, 13 and 14).
- I specifically checked the shared `setPresetActive` helper across both target states and both starting states, including duplicate-name reactivation and editing an inactive preset. I also checked `sameValue` and `columnsOf` across both value kinds: equal zero values remain no-ops, changing kind remains a change, and the opposite database value column becomes NULL. The tests exercise these states through the registered production routes and real sign-in helper, rather than fixture-only handlers.
- The list reads its version and all active and inactive rows in one `REPEATABLE READ READ ONLY` transaction, ordered by `created_at, id` (ADR-012 rule 11; task ruling 6). Deactivation retains the row, and no command writes an audit entry, consistent with the task's FR-F5 scope and recorded Q11 ruling. Applying and snapshotting a discount remain Phase 2 work (FR-F4, B-8).
- All five routes are registered inside the existing API context, explicitly require an active back-office session, and declare the prescribed interactive flag. Bodies use the shared strict validator, errors remain bare typed envelopes, and unexpected database errors are replaced rather than exposed (ADR-010 rules 1–2; ADR-011 rules 1 and 9).
- The five contract exports, route-table entries, transport specifications, route names, and back-office API functions agree. `ConfigApi` excludes the paths until S6b as instructed. The existing catalog-route test's narrower filter preserves its previous assertions while the new preset test covers the five added paths. No screen, unrelated source, or accepted ADR was changed.
