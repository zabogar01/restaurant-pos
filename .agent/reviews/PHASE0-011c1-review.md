# PHASE0-011c1 review — Round 3

## Verdict

**findings** — the three Round 2 findings are resolved. One P2 policy gap remains in the handling of successful sign-ins that the core considers obsolete. It meets Round 3 ruling 2's explicit condition for escalation: the core's token and the current cookie can name different people. This requires the lead's decision because the implementation follows the earlier first-settling-sign-in rule.

Reviewed `agent/phase0-011c1` at `10105d3a6d08ded0aab4640a801ce1a705c4a65e`, including fix commit `898f84a`. Development was `3158f0a3a771be8cc0e794f0f53bf408dae6d4cd`; the branch comparison uses merge base `2dfc26d15efb6c42103f2cd95ffe65ec74cac315`. Earlier review reports remain in Git history.

## Findings

### 1. P2 — Discarding a successful sign-in does not discard its cookie change

**Location:** `packages/api-client/src/client.ts:287` and `:301`; the existing concurrent-sign-in case is `packages/api-client/test/generations.test.ts:142`. The server-side cookie effect is visible at `apps/server/src/http/session-guard.ts:228`.

Generation checks correctly prevent an older ordinary response from replacing a newer session, but the shared `installs` counter applies a similar rejection policy to a successful sign-in. That response has an external effect: the browser accepts its session cookie even when the core returns `session-gone` and keeps another actor's token. The Handoff's statement that no mismatching sequence was found overlooks this effect. The test's scripted responses have no cookie jar, so asserting that the first session remains held does not establish that it is still the session presented by the browser.

**Authority:** Round 3 lead ruling **2** explicitly requires escalation upon finding a sequence where the rule leaves the token and cookie naming different people. Copied ARCH-014 question 4, **rule 5**, explains the shared-cookie identity problem and requires retries to preserve the original actor. Round 2 ruling **1** supplies the first-settling-sign-in policy that conflicts here; this is a policy gap to resolve, not a request for the builder to disregard that ruling. B-13 motivates the identity control, but this review does not claim an audited action occurred as the wrong person.

**Concrete sequences and observations:**

1. An empty core sends sign-ins for A and B. B's successful response arrives first, updates the modeled cookie to B, and installs B in the core. A's successful response then updates the modeled cookie to A, but the core returns `session-gone` and continues holding B. The inline probe printed `B first: ok, core B, cookie B`, followed by `A later: session-gone, core B, cookie A`. This sequence needs no second tab.
2. For the recovery rule specifically, start sign-in B, recover A through `me`, then observe another tab's sign-in C through a second `me`. That actor change advances `installs`. When the pending sign-in B succeeds, its modeled cookie becomes B, but its result is discarded and the core retains C. The next activity request carries C's token with B's cookie. The simulated guard refuses it, the refresh observes B, and the core returns `session-gone` without retrying and clears its actor.

Both probes ran the unchanged transport with an injected fetch and a modeled cookie jar whose sign-in response delivery installs the corresponding cookie before resolving fetch. The server's actual `signIn` helper unconditionally sets that cookie on success. These are deterministic transport observations with modeled browser side effects, not a claim that I reproduced them in a live browser. The resulting mismatch and failed next operation are supported by the model and source; no authorization bypass is demonstrated.

**Proposed resolution:** Escalate the sequence under Round 3 ruling 2 and settle a policy for concurrent cookie-changing requests and discarded successful authentication responses. A possible direction is to prevent overlapping sign-ins and reconcile the session against the current cookie when an obsolete cookie-changing response still arrives. The chosen policy needs tests that model cookie updates independently of result adoption, covering both surfaces and the recovery sequence above. It must preserve the existing prohibition on automatically replaying an actor's command as someone else. The current actor-only assertion is insufficient evidence for that policy.

## What I ran and what I did not

- `npm run verify` passed: typecheck succeeded; **74 test files and 3,425 tests passed**. Vitest reported 64.34 seconds. The existing Vite config-loader warning appeared.
- `npm exec vitest run -- --project client packages/api-client/test` passed: **4 files and 60 tests**. This was one targeted run, not three independent runs of each file.
- Before and after the last green full run, `git diff --stat` was empty, `git status --short --branch` showed only the branch name, and HEAD and development retained the hashes above. The branch diff comprised 14 files, 2,279 insertions, and one deletion. The reviewed source tree was stable; this report was edited afterwards.
- I read the Round 3 rulings and Handoff, the Round 3 source/test diff, the complete current transport settlement path, the cited PRD identity/idle requirements and B-11 through B-13, and the server helper implementing successful sign-in. The unchanged branch material and cited architecture/ADR analysis from the earlier reviews still apply.
- I ran the two inline `node --import tsx --input-type=module -e ...` probes described above. They used synthetic credentials and in-memory response scheduling, with no source or test edits.
- I did not independently repeat the builder's recorded source-mutation red runs. Their outcomes are Handoff evidence. I did not run a browser or a live API reproduction, and I do not claim screen-level acceptance or integration with later development-branch design changes.
- Only this review report was written, following the explicit Round 3 scope instruction. The Handoff, task file, source, tests, and memory files were not edited. No commit or push was made.

## Cleared

**Round 2 finding 1 is resolved.** Back-office idle handling preserves the generation, token, and actor; clears the idle limit and deadline; and emits the idle event only when a held deadline is cleared. The new tests prove that repeated idle responses do not discard successful password renewal, and an earlier interactive 2xx cannot restart the countdown while idled. POS idle expiry still ends its session. This matches Round 3 ruling 1 and FR-A2b.

**Round 2 finding 2 is resolved for the specified recovery behavior.** Initial `me` recovery advances the generation without advancing `installs` or emitting an actor-change event. Older terminal refusals preserve the recovered actor, deadline, and token and emit no event, on both surfaces. A pending sign-in can install after recovery, and an older `me` cannot replace a later sign-in. These exact cases pass; the additional cookie-side-effect sequence is the remaining finding.

**Round 2 finding 3 is resolved.** Obsolete successful release/logout requests return `session-gone`, retain the newer actor, deadline, and token, and emit no event. Both terminal routes are covered, as is ordinary successful termination under their own generation. The existing `13f` test gained the required result assertion.

The earlier public-token fix remains sound at runtime and compile time across all five session-view routes. The full suite also retains the request-schema, response-schema, code-classification, timeout/health, monotonic-deadline, source-purity, and same-actor CSRF retry checks. No production client or screen is built in this slice.
