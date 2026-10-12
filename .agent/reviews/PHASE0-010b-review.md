# PHASE0-010b review

## Verdict: clean

Reviewed `agent/phase0-010b` at `153ab4383b0b8bdcc93ee55dcb7b593bf6465933` against `development` at `2b8db33579cef31a9bd2877c0abe54b724fc8a96`, the task and its Handoff, the cited predecessor handoffs and rulings, and the applicable requirements, boundaries, architecture sections and ADRs. The binding ARCH-013 sections are reproduced in the task. No actionable defect was found in this slice. This verdict covers the adapter and its test-only probe; it does not close the deferred production-command, cancellation-route or client work.

## Findings

None.

## What I ran and what I did not

I ran `npm run verify` myself. It exited successfully: typechecking passed for all four projects, and **66 test files and 3,252 tests passed**. Vitest reported 53.34 seconds. That is one file and 17 tests above the task's baseline of 65 files and 3,235 tests. The client source and tests are unchanged in the branch diff. Vite emitted its existing configuration-loader compatibility warning; it did not fail verification.

Immediately before and after that green run, `git diff --stat` was empty and `git rev-parse HEAD development` returned the two hashes above. The branch comparison also stayed at eight files, 1,168 insertions and four deletions. A final check before writing this report still showed a clean working tree. The reviewed tree did not move.

I ran `git diff --check development...agent/phase0-010b` successfully and repeated the four source searches from task acceptance criterion 4 with `rg`. The results match the Handoff: no production approval registration or import, quoted approval outcomes confined to the two domain files, and `managerPin` confined to the adapter, primitive and logger backstop. The error-status search also finds the unchanged non-API not-found response at `apps/server/src/http/errors.ts:97`. The task's literal expectation of no matches is inaccurate; that pre-existing response is permitted by ADR-010 rule 1 and is not a handler introduced here.

I inspected a shared-state coverage edge at `apps/server/test/approval-route.test.ts:485`: case 11 starts an approval cooldown before calling `PROBE_THROWS`. From the control flow, that final request is another throttled response, not an exercise of the throwing work. Case 9 independently reaches the real error path, asserts 500 `INTERNAL`, checks that the thrown marker is absent from the body and trace log, and checks that no audit entry was written. I therefore do not count case 11 as additional 500-path coverage or treat its redundant request as a defect in the adapter.

I attempted an in-memory Vitest transformation adding a 500 assertion to that final case-11 request. The diagnostic process was denied its connection to `127.0.0.1:5433` with `EPERM` during global setup; its transform count was zero and no test ran. This is not a successful mutation proof. No source or test file was edited. I did not independently repeat the builder's six mutation proofs or three consecutive standalone runs; those remain Handoff evidence. I did not run a browser or manually exercise a production approval endpoint, because this task deliberately adds neither a screen nor such an endpoint.

## Cleared

- `approvalRequest` obtains the actor through `actorOf(request)` and takes the resolved client instance from the request. It explicitly selects the remaining fields, with no body spread, cookie read or supplied actor override. This satisfies B-13 and the task's request-construction rule.
- `approved` returns the work's result and maps the two refusal outcomes exactly as ARCH-013 section 6 requires: 403 `APPROVAL_FAILED`, with details only when the domain supplies a cooldown, and 429 `APPROVAL_THROTTLED`, always with the retry detail. It holds no session or approval state and does not write response bodies itself. The contract additions and negative type checks preserve ADR-010's typed error envelope.
- The shared six-ASCII-digit field preserves the existing sign-in schema. The probe rejects absent, malformed and extra fields before invoking approval, including during a cooldown. Its declaration uses the actual `ACTIVE`, `POS`, interactive guard path through `buildServer({ apiRoutes })`; its fixtures sign in through the real credential routes.
- The passing tests cover distinct failed-PIN kinds, retained POS sessions, missing/idle/CSRF-refused sessions, both browser audiences, manager self-approval with a fresh PIN, and refusal of a second request without a PIN. These support FR-A2c, FR-A6, AC-27 and B-14 within the task's stated Phase 0 scope.
- The probe calls the existing primitive with a fixed action and writes through the transaction client it receives. Tests check actor/approver evidence, cooldown audit outcomes, separate security telemetry, throttle persistence across client-instance replacement and server rebuilding, and credential scans. These support FR-A5, FR-J3, FR-J4, AC-18, AC-19, B-12 and ADR-007 within this slice. No domain module, migration, production route or client was changed, and the existing test edits stay within the task's permissions.
