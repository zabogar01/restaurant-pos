# PHASE0-007b review

## Verdict: findings

Reviewed `agent/phase0-007b` at `f53fd86874bd63be1b94c7c44bc835efb18b1ca8` against `development` at `ed80773e5ebfffcf8c6f08ace5673a8cfeaeaa11`. There are three findings: one P1 and two P2s. The full verification suite passes, but it does not exercise the terminal prompting or a thrown password verification.

## Findings

### 1. P1 — Readline history reveals a hidden PIN at the username prompt

**Location:** `apps/server/scripts/create-manager.ts:47` and `apps/server/scripts/create-manager.ts:52`.

One readline interface serves both visible and secret questions with its default input history enabled. Muting its output hides the PIN while it is entered, but does not keep that PIN out of history. Once `ask('Username', false)` unmutes the output, pressing Up recalls and displays the PIN in plaintext.

**Authority:** ADR-009 §7 and task rule 13 require the secrets not to be echoed and the script to print nothing secret. This defeats the secret-handling protection required by B-12.

**Observed failing scenario:** In a real PTY, I entered the synthetic name `Review Probe`, then the synthetic PIN `123456` twice. Neither PIN entry echoed. At the username question, I pressed Up. The script emitted `\u001b[1G\u001b[0J123456\u001b[7G`, visibly displaying the PIN. I aborted with Ctrl+C before completing the prompts, so `createManager` was never called.

**Proposed fix:** Disable readline history for this prompt interface, for example with `historySize: 0`, and ensure secret input cannot be recalled in a later visible question. Add terminal-level coverage for the transition from the hidden PIN questions to the visible username question, including Up/Down history navigation. Testing `createManager(answers)` alone cannot detect this failure.

### 2. P2 — The visible question labels are erased immediately

**Location:** `apps/server/scripts/create-manager.ts:50`–`54`.

`ask` writes a label directly to stdout and then starts `rl.question('')`. For a visible question, readline redraws the line using that empty question and clears the label. The owner sees an unlabeled input line for both the name and username. The same helper happens to retain the secret labels because their redraw is muted, hiding the visible-state defect.

**Authority:** Task rule 13 requires the terminal workflow to collect the name, PIN, username and password; the task's explicit **Lead verification (2026-10-08)** section also identifies this defect and prescribes passing visible labels through `rl.question`. That fix is absent from the reviewed commit.

**Observed failing scenario:** Starting the script in a PTY emitted `Name: \u001b[1G\u001b[0J \u001b[1G`. After the two PIN entries, it emitted the same line-clearing sequence after `Username:`. The escape sequences erase each label before the operator enters a value.

**Proposed fix:** Give visible questions their label through `rl.question(label)` and retain a separate muted-output path for secret questions. Check the rendered terminal at every question rather than inferring prompting behavior from the exported creation function's tests.

### 3. P2 — A verifier exception is committed as an incorrect-password attempt

**Location:** `apps/server/src/domain/back-office-credential.ts:136`–`140`.

The inner catch converts every Argon2 verification exception into `matches = false`. The function then increments the account's failure count, commits, and writes `PASSWORD_FAILURE`. After five such errors it can lock the account out, even though verification never completed.

**Authority:** Task rule 6 explicitly says, “A thrown verification rolls back and propagates.” The Handoff's decision to count these exceptions as non-matches contradicts that rule. Its claim that the hash constraint makes malformed hashes unreachable is also incorrect: the constraint only checks the `$argon2id$` prefix.

**Concrete failing scenario:** A stored value of `$argon2id$broken` satisfies the migration's prefix check but makes the real Argon2 verifier reject. I ran the unchanged credential module, transpiled in memory, with the real Argon2 implementation and stubbed transaction/query/event adapters returning that row. It returned `{ outcome: 'FAILED', retryAfterSeconds: null }`; the adapter trace was `failure UPDATE`, `COMMIT`, `PASSWORD_FAILURE`, with no rollback. This is a control-flow reproduction, not a database corruption test.

**Proposed fix:** Let verifier exceptions escape the transaction callback so it rolls back. Preserve a fixed, secret-free outward error as required by rule 12. Add a test that forces a verifier exception and checks rejection, unchanged throttle state, and no security event; a normal wrong password must remain a counted failure.

## What I ran and what I did not

- I ran `npm run verify`: typechecking passed, and **51 test files / 2,907 tests passed**. This is one file and 31 tests above the task's stated development baseline. The run includes the credential, PIN, throttle, session, migration and privilege tests.
- Before and after that green run, `git diff --stat` was empty and the branch hashes above were unchanged. The tree was still clean after the probes, before this report was written. No source or test file was edited.
- I checked the branch diff, the task and Handoff, the cited PRD requirements and boundaries, ADR-009, the cited architecture sections, and the inherited throttle protocol and clock correction. The only existing test edits are the two permitted table/grant additions. Client code is unchanged.
- I attempted the package's interactive command, `npm run create-manager -w apps/server`. The sandbox rejected the tsx CLI's IPC listener with `EPERM` before the script ran. I then used `node --import tsx --env-file=db/dev.env apps/server/scripts/create-manager.ts` in a PTY to exercise the same entry point. Both terminal probes were aborted before any creation call.
- I independently confirmed that the real Argon2 library rejects the malformed encoded hash, then ran the in-memory control-flow probe described in finding 3. The query, transaction and event adapters were stubs; I did not change a stored hash or claim a real database rollback test. An initial attempt in the node REPL could not load the native binding or evaluate generated code; the successful probe ran through the shell's Node runtime.
- `rg -n 'Date|console\.|now\(\)' apps/server/src/domain/back-office-credential.ts` returned no matches.
- I did not repeat the credential file three times, rerun the builder's ten mutations, apply migrations to the development database, or complete a successful manager creation through the terminal. Those Handoff claims remain the builder's evidence. In particular, red proof 3 is documented as failing on the error-code assertion before reaching the count assertion; I did not independently re-prove that mutation. No routes or client authentication screens are included in this task, so AC-35 remains domain-level evidence only.

## Cleared

The migration matches the prescribed table, uniqueness, column grants and widened security-event checks. Username normalization and permanent reservation, Unicode code-point password lengths, active-manager eligibility, shared username/id account counting, cooldown expiry, and separation from both PIN buckets are implemented and covered by the passing suite. Lock acquisition precedes the database-clock decision; statements under the lock use the transaction client; normal failure evidence is written after commit. The existing concurrency tests exercise actual PostgreSQL lock waits and pool saturation.

The Argon2 parameters are shared without changing the PIN assertions. Credential creation sanitizes database errors, and the exported manager-creation function creates both rows in one transaction with rollback on the tested refusals. Failure telemetry carries neither username nor staff identity and writes no audit entry. The terminal history and error-path findings above limit the otherwise sound secret-handling and transaction coverage.
