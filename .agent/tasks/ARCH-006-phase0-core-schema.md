# ARCH-006 — Is the Phase 0 plan's Task 3 schema still right?

Owner: `architect6`. Written by the lead, 2026-10-05. Read-only consult: you write one report
and touch nothing else. It is the architect consult WORKFLOW.md requires before a task that
touches money, audit or identity is dispatched. The task it serves is PHASE0-003 (core schema
and append-only grants), not yet written; the lead writes it from your report.

## The question

The owner lifted the backend pause on 2026-10-05 (`.agent/DECISIONS.md`): Phase 0 resumes at
Task 3 of `docs/superpowers/plans/2026-09-08-phase-0-foundations.md` (lines 767-1050). That plan
was written on 2026-09-08. `docs/ARCHITECTURE.md` and the seven ADRs were accepted on
2026-09-10, after it, and they bind; where the plan and they differ, the plan is wrong. The
plan's Task 3 gives six migrations (`0002_settings.sql` to `0007_roles_and_grants.sql`) and a
test file verbatim. The lead wants to know whether that SQL can be dispatched as written, and
if not, exactly what changes, before a builder copies it.

## What exists (verify it; do not take the lead's word)

- `db/migrations/0001_extensions.sql` only. `apps/server/src/db/migrate.ts` (`runMigrations`)
  and `apps/server/src/db/pool.ts` (`getPool`, `query`, `withTransaction`; BIGINT parsed as a
  string, never a number). `apps/server/test/migrate.test.ts` is the only server test; it runs
  `DROP SCHEMA public CASCADE` in its setup.
- `docker-compose.yml`: PostgreSQL 16, user `pos_owner` (a superuser, `POSTGRES_USER`),
  database `pos`, bound to `127.0.0.1:5433`. `pool.ts` defaults to that superuser.
- Root `package.json`: `vitest run` over the whole repository (no vitest config file), so the
  2700-odd `apps/pos` tests and the server tests share one run. `npm run verify` is typecheck
  plus that run.
- `packages/money/src/index.ts:10`: `export type Rate = bigint;`, the same type as `Money`.

## Findings the lead already has

1. **Parallel test files race on one database.** Task 1's builder showed a second test file with
   Task 3's `beforeAll` shape (`DROP SCHEMA public CASCADE`, then migrate) failing five runs out
   of five, because vitest runs files in parallel. Never ruled; the lead leaned to
   `fileParallelism: false` for the server tests only.
2. **The default pool role is a superuser**, and superusers bypass grants, so a B-7 test through
   `query()` cannot fail. The plan's grant test does connect as `pos_app`; that must stay.
3. **`Rate` is not branded.** The lead ruled on 2026-09-14 to brand `Rate` and leave `Money` as
   `bigint`, so `mulRate(rate, amount)` with its arguments swapped stops compiling, and that it
   runs before Task 3. Not applied.
4. **The plan's `0007` creates `pos_app` with the password `'apppassword'` inside a migration**,
   so a credential lives in the migration history.
5. **ARCHITECTURE.md §7.2** says deactivation or a PIN reset increments a credential version and
   a user's sessions then fail on their next request; the plan's `staff_user` and
   `app_session` carry no such version.
6. **ARCHITECTURE.md §11** says the application role may insert and read *permitted projections*
   of audit; the plan grants plain `SELECT` on `audit_entry` and `security_telemetry`. §11 and
   §5 name a *SecurityEvent*; the plan names the table `security_telemetry`.
7. **The plan's rate checks** (`0 ≤ ppm ≤ 1,000,000`) would fix a permitted tax and
   service-charge range, which `docs/PRD.md` §9 lists as an open question for the owner
   (before Phase 2). The plan's `settings_version` may also not be the shape ADR-004 (versioned
   exact nett monetary policy) expects, and FR-M1 makes currency and precision immutable after
   the first order.
8. **The plan's audit outcomes** are `SUCCESS`, `INVALID_APPROVAL`, `CANCELLED`. ADR-007 and
   §11 speak of failed and cancelled approvals with `approver = null`. ARCH-005 left open, for
   the owner before Phase 2, whether an approved void the server refuses writes `REFUSED`.

## The lead's draft rules (confirm, correct or reject each)

- **S1.** PHASE0-003 starts with the `Rate` brand (finding 3), as its own commit, inside the
  task: `packages/money` plus any caller the compiler names.
- **S2.** Server database tests run one file at a time and the `apps/pos` tests keep running in
  parallel: a vitest `projects` configuration (or equivalent) with `fileParallelism: false` on
  the server project only. A database per worker is rejected as too much for Phase 0.
- **S3.** No password in a migration. The migration creates no login credential; `pos_app`'s
  login and password are provided out of band (the Compose init script or test setup, from an
  environment variable), and the migration only grants. The grant test connects as `pos_app`.
- **S4.** `staff_user` gains `credential_version` (integer, starts at 1) and `app_session`
  records the version it was created under; nothing reads them until Task 7.
