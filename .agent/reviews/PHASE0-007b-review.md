# PHASE0-007b review

## Verdict: findings

Reviewed `agent/phase0-007b` at `9335d57faa098da4b76689d3d481886362d2e43b` against `development` at `ed80773e5ebfffcf8c6f08ace5673a8cfeaeaa11`, including the Round 2 fixes. There is one P1 finding: the shared readline interface still allows a hidden PIN to be printed through its editing buffer. The full verification suite passes.

## Findings

### 1. P1 — A deleted hidden PIN can still be pasted into the visible username prompt

**Location:** `apps/server/scripts/create-manager.ts:56` and `apps/server/scripts/create-manager.ts:59`. Regression coverage: `apps/server/test/back-office-credential.test.ts:635`.

`historySize: 0` disables Up/Down input history, but the same readline interface also retains text removed with editing commands in its kill buffer. That buffer survives the transition from the hidden PIN questions to the visible username question. Ctrl+Y then restores and prints the removed PIN. Muting output while the PIN is entered does not protect this later visible state. Case 32 covers history navigation only, so it passes despite this remaining disclosure.

**Authority:** ADR-009 §7 and task rule 13 explicitly require the two secrets not to be echoed and the script to print nothing secret. The Round 2 ruling requires secret input not to become recoverable at a later visible question. This remains the secret-disclosure problem underlying the prior B-12 finding; the direct terminal-output rule is ADR-009 §7.

**Observed failing scenario:** I ran the unchanged script entry point in a real PTY using `node --import tsx --env-file=db/dev.env apps/server/scripts/create-manager.ts`. I entered the synthetic name `Review Probe`. At `PIN:`, I typed the synthetic PIN `654321`, pressed Ctrl+U to clear it, typed `654321` again, and pressed Enter. I confirmed the PIN with `654321` and Enter. Neither hidden entry echoed. At the visible `Username:` prompt, I pressed Ctrl+Y. The script immediately emitted `654321` in plaintext. I then aborted with Ctrl+C, before entering a username or either password, so `createManager` was never called. No source mutation was needed.

**Proposed fix:** Isolate secret editing state from visible questions, for example by using a fresh readline interface for each question and closing it before the next question. Keep history disabled and ensure neither input history nor deleted-text buffers can carry secrets across questions. Extend the prompt regression test with Ctrl+U at a PIN question followed by Ctrl+Y at `Username:`, assert that the PIN never reaches output, and repeat that sequence in a real terminal. Cover other supported delete/yank commands as appropriate to the chosen implementation.

## What I ran and what I did not

- I ran `npm run verify` myself. Typechecking passed; **51 test files and 2,910 tests passed**, including all 34 credential cases. This is one file and 34 tests above the task's development baseline of 50 files and 2,876 tests. The run includes the real PostgreSQL concurrency, grants, malformed-hash, PIN, throttle and session tests.
- Immediately before and after that green run, `git diff --stat` was empty and the branch and development hashes above were unchanged. The worktree was still clean after the terminal probes and before writing this report. No source or test file was edited.
- I reviewed the branch diff, task and Handoff, the cited PRD requirements and boundaries, accepted ADR-009, the cited architecture sections and credential consultation, and the inherited throttle protocol and clock correction. The only existing test edits are the two permitted table/grant additions. No client code changed.
- The first real-PTY run reproduced the Ctrl+U/Ctrl+Y disclosure described above. A second real-PTY run confirmed that `Name:` and `Username:` remain visible, that Up twice and Down at `Username:` recall no PIN, and that ordinary PIN and password entry does not echo. Deliberately different password confirmations produced `The two Password entries differ; nothing was written` and exit status 1. Both probes ended before the creation function could run; I did not query the database to count rows after them.
- Running the same Node entry point without a PTY produced `create-manager needs a terminal; refusing to read from a pipe` and exit status 1. I used the Node/tsx import entry point for these probes, not the npm package command.
- `git diff --check development...agent/phase0-007b` passed. `rg -n 'Date|console\.|now\(\)' apps/server/src/domain/back-office-credential.ts` returned no matches.
- I did not rerun the credential file three times, rerun the builder's mutations, apply migrations to the development database, or complete manager creation through a terminal. The Handoff and lead's successful creation run remain their evidence. I made no in-memory mutation in this review. Routes and client authentication are outside this task, so AC-35 remains proved here only at the domain level.

## Cleared

The prior erased-label finding is fixed: visible questions now give their labels to readline itself, and the real terminal retained them. The specific Up/Down disclosure is fixed by disabling history, but the broader requirement that secrets cannot reappear in visible output remains open under finding 1. The prior verifier-exception finding is fixed: the inner catch is removed, and passing case 33 exercises a malformed stored hash against the real verifier and database, checking rejection, unchanged throttle state and no event. Case 34 confirms an ordinary wrong password on another account still counts.

The migration matches the prescribed table, permanent username uniqueness, column grants and widened security-event checks. Normalization, Unicode code-point password lengths, active-manager eligibility, shared username/id account counting, cooldown expiry, and isolation from both PIN buckets match the task. Lock acquisition precedes the database-clock decision, all work under the lock uses its transaction client, and failure evidence follows commit. The concurrency tests exercise PostgreSQL lock waits and more attempts than the pool can serve simultaneously.

The shared Argon2 definition preserves the PIN parameters and existing PIN assertions. Credential database errors are replaced with fixed messages, and failure telemetry carries neither username nor staff identity and writes no audit entry. The exported creation function writes the manager and credential in one transaction, with passing rollback tests for a duplicate username and PIN. I found no additional actionable defect in those paths.
