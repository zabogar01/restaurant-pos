---
id: PHASE0-012b
title: The browser acceptance tests B1 to B11 and the AC-18 scan, on the 012a harness
category: feature
touches: [identity, audit, boundaries]
depends_on: [PHASE0-012a]
owns: [e2e/**]
status: not-started
cycles: 0
---
# PHASE0-012b — The browser acceptance tests

**Written** 2026-10-17 by the lead, from the architect consult ARCH-015
(`.agent/reviews/ARCH-015-browser-harness.md`, by `architect15`, 2026-10-16) and the Handoff of PHASE0-012a
(`.agent/tasks/PHASE0-012a-browser-harness.md`, merged 2026-10-17 as PR #99). The consult supersedes plan Task 12.
**Do not copy anything from plan Task 12** (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3506-3750`):
its selectors, its seeder and three of its five assertions are wrong against what is built. This is the second of two
slices; the harness it stands on is built and merged. It touches identity, audit and the HTTP boundary, so the owner
looks before merge. The consult's binding sections are copied below **verbatim**, with their headings moved down one
level; the numbered "questions" they refer to are the consult's sections. Where a copied section describes 012a's
work (cases A1 to A6, the harness's construction), that work is done and is context only.

## Objective

Today the harness proves its own premises (A1 to A6) and nothing more. When this task is done, `e2e/tests/` holds the
browser half of Phase 0's acceptance, eleven cases B1 to B11 in five files by subject, run in Chromium and WebKit:
AC-19's PIN cooldown at the real pad, including after the client-instance cookie is cleared; AC-27's two sessions held
independently in one browser profile, and each surface refusing the other's session; AC-28's divergent idle
presentation (POS to POS-01, back office to M-6) with polling extending neither; M-6's served re-authentication, both
the same manager and another manager; and a POS tab that never silently becomes another person. Every test also runs
the AC-18 scan through the fixture: no PIN or password reaches a log line, an audit or security row, the console, a
URL, browser storage or a cookie, and each reaches only the request bodies of its own credential route. Each case has a
red proof, made in source, run, read and reverted.

## Required inputs

- **The consult's sections copied below** (questions 4, 5 and 9; *For the task file*: 012a's rules, which rules 5 to
  10 of bind this task, and the four PHASE0-012b subsections; *The Handoffs must carry forward*). They are the
  specification. Rows B1 to B11 and the AC-18 row of question 5's table are this task's cases.
- **The harness as merged** (read the code; do not rebuild it): `e2e/playwright.config.ts`,
  `e2e/support/fixtures.ts` (`test`, `expect`, `Person`, the auto fixture `world` with `world.people.cashier()`,
  `world.people.manager()` and `world.serverLog()`; `oneProfile` as `{ context, pos, office, console, requests }`;
  `twoProfiles` as `{ a: { context, page, console, requests }, b: … }`; `violationsOn(page)`; `signInAtPos(page,
  person)`; `signInAtBackOffice(page, person)`), `e2e/support/clock.ts` (`ageSession('POS' | 'BACK_OFFICE', person,
  seconds)`, a relative shift of exactly one row), `e2e/support/database.ts` (`ownerQuery`), `e2e/support/people.ts`
  (`makeHarnessPeople`: random, independent display name, six-digit PIN, username and password), and
  `e2e/tests/premises.spec.ts` as the worked example of every rule.
- **012a's Handoff**, *What 012b needs* (round 1) as amended by round 3's *What the next agent needs*, summarised
  here and binding: the helpers take the `Person`, not raw credentials, and fail with a fixed message; people are
  random and independent; accessible names verified in both engines are the POS digits by exact name (`'1'` … `'0'`),
  `Continue`, `Release`, and at the back office `Username`, `Password`, `Sign in`, `Log out`; after a POS sign-in the
  person's name shows as text (`<name> · Cashier`), unique on the floor screen; a click on that name after sign-in
  sends `activity` (the leading edge); the anti-CSRF header is `x-rpos-csrf`; `world.serverLog()` returns the server's
  log since the test began, at `trace`; Chromium and WebKit behaved the same on every premise. A second manager is a
  second `world.people.manager()` call.
- **What the clients expose**: `#root[data-session]` (`starting`, `signed-out`, `signed-in`; `idle` at the back
  office) and POS-01's `data-lock-state` (`resting`, `loading`, `error`, `throttled`, `invalidated`, `draft`,
  `unavailable`, `failed`). M-6's names come from 011d2: the dialog title `REAUTH_TITLE` in
  `apps/back-office/src/copy.ts` ("Your session timed out"), *Resumed* after a same-manager return, the confirmation
  button "Discard changes and log out" (`apps/back-office/src/Reauth.tsx`), the frame's `inert` attributes
  (`apps/back-office/src/OfficeApp.tsx`). Sources: the Handoffs of PHASE0-011c2 (*For 011d and Task 12*), 011d1
  (*For Task 12 (the harness)*) and 011d2 (*For the next agent*) in `.agent/tasks/`. There is no `data-testid`.
- **The server as merged**: the routes `POST /api/pos/auth/login`, `GET /api/pos/auth/me`,
  `POST /api/pos/auth/activity`, `POST /api/pos/auth/release`; `POST /api/back-office/auth/login`,
  `GET /api/back-office/auth/me`, `POST /api/back-office/auth/activity`, `POST /api/back-office/auth/logout`,
  `POST /api/back-office/auth/reauthenticate` (`apps/server/src/http/routes/`); `SESSION_POLICY` in
  `apps/server/src/domain/session.ts`; the cookies `rpos_pos_sid` on `/api/pos` and `rpos_bo_sid` on
  `/api/back-office` (`apps/server/src/http/session-guard.ts:40-41`); the POS's code mapping, `meaningOf` in
  `apps/pos/src/session/realSession.ts`.
- **Contract**: ADR-009 and ADR-010; `docs/ARCHITECTURE.md` §14.3-14.4; PRD FR-A2, FR-A2b, FR-A2c, FR-A5, AC-18,
  AC-19, AC-27, AC-28, AC-35; `docs/BOUNDARIES.md` B-7, B-11, B-12, B-13, B-14, B-24; `.agent/DECISIONS.md`, the
  2026-10-14 lines (the destroyed draft from M-6's other-manager path; one cookie-changing request per tab).
- **Library facts**: the consult's *What I verified* section. For anything else, ask:
  `.agent/bin/ask.sh librarian "<question>"`.

## From ARCH-015, question 4: time and state between tests (verbatim; binding)

### 4. Time and state between tests

Authority: FR-A2, FR-A2b, AC-28; ARCHITECTURE §14.4 ("PostgreSQL time… prevents the browser clock
from becoming an authority"); ARCH-014 §6; 011d2 *For Task 12's served check* and the lead's hand
check (the 60-second window swallowing the first click); the librarian on `page.clock`.

#### Ageing a session

`e2e/support/clock.ts` exports `ageSession(audience, person, seconds)`:

```sql
UPDATE actor_session
   SET last_interactive_at = last_interactive_at - make_interval(secs => $3::int)
 WHERE audience = $1 AND staff_user_id = $2 AND released_at IS NULL
```

over `ownerQuery` (the owner connection to `pos_e2e`, from the environment), asserting that
**exactly one row** changed. The shift is **relative**, not "now minus N" as the server tests'
helper and the lead's hand check set it: it models N seconds passing, so if anything in between
had moved `last_interactive_at` (a poll that wrongly counted as activity), the shift preserves
that move and the test sees it. An absolute setting would overwrite the very fault B8 looks for.
It moves only the idle clock; the eight-hour limit stays an API-level proof. The connection string never leaves the process; there is no `psql`
and nothing on a command line. `actor_session` is not append-only (it is updated on every
interactive request), so this is the same kind of write the server makes; `test/support/people.ts`
already has `ageSession` by id for the server tests.

#### Moving the client's clock with it

The client never decides a session has ended; at its deadline it reads `me` (ARCH-014 §6). So the
honest way to make a browser notice an aged session is to move **both** clocks by the same amount:
age the row by N seconds, then `page.clock.fastForward(N * 1000)`. The client's countdown reaches
its deadline, the deadline read goes to the server, and PostgreSQL gives the verdict. Nothing is
simulated on the client's side that a person waiting N seconds would not cause.

Rules for using the clock:

- `page.clock.install()` is called **before** the first `goto` of that page (the documentation's
  examples do; the client reads `performance.now()` at start).
- **No request may be in flight when the clock is advanced.** `@pos/api-client` arms a ten-second
  timeout per request (`client.ts:82`), and a fast-forward would fire it. Wait first for the state
  attribute that shows the last request settled.
- `fastForward`, not `runFor`: a countdown that ticks every second would otherwise fire N times.
- Visibility is not faked. The deadline read is the path; `visibilitychange` is left to unit
  tests.

#### The sixty-second activity window

The back office sends `activity` on the leading edge of a 60-second window, the POS on a
five-second one (`activity.ts:14` and `:13`). A test that needs a fresh `activity` after an earlier
input advances the page clock past the window (`fastForward(61_000)` at the back office), which is
exactly what a person waiting would do. Most tests will not need it: the deadline read above does
not depend on the window at all.

#### A clean installation for each test

The reset before every test is the answer. AC-19's cooldown, a password counter, a released
session and every security event vanish with the schema, and the next test starts from the
migrations' two empty buckets. Nothing is deleted and no cooldown is aged out to make room. The
alternatives and why they lose: **ageing the cooldown away** (the server tests' `ageOutPinCooldown`)
makes each test depend on what an earlier one left and on remembering to clean up; **ordering AC-19
last** breaks the first time a test is added after it; **a database per file** gives the same
isolation with more machinery.

## From ARCH-015, question 5: what closes in Task 12 (rows A1 to A6 are 012a's, done) (verbatim; binding)

### 5. What closes in Task 12

Authority: ARCH-014 §10; ARCH-012 §10; the criteria; 011a, 011d2 and ARCH-014 on what was deferred.
Case numbers are those of *For the task file*.

| Item | Closes in 012 by | Red proof (summary) | Or stays open until |
|---|---|---|---|
| NFR-1, one HTTPS origin, path-separated, in one run | A1: both shells load from `https://localhost:8543` in one context, `GET /api/health` 200 from each page, and no request in the run left that origin | Point the back office's API base at another port in a build: the origin assertion fails | Closed |
| The cookie under a certificate exception (ARCH-014 *not verified*) | A2: `rpos_cid` is in `context.cookies()` with `secure`, `httpOnly`, `sameSite: 'Strict'`, path `/`; the second API response carries no `Set-Cookie` for it (so it was resent); `window.isSecureContext` is true. In both engines | Set `sameSite: 'lax'` in `client-instance.ts`: fails | Closed for Chromium and WebKit; Safari by the owner's hand check |
| No `securitypolicyviolation` in either shell (011a) | A3: a listener added by `addInitScript` records every violation; zero after each shell loads and signs in | An inline `<style>` added to `apps/pos/index.html` before the build: one violation, fails | Closed |
| A bodiless `POST` accepted by Fastify (ARCH-014 *not verified*) | A4: after sign-in, a tap sends `POST /api/pos/auth/activity`; the request carries no `Content-Type`, the response is 204; the same for `release` and back-office `logout` | Make the core send `Content-Type: application/json` on a bodiless request: Fastify answers 400, fails | Closed |
| AC-1's first clause against the real server | A5: a cashier signs in at the real pad; `data-session="signed-in"` and the cashier's name in the actor chip | Start the server with a different `PIN_PEPPER` from the one the people were made with: sign-in fails | Closed; the rest of AC-1 is Phase 2 and later |
| NFR-5, "two visibly different applications" | A6: structurally, the POS shell has digit buttons and no text field, the back office has fields named "Username" and "Password" and no digit buttons, and the two pages load disjoint asset URLs; a screenshot of each signed-out shell to `test-results/` for the owner | Serve the POS bundle at `/back-office/` (swap the roots): fails | The visual judgement is the owner's, at the Phase 0 gate (*For the owner* 1) |
| AC-19 at the real pad, with a cleared `rpos_cid` | B1: five wrong PINs, each answered `INVALID_CREDENTIALS`, the fifth with `retryAfterSeconds`, then `data-lock-state="throttled"`; a correct PIN `THROTTLED`; five `PIN_FAILURE` and one `COOLDOWN_STARTED` in `security_event`, none in `audit_entry`. B2: as B1, then `clearCookies({ name: 'rpos_cid' })`; the next request is issued a different `rpos_cid` and the correct PIN is still `THROTTLED` | B2: skip the blocked branch when the request's client instance has no `PIN_FAILURE` row: fails | The `MANAGER_APPROVAL` class through a route and "a successful cashier login does not reset the manager-approval counter" through a route: Phase 2 (domain proof: `throttle.test.ts` case 8) |
| AC-27, one profile holding both sessions | B3: `oneProfile`; a manager signs in at the POS with the PIN and at the back office with the password; both `signed-in`; each reloads and stays `signed-in`; the cookies are `rpos_pos_sid` on `/api/pos` and `rpos_bo_sid` on `/api/back-office`. B4: release at the POS leaves the back office `signed-in` after a reload, and logout at the back office leaves a fresh POS sign-in untouched | Give the back-office cookie the POS name on path `/api` in `session-guard.ts`: the POS then sees a repeated name and signs out, fails | Closed for the browser |
| AC-27, refused by the other surface | B5: `oneProfile`, a **manager** (so role cannot be the reason) with only a POS session: the back office loads `signed-out` (BO-01); a page probe to `/api/back-office/auth/me` answers `UNAUTHENTICATED`. The converse: with only a back-office session, the POS loads `signed-out` and its probe answers `UNAUTHENTICATED` | Three layers defend this (the cookie's path, the guard reading only its own name, and `AND s.audience = $2` in `session.ts`), so no single change turns it red; that is a finding about the design, not a weakness of the test. The red proof removes all three together (POS cookie path `/api`, the back office reading `rpos_pos_sid`, the audience predicate dropped): the back office accepts the manager's POS session, fails | The second sentence (a manager still types a PIN at M-1): Phase 2, with the first gated command (route-level proof exists, 010b) |
| AC-28, divergent presentation | B6: POS aged 91 s, clock 91 s: the deadline read answers `SESSION_IDLE`; `data-lock-state="resting"`, `signed-out`. B7: back office aged 31 min, clock 31 min: `SESSION_IDLE`; `data-session="idle"`; the dialog "Your session timed out" is open and the frame is inert | B6: `SESSION_POLICY.POS.idleSeconds` to 900; B7: the back office to 3600; each fails | The limits themselves are API-level (009a, 011b), not browser matters |
| AC-28, "polling does not extend either" (client half) | B8: in B6 and B7, from the sign-in to the idle state, the page's request log shows the deadline read of `me` and **zero** `activity` requests; and a variant: shift the row by 60 s and the page clock past the client's deadline; the read finds the session active with about 30 s left; shift and fast-forward 31 s more; the next read finds it idle, so the first read extended nothing, and still no `activity` was sent | Call `sendActivity` from the countdown's tick (ARCH-014 §6's red proof): fails | Server half proved at the API (009a) |
| M-6's served path (011d2) | B9: from B7's state: a wrong password, then the right one; `signed-in`, the inert attributes gone, "Resumed" in the pane; the database shows the same session id with a new token. B10: the other-manager path with a second manager (011d2's hand check could not, with one manager), and the discard logout | B9: clear the back-office cookie on `IDLE` in `session-guard.ts`: re-authentication answers `UNAUTHENTICATED`, BO-01 appears, fails | AC-35's last sentence ("finds their unsaved work"): Phase 1, with the first real form (ARCH-014) |
| A tab never silently becomes another person (ARCH-014 finding 1, B-13) | B11: `oneProfile`, two POS tabs; cashier A signs in at tab 1, cashier B at tab 2; tab 1's next tap is refused (`CSRF_REFUSED`, then `me` names B); tab 1 goes to POS-01 (`signed-out`, with the lock state the 011c1 rule assigns, which the builder reads from `realSession.ts` and pins) and never shows B's name or acts as B | Remove the same-`staffUserId` comparison from the core's retry: tab 1 retries as B and stays signed in, fails | Closed. The two-tab case remains under ADR-010's accepted risk (DECISIONS 2026-10-14); this test proves only that the tab does not become someone else |
| AC-18's client side, a scan with a browser driving | Every test, by fixture: after the test, the server's log lines written during it, the `security_event` and `audit_entry` rows, every console message, every page URL visited, `localStorage`, `sessionStorage` and the values of all cookies contain none of that test's PINs, usernames-with-passwords or passwords in plain form; and each PIN or password appears in exactly one request body, its own sign-in | Add `request.log.info({ digits: pin })` to the POS login handler (`digits` is not a redacted key): fails | Closed for Phase 0's routes; each later phase's routes inherit the fixture |
| AC-32's POS half | — | — | Phase 1, when a user can be deactivated (ARCH-014) |
| AC-35's last sentence | — | — | Phase 1 (ARCH-014) |
| AC-19's "surviving restart" in a browser | Optional: stop and restart the harness's server between B1's fifth failure and the correct PIN | — | Already proved at the API (009b, "a rebuilt server still refusing"); not required |

Every red proof is made, run, read and reverted, and the Handoff records the failure message.

## From ARCH-015, question 9: anything else (verbatim; binding)

### 9. Anything else

- **B-7.** Kept: no `DELETE`, no `UPDATE` of `audit_entry` or `security_event`; reset by schema on a
  throwaway database, as PHASE0-003b ruled for tests. The task's grep criterion holds it.
- **B-11.** Kept by the listener: the browser speaks only `https:`. A relative URL in every probe.
- **B-12, and a new exposure.** Playwright's own artefacts can hold what a test typed. The digits
  of a PIN are the *names* of the buttons clicked, so even a trace of clicks spells the PIN; a
  password is the text of a `fill`. The librarian found no masking option. Hence `trace`, `video`
  and the HTML reporter off, screenshots only of signed-out shells before anything is typed, and
  the log capture held in a temporary directory removed at teardown. The values are throwaway
  fixtures in a throwaway database, but B-12 says "any log … in any form", and a habit formed on
  fixtures is the habit that later meets a real PIN. Server logging runs at `trace` during the run,
  so the scan covers more than production would log.
- **B-12, and a practice the harness ends.** For 011d2's hand check the owner gave the lead the
  manager's real credential in conversation (011d2 task file, *Acceptance criterion 5*). Once the
  harness exists, a served check never needs a real person's credential: it makes its own people.
  The lead should treat that as the rule from 012a on (*For the lead* 3).
- **B-13.** The harness's people are named persons created through the same functions as everyone
  else; no shared "test" account. B11 proves the client's half of the actor rule.
- **B-14.** Not touched: there is no approval route in Phase 0, and the served approval prompts
  verify nothing. The harness must not drive them as if they did.
- **B-24.** People only in test code; no seeder in `src`; the idle limits and cooldown come from
  the wire and the policy, never from a literal in a spec (the specs read `idleSeconds` from the
  sign-in response where they need it, or the exported `SESSION_POLICY`, never `90` or `1800`).
- **ADR-009.** A manager is always made with a back-office credential; the back office is never
  given a PIN; a cashier has no back-office credential, so a cashier at BO-01 can only be
  `INVALID_CREDENTIALS`.
- **ADR-010.** No `Access-Control-*`, no second origin, no HSTS: unaffected. The harness adds a
  second listening process on another port of the same host. Browsers share one `localhost` cookie
  jar across ports (ARCHITECTURE §16), but every Playwright context is a fresh profile, so the
  owner's browser never sees the harness's cookies and the harness never sees the owner's.
- **The one-cookie-changing-request rule** (DECISIONS 2026-10-14). No test may fire two
  cookie-changing requests from one tab at once; the UI already prevents it. B11 uses two tabs
  deliberately and asserts only the B-13 property, not a stronger guarantee the owner did not ask
  for.
- **Handlers never write an error body**: unaffected; the harness reads the envelope only.
- **The plan's `import.meta.url === \`file://${process.argv[1]}\``** is the bug `migrate.ts`
  already fixed for paths with a space; this checkout's path has one. Any script the harness adds
  uses `pathToFileURL(process.argv[1]).href`.

## From ARCH-015, For the task file: 012a's rules (5 to 10 bind 012b) and PHASE0-012b (verbatim; binding)

#### PHASE0-012a: rules

1. **Nothing reaches the development installation.** Database `POS_E2E_DB_NAME` (`pos_e2e`, added
   to `db/dev.env`), port 8543, advisory lock `hashtext('restaurant-pos:e2e')`. The environment
   builder refuses `pos`, `pos_test` and any database either URL names; one guard, shared with
   `serverTestEnv`, tested.
2. **No credential literal outside `db/dev.env`; nothing secret in `argv`.** The configuration
   reads `db/dev.env` with `util.parseEnv`; the server is spawned with an `env` object.
3. **The harness starts its own server**, from `globalSetup`, as `tsx apps/server/src/index.ts`
   with exactly the variables in question 3 and **no `--env-file`**, and stops it at teardown. No
   `webServer`, no `npm run dev`, never `reuseExistingServer`.
4. **A throwaway certificate per run** from `makeCert`; the readiness probe trusts exactly it
   (`ca`), never `rejectUnauthorized: false`; the browser uses `ignoreHTTPSErrors: true`. Nothing
   installs trust.
5. **Reset before every test by dropping and migrating the schema** over the owner connection, from
   an anchored path. No `DELETE`, no `TRUNCATE`, and no `UPDATE` of `audit_entry` or
   `security_event`, anywhere under `e2e/`.
6. **People through `createStaffUser` and `createBackOfficeCredential`** (`makePeople`), in test
   code only. Nothing under `apps/server/src` or `apps/server/scripts` is added or changed.
7. **Every request is made by the page.** No `page.request`, no `context.request`. Probes use
   `page.evaluate(() => fetch('/api/...'))` with a relative URL.
8. **Assertions on state and codes**: `#root[data-session]`, `data-lock-state`, accessible names and
   dialog titles from the Handoffs, and the envelope's `code`. Never copy (except a name the
   Handoffs list as a name), never a status alone, never `getByTestId`.
9. **Clocks**: age a session with `ageSession` (a relative shift, exactly one row), move the page with
   `page.clock.fastForward` by the same amount; `install()` before `goto`; never with a request in
   flight.
10. **No artefact can hold a credential**: `trace`, `video` off; reporter `list`; screenshots only
    of signed-out shells before typing; the server log in a temporary directory removed at
    teardown.
11. **`verify`**: `typecheck` gains `tsc -p e2e`; vitest's `client` project excludes `e2e/**`.
    `test:e2e` and `test:e2e:all` are new scripts; `verify` does not run them.
12. **`@playwright/test` pinned exactly** (1.64.1 unless the librarian reports a newer stable at
    dispatch). Browsers are installed on the host before dispatch, not by the builder.
13. Edit the root `scripts` by adding keys; do not paste a replacement block.

#### PHASE0-012b: rules

Rules 5 to 10 of 012a apply. In addition: every test reads limits from the response or
`SESSION_POLICY`, never a literal; B11 drives two tabs deliberately and asserts only that tab 1
never shows or acts as B; no test drives two cookie-changing requests in one tab at once.

#### PHASE0-012b: test cases

B1 to B11 as in question 5's table, in `e2e/tests/` files by subject: `throttle.spec.ts` (B1, B2),
`audience.spec.ts` (B3 to B5), `idle.spec.ts` (B6 to B8), `reauthenticate.spec.ts` (B9, B10),
`identity.spec.ts` (B11). The AC-18 scan runs in every test through the fixture, and one test in
each file asserts the scan found the credentials where they belong (in their own sign-in body), so
a scan that looks at nothing cannot pass.

#### PHASE0-012b: red proofs

As in question 5's table, plus: the AC-18 scan with the logging line added to the POS login
handler. Each made, run, read, reverted.

#### PHASE0-012b: acceptance beyond `npm run verify`

`npm run test:e2e:all` passes; the summary and every red proof's failure message are in the
Handoff; the 012a greps still empty.

## From ARCH-015, The Handoffs must carry forward (verbatim)

#### The Handoffs must carry forward

- For every later phase's browser tests: the fixtures, the reset, people through domain functions,
  both clocks, requests by the page, state and codes, no traces.
- For Phase 1: AC-32's POS half and AC-35's last sentence close in this harness, with the first
  deactivation and the first real form.
- For Phase 2: AC-27's second sentence, AC-19's approval class through a route, and M-1 driven for
  real; the approval stand-ins must not be driven as if they verified.

## Lead rulings

These rulings are addressed to the builder.

1. **Files.** `e2e/tests/throttle.spec.ts` (B1, B2), `audience.spec.ts` (B3 to B5), `idle.spec.ts` (B6 to B8),
   `reauthenticate.spec.ts` (B9, B10), `identity.spec.ts` (B11). You may extend `e2e/support/` (for example a response
   collector on `Seen`, or the scan as `e2e/support/scan.ts` called from the `world` fixture's teardown), provided
   `premises.spec.ts` still passes unchanged. **Nothing outside `e2e/` is committed.** Every red proof that edits
   `apps/`, `packages/` or `db/` is made, run, read and reverted; `git status` is clean outside `e2e/` before you commit.
2. **A real defect stops the task.** If a case fails against the merged source for a reason in the product, not in
   your test (as 012a's A3 found zod's start-up probe), do not weaken the test and do not fix the source: stop with
   `BLOCKED:`, the case, the failure message and what you believe the cause is. The lead rules.
3. **Envelope codes come from the page's own responses**: `page.waitForResponse`, or a response collector on the
   profile, reading the JSON body's `error.code` (and `error.details.retryAfterSeconds` where B1 needs it). Never a
   status alone; never a request the test made itself (rule 7). A probe with no UI is
   `page.evaluate(() => fetch('/api/…'))` with a relative URL.
4. **No literal limit.** The POS and back-office idle limits come from the sign-in response's `idleSeconds` or from
   `SESSION_POLICY` imported from `apps/server/src/domain/session.ts` (as test code, as `fixtures.ts` already imports
   `closePool`). The consult's numbers are illustrations for today's policy, not values to type: B6's "91 s" is
   `idleSeconds + 1`; B7's "31 min" is the back office's `idleSeconds + 60`; B8's variant ("shift by 60 s … about
   30 s left … 31 s more") is written as a shift that leaves a positive remainder of the POS limit, then a shift
   past it, each derived from `idleSeconds`. A spec that contains `90`, `1800` or `28800` as a limit is wrong.
5. **The AC-18 scan, made exact.** The consult says each PIN or password "appears in exactly one request body, its own
   sign-in". Three cases type a credential more than once on purpose (B1 and B2 the correct PIN while throttled, B9 the
   password again at M-6), so the rule is: **a test's PINs, usernames and passwords appear in no server log line, no
   `security_event` or `audit_entry` row, no console message, no URL of any request or page, no `localStorage` or
   `sessionStorage` value, and no cookie value; and they appear in request bodies only of their own credential route**
   (a PIN only in `POST /api/pos/auth/login`; a username or password only in `POST /api/back-office/auth/login` or
   `POST /api/back-office/auth/reauthenticate`), **in exactly as many bodies as the test submitted it.** The test
   counts its own submissions; the scan compares. A wrong credential the test typed on purpose (B1's wrong PINs, B9's
   wrong password) is scanned the same way. Storage is read from every page still open at the end of the test, before
   the fixture closes the contexts. If a username legitimately appears somewhere the rule forbids, stop with
   `BLOCKED:` rather than relaxing the rule for usernames.
6. **The scan must not leak what it scans for.** It reports a hit by place and credential kind ("a PIN in the server
   log", "a password in `security_event`"), never by value, and its failure message names no credential. The same
   holds for every assertion message in every case (round 3 of 012a): assert on state and codes.
7. **One positive check per file.** One test in each of the five files asserts that the scan found each credential it
   typed in its own sign-in body, so a scan that looks at nothing cannot pass. B11's file needs it as much as the others.
8. **B5's red proof changes three layers at once**, as the consult says (the POS cookie on path `/api`, the back office
   reading `rpos_pos_sid`, the audience predicate dropped from `session.ts`); it is one proof, reverted together.
9. **B11's lock state.** Read from `meaningOf` and the store in `apps/pos/src/session/realSession.ts` which
   `data-lock-state` the POS shows after a refused tap whose follow-up `me` names another person, and pin it in the test
   with a comment citing the line. If the client's behaviour is not one of the states listed under *Required inputs*,
   stop with `BLOCKED:`.
10. **B10, the other-manager path.** Two managers, two `world.people.manager()` calls. Assert the destroyed draft only
    as far as Phase 0 has a draft to destroy (011d2 says what is mounted under M-6); AC-35's last sentence is Phase 1's
    and out of scope.
11. **The approval stand-ins are not driven** (B-14). No test opens or answers a manager-approval prompt.
12. **Engines.** Every case runs in both projects. If one engine differs from the other, do not branch on the engine:
    report it in the Handoff with the output.
13. **Restart is optional and not wanted.** The consult's optional "surviving restart" row is already proved at the
    API (009b); do not restart the harness's server.
14. **Standing rules from 012a, unchanged.** The database is up (`restaurant-pos-db-1` on 5433): do not run
    `npm run db:up` or `docker compose`. The browsers are installed: do not run `npx playwright install`; a missing
    browser is `BLOCKED:`. Never print `db/dev.env`'s values, in a command, a log line, a test name or the Handoff. Do not
    start a development server. Commands that may stop at a permission prompt (`npm run build:clients`,
    `npm run test:e2e`, `npm run test:e2e:all`, `npx playwright test`): wait for the owner; do not reach for another
    command to get round a prompt.
15. **If the task proves too large**, do not ship part of it: stop with `BLOCKED:` and propose a cut (for example B9
    to B11 as a third slice). **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what
    you observed.

## Constraints

- B-7: no `DELETE`, `TRUNCATE`, or `UPDATE` of `audit_entry` or `security_event` anywhere under `e2e/`; the only
  writes are the fixture's schema reset and `ageSession`.
- B-12: no credential in any artefact or message: `trace`, `video` and `screenshot` stay off; reporter `list`; no
  screenshot after anything is typed; no credential in an assertion message, a test name, a log line or the Handoff.
- B-13: B11 asserts only that tab 1 never shows or acts as B, not a stronger guarantee (DECISIONS 2026-10-14).
- B-24: people only through the harness's factory; no literal limit or cooldown in a spec.
- ADR-010: `localhost` only; requests by the page; no `page.request`, `context.request`, `getByTestId`, `psql`,
  `webServer`, `reuseExistingServer`, `--env-file`.
- No test fires two cookie-changing requests in one tab at once.

## Tests expected to change

- **None.** All five spec files are new; `premises.spec.ts` and every vitest file stay as they are. A support change
  that makes an existing case change its assertions is a stop-and-raise.

## Acceptance criteria

1. `npm run verify` green, including `tsc -p e2e`; the counts against the baseline. **Baseline (lead, 2026-10-17):**
   `development` at `33eb910`, 93 test files and 3744 tests, green. This task adds no vitest test, so the counts should
   not move; say so if they do.
2. `npm run test:e2e:all` passes, A1 to A6 and B1 to B11 in both engines, summary pasted; then run again immediately
   and passing again. **Baseline:** 12 passed. Say how long a run takes.
3. Every red proof in question 5's B rows and the AC-18 scan's (the logging line in the POS login handler) made, run,
   read and reverted, each failure message pasted. A failure message that would print a credential is a defect in the
   test (ruling 6).
4. The 012a greps over `e2e/` (excluding `node_modules` and `test-results`) still empty:
   `page\.request|context\.request|getByTestId|DELETE|TRUNCATE|psql|--env-file|reuseExistingServer|trace: 'on|webServer`,
   and `devpassword|apppassword`; the three `db/dev.env` credentials checked by a script that prints only hit or no hit
   per variable name. Also empty: a grep of the five new specs for `\b(90|1800|28800)\b`.
5. After a run, no `rpos-e2e-*` temporary directory remains (`ls` shown).
6. Each of the five files has its positive scan test (ruling 7), named in the Handoff.
7. The Handoff carries forward the items under *The Handoffs must carry forward*, and what each case left for a later
   phase.

The lead, before merge: `npm run test:e2e:all` from the task's worktree, and the owner's look (identity, audit,
boundaries).

## Out of scope

- Any committed change outside `e2e/`; any change to `premises.spec.ts`'s assertions.
- AC-19's `MANAGER_APPROVAL` class through a route, AC-27's second sentence, M-1, AC-32's POS half, AC-35's last
  sentence (Phase 1 and 2, as question 5 says).
- The browser-clients ADR (ARCH-016, running beside this task), `docs/` of any kind, the plan's Definition of Done.
- A development server, the owner's database `pos`, the owner's manager.

## Handoff

*(The builder writes here: what you did, path by path; what you decided and on what evidence; each case and its red
proof's failure message; verify and the runs; what each engine did; found and not fixed; what the next agent needs.
End with `DONE` or `BLOCKED: <question>`.)*
