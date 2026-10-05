# ARCH-006 — Is the Phase 0 plan's Task 3 schema still right?

Author: `architect6`, 2026-10-05. Read-only consult for PHASE0-003 (not yet written). Nothing
was edited except this report, and nothing was committed.

## Summary

**The plan's Task 3 cannot be dispatched as written.** Its SQL and its test contradict the
accepted architecture in twelve places, three of them on a boundary. The corrected migrations
are at the end, under *For the task file*.

The points that matter most, in order:

1. **The plan's own test writes an audit row with no actor.** `audit_entry.actor_id` is
   nullable and the grant test inserts `actor_id NULL`. That is B-13 broken by the schema and
   then exercised by the test. `actor_id` is `NOT NULL`.
2. **The application would run as a superuser.** `pool.ts` defaults to `pos_owner`, and every
   domain function in Tasks 4 to 10 goes through `query()`. The grants in `0007` would then
   protect nothing outside one test. The pool must be split in this task, not later (section 3).
3. **`settings_version` is granted `UPDATE` and `DELETE`.** SettingsVersion is immutable
   (ARCHITECTURE section 5.1, ADR-004). I recommend the table is not created in Phase 0 at all:
   nothing in Tasks 4 to 12 reads it and four of its questions are open (section 5).
4. **`REFUSED` is not an open question.** FR-J3 and AC-18 define it for a refund (owner,
   2026-09-30). Only its extension to a void is open. S6 is wrong on that point, though its
   conclusion for Task 3 survives for a different reason (section 6).
5. **S2 fixes half of the race.** Agents run `npm run verify` from several worktrees against
   one PostgreSQL container and one database, which is also the development database. Serial
   files inside one vitest run do nothing for that (section 2).
6. **The `Rate` brand should be its own task**, not a commit inside PHASE0-003 (section 7), and
   PHASE0-003 itself is two slices, not one (section 8).

Draft rules: **S3, S4, S5, S7 confirmed** (S4 and S5 with additions). **S2 confirmed and
extended. S8 and S9 corrected. S6 corrected. S1 rejected** in favour of a separate task.

## What I verified, and what I could not

Read with the file tools: the task file; the plan's Global Constraints, File Structure and
Tasks 3 to 10 whole (lines 1 to 110 and 760 to 3250); `docs/ARCHITECTURE.md`, `docs/PRD.md` and
`docs/BOUNDARIES.md` whole; ADR-002, ADR-004 and ADR-007; `.agent/DECISIONS.md` (the task
cites it); ARCH-005's report; `apps/server/src/db/pool.ts` and `migrate.ts`,
`apps/server/test/migrate.test.ts`, `apps/server/package.json` and `tsconfig.json`;
`docker-compose.yml`; the root `package.json`; `db/migrations/0001_extensions.sql`;
`packages/money/src/index.ts` and `codec.ts`, its `package.json`, `tsconfig.json` and
`test/money.test.ts`; and in `apps/pos`: `package.json`, `tsconfig.json`, `vite.config.ts`,
`src/discount.ts` and the first 230 lines of `src/orderStore.ts`.

The lead's account under *What exists* holds. Two precisions:

- `mulRate` is `mulRate(amount, rate)` (`packages/money/src/index.ts:45`), so the swap the
  brand must catch is `mulRate(rate, amount)`, as finding 3 says.
- `apps/pos/vite.config.ts` has no `test` block and there is no root vitest config, so the
  client's tests run on vitest's defaults today. That matters for S2.

**Three limits on this report.**

- **I had no search tool.** Every list of callers below is what I found by reading the files
  named above, not the result of a search.
- **I could not ask the librarian.** The role prompt says to ask it for any library fact; the
  brief allows one shell command, and `ask.sh` is a shell command. Six facts in this report
  therefore rest on recall and are marked **[verify]**. Each is paired with a test that proves
  it, so a wrong recollection fails loudly rather than shipping. The builder should put all six
  to the librarian before writing code.
- **Not read:** Tasks 11 and 12 of the plan beyond their file lists, `docs/ROADMAP.md`,
  `docs/PRODUCT.md`, the screen inventory, ADR-001, 003, 005 and 006, `rounding.ts`, `format.ts`,
  and every `apps/pos` file but the two named.

---

## 1. Task 3 against the documents

### Wrong

| # | Where | What the plan has | What it must be | Authority |
|---|---|---|---|---|
| 1 | `0004` | `audit_entry.actor_id` nullable; the test inserts `NULL` | `NOT NULL` | B-13; FR-J2; ADR-007 ("actor-attributed"); section 11 |
| 2 | `0004` | Nothing ties the outcome to the approver | A failed or cancelled approval has `approver_id IS NULL` | ADR-007; FR-J3; section 11 |
| 3 | `0004` | `security_telemetry` | `security_event` | sections 5.1 and 11 |
| 4 | `0004` | `detail jsonb` on the telemetry table | No free-form column | B-12; FR-J4; section 5.1 ("containing no PIN") |
| 5 | `0004` | `audit_entry.client_instance_id` | Removed | FR-J2 and section 5.1 list an audit entry's content, and a client is not in it |
| 6 | `0003` | No credential version | `credential_version` on StaffUser | sections 5.1 and 7.2 |
| 7 | `0006` | No credential version on the session | `credential_version`, with no default | sections 5.1 and 7.2 |
| 8 | `0006` | `app_session` | `actor_session` | section 5.1 |
| 9 | `0005` | `auth_throttle` | `pin_throttle_bucket` | section 5.1 |
| 10 | `0007` | `CREATE ROLE ... PASSWORD 'apppassword'` | No role and no credential in a migration | section 11; ADR-007; section 14.4 |
| 11 | `0007` | `UPDATE, DELETE` on `settings_version` | `SELECT, INSERT` only, if the table exists | section 5.1 ("Immutable"); ADR-004; B-8 |
| 12 | `0007` | `DELETE` on every mutable table | No `DELETE` granted on any table | ADR-002 (privileges protect invariants); see below |

Two of these need a sentence more.

**Row 4.** A PIN can only reach the database through a column wide enough to hold one. With
`detail jsonb`, B-12 on this table depends on every future caller never passing a request body
into it; the plan's own Task 6 test admits as much by scanning `detail` for six digits. With
typed columns only, there is nowhere to put one. If a diagnostic is ever needed it arrives as
a named, typed column in a migration that a reviewer reads.

