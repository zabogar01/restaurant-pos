---
id: PHASE0-011c1
title: The browser transport core, @pos/api-client, with a CSRF retry that never changes the actor
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-011a, PHASE0-011b]
owns: [packages/api-client/**, package.json, package-lock.json]
status: review
cycles: 1
---
# PHASE0-011c1 — The browser transport core (`@pos/api-client`)

**Written** 2026-10-14 by the lead, from the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, by `architect14`, 2026-10-13), which supersedes plan
Task 11. **Do not copy anything from plan Task 11.** The consult's slice 011c (the POS signs in) is
split by the lead into two: **this task, 011c1, builds only the transport core**, a new package with no
React and no screen; **011c2** then wires the POS to it, after the designer's copy for POS-01 is
reviewed. The consult's binding sections are copied below **verbatim**, with their headings moved down
one level; the numbered "questions" they refer to are the consult's sections. Where a copied section
describes the POS, the back office or a screen, that is 011c2's or 011d's work and not this task's;
lead ruling 1 says exactly which rules and cases are yours. Touches identity and boundaries (the retry
rule is B-13's): the owner looks before merge.

## Objective

Neither client may call `fetch` itself. When this task is done, a new package, `packages/api-client`
(`@pos/api-client`), pure TypeScript with `fetch` and a monotonic clock injected at construction,
performs every request a client makes: relative paths from `@pos/contracts`' route table only; request
bodies checked against the shared schemas before sending; the anti-CSRF token held in its closure and
sent as `X-RPOS-CSRF` on every mutation; a refused `CSRF_REFUSED` retried once **only if `me` names the
same `staffUserId` the core already held**; every result classified by `error.code`, never by status,
as success, refused (with typed details), failed or unavailable, with one health read deciding the last
two and no request ever resent; a ten-second timeout; no console, no kept response text; and the one
idle deadline of question 6, set from session views and moved only by a 2xx from an interactive route.
It is proved in the node environment with no network and no DOM.

## Required inputs

- **The consult's sections copied below.** Question 4 is the specification of the core; question 6's
  *The clock in the client* is the deadline; the 011c rules and cases are listed whole, and lead
  ruling 1 says which are this task's.
- **PHASE0-011b as merged** (`.agent/tasks/PHASE0-011b-session-clock.md`, its Handoff and both rounds):
  `@pos/contracts` exports `ROUTE_TABLE` (method, path, `interactive`) in `src/routes.ts`, `CSRF_HEADER`
  in `src/headers.ts`, zod schemas `SessionView`, `BackOfficeSessionView` (each with `idleSeconds` and
  `idleRemainingSeconds`) and `ErrorBody` (which parses to the per-code `ErrorBody` type, so narrowing on
  a code exposes its details), and the request schemas `PosLoginRequest`, `BackOfficeLoginRequest`,
  `ReauthenticateRequest` in `src/auth.ts`.
- **PHASE0-011a as merged:** the policy the browser enforces on a served page (`connect-src 'self'`, so
  relative URLs only); outside `/api` an error is plain text, never the envelope.
- **PHASE0-009a and 009b** (Handoffs): the three codes that share 401 (`UNAUTHENTICATED`, `SESSION_IDLE`,
  `INVALID_CREDENTIALS`); `me` is the way to get a token after a reload; at the back office the token is
  kept through `SESSION_IDLE` because M-6's request needs it (`apps/server/src/http/session-guard.ts`).
- **The repository's packages:** `packages/money` and `packages/contracts` show the package layout
  (`package.json`, `tsconfig.json`, `src/`); the root `package.json` (workspaces, `typecheck`);
  `vitest.config.ts` (the `client` project picks up `packages/*/test/**/*.test.ts` by default).
- **Contract:** ADR-010 rule 1 ("clients treat a non-2xx response with no parseable envelope as a
  transport failure with no code"; "both clients switch on one list of codes"); ARCHITECTURE §2.1, §4.3,
  §16; PRD FR-A2, FR-A2b, FR-A2c, AC-28; BOUNDARIES B-11, B-12, B-13.

## From ARCH-014, question 4: one request path per client (verbatim; binding)

### 4. One request path per client

Authority: ADR-010 rule 1 ("clients treat a non-2xx response with no parseable envelope as a
transport failure with no code"; "both clients switch on one list of codes"); ARCH-012 §3, §5 and
*For the lead* 4; ARCHITECTURE §2.1, §4.3 and §16.

#### Where it lives

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

#### The rules of the core

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

#### How it is tested

In the node environment with `fetch` and the clock injected at construction; no network and no
DOM. The cases are listed under *For the task file*, 011c. The important ones are the three for
rule 5 (same identity retried once; different identity not retried and not released; a second
refusal after the retry is not retried again) and the three for rule 7.

## From ARCH-014, question 6: the clock in the client (verbatim; binding for the deadline)

#### The clock in the client

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

## From ARCH-014, For the task file: PHASE0-011c (verbatim; lead ruling 1 says which parts are this task's)

#### PHASE0-011c: rules

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

#### PHASE0-011c: test cases

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

#### PHASE0-011c: red proofs

- Retry after `CSRF_REFUSED` without comparing identities: case 6 fails.
- Switch on the status: case 4 fails.
- Send `activity` from the countdown tick: case 21 fails.
- Start the countdown at the limit after `me`: cases 11 and 22 fail.
- Switch the session source on `import.meta.env.DEV`: case 27 fails.
- Replace the payment session with the actor session: case 23 fails.
- Keep Release on screen until the server answers: case 20 fails.

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

1. **What is yours.** From *PHASE0-011c: rules*: rule 1 whole, and rule 11 as far as the core goes (no
   credential in a URL, a log or kept text). From question 4: all ten rules except rule 10's client
   half (each client's exhaustive `switch` is 011c2's and 011d's); the core must make that switch
   possible by returning the parsed, per-code `ErrorBody`. From question 6: *The clock in the client*,
   the deadline only; the input listener, the visible countdown and the deadline and visibility reads
   are 011c2's, and the core exposes what they need. From *PHASE0-011c: test cases*: **cases 1 to 12**.
   From *PHASE0-011c: red proofs*: the first two, and the fourth as far as case 11 goes.
2. **Files.** A new `packages/api-client` (`package.json` named `@pos/api-client`, `tsconfig.json`,
   `src/`, `test/`), laid out as `packages/contracts` is; the root `typecheck` script gains
   `tsc -p packages/api-client --noEmit`; `package-lock.json` gains the workspace link and nothing else.
   It depends on `@pos/contracts` (and `zod` through it) and on nothing else at runtime. Tests in
   `packages/api-client/test/`, each test name starting with the consult's case number.
3. **The interface is yours to design**, within these lines: one constructor taking the surface
   (`POS` or `BACK_OFFICE`), `fetch` and the monotonic clock (and a timer source if the timeout needs
   one); requests addressed by route-table entry, never by a free URL string; a typed result union of
   success, refused, failed and unavailable; a way to read and subscribe to the deadline and to the
   session's end (the token dropped, or `me` naming someone else). Write the interface into the
   Handoff in full, because 011c2 and 011d build on it.
4. **What the surface changes.** At the POS, `SESSION_IDLE` drops the token; at the back office it is
   kept (case 12). Nothing else differs between the two; anything that would is a client's, not the
   core's.
5. **No React, no DOM.** Only `fetch`, `AbortSignal` and what you inject. A test fails if the package
   imports `react`, touches `document` or `window`, or calls `console`, storage, cookies or a beacon.
6. **Nothing in `apps/` changes.** No client constructs the core yet; 011c2 does.
7. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
8. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you observed.
   Do not work around a rule.
9. **No database is needed.** These are client-project tests in the node environment.

## Constraints

- B-13: a retried request is never carried out as a different person than the one the core held.
- B-11 and B-12: relative paths only, never `http:`; no credential in a URL, a log or kept text.
- ADR-010 rule 1: switch on `error.code`, never the status; a non-2xx with no parseable envelope is a
  transport failure with no code.
- ARCHITECTURE §14.4: no wall clock; the deadline uses the injected monotonic clock.
- No automatic resend of a request that may have been applied (question 4, rule 7).

## Tests expected to change

None. This task adds a package and its tests and changes only the root `typecheck` script and the
lockfile. Any change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline.
   **Baseline (lead, 2026-10-13):** `development` at `2dfc26d`, 70 test files and 3365 tests, green.
2. The new test files are each green three times in a row alone; the Handoff maps cases 1 to 12 to test
   names.
3. The red proofs named in lead ruling 1 made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rnE "react|document|window|console\.|localStorage|sessionStorage|navigator\.sendBeacon|Date\.now|new Date\(" packages/api-client/src`
   (nothing, or each hit shown to be a comment), and `grep -rn "http:" packages/api-client/src` (nothing).
5. The Handoff gives the core's interface in full and says what 011c2 (the POS) and 011d (the back
   office) need from it that it does not provide.

