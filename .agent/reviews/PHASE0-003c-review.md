# PHASE0-003c review

## Verdict

**clean** — no actionable findings in the reviewed change. The independent full verification passed. The standalone schema command and development migration command could not be independently completed because of sandbox permission errors, as recorded below.

Reviewed `agent/phase0-003c` at `708ea86caa8e17dfd85cd435ecafebd6e4a2de09` against `development` at `d7384a7609bf95179645f9d367938455b62301cc`, using `.agent/tasks/PHASE0-003c-core-schema.md`, its ARCH-006 specification, the cited architecture sections, ADR-007, FR-A1–FR-A7, FR-J1–FR-J4, and the boundaries. There is no screen or visual design artifact in this task.

## Findings

None.

## What I ran and what I did not

### Observed

- `npm run verify` exited successfully. Typechecking passed; Vitest reported **46 files and 2,758 tests passed**. This is the specified baseline of 45 files and 2,737 tests plus the schema file's 21 cases.
- `npx vitest run --project client` independently reported **40 files and 2,719 tests passed**, matching the required unchanged client-project counts.
- Before and after the full verification, `git diff --stat` was empty and both commit IDs above were unchanged. The branch diff remained seven files, 929 insertions and two deletions. A further status check after the additional commands still showed a clean worktree. The reviewed tree did not move.
- Compared all four migration files programmatically with the SQL blocks in ARCH-006. Each matched after trimming surrounding whitespace. I also read the SQL, the schema tests, the harness change, and the database support and production pool/migration paths.
- Attempted `npx vitest run apps/server/test/schema.test.ts --reporter=verbose`, followed by the exact acceptance command `npx vitest run apps/server/test/schema.test.ts`. Both exited 1 during setup with `connect EPERM 127.0.0.1:5433`. Both also printed “No test files found”; neither produced a schema-test result. These attempts do not establish a failing schema test or satisfy standalone acceptance independently.
- Attempted `npm run db:migrate`. It exited 1 because the `tsx` launcher could not create its IPC pipe (`listen EPERM`), before migration execution. I did not run a second migration attempt after that failure.
- The existing Vite warning about ESM syntax in the CommonJS-loaded configuration remains; the task explicitly excludes it.

### Evidence limits and inference

I did not perform any mutation run. The five red proofs and the successful first/second migration outputs are evidence recorded by the builder in the Handoff, not runs I personally observed. By inspection, each named mutation reaches the asserted refusal or exact catalog comparison that should detect it. The full suite independently exercised the real migrations and all 21 schema cases, but it does not substitute for my observing the separate development-database command succeed.

I did not run a browser, end-to-end authentication, PIN hashing, audit writers, session expiry services, or throttle restart tests. Those application paths are outside this schema task. AC-18 and AC-19 remain open. In particular, the schema's Argon2id prefix check is not cryptographic verification, and its audit text columns still require the future writer to exclude PINs under B-12 and FR-J4; this review does not claim that catalog shape alone proves either future behavior.

## Cleared

- All 21 prescribed cases are present and map to the Handoff. The privilege map checks exact effective table and column privileges, rejects an unlisted relation, excludes privileges on `schema_migration`, and checks sequences. Application permission probes use the production `query` pool; evidence reads and owner-trigger probes use the separate owner connection. The tests therefore do not obtain their permission evidence through an owner-only substitute for the application path.
- B-7 and FR-J1 have both application-grant and statement-trigger coverage. The owner trigger is exercised for UPDATE, DELETE and TRUNCATE with both an empty and populated audit table. Reset uses schema recreation and real migrations, rather than an audit cleanup path.
- B-13 and FR-J2 are supported by the required actor and staff foreign key. The shared approval-outcome constraint was checked across all relevant states: failed and cancelled approvals reject an approver and accept null, while success accepts either, as FR-J3 and ADR-007 require. The deferred `REFUSED` outcome is explicitly documented rather than presented as supported.
- The other shared-state check was session audience: case 20 rejects back-office sessions without expiry while accepting POS without expiry and back office with expiry. It checks the expected constraint before inserting the valid rows, so token reuse does not conceal the missing-expiry case. Credential-version omission, unique token hashes, unique PIN lookup and authenticating roles are covered within the prescribed scope.
- Evidence column lists are exact; security telemetry has constrained event/class values, no free-form payload and no staff foreign key. Application inserts cannot supply evidence identity or time. Both amount columns are bigint, and the test round-trips `9007199254740993` exactly through the application insert and owner read, supporting B-1.
- The two seeded throttle rows implement FR-A5's fixed classes without restaurant configuration seed data under B-24. Their grants permit counter/cooldown updates but no insertion, deletion or class rename. The harness change preserves exact table-list equality, and no existing test outside the permitted file changed.

Only this review report was written. No source, tests, task file or memory file was edited; nothing was committed or pushed.