**Row 12.** Nothing in Phase 0 deletes a row. A staff user is deactivated, never deleted, and
once an audit entry names them the foreign key forbids it anyway. A session is released by
timestamp. The throttle service "only ever updates rows" (the plan's own comment), and a
`DELETE` grant on that table is the ability to reset a cooldown by removing its row, which is
the opposite of FR-A5. A privilege nobody needs is a path nobody tests.

### Missing

- **`TRUNCATE` is a delete path and the plan never tests it.** `pos_app` does not hold it
  unless granted, but the test proves only `UPDATE` and `DELETE` (B-7).
- **The session's token.** The plan uses the row's primary key as the cookie value. See
  section 4; this is a recommendation, not a document requirement.
- **Any statement of which role the application runs as.** See section 3.
- **`calculation_policy_version`** on SettingsVersion (section 5.1, ADR-004), if the table is
  kept.
- **A back-office session must have an absolute expiry** (FR-A2b). The plan leaves
  `absolute_expires_at` nullable for both audiences with nothing connecting it to the audience.

### Decided too early

- **The rate ceiling** (`<= 1000000`): PRD section 9 question 3, ADR-004's last consequence,
  and the risk table in section 16 all leave the permitted range to the owner. See section 5.
- **`minor_unit_precision BETWEEN 0 AND 6`.** The lower bound is representational. The upper
  bound is the Money module's formatting limit (`formatMoney` rejects 7), which belongs at
  the edge that formats, not in the table.
- **`business_name` and `business_address DEFAULT ''`.** Which business fields a receipt
  carries is PRD section 9 question 1. An empty-string default is a value standing in for
  "not provided".
- **The audit outcome spellings.** Only `REFUSED` is spelled in a contract document. See
  section 6.

### Not wrong today, wrong the day it is needed

**Kitchen staff.** Section 5.1 gives StaffUser a "classification" and an "optional
authentication role", and FR-A1 calls kitchen "a non-authenticating staff classification with
no PIN". The plan's table requires a role and a PIN hash on every row, so it cannot hold a
kitchen staff member. I recommend keeping the plan's stricter shape now. It is the safe subset
(no row can exist with a role and no credential), relaxing a `NOT NULL` later is a one-line
forward migration, and whether the back office records kitchen staff at all is a product
question (see *For the owner*, 3). No `classification` column is added on a guess.

### Columns Task 3 must not add

- `order_id` on `audit_entry`. FR-J2 requires an order reference, and there is no order table
  to reference. An unconstrained `uuid` would be a guess at Phase 2's key.
- `refusal_code` and the `REFUSED` outcome (section 6).
- A richer before-and-after shape. FR-F8 and AC-8 need a discount change's audit entry to carry
  names and kinds, which two `bigint` columns cannot. That is Phase 2's design, and money inside
  any JSON it chooses must be canonical strings (ADR-004). Task 3 keeps the two amount columns
  and does not pretend they are final.
- An `action` vocabulary. FR-J3 lists the audited actions, but their spellings belong to the
  phases that write them.
- A CSRF token, a re-authentication time or a lease reference on the session (section 7.2 and
  section 6.3 are Tasks 8 and 9 and Phase 4).
- Anything for orders, catalog, business days, receipts, tenders, print jobs or idempotency.
- A `created_by` on SettingsVersion. Settings changes are not in FR-J3's audited list.

---

## 2. The race (S2)

### Ruling

**S2 is confirmed as far as it goes.** Server test files run one at a time; the client's tests
keep running in parallel. I rule on the outcome, and name the mechanism as a preference:

> Any invocation of vitest from the repository root that includes a server test runs the server
> test files one at a time, after the server's global setup has run. That holds for
> `npm run verify`, for `npx vitest run`, and for `npx vitest run apps/server/test/<file>`.

**Preferred mechanism:** one root `vitest.config.ts` with `test.projects`: a project for
everything that is not the server, configured exactly as today's defaults, and a `server`
project with `fileParallelism: false` and a `globalSetup`. **[verify]** that vitest 4.1 honours
`fileParallelism` per project, and whether projects with different parallelism must be placed
in different `sequence.groupOrder` groups; my recollection is that both are true from 3.2 on.

*Why not two vitest invocations chained in the npm script?* It is version-proof, and it is the
fallback if the per-project option is not honoured. It loses as the first choice because the
rule would then live in a script: `npx vitest run apps/server/test/schema.test.ts`, which is
how the plan tells a builder to run every step, would bypass it and race again.

*Why not a database per worker?* Rejected, as the lead says, and for a second reason: roles are
global to the cluster, and the throttle buckets are installation-wide state by design (FR-A5),
so per-worker databases would still share part of what the tests assert on.

*Why not a transaction per test, rolled back?* It cannot test what this phase exists to test:
ADR-007's separate committed transaction for a failed approval, rollback of a command with its
audit entry, and the migration runner itself.

*Why not an advisory lock around each file's setup?* Files would still interleave after setup.

A rule for the task file that follows from the ruling: no `describe.concurrent` or
`test.concurrent` in a server test.

### The half S2 does not fix

Two things share the one database today, and serial files address neither.

**Other worktrees.** Builders, reviewers and the lead each run `npm run verify` from their own
worktree against the same container on port 5433. Every client task's verify already runs
`migrate.test.ts`, which drops the public schema. Two verifies at once is the same race as
finding 1, across processes. It has been rare because there was one short server file. It will
not stay rare.

**The development database.** The tests drop the schema of database `pos`, which is the
database `npm run dev` uses. From Phase 1, B-24 means the menu, tables, staff and rates in it
are entered by hand through the back office. Every `npm run verify` would erase them.

**I recommend both fixes in the same global setup**, because that file is being written anyway:

1. The server project runs against its own database, `pos_test`, in the same container. The
   provisioning step (section 3) creates it. `pos` is never touched by a test.
2. The global setup takes a session-level PostgreSQL advisory lock on a dedicated connection
   and holds it until teardown. A second verify, from any worktree, waits its turn.

*The alternative*, a database per worktree, isolates without waiting. It loses on leftovers
(databases accumulate as worktrees are deleted) and on the shared role. Waiting a few seconds
is the cheaper cost.

These two are recommendations. The documents require real PostgreSQL (ADR-002, section 14.2)
and "isolated fixtures" (section 14.4); they do not say how.

### Must `migrate.test.ts` change?

**Its assertions do not change, and none may be weakened.** It keeps dropping the schema before
each case and keeps running the real `db/migrations`. Its assertion on
`applied: 0001_extensions.sql` still holds when more files follow.

Two mechanical changes are forced by section 3, not by the race:

- It must drop the schema and read `schema_migration` through the **owner** connection. Once
  `query()` is the application role, `DROP SCHEMA` through it fails, as it should.
- The real migrations will grant to `pos_app`, so the role must exist before this file runs.
  The global setup provides that.

The task file should say that these are the only permitted edits to that file.

### Proof

The Task 1 builder's reproduction (a second file with the same `beforeAll`, failing five runs
of five) becomes the acceptance test: with `schema.test.ts` beside `migrate.test.ts`, ten
consecutive `npm run verify` runs pass. And the count of client test files and tests reported
by vitest is identical before and after the configuration change. A projects configuration
that silently drops or re-environments client tests is the likeliest way this goes wrong.

---

## 3. Roles and credentials (S3, S8)

### What the documents decide

- "Migration and administrative roles are separate and are not application credentials"
  (section 11; ADR-007).
- "Use separate database owner/migration and application roles so immutability privileges are
  exercised locally" (section 14.4).
