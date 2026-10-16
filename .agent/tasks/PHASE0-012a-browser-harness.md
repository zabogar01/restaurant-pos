---
id: PHASE0-012a
title: The browser harness and its premises, on a database, port and server of its own
category: feature
touches: [identity, audit, boundaries]
depends_on: [PHASE0-011d2]
owns: [e2e/**, apps/server/test/**, vitest.config.ts, package.json, package-lock.json, db/dev.env, packages/contracts/**, apps/pos/src/main.tsx, apps/back-office/src/main.tsx, apps/pos/test/**, apps/back-office/test/**]
status: active
cycles: 3
---
# PHASE0-012a — The browser harness and its premises

**Written** 2026-10-16 by the lead, from the architect consult ARCH-015
(`.agent/reviews/ARCH-015-browser-harness.md`, by `architect15`, 2026-10-16), which supersedes plan
Task 12. **Do not copy anything from plan Task 12** (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3506-3750`):
the consult found its seeder, its configuration, its selectors and three of its five assertions
wrong against what is built, and its code must not be used even as a starting point. This is the
first of two slices; 012b (the acceptance tests B1 to B11 and the AC-18 scan) follows on top of it.
It touches identity, audit and the HTTP boundary, so the owner looks before merge. The consult's
binding sections are copied below **verbatim**, with their headings moved down one level; the
numbered "questions" they refer to are the consult's sections. Where a copied section mentions
012b or cases B1 to B11, that is later work and not this task's.

## Objective

Today no automated test drives a real browser. When this task is done, an `e2e` workspace holds a
Playwright harness that owns its whole world: its own database `pos_e2e`, its own port 8543, its own
advisory lock, a throwaway certificate per run, and a server it starts itself from `globalSetup`
with an environment built in code and no `--env-file`, so that nothing it does can reach the
development database `pos` or a development server on 8443. Before every test the schema of
`pos_e2e` is dropped and migrated (never a `DELETE`), and the test's people are made through the
domain functions in test code. Helpers age a session in the database and move the page's clock by
the same amount. Requests are made only by the page; assertions are on state attributes, accessible
names and envelope codes; no artefact can hold a credential. Six tests (A1 to A6) prove in Chromium
and WebKit that the harness tests the real thing: one origin, the `Secure` cookie stored and
resent under a certificate exception, no content-security violation, a bodiless `POST` accepted,
a real PIN sign-in, and two different applications. `npm run test:e2e` and `npm run test:e2e:all`
run it; `npm run verify` only type-checks it.

## Required inputs

- **The consult's sections copied below** (questions 2, 3, 4, 5, 6 and 9, *For the task file* for
  012a, and *The Handoffs must carry forward*). They are the specification. Rows and cases B1 to B11
  in question 5 are 012b's and are copied only so that the fixtures you build can carry them.
- **What the clients expose** (the harness drives only these): the POS digits `1` to `9` and `0`,
  "Delete last digit", "Continue", "Try again", "Release"; `#root[data-session]` (`starting`,
  `signed-out`, `signed-in`; `idle` at the back office) and POS-01's `data-lock-state` (`resting`,
  `loading`, `error`, `throttled`, `invalidated`, `draft`, `unavailable`, `failed`). The back office:
  fields "Username" and "Password", buttons "Sign in" (pending "Signing in…"), "Log out", "Try again".
  Sources: the Handoffs of PHASE0-011c2 (*For 011d and Task 12*), 011d1 (*For Task 12 (the
  harness)*) and 011d2 (*For the next agent*) in `.agent/tasks/`. There is no `data-testid`.
- **Server and test support as merged**: `apps/server/src/index.ts`, `config.ts`
  (`POS_LISTEN_PORT`, `POS_TLS_KEY_PATH`, `POS_TLS_CERT_PATH`, `POS_LOG_LEVEL`), `http/origin.ts`,
  `http/client-instance.ts`, `http/bundles.ts` (`defaultBundleRoots`, `CONTENT_SECURITY_POLICY`);
  `apps/server/scripts/make-cert.ts` (`makeCert({ dir })`) and `scripts/provision.ts`
  (`provision(...)`); `apps/server/test/support/env.ts` (`serverTestEnv`), `database.ts`
  (`ownerClient`, `ownerQuery`, `resetDatabase`), `people.ts` (`makePeople`), `global-setup.ts`
  (the server tests' advisory lock), and `apps/server/test/server-test-env.test.ts`;
  `apps/server/src/db/migrate.ts:57-64` (the anchored migrations path, and the
  `pathToFileURL(process.argv[1])` fix for a path with a space).
- **Build and config**: the root `package.json` (`workspaces` already lists `e2e`; `build:clients`,
  `typecheck`, `verify`), `vitest.config.ts`, `.gitignore`, `db/dev.env` (read it in code; never
  print its values).
- **Contract**: ADR-009 and ADR-010; `docs/ARCHITECTURE.md` §3.1 and §14.3-14.4; PRD NFR-1, NFR-5,
  AC-1; `docs/BOUNDARIES.md` B-7, B-11, B-12, B-13, B-24.
- **Library facts** the consult took from the librarian are in its *What I verified* section and
  in question 2. For anything else, ask: `.agent/bin/ask.sh librarian "<question>"`.
- **The lead's host check, 2026-10-16** (not a substitute for case A2): with `@playwright/test`
  1.64.1, headless Chromium 156.0.8078.4 and WebKit 27.2 each stored a cookie set as `Path=/; Secure;
  HttpOnly; SameSite=Strict` by a plain Node HTTPS server on `127.0.0.1:8543` with a throwaway
  self-signed certificate, under `ignoreHTTPSErrors: true`, reported it as `secure`, `httpOnly`,
  `sameSite: 'Strict'`, resent it on the next navigation, and reported `isSecureContext` true.

## From ARCH-015, question 2: the harness itself (verbatim; binding)

### 2. The harness itself

Authority: ARCHITECTURE §3.1 (one origin, no installed trust), §14.3, §14.4; DECISIONS 2026-10-08
(the kit never installs trust); ADR-010 rule 3; ARCH-010 §2 (the three tiers); ARCH-012 *The
two-client harness*; the librarian.

#### Tool, version and browsers

- **Playwright Test, `@playwright/test` exactly `1.64.1`** (exact, no caret; `npm` records it in
  the lockfile). Node ≥ 22 already exceeds its floor.
- **Chromium (Playwright's bundled build) is required**: it is the engine of the owner's Chrome.
  **WebKit is a second project**, run by the lead at acceptance and at the Phase 0 gate. Playwright
  documents it as the closest to Safari, not as Safari; it is evidence about the engine, and the
  owner's hand check stays the evidence about Safari (*For the owner* 1). No Firefox: nobody uses
  it here. Not `channel: 'chrome'`: the installed Chrome drifts under the pin, and a red proof must
  mean the same thing next week.

#### Where it lives

In the `e2e/` workspace the root already lists: `e2e/package.json` (`@pos/e2e`, private, type
module), `e2e/tsconfig.json`, `e2e/playwright.config.ts`, `e2e/support/*.ts`, `e2e/tests/*.spec.ts`.
It imports the server's domain functions and test support **as test code**: `makePeople` from
`apps/server/test/support/people.ts`, `ownerQuery` and `ownerClient` from `database.ts`. Nothing
under `apps/server/src` or `apps/server/scripts` is added for the harness. `resetDatabase()` cannot
be reused as it is, because it migrates `'db/migrations'` relative to the working directory, and
Playwright's is `e2e/`; the harness's reset passes a path anchored to its own file, as
`migrate.ts:64` does.

#### How it meets the certificate

Three choices were open. The recommendation is the second.

1. **The developer's certificate** in `~/.config/restaurant-pos/tls/`. Rejected: the run would
   depend on `npm run cert` having been run on this machine, would read a directory outside the
   tree from a sandbox that may not see it, and a fresh worktree could not run the harness.
2. **A throwaway pair per run, and `ignoreHTTPSErrors: true` in the browser.** `globalSetup` calls
   the exported `makeCert({ dir })` (`scripts/make-cert.ts`) on a new temporary directory, starts
   the server with `POS_TLS_KEY_PATH` and `POS_TLS_CERT_PATH` pointing at it (paths, not secrets;
   `config.ts:40-53`), and probes `/api/health` with `node:https` passing that certificate as `ca`,
   exactly as tier 2 does (`loopback.test.ts` case 4). It never sets `rejectUnauthorized: false`.
   The directory is removed at teardown. `openssl` on `PATH` is already a requirement of `verify`.
3. **Trusting the leaf in the browser**: Chromium's `--ignore-certificate-errors-spki-list`, or
   the system keychain. Rejected. The keychain is installing trust, which ARCHITECTURE §3.1 and the
   owner's 2026-10-08 reading rule out for the kit. The Chromium flag reportedly works only with a
   persistent user-data directory, and a persistent context is a single context, which destroys the
   two-actor shape ARCH-012 asked for. WebKit has no equivalent.

**What `ignoreHTTPSErrors` means for what the test proves.** The browser proceeds past a
certificate error on an `https:` origin. That is precisely the owner's own condition: the kit
never installs trust, so the owner clicks through the warning once per profile (DECISIONS
2026-10-08), and the owner's check of 2026-10-13 showed Chrome and Safari then storing and
resending `rpos_cid` as `Secure; HttpOnly; SameSite=Strict`. Trusting the certificate would test a
condition the owner is not in. So the harness, under `ignoreHTTPSErrors`, proves that **the cookies
the whole design rests on are stored and resent in the state the MVP is used in**. It proves
nothing about the certificate itself: that the server speaks TLS with that certificate and refuses
plain HTTP is tier 2's proof, and stays there. Because no document confirms the cookie behaviour,
012a's first test asserts it directly in both engines (case A2), and the rest of the harness is
not trusted until it has passed.

#### `baseURL`, origin, and who makes a request

- `use.baseURL = 'https://localhost:8543'`. Never `127.0.0.1`: the Host check refuses it, as it
  should (`origin.ts:47-54`).
- **Every request is made by the page**: through the UI, or for a probe that has no UI, through
  `page.evaluate(() => fetch(...))` with a relative URL, so that `Origin`, `Sec-Fetch-Site`, the
  cookies and the anti-CSRF token are the browser's own. **`page.request` and `context.request` are
  not used at all**: whether they send `Origin` is undocumented, and any token they carried would be
  one the test supplied, which is the thing being tested. A grep in the task's criteria holds this.
- `bypassCSP` stays `false` (its default), so the policy is enforced as served.

#### The two shapes

Two fixtures, as ARCH-012 asked:

- **`oneProfile`**: one `browser.newContext()` with two pages, `pos` and `office`. One cookie jar,
  so `rpos_cid` is shared and each surface's cookie is scoped by path. This is a manager with both
  applications open in two tabs.
- **`twoProfiles`**: two contexts, `a` and `b`, each with its own jar. Two people on two browsers.

Each test opens its contexts and closes them before the next test's reset. A context never
survives a test.

#### Configuration

`workers: 1` and `fullyParallel: false` (one server, one database); `retries: 0` (a flaky test
here is a finding, not noise); `trace: 'off'`, `video: 'off'`, `screenshot: 'off'` (B-12, question
9); `reporter: 'list'` and never `'html'`; `outputDir` under `e2e/test-results/` (already ignored);
`timeout` left at the default. Projects `chromium` and `webkit`; `npm run test:e2e` runs
`chromium`, and `test:e2e:all` both.

## From ARCH-015, question 3: the server, the database and the people (verbatim; binding)

### 3. The server, the database and the people

Authority: B-7; B-12; B-24; ADR-009 §7; ADR-010; ARCHITECTURE §14.4; PHASE0-003b items 1, 5 and 6;
PHASE0-004 rule 3 (the pepper lives in `db/dev.env`); `test/support/env.ts`, `global-setup.ts`.

#### A port and a database of its own

- **Port 8543**, a constant in the configuration (a port is not a secret). The development server
  keeps 8443. A port that is busy fails the run with the server's own start-up error; nothing
  reuses whatever is listening.
- **Database `pos_e2e`**, named by a new `POS_E2E_DB_NAME=pos_e2e` line in `db/dev.env`, beside
  `POS_TEST_DB_NAME`. It is neither `pos` (so the development throttle and the owner's manager are
  untouchable) nor `pos_test` (so the browser run never waits on, or is waited on by, every
  builder's `verify`).

#### The environment, built in code

`e2e/support/env.ts` exports `e2eEnv()`, the twin of `serverTestEnv()`: `db/dev.env` parsed with
`util.parseEnv`, overridden by the shell, with `DATABASE_URL` and `MIGRATION_DATABASE_URL`
retargeted to `POS_E2E_DB_NAME`, and refusing to run when that name is not a plain identifier or
equals `pos`, `pos_test` or the database either URL names. The "never the development database"
guard should exist once: I recommend the builder generalise `serverTestEnv`'s guard into one
exported function both call, with `server-test-env.test.ts` extended to the new name, rather than
copying it.

`playwright.config.ts` calls `e2eEnv()` at load and assigns the result onto `process.env`, so the
runner, `globalSetup` and every worker see the same values (the librarian: workers inherit the
runner's environment and what `globalSetup` adds). **No credential literal appears in any file but
`db/dev.env`**, which holds them on purpose under its warning (PHASE0-003b item 5, PHASE0-004 rule
3), and **nothing secret is ever an argument**: the server is spawned with an `env` object, which
is not part of `argv`.

#### Starting and stopping the server

`globalSetup` (`e2e/support/global-setup.ts`), in this order, returning a teardown function:

1. **Lock.** Open an owner connection to `POS_DB_NAME` and take
   `pg_try_advisory_lock(hashtext('restaurant-pos:e2e'))`, printing a waiting line and then
   blocking if it is held, exactly as the server tests do with their own key. The connection stays
   open until teardown. This serialises browser runs across worktrees (one port, one database), and
   it is a different key from the server tests', so a browser run and a `verify` never wait on each
   other.
2. **Provision.** `provision({ ownerUrl, appPassword, testDatabase: POS_E2E_DB_NAME })` from
   `scripts/provision.ts`, unchanged: it already takes the database name as a parameter.
3. **Reset once**, so the server starts on a migrated schema.
4. **Certificate.** `makeCert({ dir: mkdtemp(...) })`.
5. **Server.** `spawn` of the `tsx` binary from `node_modules/.bin` with the argument array
   `['apps/server/src/index.ts']`, `cwd` the repository root, and `env` set to exactly:
   `PATH`, `HOME`, `DATABASE_URL` (as `pos_app`, on `pos_e2e`), `PIN_PEPPER`,
   `POS_LISTEN_PORT=8543`, `POS_TLS_KEY_PATH`, `POS_TLS_CERT_PATH`, `POS_LOG_LEVEL=trace`. **Not**
   `npm run dev` or `npm start`: both add `--env-file=../../db/dev.env`, under which a variable the
   harness forgot would be silently filled with the development value. **Not** `MIGRATION_DATABASE_URL`
   either: the server never needs the owner connection (`pool.ts:21-22`), so it is not given it.
   `stdout` is appended to `server.log` in the temporary directory; its path is put on
   `process.env.E2E_SERVER_LOG` for the workers.
6. **Ready.** Poll `GET /api/health` over `node:https` with the certificate as `ca` until 200 or a
   timeout; on timeout, print the server's last lines and fail. Health creates no client instance
   (`health.ts`), so polling writes nothing.

Teardown sends `SIGTERM` (the server's own shutdown closes Fastify and then the pool,
`index.ts:46-62`), waits for the exit with a timeout and then `SIGKILL`, removes the temporary
directory, and ends the lock connection. The server is started once per run, not per test: it
holds no state outside PostgreSQL, so a per-test reset of the schema does not need a restart.

#### People, with no `DELETE` anywhere

An auto fixture, test-scoped, runs before every test:

1. **Reset**: over the owner connection to `pos_e2e`, `DROP SCHEMA public CASCADE; CREATE SCHEMA
   public; GRANT USAGE ON SCHEMA public TO PUBLIC;` and then the real migrations, from an anchored
   path. This is `resetDatabase()` as the server tests have used it since PHASE0-003b, which ruled
   "tests reset with this and never with `DELETE`". It is not an update or delete path into the
   audit log: no statement touches a row; the throwaway database's schema is replaced whole, and
   the next schema has an empty, trigger-protected `audit_entry` again. The migrations restore the
   two throttle buckets and every grant.
2. **People**: `makePeople(base)` from `test/support/people.ts`, which calls `createStaffUser` and,
   for a manager, `createBackOfficeCredential`, through the application pool as `pos_app` in the
   worker process. A test asks for what it needs: `cashier()`, `manager()` (with a username and
   password), and a second manager where M-6's other-manager path needs one. The `Person` object
   carries the PIN, username and password the test types, and the scan of question 5 looks for.

The fixture's teardown closes the test's contexts. A worker-scoped fixture calls `closePool()`
once, at the end.

Cost: eight migrations and two or three Argon2id hashes per test, well under two seconds, against
fifteen or so tests. Cheaper alternatives exist (a template database cloned per test, which needs
every connection to the template closed; or ordering tests so the throttle test runs last) and
neither is worth the coupling at this size.

#### Coexisting with the server tests

Different database (`pos_e2e` against `pos_test`), different advisory-lock key, same container.
`provision` is idempotent and each run creates only its own database, so the two never race on a
`CREATE DATABASE` for the same name. The server tests are not changed by any of this, except
optionally the shared guard above.

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

## From ARCH-015, question 5: what closes in Task 12 (rows B1 to B11 are 012b's) (verbatim; binding)

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

## From ARCH-015, question 6: npm run verify and who can run it (verbatim; binding)

### 6. `npm run verify` and who can run it

Authority: DECISIONS 2026-09-29 (workers commit only after verify is green); ARCH-014 §2 (`verify`
needs no build step); the task brief (reviewers' sandboxes cannot reach `127.0.0.1:5433`; the
011d2 builder had no browser).

**The browser run does not join `verify`.** `verify` is what every builder and the lead run on
every task, and what "green" means for a commit. A browser run needs downloaded browser binaries,
a database, a free port, a fresh client build and about a minute; it fails for reasons unrelated
to most tasks (a busy port, a missing browser), and reviewers cannot run it at all. Folding it in
would make `verify` either flaky or unrunnable for most agents, and an unrunnable check gets
skipped.

What changes:

- `verify` gains `tsc -p e2e` inside `typecheck`, so every agent type-checks the harness.
- The root vitest configuration's `client` project adds `'e2e/**'` to its `exclude`. Today it
  would collect `e2e/tests/*.spec.ts` (vitest's default include matches `.spec.ts`) and fail on
  Playwright's `test` outside its runner. This must land in 012a, with the first spec.
- New root scripts: `"test:e2e": "npm run build:clients && npm test -w e2e -- --project=chromium"`
  and `"test:e2e:all": "npm run build:clients && npm test -w e2e"`. Building first means the run
  never tests a stale `dist/`.

Who runs it:

- **The PHASE0-012a and 012b builders**, if their sandbox can launch a browser and bind the port.
  The lead establishes that before dispatch (*For the lead* 1). If it cannot, the task is the
  lead's to run, and the builder's red proofs become the lead's to make, which is a poor loop.
- **The lead, before merging any task that touches** `apps/pos`, `apps/back-office`,
  `packages/api-client`, `packages/contracts`, `apps/server/src/http`, `apps/server/src/domain`
  (session, throttle, credential, pin) or `db/migrations`, and at the Phase 0 gate with
  `test:e2e:all`. The task file's acceptance names the run; the Handoff pastes its summary.
- **A reviewer** cannot run it. What a reviewer can check without running it: the specs and
  support code read against this report's rules; `tsc -p e2e` (in `verify`); the greps in
  *For the task file* (no `page.request`, no `getByTestId`, no `DELETE`, no `psql`, no credential
  literal outside `db/dev.env`, no `--env-file` in the harness's spawn, `trace` off); and the
  Handoff's run output and red-proof messages. A review is of the harness's reasoning and its
  evidence, not a re-run.

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

## From ARCH-015, For the task file: the split and PHASE0-012a (verbatim; binding)

#### The split

PHASE0-012a (the harness and its premises), then PHASE0-012b (the acceptance tests). 012b depends
on 012a.

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

#### PHASE0-012a: interface

- `e2e/support/env.ts`: `e2eEnv(): Record<string, string>`.
- `e2e/support/global-setup.ts`: default export; sets `process.env.E2E_SERVER_LOG`; returns the
  teardown.
- `e2e/support/database.ts`: `resetE2eDatabase()`; re-exports `ownerQuery`.
- `e2e/support/clock.ts`: `ageSession(audience, person, seconds)`.
- `e2e/support/fixtures.ts`: `test` extended with an auto fixture (reset, people factory, the
  collectors of rule 10 and the AC-18 scan) and the `oneProfile` and `twoProfiles` fixtures;
  helpers `signInAtPos(page, pin)` (digit buttons, then "Continue") and
  `signInAtBackOffice(page, username, password)` (fields "Username", "Password", button "Sign in").
- `e2e/tests/premises.spec.ts`: cases A1 to A6.

#### PHASE0-012a: test cases

- **A1. One origin.** `oneProfile`: `/pos/` and `/back-office/` load; each page's
  `fetch('/api/health')` is 200; every request the pages made went to `https://localhost:8543`.
- **A2. The cookie under a certificate exception**, in Chromium and WebKit: after the first API
  request, `rpos_cid` has `secure: true`, `httpOnly: true`, `sameSite: 'Strict'`, path `/`; the next
  API response carries no `Set-Cookie` for it; `window.isSecureContext` is true.
- **A3. No policy violation**: zero `securitypolicyviolation` events after each shell loads and
  after a sign-in at each.
- **A4. A bodiless `POST`**: the POS `activity`, `release` and the back office's `logout` carry no
  `Content-Type` and answer 204.
- **A5. AC-1's first clause**: a cashier signs in at the real pad: `data-session="signed-in"`, the
  cashier's name shown.
- **A6. Two applications**: the structural assertions of question 5; one screenshot per signed-out
  shell into `test-results/`.

#### PHASE0-012a: red proofs

A2: `sameSite: 'lax'` in `client-instance.ts`. A3: an inline `<style>` in `apps/pos/index.html`.
A4: the core sends `Content-Type: application/json` on a bodiless request (Fastify answers 400).
A5: the server started with a different `PIN_PEPPER` from the people's. A6: the two bundle roots
swapped in `defaultBundleRoots`. A1: the back office's requests aimed at another port. The
environment guard: `POS_E2E_DB_NAME=pos` makes the run refuse before connecting (a unit test of the
guard, under vitest, not Playwright). Each made, run, read, reverted.

#### PHASE0-012a: acceptance beyond `npm run verify`

1. `npm run test:e2e:all` passes, its summary pasted; then run again immediately, to show the
   reset leaves nothing behind.
2. Run while `npm run dev -w apps/server` serves on 8443 against `pos`: both pass, and `pos`'s
   `pin_throttle_bucket`, `security_event` and `actor_session` are unchanged (counts before and
   after, pasted).
3. Greps over `e2e/`, each empty: `page.request|context.request`, `getByTestId`,
   `DELETE|TRUNCATE`, `psql`, `--env-file`, `reuseExistingServer`, `trace: 'on`, the strings
   `devpassword`, `apppassword` and the pepper's value.
4. `ls` of the temporary directory after the run: gone.
5. The Handoff lists what 012b needs: the fixtures, the helpers, and anything the premises showed
   to differ between the engines.

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

1. **Files.** Those under *PHASE0-012a: interface* above, plus `e2e/package.json` (`@pos/e2e`,
   `"private": true`, `"type": "module"`), `e2e/tsconfig.json` and `e2e/playwright.config.ts`. Outside
   `e2e/`: one line in `db/dev.env` (`POS_E2E_DB_NAME=pos_e2e`, beside `POS_TEST_DB_NAME`, matching
   that file's style); the shared "never the development database" guard in
   `apps/server/test/support/env.ts`, used by both `serverTestEnv` and `e2eEnv`, with
   `apps/server/test/server-test-env.test.ts` extended to the new name; the vitest `client` project's
   `exclude` gains `'e2e/**'`; the root `typecheck` gains `tsc -p e2e` (no `--noEmit` is needed if the
   tsconfig sets `noEmit`); the root scripts gain `test:e2e` and `test:e2e:all` as question 6 says,
   **by adding keys**, never by pasting a block. Nothing under `apps/server/src`, `apps/server/scripts`,
   `apps/pos/src`, `apps/back-office/src` or `packages/` changes, except temporarily for a red proof.
2. **Version.** `@playwright/test` exactly `1.64.1` (the lead checked on 2026-10-16 that it is the
   latest stable). The lead has already installed its Chromium (`chromium-1248`, with the headless
   shell) and WebKit (`webkit-2370`) on this machine. **Do not run `npx playwright install`.** If the
   runner reports a missing browser, stop with `BLOCKED:`.
3. **The reset.** `resetDatabase()` migrates `'db/migrations'` relative to the working directory, so
   the harness cannot call it as it is. Either give it an optional anchored path or add a sibling
   that takes one; the server tests' behaviour and call sites stay exactly as they are.
4. **The loader question first.** Before anything else under `e2e/`, write the smallest spec that
   imports `makePeople` from `apps/server/test/support/people.ts` and creates one person in
   `pos_e2e`. If Playwright's loader cannot resolve the server's `.js` specifiers to `.ts`, stop with
   `BLOCKED:` and what you saw. Do not add a loader, a build step or a path alias to get round it.
5. **Engines.** Cases A1 to A6 run in both projects (`chromium`, `webkit`). If one engine behaves
   differently from the other on any premise, do not paper over it with an engine-specific branch:
   report it in the Handoff, with the output.
6. **The database is already up** (`restaurant-pos-db-1` on 5433, shared by every worktree). Do not
   run `npm run db:up` or `docker compose`. `provision` creates `pos_e2e` on the first run.
7. **Never print `db/dev.env`'s values**, in a command, a log line, a test name or the Handoff. Read
   it in code. If you need to know what it holds, list its variable names only.
8. **Commands that may ask for approval.** This run is interactive and the owner watches it. Adding
   the dependency (`npm install -D -w e2e @playwright/test@1.64.1 --save-exact`, which updates
   `package-lock.json`), `npm run build:clients`, `npm run test:e2e`, `npm run test:e2e:all` and
   `npx playwright test` may stop at a permission prompt. Wait for it to be answered; do not reach
   for another command to get round a prompt.
9. **Red proofs** are those under *PHASE0-012a: red proofs*, each made, run, read and reverted, with
   the failure message pasted in the Handoff. A1's red proof (the back office aimed at another port)
   and A6's (the bundle roots swapped) are made in source and reverted; nothing of them is committed.
   The environment guard's red proof is a vitest unit test that stays.
10. **Not yours** (the lead runs them after the build): the consult's acceptance item 2 (a run while
    `npm run dev -w apps/server` serves `pos` on 8443, with `pos`'s counts compared before and after).
    Do not start a development server.
11. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
    **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
    observed. Do not work around a rule.

## Constraints

- B-7: no `DELETE`, `TRUNCATE`, or `UPDATE` of `audit_entry` or `security_event` anywhere under
  `e2e/`; the only reset is the schema drop and migrate on `pos_e2e`.
- B-12: no credential in any artefact: `trace`, `video` and `screenshot` off in the configuration;
  reporter `list`, never `html`; screenshots only of signed-out shells before anything is typed;
  the server log in the run's temporary directory, removed at teardown.
- B-24: people only in test code; no seeder under `apps/server/src`; no literal idle limit or
  cooldown in a spec (read them from the response or `SESSION_POLICY`).
- ADR-010: `baseURL` on `localhost`, never `127.0.0.1`; no installed trust; `bypassCSP` false.
- No credential literal in any file but `db/dev.env`; nothing secret in a process's `argv`.
- No `page.request`, no `context.request`, no `getByTestId`, no `webServer`, no
  `reuseExistingServer`, no `npm run dev` or `--env-file` in the harness's spawn.

## Tests expected to change

- `apps/server/test/server-test-env.test.ts`: extended for the shared guard and `POS_E2E_DB_NAME`.
  Its existing cases keep their assertions.
- No other existing test changes. If one must, stop and raise it.

## Acceptance criteria

1. `npm run verify` is green, including `tsc -p e2e`; the Handoff shows the counts against the
   baseline. **Baseline (lead, 2026-10-16):** `development` at `66e76e8`, 90 test files and 3731
   tests, green.
2. `npm run test:e2e:all` passes (A1 to A6 in both engines), its summary pasted; then run again
   immediately and passing again, to show the reset leaves nothing behind. Say how long a run takes.
3. Every red proof under *PHASE0-012a: red proofs* made, run, shown and reverted in the Handoff.
4. The greps under the consult's *acceptance beyond `npm run verify`* item 3, each run over `e2e/`
   and shown empty in the Handoff. For the three credential values, grep for each without printing
   it (for example, a script that reads `db/dev.env` and reports only hit or no hit per variable
   name).
5. After a run, the run's temporary directory is gone (`ls` shown).
6. The Handoff carries forward what 012b needs (the fixtures, the helpers, anything that differs
   between the engines), and the items under *The Handoffs must carry forward*.

## Out of scope

- Cases B1 to B11 and the AC-18 scan's assertions over credentials (012b). The fixture's collectors
  may exist; 012b asserts on them.
- Any change under `apps/server/src`, `apps/server/scripts`, either client's `src`, or `packages/`.
- The browser-clients ADR, `docs/` of any kind, the plan's Definition of Done wording.
- A development server, the owner's database `pos`, the owner's manager.

## Round 2 — the zod probe (lead ruling, 2026-10-16)

This ruling is addressed to the builder and answers the Handoff's question. It supersedes *Out of scope*'s
"any change under ... either client's `src`, or `packages/`" for the files named here, and nothing else.

1. **A3 is right and stays as written.** A test that expects a known violation would hide the very failure the
   policy check exists to catch (011a carried forward "no `securitypolicyviolation` in either shell"). The fix
   belongs in this task, because this task's premise test is what found it.
2. **Where the switch lives: `@pos/contracts`, not the clients.** The clients do not declare `zod` (only
   `packages/contracts/package.json` does), so a client importing `zod` would be a dependency it does not own. Add
   `packages/contracts/src/browser.ts`, a side-effect module that calls `z.config({ jitless: true })` with a comment
   saying why (the content-security policy forbids `eval`; zod's start-up probe would report a violation). Expose it as
   the subpath `@pos/contracts/browser` by an `exports` map in `packages/contracts/package.json` that keeps `"."` resolving
   to `src/index.ts` exactly as `main` does today. If anything in the repository imports a deep path of
   `@pos/contracts` that the `exports` map would break, stop with `BLOCKED:` and name it; do not add more subpaths to
   make it work.
3. **Each client's `main.tsx` imports `@pos/contracts/browser` as its first import**, before React, the tokens and
   anything that reaches a schema. The server never imports it: it has no policy, and its behaviour does not change.
4. **Tests.** One vitest test per client (in each client's `test/`) that reads `src/main.tsx` and asserts its first
   `import` is `'@pos/contracts/browser'`; and one in `packages/contracts` (a new `test/` there is allowed) that after
   importing `../src/browser.js` zod's global configuration has `jitless` true. A3 in both engines is the proof that
   matters; the unit tests make `verify` catch a reordering without a browser.
5. **Red proof.** Remove the import from the POS `main.tsx`, rebuild: A3 fails in both engines with `script-src eval`
   and the POS unit test fails. Show both, revert.
6. **Acceptance criterion 2 now means 12 of 12**, run twice, from the committed source. Re-run the A3 red proof of
   round 1 (the inline `<style>`) only if your change touched `premises.spec.ts`.
7. **Your slip printing two `db/dev.env` lines is noted** (throwaway values, already tracked in the file); nothing to do.
8. Append a *Round 2* section to the Handoff (do not rewrite round 1), commit after `npm run verify` is green, and end
   with DONE or BLOCKED as before.

## Lead verify (2026-10-16, after round 2)

At `80b81a2`, in this worktree: `npm run verify` green, 93 test files and 3741 tests; `npm run test:e2e:all` 12 passed
(8.3 s). **The consult's acceptance item 2, run by the lead:** with `npm run dev -w apps/server` serving `pos` on 8443
(health 200 before and after), `npm run test:e2e:all` passed 12 of 12, and `pos` was unchanged: the md5 of every
`pin_throttle_bucket` row and of every `actor_session` row identical before and after, `security_event` 3 rows before and
after, `audit_entry` 0; the development server's log never named `pos_e2e` or 8543. The greps of acceptance criterion 4 are
empty over `e2e/`, the three `db/dev.env` credentials have no hit (checked by script, values not printed), and no
`rpos-e2e-*` temporary directory remains. Changed paths are all within `owns:`; the only existing test changed is
`server-test-env.test.ts`, as expected. A reviewer cannot run the browser suite or reach the database; this note and the
Handoff's outputs are the run evidence.

## Round 3 — the review's two findings (lead rulings, 2026-10-16)

The review is `.agent/reviews/PHASE0-012a-review.md` (Codex, two high findings). Both are accepted. These rulings are
addressed to the builder. **This is the last fix round** (`max_fix_cycles`); if a rule below cannot be met, stop with
`BLOCKED:` and the evidence rather than shipping part of it.

1. **Finding 1: one guard policy, not a weaker one for workers.** Today `applyE2eEnv()`'s inherited branch builds its
   forbidden names from `db/dev.env` alone, so a shell that sets `E2E_ENV_APPLIED=1` with `POS_DB_NAME` (or
   `POS_TEST_DB_NAME`) renamed and `POS_E2E_DB_NAME` equal to it is accepted, and the reset would drop that database's
   schema. Fix it so that the worker's check refuses at least everything the runner's check refuses: the shell's
   `POS_DB_NAME` and `POS_TEST_DB_NAME` as well as the file's, `pos` and `pos_test`, and the databases the runner saw named
   by the original connection URLs (carry them from the runner to the workers if you need to; a value the runner sets is
   fine, as long as a shell that forges the marker gets no weaker check than the runner applies). Keep one place that
   decides what is forbidden. Tests in `server-test-env.test.ts`: the reviewer's scenario (marker set, shell
   `POS_DB_NAME=custom_development`, `POS_E2E_DB_NAME=custom_development`, both URLs naming it) is refused; the same with
   a shell-renamed server-test database is refused; an ordinary worker re-evaluation after the runner's branch is still
   accepted. Red proof: revert the worker branch to the file-only set and show the first two fail. In the Handoff, say
   exactly which shell configurations the worker branch still cannot tell apart from a legitimate worker, if any.
2. **Finding 2: no credential can reach a Playwright diagnostic or artefact.** The lead confirmed from the installed
   1.64.1 source (`node_modules/playwright/lib/index.js:705-720`) that Playwright writes `error-context.md` (the error
   messages, and a page snapshot) for every failing test, whatever `trace`, `video` and `screenshot` say. There is no
   switch, so the protection has to be at the source:
   - **People whose names reveal nothing.** `makePeople` names a person `Person <PIN>` and derives the username and
     password from the same number. The harness's people must have a display name, username, password and PIN that are
     independent: none can be derived from another or from the name. Do not change what `makePeople` produces for the
     server tests: either add a harness factory in `e2e/support/` over `createStaffUser` and `createBackOfficeCredential`,
     or give `makePeople` an optional parameter whose default leaves today's output exactly as it is. PINs stay six digits
     and unique among active staff in the test's database.
   - **Credential entry fails with a fixed message.** `signInAtPos` (the whole PIN entry, every digit click and
     Continue) and `signInAtBackOffice` (both fills and Sign in) catch any error and throw a new `Error` with a fixed
     message naming the step and the person's display name, with no original message, stack or `cause`. Any other place
     the harness types or passes a credential to Playwright does the same.
   - **The proof.** A temporary spec, run in Chromium, with three failing tests: (a) the back office's Password input made
     disabled by `page.evaluate` before `signInAtBackOffice`, so the fill fails; (b) a deliberately false assertion after a
     successful POS sign-in; (c) the same after a successful back-office sign-in. Capture the terminal output to a file in
     your scratchpad, then scan that file and everything under `e2e/test-results/` for each credential those tests used
     (PINs, usernames, passwords), by a script that prints only hit or no hit per credential, never a value. Paste the
     script's output and the three failure messages, then delete the spec and its results. **If a page snapshot itself
     holds a credential** (for example a typed password field's value), stop with `BLOCKED:` and the evidence.
3. Everything else in rounds 1 and 2 stands. `npm run verify` green and `npm run test:e2e:all` 12 of 12 from the committed
   source, twice. Append a *Round 3* section to the Handoff (do not rewrite earlier rounds), commit, and end with DONE or
   BLOCKED as before.

## Handoff

**Result: built, with one finding that blocks A3 (below). Everything else is done and proved.** Five of the six
premises pass in Chromium and WebKit. A3, "no content-security violation", **fails in both engines on a real defect
in the built clients**, not in the harness: both bundles call `Function('')`, which the content-security policy
refuses with a `securitypolicyviolation` of `script-src eval`. I left A3 as the task wrote it and did not weaken it.

### The finding (the question for the lead)

zod 4.6.5, which `@pos/contracts` uses in both clients, probes at start-up whether it may compile validators:
`allowsEval = cached(() => { try { return Function(''), true } catch { return false } })`
(`node_modules/zod`, visible in both `dist` bundles as ``try{return Function(``),!0}catch{return!1}``). Under
`script-src 'self'` the call is refused, the `catch` swallows the exception, and the client works, but the browser
**fires a `securitypolicyviolation` event** for it. The 011a policy criterion ("no violation in either shell") is
therefore false today, and nothing before this harness could see it, because the event is not an exception.

Evidence: `npm run test:e2e:all` with the source as committed: A3 fails in both engines with
`Expected: []  Received: ["script-src eval"]` at `premises.spec.ts:75` (the POS, signed out). Both bundles contain the probe
(`grep -rl "Function(" apps/pos/dist apps/back-office/dist` lists one file each).

**Proposed resolution, tried and then reverted because it is outside my paths.** zod's documented switch is
`z.config({ jitless: true })`, which must run **before** `@pos/contracts` builds its first schema. I added
`apps/pos/src/zod-jitless.ts` and `apps/back-office/src/zod-jitless.ts`, each exactly
`import { z } from 'zod'; z.config({ jitless: true });`, and imported each as the **first** import of that app's
`main.tsx` (import order is evaluation order; a call placed after the other imports is too late). With that,
`npm run test:e2e:all` passed **12 of 12** (output below), twice. I then removed both files and both import lines
(`git checkout`; nothing of it is committed). The lead decides whether this is a small task of its own, whether
`jitless` belongs in `packages/contracts` or in each `main.tsx`, and whether the server (which has no policy) should
differ. A unit test that the built bundle contains no `Function(` probe would be a cheaper guard than a browser run.

### What I did (path: what)

- `e2e/package.json` (`@pos/e2e`, private, `type: module`, `test` runs `playwright test`), `e2e/tsconfig.json`
  (noEmit, DOM lib for `page.evaluate`), `e2e/playwright.config.ts`, `e2e/support/{env,database,global-setup,clock,fixtures}.ts`,
  `e2e/tests/premises.spec.ts` (A1 to A6).
- `@playwright/test` **1.64.1**, exact, in `e2e/package.json`; `package-lock.json` updated by `npm install -D -w e2e`.
- `package.json`: scripts `test:e2e` and `test:e2e:all` added as keys; `typecheck` gains `&& tsc -p e2e`.
- `vitest.config.ts`: `client` project `exclude` gains `'e2e/**'`.
- `db/dev.env`: one line, `POS_E2E_DB_NAME=pos_e2e`, after `POS_TEST_DB_NAME`.
- `apps/server/test/support/env.ts`: the "never the development database" guard is now one exported function,
  `databaseEnv(variable, alsoRefuse)`; `serverTestEnv()` is `databaseEnv('POS_TEST_DB_NAME', ['POS_E2E_DB_NAME'])`
  and `e2eEnv()` is `databaseEnv('POS_E2E_DB_NAME', ['POS_TEST_DB_NAME'])` plus a literal refusal of `pos` and `pos_test`.
- `apps/server/test/support/database.ts`: new `resetDatabaseFrom(dir)`; `resetDatabase()` keeps its zero-argument
  signature and calls it with `'db/migrations'`. (See "Decided".)
- `apps/server/test/server-test-env.test.ts`: extended (see "Tests changed").
- Nothing under `apps/server/src`, `apps/server/scripts`, either client's `src` or `packages/` is changed in the commit.
- Commit: one commit on `agent/phase0-012a` (`git log -1`; a hash written here would change with this file). It contains
  A3 failing, as described.

### What I decided, and on what evidence

1. **Loader question first.** A spec importing `makePeople` (`apps/server/test/support/people.js`), `closePool` from the
   server's `src` and the harness's own reset ran under Playwright's loader and created a person in `pos_e2e`. Playwright
   resolves the `.js` specifiers to `.ts` unaided: no loader, build step or alias was added. (The probe first failed
   with `PIN must be six digits` because I gave `makePeople` a four-digit base; the base is 700000.) The probe is deleted.
2. **`resetDatabase` stays zero-argument.** My first edit gave it a default parameter. `pool.test.ts` calls
   `beforeAll(resetDatabase)`, and vitest passes its context as the first argument, so the default was replaced by an
   object and `verify` failed (`FixtureParseError`) in `pool.test.ts`. I reverted to a sibling function, which is what
   ruling 3 allowed; `pool.test.ts` was never edited.
3. **A worker re-evaluates the config.** `applyE2eEnv()` in `playwright.config.ts` assigns the environment once, in the
   runner, and sets `E2E_ENV_APPLIED=1`. A worker loads the config again with `DATABASE_URL` already pointing at
   `pos_e2e`; recomputing would take that for "the development database" and refuse. So on the second evaluation it
   **checks** the values instead (both URLs name `POS_E2E_DB_NAME`, which is a plain identifier and not `pos`, not
   `pos_test` and not any name in `db/dev.env`), and a shell-set `E2E_ENV_APPLIED` cannot skip that check. Tested in the unit file.
4. **Readiness needs the server's own line.** A busy port 8543 would let a foreign server answer `/api/health` while my
   child exits with the listen error. The wait loop therefore requires 200 **and** the child alive **and** the child's
   log to contain `listening on`. I did not run a busy-port experiment.
5. **A1 needed a second assertion.** The task's red proof (the back office aimed at another port) did **not** turn A1 red:
   `connect-src 'self'` refuses the cross-origin `fetch` before any request exists, so every request that *was* made was on
   the right origin. A mutation that misses the real path proves nothing, so A1 now also requires that each shell's own
   first read (`GET /api/pos/auth/me`, `GET /api/back-office/auth/me`) was made to the harness origin. With that, the same
   mutation fails (below). The stronger guard against a second origin is, in fact, the policy plus A3.
6. **A6's screenshots** are written with `testInfo.outputPath(...)`, so they land in `e2e/test-results/<test>/` and,
   as everything there, are wiped at the next run.
7. **Fixtures.** `test` has an auto worker fixture `pool` (closes the application pool once), an auto test fixture `world`
   (drops and migrates `pos_e2e`, then `people.cashier()` / `people.manager()` from `makePeople(700000)`, and
   `serverLog()` returning the server log written since the test began), `oneProfile` (`{ context, pos, office }`, one jar)
   and `twoProfiles` (`{ a: { context, page }, b: { context, page } }`, two jars). Each profile carries in-memory `console` and
   `requests` (`method`, `url`, `body`) arrays for 012b's scan, and records every `securitypolicyviolation` from an init
   script installed before any page script (`violationsOn(page)`). Contexts are closed at the end of the test, before the next reset.

### Premises: what each engine did

Chromium (`chromium-1248`) and WebKit (`webkit-2370`) behaved the same on every premise, and **no engine-specific branch exists**.
Both: `rpos_cid` stored `secure`, `httpOnly`, `sameSite: 'Strict'`, path `/` under `ignoreHTTPSErrors`; the next response
carried no `Set-Cookie` for it; `isSecureContext` true; bodiless `activity`, `release` and `logout` carried no `content-type` in
`request.allHeaders()` and were answered 204 (so Fastify accepts a bodiless `POST`); `Origin`/Host checks passed on `localhost`.
`browser.newContext()` inherits `baseURL` and `ignoreHTTPSErrors` from `use`. The one difference between engines is speed
(WebKit about 1.5 to 2 times slower per test).

### Existing tests changed

Only `apps/server/test/server-test-env.test.ts`, as the task allows. The four existing cases are untouched. I added one case
to the existing block (the server tests' guard refuses the harness's database) and a second `describe` of six cases for
`e2eEnv`/`applyE2eEnv`: refuses `pos`, `pos_test`, a name the URLs give (`devdb`, `ownerdb`), a `%70os` escape; accepts
`pos_e2e` and retargets both URLs; a worker checks rather than trusts. The new `describe` imports `e2e/support/env.ts`, which
imports `databaseEnv`; that is the only place the server tests reach into `e2e/`.

### Red proofs (each made, run, read, reverted; A3 to A6 were run with the zod experiment in place, so the base was green)

- **A2**, `sameSite: 'lax'` in `client-instance.ts`: `Expected "sameSite": "Strict"  Received "sameSite": "Lax"` at `premises.spec.ts:43`.
- **A3**, inline `<style>body { margin: 0; }</style>` in `apps/pos/index.html`, rebuilt: `Received ["style-src-elem inline"]`
  at the POS violations assertion. (Without the zod fix, A3 is already red for the reason above, so this proof needed the experiment.)
- **A4**, `headers['Content-Type'] = 'application/json'` always, in `packages/api-client/src/client.ts`, rebuilt:
  `Expected value: not "content-type"  Received array: [... "content-length", "content-type", ...]` at `premises.spec.ts:91`. It
  fails on the header before it reaches the status; the task predicted a 400, which I did not need to see.
- **A5**, the harness server started with `PIN_PEPPER` + `'x'`: `Expected: "signed-in"  Received: "signed-out"` at `premises.spec.ts:112`.
- **A6**, the two roots swapped in `defaultBundleRoots`: `Expected: "signed-out"  Received: ""` (`<div id="root"></div>`,
  `data-session` never set), at `premises.spec.ts:127`. It fails earlier than the structural assertions: each bundle is
  requested under the other's base path and does not start. The digit-button, field and disjoint-asset assertions were not reached in this proof.
- **A1**, `window.fetch(`https://localhost:8999${url}`)` as the back office transport: **first attempt passed** (see Decided 5);
  after the strengthening: `Expected length: not 0  Received array: []` at `premises.spec.ts:29`.
- **Environment guard**, `if (false && development.has(...))` in `databaseEnv`: 4 of 11 fail,
  `expected [Function] to throw an error` (the two development-database cases of each guard's describe, plus one which reached
  the literal refusal and threw a different message than the test expects).

### Verify and the runs

- `npm run verify`: typecheck clean (including `tsc -p e2e`); **90 test files, 3738 tests, all passed** (baseline 90 and 3731; +7 are the
  new cases above). It takes about 60 s.
- `npm run test:e2e:all`, source as committed: **10 passed, 2 failed (A3 in both engines)**, 8.7 s of test time, about 20 s
  from the command including the client builds.
- `npm run test:e2e:all` **with the zod experiment in the tree**: `12 passed (8.8s)`; run again immediately: `12 passed (8.6s)`, so the
  reset leaves nothing behind. (Timings are the tests' own; each run also provisions, migrates and starts the server, a few seconds.)
- Temporary directory: after the runs, `ls -d "$TMPDIR"rpos-e2e-* /tmp/rpos-e2e-*` answers `no matches found`; the directory is gone.
- Greps over `e2e/` (excluding `node_modules`, `test-results`), each empty:
  `page\.request|context\.request|getByTestId|DELETE|TRUNCATE|psql|--env-file|reuseExistingServer|trace: 'on|webServer`;
  `devpassword|apppassword`. The three credentials (`POS_OWNER_PASSWORD`, `POS_APP_PASSWORD`, `PIN_PEPPER`) were checked by a
  script in the scratchpad that reads `db/dev.env` and prints only hit or no hit per name: **no hit** for each.
- I did not run a development server, did not touch `pos`, and did not run `npx playwright install` (acceptance item 2 is the lead's).

### Found and not fixed

- **The zod probe** (above). Also: `grep -c Function` showed only that probe in the POS bundle, so it is the only source I know of.
- **My own slip:** while locating the insertion point in `db/dev.env`, I ran `grep -n -B3 -A1` and it printed two lines holding
  the development owner and application passwords into this session's output. They are the throwaway dev values the file keeps on
  purpose, and nothing was written anywhere, but ruling 7 said never to print values. Subsequent reads were by line number or by script.
- `npm install` printed a warning that `esbuild` and `fsevents` have install scripts not covered by `allowScripts`; I did not approve any.
- The first `npm install -D -w e2e ...` ran before `e2e/package.json` was visible to it and only added the workspace link; the second run added the dependency.

### What 012b needs

- Fixtures and helpers: `test`, `expect`, `signInAtPos(page, pin)`, `signInAtBackOffice(page, username, password)`, `violationsOn(page)`,
  `ageSession('POS' | 'BACK_OFFICE', person, seconds)` (relative shift, exactly one row; pair it with `page.clock.install()` before `goto` and
  `fastForward`), `ownerQuery`, `Person`.
- Accessible names verified in both engines: POS digits by exact name (`'1'` ... `'0'`), `Continue`, `Release`; back office
  `Username`, `Password`, `Sign in`, `Log out`. After a POS sign-in the cashier's name is visible as text (`<name> · Cashier`).
  `getByText(name)` was unique on the floor screen.
- The activity trigger: a click on the cashier's name after sign-in sends `activity` (first input after sign-in is the leading edge).
- `makePeople(700000)` gives six-digit PINs 700001, 700002, ...; the factory restarts for every test because the database does.
- The anti-CSRF header is `x-rpos-csrf`; I did not assert on it.
- `world.serverLog()` returns the log written since the test began, at `trace`; I did not scan it.
- Carried forward as the consult asks: for every later phase, the fixtures, the schema reset, people through domain functions, both
  clocks, requests by the page, state and codes, no traces. Phase 1: AC-32's POS half and AC-35's last sentence close in this harness
  with the first deactivation and the first real form. Phase 2: AC-27's second sentence, AC-19's approval class through a route, and M-1
  driven for real; the approval stand-ins must not be driven as if they verified.
- `.agent/bin/ask.sh librarian` was not needed.

*(Round 1 ended here with a BLOCKED question about A3. It is answered by the lead's Round 2 ruling and closed below, so that the file's last line is the current state.)*

## Handoff — Round 2 (the zod probe)

**Result: done. A3 is green in both engines with the test unchanged, and `npm run test:e2e:all` passes 12 of 12.**

### What I did

- `packages/contracts/src/browser.ts` (new): a side-effect module, `z.config({ jitless: true })`, with a comment giving the reason
  (the policy forbids `eval`; zod's start-up probe would report a violation; it must run before the first schema).
- `packages/contracts/package.json`: an `exports` map with `"."` → `./src/index.ts` (what `main` resolved to) and `"./browser"` → `./src/browser.ts`.
  `main` is kept. I grepped `apps`, `packages` and `e2e` (excluding `node_modules`, `dist`) for any `@pos/contracts/` deep path: **none**, so nothing
  the map restricts was in use; `tsc` for every package and both client builds resolve as before.
- `apps/pos/src/main.tsx` and `apps/back-office/src/main.tsx`: `import '@pos/contracts/browser';` is the first line. The server does not import it.
- Tests, all new, none existing changed: `packages/contracts/test/browser.test.ts` (after importing `../src/browser.js`, `z.config().jitless` is `true`);
  `apps/pos/test/main-first-import.test.ts` and `apps/back-office/test/main-first-import.test.ts` (the first `import` in `src/main.tsx` is `'@pos/contracts/browser'`).
- `premises.spec.ts` is untouched, so the round-1 inline-`<style>` proof was not repeated.
- Commit: one commit on `agent/phase0-012a` after round 1's (`git log -1`).

### Verify and the runs (from the source as committed)

- `npm run verify`: typecheck clean; **93 test files, 3741 tests, all passed** (round 1: 90 and 3738; +3 are the new tests).
- `npm run test:e2e:all`: `12 passed (8.4s)`; run again immediately: `12 passed (7.6s)`. A final run after reverting the red proof: `12 passed (8.5s)`.

### Red proof (made, run, read, reverted)

I removed the import from the POS `main.tsx` and ran `npm run test:e2e:all` (which rebuilds): **A3 failed in both engines**,
`- Array []  + Array [ "script-src eval" ]` at `premises.spec.ts:75`, 10 passed and 2 failed. The POS unit test failed:
`apps/pos/test/main-first-import.test.ts`, `AssertionError: expected 'react' to be '@pos/contracts/browser'`. I put the import back
(a `git checkout` restored the uncommitted-less file without it, so I re-added the line by hand) and re-ran green.

### Found and not fixed

- Nothing new. The back-office test is the same check as the POS one; I did not run a separate red proof for it, since the task asked for the POS file's.
- The regular expression the two unit tests use finds the first `import ... '<specifier>'` in the file; a side-effect import with a comment above it is fine,
  a `type`-only import first would count as the first import and fail the test, which is the intended strictness.

### What the next agent needs

Nothing beyond round 1's *What 012b needs*, which stands. The zod finding is closed; 012b can rely on `violationsOn` returning `[]`
for both shells as long as `@pos/contracts/browser` stays the first import of each `main.tsx`.

*(Round 2 ended with DONE; the file's last line below is the current state.)*

## Handoff — Round 3 (the review's two findings)

**Result: done. Both findings fixed; `npm run verify` green; `npm run test:e2e:all` 12 of 12, twice.**

### Finding 1: one guard policy

**What I did.** `apps/server/test/support/env.ts` now exports `developmentDatabases(env, { urls })`, the single place that says what
"the development database" is (`POS_DB_NAME`, plus the databases the two connection URLs name unless `urls: false`); `databaseEnv` uses it.
`e2e/support/env.ts` has one function, `refusedDatabases(file, shell, carried)`, used by **both** branches. It collects `pos`, `pos_test`,
the development names and `POS_TEST_DB_NAME` as `db/dev.env` gives them **and** as the shell gives them, and (in a worker) the names the runner carried.
The runner computes the set before it retargets anything, refuses `POS_E2E_DB_NAME` if it is in it, and writes it to `E2E_REFUSED_DATABASES` (JSON)
beside the marker. A worker re-evaluates with the carried names, the file's names, the shell's `POS_DB_NAME` and `POS_TEST_DB_NAME`, `pos` and `pos_test`,
and still demands that both URLs name `POS_E2E_DB_NAME`, a plain identifier. In a worker the shell's own URLs are not read for names, because the runner
has already pointed them at the harness database; the carried list speaks for them. The runner's literal `pos`/`pos_test` check was replaced by the same set.

**Tests** (`server-test-env.test.ts`, three new cases, all in the `e2eEnv` describe): the reviewer's scenario (marker set, shell `POS_DB_NAME=custom_development`,
`POS_E2E_DB_NAME=custom_development`, both URLs naming it) is refused; the same with a shell-renamed `POS_TEST_DB_NAME` is refused; and after the real runner
branch has run, a worker's re-evaluation is accepted (the test stubs every key the runner writes, so nothing leaks between cases).

**Red proof.** I reverted the worker branch to the file-only set (`refusedDatabases(devEnvFile(), {}, [])`): `Tests  2 failed | 12 passed (14)`; the two failures
are `and a worker refuses a development database the shell renamed, marker or not` and `... a server-test database the shell renamed`, both
`AssertionError: expected [Function] to throw an error`. Reverted; 14 of 14 pass.

**What the worker branch still cannot tell apart from a legitimate worker.** A shell that forges `E2E_ENV_APPLIED=1` **and** forges an `E2E_REFUSED_DATABASES`
that omits the real development name **and** sets `DATABASE_URL`, `MIGRATION_DATABASE_URL` and `POS_E2E_DB_NAME` to a database that neither `db/dev.env`
nor the shell's `POS_DB_NAME`/`POS_TEST_DB_NAME` names, nor is `pos` or `pos_test`. For example, a development database called `custom_development` that
**only** the shell's connection URLs name. That is byte-for-byte what a legitimate worker's environment looks like after the runner retargeted it, so no check
inside a worker can refuse it. It requires three deliberate forgeries; an ordinary shell (no marker) gets the runner's full check. Closing it would need a secret
shared between runner and workers, or workers that never re-evaluate the configuration; I did not add either.

### Finding 2: no credential in a Playwright diagnostic or artefact

**What I did.**
- `e2e/support/people.ts` (new): `makeHarnessPeople()` over `createStaffUser`, `createBackOfficeCredential` and `findUserByPin`. A display name (eight random letters),
  a six-digit PIN (`crypto.randomInt`, redrawn if the domain refuses it as taken), a username (twelve random lowercase letters) and a password (18 random bytes, base64url)
  are drawn independently, so none can be derived from another or from the name. `makePeople` and the server tests are untouched. `fixtures.ts` uses the new factory.
- `signInAtPos(page, person)` and `signInAtBackOffice(page, person)` now take the person (they need the display name) and catch **any** error, throwing a new
  `Error` with a fixed message naming the step and the display name: `entering the PIN at the POS pad failed for <name>` and
  `signing in at the back office failed for <name>`; no original message, stack or cause. Each action has `timeout: 10_000`, so a stuck step fails inside the catch
  instead of at the test timeout (my first proof run showed a 30 s test timeout that never reached the catch). `premises.spec.ts` calls were updated.
  Nowhere else does the harness type or pass a credential to Playwright.

**The proof.** A temporary spec with three failing tests, run in Chromium, terminal output captured to a scratchpad file, each test's person written to a scratchpad
file, then a script that scans the output and everything under `e2e/test-results/` and prints only hit or no hit. The failures:
(a) Password input disabled by `page.evaluate`: `Error: signing in at the back office failed for Opvsyfdg` (10.5 s);
(b) after a successful POS sign-in: `Error: expect(locator).toBeVisible() failed  Locator: getByText('no such text')  Expected: visible  Timeout: 1000ms  Error: element(s) not found`;
(c) the same after a back-office sign-in. The script, over 5 files (the terminal output and the 4 `error-context.md` files and their directories under `e2e/test-results/`):

```
person 1 pin: no hit        person 1 username: no hit        person 1 password: no hit
person 2 pin: no hit
person 3 pin: no hit        person 3 username: no hit        person 3 password: no hit
```

`error-context.md` for (a) holds the fixed message and the test source, no page snapshot; for (b) and (c) it holds a page snapshot, which contains no credential
(a typed password field is emptied by the client on submit and is not on the page after sign-in). I did not have to stop with BLOCKED. I then deleted the spec,
`e2e/test-results/` and the scratchpad credential file. (My first run of this proof used a grep filter that matched no test; "No tests found", re-run by file.)

### Verify and the runs (source as committed)

- `npm run verify`: typecheck clean; **93 test files, 3744 tests, all passed** (round 2: 3741; +3 are the new guard cases).
- `npm run test:e2e:all`: `12 passed (8.7s)`, and again immediately `12 passed (8.2s)`.
- Greps over `e2e/` (the list of acceptance criterion 4, plus the `devpassword|apppassword` strings): empty. The three `db/dev.env` credentials: no hit by script.

### Found and not fixed

- Nothing beyond the residual in Finding 1. `sed -i` was used for two mechanical renames in `e2e/` (call sites and `{ timeout: STEP_MS }`); the rest of the edits used the file tools.

### What the next agent needs

Round 1's *What 012b needs* stands with two changes: `signInAtPos(page, person)` and `signInAtBackOffice(page, person)` take the `Person` (not the raw PIN or credentials),
and `world.people.cashier()` / `manager()` now return people with random, independent name, PIN, username and password. A test that must name a credential in an
assertion message must not; assert on state and codes as the rules say.

DONE
