# ARCH-014 — Two client shells (plan Task 11)

Author: `architect14`, 2026-10-13. Read-only consult for PHASE0-011 (not yet written). Nothing was
edited except this report, and nothing was committed.

## Summary

**Plan Task 11 cannot be dispatched as written, and none of its code should be copied.** It
creates three things that already exist (`@pos/tokens`, the POS app, its PIN pad), signs the back
office in with a PIN (ADR-009 forbids it), reads a flat `{ code }` body the server never sends,
calls two mutating routes without the anti-CSRF token (both would answer 403), shows "Incorrect
PIN." for every failure including a 500, and serves the bundles from `process.cwd()`. The task is
also four reviewable slices, not one.

What PHASE0-011 must say instead, in order of weight:

1. **A retried request must never change who is acting.** The rule handed down from ARCH-012 is
   "on `CSRF_REFUSED`, read `me` once and retry once". With one cookie jar and two tabs, `me` can
   answer for a *different person* than the tab is showing. The retry is allowed only when `me`
   names the same `staffUserId` the tab already held; otherwise the tab's session is gone and
   nothing is retried (question 4). This is the one finding here that touches B-13.
2. **The server is the only clock.** `SessionView` does not carry what a countdown needs. It gains
   two numbers, `idleSeconds` and `idleRemainingSeconds`, the second computed by PostgreSQL. The
   client's countdown is a display reckoned from them; it never decides that a session has ended
   (question 6). This is a small server change and belongs in Task 11.
3. **Fixtures are chosen by the build command, in one place, and a test on the built bundle proves
   the fixture session is not in it.** `import.meta.env.DEV` is not a safe switch on its own: it
   follows `NODE_ENV`, so `NODE_ENV=development vite build` would ship a bundle that signs in as a
   fixture cashier (question 3).
4. **One transport core, shared; one instance per client.** The token handling, the retry rule of
   item 1 and the failure classification are security rules with no user interface. Two hand-kept
   copies would drift. I recommend a small package, `@pos/api-client`, which ARCHITECTURE §2.1
   permits ("authentication primitives"), and nothing in `@pos/contracts` but types, schemas, the
   header name and the route table (question 4).
5. **Bundles are served from each client's own `dist/`, by a path anchored to a server source
   file, with a fallback that never answers a missing asset with HTML**, `no-cache` on the HTML,
   `immutable` on hashed assets, a strict content security policy with no `unsafe-inline`, a
   fixed 503 when a bundle has not been built, no cookie, and no database query (question 2).
6. **The built error handler sends the JSON envelope outside `/api`; ADR-010 rule 1 says it does
   not.** Harmless while nothing was served there. It becomes visible the moment `/pos/` answers,
   so 011a corrects it (question 2).
7. **The copy belongs to the design documents (ADR-010 rule 1), not to the builder.** Two notices
   the POS already draws cannot be shown as drawn, because they print a count of attempts the
   server never reports, and ten codes have no drawn state on any screen (question 9).
8. **The back office is built now, without waiting for slice B**, as behaviour plus a provisional
   sign-in composed only from DESIGN-012's patterns. What it must not invent is listed
   (question 7).
9. **Task 11 changes nothing in `Approval.tsx`** (question 8).

No boundary is strained. **No change to PRODUCT.md, PRD.md, ROADMAP.md or BOUNDARIES.md is
proposed.** Three points go to the owner for acknowledgement; none blocks 011a or 011b.

**One correction to the brief.** It says `PosRoutes.tsx` "holds a fixture `session`" that must
"give way to the real one". It does not. The `session` at `PosRoutes.tsx:60` is a *payment*
session (`usePaymentSessions`, the tab-local tender draft of ARCHITECTURE §6.4). The POS client
has no actor session of any kind: every route is reachable by URL without signing in, and the
person shown is the literal `'Ana R. · Cashier'` (`floorFixtures.ts:100`,
`SettlementScreen.tsx:780`). Task 11 does not replace a session; it introduces one, above the
routes, and must leave the payment session exactly where it is (question 5).

## What I verified, and what I could not

Read in the worktree at `91f79bc`: plan Tasks 11 and 12; ARCHITECTURE; ADR-009 and ADR-010;
DECISIONS.md; BOUNDARIES; PRD §3A, NFR-1 to NFR-5 and the criteria named; SITEMAP and
SCREEN-INVENTORY for POS-01, POS-04, BO-01, BO-02, M-1 and M-6; DESIGN.md's open list and its
DESIGN-012 section; the three earlier consults' sections on serving, codes, M-6 and their notes
for the lead; the five Handoffs' notes for Task 11; `packages/contracts/src`; every file under
`apps/server/src/http`; `domain/session.ts`; and in `apps/pos`: `App.tsx`, `PosRoutes.tsx`,
`PinPad.tsx`, `Approval.tsx`, `approvalFixtures.ts`, `fixtures.ts`, `main.tsx`, `index.html`,
`vite.config.ts`, the settlement screen's re-authentication modal, and the tests
`pin-pad.test.tsx`, `console-free.test.ts` and `no-invented-values.test.ts`.

Library facts came from the librarian (three questions, 2026-10-13), not from recall:

- `@fastify/static` 10.1.6 is the major that declares Fastify 5. A missing `root` only logs a
  warning. A miss calls `reply.callNotFound()`. `setHeaders(reply, path, stat)` runs after the
  defaults and can override `Cache-Control` per file. `dotfiles` defaults to `'allow'`.
  `redirect` defaults to `false`, so `/pos` is a miss. `reply.sendFile(path, root, options)`
  exists.
- Vite 8: built HTML has no inline script or style; assets are content-hashed under `assets/`;
  `index.html` is not hashed; `import.meta.env.DEV` is replaced statically and **follows
  `NODE_ENV`, not `--mode`**; `vite build --watch` exists; an `outDir` outside the project root is
  not emptied by default.
- React 18 writes a `style={{}}` prop through the CSSOM, which a content security policy does not
  block; it creates no `<style>` element.
- Fastify 5 answers 400 to a `Content-Type: application/json` request with an empty body.
- `fetch` sends `Origin` on a same-origin `POST` and not on a `GET`; `Sec-Fetch-Site` is sent by
  Safari from 16.4.

**Not verified, and each rule below is written so a test or a browser check settles it:**

- Whether Chrome and Safari store a `Secure` cookie after a self-signed certificate's warning is
  clicked through. The librarian found no source. PHASE0-008b's Handoff already recorded this
  check as not made, and **no Phase 0 task has yet used a browser**. Every session in this design
  rests on it, so it is 011a's first acceptance step, before 011c is dispatched.
- Whether a second `@fastify/static` registration strictly needs `decorateReply: false`, and
  whether a not-found handler set in a child context is used when set after the plugin.
- Whether Fastify routes a `POST` with no `Content-Type` and no body. The server's own tests call
  `activity`, `release` and `logout` that way through `inject`, so I believe it does; a browser
  proves it in Task 12.

I ran no test and no build. This is a read-only consult.

---

## 1. Plan Task 11 against what is built and decided

### What is right and stays

Two independently built bundles at `/pos/` and `/back-office/`, served by the one Fastify server
from the one origin ("no CORS, one certificate, one CSRF model"). That is NFR-1, NFR-5 and
ARCHITECTURE §2, and nothing else in the task survives.

### Every plan line to drop or change

