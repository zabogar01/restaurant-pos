# PHASE1-S8a review

## Verdict

**findings** — one test-coverage finding. I found no production behavior defect in the reviewed diff. Independent server verification is incomplete because the reviewer sandbox denies database connections; the results below distinguish my observations from the lead's supplied evidence.

Reviewed `development...HEAD` on `agent/phase1-s8a`, with HEAD `e1a67c444090409735a553ece59331f8197c6d19` and development `99a734b15f93b9c077446a0e7a29f28a8098635d`, against the task, its copied C3 requirements, the cited PRD and boundary rules, and the relevant architecture, C2 and accepted ADR provisions. This slice builds no screen.

## Findings

### 1. P2 — The malformed-password marker is sent but never searched for

**Location:** `apps/server/test/log-scan.test.ts:378`, the `secrets` array used by both new marker scans.

The request's password field at line 271 sends `USERS_MARK.malformedPassword` (`MK-PW-7`), but the scan includes only the passwords inside `USERS_MARK.passwords`, plus the malformed PIN and other markers. It omits `USERS_MARK.malformedPassword`. The test therefore does not establish its claim that no malformed password reaches a log.

**Authority:** PHASE1-S8a's copied C3 section 8, lines 533–540, and acceptance criterion 13 explicitly require scanning malformed credential values. ADR-010 section 2 requires that evidence for B-12. This is a missing regression check, not an observed production credential leak.

**Concrete failing scenario:** If a validation-error path logs only the short submitted password under an unredacted diagnostic key or in its message, the existing request still returns the expected `VALIDATION_FAILED` envelope, while the marker scan passes. I evaluated the checked-in marker array and scan predicate in memory against a synthetic line containing this password: the marker was absent from the array and the detected-leak list was empty. The response marker predicate likewise misses it, although the separate exact-envelope assertion protects this particular error response.

**Proposed fix:** Include `USERS_MARK.malformedPassword` in the shared secret list. Prefer deriving the list from all marker leaves so a new standalone marker cannot be silently omitted. Demonstrate that adding a log line containing this marker makes the scan fail, then remove that mutation.

## What I ran and what I did not

- **`npm run verify`:** Typechecking completed successfully and Vitest started. No test-file or test counts were reported before the run stalled. A separate bounded TCP probe to `127.0.0.1:5433` returned `EPERM`. I interrupted the stalled run; it exited 130. This is not a green verification run, and there are no full-suite counts from my run.
- **`npm run db:migrate`:** Exited 1 before executing the migration because `tsx` could not create its IPC socket (`listen EPERM`). I did not change the database or try to bypass the sandbox.
- **`npm run test:unit -- --project client`:** Exited 0: **121 files and 4,809 tests passed**. This project includes the contracts and API client tests as well as the clients.
- **Tree stability:** `git diff --stat` was empty before full verification, after its interruption, and after the green client run. `git status --short --branch` remained clean on `agent/phase1-s8a`; HEAD and development retained the hashes above. The only subsequent intentional write is this report. `git diff --check development...HEAD` also passed.
- **Credential-key probe:** I transpiled the checked-in `keysOf` traversal in memory and applied its credential-key predicate to the real exports. It discovered **41 request-schema exports**, with no baseline offences. A synthetic nested `pin` was detected at depth 1, and `oldPassword` was detected as absent from `SECRET_KEYS`. No source file was mutated. These are direct traversal/predicate observations, not a claim to have run the server Vitest file or a full mutation suite.
- **Marker probe:** I evaluated the checked-in `USERS_MARK` and `secrets` initializers and checked a synthetic log line and response containing the malformed-password marker. Both marker predicates missed it, as described in finding 1. I did not inject a production logging mutation or run the database-dependent log-scan suite.
- **Not independently run:** The database-backed server tests, the database mutation proofs, and `npm run test:e2e:all` did not complete or were not attempted here. The task's lead-verification section reports **162 files, 5,779 tests and 130 browser tests passed at `8fd0eb9`**, plus repeated session-predicate and own-role red proofs. Those are supplied lead results, not reviewer results.

## Cleared

The following conclusions are from source and test inspection, supplemented by the green client suite and the in-memory probes where stated.

- **Shared create path and script behavior:** The script still calls `createStaffUser` and `createBackOfficeCredential`; those wrappers and the users command converge on `insertStaffUser` and `insertBackOfficeCredential`. There is one insert implementation per entity, consistent with ADR-009 section 7. The HTTP command hashes before opening its transaction. The script itself is unchanged, and the wrappers retain their validation order and fixed refusal messages. Existing script tests still assert rollback, the duplicate messages, secret-free prompts and no audit entry; I did not independently execute them.
- **Collision order and rollback:** The staff/PIN insert precedes the credential insert. A taken PIN returns before a staff row is created; a taken username throws `Refusal`, which reaches `withTransaction`'s rollback before being converted to `DUPLICATE`. `users.test.ts:234` checks both complete tables, including `xmin`, before and after the username collision; line 249 checks PIN-first precedence. The audit-failure test revokes a database privilege and restores it in `finally`, with no production test seam.
- **Actor lock and session re-check:** `lockUsers` selects actor and subject together in UUID order with `FOR NO KEY UPDATE`, then reads the acting session with `released_at IS NULL` and compares its credential version with the locked, active manager row. Promotions lock the credential row afterwards. This follows ARCHITECTURE section 8 and C3 section 5. The crossing tests enter through the registered HTTP routes and hold both staff rows before releasing the competing requests. Self-action checks precede hashing and transaction acquisition; uppercase subject UUIDs are normalized.
- **State shared across transitions:** I traced the retained credential row through manager-to-cashier and manager-to-kitchen, re-promotion, and reactivation. Re-promotion replaces the password while preserving username and throttle columns; reactivation deliberately retains the password. The six moves validate their origin and active state under the lock. Deactivation and each role change increment the version; reactivation with a new PIN increments it, while ordinary reactivation and no-ops do not. Kitchen rows cannot resolve sessions even without an increment. These distinctions match FR-A1, FR-A4, FR-B3 and C3's transition rules.
- **Credential-key coverage:** All current exported request schemas follow the `*Request` convention selected by the test. The traversal handles the objects, discriminated unions, arrays and wrappers used by these schemas; the in-memory probe confirmed nested and unlisted credential-key detection.
- **Response and audit projections:** Allowing the stored username in a successful `UserView` is the correct reading of C3 section 8 and ADR-009 section 3, despite AC 12's broad phrase “marker credential.” Usernames remain excluded from refusals and audit entries. The view projects exactly five fields. Audit calls use the guarded actor, a closed action constant and the subject ID, on the mutation's client before commit; no credential is supplied to the writer.
- **Boundary and integration surface:** The migration preserves the existing role and hash checks, adds the kitchen credential-shape and name checks, and narrows update grants to the five intended columns. The five routes use the existing parser, active back-office guard and CSRF path; only the list is noninteractive. User-specific duplicate details are emitted locally, and existing duplicate assertions remain unchanged. Client edits are the authorized declarations and error-code cases, including the ratified fixture and route-list additions. No screen or new browser flow is claimed as covered by these server tests.
