# PHASE1-S8c2 review

## Verdict

**findings** — one P2 finding. The cooldown starts too late when its response is held behind a departure decision or a session gate.

Reviewed `agent/phase1-s8c2` at `26f19a7a6a56abfcf5466a361a96fdc1aa9f2ccd` against `development` at `599f724e9d00926649abdf8e434824298bdb7768`, using PHASE1-S8c2's task, the cited predecessor and server Handoffs, DESIGN-023's amended Handoff and Frost artifact, the cited requirements and boundaries, and ADR-009 and ADR-011.

## Findings

### F1 — P2: Anchor the account cooldown when the response arrives, before holding its presentation

**Location:** `apps/back-office/src/staff/model.ts:732`, with the response hold at `model.ts:629` and the deadline calculation at `model.ts:424`.

`answered()` holds an answer whenever a departure decision or session gate prevents presentation. The cooldown is not recorded there. It starts later, inside `currentPasswordRefused()`, when `present()` finally consumes that answer. `startCooldown()` then adds the original `retryAfterSeconds` to the current monotonic time. Time spent holding the answer is therefore added to the account's wait.

**Authority:** PHASE1-S8c2 lead ruling 8 and acceptance criterion 6 require the server's remaining wait to count down locally to zero, enabling Current password and Save at zero, and to survive same-manager recovery. ADR-011 rule 7 identifies `retryAfterSeconds` as the server-computed remaining duration. Holding presentation must not restart that duration.

**Concrete failing scenario:** Submit an own-password change that receives `INVALID_CREDENTIALS` with `retryAfterSeconds: 300`. Before the answer arrives, press Cancel so the departure decision opens. Let the answer arrive and leave the decision open for 301 seconds. Press Stay. The model starts a fresh 300-second cooldown even though the reported server wait has elapsed. Both own forms now remain locally blocked for another five minutes. A shorter pause adds that pause to the wait; a response held behind M-6 or BO-01 follows the same code path.

**Observed reproduction:** I loaded the production model and its dependencies by transpiling them in memory, with a controlled monotonic clock, inert timer scheduling and a deferred configuration response. No source or test file was edited. The response arrived at time zero behind the departure decision. The observed state was `decision: true, cooldown: null`. At time 301,000 ms, Stay produced `cooldown.remaining: 300` and `isCooling: true`. A subsequent valid submission left the request count at one. The disabled controls follow directly from `Staff.tsx:579`, `Staff.tsx:584` and `Staff.tsx:741`; I did not separately reproduce this sequence in a browser.

**Proposed fix:** Record the account cooldown deadline once when the response arrives, before the presentation gate. Keep announcements and focus held, but calculate the remaining wait from that original deadline when presenting the result. Do not restart it during `flush()`. Add regression cases for a cooldown answer arriving behind a departure decision and a session gate, including recovery after its deadline. Keep the different-manager discard behavior.

The shared value inspected here was the cooldown deadline: ordinary, immediately presented answers exercise it correctly, while held answers use the same duration at a different starting time. Existing cooldown recovery tests start the cooldown before entering the gate, so they do not cover this ordering.

## What I ran and what I did not

- `npm run verify` passed: all seven typecheck targets completed, **176 test files and 6,223 tests passed**. The reported duration was 144.36 seconds.
- `git diff --stat` was empty before and after that green run. HEAD and development remained at the hashes above. The tree was still clean immediately before writing this report.
- The separate client run passed **133 files and 5,221 tests**. An additional client run using `--pool=threads --maxWorkers=2` passed the same counts; it was unnecessary in retrospect because the preceding run's completion output had not yet been collected.
- `npm run test:e2e:all` built both clients successfully, then failed before browser tests ran: `connect EPERM 127.0.0.1:5433`. A separate TCP probe also returned `EPERM`, and Docker inspection was denied access to its socket. I therefore have no independent Chromium or WebKit pass count. The builder's reported 150 passes remain builder evidence.
- I ran the in-memory production-model reproduction described in F1. Earlier attempts to load that probe through the JavaScript REPL were rejected by its code-generation/import restrictions; the successful probe ran through `node -e`. I did not run a production-code mutation or independently repeat the builder's mutation proofs.
- I did not perform headed Chrome/Firefox password-manager checks, physical-device checks, or assistive-technology checks. The task explicitly carries the password-manager check to the lead and owner.

## Cleared

- The six move variants derive their fields from both the opening classification and the destination. A promotion always supplies a new password, asks for a username only when none exists, and preserves a former manager's stored username. The move opens without a destination and cannot submit until one is chosen.
- Row actions distinguish own accounts, active managers, cashiers, kitchen staff and inactive people. The actionable warnings use the subject's classification, including a former manager's cashier classification; both own-change warnings state FR-B3's exception correctly.
- New credential inputs remain native and uncontrolled. Current password is checked in code points and sent without trimming. The response-time clearing introduced by S8c1 round 2 is retained, including when presentation is held. No new credential logging, storage or echo path was found in the diff.
- Resets and own changes use their respective routes and exact request shapes. Own success does not replace the session cookie or anti-CSRF token. Focus targets name the required row action explicitly, including Change my password after an own-PIN success.
- Refusals, duplicate-field placement and unknown-outcome handling preserve the distinction between an authoritative response and a reread. An unknown move whose reread shows a changed classification, status or username blocks further submission without claiming that this save succeeded. Unknown reset and own-password copy state what the list cannot establish.
- The D2, D3 and promotion browser tests drive real page controls and requests, rather than manufacturing the destination state. D3 checks a subsequent successful command without another sign-in. The scan map adds exactly the authorized routes, including the current password carried by `own-pin`. These are source-review conclusions; this review's browser run did not execute them.

### Reviewer Handoff

The lead should resolve F1 and obtain a browser-suite run in an environment that can reach the test database. This report is the only authored file changed. No source, tests, task Handoff or agent memory was edited, and nothing was committed or pushed.

DONE
