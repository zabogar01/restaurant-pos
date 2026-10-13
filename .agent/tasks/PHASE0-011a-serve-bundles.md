---
id: PHASE0-011a
title: The server serves the two client bundles, and an error outside /api is plain text
category: feature
touches: [boundaries]
depends_on: [PHASE0-010b]
owns: [apps/server/**, apps/pos/vite.config.ts, apps/pos/package.json, apps/pos/test/**, package.json, package-lock.json]
status: active
cycles: 1
---
# PHASE0-011a — The server serves the two client bundles

**Written** 2026-10-13 by the lead, from the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, by `architect14`, 2026-10-13), which supersedes plan
Task 11. **Do not copy anything from plan Task 11** (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md`):
the consult found that almost none of it matches what is built. This is the first of four slices
(011a to 011d). It touches the HTTP boundary of ADR-010, so the owner looks before merge. The
consult's binding sections are copied below **verbatim**, with their headings moved down one level;
the numbered "questions" they refer to are the consult's sections, and where a copied section
mentions 011b, 011c or 011d, that is later work and not this task's.

## Objective

Today the server answers only under `/api`, and a browser has nowhere to load either client from.
When this task is done, the one Fastify server serves the POS bundle at `/pos/` and the back-office
bundle at `/back-office/` from each client's own `dist/`, resolved from a server source file and
never from `process.cwd()`; client-side paths fall back to their own bundle's `index.html`, a missing
asset is never answered with HTML, an unbuilt bundle answers a fixed 503, and every bundle response
carries the exact cache, content-security and other headers below, with no cookie and no database
query. The error handler stops sending the JSON envelope outside `/api`, as ADR-010 rule 1 requires.
The POS Vite config inlines no asset. A test builds the real POS config into a temporary directory and
proves the built HTML has no inline script, style or `data:` URI. The back office has no client yet,
so `/back-office/` answers the 503 until 011d.

## Required inputs

- **The consult's sections copied below** (question 2, and *For the task file* for 011a). They are
  the specification. The rest of the consult is context, not instruction for this task.
- **PHASE0-008a and 008b as merged** (their task files in `.agent/tasks/`, the Handoffs): `buildServer`
  and its options (`apps/server/src/http/server.ts`), the root `onRequest` Host check (`server.ts:76`),
  the API context with the origin, client-instance and session hooks (`server.ts:94-102`),
  `errorHandler`, `frameworkErrorHandler` and `notFoundHandler` with `isApiPath`
  (`apps/server/src/http/errors.ts`), `index.ts` (where the real server is built), the log rules
  (`http/log.ts`). Use `inject(app, …)` from `test/support/request.ts`, never `app.inject`, or the
  Host check refuses the request.
- **PHASE0-009a's** `config.access` startup refusals (`http/access.ts:88-94` refuses an access
  declaration outside the API context).
- **The POS client's build:** `apps/pos/vite.config.ts` (its comment at `:4-6` is stale and is
  replaced), `apps/pos/package.json`, the root `package.json` (workspaces and scripts), and
  `.gitignore` (`dist/` is already ignored).
- **Contract:** ADR-010 (its six rules, and *Not decided here*, which the consult now decides);
  `docs/ARCHITECTURE.md` §3.1 and §14.4; PRD NFR-1 and NFR-5; `docs/BOUNDARIES.md` B-11, B-12, B-24.
- **Library facts** the consult took from the librarian: `@fastify/static` 10.1.6 is the major for
  Fastify 5; Vite 8's `import.meta.env.DEV` follows `NODE_ENV`. For anything else, ask:
  `.agent/bin/ask.sh librarian "<question>"`.
- **LESSONS:** PostgreSQL's `now()` is the transaction's start time. This task should need no SQL.

## From ARCH-014, question 2: serving the bundles (verbatim; binding)

### 2. Serving the bundles

Authority: ARCHITECTURE §3.1 and §14.4; ADR-010 rules 1, 3 and 6 and its *Not decided here* ("what
is served outside `/api`: the bundles, their fallback, cache headers and a content security
policy"), which this section decides for the task file.

#### Where the build output lives

Each client builds into its own package: `apps/pos/dist` and `apps/back-office/dist`. This is
Vite's default, so no `outDir` and no `emptyOutDir` are configured; `dist/` is already in
`.gitignore`; and the output is emptied on every build because it is inside the project root. The
plan's `apps/server/public/<client>` loses on each count: it is outside the root, so Vite will not
empty it without a flag and warns; it needs a new ignore entry; and it makes one package write
into another's tree. The stale comment at `apps/pos/vite.config.ts:4-6` is replaced by one line
saying the server reads this `dist/`.

`build.assetsInlineLimit` is set to `0` in both Vite configs, so no asset is ever inlined as a
`data:` URI and the policy below needs no `data:` source.

#### The root is anchored to a file

A new module, `apps/server/src/http/bundles.ts`, resolves the two directories from its own
location (`new URL('../../../pos/dist/', import.meta.url)` and the back-office equivalent), never
from `process.cwd()`. The server runs from source through `tsx`, so that file's position in the
tree is stable. `buildServer` gains an optional `bundles?: { pos: string; backOffice: string }` of
absolute directories. **Omitted means nothing is served outside `/api`**, exactly as an omitted
`tls` means the instance cannot listen: an in-process test never depends on whether someone has
run a build. `index.ts` passes the anchored defaults. Tests pass temporary directories they
create.

The bundle routes register on the root instance, outside the API context, and declare no
`config.access` (`access.ts:88-94` already refuses one there).

#### What each path answers

| Request | Answer |
|---|---|
| `GET /pos/`, `GET /pos/index.html` | 200, the POS `index.html` |
| `GET /pos/assets/<file>` that exists | 200, the file |
| `GET /pos/<anything else>` where the last segment has no dot and the path is not under `/pos/assets/` | 200, the POS `index.html` (the fallback) |
| `GET /pos/assets/<missing>`, or any missing path whose last segment has a dot | plain-text 404 |
| `GET /pos` | 302 to the constant `/pos/` |
| The same five rows for `/back-office` | the same, from the back-office bundle only |
| Any request that would be answered with an `index.html` that does not exist | plain-text 503, a fixed sentence naming the command to run |
| Any other method under either prefix | plain-text 404 |
| `GET /`, `GET /favicon.ico`, anything else outside `/api` | plain-text 404, as now |

Reasons, where the row is not obvious:

- **The fallback is needed** because the POS routes by `pushState` (`PosRoutes.tsx:40-46`):
  reloading `/pos/floor` must return the application, not a 404.
- **The fallback never answers a missing asset.** A missing hashed script answered with 200 and
  HTML fails in the browser as a syntax error far from its cause, and is cached. The rule is by
  shape (under `assets/`, or a dot in the last segment), not by an `Accept` header, because a
  header is something a client chooses.
- **The fallback never crosses bundles** and is never registered as a root catch-all: each prefix
  falls back to its own `index.html`, so no path under `/api` and no path outside the two prefixes
  can ever receive HTML. ARCH-010 promised Task 11 "no catch-all route to fight"; Task 11 does not
  add one.
- **The server holds no list of client paths.** NFR-5 gives each client its own route manifest. An
  unknown path under a prefix is the client's to draw.
- **The redirect's `Location` is a constant in source**, never built from the request.
- **Not built is 503, checked per request.** `@fastify/static` only warns when its root is
  missing, and would then answer a plain 404 that tells nobody anything. A fixed body such as
  `The POS client has not been built. Run: npm run build -w apps/pos` is wording from source with
  no value from the request, which ADR-010 rule 1 allows outside `/api`. Checking per request
  rather than at startup means a bundle built after the server started (the watch loop of
  question 3) is served without a restart. The server still starts without a bundle, so API work
  and in-process tests need none, and it logs one fixed warning line per missing bundle at
  startup. In 011a the back-office bundle does not exist yet, so `/back-office/` answers this 503
  until 011d; that is correct and should be said in the Handoff.

`dotfiles` is set to refuse (the plugin's default is `'allow'`), `redirect` stays `false`, and
`index` stays `index.html`.

#### Headers

On every response from a bundle route, a hit, a miss or the 503:

- **`Cache-Control`.** `no-cache` on `index.html` and on every fallback response, so a rebuilt
  bundle is picked up on the next load while the entity tag still saves the transfer.
  `public, max-age=31536000, immutable` on files under `assets/`, which are content-hashed.
  `no-cache` on anything else in the bundle root. `no-store` on the 404, the 503 and the redirect.
- **`Content-Security-Policy`**, exactly:
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
  There is no `unsafe-inline`, no nonce and no `data:`. Vite's built HTML has no inline block,
  Frost names system fonts only (`frost.css:44`), the icons are inline SVG elements, and the one
  `style={{}}` prop in the POS (`SettlementScreen.tsx:489`) is a CSSOM write. `form-action 'none'`
  is deliberate: no form in either client is ever submitted by the browser, and this makes a
  sign-in form that lost its handler unable to put a password in a URL.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Cross-Origin-Resource-Policy: same-origin`.
- **Never** `Strict-Transport-Security` (ADR-010 rule 6), never an `Access-Control-*` header
  (rule 4), never `Set-Cookie`. No security-header plugin is installed on its defaults; the
  headers are set by hand in `bundles.ts`.

A policy violation is visible only in a real browser. 011a's test asserts the header's exact
value; Task 12 asserts that neither shell raises a `securitypolicyviolation` event.

#### The guards and the cookies

- **The Host check already covers bundles**: it is a root `onRequest` hook (`server.ts:76`). A
  test proves it for `/pos/` and for an asset.
- **The same-origin check does not apply to bundles, and must not.** It lives in the API context
  (`server.ts:94`). A bundle request is a navigation, often with `Sec-Fetch-Site: none` or
  `cross-site` (a bookmark, a link), and it reads and writes nothing.
- **`rpos_cid` is neither issued nor read on a bundle request.** FR-A7's first contact is the
  first API request (owner, 2026-10-08). The browser sends the cookie because its path is `/`; the
  server ignores it. The two session cookies are scoped to `/api/pos` and `/api/back-office` and
  are never sent with a bundle request at all.
- **A bundle request touches no database.** With PostgreSQL stopped, both shells still load, and
  then say the system is unavailable (question 4). A test proves it by counting `client_instance`
  rows before and after.

#### An error outside `/api` is not the envelope

ADR-010 rule 1: "Outside `/api` an error or a miss is not the envelope (a bundle path is not an
API), but it obeys the same prohibition." The built `notFoundHandler` branches on the path
(`errors.ts:93-98`). The built `errorHandler` does not (`errors.ts:74-90`): a refused Host, the
closing 503 and an absolute-form target each send `{ "error": { "code": … } }` whatever the path.
Until now nothing lived outside `/api`, so nothing showed it.

011a makes `errorHandler` branch as the not-found handler does. Outside `/api` it sends
`text/plain` with fixed wording chosen by status, `Cache-Control: no-store`, and nothing from the
request or the exception. For the refused Host the sentence should name the server's own origin,
a value from configuration, for example `This application answers only at https://localhost:8443.`
ADR-010's consequences already ask that the `127.0.0.1` refusal "be said wherever the address is
documented", and this is the one place a person who typed it will look. `frameworkErrorHandler`
is unchanged: the ADR says those are the envelope "whatever the path", because a path that could
not be parsed cannot say which surface it belongs to.

#### `npm run verify`

- `apps/server` depends on `@fastify/static` `^10`.
- Root scripts gain `build:clients` (the POS in 011a; the back office is appended in 011d) and the
  POS gains `build:watch` (`vite build --watch`).
- `typecheck` gains `tsc -p packages/api-client` in 011c and `tsc -p apps/back-office` in 011d.
- The proof that a real build has the properties the policy assumes is a test that **makes its own
  build from the real Vite config into a temporary directory** (a child process, so vitest's
  `NODE_ENV` does not leak into it) and reads the output. It never reads a `dist/` someone left
  behind, and it fails rather than skips when the build fails. `verify` therefore needs no build
  step of its own and its order does not change.

## From ARCH-014, For the task file: PHASE0-011a (verbatim; binding)

#### PHASE0-011a: rules

1. Bundles are served from `apps/pos/dist` and `apps/back-office/dist`, resolved from
   `bundles.ts`' own location. `process.cwd()` appears nowhere in `src/http`.
2. `buildServer({ bundles })` is optional; omitted, nothing is served outside `/api`.
3. Bundle routes are registered on the root, outside the API context, with no `config.access`.
4. The answers are the table in question 2. The fallback is per prefix, `GET` and `HEAD` only,
   and never for a path under `assets/` or one whose last segment has a dot.
5. The headers are those of question 2, set by hand. No security-header plugin.
6. No bundle response sets a cookie, reads one, or touches the database.
7. `errorHandler` sends plain text outside `/api`: fixed wording by status, `no-store`, nothing
   from the request or the exception. `frameworkErrorHandler` is unchanged.
8. Both Vite configs set `assetsInlineLimit: 0`. No `outDir`.
9. Handlers write no error body under `/api`; that rule is untouched.

#### PHASE0-011a: interface

```ts
// apps/server/src/http/bundles.ts
export interface BundleRoots { pos: string; backOffice: string } // absolute directories
export function defaultBundleRoots(): BundleRoots;
export function bundleRoutes(roots: BundleRoots): FastifyPluginAsync;

// apps/server/src/http/server.ts
export interface BuildServerOptions { /* … */ bundles?: BundleRoots }
```

Files: `apps/server/src/http/bundles.ts` (new), `server.ts`, `errors.ts`, `index.ts`,
`apps/server/package.json`, `apps/pos/vite.config.ts`, `apps/pos/package.json`, root
`package.json`, `apps/server/test/bundles.test.ts` (new), `apps/pos/test/built-bundle.test.ts`
(new), and the existing server tests that assert an envelope outside `/api`, if any.

#### PHASE0-011a: test cases

With two temporary bundle directories, each holding an `index.html` and one hashed asset:

1. `GET /pos/` is the POS `index.html`, `text/html`, `Cache-Control: no-cache`.
2. `GET /pos/assets/<hashed>` is the file, `public, max-age=31536000, immutable`.
3. `GET /pos/floor` and `GET /pos/closed-orders` are the POS `index.html`, `no-cache`.
4. `GET /pos/assets/missing.js`, `GET /pos/missing.js` and `GET /pos/favicon.ico` are plain-text
   404, never HTML, `no-store`.
5. `GET /back-office/anything` is the back-office `index.html` and never the POS one (the two
   fixtures differ by a marker).
6. `GET /pos` is 302 with `Location: /pos/`.
7. `POST /pos/` is a plain-text 404.
8. `GET /`, `GET /other` are plain-text 404; `GET /api/missing` is still the envelope.
9. With the POS directory missing or without an `index.html`: `GET /pos/` and `GET /pos/floor`
   are 503, plain text, the fixed sentence, `no-store`; the back office still serves.
10. A bundle built into the directory after the server was built is served without a rebuild of
    the server.
11. Traversal: `/pos/../package.json`, `/pos/..%2f..%2fpackage.json`, `/pos/%2e%2e/%2e%2e/db/dev.env`
    and a dotfile placed in the bundle directory each return no file content.
12. Every response in cases 1 to 9 carries the exact policy of question 2, `nosniff`,
    `no-referrer` and `same-origin`, and carries no `Strict-Transport-Security`, no
    `Access-Control-*` and no `Set-Cookie`.
13. `Host: 127.0.0.1:<port>` on `/pos/` and on an asset is 403 plain text, with no envelope.
14. A bundle request with `Sec-Fetch-Site: cross-site` is served (the origin check is not applied).
15. Across cases 1 to 5 the `client_instance` row count does not change, and with the pool pointed
    at a closed port the same cases still pass.
16. With `bundles` omitted, `GET /pos/` is a plain-text 404.
17. The log scan gains a marker in a bundle URL's query string; it appears in no log line.
18. The built bundle (the test's own build of the real POS config): `index.html` has no inline
    script, no inline style and no event-handler attribute; every `src` and `href` begins
    `/pos/assets/`; no emitted file contains a `data:` URI.

#### PHASE0-011a: red proofs

- Root the bundles at `process.cwd()` and run the tests from another directory: case 1 fails.
- Let the fallback answer every miss: case 4 fails.
- Register the fallback on the root: case 8 fails.
- Remove the path branch from `errorHandler`: case 13 fails.
- Add a security-header plugin on its defaults: case 12 fails on HSTS.

#### PHASE0-011a: acceptance beyond `npm run verify`

**The browser check, by the lead or the owner, before 011c is dispatched.** Open
`https://localhost:8443/pos/` in Chrome and in Safari, click through the warning once, and
confirm in the developer tools that (a) the page loads with no policy violation in the console,
(b) `GET /api/health` from that page answers 200, and (c) after any API request `rpos_cid` is
stored with `Secure`, `HttpOnly` and `SameSite=Strict` and is sent again after a reload. If (c)
fails in either browser, stop: every session in this design depends on it, and it comes back to
the architect.