## Out of scope

- Any change under `apps/`. The POS session store, POS-01, the activity listener, the visible countdown,
  the fixture switch, the built-bundle marker test (011c2). The back office (011d).
- Copy of any kind. Any server change. `docs/` of any kind. The ADR.

## Round 2 — the review's two findings (lead rulings, 2026-10-14)

The review is `.agent/reviews/PHASE0-011c1-review.md` (Codex, two P2). Both are accepted. Addressed to
the builder.

1. **Finding 1: an obsolete response must not change the current session.** Give the core a session
   generation: it advances whenever a session is installed (a sign-in, a re-authentication, a session view
   naming a different person) or ends (release, logout, `SESSION_IDLE` at the POS, `UNAUTHENTICATED`,
   `FORBIDDEN`, `ACTOR_CHANGED`). Every request, and every `me` read on the CSRF path, records the
   generation it was sent under. When it settles under a different generation, it changes nothing: no
   token, actor or deadline is adopted, dropped or moved, and no event is emitted for it. Its result is
   `{ kind: 'session-gone' }` if it would otherwise have returned or applied a session view or a session
   end; any other result (health, a refusal that ends nothing) is returned unchanged. A sign-in is the one
   request whose success installs a new generation; two sign-ins in flight at once are resolved by the
   later-settling one only if no other session was installed in between, and you say in the Handoff how
   you handled it.