- Immutability is enforced "through privileges and the absence of update/delete application
  paths" (section 8), and privileges are how the architecture protects what can be expressed
  below the domain layer (ADR-002).

That is **two** roles, not three: an owner that also migrates, and the application. The brief
asks about three. A non-superuser owner distinct from the cluster's bootstrap superuser is
hardening for the pre-production gate (section 3.2); nothing requires it in the MVP, and
`pos_owner` as created by Compose can stay the owner and migration role.

### The finding the plan misses: the application is the superuser

"Exercised locally" means the running application connects as `pos_app`. Today it cannot:

- `pool.ts:16` defaults to `pos_owner`, a superuser.
- The plan's `config.ts` (Task 4) defines `DATABASE_URL` with a `pos_app` default, and nothing
  reads it: `pool.ts` reads `process.env.DATABASE_URL` itself and falls back to the owner.
- Every domain function in Tasks 4 to 10 calls `query()` or `withTransaction()`.

So as planned, the audit writer, the throttle and the approval primitive would all be built and
tested as a role that bypasses every grant. Finding 2 says a B-7 test through `query()` cannot
fail. The same is true of the product.

**This is PHASE0-003's to fix, because it creates the role.** The rule:

> `query()`, `withTransaction()` and `getPool()` connect as the application role, from
> `DATABASE_URL`. The migration runner connects as the owner, from `MIGRATION_DATABASE_URL`,
> through its own connection. No module under `apps/server/src` other than the migration runner
> can reach the owner connection. Neither variable has a fallback in source: unset is an error.

*The alternative*, keeping a development fallback in `pool.ts`, loses for the reason the
loopback guard fails closed (section 3.2): a server that starts with nothing configured should
stop, not connect as whatever a default names. The existing fallback is worse than most,
because the role it names is the one that defeats B-7.

### How the roles come to exist (S3: confirmed)

**No migration creates a login or holds a credential.** A migration is the one database
artefact that would run unchanged on a real installation; a password in it is permanent.

I recommend an **idempotent provisioning step**, not a Compose init script:

- It connects as the owner and creates `pos_app` if absent, with `LOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS`, and sets its password from an environment variable
  on every run. It creates `pos_test` if absent.
- It runs from `npm run db:up` (after the container is healthy) and from the server project's
  vitest global setup.
- It is development and test tooling. It is not imported by the server's runtime.

*Why not the Compose init script the lead suggests?* Init scripts run only when the data
directory is first created. The `pgdata` volume already exists on the owner's machine and on
any machine that has run `db:up`, so the script would silently not run, and the first symptom
would be a failed migration. An idempotent step has no first-run condition.

**[verify]** `CREATE ROLE ... PASSWORD` is a utility statement and takes no bind parameter; the
password must be quoted with the driver's literal-escaping function, not concatenated.

**Where the development values live.** In one committed, development-only file, read by
Compose, by the npm scripts and by the vitest setup. `docker-compose.yml` already holds the
owner's development password in the open; the application role's goes beside it under the same
status. It must be committed rather than ignored: a fresh agent worktree has to pass
`npm run verify` with no manual step. The file states that it configures a throwaway
loopback-only database and nothing else.

A real installation's roles are created by its operator. That is the pre-production gate's.

### `GRANT ... ON ALL SEQUENCES`: not right

Three defects. It covers only sequences that exist when it runs, so a later table's sequence is
silently uncovered. It grants `SELECT` on sequences, which nothing needs. And it exists only
because the plan uses `bigserial`.

**Use `bigint GENERATED ALWAYS AS IDENTITY`** for the two evidence tables and drop the line.
**[verify]** an insert into an identity column needs no privilege on its underlying sequence;
the insert test as `pos_app` proves it. `GENERATED ALWAYS` also stops the application
choosing an audit entry's id.

### Later tables: no default privileges

I recommend **against** `ALTER DEFAULT PRIVILEGES`.

- It fails open in the direction that matters. Whatever default is chosen applies to the next
  immutable table (Receipt, Tender, Refund, BusinessDayReport) without anyone deciding it.
- It binds to the role that ran it. A later migration run by a different owner would create
  tables the default never touched, and nothing would say so.
- It is invisible in the migration that creates the table.

Instead, two rules:

> A migration that creates a table states that table's grants in the same file.

> One test holds the complete expected privilege set for `pos_app`, table by table and column
> by column, and compares it for equality with what the catalog reports. A table the test does
> not name fails it.

The second rule is what makes the first safe: a new table cannot reach `development` without
someone writing down, in a reviewed file, what the application may do to it. This also means
the plan's separate `0007_roles_and_grants.sql` goes away. The test is the one place to audit.

### Is plain `SELECT` on the audit tables acceptable under section 11?

**Acceptable, and I recommend less.**

I read "insert and read permitted projections" as the application's projections: section 13
gives the back office "manager-only filtered audit reads", and says the two surfaces "may
expose different projections of the same underlying data". With one application role the
database cannot tell a manager from a cashier, so a database view would not enforce that
permission either. Plain `SELECT` therefore does not violate section 11. S8's reading, that
views are a later phase's, is right.

But S8 also says "nothing more", and no application code in Phase 0 reads either table. The
audit viewer is Phase 5. So **grant `INSERT` only on `audit_entry` and `security_event`** now.
The task that builds the first reader grants `SELECT`, on the table or on a view, and decides
then with the reader in front of it. Tests assert on the tables through the owner connection.

Two further restrictions, both cheap, both recommendations:

- **Column-level `INSERT`**, excluding `id` and `occurred_at`. The application then cannot
  supply an audit timestamp at all, so "audit time is database time" (section 14.4) is a
  property of the grant, not of each caller's discipline.
- **A trigger that rejects `UPDATE`, `DELETE` and `TRUNCATE` on `audit_entry` for every role.**
  Privileges stop `pos_app`. They do not stop the owner, a superuser, or a migration that
  contains an `UPDATE`. B-7 says "not for cleanup, not for tests, not for a mistake", and the
  plan's Tasks 5, 9 and 10 each open with `DELETE FROM audit_entry` in a `beforeEach`. With
  the trigger, that test setup fails on its first run and the builder resets the database
  instead (drop and migrate, which recreates a test database and edits no log).
  *The alternative*, privileges alone, is what the documents decide and is sufficient for
  ADR-007. It loses because it leaves B-7's "not for tests" to review. **[verify]** one
  statement-level trigger may combine `UPDATE OR DELETE OR TRUNCATE`; statement-level matters,
  because a row-level trigger does not fire on an empty table.

`security_event` gets the `INSERT`-only grant and **no** trigger. Section 8's list of immutable
records does not include it, and retention of operational telemetry may one day be a legitimate
administrative act. B-7 is the audit log's boundary.

---

## 4. Identity (S4)

### A credential version is the right shape, and it belongs in Task 3