| Plan lines | What it says | Verdict |
|---|---|---|
| `:3023`, `:3032-3074` (Step 1) | Create `packages/tokens` with a `tokens` object | **Drop.** `@pos/tokens` exists and exports only `./frost.css`. There is no `src/index.ts` and no JavaScript token object |
| `:3024`, `:3076-3141` (Steps 2, 3) | Create `apps/pos`, its manifest, Vite config, `index.html`, `main.tsx` | **Drop.** All exist. The plan's versions (Vite 5, plugin-react 4) are behind the built ones (Vite `^8.3.0`, plugin-react `^6.1.1`); the back office takes the built ones |
| `:3104`, `:3308` | `build.outDir: '../server/public/<client>'`, `emptyOutDir: true` | **Change.** Each client builds into its own `dist/` (question 2) |
| `:3143-3203` (Step 4) | A `PinPad` holding the PIN in React state, with `data-testid` keys and inline pixel values | **Drop.** The built `PinPad.tsx` keeps digits in a ref and is held to B-12 by `pin-pad.test.tsx`. Inline values break `no-invented-values.test.ts` |
| `:3149`, `:3211`, `:3349`, `:3391` | `import { tokens } from '@pos/tokens/src/index.js'` | **Drop.** No such module |
| `:3205-3278` (Step 5) | A POS `App` that fetches login and release | **Rewrite** (questions 4 to 6). Line by line: `:3222-3226` sends no schema-checked body; `:3229` trusts `res.json()` as the actor; `:3232-3237` reads a flat `body.code` and `body.retryAfterSeconds` where the server sends `error.code` and `error.details.retryAfterSeconds`, and maps every other failure, a 500 included, to "Incorrect PIN."; `:3241` posts `release` without `X-RPOS-CSRF` and is refused 403; `:3248` sets `system-ui` where Frost names the type |
| `:3025`, `:3280-3341` (Step 6) | Create `apps/back-office` | **Keep the idea, rewrite the files** to match the POS's built configuration |
| `:3343-3385` (Step 7, form) | A "Manager PIN" field at the back office | **Drop. ADR-009 §1:** a PIN is never accepted there. Username and password |
| `:3400-3420` | Posts `{ pin }`; maps `FORBIDDEN` to "The back office is for managers." | **Drop.** The route takes `{ username, password }`. The sign-in never answers `FORBIDDEN`: a non-manager is `INVALID_CREDENTIALS`, by design (ARCH-012 §5) |
| `:3422-3425` | `logout` without the token | **Change.** Refused 403 as built |
| `:3460-3482` (Step 8) | Two `@fastify/static` registrations rooted at `join(process.cwd(), …)`, "after the route registrations" | **Rewrite** (question 2). The root depends on where the process was started; there is no fallback, no cache policy, no content security policy, no answer for an unbuilt bundle |
| `:3484-3495` (Step 9) | `PIN_PEPPER=… npm run dev -w apps/server` | **Drop the literal.** The script reads `db/dev.env`; ARCH-010 already ruled no pepper literal on a command line |
| `:3497-3502` (Step 10) | One commit of four trees | **Change.** Four slices, four commits |

Plan Task 12 inherits the same faults and is noted under *For the lead* 7.

### Split it

Four slices, in this order. Each is one review.

| Slice | What | Touches | Waits for |
|---|---|---|---|
| **011a** | The server serves the bundles | `apps/server`, the POS Vite config, root scripts | nothing |
| **011b** | The session clock and the route table on the wire | `packages/contracts`, `apps/server` | nothing |
| **011c** | The POS client signs in | `packages/api-client` (new), `apps/pos` | 011a, 011b, the browser check, the designer's copy for POS-01 |
| **011d** | The back-office client | `apps/back-office` (new) | 011c, the designer's answers on M-6 and BO-01 |

011a and 011b share no file and may be dispatched in either order. 011b is thin on purpose: it
changes `domain/session.ts`, a reviewed identity module, and deserves a review that looks at
nothing else. 011c carries the transport core because it is the first consumer; 011d reuses it and
is then mostly screens.

---

## 2. Serving the bundles