2. **Prove it with controlled out-of-order tests**, both of the reviewer's sequences: (a) sign in as A,
   start `me`, release (204), then deliver `me`'s 200: the actor and deadline stay null, the result is
   `session-gone`, and the next mutation carries no token; (b) sign in as B while an older request is in
   flight, then deliver that request's `UNAUTHENTICATED`: B is still held, with B's token on the next
   mutation. Add the same for an interactive 2xx arriving after release (the deadline is not moved) and
   for the CSRF path's `me` arriving after release. Show the new tests failing on the current code first.
3. **Finding 2: no result exposes the token.** The validated wire view stays inside the core. A session
   view in a result is a public value with every field except `csrfToken` (`staffUserId`, `name`, `role`,
   `idleSeconds`, `idleRemainingSeconds`, and `username` at the back office). `ValueOf` reflects that at
   compile time. Prove, for every session-view route on both surfaces (both sign-ins, both `me`,
   re-authentication), that the result has no `csrfToken` property at runtime, that a type-level
   `@ts-expect-error` refuses `result.value.csrfToken`, and that the next mutation still sends the token
   the core adopted.
4. **Interface.** Update the interface in the Handoff for whatever changes. 011c2 will read it.
5. Everything else in round 1 stands. Append a *Round 2* section to the Handoff, commit after
   `npm run verify` is green, and end with DONE or BLOCKED as before.

## Handoff

### What I did

Added `packages/api-client` (`@pos/api-client`): `package.json`, `tsconfig.json`, `src/specs.ts`
(per-route body and response schemas, held to the route table by `satisfies Record<RoutePath, Spec>`),
`src/client.ts` (the core), `src/index.ts`; `test/support.ts`, `test/core.test.ts` and
`test/pure.test.ts`. The root `typecheck` script gains `tsc -p packages/api-client --noEmit`;
`package-lock.json` gains only the workspace link. Nothing under `apps/` changed and no existing test
changed. The commit is on `agent/phase0-011c1`, made after verify was green (hash in `git log`).
No formatter was run.

