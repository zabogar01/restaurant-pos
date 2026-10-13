# PHASE0-011b review

## Verdict

**clean** — no remaining findings. The round-1 error-schema typing finding is resolved. The full verification run passed.

Reviewed `agent/phase0-011b` at `e7b46590b1b16fa1aea1435fe9a90515ada42fc0` against `development` at `e52d0a411d9816632a3e9aff376d0eb2562a05a4` on 2026-10-13. This report supersedes the round-1 verdict.

## Findings

None.

The previous P2 in `packages/contracts/src/errors.ts` is fixed: each schema alternative preserves its individual code literal and corresponding details shape. I independently compiled both assignment of the parser result to `ErrorBody` and direct narrowing of the inferred parser result, without annotating that result as `ErrorBody`. All four detail-bearing codes expose `details.retryAfterSeconds`; an `INTERNAL` details access requires the expected compile-time error. This satisfies the task's Round 2 ruling 1 and ADR-010 decision 1's per-code details contract.

## What I ran and what I did not

- `npm run verify` passed: all configured typechecks succeeded, followed by **68 test files and 3,269 tests passed**. Vitest reported 53.59 seconds. This is two files and 17 tests above the task's stated baseline of 66 files and 3,252 tests. I did not rerun the development baseline.
- Before and after that green run, `git diff --stat` was empty, both branch commit IDs were unchanged, and the worktree was clean. The branch diff against development remained **20 files, 1,054 insertions and 38 deletions**, including the task and the previous review report. The reviewed implementation did not move during verification.
- `git diff --check development` passed. Source searches found no `Date.now`, `new Date(` or `performance.now` in `domain/session.ts`; the CSRF name appeared only through the imported constant and its normalized lookup in the server; timeout literals appeared only in `SESSION_POLICY`.
- An independent TypeScript probe used a virtual source file and the installed compiler against the actual contracts sources. It produced **zero diagnostics** for assignability, direct inferred-result narrowing across all four detail-bearing codes, and the expected rejection of details on `INTERNAL`. No file was created for this probe.
- `npm run test:unit -- apps/server/test/session-clock.test.ts` failed during setup with `connect EPERM 127.0.0.1:5433`; no tests executed in that attempt. I did not repeat it or attempt further standalone database runs. Both new test files did pass within the full verification run. The builder's Round 2 Handoff records three separate successful runs of each file, with 13 and three tests respectively; those repeated runs are builder evidence, not independently reproduced evidence.
- An additional standalone runtime schema probe could not execute: the tool rejected string-based code generation, and direct TypeScript module import was unsupported. I claim no independent runtime schema assertion count from those attempts. Runtime schema structure was inspected, and the repository suite above was run.
- I inspected the builder's recorded red proofs and the added compile-time regression coverage. I did not rerun mutations. No browser check was performed: this task changes server responses and contracts, and supplies no screen. I read the task's binding consult excerpts, the cited requirements and boundaries, the relevant ADR decisions and architecture sections, the cited merged handoffs, and the branch diff.

## Cleared

- The SQL remaining-time expression uses `clock_timestamp()` in the SELECT or UPDATE RETURNING that resolves the session. It rounds down and clamps to `0..idleSeconds`; the limit comes from `SESSION_POLICY`. No second clock query or JavaScript clock was added. The validity and idle predicates, absolute expiry and renewal identity checks are unchanged (task rules 1–2; ARCHITECTURE §14.4).
- I checked the shared clock helpers across fresh sign-in, aged reads, interactive activity, idle sessions and back-office renewal. Fresh sign-in and renewal return the full policy as the task explicitly requires. Reads use their own request's database resolution and remain non-interactive. An idle or refused session gains neither an actor nor a successful session view. Audience selection remains server-side, and the actor shape is unchanged (FR-A2, FR-A2b, FR-A2c, AC-28; task's lead ruling on the blocker).
- The new session-clock tests sign in through the actual routes and use the cookie-jar client before reading, extending or renewing a session. They exercise the production guard path. Existing audience, expiry, role, CSRF and renewal tests passed in the full suite. This is API evidence, not browser-screen evidence.
- The route table lists the ten current application API routes and excludes the approval test probe. The test observes registration through `onRoute`, checks membership in both directions, checks ACTIVE interactivity against each route's declaration, and checks non-ACTIVE entries are false. Generated HEAD twins are deliberately excluded (task rule 5 and lead rulings 2–3).
- Both session-view schemas retain the existing type names and require the new non-negative integer fields. The error schema retains strict envelopes and the existing fifteen codes. Its generic constructors preserve literal types; the details-key `satisfies` check and mutual-assignability assertion guard drift. The prior cast that lost discrimination is gone (task rule 4, Round 2 rulings 1–2; ADR-010 decision 1).
- Activity remains a bodyless 204. Release, logout and error responses are unchanged. The eight-hour absolute lifetime is not exposed on the wire. CSRF header normalization is retained. No migration, client source, audit behavior, product document or new error code was introduced. Existing test changes stay within the task's list and its explicit later rulings.

Only this review report was written. No source or test file was edited, and nothing was committed or pushed.