- **S5.** Table and column names follow ARCHITECTURE.md's entity names where the plan differs
  (for example `security_event`, not `security_telemetry`), stated once in the task file.
- **S6.** Audit outcomes are exactly the set the documents name; nothing is added for an open
  owner question (no `REFUSED` until ruled).
- **S7.** The schema checks only what is representational (a rate is a non-negative integer in
  ppm), never a permitted business range, which stays with PRD §9. No settings row is seeded
  (B-24). The two throttle rows are seeded (FR-A5).
- **S8.** `pos_app` gets `SELECT, INSERT` only on the append-only tables, nothing more; the
  "permitted projections" of §11 are a later phase's views, not Task 3's.
- **S9.** The test file keeps the plan's five cases, adjusted to S3 to S7, and adds: no `UPDATE`
  or `DELETE` on the SecurityEvent table for `pos_app`; no PIN column on any audit or telemetry
  table; no float or numeric type on any money or rate column in the schema.

## Answer these

1. **Against the documents.** Read Task 3's six migrations and its test against
   `docs/ARCHITECTURE.md` (§5, §7, §8, §10, §11, §14.2, §14.4) and ADR-002, ADR-004 and ADR-007.
   List every column, constraint, name, default and grant that is wrong, missing or decided too
   early, with the authority for each. Say which later-phase columns Task 3 must **not** add.
2. **The race (S2).** Rule it. If not `projects` with `fileParallelism: false`, what, and why does
   the alternative lose? Must `migrate.test.ts` change, and how, without weakening it?
3. **Roles and credentials (S3, S8).** How do the owner role, the migration role and `pos_app`
   come to exist in development and test without a password in a migration or in code? Is
   `GRANT ... ON ALL SEQUENCES` right, and what about tables a later migration adds (default
   privileges)? Is plain `SELECT` on the audit tables acceptable in Phase 0 under §11?
4. **Identity (S4).** Is a credential version the right shape for §7.2, and does it belong in
   Task 3 or Task 7? What must `app_session` record for the POS 90-second rule and the
   back-office idle and absolute limits (FR-A2, FR-A2b), and what must be database time
   (§14.4)?
5. **Money and settings (S7, finding 7).** What does ADR-004 require of the settings or policy
   table now, and what waits for Phase 1 or 2? Which checks are representational and which would
   pre-empt the owner's PRD §9 question? Is anything about FR-M1's immutability Task 3's?
6. **Audit (S6, finding 8).** The exact outcome set and columns for the audit table under ADR-007
   and FR-J2 and FR-J3; the SecurityEvent's shape under §11 and B-12, B-13.
7. **The `Rate` brand (S1).** Confirm it belongs in PHASE0-003 rather than its own task, and name
   anything in `apps/pos` or `packages/money` it would break.
8. **Anything else** in the plan's Task 3 or the draft rules that contradicts an accepted ADR or a
   boundary (B-1, B-7, B-11, B-12, B-13, B-24 in particular). Push back where the lead is wrong.

## Read

- `docs/superpowers/plans/2026-09-08-phase-0-foundations.md`: Global Constraints (lines 13-35),
  File Structure (39-100), Task 3 (767-1050), and skim Tasks 4 to 7 for what they will need from
  this schema.
- `docs/ARCHITECTURE.md` (the sections above) and `docs/decisions/ADR-002`, `ADR-004`, `ADR-007`.
- `docs/PRD.md`: FR-A1 to FR-A7, FR-J1 to FR-J3, FR-M1 to FR-M5, §9. `docs/BOUNDARIES.md`: B-1,
  B-2, B-7, B-11 to B-14, B-24.
- The code named under *What exists*.
- `.agent/reviews/ARCH-005-void-in-the-client.md`, its *For the owner*, for the open `REFUSED`
  question only.

## Constraints

- Do not edit any file except your report. Do not commit. Do not start any other agent.
- Use the file tools to read. Do not run shell commands except the one report line below; a
  shell prompt would wait on the owner.
- A boundary is not subject to your judgement. If a draft rule seems to need one broken, say
  the rule is wrong.
- Separate what the documents decide from what you recommend, and name any question that is
  the owner's (product, contract wording, identity, rates) rather than answering it by
  architecture.

## Reporting

Write `.agent/reviews/ARCH-006-phase0-core-schema.md` in full prose: one section per question
above, each with the answer, the authority it rests on (the ADR, requirement or boundary by ID)
and, where you recommend rather than cite, the alternatives and why they lose. End with a list
titled *For the task file*: the exact migrations (file names, and the SQL where it differs from
the plan), the test cases, and the rules the lead should write into PHASE0-003; and a list titled
*For the owner*: anything only the owner can rule.

Then run exactly one of:

    herdr agent prompt lead "architect6: ARCH-006 done — .agent/reviews/ARCH-006-phase0-core-schema.md"
    herdr agent prompt lead "architect6: BLOCKED — <question>"
