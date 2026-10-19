---
id: PHASE0-013
title: The plain 404 for a path outside both bundle prefixes and /api carries Cache-Control no-store (ADR-011 rule 12)
category: quick
touches: []
depends_on: [PHASE0-012b]
owns: [apps/server/src/http/errors.ts, apps/server/test/server.test.ts, apps/server/test/bundles.test.ts]
status: complete
cycles: 0
---
# PHASE0-013 — The root's 404 is `no-store`

**Written** 2026-10-19 by the lead, from ADR-011 rule 12 and ARCH-016's Handoff (*The two 011a findings, decided*).
It is not one of the plan's twelve tasks: it is the one piece of ADR-011 that was stated ahead of the code, and the
Phase 0 gate waits on it. Nothing else changes.

## Objective

One thing becomes true: the plain-text 404 that the server's not-found handler writes for a path outside `/api` and
outside both bundle prefixes (`/`, `/elsewhere`, `/API/nope`, `/favicon.ico`, and `/pos/` when the bundles are
omitted) carries `Cache-Control: no-store`. Its status, content type and body (`Not Found`) stay exactly as they are.
After this, ADR-011's rule "no error and no miss outside `/api` is cacheable" holds without exception.

## Required inputs

- **The decision, ADR-011 rule 12** (`docs/decisions/ADR-011-browser-clients.md`, *#### 12. Headers*, accepted
  2026-10-19), last row of its table:

  | Response | `Cache-Control` |
  |---|---|
  | the 404 for a path outside both prefixes and `/api` | `no-store` (**decided here; not yet built**) |

  and the paragraph under it: PHASE0-011a found that the root's not-found handler, which predates the bundles, sets
  no `Cache-Control`; nothing leaks, but the rule is decided so that "no error and no miss outside `/api` is
  cacheable" is true without exception and a test can assert it for every response class. `docs/ARCHITECTURE.md`
  §3.1 (`:135`) already states the rule.
- **The code, at `development` `4967ade`** (`apps/server/src/http/errors.ts:130-136`):
  ```ts
  /** Under /api a miss is the envelope; elsewhere it is a plain 404. */
  export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
    if (isApiPath(request.url)) {
      return send(reply, 404, ErrorCode.NOT_FOUND);
    }
    return reply.code(404).type('text/plain').send('Not Found');
  }
  ```
  The plain branch sets no `Cache-Control`. Every other plain-text error outside `/api` goes through `sendPlain`
  (`errors.ts:96-102`), which sets `no-store`. ARCH-016 sized the change as one line in the plain branch; add the
  header there. Whether to route the branch through `sendPlain` instead is your call only if its body for a 404 is
  byte-for-byte `Not Found` — check `plainText` before choosing, and say in the Handoff which you did and why.
- **Tests that assert the old behavior or should assert the new one** (the lead read each):
  - `apps/server/test/server.test.ts:216-224`, case 31, *"%s stays a plain 404"*, over `/API/nope`, `/elsewhere`,
    `/%41PI/nope`, `/api%2Fnope`: line 222, `expect(res.headers['cache-control']).toBeUndefined();`, becomes
    `expect(res.headers['cache-control']).toBe('no-store');`. This is the one expected-to-change assertion.
  - `apps/server/test/server.test.ts:86-96`, case 16, the `/nope` half: asserts status, body and content type, and
    nothing about the header. Add `expect(elsewhere.headers['cache-control']).toBe('no-store');`.
  - `apps/server/test/bundles.test.ts:201-210`, case 8, *"GET %s is a plain-text 404"* over `/`, `/other`,
    `/favicon.ico`, `/posx`, `/pos-floor`, `/back-officex/`: add the same assertion. The file already has
    `expectPlain404` (`:59-65`), which asserts `no-store`; using it here is fine if it fits every URL in the list.
  - `apps/server/test/bundles.test.ts:446-457`, case 16, *"with bundles omitted GET /pos/ is a plain-text 404"*: those
    paths fall to the root handler, so they gain `no-store` too; assert it.
  No other test in `apps/server/test` or `e2e/` asserts the header on these responses (the lead's grep of
  `cache-control` and `'Not Found'`).

## Rules

- Touch only the three files in `owns`. Do not edit ADR-011 (accepted ADRs are never edited; its "not yet built"
  marker stays as history) or `docs/ARCHITECTURE.md` (it already states the rule).
- Write the test changes first and run them red against the unchanged handler; record the failing assertion and
  line in the Handoff. Then change the handler.