## From ARCH-014, The Handoffs must carry forward (verbatim)

#### The Handoffs must carry forward

- For Task 12: the accessible names and the two data attributes; `build:clients`; the four things
  it does not have (question 10); the outcome of the browser check.
- For Phase 1's first form: it mounts inside the keyed working area and inherits M-6; AC-35's
  last sentence closes there, in a browser.
- For Phase 2's first command: add it to the route table as interactive; the POS will not compile
  until its API module declares it; delete the stand-in in the same task; M-1's three changes in
  question 8; the "certainly not applied" against "unknown" question of ARCH-012 §5 is still open
  and rule 7 does not answer it.
- For every later client screen: one request path; switch on the code; no copy without the
  designer; no fixture in a served build.

## Lead rulings

These rulings are addressed to the builder.

1. **Files.** Those listed under *PHASE0-011a: interface* above. Tests in a new
   `apps/server/test/bundles.test.ts` (cases 1 to 17) and a new `apps/pos/test/built-bundle.test.ts`
   (case 18), each test name starting with the consult's case number. You may split
   `bundles.test.ts` if the Handoff says why.
2. **The back office has no client yet.** Rule 8 applies to the POS Vite config only; 011d gives the
   back office its own. The root `build:clients` script builds the POS only; 011d appends the back
   office. With the real defaults, `/back-office/` answers the not-built 503 until 011d. Say so in the
   Handoff. The tests use two temporary directories, so every back-office case is still proved.