### The interface (for 011c2 and 011d)

```ts
createApiClient(options: {
  surface: 'POS' | 'BACK_OFFICE';
  fetch: FetchLike;          // (url, init) => Promise<{ status: number; text(): Promise<string> }>; the platform fetch fits
  now: () => number;         // monotonic ms, e.g. () => performance.now()
  setTimer?: (fire, ms) => cancel;   // defaults to setTimeout/clearTimeout
  timeoutMs?: number;        // default 10_000
}): ApiClient

ROUTES  // by name, from ROUTE_TABLE: health, posLogin, posMe, posActivity, posRelease,
        // backOfficeLogin, backOfficeMe, backOfficeActivity, backOfficeLogout, backOfficeReauthenticate

ApiClient {
  surface
  request(route, ...body): Promise<ApiResult<value>>   // body argument exists only for routes with a request schema
  deadline(): number | null          // idle deadline on the injected clock
  staffUserId(): string | null       // who the core holds; the token is never exposed
  subscribe(listener): unsubscribe   // listeners must not throw
}

ApiResult<T> =
  | { kind: 'ok'; value: T }                       // value checked against its schema; void for 204 routes;
                                                   // a session view WITHOUT csrfToken (round 2)
  | { kind: 'refused'; body: ErrorBody }           // narrow on body.error.code; details are typed per code
  | { kind: 'failed' } | { kind: 'unavailable' }   // decided by one GET /api/health
  | { kind: 'invalid-request' }                    // body failed its schema; never sent
  | { kind: 'session-gone' }                       // CSRF refusal whose retry would have changed the actor,
                                                   // or (round 2) an obsolete response that would have applied a view or an end

ApiEvent =
  | { type: 'deadline'; deadline: number | null }
  | { type: 'session-ended'; reason: 'SESSION_IDLE' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SIGNED_OUT' | 'ACTOR_CHANGED' }
  | { type: 'actor-changed'; staffUserId: string }
```

Calling a route of the other surface throws (a programming error); health is open to both.

### What I decided, and on what evidence

- **Fault codes.** Rule 6 says switch on the code, and case 9 says a 500 with an envelope is *failed*. I
  resolved it by code: an envelope carrying `INTERNAL` or `UNAVAILABLE` is a fault (health decides); every
  other envelope is *refused* whatever its status. The status is read for 2xx versus not, and for nothing
  else.
- **`me` in the CSRF path adopts nothing until the identity is compared.** If it names someone else the core
  drops its own session (`session-ended`, reason `ACTOR_CHANGED`), holds no token, sends no release, and
  returns `session-gone`. A core that held nobody returns `session-gone` without reading `me`. If `me`
  itself is refused (e.g. `SESSION_IDLE`) or faults, that result is returned.
- **Retry identity is the actor held at the moment the request was sent**, not at refusal time, so a request
  made before another sign-in in the same tab is never carried out as the new person.
- **Release and logout end the session in the core whatever the server answers** (`SIGNED_OUT`), after any
  CSRF retry has run. The client's own screen rule is 011c2's.
- **A session view naming a different person than the one held** (a later `me`, a sign-in over another
  session) is adopted and announced with `actor-changed`; the core cannot know what the client wants.
- **`session-ended` is emitted only if a token or deadline was held**, so a first-load `me` answering
  `UNAUTHENTICATED` emits nothing.
- **At the back office `SESSION_IDLE` keeps token and actor but clears the deadline**; `UNAUTHENTICATED`
  drops everything at both surfaces.
- No separate zod import: schemas are taken structurally (`Schema<T>`), so the package's only runtime
  dependency is `@pos/contracts`. Health's `{status:'ok'}` is checked by a small hand-written guard.

### Case map (all in `packages/api-client/test/core.test.ts`)

