# PHASE0-005 review

## 1. Verdict

**findings** — One low-severity test-coverage finding. I found no implementation defect in the reviewed writers. The full verification and focused audit suite passed on an unchanged tree.

Reviewed `agent/phase0-005` at `fc8f4d6992d2a71488ad31df0e873c43b905bc99` against `development`, the PHASE0-005 task and its cited schema, pool, harness, plan Task 5, ARCH-006 sections, architecture sections, ADR-007, FR-J2/FR-J3, and B-1/B-7/B-12/B-13. This task has no screen or visual design artifact.

## 2. Findings

### 1. Low: Security-event rejection tests do not prove rejection before SQL

**Location:** `apps/server/test/audit.test.ts:266-270`.

The five invalid security-event cases assert the fixed error message and an empty table, but never observe the writer's pool query calls. An empty table proves that no row survived; it does not prove that no SQL ran. The audit rejection cases correctly use a recording client, but that evidence does not cover the security writer, which uses a different database entry point.

**Authority:** PHASE0-005 lead ruling 3 (`.agent/tasks/PHASE0-005-audit-and-security-event-writers.md:68-71`) requires both writers to validate before any SQL. Test case 11 (`:138-140`) explicitly requires the security writer to refuse invalid inputs before SQL, and the objective (`:26-27`) requires tests to prove the rules.

**Concrete scenario:** If `writeSecurityEvent` issued a harmless `SELECT 1` through the pool before `validateEvent`, all five cases would still receive the expected validation message and find zero rows. They would remain green while violating the required ordering. This is an inferred regression scenario, not a mutation I ran; the current implementation visibly validates before calling `query`.

**Proposed fix:** Add a focused test that records or spies on the pool query entry point used by `writeSecurityEvent` and asserts zero calls for each invalid input. Retain the real-database cases for storage behavior, and restore the spy after each test so other cases continue to exercise the production database path.

## 3. What I ran and what I did not

### Observed

- `npm run verify`: TypeScript checks passed; **48 test files passed and 2,815 tests passed**. These totals match the task's baseline plus one file and 35 tests.
- `npx vitest run apps/server/test/audit.test.ts`: **1 file passed and 35 tests passed**, including the real-database commit, rollback, exact-money, failed/cancelled approval, foreign-key, and security-event cases.
- Before the full run and after the final focused green run, `git diff --stat` was empty, `git status --short --branch` showed only `agent/phase0-005`, and HEAD remained `fc8f4d6992d2a71488ad31df0e873c43b905bc99`. The branch diff against development remained three files and 657 insertions: the task file, writer, and test file. The reviewed tree was stable throughout verification.
- A content search for `UPDATE|DELETE|TRUNCATE|RETURNING|console\.` in the source `audit.ts` found no matches.
- Both test commands emitted the existing Vite configuration warning; neither command failed.

### Inferred or not rerun

- I inspected the builder's five red-proof descriptions in the Handoff, but did not rerun those mutations. Their claimed failure output is builder evidence, not independently observed reviewer output.
- I did not run the hypothetical mutation described in finding 1.
- The full verifier reports combined counts, not a separate client subtotal. I observed the combined total and confirmed that the branch changes no client file; I did not independently run a client-only count.
- No browser check applies to these server-only functions. Later HTTP commands, approval gates, throttling, and refund `REFUSED` behavior are outside this task and were not exercised.

## 4. Cleared

- **Transaction boundary:** `writeAudit` inserts through the supplied client. The real production transaction helper is used in tests, and rollback removes the audit row while preserving the original business error. Two entries commit together. `writeAuditOwnTransaction` validates before opening its own transaction and propagates failures.
- **Shared state-dependent field:** I specifically checked `approverId` across all three outcomes. SUCCESS permits an approver, including the actor; failed and cancelled approval outcomes permit null or absent approvers and reject a named approver before the recording client runs SQL. A nullable approver is not accidentally treated as a named approver.
- **FR-J2 and B-1:** Actor, approver, action, outcome, paired subject, reason, and exact before/after amounts are mapped to the correct columns. Large positive and negative amounts and zero round-trip as decimal strings without Number conversion. Time and identity are left to the database.
- **B-7 and module surface:** The source contains only insert paths and exports exactly the three runtime writers. It uses no audit read, update, delete, truncate, or RETURNING operation. Tests reset through the existing schema-reset harness and read through the owner connection.
- **B-13 and FR-J3:** Audit input requires an identified actor; an unknown UUID reaches the real foreign-key constraint and retains PostgreSQL error code 23503. Unauthenticated event evidence goes only to `security_event`. The explicitly allowed choice to ignore extra security-event keys is stated in the Handoff and exercised without copying them to SQL.
- **B-12:** The writers contain no PIN parameter or logging call, and validation messages contain only fixed field names. Security-event SQL passes only the enum fields and optional client-instance identifier. Free-form business fields still rely on later command callers to keep credentials out, as implied by the task's required input shape.
- **Scope and authority:** No existing test, migration, pool, PIN module, configuration, client, or dependency changed. The three current outcomes and deferred REFUSED migration follow the task's explicit supersession of the older plan and ARCH-006's staging guidance.