- Nothing about `/api` misses, bundle responses, or any other status changes. If a test outside the four above fails,
  stop and say so in the Handoff rather than adjusting it.
- Server tests need `npm run db:up` first and `openssl` on `PATH`.

## Acceptance criteria

1. Every plain 404 outside `/api` and both bundle prefixes carries `Cache-Control: no-store`, with status 404,
   `text/plain` and body `Not Found` unchanged; with the bundles omitted, the same holds for `/pos/` and
   `/back-office/` paths.
2. The four test sites above assert `no-store`; the red run before the handler change is recorded.
3. `npm run verify` green. The baseline at `4967ade` is 93 test files and 3744 tests; the count stays the same unless
   you add a test, and the Handoff says which.
4. `git diff --stat` shows only the three owned files.

The lead runs `npm run test:e2e:all` before merge, because the change is under `apps/server/src/http`.

## Commit and report

Commit on `agent/phase0-013` only, after verify is green, and never push. Conventional Commits, explaining why
(ADR-011 rule 12). Write the Handoff below in full prose, ending with `DONE` or `BLOCKED: <one question>`, then
report to the lead through Herdr as AGENTS.md says.

## Lead verify and review (2026-10-19)

At `db3f503`, in this worktree. `git diff --name-only development...HEAD` shows the task file and the three owned files
only; no test changed outside the four listed sites. Seven changed lines and no `touches` flag, so the lead reviewed it
as trivial: the header is added on the plain branch only, the `/api` branch and every other response are untouched, and
the choice not to route through `sendPlain` (it needs the configured origin, which `notFoundHandler` does not have) is
right. The red proof was repeated by the lead: the four test sites run against `development`'s `errors.ts` fail 12
assertions (113 tests in the two files, 101 passing), as the Handoff says. `npm run verify`: 93 files, 3744 tests,
green. `npm run test:e2e:all`: 58 passed (43.1 s). Every acceptance criterion holds. ADR-011's "not yet built" marker
stays as history (accepted ADRs are not edited); ARCHITECTURE §3.1 already states the rule. Complete.

## Handoff

**What I did.** The plain 404 for a path outside `/api` and both bundle prefixes now carries `Cache-Control: no-store`. The code change is one line in `notFoundHandler` (`apps/server/src/http/errors.ts`): `.header('cache-control', 'no-store')` added to the plain branch. Status, content type and body (`Not Found`) are unchanged. Four test sites now assert the header: `apps/server/test/server.test.ts` case 16 (the `/nope` half, new assertion) and case 31 (`toBeUndefined()` became `toBe('no-store')`, over `/API/nope`, `/elsewhere`, `/%41PI/nope`, `/api%2Fnope`); `apps/server/test/bundles.test.ts` case 8 (the six-URL plain-404 list) and case 16 (bundles omitted: `/pos/`, `/pos/floor`, `/pos`, `/back-office/`). I added assertions inline rather than using `expectPlain404` in case 8 and 16, because case 16 also asserts the absence of a CSP header, which the helper does not cover, and I wanted the edit minimal.

**What I decided.** I did not route the branch through `sendPlain`. `plainText(404, …)` does return `Not Found` byte-for-byte (`PLAIN_TEXT[404]`), but `sendPlain` needs the configured `origin` argument and `notFoundHandler(request, reply)` has no access to it; threading it through would change the handler's signature and its registration site for no behavioural gain. The one-line header is the smaller change.

**Red run before the handler change.** 12 assertions failed, all `expected undefined to be 'no-store'`: `bundles.test.ts:207` (case 8, six URLs), `bundles.test.ts:455` (case 16), `server.test.ts:96` (case 16), `server.test.ts:223` (case 31, four URLs). Then green after the handler change.

**Existing tests changed.** Only the four listed sites; case 31's one assertion was flipped from `toBeUndefined()` to `toBe('no-store')` as the task directed. No assertion was loosened and no test added or removed.

**Found, not fixed.** Nothing. `npm test -w apps/server` does not exist (no `test` script in that workspace); I ran `npx vitest run <files>` for the red run instead.

**`npm run verify` output.** typecheck clean; `Test Files 93 passed (93)`, `Tests 3744 passed (3744)`. Same counts as the baseline. No formatter run. I did not run `npm run test:e2e:all`; the task leaves that to the lead.

**Next agent.** Nothing missing. ADR-011's "not yet built" marker stays as history, per the task.

DONE