3. **Case 18 builds the real POS config in a child process** into a temporary directory and fails,
   never skips, when the build fails. It must not read a `dist/` left behind. Report in the Handoff
   how long it adds to `npm run verify`. If the POS test environment (jsdom) gets in the way, give
   that one file the node environment by the means vitest provides, and say which.
4. **The three fixed sentences** (the not-built 503 per bundle, the refused Host 403, and the
   statuses `errorHandler` can produce outside `/api`) are wording in source with no value from the
   request. The 403 names the server's own origin from configuration, as the consult suggests.
   Quote each one in the Handoff. They are server text for a person who typed the wrong address, not
   screen copy, and the designer may revise them later.
5. **The consult's three unverified points** (whether a second `@fastify/static` registration needs
   `decorateReply: false`; whether a not-found handler set in a child context is used when set after
   the plugin; whether a `POST` with no `Content-Type` and no body is routed) are settled by your
   tests, not by assumption. Say in the Handoff what you found.
6. **Out-of-`/api` assertions that change** (the explorer found them): in
   `apps/server/test/origin.test.ts`, case 11's refused Host on `/nope` and `/` (lines 62-85), and the
   absolute-form target's "outside miss" row (lines 254-265). Outside `/api` each now expects plain
   text by rule 7, with the same status and `no-store`; their `/api` rows are unchanged. In
   `apps/server/test/log-scan.test.ts`, case 17 adds a bundle URL with a marker, and case 22's "every
   error body is exactly the envelope" is narrowed to responses under `/api`. Nothing else in those
   files changes.
