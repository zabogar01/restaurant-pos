# ARCH-015 — The browser harness (plan Task 12)

Author: `architect15`, 2026-10-16. Read-only consult for PHASE0-012 (not yet written). Nothing
was edited except this report, and nothing was committed.

## Summary

**Plan Task 12 cannot be dispatched as written, and none of its code should be copied.** Every
fault ARCH-014 listed is real, and reading it against what 011a to 011d2 built finds more. Its
seeder lives in production source and deletes from four tables, three of which do not exist and
one of which (`audit_entry`) refuses the delete even from the owner. Its configuration would
attach to a development server already running on 8443 and so test against the development
database. Its second AC-27 test asserts the opposite of what it claims: after a reload it expects
the PIN display, which is the POS signed out. Its AC-28 test ages every session in the database
through `psql` with the owner's password on the command line and then asserts a bare 401, which
three different codes share. It folds a browser run into the `verify` every builder runs.

What PHASE0-012 must say instead, in order of weight:

1. **The harness owns its whole world, and nothing in it can reach the development installation.**
   Its own database (`pos_e2e`), its own port (8543), its own advisory lock, a throwaway
   certificate made per run, and a server it starts itself from Playwright's `globalSetup` with an
   environment built in code from `db/dev.env`, with no `--env-file` fallback. A missing variable
   must fail the run, never quietly fall back to `pos` (question 3).
2. **People are made through the domain functions in test code, and the database is reset by
   dropping and migrating the schema before every test, never by `DELETE`.** This is the server
   tests' existing rule (PHASE0-003b item 6), and it is also the answer to the throttle: every
   test starts from a fresh installation, so AC-19's cooldown cannot leak into the next test
   (questions 3 and 4).
3. **Both clocks move together.** A test ages `actor_session.last_interactive_at` over the
   harness's owner connection by N seconds and advances the page's clock (`page.clock`) by the
   same N, so the client's own countdown reaches its deadline, reads `me`, and the server gives its
   verdict. No real waits, no debounce workaround, and no `page.request` (question 4).
4. **Assertions are on state and codes, never on copy or on a status alone.** `#root[data-session]`,
   POS-01's `data-lock-state`, dialog titles and button names from the Handoffs, and the envelope's
   `code` read from the response the page itself made (questions 1 and 5).
5. **The browser run stays out of `npm run verify`.** It becomes `npm run test:e2e`, run by the
   PHASE0-012 builder, by the lead before merging any task that touches a client, the transport
   core, the HTTP layer, the session domain or a migration, and at the Phase 0 gate. `verify`
   gains only `tsc -p e2e` and an exclusion that keeps vitest from collecting the Playwright specs
   (question 6).
6. **Split it in two.** PHASE0-012a builds the harness and proves its own premises in a browser
   (one origin, the cookie under a certificate exception, no policy violation, a bodiless `POST`,
   a real PIN sign-in). PHASE0-012b writes the acceptance tests on top of it: AC-19, AC-27, AC-28's
   divergent presentation, M-6 served, the tab that must never become another person, and AC-18's
   browser-driven scan (question 1).

No boundary is strained by the recommended design. **No change to PRODUCT.md, PRD.md, ROADMAP.md
or BOUNDARIES.md is proposed.** Two readings go to the owner for confirmation; neither blocks
012a.

## What I verified, and what I could not

Read in this checkout at `66e76e8` (development): the task file; plan Task 12 (`:3506-3750`) and
the Phase 0 Definition of Done (`:3752-3766`); ARCHITECTURE §3.1, §14 (whole) and the section list;
ADR-010's structure; PRD FR-A1 to FR-A7, NFR-1, NFR-5 and the criteria named; BOUNDARIES B-7 and
B-11 to B-14 and B-24; ROADMAP *Phase 0*; DECISIONS.md in full; ARCH-014's summary, §2 (`verify`),
§5 (*One browser holding both*), §6, §10, §11, *For the lead* and *For the owner*; ARCH-012's
library notes and *The two-client harness*; ARCH-010 §2 (the three tiers), *Against the
boundaries* and *The Handoffs must carry forward*; ARCH-013's summary; the Task 12 notes in the
Handoffs of PHASE0-008a, 008b, 009a, 009b, 011a, 011c2 (*For 011d and Task 12* and Round 3), 011d1
(*For Task 12 (the harness)*) and 011d2 (*For the next agent* and the lead's hand check of
criterion 5); PHASE0-003b and PHASE0-004 on `db/dev.env`.

