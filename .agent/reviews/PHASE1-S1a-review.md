# PHASE1-S1a review

## 1. Verdict

**findings** — one medium-severity finding in the required concurrency evidence. I found no production-code defect in the reviewed changes.

Reviewed `agent/phase1-s1a` at `8c2fa0e35d3a6269f8f434a5ca8f9e02f44092cf` against `development` at `3749fb7720938721fd7755e4ab3ce3e395aaa466`, using the task, the complete ARCH-019 consult, the cited requirements and boundaries, the relevant accepted ADR rules, and the recorded Q10, Q11 and Q13 rulings.

## 2. Findings

### F1 — P2: The concurrency cases do not establish overlapping database transactions

**Location:** `apps/server/test/tables.test.ts:259` and `apps/server/test/tables.test.ts:271`.

Both cases launch two HTTP calls with `Promise.all` and check their final responses. Neither establishes two distinct database connections, holds either transaction at a barrier, or observes overlapping database work. Repeating this four times does not establish that overlap.

**Authority:** PHASE1-S1a acceptance criterion 6 explicitly requires “two connections, a barrier” for concurrent creates and concurrent reactivations. ARCH-019's S1a acceptance criterion 6 carries the same requirement. This is a missing acceptance proof, not evidence that the current unique index violates B-20.

**Concrete failing scenario:** Request or connection scheduling can let the first transaction commit before the second reaches its insert or update. Both tests still pass: the second operation encounters the already committed active label. Their assertions cannot distinguish that sequential execution from a transaction waiting on an uncommitted competing unique key. The reported red mutation that removes uniqueness would also fail sequentially, so it does not establish concurrency.

**Proposed fix:** Add a controlled database barrier for both cases and establish that two distinct application connections have reached the competing operations before releasing it. Then assert one success, one bare `DUPLICATE`, and the final row counts and active state. Release the barrier in cleanup even when an assertion fails. Keep the HTTP guard and response checks, and rerun the index-removal red proof with the barrier in place.

## 3. What I ran and what I did not

**Observed:** `npm run verify` exited successfully. Typechecking passed; Vitest reported **97 files passed and 3,790 tests passed**, with a duration of 70.68 seconds. This includes the 22 table-route cases, schema privilege checks, contract tests, and existing route-registration and access checks. `git diff --check development...HEAD` also passed.

The tree was stable across that verification run. Before and after it, both branch references were unchanged, `git status --porcelain` was empty, and the hashes were identical:

- `git diff development...HEAD`, SHA-256: `1b46c5d17f984b2bc17ecb0bf53e6fe30b5037a432a05d997486258632a00bef`.
- `git diff HEAD`, SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty).

I attempted a focused Vitest run with an in-memory transform replacing the two `Promise.all` expressions with sequential awaits. Its setup failed with `connect EPERM 127.0.0.1:5433` before the transform was applied or any test ran. This is **not** a successful mutation experiment. F1 rests on the inspected test structure and the explicit acceptance requirement; the sequential scheduling scenario is an inference.

I did not independently repeat the builder's other red mutations. I did not run `npm run test:e2e:all`; the task's Lead verify section records 58 passes at `f6cf34a`, which is attributed evidence rather than my own run. I did not run `db:migrate` against the development database. No browser screen is introduced here, and this review makes no claim to prove BO-05 or AC-35's retained-form behavior.

## 4. Cleared

- **Configuration and migration:** The new table starts empty, has the specified columns and partial unique index, and grants only `SELECT`, `INSERT` and updates of `label` and `is_active`. The executed schema tests cover forbidden deletion and identity/timestamp updates. This satisfies the slice's B-24 and privilege requirements.
- **Access and interactivity:** All five routes use the existing production API registration and guard. They require an active back-office manager session; the four commands require anti-CSRF protection. The list is non-interactive and the commands are interactive, consistent with FR-A2b, FR-A2c, AC-28 and ADR-011 rules 1 and 4.
- **Shared behavior across states:** I specifically checked the shared label and `is_active` handling across active and inactive records. An inactive record can share or adopt an active record's label; reactivation into that label is refused; renaming it away permits reactivation. Case-only renames remain real changes. These states are covered by executed HTTP tests.
- **Transactions and locks:** Each command uses one transaction. Rename, deactivate and reactivate take the locking read before deciding, including on no-op paths. The executed lock tests cover all three no-op branches, and the `xmin` assertions establish that no-op commands do not update the row. Refusals preserve table rows, consistent with B-20 and ARCHITECTURE §8.
- **Contracts and error handling:** Strict request schemas share the label rule, use UUIDs in POST bodies and leave `parseBody` unchanged. Commands return the committed record; the list includes active and inactive records in stable order. Only SQLSTATE `23505` on the named active-label index becomes a bare 409 `DUPLICATE`; other errors become fixed-message faults without a copied database cause. The marker log scan and compile-time prohibition on `DUPLICATE` details passed. The other-constraint fault branch was inspected, not independently fault-injected.
- **Scope:** Client changes are the prescribed API mappings and general-failure cases. No table audit entry is written, as Q11 requires. The open-order deactivation refusal is correctly deferred by Q13 to Phase 2; its absence is not a finding against this slice.