7. **`apps/pos/src` is not touched.** No client source changes in this task.
8. **The browser check under *acceptance beyond verify* is not yours.** The lead or the owner makes it
   after this task merges. Do not try to drive a browser.
9. **The owner's rulings on ARCH-014 (2026-10-13) do not change this task.** The ADR the owner
   commissioned will record what this task builds; build to the consult.
10. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
11. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you
    observed. Do not work around a rule.
12. **The database is already up** (`restaurant-pos-db-1` on port 5433, shared by every worktree). Do
    not run `npm run db:up` or `docker compose` in this worktree.

## Constraints

- ADR-010: no `Strict-Transport-Security` (rule 6), no `Access-Control-*` (rule 4), the Host check
  unchanged, the same-origin check not applied to bundles, `frameworkErrorHandler` unchanged.
- B-12 and the log rules: nothing from a bundle request's query string reaches a log line. The path may be
  logged, as ADR-010 rule 2 allows and as `/api` paths already are (corrected by the lead in round 2; the
  first wording said "URL or query", which went beyond the consult's case 17).
- FR-A7 (owner, 2026-10-08): a bundle request neither issues nor reads `rpos_cid`.
- NFR-5: no route list of client paths on the server; each prefix falls back only to its own bundle.
- No security-header plugin; no catch-all route on the root.

## Tests expected to change

- `apps/server/test/origin.test.ts`: the two outside-`/api` rows in lead ruling 6 only.
- `apps/server/test/log-scan.test.ts`: case 17's addition and case 22's narrowing, lead ruling 6.
- `apps/server/test/server.test.ts` cases 16 and 31 (plain 404 outside `/api`) must stay green
  **unchanged**: those paths are outside both prefixes.
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline.
   **Baseline (lead, 2026-10-13):** `development` at `91f79bc` (code identical to `e52d0a4`), 66 test
   files and 3252 tests, green.
2. Each new test file alone is green three times in a row; the Handoff maps each case number (1 to 18)
   to its test name.
3. Every red proof above made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rn "process.cwd" apps/server/src` (nothing in `src/http`);
   `grep -rniE "strict-transport|helmet|access-control" apps/server/src` (nothing);
   `grep -rn "setCookie\|Set-Cookie" apps/server/src/http/bundles.ts` (nothing).
5. By hand, with `npm run build:clients` and `npm run dev -w apps/server`, the Handoff shows `curl -k`
   output (status line and headers) for `https://localhost:8443/pos/`, `/pos/floor`, one asset,
   `/pos/missing.js`, `/back-office/` (the 503) and `/`.
6. The Handoff carries forward the items under *The Handoffs must carry forward* that concern 011a,
   and says what 011c (the POS signs in) needs from this task that it does not have.

## Out of scope

- `SessionView`, the route table, `X-RPOS-CSRF` as a constant (011b).
- `@pos/api-client`, any change under `apps/pos/src`, the fixture switch (011c).
- `apps/back-office` (011d). The browser check. The browser harness (Task 12).
- `docs/` of any kind, the ADR, ARCHITECTURE §3.2.

## Round 2 — the review's two findings (lead rulings, 2026-10-13)

The review is `.agent/reviews/PHASE0-011a-review.md` (Codex, two medium findings). These rulings are
addressed to the builder.

1. **Finding 1 is accepted: fix it.** A refused request on the bare prefixes (`GET` and `HEAD` of
   `/pos` and `/back-office`, refused by the inherited Host check) must carry the same policy headers
   as every other bundle response: `Content-Security-Policy`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Cross-Origin-Resource-Policy`, with `no-store`. Do it without adding those headers
   to any response outside the two prefixes or under `/api`. Extend case 12 or 13 to refused `GET` and
   `HEAD` on both bare prefixes and both slash forms, and show the new assertions failing before the fix.
2. **Finding 2 is not a defect in the code; the task's wording was wrong.** The constraint said nothing
   from a bundle request's "URL or query" may reach a log line. The consult's case 17 asks only for the
   query, and ADR-010 rule 2 allows path-only logging, which is how `/api` paths are already logged. The
   lead has corrected the constraint above. Make no logging change. Do not add a path marker to the log
   scan.
3. **Acceptance criterion 2, as written:** run `apps/server/test/bundles.test.ts` alone three times in a
   row and `apps/pos/test/built-bundle.test.ts` alone three times in a row, and show each result. The
   first round ran them together.
4. Everything else in the first round stands. Append a *Round 2* section to the Handoff (do not rewrite
   round 1), commit on this branch after `npm run verify` is green, and end the Handoff with DONE or
   BLOCKED as before.

## Handoff

### What I did

The server now serves the POS bundle at `/pos/` and the back-office bundle at `/back-office/`, each from its own client package's `dist/`, as ARCH-014 question 2 specifies. The work is one commit on `agent/phase0-011a` (hash in `git log`; it is the commit that contains this Handoff).

New: `apps/server/src/http/bundles.ts` (`BundleRoots`, `defaultBundleRoots()`, `bundleRoutes(roots)`, and the exported `CONTENT_SECURITY_POLICY` constant), `apps/server/test/bundles.test.ts`, `apps/pos/test/built-bundle.test.ts`.

Changed: `apps/server/src/http/server.ts` (optional `bundles`, registered on the root outside the API context, no `config.access`), `apps/server/src/http/errors.ts` (see below), `apps/server/src/index.ts` (passes `defaultBundleRoots()`), `apps/server/package.json` and `package-lock.json` (`@fastify/static` ^10, installed 10.1.6), `apps/pos/vite.config.ts` (`build.assetsInlineLimit: 0`, stale comment replaced by one line, no `outDir`), `apps/pos/package.json` (`build:watch`), root `package.json` (`build:clients`, the POS only for now).

### How it is built, and what I decided

- **One registration of `@fastify/static`, with `serve: false`.** It is used only for its `reply.sendFile(file, root)` decorator; every route is my own, because the plugin's own routes cannot check existence per request, cannot choose `Cache-Control` per path class, and would answer an unbuilt bundle with a bare 404. This settles the consult's first unverified point: with a single registration there is no second one, so `decorateReply: false` never arises. `cacheControl: false`, `dotfiles: 'deny'`, `redirect: false`.
- **Each prefix is an encapsulated child plugin** (`prefix: '/pos'`, `'/back-office'`) holding one `GET /*` route, its own `setNotFoundHandler` and its own `setErrorHandler`. A route `GET /pos` (the 302, constant `Location`) sits beside it. There is no route on the root that is not under one of the two prefixes. Settles the second unverified point: a not-found handler set inside a prefixed child *is* used for misses and other methods under that prefix (test 12 "wrong method", test 7), and the root handler keeps answering everything else.
- **Third unverified point:** a `POST` with no `Content-Type` and no body under a prefix is routed and answered with the plain-text 404 (test 7). A POST with a body and a content type is not special-cased by me; it falls to the same not-found handler or to the error handler (plain text outside `/api`).
- **Classification is by shape** (`classify` in `bundles.ts`): `''` or `index.html` is the index; anything whose first segment is `assets` or whose last segment contains a dot is a file lookup (miss is a 404); any segment starting with a dot, a NUL or a backslash is a 404 before the file system is touched; everything else is the fallback index. Existence of the file and of `index.html` is checked with `stat` on each request.
- **The bundle's error handler wraps the root's:** it sets the policy headers and then calls the inherited handler, so a refused Host under `/pos/` is plain text *with* the policy headers.
- **Startup:** one fixed `warn` line per bundle whose `index.html` is missing (`the POS bundle is not built`), via `app.log.warn`. Verified in the real server's output: `the back-office bundle is not built`.

`errors.ts`: the old `errorHandler` is now `errorHandlerFor(origin)`, a factory, because the refused-Host sentence must name the server's own origin and the handler had no access to it. `server.ts` passes `own.origin`. Under `/api` nothing changes. Outside `/api` it sends `text/plain`, `Cache-Control: no-store`, wording fixed by status. `isApiPath` now also strips an absolute-form target's scheme and authority before classifying, because Fastify keeps the whole `https://host/path` as `request.url` and, without this, an absolute-form request to `/api/health` would have been classified as outside `/api` and lost its envelope, which the unchanged `/api` rows of `origin.test.ts` would have caught. `frameworkErrorHandler` is unchanged.

### The fixed sentences (ruling 4), quoted

- Not-built 503, POS: `The POS client has not been built. Run: npm run build -w apps/pos`
- Not-built 503, back office: `The back-office client has not been built. Run: npm run build -w apps/back-office`
- Refused Host, 403 outside `/api`: `This application answers only at https://localhost:8443.` (the origin is the configured one; test uses `TEST_ORIGIN`)
- Other statuses outside `/api`: 400 `Bad Request`, 404 `Not Found`, 413 `Payload Too Large`, 415 `Unsupported Media Type`, 500 `Internal Server Error`, 503 `Service Unavailable`; any other 4xx `Request failed`, any other 5xx `Internal Server Error`.
- Bundle miss: `Not Found`.

### Tests

Counts: `npm run verify` is green, **68 test files, 3335 tests**, against the baseline of 66 files and 3252 tests (+2 files, +83 tests). Typecheck is clean. `built-bundle.test.ts` makes a real Vite build in about 0.1 s (Vite 8 is fast), so it adds well under a second to `verify`; its `beforeAll` allows 180 s. It builds with `process.execPath` running Vite's own `bin/vite.js` with `--outDir <tmp> --emptyOutDir` and `NODE_ENV=production`, so no `dist/` is read. The POS client test project already runs in the node environment by default (jsdom is selected per file), so no environment override was needed.

Each new file alone, three runs in a row: 83 passed each time (`bundles.test.ts` 80 and `built-bundle.test.ts` 3, run together).

**Case map** (names begin with the case number): 1 `where the bundles are` (two tests: default roots independent of the working directory; no `process.cwd()` under `src/http`) and `what each path answers` (GET and HEAD of `/pos/` and `/pos/index.html`); 2 asset immutable and root file no-cache; 3 fallback (`/pos/floor`, `/pos/closed-orders`, a deep path, a trailing slash); 4 misses (`/pos/assets/missing.js`, `/pos/missing.js`, `/pos/favicon.ico`, `/pos/assets`, `/pos/assets/`); 5 back office (index, its own asset, its own miss); 6 redirect for both prefixes, with a hostile query string; 7 POST/PUT/DELETE/PATCH and a body-less POST; 8 `/`, `/other` and others, and `/api/missing` still the envelope; 9 missing directory, directory without `index.html`, the back-office 503; 10 built after the server; 11 traversal (ten spellings) plus a raw TLS request line; 12 ten response kinds, plus the constant equals the spec string; 13 four wrong Hosts times three URLs; 14 five `Sec-Fetch-Site` values; 15 row count unchanged, and DB unreachable; 16 `bundles` omitted; 17 in `log-scan.test.ts` (marker `bundleQuery`, six bundle URLs); 18 three tests in `apps/pos/test/built-bundle.test.ts` (no inline script/style/handler; every `src`/`href` begins `/pos/assets/`; no `data:` URI in any emitted file).

**Existing tests changed** (only those ruling 6 named):
- `origin.test.ts` case 11: the refused Host's body expectation now branches on the URL: the envelope for `/api/…`, the origin sentence outside `/api`. Status and `no-store` unchanged. The absolute-form "outside miss" row was moved out of its `it.each` into its own test expecting 400, `Bad Request`, `text/plain`, `no-store`; its `/api` rows are unchanged.
- `log-scan.test.ts`: case 17's marker and six bundle requests added (the test server now has a temporary bundle directory); case 22's envelope check is narrowed to error responses whose URL starts `/api/`, and its title says so. Nothing else.
- `server.test.ts` cases 16 and 31 are untouched and green.

### Red proofs (each made, run, reverted)

1. `defaultBundleRoots().pos` changed to `join(process.cwd(), '../pos/dist/')`: case 1 failed twice (roots equal the expected paths; no `process.cwd` under `src/http`). Received `/private/var/folders/…/T/pos/dist/` after the test's `chdir`. Reverted.
   *Note:* the consult's wording ("run the tests from another directory: case 1 fails") assumes a test that uses the default roots. Tests pass explicit roots, so I added the two case-1 tests above, which exercise `defaultBundleRoots()` directly and change directory themselves; the proof needs no outside action.
2. Fallback answers every miss (a wrapper that turned every `file` into `index`): 9 failures in cases 2, 4, 5 and 9 (misses answered 200; the root `robots.txt` answered HTML). Reverted.
3. Fallback registered as a catch-all `GET /*` serving the POS index: 10 failures, cases 8 (six paths and `/api/missing` answered 200) and 11 (the dot-segment URLs answered 200). Reverted.
4. `errorHandlerFor` with `const api = true`: 12 failures, all case 13 (`application/json` instead of `text/plain`). Reverted.
5. A response header `strict-transport-security: max-age=15552000; includeSubDomains` added on every bundle response (standing in for a security-header plugin on defaults; `helmet` is not installed): 12 failures, case 12 for all ten response kinds and case 9's 503. Reverted.

The three greps (criterion 4), run at the end:
- `grep -rn "process.cwd" apps/server/src` prints only `apps/server/src/db/migrate.ts:68` (`process.env.INIT_CWD ?? process.cwd()`, the migration CLI, not `src/http`).
- `grep -rniE "strict-transport|helmet|access-control" apps/server/src`: nothing (a comment of mine matched at first and I reworded it).
- `grep -n "setCookie\|Set-Cookie" apps/server/src/http/bundles.ts`: nothing.

### By hand: `npm run build:clients`, `npm run start -w apps/server`, `curl -k` (criterion 5)

I used `start` rather than `dev` (the same program without `tsx watch`). Startup logged `the back-office bundle is not built` once. Common to every response below except `/`: `content-security-policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `cross-origin-resource-policy: same-origin`.

| Request | Status | Cache-Control | Content-Type |
|---|---|---|---|
| `/pos/` | 200 | `no-cache` | `text/html; charset=utf-8` |
| `/pos/floor` | 200 | `no-cache` | `text/html; charset=utf-8`, the same `etag` and length as `/pos/` |
| `/pos/assets/index-CoLhYheF.js` | 200 | `public, max-age=31536000, immutable` | `application/javascript; charset=utf-8` |
| `/pos/missing.js` | 404, body `Not Found` | `no-store` | `text/plain` |
| `/back-office/` | 503, body `The back-office client has not been built. Run: npm run build -w apps/back-office` | `no-store` | `text/plain` |
| `/` | 404, body `Not Found` | none (the not-found handler is unchanged and never set one) | `text/plain`, no policy headers |
| `Host: 127.0.0.1:8443` on `/pos/` | 403, body `This application answers only at https://localhost:8443.` | `no-store` | `text/plain` |

The server was stopped afterwards.

### Found and not fixed

- **`/` and other outside-prefix 404s carry no `Cache-Control`**, because `notFoundHandler` (unchanged, `server.test.ts` 16 and 31 pin it) never set one. The consult only requires `no-store` on the bundle routes' 404s, which they have. If a `no-store` on the root's 404 is wanted, it is a one-line change in `notFoundHandler` and a test change for those two cases; I did not make it.
- **`classify` treats any path under `assets/` as a file lookup**, so a directory (`/pos/assets/`) is a 404. A client route that began with the segment `assets` could never be a client route. NFR-5 gives the client its own route manifest, so this is a reserved word, worth saying in the ADR the owner commissioned.
- **A case-insensitive file system** (macOS default) will serve `/pos/Index.html` or `/pos/ASSETS/x.js`-style spellings from the same file: `stat` succeeds, and the file is inside the root, so nothing leaks. Only the cache class could differ. I did not add a case check.
- `@fastify/static` 10.1.6 pulls 19 packages into the lockfile (`package-lock.json` +243 lines). `npm install` warned about two packages' install scripts (`esbuild`, `fsevents`) not being covered by `allowScripts`; both were already present before this task.
- Fastify's `reply.sendFile` and an `ERR_STREAM_PREMATURE_CLOSE` (a client aborting a download) go to the child's error handler, which then calls the inherited root handler; I did not exercise that path.

### Carried forward

- **For 011c (the POS signs in) from this task:** the bundle is at `/pos/` with `base: '/pos/'`, so the client's API calls are same-origin `/api/...` and satisfy `connect-src 'self'`. The policy forbids any inline script or style, any `data:` URI, any other origin, and any form submit (`form-action 'none'`): the sign-in form must be handled by a JS handler, never a native submit. `build:clients` builds the POS only; 011d appends the back office. `build:watch` exists in the POS package. A bundle built while the server is running is picked up on the next request, so no restart is needed. `rpos_cid` is not issued or read by a bundle request, so the first `/api` request issues it (FR-A7). `errorHandlerFor` is outside-`/api` plain text, so any client that fetches a non-`/api` URL must not expect JSON. The `/back-office/` prefix answers the 503 until 011d.
- **For Task 12 (the browser harness):** `build:clients`, the exact policy string (exported as `CONTENT_SECURITY_POLICY`), the fact that the browser check under *acceptance beyond verify* is **not done**: I did not drive a browser. The lead or the owner must open `https://localhost:8443/pos/` in Chrome and Safari and confirm (a) no `securitypolicyviolation`, (b) `GET /api/health` 200, (c) `rpos_cid` stored `Secure; HttpOnly; SameSite=Strict` and resent on reload, before 011c is dispatched.
- **For the ADR the owner commissioned:** the choices above are what it should record: per-request existence check, the 503, the reserved `assets/` segment, the refused-Host sentence, and that `errorHandler` became a factory taking the origin.

### What the next agent needs and does not have

A real browser's verdict on the policy and on `rpos_cid` (the acceptance check above). The designer's wording for the three server sentences, if they are to become screen copy.

DONE