# PHASE0-007b review

## Verdict: clean

Reviewed `agent/phase0-007b` at `50e2eb7dd3ec095d250c809c4d2f5ef2b285e984` against `development` at `ed80773e5ebfffcf8c6f08ace5673a8cfeaeaa11`, including the Round 3 fix. There are no remaining actionable findings. The prior hidden-input disclosure is fixed in the reviewed code, the new regression test passes, and the same editing sequence no longer reveals the PIN through the actual terminal entry point.

## Findings

None.

## What I ran and what I did not

### Observed

- I ran `npm run verify` myself and read its output. Typechecking passed; **51 test files and 2,911 tests passed**. This is one file and 35 tests above the task's development baseline of 50 files and 2,876 tests. The run includes all 35 credential cases and the existing PIN, throttle, session, migration and privilege tests.
- Before and after that green run, `git diff --stat` was empty, and both `HEAD` and `development` retained the hashes above. `git status --short --branch` showed a clean `agent/phase0-007b` worktree. The tree remained clean after the terminal probes and before writing this report; no source or test file was changed.
- I reviewed the complete branch diff, assigned task and all three rounds of its Handoff, the prior review, the cited PRD requirements and boundaries, accepted ADR-009, the cited architecture sections and consultation, and the inherited PIN throttle rules and clock correction. No client code changed. The only existing test edits are the two explicitly permitted table-list and privilege-map additions.
- I ran the unchanged entry point in a real PTY with `node --import tsx --env-file=db/dev.env apps/server/scripts/create-manager.ts`. Both `Name:` and `Username:` remained visible. At `PIN:`, I typed a synthetic PIN, pressed Ctrl+U, retyped it and pressed Enter, then confirmed it. At `Username:`, Ctrl+Y, Up twice and Down emitted no text and revealed no PIN. At `Password:`, I typed a synthetic password, pressed Ctrl+U and retyped it. At confirmation I also sent Ctrl+Y and Up/Down, then deliberately entered a different password. Neither secret appeared in any captured output. The script printed `The two Password entries differ; nothing was written` and exited 1.
- The same Node/tsx entry point without a PTY printed `create-manager needs a terminal; refusing to read from a pipe` and exited 1.
- I also attempted `npm run create-manager -w apps/server` without a PTY. The sandbox refused the tsx launcher's IPC socket with `listen EPERM` before the application entry point ran. That attempt does not prove the application's non-TTY guard; the direct Node/tsx run above does.
- `git diff --check development...agent/phase0-007b` passed. `rg -n 'Date|console\.|now\(\)' apps/server/src/domain/back-office-credential.ts` returned no matches.

### Limits and inference

The terminal mismatch occurs before `createManager` is called, so the reviewed control flow shows that this probe cannot create either row. I did not query table counts after it. Successful creation and transaction rollback were exercised by the full suite through the exported function; the successful real-terminal creation in the task remains the lead's evidence.

I did not repeat the credential file three times independently, rerun the builder's mutations, apply migrations to the development database, or complete manager creation through a terminal. I made no in-memory mutation. The Handoff records the three consecutive credential runs and the red proofs, including the Round 3 shared-interface mutation. I reviewed that evidence without claiming to have reproduced those runs. The full suite exercised the real migrations through its test database harness.

There is no client screen or design artifact in this change. Routes, client authentication, password resets and their credential-version changes are explicitly deferred. AC-35 is covered here at the domain level only; its route and client requirements are not closed by this review.

## Cleared

**Prompt state and the earlier findings.** `ask` creates and closes a fresh readline interface for every question, with history disabled. This removes the shared history, line and kill-ring state that previously carried a hidden PIN into the visible username question. I specifically traced the shared output wrapper and its `muted` value across visible entry, hidden entry, confirmation and mismatch; each question closes its interface before the next one starts. Passing cases 32 and 35 cover returned answers and output, and the real-PTY probe above independently covers the prior disclosure sequence. Visible labels still go through `rl.question(label)`. These satisfy task rule 13, the Round 2 and Round 3 rulings, and ADR-009 §7's requirement that secrets are not echoed. The malformed-hash correction remains intact: case 33 rejects with a fixed message, leaves the throttle unchanged and writes no event; case 34 confirms another account's ordinary wrong password still counts (task rules 6 and 12).

**Credential and identity rules.** The migration matches the prescribed table, permanent username uniqueness, column grants and widened security-event checks. Username normalization rejects non-ASCII substitutions, password lengths count Unicode code points, and password values are not trimmed or case-folded. Verification requires an active manager, and username and staff-id lookup use the same account row. Hash and credential version are read together. The shared Argon2 definition preserves the PIN parameters, and the existing PIN assertions are unchanged (FR-A3, B-11, ADR-009 §§1–3, task rules 1–7).

**Throttle and evidence.** Lock acquisition precedes the separate database-clock decision; every statement under the lock uses that transaction's client. Blocked attempts do not verify, extend the cooldown or write evidence. Expired cooldowns restart counting correctly; successful verification resets only its account. The real PostgreSQL tests exercise queued row locks, attempts exceeding the pool size, and cooldown changes and expiry during waits. Password attempts remain isolated from other accounts and both PIN classes (FR-A5b, AC-19, the domain portion of AC-35, ADR-009 §4). Failure evidence is written after commit; case 24 confirms an evidence foreign-key failure does not undo the strike. Credential errors are replaced with fixed messages, and telemetry includes neither username nor staff identity and writes no audit entry (B-12, B-13, task rules 10–12).

**Manager creation.** The exported function creates both rows in one transaction through the supplied client. Tests prove rollback for a duplicate username or PIN and permit a second manager. The entry point reads secrets from the terminal, asks twice, rejects mismatches and non-TTY input, and holds no seed credentials (ADR-009 §7, B-24, task rule 13).