Code read: every file under `apps/server/test/support/`; `apps/server/scripts/` (all three);
`apps/server/src/config.ts`, `index.ts`, `db/pool.ts`, `db/migrate.ts`; `http/server.ts`,
`bundles.ts`, `origin.ts`, `client-instance.ts`, `loopback.ts`, `log.ts`, `session-guard.ts` and
the three route files; `domain/session.ts` and `domain/throttle.ts`; migrations `0003` to `0005`;
`db/dev.env`, `docker-compose.yml`, `vitest.config.ts`, the root and server `package.json`,
`.gitignore`; both clients' `session/activity.ts` and `session/source.ts`, the POS
`realSession.ts` code mapping, `LockScreen.tsx`, `PinPad.tsx`'s labels, and the lines in
`PosRoutes.tsx` and `OfficeApp.tsx` that set `data-session`; `packages/api-client/src/client.ts`'s
header handling; the test lists of every package, and the tests the Definition of Done relies on.

**Library facts came from the librarian (four questions, 2026-10-16), not recall:**

- `@playwright/test` latest stable is **1.64.1** (released 14 October; 1.64.0 on 7 October),
  `engines.node >=20` (GitHub releases and the v1.64.1 `package.json`).
- `page.clock.install()` fakes `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame` and
  `performance` (playwright.dev/docs/clock, added 1.45). `fastForward` jumps and fires due timers
  at most once; `runFor` fires every callback in the range; `pauseAt` jumps then freezes.
  Document visibility is **not** faked.
- `context.clearCookies({ name, domain, path })` filters exist since 1.43; `context.cookies()`
  reports `httpOnly`, `secure` and `sameSite`. `page.request` shares the context's jar.
- `globalSetup` runs once before all tests; values it sets on `process.env` are visible inside
  tests. **The `webServer` starts before `globalSetup`** (v1.64.0 `runner/tasks.ts`), and its
  `env` is fixed at spawn, so it cannot depend on anything `globalSetup` prepares.
- `webServer.reuseExistingServer: true` reuses whatever answers the URL; `false` throws if
  something does. Its readiness probe ignores HTTPS errors only if told to.
- Defaults: `trace`, `screenshot` and `video` are `'off'`; the reporter is `list` locally.
  Workers default to half the cores; files run in parallel unless `workers: 1`.
- Playwright's TypeScript loader tries `.ts` for a missing `.js` relative specifier, outside the
  test directory too (read from the v1.64.0 source; no doc states it).