Sections 5.1 and 7.2 name it on both StaffUser and ActorSession, so the shape is decided. It
belongs in Task 3 because it is two columns of the tables Task 3 creates; reading it is Task
7's. This is not state without a reader: the reader is three tasks away in the same phase.

**S4 is confirmed with three additions.**

1. **`actor_session.credential_version` has no default.** A default of 1 would make a session
   created by code that forgot the column valid for every user who has never changed a PIN.
   Omitting it must be a `NOT NULL` violation.
2. **The session records the version of the credential that was verified, not the version
   current at insert.** The PIN lookup returns `credential_version` in the same row as the
   hash it verified against, and session creation is passed that value. If creation re-read
   the user's current version, a PIN reset landing between verification and insert would mint
   a valid session from the old PIN. This is a rule for Task 7, stated here because the plan's
   `findUserByPin` returns only `id` and `role`.
3. **The plan's Task 7 mechanism is not the architecture's.** `invalidateSessionsForUser` sets
   `released_at` on the user's sessions. That sweep misses a session created concurrently with
   it. Section 7.2's mechanism is the comparison: a session resolves only while its recorded
   version equals the user's. Task 7's task file must be written to that, with a test for the
   interleaving in point 2 (section 14.2 lists "credential invalidation").

Whether the bump on deactivation and PIN reset is enforced by a database trigger or by the one
domain function that performs them is Phase 1's decision, when FR-B3's writer exists. Task 3
adds no trigger for it.

### What `actor_session` must record

| Column | For | Authority |
|---|---|---|
| `audience` | Route context and which timeout policy applies; never permission | FR-A2c; section 7.2 |
| `staff_user_id` | The actor | B-13; section 5.1 |
| `credential_version` | Invalidation on the next request | section 7.2; FR-B3 |
| `issued_at` | The time of authentication | section 5.1 ("issue time") |
| `last_interactive_at` | The 90-second and 30-minute idle rules | FR-A2, FR-A2b |
| `absolute_expires_at` | The eight-hour limit; required for `BACK_OFFICE` | FR-A2b |
| `released_at` | Explicit release and logout | FR-A2, FR-A2b |
| `client_instance_id` | Continuity only | FR-A7 |

The column is named `last_interactive_at`, not `last_activity_at`, so the name carries FR-A2b's
rule that polling is not activity. The idle limits themselves (90 seconds, 30 minutes) are
policy in code, as the plan has them. They are fixed by the PRD, not restaurant configuration,
so B-24 does not reach them.

The POS has no absolute lifetime in any document, so the schema requires an expiry for
`BACK_OFFICE` and does not forbid one for `POS`.

### What must be database time

Section 14.4: "use PostgreSQL time for lease, cooldown, session, receipt, and business-day
persistence." In Task 3 that is every timestamp in every table: `issued_at`,
`last_interactive_at`, `absolute_expires_at`, `released_at`, `blocked_until`, both
`occurred_at` columns and the client instance's two. The rule for Tasks 5 to 7:

> A timestamp is written as `now()` or `now() + interval` inside the SQL statement. No
> JavaScript `Date` is ever a query parameter for a stored time, and every expiry comparison is
> made in SQL against `now()`.

Only the audit and security-event timestamps can be made structural (the column-level grant).
The rest is this rule plus review. Tests age a session through the owner connection, as the
plan's `ageSession` does.

### The session token (a recommendation)

The plan sends the session row's primary key as the cookie value. I recommend the cookie
carries a random 256-bit token and the row stores only its SHA-256 digest (`token_hash`), with
the `id` kept as an internal reference.

- Any read of the table then yields no usable session: not a dump, not a statement log, not a
  `SELECT` through the application role.
- A primary key gets referenced and logged. The CheckoutLease will record facts about the
  authenticating session (section 6.3), and an id that is also a bearer credential turns every
  such reference into a copy of the credential.

A plain digest is enough because the token is high-entropy; this is not a PIN. *The
alternative*, the id as the token, is what the plan has and is defensible on a loopback-only
host. It loses because the change is one column now and a cookie-contract change later.
Section 7.2 says only "opaque server-side sessions", so this is the lead's call.

`ClientInstance` is different: its id is the cookie value, by design. It is never authorization
(FR-A7), so there is nothing to protect.

---

## 5. Money and settings (S7, finding 7)

### What ADR-004 requires now: nothing

ADR-004 binds the calculation, the snapshots and the representation. Its only schema
consequence for a settings table is that a SettingsVersion is immutable and carries a
calculation-policy version (section 5.1). Nothing in Phase 0 calculates a total. The plan's own
Global Constraints say Phase 0 "builds only precision-independent primitives".

### I recommend Task 3 does not create `settings_version`

I checked Tasks 4 to 10 line by line and the file lists of 11 and 12: nothing reads or writes
it. Its first writer is the Phase 1 settings screen. Meanwhile four of its questions are open:

- which business fields a receipt carries (PRD section 9, question 1);
- the permitted rate range (PRD section 9, question 3);
- how the *current* version is identified (a `uuid` key and `created_at` cannot order two
  versions made in one transaction);
- what the calculation-policy version's values are.

A table created now is created by the task least able to answer them. This is the rule
ARCH-004 and ARCH-005 applied to the client: no state without a reader.

*The alternative* is to create a minimal table now. It costs little, since the table will be
empty until Phase 1. It loses because "empty until Phase 1" is also the argument that it buys
nothing, and because the plan's version already shows how a table with no reader collects
invented constraints. The corrected SQL is in *For the task file* if the lead keeps it.

### Which checks are representational

S7 is **confirmed**. Applied to the plan's table:

| Check | Kind | Verdict |
|---|---|---|
| rate `>= 0` | Representational: `mulRate` and `taxIncludedIn` reject a negative rate | keep |
| rate `<= 1000000` | A business range. Both formulas in section 10 are well defined above 100% | remove; PRD section 9 |
| precision `>= 0` | Representational | keep |
| precision `<= 6` | The formatter's limit | remove; enforce where formatting happens |
| currency `^[A-Z]{3}$` | Representational: the shape of a currency code | keep |
| rate and money columns are `bigint` | B-1, FR-M2, ADR-004 | keep |

The owner's question is not pre-empted by `>= 0`. It would be by any ceiling, including a
generous one.

### FR-M1's immutability

**None of it is Task 3's.** "Immutable after the first order" needs an order. Enforcement is
Phase 2's, and the plan's comment says so correctly. One consequence for whoever designs it: in
an append-only versions table, the rule is not "this row cannot change" (no row can) but "once
an order exists, a new version must repeat the currency and precision of the last". That is a
check at insert against other rows, which is a different mechanism from a column constraint.

### The seeds

No settings row is seeded: **confirmed** (B-24). The two throttle rows are seeded:
**confirmed**. They are not configuration. FR-A5 fixes that there are exactly two, a
restaurant never changes them, and seeding lets the service only ever update, which removes a
creation race.

---

## 6. Audit (S6, finding 8)

### The outcome set

**The documents name four outcomes, not three.**