Authority: ARCHITECTURE §3.1 and §14.4; ADR-010 rules 1, 3 and 6 and its *Not decided here* ("what
is served outside `/api`: the bundles, their fallback, cache headers and a content security
policy"), which this section decides for the task file.

### Where the build output lives

Each client builds into its own package: `apps/pos/dist` and `apps/back-office/dist`. This is
Vite's default, so no `outDir` and no `emptyOutDir` are configured; `dist/` is already in
`.gitignore`; and the output is emptied on every build because it is inside the project root. The
plan's `apps/server/public/<client>` loses on each count: it is outside the root, so Vite will not
empty it without a flag and warns; it needs a new ignore entry; and it makes one package write
into another's tree. The stale comment at `apps/pos/vite.config.ts:4-6` is replaced by one line
saying the server reads this `dist/`.

`build.assetsInlineLimit` is set to `0` in both Vite configs, so no asset is ever inlined as a
`data:` URI and the policy below needs no `data:` source.

### The root is anchored to a file

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

### What each path answers

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

### Headers

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

### The guards and the cookies

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

### An error outside `/api` is not the envelope

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

### `npm run verify`

- `apps/server` depends on `@fastify/static` `^10`.
- Root scripts gain `build:clients` (the POS in 011a; the back office is appended in 011d) and the
  POS gains `build:watch` (`vite build --watch`).
- `typecheck` gains `tsc -p packages/api-client` in 011c and `tsc -p apps/back-office` in 011d.
- The proof that a real build has the properties the policy assumes is a test that **makes its own
  build from the real Vite config into a temporary directory** (a child process, so vitest's
  `NODE_ENV` does not leak into it) and reads the output. It never reads a `dist/` someone left
  behind, and it fails rather than skips when the build fails. `verify` therefore needs no build
  step of its own and its order does not change.

---

## 3. Development workflow

Authority: ADR-010 (*the origin, in development and otherwise*, and its consequence "development
against the real API has no hot reload"); ARCHITECTURE §14.4; B-24.

**Nothing here reopens ARCH-010. Vite stays fixture-only on `http://127.0.0.1:5173` with no
proxy.** There are two ways to run a client, and they never mix.

| | Fixture mode | Served mode |
|---|---|---|
| Command | `npm run dev -w apps/pos` | `npm run dev -w apps/server`, and `npm run build:watch -w apps/pos` beside it |
| Address | `http://127.0.0.1:5173/pos/` | `https://localhost:8443/pos/` |
| Session | a fixture cashier; no request is made | the real one |
| Reload | hot | by hand; `no-cache` on the HTML makes a reload enough |
| For | drawing and reviewing screens | anything that touches the server |

In served mode the developer needs a person to sign in as. Until Phase 1's users screen exists the
only way to make one is `npm run create-manager -w apps/server`, which the owner runs at a
terminal, and it makes a manager. **Phase 0 therefore demonstrates POS sign-in with a manager's
PIN.** No cashier can exist yet outside the test database. That satisfies the roadmap's
demonstrable ("staff authenticate at the POS with a PIN"); the lead should know it before the
demonstration, not during it.

### What is real in Phase 0, and what stays a fixture

**Real, in served mode:** POS sign-in from POS-01, the session read after a reload, activity, the
idle countdown, Release, every answer the session routes can give, and the health read. At the
back office: sign-in, the session read, activity, M-6, logout.

**Still a fixture, in both modes:** the floor, the order workspace and its store, settlement and
the payment session, closed orders, refunds, print incidents, and the M-1 stand-ins. The server
has no route for any of them. In served mode these screens are reachable only after a real
sign-in and show the real person's name over fixture orders (see *For the owner* 1).

**Fixture only, never in a served build:** the fixture cashier; POS-01's `?state=` pictures; the
lock screen's incident banner, which has no route to read from; and the literal `'90s'`.
`App.tsx:8` reads `?state=` in every build today. Left alone, `https://localhost:8443/pos/?state=throttled`
would draw a cooldown that does not exist, on the real origin. 011c makes that read fixture-only.

### How a build cannot ship a fixture where a real call is owed

Three mechanisms, each with a proof.

1. **One switch, keyed on the build command, in one module.** Each Vite config defines a
   compile-time constant from the command: true for `serve` (the dev server, and vitest, which
   loads the same config), false for `build`. The session source is chosen from that constant in
   exactly one module per client. `import.meta.env.DEV` must not be the switch: the librarian
   confirms it follows `NODE_ENV`, so `NODE_ENV=development vite build` yields `DEV === true` in a
   bundle the server would then serve. A constant from the command cannot be flipped by an
   environment variable, a `--mode` or a query string. *Proof:* the self-building test of
   question 2 runs the build twice, once plainly and once with `NODE_ENV=development`, and asserts
   that a marker string exported only by the fixture-session module appears in neither output.
   *Red proof:* switch on `import.meta.env.DEV` instead; the second build fails the test.
2. **The fixture session never reaches the network, and the real one never reaches a fixture.**
   The fixture source does not import the request module. *Proof:* in fixture mode a full
   sign-in, a touch and a Release make zero `fetch` calls.
3. **A server route that no client declares fails the build.** 011b puts the route table in
   `@pos/contracts`, and a server test holds the registered API routes equal to it in both
   directions. Each client's API module maps every route of its surface to a function through an
   exhaustive mapped type. When Phase 2 adds `POST /api/pos/orders`, the server test fails until
   the table has it, and then the POS fails to compile until its API module does. That is the
   moment the builder must wire the call and delete the stand-in, in the same task, as the owner
   ruled for each stand-in (2026-10-01 to 2026-10-03). It cannot prove that a declared function is
   used by a screen; review does that.

---

## 4. One request path per client

Authority: ADR-010 rule 1 ("clients treat a non-2xx response with no parseable envelope as a
transport failure with no code"; "both clients switch on one list of codes"); ARCH-012 §3, §5 and
*For the lead* 4; ARCHITECTURE §2.1, §4.3 and §16.

### Where it lives

§4.3 is headed "shared behavior without a shared client", and what it describes is two clients
showing the same incidents without being one application. §2.1 says what may be shared: "API
schemas, validation primitives, the Money module, authentication primitives, and design tokens",
and what may not: "one responsive application shell or one route manifest". A transport core is
neither a shell nor a route manifest, and what it does (hold the token, attach it, decide whether
a refused request may be retried) is an authentication primitive.

**I recommend a new package, `packages/api-client` (`@pos/api-client`): pure TypeScript, no React,
no component, no route of its own.** Each client constructs exactly one instance, in one module,
with its surface. That module is the only file in the client that imports the package, and
`console-free.test.ts` is tightened so that `fetch` appears nowhere in either client's source at
all.

The alternative is one wrapper file per client, held to a shared table of test cases. It keeps
the clients fully separate in source, and it loses because the rules below are security rules
that must be identical: §16 already lists "two frontend bundles drift" as a risk, and a rule kept
in two places is the form drift takes. What the two clients do *differently* with a result (POS-01
or M-6 on `SESSION_IDLE`) stays in each client and is not in the package.

**In `@pos/contracts`:** only data. The `SessionView` change of question 6; zod schemas for the
two session views and for the error envelope, so that a client validates what it receives at its
boundary as the server validates what it is sent (§2.1); the header name `X-RPOS-CSRF` as a
constant the server and the core both import; and the route table. No function that performs a
request belongs there: the server imports that package.

### The rules of the core

1. **Requests go to relative paths from the route table**, never an absolute URL and never
   `127.0.0.1`. `credentials` same-origin, `cache: 'no-store'`, `redirect: 'error'`.
2. **A body is JSON, checked against the shared request schema before it is sent.** A PIN that is
   not six digits, or an empty username or password, never leaves the client. A request with no
   body sends no `Content-Type`: Fastify answers 400 to an empty JSON body.
3. **No credential is ever placed in a URL**, and the core has no way to add a query string to a
   credential route.
4. **The anti-CSRF token is held in the core's closure and nowhere else**: not in React state, not
   in the DOM, not in storage, not in a log. It is replaced by every session view the core
   receives (sign-in, `me`, re-authentication) and sent as `X-RPOS-CSRF` on every request that is
   not `GET` or `HEAD`. It is dropped when the session ends. At the back office it is **kept**
   through `SESSION_IDLE`, because M-6's request needs it (`session-guard.ts:215-224`).
5. **On `CSRF_REFUSED`: read `me` once; retry once only if `me` names the same `staffUserId` the
   core held before the refusal.** If `me` names anyone else, or the core held nobody, nothing is
   retried and the result is that the session is gone. The core does not call release or logout
   in that case: the cookie belongs to another tab's session now, and ending it would sign that
   tab out. The reason is the shared jar. Two tabs of one client present one cookie. If the second
   signs in, the first tab's token no longer matches the cookie, its next mutation is refused, and
   `me` answers for whoever signed in second. An unconditional retry would carry out the first
   tab's command as that person, under a name the first tab was not showing. In Phase 0 the only
   mutations are session routes and the harm is small. From Phase 2 it would be a void or a
   refund attributed to the wrong actor, which is B-13. The rule is set now, in the one place.
   The `me` read is single-flight.
6. **Switch on `error.code`, never on the status.** The core returns a result and never throws
   for something the server said:
   - success, with a value checked against its schema;
   - *refused*, with the code and its typed details, when the body parses as the envelope;
   - *failed* or *unavailable*, for everything else.
7. **On a 5xx, an unparseable non-2xx body, a schema failure on a 2xx, a timeout or no response,
   the core asks `GET /api/health` once.** Health answering 200 makes the result *failed*
   ("something went wrong"). Health answering 503 or not at all makes it *unavailable* ("the
   system is unavailable"). **The original request is never resent automatically.** A command may
   have been applied; ARCH-012 left that distinction to Phase 2's idempotency design, and nothing
   here anticipates it. Every Phase 0 mutation is safe for a person to try again.
8. **The core writes to no console and keeps no response text.** An unexpected body is discarded,
   not attached to an error.
9. **A request has a timeout** (ten seconds is ample on loopback; Argon2id is the slowest thing it
   waits for). A timed-out request is rule 7.
10. **Each client maps every code exhaustively.** A `switch` over `ErrorCode` with a `never`
    check, so that a code added in a later phase fails compilation in each client until it has
    been given a state.

### How it is tested

In the node environment with `fetch` and the clock injected at construction; no network and no
DOM. The cases are listed under *For the task file*, 011c. The important ones are the three for
rule 5 (same identity retried once; different identity not retried and not released; a second
refusal after the retry is not retried again) and the three for rule 7.

---

## 5. The session in each client

Authority: FR-A2, FR-A2b, FR-A2c, FR-B3; ADR-009 §6; ARCH-012 §5 and §7; ARCHITECTURE §6.4 and
§7.2; the owner's rulings of 2026-10-05 and 2026-10-06 on M-6.

### The POS

The session is a small store above the routes, with three states.

| State | Drawn as |
|---|---|
| *starting*: the first `me` has not answered | the empty device frame; nothing is drawn (it lasts milliseconds, and no boot state is designed) |
| *signed out*, with why: resting, idle, released, or invalidated | POS-01 |
| *signed in*: name, role, the clock | the route the URL names |

| Event | Result |
|---|---|
| Load or reload: `me` answers 200 | signed in; the URL is kept; `/pos/` itself is replaced by `/pos/floor` |
| `me` answers `UNAUTHENTICATED` or `SESSION_IDLE` at load | signed out, resting. After a reload the client believed nothing, so nothing was invalidated |
| Sign-in answers 200 | signed in |
| Sign-in answers `INVALID_CREDENTIALS` without details | POS-01 *error* |
| Sign-in answers `INVALID_CREDENTIALS` with `retryAfterSeconds`, or `THROTTLED` | POS-01 *throttled*, counting down from the number. Continue stays inert until it has passed. Nothing is retried on its own |
| Any request answers `SESSION_IDLE` | signed out, idle: POS-01 *empty*. The server has already cleared the cookie |
| Any request answers `UNAUTHENTICATED` while signed in | signed out, invalidated: POS-01 *session invalidated* |
| Release pressed | `release` is sent; **the screen goes to POS-01 whatever the answer**. A cashier who pressed Release must never stay signed in on screen because a request failed; an unreleased session dies in at most 90 seconds |
| *failed* or *unavailable* (question 4, rule 7) | a state that is not drawn anywhere yet (question 9) |

Three points.

**The cooldown is not remembered across a reload**, and need not be. After a reload the first
attempt is answered `THROTTLED` with the remaining seconds, and the screen shows it. No storage
is involved.

**The routes are gated, the stores are not.** `PosRoutes` keeps calling `useOrderBook` and
`usePaymentSessions` whether or not anyone is signed in, and renders POS-01 in place of the route
while signed out, without changing the URL. That is what "the tender draft is tab-local state,
kept separately from the actor session so it survives the 90-second POS idle expiry" (§6.4)
requires, and it is why the correction in the Summary matters: a builder who read the brief
literally would replace the payment session with the actor session and lose the draft. With a
payment session active in the tab, POS-01 shows its drawn *tender draft waiting* notice, with the
figures taken from the store rather than from `fixtures.ts:66`. POS-04's own `reauth` modal stays
the fixture picture it is: who may resume another person's draft is FR-G9's question and belongs
to the settlement phase.

**How POS-02 to POS-07 keep working.** The screens stop printing `FLOOR_COPY.actor` and the
literal at `SettlementScreen.tsx:780` and read the person, the countdown and Release from the
session store. In fixture mode the store's source is the fixture cashier, so every URL that works
on port 5173 today still works, `/pos/` still walks POS-01's pictures, and the forty existing
test files pass without a provider being added to each. The lock screen becomes one component fed
by a view (phase, notice, cooldown, draft): the fixtures produce views for review, and the
session produces them for real. There are not two lock screens.

Release is drawn in the floor artifact (`floor.html:48`) and was deferred "for FR-A" by the owner
on 2026-09-30. 011c builds it wherever the artifact draws the actor.

### The back office

Four states: *starting*, *signed out* (BO-01), *signed in*, and *idle* (M-6 over the work).

| Event | Result |
|---|---|
| Load or reload: `me` answers 200 | signed in |
| `me` answers `UNAUTHENTICATED` at load | BO-01 |
| `me` answers `SESSION_IDLE` at load | **BO-01, not M-6.** The page has no draft, no token and no name to show. The cookie is kept, and a successful sign-in releases that session (`session-guard.ts:200`); a failed one leaves it as it was |
| Any request answers `SESSION_IDLE` while signed in | *idle*: M-6 opens over the work. The cookie and the token are kept |
| M-6, the password: 200 | signed in, same session, new token |
| M-6: `INVALID_CREDENTIALS`, `THROTTLED` | M-6 stays, with the refusal or the cooldown |
| M-6: `UNAUTHENTICATED` | BO-01. The eight hours have passed or the session was ended elsewhere; nothing was verified or counted |
| M-6, *another manager*: username and password | the ordinary sign-in route. On success the idled session is released and a new one begins |
| Log out | `logout` is sent; BO-01 whatever the answer |
| `FORBIDDEN` on any request | signed out. The person is no longer a manager (ADR-009, consequences). Not drawn anywhere |

**The working area is keyed by the staff user it belongs to.** Everything under the frame is
mounted under a key equal to the signed-in `staffUserId`. While M-6 is open, or BO-01 is shown
after the eight hours, that subtree stays mounted and inert, so its form state, focus and
selection survive. When a sign-in returns a different `staffUserId`, the key changes and React
destroys the subtree. That one rule carries both of the owner's rulings: the same manager resumes
their draft, and "another manager never adopts it" (2026-10-05), whichever screen the other
manager used and whatever the client sends. Explicit logout and a reload destroy it too. Phase 0
has no form to preserve; the mechanism is built and proved now with a test-only child, so that
Phase 1's first form inherits it instead of inventing it.

**Passwords.** The field is an uncontrolled native input, read once on submit and emptied after
every response, success included. Its value is never React state, never an attribute, never
logged. The form is `method="post"` with its submission prevented, so that no failure of
scripting can turn it into a `GET` with the password in the address bar; `form-action 'none'`
(question 2) is the second lock on the same door.

### One browser holding both

- **The two sessions coexist and do not see each other.** `rpos_pos_sid` is scoped to `/api/pos`
  and `rpos_bo_sid` to `/api/back-office`, so each surface's requests carry only its own cookie.
  Signing in, idling or logging out at one changes nothing at the other. A manager signed in at
  both still types a PIN at M-1 (AC-27).
- **`rpos_cid` is shared** (path `/`), so both tabs are one `ClientInstance`. Neither client reads
  it or can; it is `HttpOnly`.
- **Each tab holds its own token in memory.** Two tabs of the *same* client share one cookie and
  therefore one session; the second sign-in ends the first tab's. Rule 5 of question 4 is what
  makes that safe.
- **`UNAUTHENTICATED` does not prove a manager did anything.** It also follows a sign-in in
  another tab, or another program on `localhost` replacing the cookie (the risk the owner
  accepted on 2026-10-08). POS-01's drawn notice says "Your session was ended by a manager". The
  state is right; the sentence claims more than the code means. For the designer (*For the lead*
  3).

---

## 6. Activity and the idle countdown

Authority: FR-A2, FR-A2b ("background polling does not count as user activity"), AC-28;
ARCHITECTURE §7.2 and §14.4 ("this prevents the browser clock from becoming an authority");
ARCH-012 §7 and *For the lead* 4; `domain/session.ts`.

### `SessionView` does not carry what the client needs

It has `staffUserId`, `name`, `role` and `csrfToken`. Nothing tells the client how long the
session lasts or how much of that is left. A client could hard-code 90 and 1800, but
`session.ts:7` says of those numbers "these exist nowhere else", and a hard-coded limit still
cannot answer the case that matters: after a reload, `me` succeeds on a session that may have
five seconds left, and a client that started its countdown at 90 would show eighty-five seconds
the server has already taken away. That is exactly what ARCH-012 warned against.

**`SessionView` gains two numbers. This is a Task 11 server change (slice 011b).**

```ts
export interface SessionView {
  staffUserId: string;
  name: string;
  role: 'CASHIER' | 'MANAGER';
  csrfToken: string;
  /** This audience's idle limit in whole seconds, from the server's session policy. */
  idleSeconds: number;
  /**
   * Whole seconds until this session idles, rounded down, computed by PostgreSQL in the
   * statement that resolved it. Never more than idleSeconds, never less than 0.
   */
  idleRemainingSeconds: number;
}
```

`idleRemainingSeconds` is computed in SQL from `last_interactive_at`, the audience's limit and
`clock_timestamp()`, in the same statement that judged the session, so the limit and the answer
cannot disagree. It is rounded **down**, so the client never shows more than the server will
give. On a sign-in and on a re-authentication it equals `idleSeconds`. Both are durations, not
instants: the browser's wall clock is never compared with the server's. The back office's eight
hours are not sent; M-6 learns of them from `UNAUTHENTICATED`, and no screen draws them.

Nothing else on the server changes. `activity` stays a 204 with no body.

### The clock in the client

The core keeps one deadline on the page's monotonic clock (`performance.now()`, never `Date`).

- A session view arrives: the deadline is the moment the request was **sent** plus
  `idleRemainingSeconds`.
- A request whose route the table marks interactive answers 2xx: the deadline is the moment it
  was sent plus `idleSeconds`.
- Nothing else moves it. Not a touch, not a poll, not a `me` that failed.

Reckoning from the moment of sending is the conservative side: the server stamped the session at
or after that moment, so the server's deadline is never earlier than the client's.

**The countdown never ends a session.** When it reaches zero, and whenever the page becomes
visible again (a tablet that slept may not have advanced the monotonic clock), the client reads
`me`, which is not interactive. `SESSION_IDLE` ends the session on screen; a 200 re-arms the
countdown from the new `idleRemainingSeconds`. Any request that answers `SESSION_IDLE` or
`UNAUTHENTICATED` ends it at once, whatever the countdown says. A read at the deadline is not a
poll in FR-A2b's sense: it extends nothing, and AC-28 is proved against it.

### Activity

- **Sent only from an input event.** One listener on the document, in the capture phase, for
  `pointerdown` and `keydown`; the back office adds `wheel`, since a manager reading a long
  report with the wheel is a person acting. Not pointer movement, not focus, not visibility, not
  scrolling as such.
- **Limited by the leading edge only.** An input sends `activity` if no interactive request has
  been sent within the window (I recommend five seconds at the POS and sixty at the back office;
  these are client constants, not policy), and otherwise does nothing. There is deliberately no
  trailing send: a trailing send is a timer, and "never from a timer" is easiest to keep when no
  timer exists that could do it. The cost is that the server's stamp can trail the last touch by
  up to one window. The countdown shows the server's time, so the screen stays honest about it.
- **The listener reads nothing from the event.** Not the key, not the target. It is also what
  keeps a cashier signed in while a manager types at M-1, and it must not be a channel for those
  digits. The request has no body.
- **Any interactive request counts.** From Phase 2 a command is itself interactive, and an input
  that follows one within the window sends nothing.

**The client test that proves it** (009a and ARCH-012 both ask for one): with fake timers, the
countdown ticking and the deadline read firing, advance ten minutes with no input and assert that
`activity` was requested zero times. Then one `pointerdown`: once. Ten more inside the window:
still once. One after the window: twice. Beside it, a source scan: the function that sends
`activity` is referenced from the input listener's module and from nowhere else. *Red proof:*
call it from the countdown's tick; the first assertion fails.

### What the screen shows as the deadline nears

The only thing drawn is the idle chip in the POS header: `90s` in the artifact, a plain count of
whole seconds. 011c makes that number live, and adds nothing: no colour change, no warning, no
dialog, no sound. None is designed, and the inventory's "idle countdown / expiry takeover"
(SITEMAP `:104`) is satisfied by the chip and POS-01. If the owner wants a warning before the
lock, that is a design task. The back office draws no countdown at all; M-6 appears when the
server says the session is idle, and DESIGN-012's "timeout captures the actual active element"
is met by the deadline read above.

---

## 7. The back-office shell without slice B

Authority: NFR-5; ADR-009; DESIGN.md, *Open* item 2 and item 5 and the DESIGN-012 section; the
DESIGN-012 review (all nine findings closed; three low ones open); SCREEN-INVENTORY BO-01, BO-02
and M-6.

What exists in Frost for the back office: the frame (a 220px rail, a 64px top bar, the scrolling
content pane), the alerts, M-6, dialogs, and native text, secret, select and radio fields with
their focus, invalid, read-only and disabled states. What does not: BO-01, which "exists only in
the greyscale wireframe", and BO-02, the landing screen, which is `[MY CALL]` and undesigned.

**011d builds the back office now. It does not wait for slice B.** The reasons: the roadmap's
Phase 0 demonstrable is a manager signing in there; the risk in this slice is behaviour (the
session, M-6, the keyed working area), none of which a drawing changes; and every visual piece a
sign-in needs is already a DESIGN-012 pattern. A restyle later is a small frontend task.

It builds three things.

1. **Everything behavioural**, from questions 4 to 6.
2. **M-6 as DESIGN-012 draws it**: the native modal dialog that Escape and an outside click
   cannot dismiss, the focus loop, the inert background. Its copy is stale in three places (see
   *For the lead* 4); the designer corrects those before 011d is dispatched.
3. **A provisional sign-in**: one username field and one password field from the 40px field
   pattern with its label, the office primary button, and the amber invalid message or notice,
   stacked as the dialog forms stack them. It is marked provisional in the source and in the
   Handoff, as FE-001 marked its one undrawn notice, and slice B's frontend task replaces it.

**What the builder must not invent:**

- **No value.** No colour, length, weight or token that is not in the Frost registry.
  `no-invented-values.test.ts` is copied to the back office and reads `office.css`' ported rules
  the same way.
- **No landing content.** After sign-in the frame is shown with an empty content pane. BO-02 is
  not designed.
- **No navigation entry.** The rail is empty. DESIGN-012's destinations all lead to screens that
  do not exist, and a link into the fallback is a lie the manager finds by clicking it.
- **No business-day indicator and no incident banner or chip.** Each needs a route Phase 0 does
  not have. A date or an incident drawn from a fixture, in a served build, under a real
  manager's name, is the fixture-where-a-real-call-is-owed of question 3.
- **No copy.** Where DESIGN-012 gives a sentence, that sentence. Where it gives none, the builder
  stops and asks (question 9).
- **No PIN field, no "remember me", no password reveal, no strength meter, no "forgot password".**
  Recovery is the script (ADR-009 §7).
- **Nothing from `apps/pos`.** Not `PinPad`, not a stylesheet, not a hook. A test fails on any
  import across the two applications in either direction (NFR-5).

The empty rail and the empty pane are deviations from the drawn frame, and I am not the one to
bless them. They are the smallest honest thing a builder can do, and they go to the designer as
one question (*For the lead* 5).

---

## 8. The M-1 approval prompt

Authority: B-14; FR-A6; ARCH-013 §6 and *For the lead* 5; PHASE0-010b's Handoff; the owner's
stand-in rulings of 2026-10-01, 2026-10-02 and 2026-10-03.

**Task 11 changes nothing in `Approval.tsx` and nothing in `approvalFixtures.ts`.** There is no
production route that takes a manager PIN, and the test-only probe must never be called by a
client. The three stand-ins (refund, discount, void) stay exactly as the owner ruled them, until
the command each stands in for exists. Wiring M-1 to anything in Phase 0 would mean wiring it to
nothing, or to a verify-only call, which ARCH-013 rejected outright.

Two of its pictures show states the server will never signal: `approval-error` prints "3 attempts
remaining" and `approval-denied` tells a cashier's PIN from an unknown one. They are the
artifact's copy, verbatim, and so the designer's to change (ARCH-013 *For the lead* 3, still
open). A builder does not edit them in passing.

What 011c does owe M-1, without touching it:

- **The prompt goes when the cashier's session goes.** It is mounted under the gated routes, so
  it is unmounted when the session ends, and `PinPad` clears its digits on unmount
  (`PinPad.tsx:69-75`). A test opens a fixture prompt, ends the session, signs in again and
  asserts that no prompt and no trace of one is drawn (B-14: nothing about an approval survives).
- **Keys pressed on M-1 keep the cashier's session alive** through the activity listener, which
  reads nothing from them (question 6). The existing B-12 tests in `pin-pad.test.tsx` gain one
  assertion: after digits are typed on either pad, no request body anywhere contains one.

For Phase 2's first gated command, recorded so it is not rediscovered: `ApprovalDialog` has no
verifying state (`PinPad`'s `verifying` is never passed), its `onSubmit` returns nothing for the
caller to await, and `throttled` is a boolean where the server gives seconds. All three change
with the first real command, together with ARCH-013's four needs (the two codes; a failure never
ends the cashier's session; the PIN is discarded after every response; the keypad stays inert
until `retryAfterSeconds` has passed).

---

## 9. Copy for each code

Authority: ADR-010 rule 1: "There is no `message` field … What a person reads is the client's own
copy, chosen by code; **the wording belongs to the design documents**."

PHASE0-009b's Handoff says the exact copy for each code is "the client's to write". That is right
about where the sentence lives (in the client, never in the server) and wrong if it is read as
who writes it. **The designer owns the wording. The builder places it.** FE-001 already met this:
it flagged its one undrawn notice as provisional copy rather than passing it off as reviewed
(`fixtures.ts:46-48`).

### What the screens already carry

| Screen | Server signal | Drawn state | Can it be shown as drawn? |
|---|---|---|---|
| POS-01 | 200 in flight | *loading* ("VERIFYING") | Yes |
| POS-01 | `INVALID_CREDENTIALS`, no details | *error*: "PIN not recognised" / "2 attempts remaining before a five-minute cooldown." | **Title yes, body no.** The server reports no count, deliberately (ARCH-012 §5) |
| POS-01 | `INVALID_CREDENTIALS` with details, or `THROTTLED` | *throttled*: "Sign-in locked for 4 min 12 s" and its body | Yes, with the time taken from `retryAfterSeconds` |
| POS-01 | `UNAUTHENTICATED` on a held session | *session invalidated*: "Your session was ended by a manager" | The state yes; the sentence overclaims (question 5) |
| POS-01 | `SESSION_IDLE` | *empty* | Yes; nothing is said, and nothing need be |
| POS-01 | a payment session in the tab | *tender draft waiting* | Yes, with figures from the store |
| POS-01 | none exists | *permission-denied* ("This account is deactivated", provisional) | **Never.** A deactivated user's PIN is answered as a wrong PIN, by design (ARCH-012 *For the lead* 2) |
| POS-01 | none exists yet | *emergency print incident present* | Not in Phase 0; no route |
| M-1 | `APPROVAL_FAILED`, `APPROVAL_THROTTLED` | four pictures | Not wired in Phase 0 (question 8) |
| M-6 | `INVALID_CREDENTIALS` | "Incorrect password. Try again." | Yes |
| M-6 | `INVALID_CREDENTIALS` with details, or `THROTTLED` | a "LOGIN five-minute cooldown", "installation-wide" | **No.** The password throttle is per account (FR-A5b, ADR-009 §4), not the `LOGIN` class and not installation-wide |
| BO-01 | every signal | nothing in Frost | **No state is drawn at all** |

### Codes with no drawn state on any screen

- **`UNAVAILABLE`, and no response at all**: "the system is unavailable". Needed on both clients,
  on every screen that can make a request, POS-01 and BO-01 first.
- **`INTERNAL`, an unparseable failure**: "something went wrong". The same.
- **`FORBIDDEN`** at the back office: a signed-in person who is no longer a manager.
- **`UNAUTHENTICATED` at M-6**: the eight hours have passed. DESIGN-012 says "absolute expiry
  belongs to BO-01 and is not drawn here", and BO-01 is not drawn.
- **`VALIDATION_FAILED`, `CSRF_REFUSED` after the one retry, `ORIGIN_REFUSED`, `NOT_FOUND`,
  `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`**: an honest client never causes any of them. I
  recommend all six share the "something went wrong" state and get no sentence of their own;
  telling a cashier that an origin was refused helps nobody.
- **A PIN of fewer than six digits at POS-01.** The shared schema stops it leaving the client
  (question 4, rule 2), so the server is never asked. What the pad does instead is not drawn for
  POS-01. `PinPad` already has `requireFull`, drawn for the refund approval; using it on the lock
  screen is the obvious answer, and it is the designer's to give.

So the designer owes, before 011c: a body for POS-01's *error* without a count; a sentence for
*session invalidated* that claims only what is known; and the two general states for the POS.
Before 011d: the same two states for the back office, the corrected M-6 cooldown, BO-01's states,
and the two orphans (`FORBIDDEN`, and M-6 after eight hours). It is one small design task, not
slice B.

---

## 10. Proofs and acceptance

The test cases and red proofs are under *For the task file*. This section says what closes where.

| Criterion | Closes in Task 11 | Closes only in Task 12, in a browser |
|---|---|---|
| NFR-1, one HTTPS origin, path-separated | 011a: both prefixes answer from the one server, proved by `inject` and by hand | Both shells loaded from `https://localhost:<port>` in one run |
| NFR-5, two independently bootstrapped bundles | 011d: two packages, two builds, two route manifests, no import across them, a transport core with no UI | "Two visibly different applications" |
| AC-1, first clause ("a cashier authenticates by PIN") | 011c, against a stubbed server | With the real server |
| AC-19 | Nothing new; the routes closed it. 011c proves the *presentation* of the cooldown from `retryAfterSeconds` | Five wrong PINs at the real pad; a cleared `rpos_cid` changing nothing |
| AC-27 | Nothing new at the API. 011c and 011d prove each client calls only its own surface | One profile holding both sessions; each refused by the other surface |
| AC-28 | 011b: the two numbers on the wire. 011c: activity only from input; a deadline read that extends nothing | "Divergent timeout presentation": the POS back at POS-01 and the back office at M-6, with the session aged in the database |
| AC-32, the POS half | 011c: `UNAUTHENTICATED` on a held session draws *session invalidated* | Phase 1, when a user can be deactivated |
| AC-35, last sentence ("finds their unsaved work; a different manager … does not") | 011d: the keyed working area, proved with a test child | **Phase 1**, with the first real form. Phase 0 has no form to lose |
| AC-18's "no PIN value in any form", the client's side | 011c and 011d: no PIN or password in a URL, storage, the DOM, the console or any request but its own | The log scan with a browser driving |

### What Task 12 needs from Task 11

- **Names, not test ids.** The built POS has no `data-testid` and should not gain any. Every
  control the harness drives has an accessible name: the digits, "Delete last digit", "Continue",
  "Release"; at the back office the field labels, the sign-in button, "Log out", and M-6's dialog
  title. Each Handoff lists them.
- **State that is not copy.** Each client's root element carries `data-session` (`starting`,
  `signed-out`, `signed-in`, and `idle` at the back office), and POS-01 carries `data-lock-state`,
  as the floor already carries `data-floor-state`. The harness asserts on those, so a change of
  wording never breaks it.
- **A served bundle**: `npm run build:clients`.

### What Task 12 needs and does not have

- **People.** `create-manager` reads only from a real terminal and cannot be scripted, by design.
  The harness needs a cashier and a manager made through the domain functions, as
  `apps/server/test/support/people.ts` makes them, in a database of its own, with no `DELETE`
  anywhere (ARCH-010; B-7). The plan's seeder deletes from `audit_entry`.
- **A way to age a session** without waiting ninety seconds or thirty minutes: an update of
  `actor_session.last_interactive_at` over the owner connection of that throwaway database. The
  plan names a table and a column that do not exist (`app_session`, `last_activity_at`).
- **A port and a database of its own**, so that it does not collide with a running development
  server on 8443 or trip the installation-wide throttle of the development database.
- **The `e2e` workspace.** The root `package.json` lists it; the directory does not exist.
- **The answer to the cookie question** (see *What I could not verify*).

---

## 11. Anything else

- **B-11.** Kept by the listener. The clients add: relative URLs only, so a request can never be
  aimed at `http:`.
- **B-12.** The POS pad is already held to it. 011c extends the same test to the real path: after
  a real submission the PIN is in one request body and nowhere else. 011d holds the password
  field to the same standard (question 5). No error boundary in either client renders an error's
  message. Neither client writes to the console; `console-free.test.ts` is copied to the back
  office and made recursive in both (today it reads only the top level of `src`, so a file in a
  subdirectory would escape it).
- **B-13.** Rule 5 of question 4.
- **B-14.** Question 8. Neither client holds anything that represents an approval.
- **B-24.** The fixture cashier and the fixture `90s` are absent from a served build, proved on
  the bundle. The idle limit and the cooldown shown come from the wire, never from a literal 90,
  1800 or 300. The artifact's sentences that say "five" are copy, and the designer's.
- **FR-A2c.** Each client's API module can name only routes of its own surface; the mapped type
  of question 3 has no entry for the other.
- **FR-A7.** Neither client reads, sends or reasons about `rpos_cid`.
- **NFR-5, layout per client.** The back office gets its own `index.html` (no `maximum-scale=1`:
  that is the POS tablet's, and a desktop page should zoom), its own stylesheet ported from
  `office.css` through tokens, and its own Vite port for fixture work (5174, no proxy).
- **A browser's password manager** will offer to save the manager's password, whatever
  `autocomplete` says. The application stores nothing, so the rule "no credential in browser
  storage" is kept by the application; what the browser does on a shared machine is a risk for
  the owner to know of (*For the owner* 2).
- **ADR-010's "not decided here" is now decided in a task file.** See *For the owner* 3.
- The design rules STATE carries for BO-12 and BO-13 do not apply: neither screen is built here.

---

## For the task file

### The split

011a, 011b, 011c, 011d, as in question 1. Each is one commit on its own branch.

### PHASE0-011a: rules

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

### PHASE0-011a: interface

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

### PHASE0-011a: test cases

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

### PHASE0-011a: red proofs

- Root the bundles at `process.cwd()` and run the tests from another directory: case 1 fails.
- Let the fallback answer every miss: case 4 fails.
- Register the fallback on the root: case 8 fails.
- Remove the path branch from `errorHandler`: case 13 fails.
- Add a security-header plugin on its defaults: case 12 fails on HSTS.

### PHASE0-011a: acceptance beyond `npm run verify`

**The browser check, by the lead or the owner, before 011c is dispatched.** Open
`https://localhost:8443/pos/` in Chrome and in Safari, click through the warning once, and
confirm in the developer tools that (a) the page loads with no policy violation in the console,
(b) `GET /api/health` from that page answers 200, and (c) after any API request `rpos_cid` is
stored with `Secure`, `HttpOnly` and `SameSite=Strict` and is sent again after a reload. If (c)
fails in either browser, stop: every session in this design depends on it, and it comes back to
the architect.

### PHASE0-011b: rules

1. `SessionView` gains `idleSeconds` and `idleRemainingSeconds`, as in question 6.
2. `idleRemainingSeconds` is computed by PostgreSQL in the statement that judged the session,
   from `clock_timestamp()`, rounded down, clamped to `0..idleSeconds`. No JavaScript clock is
   read. `idleSeconds` comes from `SESSION_POLICY` and from nowhere else.
3. `activity`, `release` and `logout` are unchanged.
4. `@pos/contracts` gains: the route table (method, path, `interactive`) for health and both
   surfaces; zod schemas for both session views and for the error envelope, with the existing
   type names kept; and the header name `X-RPOS-CSRF` as a constant that `session-guard.ts`
   imports.
5. A server test holds the registered API routes equal to the table, in both directions, and for
   each `ACTIVE` route holds the table's `interactive` equal to the route's declaration. The
   probe route of 010b's tests is not in the table and is registered only by its test.
6. No error code is added.

### PHASE0-011b: test cases

1. A POS sign-in returns `idleSeconds` equal to the policy and `idleRemainingSeconds` equal to it.
2. `me`, after the session is aged by *n* seconds in the database, returns `idleRemainingSeconds`
   within one of the policy less *n*, and never more than the policy.
3. `me` does not move it: two reads a moment apart do not increase the number.
4. `activity` then `me` returns it to the policy (within one).
5. A session aged to one second short of the limit returns 0 or 1, never a negative number; aged
   past the limit, the answer is `SESSION_IDLE` as before.
6. The same five for the back office, with its policy; and a re-authentication returns the policy.
7. Both numbers are integers; the response has exactly the six keys (seven at the back office).
8. The route table equals the registered routes; removing an entry, or adding a route without
   one, fails.
9. `error-details.types.ts` and every existing route test still pass; those that compare a
   session view whole are updated and listed in the Handoff.

### PHASE0-011b: red proofs

- Compute the remaining time from `Date.now()`: case 2 passes by luck but the source scan for a
  JavaScript clock in `session.ts` fails. (Add that scan.)
- Round up instead of down: case 5 fails.
- Mark `me` interactive in the table: case 8 fails.

### PHASE0-011c: rules

1. `packages/api-client` holds the core and the ten rules of question 4. It has no React, no DOM
   beyond `fetch` and `AbortSignal`, and takes `fetch` and the clock at construction.
2. `apps/pos` constructs one instance in one module. `fetch` appears nowhere in `apps/pos/src`.
3. The session source is chosen from a compile-time constant defined from the Vite command, in
   one module. `import.meta.env.DEV` is not the switch. POS-01's `?state=` is fixture-only.
4. The session store, its three states and its events are the tables of question 5. Release goes
   to POS-01 whatever the server answers.
5. `PosRoutes` gates the routes and not the stores: `useOrderBook` and `usePaymentSessions` stay
   mounted while signed out.
6. The actor, the idle chip and Release read from the session store on every screen that draws
   them. No screen prints a person's name or a number of seconds from a literal.
7. `activity` is sent only by the input listener, limited by its leading edge, with no body; the
   listener reads nothing from the event (question 6).
8. The countdown never ends a session; the deadline read and the visibility read do.
9. `Approval.tsx` and `approvalFixtures.ts` are not edited.
10. No copy is invented. Where the designer's answer is not in the task file, the builder writes
    `BLOCKED`.
11. No PIN in a URL, storage, the DOM, the console, or any request but the sign-in's own body.

### PHASE0-011c: test cases

The core, in the node environment:

1. A `GET` sends no token and no `Content-Type`; a `POST` with no body sends the token and no
   `Content-Type`; a `POST` with a body sends both.
2. A sign-in's session view replaces the token; the next mutation carries the new one.
3. A body that fails its request schema is never sent.
4. An envelope is returned as *refused* with its code and details, for a 401, a 403 and a 429
   alike; three different codes on 401 give three different results.
5. `CSRF_REFUSED`, then `me` naming the same person: the request is retried once, with the new
   token, and its result returned.
6. `CSRF_REFUSED`, then `me` naming someone else: nothing is retried, no release is sent, and the
   result is that the session is gone.
7. `CSRF_REFUSED`, then `me`, then `CSRF_REFUSED` again: not retried a second time.
8. Two refused requests at once cause one `me`.
9. A 500 with an envelope and health 200: *failed*. A 502 with an HTML body and health 200:
   *failed*. A rejected `fetch` and health rejected: *unavailable*. A 500 and health 503:
   *unavailable*. In none is the original request sent twice.
10. A 200 whose body fails the response schema is *failed*, and its text is kept nowhere.
11. The deadline: set from a session view by the moment of sending plus the remaining seconds;
    moved by a 2xx from an interactive route to that moment plus the limit; not moved by `me`, by
    a failed request, or by a non-interactive route.
12. At the POS, `SESSION_IDLE` drops the token; a core built for the back office keeps it.

The POS, in jsdom with a stubbed `fetch`:

13. Load with `me` 200: signed in at the URL's route; `/pos/` becomes `/pos/floor`.
14. Load with `me` `UNAUTHENTICATED`, and with `SESSION_IDLE`: POS-01 resting, no notice.
15. Six digits and Continue: one `POST` to the sign-in route whose body is exactly `{ pin }`;
    on 200 the floor shows the name and role from the response.
16. `INVALID_CREDENTIALS` without details: POS-01 *error*, the keypad live.
17. `INVALID_CREDENTIALS` with `retryAfterSeconds: 300`, and `THROTTLED` with `240`: POS-01
    *throttled*, Continue inert, the time counting down from the number, live again when it has
    passed, and no request made by the countdown.
18. Fewer than six digits: no request.
19. Signed in, a request answers `SESSION_IDLE`: POS-01 resting. It answers `UNAUTHENTICATED`:
    POS-01 *session invalidated*.
20. Release, with the server answering 204, 500, and not at all: POS-01 each time.
21. The activity proof of question 6, whole.
22. The chip shows the whole seconds left and reaches 0; at 0 one `me` is read; a 200 re-arms it
    and `SESSION_IDLE` locks. Becoming visible reads `me` once.
23. Signed out with a payment session in the tab: POS-01 shows *tender draft waiting*; after
    sign-in the drafts are as they were.
24. A fixture M-1 prompt open, the session ends, sign-in again: no prompt, nothing of one.
25. In fixture mode a sign-in, a touch and a Release make zero `fetch` calls, and every existing
    fixture URL renders as before.
26. B-12, on the real path: after a submission the digits are in one request body and in no
    attribute, no text, no storage, no console call, no URL and no other request.
27. The built bundle, plain and with `NODE_ENV=development`: the fixture-session marker is in
    neither; `?state=throttled` on the built lock screen draws no notice.
28. `console-free.test.ts`, now recursive: no `fetch`, console, storage, cookie or beacon in
    `apps/pos/src`.
29. The forty existing test files pass; any that changed are listed with the reason.

### PHASE0-011c: red proofs

- Retry after `CSRF_REFUSED` without comparing identities: case 6 fails.
- Switch on the status: case 4 fails.
- Send `activity` from the countdown tick: case 21 fails.
- Start the countdown at the limit after `me`: cases 11 and 22 fail.
- Switch the session source on `import.meta.env.DEV`: case 27 fails.
- Replace the payment session with the actor session: case 23 fails.
- Keep Release on screen until the server answers: case 20 fails.

### PHASE0-011d: rules

1. `apps/back-office` is its own workspace package with its own Vite config (`base:
   '/back-office/'`, port 5174, no proxy), `index.html`, stylesheet and route manifest, on the
   POS's built dependency versions. Nothing is imported from `apps/pos`, in either direction.
2. It constructs one core instance for the back-office surface, in one module.
3. Sign-in is a username and a password. No PIN field exists in this client.
4. The password field is uncontrolled, read once, emptied after every response, never state,
   never an attribute. Every form is `method="post"` with submission prevented.
5. The four states and their events are the table of question 5. A reload on an idle session
   shows BO-01, not M-6.
6. The working area is keyed by `staffUserId`, stays mounted and inert under M-6 and under BO-01
   after `UNAUTHENTICATED`, and is destroyed by a different identity, an explicit logout, and a
   reload.
7. M-6 re-authentication sends `{ password }` and nothing else. Another manager uses the sign-in
   route.
8. Activity, the deadline read and the fixture switch are as in 011c, with the back office's
   window and `wheel`.
9. The *must not invent* list of question 7, whole.
10. `build:clients` and `typecheck` gain the back office.

### PHASE0-011d: test cases

1. Sign-in posts exactly `{ username, password }` to the back-office route; on 200 the frame
   shows the manager's name, and the password field is empty.
2. `INVALID_CREDENTIALS`: the one refusal, the same for an unknown username and a wrong password;
   the password field is empty; the username is kept.
3. `INVALID_CREDENTIALS` with details, and `THROTTLED`: the cooldown, the button inert until it
   has passed.
4. An empty username or password: no request.
5. Load with `me` `SESSION_IDLE`: BO-01. A sign-in then succeeds.
6. Signed in, a request answers `SESSION_IDLE`: M-6 opens; the content under it is still in the
   DOM and inert; Escape and a click outside do not close it; the token is still sent on the
   re-authentication.
7. M-6 with the right password: closed, the test child's typed value, focus and selection as
   they were.
8. M-6 with a wrong password: M-6 stays, the refusal shown, the field empty, the child intact.
9. M-6 answered `UNAUTHENTICATED`: BO-01; signing in as the same `staffUserId` shows the child's
   value; signing in as another does not.
10. M-6, another manager, signing in successfully as a different `staffUserId`: the child is a
    fresh one. Signing in there and failing: M-6 is as it was.
11. Log out, with the server answering 204, 500, and not at all: BO-01, and the child is gone.
12. `FORBIDDEN` on any request: signed out.
13. The activity proof, with the back office's window, and `wheel` counted.
14. No request from this client goes to a path under `/api/pos`; the type has no way to name one.
15. B-12 for the password: after a submission it is in one request body and in no attribute, no
    text node, no storage, no console call and no URL; no input ever has a `value` attribute.
16. No file under `apps/back-office` imports from `apps/pos`, and none under `apps/pos` from
    `apps/back-office`.
17. The built bundle: no fixture marker, plain and with `NODE_ENV=development`; every asset under
    `/back-office/assets/`.
18. `no-invented-values` and `console-free`, copied and passing.
19. No element in the signed-in frame is a link, and no date and no incident is drawn.

### PHASE0-011d: red proofs

- Hold the password in React state with a `value` prop: case 15 fails.
- Key the working area by nothing: case 10 fails.
- Unmount the working area when M-6 opens: case 7 fails.
- Show M-6 on a reload: case 5 fails.
- Import `PinPad` from the POS: case 16 fails.

### The Handoffs must carry forward

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

---

## For the lead

Not decisions for the owner, and not mine to edit.

1. **The brief's "fixture `session`" is a payment session.** See the Summary. The 011c task file
   should say so in words, or a careful builder will do the wrong thing.
2. **One small design task before 011c, and its second half before 011d** (question 9). For the
   designer, in SCREEN-INVENTORY and the Frost artifacts:
   - POS-01 *error*: a body with no count of attempts. ARCH-012 *For the lead* 3 asked this on
     2026-10-09 and it is still open; it now blocks a builder.
   - POS-01 *permission-denied*: delete it (ARCH-012 *For the lead* 2, still open). Until then
     011c leaves the fixture picture alone and wires nothing to it.
   - POS-01: what the pad does with fewer than six digits. I recommend `requireFull`.
   - Both clients: "the system is unavailable" and "something went wrong".
   - BO-01: its states and copy, in Frost or as a table 011d can place into the provisional form.
   - The back office: `FORBIDDEN`, and M-6 after the eight hours.
3. **POS-01's "Your session was ended by a manager" claims more than `UNAUTHENTICATED` proves**
   (question 5). Proposed, for the designer: a sentence that says the session ended and to sign
   in again, and that a manager can help if the PIN no longer works.
4. **M-6 in DESIGN.md and `shell.html` is stale in three places.** It calls the cooldown the
   "LOGIN five-minute cooldown" and "installation-wide"; it is per account (FR-A5b, ADR-009 §4).
   It says "whether the `reauth-other` fixture affects LOGIN counting remains an owner question";
   the owner ruled on 2026-10-06 that the other manager's failures count on their own account.
   And it shows "the manager's name read-only" where the lead's delegated ruling of 2026-10-06
   says the username; `BackOfficeSessionView` carries both, so either can be shown, but the two
   documents should agree.
5. **A question for the designer: the Phase 0 frame.** With no destination, no business day and
   no incident route, 011d shows the frame with an empty rail and an empty pane (question 7). If
   the designer would rather it showed something else, that is a drawing to make before 011d.
6. **SITEMAP `:247-248` and BO-01's inventory entry still say `FR-A5` and a `LOGIN` cooldown**
   (ARCH-012 *For the lead* 1, wording proposed there, still unapplied). The brief noted it; it
   is repeated here only because 011d's builder will read both.
7. **Plan Task 12 has its own faults for its own consult:** a seeder that deletes from
   `audit_entry` (B-7); table and column names that do not exist; a database password on a
   command line; a PIN typed at the back office; an AC-27 test that expects `FORBIDDEN` from a
   sign-in, which never answers it; an AC-28 test that asserts a status where three codes share
   it; and `data-testid` selectors Task 11 will not provide.
8. **The closed-day banner's clearing** (owner, 2026-09-30: "when the first POS session that
   displayed them ends") becomes possible once 011c gives the POS a session. It is still fixture
   data with no day to close, so 011c does not build it; it should be queued, not forgotten.
9. **A watch on the rebuild loop.** If `vite build --watch` proves too slow once Phase 1 has
   screens against real routes, the arrangement ADR-010 left open (Fastify proxying a bundle path
   to Vite behind an explicit flag, the browser staying on the one origin) is the next thing to
   design. Not now.

---

## For the owner

Nothing here blocks PHASE0-011a or 011b. No boundary is touched. **No change to PRODUCT.md,
PRD.md, ROADMAP.md or BOUNDARIES.md is proposed, so there is no replacement wording to approve.**

1. **A reading to confirm: in Phase 0 the served POS shows fixture orders under a real sign-in.**
   After 011c, signing in at `https://localhost:8443/pos/` with a real PIN leads to the floor,
   the orders and the payment screens that exist today. They are pictures: nothing on them is
   stored, and the manager-approval prompts on them verify no PIN, as you ruled for each stand-in.
   The person's name in the corner will be real. I recommend accepting this for Phase 0, because
   the phase demonstrates identity and the screens are how you review everything else, and
   because the mechanism in question 3 forces each picture out as its server command arrives. The
   alternative is that a served sign-in leads to an empty signed-in frame until Phase 2, which
   needs a drawing and hides the screens you have been reviewing.

2. **A risk to acknowledge: the browser may offer to save the manager's password.** The
   application stores no credential anywhere. A browser's own password manager is outside its
   control, and browsers largely ignore a page's request not to be offered. On a machine other
   staff can reach, a saved password is the back office left open. I recommend accepting it for
   the loopback MVP on your own machine and adding it to the review list for the gate in
   ARCHITECTURE §3.2. If accepted, the proposed clause is: *"a review of browser-saved
   back-office passwords on machines that staff share"*.

3. **An ADR to commission.** ADR-010 left "what is served outside `/api`: the bundles, their
   fallback, cache headers and a content security policy" undecided, and this consult decides it
   in a task file that four builders will each read once. It also sets rules that bind every
   client screen in every later phase: one request path; the retry that must not change the
   actor; the server as the only clock; fixtures chosen by the build and proved absent from a
   served bundle; copy owned by the design documents. I recommend one ADR, as `Proposed`, on
   **the browser clients and what is served to them**, amending ARCHITECTURE §3.1, §4.3, §7.2,
   §13 and §14.4. It supersedes nothing. ARCH-012 recommended a sessions-over-HTTP ADR on
   2026-10-09 that DECISIONS.md does not show as commissioned; the two could be one record or
   two, and that is the lead's to propose. Neither need block 011a, as ADR-010 did not block
   008a.

DONE