- Fastify 5 routes a `POST` with no `Content-Type` and an empty body straight to the handler; a
  non-empty body with no type is a 415 (read from Fastify's `lib/handle-request.js`).
- PostgreSQL 16 `CREATE DATABASE … TEMPLATE` needs no other session on the template; `DROP
  DATABASE … WITH (FORCE)` is owner-only.
- Node 22's `--env-file` never overrides a variable already in the environment; a child spawned
  with `env` gets exactly that object; an environment is not part of `argv`.

**Not verified, and each rule below is written so the first run settles it:**

- **Whether Chromium and WebKit store a `Secure` cookie under `ignoreHTTPSErrors`.** No document
  says so. The origin stays `https:`, so I expect it, and the owner's hand check of 2026-10-13
  showed both real browsers storing `rpos_cid` after the warning was clicked through, which is the
  state `ignoreHTTPSErrors` reproduces. 012a's first test asserts it; nothing else may be built
  on it until that test has run in both engines.
- **Whether a typed value reaches a Playwright trace or report.** The librarian found no masking
  option and anecdotes that it does. The rule is therefore that tracing, video and the HTML
  reporter are off, and a screenshot is taken only of a screen that shows no credential.
- **Whether an `addInitScript` listener sees `securitypolicyviolation`.** I expect it; 012a's red
  proof (an inline style in a built page) settles it.
- **Whether Playwright's loader really resolves `../apps/server/src/domain/pin.js` to the `.ts`
  file.** Read from source, not run. 012a's first step imports `makePeople` from a spec and creates
  one person; if it fails, the builder stops and reports rather than adding a loader.
- **Whether Playwright's bundled Chromium honours `--ignore-certificate-errors-spki-list`.** Not
  needed by the recommended design; it matters only to the alternative I reject.
- **Whether the PHASE0-012 builder's sandbox can launch a browser and bind 127.0.0.1:8543.** The
  011d2 builder had no browser. This is the lead's to establish before dispatch (*For the lead* 1).

I ran no test, no build and no browser. This is a read-only consult.

---

## 1. Plan Task 12 against what is built and decided

Authority: ARCH-014 *For the lead* 7 and §10; ADR-009; ADR-010; B-7; B-24; ARCHITECTURE §14.4
("test-only seed paths"); the Handoffs named in each row.

### What is right and stays

Playwright against the real Fastify server and PostgreSQL (ARCHITECTURE §14.3); an `e2e` workspace
(already listed in the root `package.json`); `ignoreHTTPSErrors` in the browser contexts; two
browser contexts for two actors; the five subjects (AC-27 twice, AC-19 twice, AC-28).

### Every plan line to drop or change

| Plan lines | What it says | What is wrong | What PHASE0-012 says instead |
|---|---|---|---|
| `:3511-3512` | Files: one spec, and `apps/server/src/db/seedTestUsers.ts` | A seeder in production source is a staff list reachable from `src` (B-24, §14.4 "test-only seed paths"). One spec file mixes four criteria | Specs per subject under `e2e/tests/`; people come from `apps/server/test/support/people.ts` (`makePeople`), called from the harness. Nothing under `apps/server/src` changes |
| `:3516` | Produces coverage of AC-19, AC-27, AC-28 | Overclaims. AC-19's approval class through a route, AC-27's second sentence and AC-28's limits are not browser matters or not yet buildable | Produces the browser half only, as the table in question 5 says |
| `:3520-3529` | `"@playwright/test": "^1.48.0"` | A caret on a tool whose browser builds are tied to its exact version | Exact pin, `1.64.1` as of today (the builder re-asks the librarian at dispatch); `"private": true`; scripts below |
| `:3531` | `npx playwright install chromium` inside the task | A machine step that downloads browsers into `~/Library/Caches/ms-playwright`; a sandbox may block it | A one-time host step by the lead or the owner, `npx playwright install chromium webkit` at the pinned version, before dispatch |
| `:3542` | `baseURL: 'https://localhost:8443'` | Collides with the development server on 8443 | `https://localhost:8543`; the server is started with `POS_LISTEN_PORT=8543` (the origin guard accepts any port, `origin.ts:21-34`) |
| `:3547-3553` | `webServer` running `npm run dev -w apps/server`, `reuseExistingServer: true`, `PIN_PEPPER` literal | Four faults. `reuseExistingServer` would attach to a running dev server and so to `pos`. `npm run dev` is `tsx watch --env-file=../../db/dev.env`: it restarts on edits, and any variable the harness forgets falls back to `pos` (Node lets the environment win, then fills the rest from the file). The pepper literal is what ARCH-010 and three Handoffs forbade. And the `webServer` starts before `globalSetup`, so it cannot wait for the database the setup provisions | No `webServer`. `globalSetup` starts the server itself (question 3) |
| `:3557-3588` | The seeder | `DELETE FROM app_session` (no such table; `actor_session` grants no `DELETE`); `DELETE FROM audit_entry` (B-7; the trigger in `0004` refuses it even for the owner); `security_telemetry` (it is `security_event`); `DELETE FROM staff_user` (no grant, and referenced); `UPDATE auth_throttle` (it is `pin_throttle_bucket`); a manager made without a back-office credential (ADR-009: the back office cannot sign them in); run through `pool.query`, i.e. as `pos_app`, which can delete none of it; and `import.meta.url === \`file://${process.argv[1]}\``, which never matches in this checkout because its path contains a space (`migrate.ts:57-59` records exactly this bug) | Drop entirely. Reset by dropping and migrating the schema over the owner connection; people by `createStaffUser` and `createBackOfficeCredential` (question 3) |
| `:3598-3603` | `beforeEach` shells out to `npx tsx` with a pepper literal | A child process per test, a literal, and `cwd: '..'` | An auto fixture in the test process: reset, then people (question 3) |
| `:3605-3609` | `getByTestId('key-N')`, `getByTestId('key-enter')` | No test ids exist, by ruling | `getByRole('button', { name: d })` for each digit, then `getByRole('button', { name: 'Continue' })` (011c2 Handoff) |
| `:3611-3631` | AC-27: a cashier types a PIN into `bo-pin` and sees "The back office is for managers." | ADR-009: the back office takes a username and password, never a PIN, and has no PIN field. A sign-in never answers `FORBIDDEN` (`back-office-auth.ts`: it is `OPTIONAL` and verifies a password). The comment "the POS cookie travels" is false: `rpos_pos_sid` has path `/api/pos` (`session-guard.ts:41-44`) and never reaches `/api/back-office` | Rewritten: a POS session alone leaves the back office signed out; one profile holds both sessions independently (question 5, cases B3 to B5) |
| `:3633-3651` | AC-27: both clients signed in; `pos.reload()`, then expects `pin-display` visible | Inverted. The PIN display belongs to the lock screen, so the assertion passes exactly when the POS was displaced. Also signs the back office in with a PIN | After the reload, `#root[data-session="signed-in"]` on both pages |
| `:3653-3661` | AC-19: five wrong PINs, then expects the text "Incorrect PIN." | The fifth failure starts the cooldown and answers `INVALID_CREDENTIALS` with `retryAfterSeconds`, which the POS draws as the cooldown, not the error (`realSession.ts:39-42`). Copy is the designer's and changes | `data-lock-state="throttled"` after the fifth; the envelope codes read from the responses |
| `:3663-3679` | `context.clearCookies()` | Clears every cookie, so it proves nothing about `rpos_cid` in particular | `context.clearCookies({ name: 'rpos_cid' })`, then assert a *new* `rpos_cid` was issued and the correct PIN is still `THROTTLED` |
| `:3681-3697` | AC-28: `page.request.get`, then `psql "postgres://pos_owner:devpassword@…"` with `UPDATE app_session SET last_activity_at …`, then `expect(401)` | The password on a command line; a table and column that do not exist; no `WHERE`, so every session ages; `page.request` instead of the page; a 401 shared by `UNAUTHENTICATED`, `SESSION_IDLE` and `INVALID_CREDENTIALS`; and no presentation asserted at all, though "divergent timeout presentation" is the only part of AC-28 a browser adds. No back-office half | Question 4's ageing helper and `page.clock`; POS to POS-01 `resting`, back office to M-6 `idle`; codes from the envelope |
| `:3700-3703` | Step 5: "FAIL — the clients are not built" | Not a red proof: it fails for a reason unrelated to any assertion | One red proof per test, each a deliberate fault in source that the test catches (*For the task file*) |
| `:3715-3736` | Step 7: `verify` runs `build:clients` and `test:e2e` | Every builder and the lead run `verify` on every task; reviewers' sandboxes cannot reach the database at all. Also, the scripts block shown would delete `db:up`'s `--env-file` and `provision`, and shrink `typecheck` to one project, if copied | `verify` unchanged except `tsc -p e2e`; a separate `test:e2e` (question 6). Edit `scripts` by adding keys, never by pasting a block |
| `:3740` | `PIN_PEPPER=… npm run verify` | A secret on a command line, into shell history | Nothing on the command line; `db/dev.env` holds the development pepper, read in code |

### Split it

Two slices, in order:

- **PHASE0-012a — the harness and its premises.** The workspace, the configuration, `globalSetup`
  and teardown, the environment builder, the per-test reset and people, the ageing and clock
  helpers, the per-test collectors (server log, console, policy violations), and the six tests
  that prove the harness is testing the real thing (question 5, cases A1 to A6). It closes
  NFR-1's browser half, the cookie question, 011a's policy check, the bodiless `POST` and AC-1's
  first clause.
- **PHASE0-012b — the acceptance tests.** On top of 012a, the AC-19, AC-27, AC-28, M-6 and
  identity-continuity tests and the AC-18 scan (cases B1 to B11).

The reason to split is the one ARCH-014 gave for Task 11: 012a touches identity and the database
in ways a reviewer must read on their own (an environment builder that must never reach `pos`, a
reset that must never be a `DELETE`, credentials that must never reach an artefact), and every
012b test is worthless if one of 012a's premises is false. 012a's six tests are short, so it is a
small slice with a large review surface, which is the right shape. 012b can be dispatched as soon
as 012a merges.

---

## 2. The harness itself

Authority: ARCHITECTURE §3.1 (one origin, no installed trust), §14.3, §14.4; DECISIONS 2026-10-08
(the kit never installs trust); ADR-010 rule 3; ARCH-010 §2 (the three tiers); ARCH-012 *The
two-client harness*; the librarian.

### Tool, version and browsers

- **Playwright Test, `@playwright/test` exactly `1.64.1`** (exact, no caret; `npm` records it in
  the lockfile). Node ≥ 22 already exceeds its floor.
- **Chromium (Playwright's bundled build) is required**: it is the engine of the owner's Chrome.
  **WebKit is a second project**, run by the lead at acceptance and at the Phase 0 gate. Playwright
  documents it as the closest to Safari, not as Safari; it is evidence about the engine, and the
  owner's hand check stays the evidence about Safari (*For the owner* 1). No Firefox: nobody uses
  it here. Not `channel: 'chrome'`: the installed Chrome drifts under the pin, and a red proof must
  mean the same thing next week.

### Where it lives

In the `e2e/` workspace the root already lists: `e2e/package.json` (`@pos/e2e`, private, type
module), `e2e/tsconfig.json`, `e2e/playwright.config.ts`, `e2e/support/*.ts`, `e2e/tests/*.spec.ts`.
It imports the server's domain functions and test support **as test code**: `makePeople` from
`apps/server/test/support/people.ts`, `ownerQuery` and `ownerClient` from `database.ts`. Nothing
under `apps/server/src` or `apps/server/scripts` is added for the harness. `resetDatabase()` cannot
be reused as it is, because it migrates `'db/migrations'` relative to the working directory, and
Playwright's is `e2e/`; the harness's reset passes a path anchored to its own file, as
`migrate.ts:64` does.

### How it meets the certificate

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

### `baseURL`, origin, and who makes a request

- `use.baseURL = 'https://localhost:8543'`. Never `127.0.0.1`: the Host check refuses it, as it
  should (`origin.ts:47-54`).
- **Every request is made by the page**: through the UI, or for a probe that has no UI, through
  `page.evaluate(() => fetch(...))` with a relative URL, so that `Origin`, `Sec-Fetch-Site`, the
  cookies and the anti-CSRF token are the browser's own. **`page.request` and `context.request` are
  not used at all**: whether they send `Origin` is undocumented, and any token they carried would be
  one the test supplied, which is the thing being tested. A grep in the task's criteria holds this.
- `bypassCSP` stays `false` (its default), so the policy is enforced as served.

### The two shapes

Two fixtures, as ARCH-012 asked:

- **`oneProfile`**: one `browser.newContext()` with two pages, `pos` and `office`. One cookie jar,
  so `rpos_cid` is shared and each surface's cookie is scoped by path. This is a manager with both
  applications open in two tabs.
- **`twoProfiles`**: two contexts, `a` and `b`, each with its own jar. Two people on two browsers.

Each test opens its contexts and closes them before the next test's reset. A context never
survives a test.

### Configuration

`workers: 1` and `fullyParallel: false` (one server, one database); `retries: 0` (a flaky test
here is a finding, not noise); `trace: 'off'`, `video: 'off'`, `screenshot: 'off'` (B-12, question
9); `reporter: 'list'` and never `'html'`; `outputDir` under `e2e/test-results/` (already ignored);
`timeout` left at the default. Projects `chromium` and `webkit`; `npm run test:e2e` runs
`chromium`, and `test:e2e:all` both.

---

## 3. The server, the database and the people

Authority: B-7; B-12; B-24; ADR-009 §7; ADR-010; ARCHITECTURE §14.4; PHASE0-003b items 1, 5 and 6;
PHASE0-004 rule 3 (the pepper lives in `db/dev.env`); `test/support/env.ts`, `global-setup.ts`.

### A port and a database of its own

- **Port 8543**, a constant in the configuration (a port is not a secret). The development server
  keeps 8443. A port that is busy fails the run with the server's own start-up error; nothing
  reuses whatever is listening.
- **Database `pos_e2e`**, named by a new `POS_E2E_DB_NAME=pos_e2e` line in `db/dev.env`, beside
  `POS_TEST_DB_NAME`. It is neither `pos` (so the development throttle and the owner's manager are
  untouchable) nor `pos_test` (so the browser run never waits on, or is waited on by, every
  builder's `verify`).

### The environment, built in code

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

### Starting and stopping the server

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

### People, with no `DELETE` anywhere

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

### Coexisting with the server tests

Different database (`pos_e2e` against `pos_test`), different advisory-lock key, same container.
`provision` is idempotent and each run creates only its own database, so the two never race on a
`CREATE DATABASE` for the same name. The server tests are not changed by any of this, except
optionally the shared guard above.

---

## 4. Time and state between tests

Authority: FR-A2, FR-A2b, AC-28; ARCHITECTURE §14.4 ("PostgreSQL time… prevents the browser clock
from becoming an authority"); ARCH-014 §6; 011d2 *For Task 12's served check* and the lead's hand
check (the 60-second window swallowing the first click); the librarian on `page.clock`.

### Ageing a session

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

### Moving the client's clock with it

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

### The sixty-second activity window

The back office sends `activity` on the leading edge of a 60-second window, the POS on a
five-second one (`activity.ts:14` and `:13`). A test that needs a fresh `activity` after an earlier
input advances the page clock past the window (`fastForward(61_000)` at the back office), which is
exactly what a person waiting would do. Most tests will not need it: the deadline read above does
not depend on the window at all.

### A clean installation for each test

The reset before every test is the answer. AC-19's cooldown, a password counter, a released
session and every security event vanish with the schema, and the next test starts from the
migrations' two empty buckets. Nothing is deleted and no cooldown is aged out to make room. The
alternatives and why they lose: **ageing the cooldown away** (the server tests' `ageOutPinCooldown`)
makes each test depend on what an earlier one left and on remembering to clean up; **ordering AC-19
last** breaks the first time a test is added after it; **a database per file** gives the same
isolation with more machinery.

---

## 5. What closes in Task 12

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

---

## 6. `npm run verify` and who can run it

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

---

## 7. The Phase 0 Definition of Done

Authority: plan `:3752-3761`; the tests named.

| Item | Status |
|---|---|
| `npm run verify` passes from a clean checkout after `db:up` and `db:migrate` | True on every merged task's worktree, which is close to a clean checkout but not one. **Owed:** the lead runs it once from a fresh clone at the Phase 0 gate, followed by `test:e2e:all`. The item should gain "and `npm run test:e2e:all` passes" (*For the lead* 4) |
| No `number` touches money or a rate in `packages/money` or `apps/server` (B-1) | **Proved.** `packages/money/test/no-number.types.ts`, compiled by `typecheck`. `apps/server` holds money only as audit `beforeAmount`/`afterAmount`, typed `bigint` and checked at run time (`audit.ts:79-83`), and `BIGINT` is parsed as a string (`pool.ts:8`). Task 12 adds nothing |
| No path writes a PIN to a log, audit row, telemetry row or error message (B-12) | **Proved, by tests rather than the grep the item names**: `log-scan.test.ts` cases 21 to 24 and 26 to 27, the PIN and session scans, and `security_event`'s columns (no column can hold a PIN, `0004`). Task 12 adds the browser-driven scan (question 5, AC-18 row). The grep is weaker than the tests and can be dropped from the item |
| `pos_app` cannot UPDATE or DELETE `audit_entry`, by test (B-7) | **Proved.** `schema.test.ts` cases 3 (privileges) and 6 (the trigger, owner included) |
| The server refuses to start when `HOST` is not loopback (NFR-1) | **Proved**, under a name that changed: the variable is `POS_LISTEN_HOST` (`config.ts:9-18`, zsh defines `HOST`). `loopback.test.ts` cases 1 to 6 and the config tests. The item's wording should name `POS_LISTEN_HOST` |
| A `LOGIN` success does not reset `MANAGER_APPROVAL` (FR-A5) | **Proved at the domain**, `throttle.test.ts` case 8, and through the adapter's test probe (010b). Through a production route: Phase 2, which has the first one |
| Two bundles, two cookies; neither session resolves on the other's routes (NFR-5, FR-A2c) | **Proved at the API** (009a's guard tests, both directions) **and in the source** (`boundaries.test.tsx`: no import across the clients, no route of the other surface nameable). **Task 12 proves it in a browser** (A6, B3 to B5) |
| No menu, rate, table or business detail hard-coded or seeded outside the test fixture (B-24) | **Proved and maintained**: `no-invented-values.test.ts` in both clients; the built-bundle tests prove no fixture session in a served build; `create-manager` holds no value. **Task 12 must not add a seeder under `src`**; its people exist only in test code |

**What else Phase 0 owes before it can close**, beyond PHASE0-012a and 012b:

- The fresh-clone run above.
- The browser-clients ADR, at least written and proposed (question 8).
- The owner's Safari check and NFR-5 look (*For the owner* 1).
- A reading of ROADMAP's Phase 0 line "PIN authentication and the inline manager-approval prompt
  (FR-A2, A6)". Phase 0 ships the approval primitive, its HTTP adapter and its route-level proofs
  through a test-only probe, and **no approval route** (ARCH-013 item 5); the served POS's approval
  prompts are stand-ins that verify nothing (owner, 2026-10-13). I found no owner ruling that this
  satisfies the roadmap line. It goes to the owner as a reading to confirm (*For the owner* 2).

---

## 8. The commissioned browser-clients ADR

Authority: DECISIONS 2026-10-13 (commission one ADR, Proposed, on the browser clients and what is
served to them, taking in ARCH-012's sessions-over-HTTP ADR); ARCH-014 *For the owner* 3; ADR-010
*Not decided here*.

**Task 12 does not depend on the ADR.** Every rule 012 needs is already binding: ADR-010 for the
origin and the guard, ADR-009 for the back-office credential, ARCHITECTURE §14.3 and §14.4 for
Playwright against the one-origin shape and PostgreSQL time, and the task files and DECISIONS for
what 011a to 011d2 built.

**But the ADR should record what 012a settles, so 012a should land first.** The ADR's central
premise, a session held in an `HttpOnly; Secure; SameSite=Strict` cookie per audience on one
`localhost` origin, has so far been proved in a browser only by hand, once. 012a's case A2 makes it
an automated, repeatable fact in two engines, and the ADR can cite it rather than a hand check. The
ADR should also carry a short section amending ARCHITECTURE §14.3 and §14.4 with the harness's
standing rules, since they bind every later phase's browser tests: its own database and port; no
installed trust, `ignoreHTTPSErrors` and what it does and does not prove; reset by schema, never by
`DELETE`; people through the domain functions in test code; both clocks moved together; requests
made by the page; assertions on state and codes; no traces.

**Recommended order:** 012a → (the ADR, written as Proposed, and 012b in parallel) → the owner
accepts the ADR → the Phase 0 gate. The ADR can be commissioned the day 012a merges; nothing in
012b changes what it would say.

---

## 9. Anything else

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

---

## For the task file

### The split

PHASE0-012a (the harness and its premises), then PHASE0-012b (the acceptance tests). 012b depends
on 012a.

### PHASE0-012a: rules

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

### PHASE0-012a: interface

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

### PHASE0-012a: test cases

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

### PHASE0-012a: red proofs

A2: `sameSite: 'lax'` in `client-instance.ts`. A3: an inline `<style>` in `apps/pos/index.html`.
A4: the core sends `Content-Type: application/json` on a bodiless request (Fastify answers 400).
A5: the server started with a different `PIN_PEPPER` from the people's. A6: the two bundle roots
swapped in `defaultBundleRoots`. A1: the back office's requests aimed at another port. The
environment guard: `POS_E2E_DB_NAME=pos` makes the run refuse before connecting (a unit test of the
guard, under vitest, not Playwright). Each made, run, read, reverted.

### PHASE0-012a: acceptance beyond `npm run verify`

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

### PHASE0-012b: rules

Rules 5 to 10 of 012a apply. In addition: every test reads limits from the response or
`SESSION_POLICY`, never a literal; B11 drives two tabs deliberately and asserts only that tab 1
never shows or acts as B; no test drives two cookie-changing requests in one tab at once.

### PHASE0-012b: test cases

B1 to B11 as in question 5's table, in `e2e/tests/` files by subject: `throttle.spec.ts` (B1, B2),
`audience.spec.ts` (B3 to B5), `idle.spec.ts` (B6 to B8), `reauthenticate.spec.ts` (B9, B10),
`identity.spec.ts` (B11). The AC-18 scan runs in every test through the fixture, and one test in
each file asserts the scan found the credentials where they belong (in their own sign-in body), so
a scan that looks at nothing cannot pass.

### PHASE0-012b: red proofs

As in question 5's table, plus: the AC-18 scan with the logging line added to the POS login
handler. Each made, run, read, reverted.

### PHASE0-012b: acceptance beyond `npm run verify`

`npm run test:e2e:all` passes; the summary and every red proof's failure message are in the
Handoff; the 012a greps still empty.

### The Handoffs must carry forward

- For every later phase's browser tests: the fixtures, the reset, people through domain functions,
  both clocks, requests by the page, state and codes, no traces.
- For Phase 1: AC-32's POS half and AC-35's last sentence close in this harness, with the first
  deactivation and the first real form.
- For Phase 2: AC-27's second sentence, AC-19's approval class through a route, and M-1 driven for
  real; the approval stand-ins must not be driven as if they verified.

---

## For the lead

Not decisions for the owner, and not mine to edit.

1. **Before dispatching 012a, establish whether the builder's sandbox can run it**: launch the
   pinned Playwright Chromium headless, bind `127.0.0.1:8543`, and reach `127.0.0.1:5433`. Install
   the browsers on the host first (`npx playwright install chromium webkit` at the pinned version,
   once). If the sandbox cannot, decide before dispatch who runs the browser and makes the red
   proofs; do not discover it in the Handoff.
2. **The plan's Task 12 heading** already carries a superseded banner; 012a's task file should say
   in words that none of the plan's code is to be copied, as 011's did.
3. **From 012a on, a served check needs no real credential.** The 011d2 hand check used the
   owner's manager credential given in conversation; once the harness exists, served checks make
   their own people. A hand check that still needs the owner's own account is the owner's to run.
4. **The Phase 0 Definition of Done** (plan `:3752-3761`) needs three wording changes the plan's
   owner can make: add "and `npm run test:e2e:all` passes"; replace the B-12 grep with the tests
   that prove it; and say `POS_LISTEN_HOST` instead of `HOST`.
5. **Commission the browser-clients ADR the day 012a merges**, with the §14.3/§14.4 amendment of
   question 8 in its scope.
6. **Merge-time runs.** Add to the dispatch checklist the path list of question 6 that makes the
   lead run `test:e2e` before merging.
7. **`db/dev.env` gains one line** (`POS_E2E_DB_NAME=pos_e2e`); the file is builder-owned in past
   tasks, so 012a's `owns:` should include it.

---

## For the owner

Nothing here blocks PHASE0-012a. No boundary is touched. **No change to PRODUCT.md, PRD.md,
ROADMAP.md or BOUNDARIES.md is proposed, so there is no replacement wording to approve.**

1. **A short hand check at the Phase 0 gate, in Safari.** The harness runs Chromium, and WebKit as
   Playwright builds it, which its makers call close to Safari but not Safari. Your check of
   2026-10-13 is the only Safari evidence. I recommend you repeat it once at the gate, on a served
   build: sign in at both shells, let the harness's screenshots or your own eye confirm that they
   are two visibly different applications (NFR-5's phrase, which no machine can judge), and sign
   in again after the back office's idle (M-6). About ten minutes.
2. **A reading to confirm: Phase 0's "inline manager-approval prompt".** ROADMAP's Phase 0 list
   includes "PIN authentication and the inline manager-approval prompt (FR-A2, A6)". What Phase 0
   ships is the approval primitive, its HTTP adapter proved through a test-only route, and no
   production approval route (ARCH-013: a route that verifies a PIN with no action attached would
   be an approval of nothing); the prompts on the served POS are the stand-ins you accepted on
   2026-10-13. I recommend reading the roadmap line as met by that, with the route arriving with
   Phase 2's first gated command. If you would rather the roadmap said so, that is a wording change
   for the lead to draft; I propose none, because the line is satisfiable as it stands.

DONE