1: four tests named `1. …` (GET, POST no body, POST with body, relative path). 2: `2. a sign-in view
replaces the token…`. 3: two `3.` tests. 4: two `4.` tests. 5, 6 (two), 7, 8: `5-8. CSRF_REFUSED`. 9: five
`9.` tests (500 envelope, 502 HTML, rejected fetch, 503 health, timeout). 10: one. 11: five. 12: three.
`pure.test.ts` is rule 5 of the lead rulings (no react, DOM, console, storage, cookie, beacon, wall clock,
`http:`, `127.0.0.1` or `import.meta` in `src`, comments stripped).

### Red proofs (each made, run, reverted)

1. Retry without comparing identities (`if (false && me.view.staffUserId !== actorAtSend)`): case 6
   `someone else on me` failed (`expected {kind:'unavailable'} to equal {kind:'session-gone'}`: the second
   request was actually sent, so the unscripted fetch faulted). 1 failed, 33 passed.
2. Switch on the status (envelope accepted only when `status === 401`): case 4's 401/403/429 test failed,
   and five CSRF tests failed with it (they use 403). 6 failed.
3. Deadline from the limit rather than the remaining seconds (`idleSeconds` in `adopt`): case 11's two
   `me` tests failed (`expected 301000 to be 121000`; `401000` vs `301000`). 2 failed.

All three were reverted; the final run is green.

### Existing tests changed

None.

### Found and not fixed

- `vitest.config.ts` prints a Vite warning about ESM syntax loaded as CommonJS on every run. Existing,
  not mine.
- The consult's rule 5 talks of the first tab's token no longer matching the cookie; the core cannot tell
  a stale token from a refused one other than by `me`, which is as specified.
- Case 11's "not moved by `me`" can only mean "not moved to the limit": a `me` is a session view and
  re-bases the deadline on its `idleRemainingSeconds`, as question 6 says. The test shows that.

### Verification

- `npm run verify`: typecheck clean; **72 test files, 3399 tests passed** (baseline 70 files, 3365; the
  difference is my 2 files and 34 tests).
- The new files alone, three runs in a row: 2 files, 34 tests, green each time.
- `grep -rnE "react|document|window|console\.|localStorage|sessionStorage|navigator\.sendBeacon|Date\.now|new Date\(" packages/api-client/src`: no output.
- `grep -rn "http:" packages/api-client/src`: no output.

### What 011c2 and 011d need that the core does not provide

- The countdown tick, the input listener, the visibility read and the deadline read are theirs: the core
  only holds `deadline()` and announces it. When the deadline passes, the client calls
  `request(ROUTES.posMe)` (or the back-office `me`).
- The exhaustive `switch` over `ErrorCode` with a `never` check, per client.
- The session view itself is returned in `ok` results; the core does not keep `name` or `role`.
- Nothing yet constructs the core in `apps/`; `console-free.test.ts` is not tightened (011c2).
- There is no idempotency key and no resend: a Phase 2 command needs its own design (ARCH-012 §5).

## Round 2

Addresses the review's two findings (lead rulings in *Round 2* above). Round 1 stands except where
stated.

### Finding 1: session generations

- **Mechanism.** The core keeps `generation`, advanced whenever a session is installed (a sign-in, a
  re-authentication, or a session view naming a different person than the one held) and whenever a session
  ends (`SESSION_IDLE` at either surface, `UNAUTHENTICATED`, `FORBIDDEN`, `ACTOR_CHANGED`, release and
  logout). Every request records the generation it was sent under, as does the CSRF path's `me` read. A
  response that settles under another generation changes nothing: no token, actor or deadline adopted,
  dropped or moved, and no event emitted. Its result is `session-gone` if it would have applied a session
  view or an end (a session-view 2xx; `SESSION_IDLE`, `UNAUTHENTICATED` or `FORBIDDEN`); any other result
  (an interactive 2xx, another refusal, `failed`/`unavailable`) is returned as it was, still without
  touching the session.
- **`FORBIDDEN` now ends the session** (it was not ending it in round 1; the ruling lists it). Reason
  `FORBIDDEN` is added to `SessionEndReason`. My round-1 case 11 test used `FORBIDDEN` as "a refusal that
  ends nothing"; I changed that one line in `core.test.ts` to `VALIDATION_FAILED`, which is what it meant.
  No assertion was loosened.