1. A successful audited action (FR-J3; section 11).
2. A failed manager approval, `approver = null` (FR-J3; ADR-007).
3. A cancelled manager approval, `approver = null` (FR-J3; ADR-007).
4. `REFUSED`: an approved refund the server then refuses, naming actor and approver, with the
   refusal code and no amounts (FR-J3; AC-18; owner, 2026-09-30).

**S6 is wrong where it says "no `REFUSED` until ruled".** It is ruled, for the refund. What
ARCH-005 left open is only whether an approved *void* that the server refuses writes one too.

**Task 3 still creates three.** Not because `REFUSED` is undecided, but because it is not one
value: it brings a `refusal_code` column and two constraints of its own (an approver is
present; the amounts are absent). Those arrive together, in the migration of the phase that
first writes the outcome: Phase 4 for the refund, or Phase 2 if the owner extends it to the
void. Widening a check constraint is a migration by the owner role and edits no row. The task
file should say the outcome check is expected to widen, so nobody reads three as final.

**The spellings.** `REFUSED` is the only outcome spelled in a contract document. `SUCCESS`,
`INVALID_APPROVAL` and `CANCELLED` are the plan's. In an append-only table a spelling is
permanent, so I recommend following the documents' words, as S5 does for table names:
`SUCCESS`, `APPROVAL_FAILED`, `APPROVAL_CANCELLED`. A bare `CANCELLED` in a table that will
also hold voids, beside a KitchenCancellationTicket, invites a misreading on the audit viewer.
This is a recommendation; the lead may keep the plan's words.

### `audit_entry` under ADR-007, FR-J2 and FR-J3

| Column | Rule | Authority |
|---|---|---|
| `id` | identity, never supplied by the application | section 3 above |
| `actor_id` | `NOT NULL`, references StaffUser | B-13; FR-J2 |
| `approver_id` | nullable, references StaffUser; may equal the actor | FR-J2; section 7.1 |
| `action` | required, not blank; no vocabulary yet | FR-J2 |
| `outcome` | one of the three | above |
| `subject_type`, `subject_id` | both present or both absent | FR-J2 |
| `reason` | nullable; required by the command, where it is required | FR-J2; FR-H4 |
| `before_amount`, `after_amount` | `bigint`, nullable | FR-J2; B-1 |
| `occurred_at` | database time, never supplied by the application | FR-J2; section 14.4 |

One constraint the documents decide: `outcome = 'SUCCESS' OR approver_id IS NULL`. A successful
action does not require an approver (an unfired void has none, FR-H3).

The foreign keys to StaffUser carry no `ON DELETE` action. A staff member named in the audit
log cannot be deleted, which is correct and should be stated in a comment.

### `security_event` under section 11, B-12 and B-13

"Operational evidence for unauthenticated failures and cooldowns, containing no PIN and no
claimed audit actor" (section 5.1).

- `event_type`: `PIN_FAILURE` or `COOLDOWN_STARTED`, the two things FR-J3 names ("unauthenticated
  PIN failures and throttle cooldowns").
- `throttle_class`: `LOGIN` or `MANAGER_APPROVAL`, required.
- `client_instance_id`: optional, a real foreign key (FR-A7 allows it for telemetry).
- `occurred_at`: database time.
- **No reference to StaffUser, in any form.** A column that could name a person would be a
  claimed actor in a store built for events that have none. A test asserts the table has no
  foreign key to `staff_user`.
- **No free-form column** (row 4 of section 1).

---

## 7. The `Rate` brand (S1)

### S1 rejected: its own task, first

The lead's 2026-09-14 ruling is that the brand "runs before Task 3". A separate task that
merges first satisfies it. I recommend that over a commit inside PHASE0-003:

- **Nothing in the schema task depends on it.** Task 3 writes SQL and a test that reads the
  catalog. No line of it uses `Rate`. The ordering was to keep server code from being written
  against an unbranded type, and the first server code that touches a rate is Phase 2's.
- **It is a change to the client.** `apps/pos` imports `@pos/money`, and the brand is checked
  by `tsc -p apps/pos`. A database task whose diff reaches into client tests has two unrelated
  ways to fail review.
- **It is a money change** and is reviewed as one. Bundled, it shares a review with grants.
- The owner's ruling of 2026-09-14 is that tasks are one reviewable slice.

The two tasks touch disjoint files and can run at the same time.

### What it breaks

Assuming `type Rate = bigint & { readonly __rate: unique symbol }` or the equivalent:

**In `packages/money/src/index.ts`:** `rateFromPercent` returns a plain `bigint` expression and
needs the one cast. The arithmetic in `mulRate` and `taxIncludedIn` keeps compiling: a branded
`bigint` compares with and multiplies as `bigint`.

**In `packages/money/test/money.test.ts`** (its `tsconfig.json` includes `test`, so the
compiler names these):

- `mulRate(1485n, -1n)` and `taxIncludedIn(1485n, -1n)`: the negative-rate cases;
- `taxIncludedIn(1485n, 0n)`;
- three property tests that pass a `fc.bigInt` as the rate.

**In `apps/pos/src/discount.ts`:** nothing. Every rate there comes from `rateFromPercent`;
`rate > RATE_SCALE` still compiles, and `let rate: bigint` at line 141 accepts a `Rate`. I read
no other client file that uses a rate, and could not search for one. The typecheck will name
any that exist.

### Three things the task needs that S1 does not say

1. **A second constructor.** A rate read from a `bigint` column, a rate in a property test and
   a rate in a fixture all start as a `bigint`. Without `rateFromPpm(ppm: bigint): Rate`,
   rejecting a negative, every one of those becomes an `as Rate` cast, and a brand that is cast
   around everywhere checks nothing. The two negative-rate tests keep one deliberate cast each,
   since they test the runtime guard behind the type.
2. **A compile-time test that the swap fails.** A `// @ts-expect-error` over
   `mulRate(rate, amount)` in a file the typecheck includes. Vitest does not typecheck, so
   without that line the property the brand exists for is asserted nowhere.
3. **A stated limit.** `Money` stays `bigint` by the lead's ruling, so a `Rate` is still
   accepted wherever a `Money` is wanted: `mulRate(rate, rate)` compiles. The brand catches the
   swap and nothing else. The task file should say so.

**Found, not this task's:** `discount.ts:96-97` holds the installation's two rates as literals
in client code. It is a fixture stand-in for display, and its comment says pricing is the
server's. It must go when the server supplies a SettingsVersion (B-24), and belongs on the list
of what Phase 2 removes.

---

## 8. Anything else

### Pushback on the draft

1. **PHASE0-003 is three slices.** By the end of this report it holds: a vitest projects
   configuration with a global setup, a provisioning step, a pool split, an environment file,
   four migrations and a test file. I recommend:
   - **PHASE0-003a**, the `Rate` brand (section 7);
   - **PHASE0-003b**, the harness and roles: vitest configuration, global setup, provisioning,
     the pool split, the changes to `migrate.test.ts`. No new table;
   - **PHASE0-003c**, the schema and its test, on top of 003b.
   003b is where the race and the superuser are fixed, and it is testable alone: the Task 1
   reproduction passes, and a test proves the application pool is not a superuser.
2. **S5 names one rename; consistency needs three,** and two columns (sections 1 and 4). The
   plan's Tasks 4 to 10 use the old names throughout, so each later task file must restate
   them. The task file for 003c should carry the name table once and say it supersedes the
   plan.
3. **S8 keeps `DELETE` on the mutable tables by silence.** Section 1, row 12.
4. **S9's three additions are weaker than they read.**
   - "No PIN column" as a name match proves little. Assert the exact column list of both
     evidence tables (name, type, nullability). An added column then fails the test and
     forces a decision.
   - "No float on any money or rate column" needs a way to know which columns are money.
     Assert instead that no column in the schema has type `real`, `double precision`, `numeric`
     or `money`. Phase 0 has no legitimate use for any of them; a later one adds a named
     exception in the test.
   - "No `UPDATE` or `DELETE` on the SecurityEvent table": add `TRUNCATE`, for both tables.
5. **The plan's grant test proves B-7 on an empty table.** `UPDATE audit_entry SET ...` with no
   rows is still refused for lack of privilege, so that test is sound. The trigger is the case
   where emptiness matters, hence statement-level.

### Boundaries

- **B-1:** kept. The plan's `bigint` columns and the string type parser in `pool.ts` are right.
- **B-7:** the plan's later tasks delete from the audit log in test setup (section 3). The
  schema as planned permits it. With the trigger it cannot happen.
- **B-11:** I recommend one check, `pin_hash LIKE '$argon2id$%'`. It is representational (the
  column holds an Argon2id encoded hash, FR-A3) and it makes storing a raw PIN in that column
  a constraint violation. The plan's test fixtures (`'h1'`) change accordingly.
- **B-12:** section 1, row 4.
- **B-13:** section 1, row 1. This is the most serious defect in the plan's Task 3. The plan's
  Task 5 repeats it in TypeScript (`actorId: string | null`).
- **B-24:** kept. No settings row, no staff row, no rate.

No draft rule requires a boundary to be broken.

### Found in Tasks 4 to 10, for the lead's later task files

These are outside Task 3. I list them because the lead writes those task files from the same
plan, and each would otherwise be copied.

- **Task 4** `config.ts` carries `'postgres://pos_app:apppassword@...'` as a default, the same
  credential-in-source as `0007`, and `findUserByPin` does not return the credential version.
- **Tasks 4 to 10** reset state with `DELETE FROM` through `query()`. Under section 3 that is
  the application role and fails; for `audit_entry` it is B-7.
- **Task 5** `AuditInput.actorId` is `string | null` (B-13), and carries `clientInstanceId`.
- **Task 6** writes a `PIN_FAILURE` event with a free-form `detail`. Its `recordFailure` leaves
  the counter at five after a cooldown ends, so the first failure afterwards blocks again at
  once (*For the owner*, 2).
- **Task 7** invalidates by sweep, not by credential version (section 4).
- **Task 9** sets both session cookies `sameSite: 'lax'`; section 7.2 says `SameSite=Strict`,
  origin validation and an anti-CSRF token.
- **Task 10** counts the failure and then writes the audit entry in a second transaction, and
  writes no audit entry when the approval is refused by the cooldown (*For the owner*, 1).

A consult before Tasks 6, 7 and 10 are dispatched would be worth its cost; each touches
identity or audit.

### A proposed ADR

Four rules in section 3 will bind every later phase that creates an immutable table: grants in
the creating migration, the complete privilege test, no default privileges, and the
append-only trigger. Rules that bind beyond one task belong in an ADR, not in a task file that
the next builder does not read. I recommend the lead commissions **ADR-008, database roles and
structural immutability**, as `Proposed`, for the owner to accept. It supersedes nothing:
ADR-007 says the application role cannot update or delete, and this says how that is kept true
as tables are added. I did not write it; this consult writes one file.

---

## For the task file

### Tasks

- **PHASE0-003a:** the `Rate` brand. Rules in section 7.
- **PHASE0-003b:** harness and roles. No new table.
- **PHASE0-003c:** schema and its test, cut from 003b.

### Names (supersedes the plan wherever they differ)

| Plan | Use | Authority |
|---|---|---|
| `security_telemetry` | `security_event` | sections 5.1, 11 |
| `app_session` | `actor_session` | section 5.1 |
| `auth_throttle` | `pin_throttle_bucket` | section 5.1 |
| `last_activity_at` | `last_interactive_at` | section 5.1; FR-A2b |
| `created_at` (session) | `issued_at` | section 5.1 |
| `first_seen`, `last_seen` | `first_seen_at`, `last_seen_at` | consistency |
| `event` | `event_type` | consistency |
| `INVALID_APPROVAL`, `CANCELLED` | `APPROVAL_FAILED`, `APPROVAL_CANCELLED` | recommended (section 6) |

`staff_user`, `client_instance` and `audit_entry` are unchanged.

### Rules for PHASE0-003b

1. Server test files run one at a time under every way of invoking vitest from the root; the
   client's tests stay parallel. Preferred: root `vitest.config.ts` with `test.projects`.
   Fallback: two chained invocations. No `.concurrent` in a server test.
2. The server project has a global setup that, in order: takes a session-level advisory lock
   on a dedicated connection and holds it until teardown; runs the provisioning step; points
   the run at database `pos_test`.
3. The provisioning step is idempotent, connects as the owner, creates or alters `pos_app`
   with `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` and a password
   from the environment, and creates `pos_test` if absent. It also runs from `npm run db:up`.
   It is not imported by the server's runtime. No Compose init script.
4. `getPool`, `query` and `withTransaction` connect from `DATABASE_URL` as `pos_app`. The
   migration runner connects from `MIGRATION_DATABASE_URL` through its own connection. Neither
   has a fallback in source. No other module under `apps/server/src` reaches the owner
   connection.
5. No credential in `db/migrations/` or `apps/server/src/`. Development values live in one
   committed development-only file, read by Compose, the npm scripts and the vitest setup.
6. A test support module gives tests an owner connection and a `resetDatabase()` (drop the
   public schema, run the real migrations). Tests reset with it and never with `DELETE`.
7. `migrate.test.ts`: the only permitted edits are using the owner connection for its schema
   drop and its reads. Every assertion stays.
8. Acceptance: ten consecutive green `npm run verify` runs with a second server test file of
   the Task 1 reproduction's shape; the client's test-file and test counts unchanged from
   before the configuration; and a test that the application pool's `current_user` is
   `pos_app`, is not a superuser, cannot create a role or a database, and has no `CREATE` on
   schema `public`.
9. Put the six **[verify]** facts to the librarian before writing: per-project
   `fileParallelism` and `groupOrder` in vitest 4.1; per-project `globalSetup` and `env`;
   identity columns and sequence privileges; a statement-level trigger on `UPDATE OR DELETE OR
   TRUNCATE`; literal-escaping for `CREATE ROLE ... PASSWORD`; whether `tsx` passes
   `--env-file` through.

### Migrations for PHASE0-003c

Four files. `0007_roles_and_grants.sql` and `0002_settings.sql` are not created. Each file
grants for the tables it creates.

`db/migrations/0002_staff_user.sql`

```sql
-- The application connects as pos_app. A provisioning step creates that role
-- before any migration runs: a migration never creates a login and never
-- holds a credential. If the role is missing, this file fails, as intended.
GRANT USAGE ON SCHEMA public TO pos_app;

CREATE TABLE staff_user (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  role               text NOT NULL,
  -- Argon2id encoded hash, used to verify a PIN (B-11, FR-A3).
  pin_hash           text NOT NULL,
  -- Keyed blind index of the PIN under a secret held outside the database
  -- (ARCHITECTURE 7.3). Finds the one row to verify and makes PINs unique
  -- (FR-A4). It is not a verifier and is never exposed or logged.
  pin_lookup         text NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  -- Incremented on deactivation and on PIN reset. A session is valid only
  -- while the version it recorded equals this one (ARCHITECTURE 7.2).
  credential_version integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- KITCHEN is a staff classification, never an authenticating role (FR-A1).
  CONSTRAINT staff_user_role_check CHECK (role IN ('CASHIER', 'MANAGER')),
  CONSTRAINT staff_user_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT staff_user_pin_hash_check CHECK (pin_hash LIKE '$argon2id$%'),
  CONSTRAINT staff_user_credential_version_check CHECK (credential_version >= 1)
);

CREATE UNIQUE INDEX staff_user_pin_lookup_key ON staff_user (pin_lookup);

-- No DELETE: a staff member is deactivated, never removed.
GRANT SELECT, INSERT, UPDATE ON staff_user TO pos_app;
```

`db/migrations/0003_client_instance_and_actor_session.sql`

```sql
-- Browser-profile identity for continuity and telemetry only. Never an
-- authorization boundary (FR-A7).
CREATE TABLE client_instance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON client_instance TO pos_app;

-- Every timestamp here is PostgreSQL time (ARCHITECTURE 14.4).
CREATE TABLE actor_session (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the opaque token the cookie carries. The token itself is
  -- never stored, so reading this table yields no usable session.
  token_hash          bytea NOT NULL,
  -- Audience decides route context and timeout policy, never permission
  -- (FR-A2c). Role still decides what the actor may do.
  audience            text NOT NULL,
  staff_user_id       uuid NOT NULL REFERENCES staff_user (id),
  -- The version of the credential that was verified. Deliberately no
  -- default: a session created without it must fail, not validate.
  credential_version  integer NOT NULL,
  client_instance_id  uuid REFERENCES client_instance (id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  -- Interactive activity only. Polling does not move it (FR-A2b).
  last_interactive_at timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz,
  released_at         timestamptz,

  CONSTRAINT actor_session_audience_check
    CHECK (audience IN ('POS', 'BACK_OFFICE')),
  CONSTRAINT actor_session_token_hash_check
    CHECK (octet_length(token_hash) = 32),
  -- FR-A2b: a back-office session always has an absolute lifetime.
  CONSTRAINT actor_session_back_office_expiry_check
    CHECK (audience <> 'BACK_OFFICE' OR absolute_expires_at IS NOT NULL),
  CONSTRAINT actor_session_expiry_after_issue_check
    CHECK (absolute_expires_at IS NULL OR absolute_expires_at > issued_at)
);

CREATE UNIQUE INDEX actor_session_token_hash_key ON actor_session (token_hash);
CREATE INDEX actor_session_active_idx
  ON actor_session (staff_user_id) WHERE released_at IS NULL;

-- No DELETE: a session ends by released_at or by expiry.
GRANT SELECT, INSERT, UPDATE ON actor_session TO pos_app;
```

If the lead declines the token recommendation, drop `token_hash`, its check and its index.

`db/migrations/0004_audit_entry_and_security_event.sql`

```sql
-- B-7 for every role, the owner and a superuser included. Privileges stop
-- the application; this stops a migration, a test and a mistake.
CREATE FUNCTION reject_change_to_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted (B-7)',
    TG_TABLE_NAME, TG_OP;
END;
$$;

-- Append-only (B-7). No updated_at, no deleted_at, no soft delete.
CREATE TABLE audit_entry (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- B-13: every entry names a person. An event with no identified actor is
  -- a security_event, never an audit entry with a null or stand-in actor.
  -- No ON DELETE action: a staff member named here cannot be deleted.
  actor_id      uuid NOT NULL REFERENCES staff_user (id),
  -- May equal actor_id (ARCHITECTURE 7.1).
  approver_id   uuid REFERENCES staff_user (id),
  action        text NOT NULL,
  outcome       text NOT NULL,
  subject_type  text,
  subject_id    text,
  reason        text,
  before_amount bigint,
  after_amount  bigint,
  occurred_at   timestamptz NOT NULL DEFAULT now(),

  -- Expected to widen: REFUSED arrives with its refusal_code and its own
  -- constraints, in the phase that first writes it (FR-J3).
  CONSTRAINT audit_entry_outcome_check
    CHECK (outcome IN ('SUCCESS', 'APPROVAL_FAILED', 'APPROVAL_CANCELLED')),
  -- ADR-007: a failed or cancelled approval names no approver.
  CONSTRAINT audit_entry_unapproved_outcome_check
    CHECK (outcome = 'SUCCESS' OR approver_id IS NULL),
  CONSTRAINT audit_entry_action_check CHECK (btrim(action) <> ''),
  CONSTRAINT audit_entry_subject_check
    CHECK ((subject_type IS NULL) = (subject_id IS NULL))
);

CREATE INDEX audit_entry_occurred_at_idx ON audit_entry (occurred_at DESC);

CREATE TRIGGER audit_entry_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_entry
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change_to_append_only();

-- Insert only, and never id or occurred_at: the application cannot choose
-- an entry's identity or its time. No SELECT until a task builds a reader.
GRANT INSERT (actor_id, approver_id, action, outcome, subject_type,
              subject_id, reason, before_amount, after_amount)
  ON audit_entry TO pos_app;

-- Operational evidence for events with no identified actor (B-13). It has no
-- column that could name a person and none wide enough to hold a PIN (B-12).
-- Neither may ever be added.
CREATE TABLE security_event (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type         text NOT NULL,
  throttle_class     text NOT NULL,
  client_instance_id uuid REFERENCES client_instance (id),
  occurred_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT security_event_type_check
    CHECK (event_type IN ('PIN_FAILURE', 'COOLDOWN_STARTED')),
  CONSTRAINT security_event_throttle_class_check
    CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL'))
);

GRANT INSERT (event_type, throttle_class, client_instance_id)
  ON security_event TO pos_app;
```

`db/migrations/0005_pin_throttle_bucket.sql`

```sql
-- Exactly two installation-wide buckets (FR-A5), seeded so the service only
-- ever updates a row and never races to create one. These are not restaurant
-- configuration (B-24): there are two by requirement.
CREATE TABLE pin_throttle_bucket (
  throttle_class       text PRIMARY KEY,
  consecutive_failures integer NOT NULL DEFAULT 0,
  blocked_until        timestamptz,

  CONSTRAINT pin_throttle_bucket_class_check
    CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL')),
  CONSTRAINT pin_throttle_bucket_failures_check
    CHECK (consecutive_failures >= 0)
);

INSERT INTO pin_throttle_bucket (throttle_class)
  VALUES ('LOGIN'), ('MANAGER_APPROVAL');

-- No INSERT and no DELETE: a bucket cannot be removed to clear a cooldown,
-- and its class cannot be renamed.
GRANT SELECT ON pin_throttle_bucket TO pos_app;
GRANT UPDATE (consecutive_failures, blocked_until)
  ON pin_throttle_bucket TO pos_app;
```

**Only if the lead keeps the settings table** (I recommend not), as
`0006_settings_version.sql`: the plan's table with `tax_rate_ppm >= 0` and
`service_charge_rate_ppm >= 0` and no ceiling; `minor_unit_precision >= 0` and no ceiling;
`business_address text` nullable with no default; a new
`version bigint GENERATED ALWAYS AS IDENTITY UNIQUE`; a new
`calculation_policy_version integer NOT NULL CHECK (calculation_policy_version >= 1)` with no
default; the append-only trigger; and `GRANT SELECT, INSERT ON settings_version TO pos_app`.
No row is seeded.

### Test cases for `apps/server/test/schema.test.ts`

Setup is `resetDatabase()`. Assertions on evidence tables read through the owner connection.
Of the plan's five cases, four survive in changed form; its `settings_version` case goes with
the table.

**Privileges**

1. The complete privilege set of `pos_app`, table-level and column-level, equals an expected
   map written in the test. Every table in schema `public` except `schema_migration` must
   appear in the map; one that does not fails the test. `pos_app` has no privilege on
   `schema_migration`.
2. `pos_app` owns no table and has no `CREATE` on schema `public`.
3. As `pos_app`: an insert into `audit_entry` succeeds; `UPDATE`, `DELETE` and `TRUNCATE` are
   each refused with *permission denied*; so is `SELECT`.
4. As `pos_app`: an insert into `audit_entry` that supplies `occurred_at` is refused, and one
   that supplies `id` is refused.
5. As `pos_app`: the same four refusals on `security_event`, and an insert succeeds.
6. As the **owner**: `UPDATE`, `DELETE` and `TRUNCATE` on `audit_entry` are each refused by the
   trigger, with the table empty and with a row in it.
7. As `pos_app`: `INSERT` and `DELETE` on `pin_throttle_bucket` are refused, an update of
   `throttle_class` is refused, and an update of `consecutive_failures` succeeds.
8. As `pos_app`: `DELETE` on `staff_user`, `actor_session` and `client_instance` is refused.

**Audit and security event**

9. `audit_entry` rejects a null `actor_id`.
10. `audit_entry` rejects an `approver_id` with `APPROVAL_FAILED` and with
    `APPROVAL_CANCELLED`, and accepts `SUCCESS` with and without one.
11. `audit_entry` rejects an outcome outside the three.
12. The column lists of `audit_entry` and `security_event` (name, data type, nullability) equal
    the lists written in the test.
13. `security_event` has no foreign key to `staff_user`.

**Types**

14. No column in schema `public` has type `real`, `double precision`, `numeric` or `money`
    (B-1). `before_amount` and `after_amount` are `bigint`, and a value above 2^53 reads back
    as the same string.

**Identity**

15. `staff_user` rejects a duplicate `pin_lookup`.
16. `staff_user` rejects `KITCHEN` as a role.
17. `staff_user` rejects a `pin_hash` that is not an Argon2id encoded hash.
18. `staff_user.credential_version` is 1 on a new row.
19. `actor_session` rejects an insert without `credential_version`.
20. `actor_session` rejects an unknown audience, a `BACK_OFFICE` row with no absolute expiry,
    and a duplicate `token_hash`.

**Throttle**

21. `pin_throttle_bucket` holds exactly `LOGIN` and `MANAGER_APPROVAL`.

### Rules for PHASE0-003c

1. The migrations above are the specification. The plan's Task 3 SQL is superseded and must
   not be copied.
2. A migration that creates a table states that table's grants in the same file. No
   `ALTER DEFAULT PRIVILEGES`. No grant on sequences.
3. No migration creates a role, sets a password or seeds a settings, staff or rate row.
4. No `DELETE` privilege is granted on any table in this task.
5. Not added in this task: `order_id`, `refusal_code`, the `REFUSED` outcome, an action
   vocabulary, a `classification` column, a CSRF or re-authentication column, a `detail`
   column, `client_instance_id` on `audit_entry`, and any table beyond the five.
6. The Handoff lists, for the later task files, the seven items under *Found in Tasks 4 to 10*
   in section 8, and says that tests reset with `resetDatabase()`.
7. AC-18 and AC-19 are not closed by this task. It builds the tables they will be proved on.

---

## For the owner

Nothing here blocks PHASE0-003. No change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is
asked for. One new ADR is recommended for commissioning (section 8), not written.

1. **An approval attempt refused by the cooldown.** FR-J3 audits "every manager-approval
   outcome" and also says throttle cooldowns are security telemetry "because they have no
   identified actor". A cashier who asks for an approval while `MANAGER_APPROVAL` is cooling
   down *is* an identified actor. Is that attempt an audit entry, a security event, or both?
   The plan writes neither. Needed before the approval primitive (plan Task 10).
2. **The counter after a cooldown.** FR-A5 says five consecutive failures block the class for
   five minutes. It does not say whether the count returns to zero when the five minutes end.
   As planned it stays at five, so the first wrong PIN afterwards blocks for another five
   minutes at once. Needed before the throttle (plan Task 6).
3. **Kitchen staff as records.** The architecture's StaffUser can hold a non-authenticating
   staff member; the schema recommended here cannot, on purpose, until this is answered. Does
   the back office keep records of kitchen staff? Needed before the Phase 1 users screen.
4. **A deactivated user's PIN.** The schema keeps every PIN unique across all staff, active or
   not, so a deactivated user's PIN cannot be given to someone else. That is the safe reading
   of FR-A4. If the owner wants such a PIN reusable, it is a rule to state. Needed before
   Phase 1.
5. **Still open, unchanged, and not pre-empted by this schema:** the permitted tax and
   service-charge range (PRD section 9, question 3, before Phase 2), and the receipt's business
   fields (question 1), which is one of the reasons the settings table is deferred.
6. **Still open from ARCH-004 and ARCH-005:** whether an approved void that the server then
   refuses writes a `REFUSED` entry, as a refund does. Before Phase 2.

DONE