- **Two sign-ins at once.** A sign-in is judged by an `installs` counter, not by the generation: it is
  obsolete only if another session was installed since it was sent. So the first to settle installs, and
  the other settles `session-gone` and is not adopted (the ruling's "later-settling only if nothing was
  installed in between", read as: it never is, since the first-settling one installed). A release or an
  idle end in flight does not make a sign-in obsolete (otherwise a person signing in while a release was
  still travelling would be shown signed out with a live cookie). Test `13f`, both.
- **Release** ends the session in the core only if the generation is unchanged since it was sent; a
  release settling under a newer session ends nothing of it.
- **The CSRF path.** An obsolete first refusal is returned unretried. The single-flight `me` is joined only
  by a request of the same generation (a request of a newer session starts its own read). After the read,
  if the generation moved, the result is `session-gone` and nothing is adopted or retried. A `me` that
  itself answers a refusal under the same generation returns that refusal, as in round 1.
- Not changed: a `me` naming the same person, on the non-CSRF path, replaces the token without advancing
  the generation (it installs no new session).

### Finding 2: no result exposes the token

The wire view, with `csrfToken`, stays inside the core; the result carries every other field (`username`
too at the back office). `ValueOf` strips `csrfToken` at the type level (`WithoutToken`), so
`result.value.csrfToken` does not compile. Tests `14`, for both sign-ins, both `me` and
re-authentication: `'csrfToken' in value` is false at runtime, a `@ts-expect-error` refuses
`result.value.csrfToken` (and `npm run typecheck` includes the tests, so an unused one would fail), the
whole result serialises without the token, and the next mutation sends the token the core adopted.

### Interface changes (for 011c2 and 011d)

- `ok` session-view values lack `csrfToken`. 011c2's store must not expect it.
- `SessionEndReason` gains `'FORBIDDEN'`; a client must map it in its exhaustive switch.
- `session-gone` can now also mean "that response was obsolete"; a client treats it as: do nothing about
  the session on account of this request; the events already told you the truth.
- Nothing else in the interface changed.

### Tests (`packages/api-client/test/generations.test.ts`, 14 tests)

`13a` (`me` after release: nothing held, `session-gone`, next mutation has no token), `13b` (older request's
`UNAUTHENTICATED` after signing in as B: B held, B's token next), `13c` twice (an interactive 2xx after
release leaves the deadline null; one arriving under a later session B with a 60-second limit leaves B's
deadline), `13d` (the CSRF path's `me` after release: no retry, nothing adopted), `13e` (a request of a
newer session does not join the older session's `me`), `13f` twice (two sign-ins; release in flight),
`14` five times (one per session-view route), and one for `FORBIDDEN`.

**Red first.** I ran the new file against the round-1 source (`git checkout HEAD -- packages/api-client/src`,
then restored the round-2 source from a copy): 12 of 13 then failed, with the failures shown by
vitest (`13a` got `{kind:'ok', value:{… csrfToken:'token-A' …}}` where `session-gone` was expected; `13b`
got `refused UNAUTHENTICATED`; `13d` got `unavailable`; `13e` made one `me` instead of two; `13f` the
first sign-in was adopted and the release logged B out; all five `14` and `FORBIDDEN` failed). The one
that passed was `13c` (release first), because round 1 nulls the limit at release; so I added the second
`13c`, with a later session B, and ran that alone against round-1 source: `expected 61000 to be 66000`.
Round-2 source restored; all green.

### Verification

- `npm run verify`: typecheck clean (including `@ts-expect-error` lines); **73 test files, 3413 tests
  passed** (baseline 70 and 3365; round 1 was 72 and 3399).
- `grep -rnE "react|document|window|console\.|localStorage|sessionStorage|navigator\.sendBeacon|Date\.now|new Date\(" packages/api-client/src`: no output.
- `grep -rn "http:" packages/api-client/src`: no output.
- Only `packages/api-client` and this file changed; no formatter was run.

DONE
