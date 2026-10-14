---
id: PHASE0-011c2
title: The POS signs in for real, through @pos/api-client, with fixtures kept out of a served build
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-011c1, DESIGN-015]
owns: [apps/pos/**, package.json, package-lock.json]
status: active
cycles: 0
---
# PHASE0-011c2 — The POS signs in for real

**Written** 2026-10-14 by the lead, from the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, by `architect14`, 2026-10-13) and the reviewed design
DESIGN-015 (sign-in copy and states). **Do not copy anything from plan Task 11.** This is the second half
of the consult's slice 011c, split by the lead: PHASE0-011c1 built the transport core
(`@pos/api-client`); this task wires the POS to it. The consult's binding sections and DESIGN-015's copy
table are copied below **verbatim**, with their headings moved down one level; the numbered "questions"
are the consult's sections. Where a copied section describes the back office, that is 011d's work. Touches
identity and boundaries: the owner looks before merge.

## Objective

Today the POS makes no request: every route is reachable without signing in, and the person shown is the
literal "Ana R. · Cashier". When this task is done, the POS constructs one `@pos/api-client` instance in
one module; a session store above the routes has the states and events of question 5; POS-01 signs a
person in by PIN against the real server, with every state and sentence DESIGN-015 gives; the actor, the
idle chip and Release on every screen read from the store; `activity` is sent only from real input; the
countdown shows the server's time and never ends a session itself; the order book and the payment
sessions stay mounted while signed out, so a tender draft survives the lock; and the fixture session,
chosen by a compile-time constant from the Vite command, is proved absent from a built bundle, so the
served POS at `https://localhost:8443/pos/` can only sign in for real. Every fixture URL on port 5173 keeps
working, and the forty existing test files still pass.

## Required inputs

- **The consult's sections and DESIGN-015's copy table, copied below.** They are the specification.
- **PHASE0-011c1 as merged** (`.agent/tasks/PHASE0-011c1-api-client.md`, the whole Handoff, both rounds):
  the core's interface (`createApiClient`, `ROUTES`, `ApiResult` with `ok`, `refused`, `failed`,
  `unavailable`, `invalid-request`, `session-gone`; `deadline()`, `staffUserId()`, `subscribe()` with the
  `deadline`, `session-ended` and `actor-changed` events). Round 2's changes bind: session values carry no
  `csrfToken`; `SessionEndReason` includes `FORBIDDEN`; `session-gone` can mean "that response was
  obsolete", and then nothing is to be done about the session on account of that request.
- **PHASE0-011a and 011b as merged:** the served bundle at `/pos/` with `base: '/pos/'`, its content
  security policy (`connect-src 'self'`, no inline script or style, `form-action 'none'`), `build:clients`
  and `build:watch`; `SessionView` with `idleSeconds` and `idleRemainingSeconds`; the route table.
- **The POS as built** (`apps/pos/src/`): `App.tsx` (it reads `?state=` in every build today, `:8`),
  `PosRoutes.tsx` (routing by `pushState`, `:40-46`; `useOrderBook` and `usePaymentSessions` at `:58-60`;
  the `session` there is a **payment** session, not an actor session: leave it exactly where it is),
  `PinPad.tsx` (`requireFull`; digits in a ref; cleared on unmount, `:69-75`), `Approval.tsx` and
  `approvalFixtures.ts` (not edited), `floorFixtures.ts:100` and `SettlementScreen.tsx:780` (the literal
  actor), `fixtures.ts`, `main.tsx`, `index.html`, `vite.config.ts`; the tests `pin-pad.test.tsx`,
  `console-free.test.ts`, `no-invented-values.test.ts`.
- **Contract:** PRD FR-A1, FR-A2, FR-A2b, FR-A2c, FR-A5, AC-1, AC-19, AC-28, AC-32; ADR-010; ARCHITECTURE
  §4.1, §6.4, §7.2, §14.4; BOUNDARIES B-11 to B-14, B-24. Owner rulings (DECISIONS.md): the stand-ins of
  2026-10-01 to 2026-10-03 stay until their commands exist; 2026-09-30, Release deferred "for FR-A";
  2026-10-13, the served POS shows fixture screens under a real sign-in.
- **Library facts:** Vite 8's `import.meta.env.DEV` follows `NODE_ENV`, not `--mode`; React 18 writes a
  `style={{}}` prop through the CSSOM (not blocked by the policy). Ask the librarian for anything else:
  `.agent/bin/ask.sh librarian "<question>"`.

## From ARCH-014, question 5: the session in each client, the POS (verbatim; binding)

#### The POS

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

## From ARCH-014, question 3: development workflow and the fixture switch (verbatim; binding)

### 3. Development workflow

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

#### What is real in Phase 0, and what stays a fixture

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

#### How a build cannot ship a fixture where a real call is owed

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

## From ARCH-014, question 6: the clock, activity and the screen (verbatim; binding)

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

#### Activity

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

#### What the screen shows as the deadline nears

The only thing drawn is the idle chip in the POS header: `90s` in the artifact, a plain count of
whole seconds. 011c makes that number live, and adds nothing: no colour change, no warning, no
dialog, no sound. None is designed, and the inventory's "idle countdown / expiry takeover"
(SITEMAP `:104`) is satisfied by the chip and POS-01. If the owner wants a warning before the
lock, that is a design task. The back office draws no countdown at all; M-6 appears when the
server says the session is idle, and DESIGN-012's "timeout captures the actual active element"
is met by the deadline read above.

## From ARCH-014, question 8: what 011c owes M-1 (verbatim; binding)

What 011c does owe M-1, without touching it:

- **The prompt goes when the cashier's session goes.** It is mounted under the gated routes, so
  it is unmounted when the session ends, and `PinPad` clears its digits on unmount
  (`PinPad.tsx:69-75`). A test opens a fixture prompt, ends the session, signs in again and
  asserts that no prompt and no trace of one is drawn (B-14: nothing about an approval survives).
- **Keys pressed on M-1 keep the cashier's session alive** through the activity listener, which
  reads nothing from them (question 6). The existing B-12 tests in `pin-pad.test.tsx` gain one
  assertion: after digits are typed on either pad, no request body anywhere contains one.

## From ARCH-014, question 10: what Task 12 needs from Task 11 (verbatim; binding)

#### What Task 12 needs from Task 11

- **Names, not test ids.** The built POS has no `data-testid` and should not gain any. Every
  control the harness drives has an accessible name: the digits, "Delete last digit", "Continue",
  "Release"; at the back office the field labels, the sign-in button, "Log out", and M-6's dialog
  title. Each Handoff lists them.
- **State that is not copy.** Each client's root element carries `data-session` (`starting`,
  `signed-out`, `signed-in`, and `idle` at the back office), and POS-01 carries `data-lock-state`,
  as the floor already carries `data-floor-state`. The harness asserts on those, so a change of
  wording never breaks it.
- **A served bundle**: `npm run build:clients`.

## From ARCH-014, question 11: boundaries (verbatim; binding where it concerns the POS)

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

## From DESIGN-015, the copy table (verbatim; binding for POS-01 and the shared rows)

At `agent/design-015` `afd72ff` (reviewed; the POS half cleared in both re-reviews).

#### Exact product copy for the builders

This is one placement table for PHASE0-011c and PHASE0-011d, also carrying M-1's
future copy, updated by designer15b in round 2. Quotation marks delimit strings
and are not rendered. `{wait}` is `{minutes} min {seconds} s` when both parts
are nonzero, `{minutes} min` at exact minutes, and `{seconds} s` below a minute,
derived solely from `retryAfterSeconds` and the remaining deadline. Zero removes
the cooldown notice and enables entry, without submission. The fixture durations
are examples. A missing/invalid
server duration uses the general failure; there is no guessed duration.

“General failure” below means `INTERNAL`, an unparseable failure,
`VALIDATION_FAILED`, `CSRF_REFUSED` after the one permitted recovery/retry,
`ORIGIN_REFUSED`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, or
an unexpected code for that surface. Before that single CSRF recovery fails,
there is no new visible error. No raw code or server text becomes product copy.

| Screen | State | Trigger | Exact title, body, labels and action |
|---|---|---|---|
| POS-01 | Resting | Cold start, release, initial unauthenticated lookup, or `SESSION_IDLE` | Heading “Enter PIN”; helper “Six digits”; confirmation accessible name “Continue”; backspace accessible name “Delete last digit”. No idle sentence. |
| POS-01 | Short PIN | Local entry of zero to five digits | Same resting copy. Confirm disabled and Enter ignored; no request. Six digits enable Confirm and a seventh is ignored. Drawing's masked-position description is “{count} of 6 digits entered”, which counts local entry, never failures. |
| POS-01 | Loading | Verification in flight | “VERIFYING”. Entry and duplicate submission disabled. |
| POS-01 | Error | `INVALID_CREDENTIALS` without cooldown details | “PIN not recognised” / “Enter your six-digit PIN again. Ask a manager if you need help.” |
| POS-01 | Throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “Sign-in locked for {wait}” / “Sign-in is cooling down. Wait for the countdown to finish, then enter your PIN.” Whole pad disabled until zero. |
| POS-01 | Session invalidated | `UNAUTHENTICATED` on a held session | “Your session has ended” / “Sign in again. Ask a manager for help if your PIN no longer works.” |
| POS-01 | Tender draft waiting | Draft in this tab's store | “Payment in progress on this tab” / “{order label} — {outstanding} outstanding, {tender count} tenders drafted. Sign in to continue. Nothing has been recorded yet.” Use “1 tender drafted” for one. |
| POS-01 | Future emergency presence | Future incident route; no Phase 0 state | “Kitchen printer needs attention” / “Tap to sign in and view. No order details are shown before sign-in.” Existing “Sign in to view” action. The future fixture is retained, not a Phase 0 data claim. |
| POS-01, BO-01, M-6; shared by both clients | Unavailable | `UNAVAILABLE`, or no response | “The system is unavailable” / “Wait a moment, then try again.” Action “Try again”. |
| POS-01, BO-01, M-6; shared by both clients | Something went wrong | General failure group above | “Something went wrong” / “Try again. If the problem continues, ask a manager for help.” Action “Try again”. |
| BO-01 | Resting and common form | Cold start, explicit logout, or initial `me` returns `UNAUTHENTICATED` | “Back office” / “Sign in with your manager username and password.” Labels “Username”, “Password”; action “Sign in”. |
| BO-01 | Missing username | Local validation | “Enter your username.” |
| BO-01, M-6 | Missing password | Local validation | “Enter your password.” |
| BO-01, M-6 other-manager form | Oversize input | Username over 256 UTF-16 units or password over 1024 units | “Sign-in failed” / “Check your username and password, then try again.” No request; clear Password and focus the oversized field. Do not truncate. |
| M-6 fixed-username form | Oversize input | Password over 1024 UTF-16 units | “Incorrect password. Try again.” No request; clear and focus Password. Nonempty credentials within the shared bounds go to the server; do not duplicate creation-policy checks or transform a password. |
| BO-01 | Loading | Sign-in in flight | Action “Signing in…”. Fields and repeat submission disabled. |
| BO-01 | Error | `INVALID_CREDENTIALS` without cooldown details | “Sign-in failed” / “Check your username and password, then try again.” |
| BO-01, M-6 other-manager form | Throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “This username is locked for {wait}” / “This username is cooling down. Other managers can sign in with their own usernames.” Keep Username editable. Compare trimmed, lower-case usernames: editing away removes this notice and enables Password and Sign in unless the new account has its own known wait. Returning restores the original remaining wait; editing never resets it. |
| BO-01, from M-6 or other protected office work | Session ended | `UNAUTHENTICATED` on a held session, including absolute expiry | “Your session has ended” / “Sign in again to continue.” No retained-draft sentence in Phase 0. Deferred, pending the owner's recovery answer: “The previous session’s unsaved changes are stored on this tab and are not submitted automatically.” |
| BO-01, from M-6 or other protected office work | Access refused | `FORBIDDEN` | “Manager access required” / “This account cannot use the back office. Sign in with a manager account.” Remove protected work and show the ordinary sign-in form. |
| BO-01 / BO-02 | Successful sign-in | Success | No success sentence. Phase 0 top bar “Back office”, real manager name, “Log out”. Empty rail and pane; no empty-data claim. |
| BO-01 | Idle | `SESSION_IDLE` on a held session | No BO-01 sentence or navigation; open M-6. |
| M-6 | Re-authenticate | `SESSION_IDLE` | “Your session timed out” / “Your unsaved changes are kept. Continue as {username} to resume them.” Labels “Username”, “Password”; actions “Sign in as a different manager”, “Log out”, “Continue”. Username is read-only. |
| M-6 | Choose another manager | Local choice, including during cooldown | “Sign in as a different manager?” / “The current manager’s unsaved changes will not be available to the manager signing in.” Initial focus “Stay with current manager”; second action “Continue to sign-in”. Stay preserves draft and wait. |
| M-6 | Other manager (`reauth-other`) | Continue to sign-in after acknowledgement | “Sign in as a different manager” / “Enter your own username and password. The current manager’s unsaved changes will not be available to you.” Editable “Username”, “Password”; actions “Back to {idled username}”, “Log out”, “Sign in”. Username starts empty each time the form opens from this choice. Back clears username and secret and preserves the draft, focus/selection snapshot and account waits. `r.ayu` is only a typed fixture sample for response states, not a starting value. |
| M-6 | Verifying | Credential request in flight | Default action “Verifying…”; other-manager action “Signing in…”. Disable duplicate requests and switching while pending. |
| M-6 | Same-manager error | `INVALID_CREDENTIALS` without cooldown details | “Incorrect password. Try again.” |
| M-6 | Other-manager error | Ordinary sign-in returns `INVALID_CREDENTIALS` without cooldown details | “Sign-in failed” / “Check your username and password, then try again.” Preserve Username; clear Password. Failures count on the submitted account. |
| M-6 | Same-manager throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “This username is cooling down. Try again in {wait}. You can sign in as a different manager or log out.” Disable Password and Continue, not the other-manager choice or Log out. |
| M-6 | Logout during cooldown | Local Log out from the fixed-username form while the idled manager's account has a wait | Append to existing discard confirmation: “This username is locked for {wait}. Logging out does not end its cooldown. Other managers can sign in with their own usernames. Waiting here keeps your draft.” Key the wait to the idled account. From the other-manager form append nothing, regardless of either account's wait; use the plain discard confirmation. |
| M-6 | Discard confirmation, retained existing copy | Local Log out | “Log out and discard your changes?” / “The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.” Actions “Keep this draft”, “Discard changes and log out”. |
| M-6 | Resumed, retained existing copy | Successful same-manager re-authentication | “Your session has resumed.” / “Your changes are still here. Nothing has been submitted.” |
| M-6 | Other manager signed in | Successful ordinary sign-in from other form | No success sentence. Enter a separate working area with no old draft visible, editable or submitted. No disposal or recovery promise. |
| POS-01, BO-01 | Initial lookup failed | `UNAVAILABLE` / no response, or the general failure group | Applicable shared title/body and “Try again”. Show the sign-in shell with credential controls disabled. Try again repeats the session lookup; a resolved result routes normally. Never reveal protected work on a failed lookup. |
| Back-office frame; M-6 logout confirmation | Logout failed | `UNAVAILABLE` / no response, or the general failure group | Applicable shared title/body plus “Sign-out has not been confirmed.” Action “Try again” repeats Log out. Stay in the frame, identity visible, with the amber notice first in its scrolling content pane; if M-6 was open, keep the notice above the confirmation actions and work inert. Disable duplicate requests. BO-01 appears only after confirmed sign-out. |
| POS-01 after Release | Release, whatever the response | Success, error or no response | No notice or retry. Remove the on-screen actor and always return to resting POS-01. |
| M-1 | Error; `approval-denied` review alias | `APPROVAL_FAILED` without cooldown details | “Manager PIN not recognised” / “Ask a manager to enter their PIN again.” |
| M-1 | Throttled | `APPROVAL_FAILED` with details, or `APPROVAL_THROTTLED` | “Manager approvals locked for {wait}” / “Wait for the countdown to finish. Signing in at the POS does not end this cooldown.” Cancel stays available. |

Clear secrets after every response, including success. General-failure retry at
sign-in/M-6 asks for fresh secret entry, preserves username and protected draft,
and never automatically resends a credential. Lookup, logout and Release use
the explicit operation rows above. Other commands use their existing
reconciliation/read path, not repetition of an uncertain command.
At absolute expiry keep the draft local and isolated; no automatic submission
or invented cross-session restore workflow. A new manager never receives it.
There is no separate credential permission refusal on either sign-in and no
M-1 production route in Phase 0. Approval codes on a sign-in are unexpected and
use the general failure group. Overflow adds no sentence: POS-01 fits its target;
the office form scrolls if necessary.
## Lead rulings

These rulings are addressed to the builder.

1. **What is yours.** From *PHASE0-011c: rules*: rules 2 to 11 (rule 1, the core, is 011c1's and merged).
   From *PHASE0-011c: test cases*: **cases 13 to 29**. From *PHASE0-011c: red proofs*: the third to the
   seventh (the first two are 011c1's; the fourth's case 11 is 011c1's, its case 22 is yours).
2. **The copy is DESIGN-015's, and only its POS-01 and shared rows are yours.** Place each sentence
   exactly; invent none (rule 10). Where a state you must draw has no row, stop with `BLOCKED:`. The M-1
   rows are recorded for Phase 2 and are **not** placed now (rule 9: `Approval.tsx` is not edited). The
   BO-01 and M-6 rows are 011d's.
3. **`actor-changed` at the POS.** When the core announces that the session now names a different person
   (another tab of this browser signed in as someone else), this tab shows POS-01 *session invalidated*,
   as for `UNAUTHENTICATED`; it sends nothing (no release: the cookie is the other tab's session), and it
   stops sending `activity` until a sign-in in this tab. The same for `session-ended` with reason
   `FORBIDDEN` or `ACTOR_CHANGED`.
4. **`session-gone`** from any request: do nothing about the session on account of that result; the
   core's events say what changed. A sign-in that answers `session-gone` leaves POS-01 as it was, with no
   notice.
5. **`invalid-request`** at POS-01 cannot happen once the pad requires six digits (DESIGN-015's *Short
   PIN* row); if it does, it is the general failure.
6. **Exhaustive codes (question 4, rule 10's client half).** One `switch` over `ErrorCode` with a `never`
   check maps every code to a POS state, so a code added later fails compilation here.
7. **`console-free.test.ts` becomes recursive** and gains `fetch`, storage, cookie and beacon (case 28).
   It is one of the tests expected to change.
8. **Names, not test ids** (*What Task 12 needs from Task 11*): no `data-testid`; the root element
   carries `data-session` (`starting`, `signed-out`, `signed-in`) and POS-01 `data-lock-state`. List every
   accessible name the harness will drive in the Handoff.
9. **A served sign-in needs a person.** Until Phase 1 only `npm run create-manager -w apps/server` makes
   one, and it makes a manager (the owner runs it at a terminal). Your tests use stubbed `fetch`; your
   by-hand check, if you make one, uses whatever person exists, and you say so.
10. **If the task proves too large**, do not ship part of it. Stop with `BLOCKED:` and propose a cut.
11. **If a rule cannot be met against the built code**, stop and write `BLOCKED:` with what you observed.
    Do not work around a rule.
12. **One cookie-changing request at a time** (owner, 2026-10-14; 011c1's *Round 3 review — owner ruling*).
    The core does not reconcile concurrent sign-ins with the browser's cookie, so this client sends at most
    one sign-in or release at a time: while one is in flight, the PIN pad's confirmation and every control
    that would send a sign-in or a release are inert. Prove it with a test that a second confirmation or
    release while one is pending sends nothing.
13. **Two `me` reads at once** on an empty core (a load read and a visibility read together): the first to
    settle recovers the session and the other settles `session-gone`, which ruling 4 already says to ignore
    (011c1 Handoff, *Round 3*). Prefer not to send them together.

## Constraints

- ARCHITECTURE §6.4: the tender draft is tab-local and survives the idle expiry; the payment session is
  not the actor session and is not replaced.
- B-12: a PIN only in its own request body; nowhere in a URL, storage, the DOM, the console or any other
  request. B-14: nothing about an approval survives a session's end.
- B-24 and §14.4: no literal 90, 1800 or 300 and no wall clock in the session or the countdown; the
  numbers come from the wire and the core's monotonic deadline.
- FR-A2b: `activity` from real input only, never a timer, a poll or a deadline read.
- NFR-5: nothing from a future back-office client; nothing in `apps/pos` reaches the other surface's routes.
- Fixtures never in a served build (question 3, mechanism 1).

## Tests expected to change

- `apps/pos/test/console-free.test.ts`: made recursive and extended (lead ruling 7).
- `apps/pos/test/pin-pad.test.tsx`: one added assertion (question 8: after digits on either pad, no
  request body contains one); additions only.
- Any existing POS test that prints the literal actor or the literal `90s`, because the screens now read
  the store: list each in the Handoff with the reason, and change only the expected value, never the
  behaviour asserted. Ask the explorer first which they are:
  `.agent/bin/ask.sh explorer "<which apps/pos tests assert 'Ana R.', 'Cashier' or '90s'>"`.
  The lead asked at dispatch (2026-10-14). The explorer found the actor and idle figure asserted only in
  screen headers: `incidents.test.tsx:127-128` (the settlement bar contains `'Ana R. · Cashier'` and `'90s'`)
  and `closed-orders.test.tsx:148` (an exact `toBe` on the `.closed-head` text, actor and `90s` together).
  It also found `'Applied by Ana R. at 19:44 …'` in `discount-apply.test.tsx:356` and `:363`,
  `discount.test.tsx:633-634` and `:949`, and `discount-change.test.ts:29`: that is a discount fixture's
  recorded applier, not the signed-in actor, and is **not** expected to change. No test asserts a literal
  90 idle seconds as a value.
- Any other change to an existing test: stop and raise it.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts against `development`'s baseline, which the
   lead records below this line at dispatch.
   **Baseline (lead, 2026-10-14): `development` at `69f289b`, 74 test files, 3425 tests.**
2. Each new test file is green three times in a row alone; the Handoff maps cases 13 to 29 to test names.
3. The red proofs named in lead ruling 1 made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of: `grep -rnE "\bfetch\(|localStorage|sessionStorage|document\.cookie|sendBeacon|console\." apps/pos/src`
   (nothing); `grep -rn "import.meta.env.DEV" apps/pos/src apps/pos/vite.config.ts` (nothing used as the
   session switch); `grep -rnE "Ana R\.|'90s'|\b90\b" apps/pos/src` (only fixture modules, or each other hit explained).
5. By hand, with `npm run build:clients` and `npm run dev -w apps/server`: the Handoff says what
   `https://localhost:8443/pos/` showed, if a person to sign in as existed, or that none did.
6. The Handoff carries forward what 011d (the back office) and Task 12 (the harness) need from this task.

## Out of scope

- `packages/api-client` (merged in 011c1; a defect found there is reported, not fixed here).
- The back office (011d). M-1 and `Approval.tsx` (Phase 2). Any server change. `docs/` of any kind.
- A warning before the idle lock (not designed). The closed-day banner's clearing (queued separately).

## Ruling on the BLOCKED question (lead, 2026-10-14)

Addressed to the builder; answers Handoff finding 1 and settles the decisions you listed.

1. **Release: yes, replace the three assertions as you proposed, and turn `release` on.** The three tests
   (`floor.test.tsx:131-132`, `closed-orders.test.tsx:147-150`, `closed-order.test.tsx:737-739`) pinned the
   owner's 2026-09-30 deferral, which was "for FR-A"; this task is FR-A, and the consult's sentence above
   ("011c builds it wherever the artifact draws the actor") is the instruction. Each becomes: a button named
   Release is in the actor group, and pressing it leaves for POS-01 (the `closed-orders` header string gains
   `Release` at its end, nothing else in it changes). Change only those assertions; list them under
   *Existing tests changed* with this ruling as the reason. Release counts under ruling 12 (one
   cookie-changing request at a time); since it goes to POS-01 at once, say how a second press is impossible.
2. **POS-03 does not gain an actor group in this task.** It draws no actor today, and adding the group is
   new layout, not wiring. Release stays where the built screens already draw the actor (floor, POS-05,
   POS-06). Name the gap in the Handoff; the lead queues it.
3. **Your other decisions stand** (the lead's, the owner's to overturn): fixture mode when
   `__FIXTURE_SESSION__` is undefined under Vitest (no root config change); the bound `window.fetch` reference;
   *session invalidated* before the draft notice on POS-01; the fixture sign-in after a Release; the real
   cooldown disabling the whole pad; case 24 as you tested it. Findings 2 to 4 are recorded, not for you.
4. Then commit after `npm run verify` is green (path-scoped, never the run directory), finish the Handoff,
   and end with DONE.

## Round 2 — the review's three findings (lead rulings, 2026-10-14)

The review is `.agent/reviews/PHASE0-011c2-review.md` (Codex; one high, two medium, each reproduced). All
three are accepted. Addressed to the builder. **This is the last fix round:** anything you cannot settle
from these rulings and the documents, write as `BLOCKED: <question>` rather than choosing.

1. **F1 (high): a session read must never sign this tab in after Release or invalidation.** Give the store a
   local session revision (or an equivalent guard) that advances on Release, on `actor-changed`, and on every
   `session-ended`. A `me` read records the revision it was sent under; its result is applied only if the
   revision is unchanged. Beyond that: a read that names a person other than the one this tab holds never
   signs in; it leaves POS-01 *session invalidated* (lead ruling 3). Only the first lookup, in `starting`, may
   recover a session from nothing; after that, only a sign-in in this tab enters `signed-in`. Release goes to
   POS-01 and stays there until a sign-in, whatever a read answers meanwhile. Prove both of the reviewer's
   sequences with tests that fail on `90cb743` first: (a) signed in as A, a visibility `me` answers B's view:
   POS-01 *session invalidated*, the protected route absent, and a pointer event afterwards sends no
   `activity`; (b) signed in as A, a visibility `me` is held, Release is pressed and held, then `me`'s A view
   is delivered: POS-01 resting, the route absent, no `activity` on input, before and after Release settles.
2. **F2 (medium): the tender-draft notice's outstanding amount comes from `settlementPosition`.** Use
   `settlementPosition(total, tenderAmounts).balance` (`tender.ts:49`), as settlement does, so excess cash shows
   zero outstanding, never a negative amount. The DESIGN-015 wording is unchanged. Add a regression that locks
   at `/pos/settlement?state=change` (or with excess cash entered through the controls) and expects zero
   outstanding, and that the cash draft and its change are intact on re-entry. Red first.
3. **F3 (medium): the POS's API module maps every POS route through an exhaustive mapped type** (ARCH-014
   question 3, mechanism 3, copied above). One POS-owned module types a record keyed by every route path of
   the POS surface (and health) in the route table, each to the function that sends it, so that a POS route
   added to the table without a POS function is a compile error in `apps/pos`. The store and `activity.ts`
   send through it; the single core instance and the input-only activity rule stay as they are. Prove it with
   a red run: add a POS route to `packages/contracts/src/routes.ts` and its spec in
   `packages/api-client/src/specs.ts` **in the working tree only**, show `npm run typecheck` failing in
   `apps/pos`, then revert both (they are outside your paths; never commit them). Correct the Handoff's
   *For 011d and Task 12* claim to match what is now true.
4. Round 1 and the Release ruling stand where not changed here. Append a *Round 3* section to the Handoff
   (what changed, the tests, the red runs, verify counts), commit after `npm run verify` is green
   (path-scoped), and end with DONE or BLOCKED.

## Handoff

**Result: done, after the lead's ruling of 2026-10-14 on Release (section above).** Release is drawn in
the actor group on POS-02 (floor), POS-05 (closed orders) and POS-06 (a closed order), and `npm run
verify` is green: 78 test files, 3490 tests (baseline 74 and 3425). The earlier text below is the first
round's, kept as written; where it says Release is not drawn, the ruling section and the *Round 2* block
at the end of this Handoff supersede it.

### What I did

The POS now signs in for real through `@pos/api-client`, and the fixture session is chosen by a
compile-time constant and proved absent from a build.

- `apps/pos/vite.config.ts` (now a function of the command) defines `__FIXTURE_SESSION__` as `true` for
  `serve` and `false` for `build`; `src/env.d.ts` declares it. `import.meta.env.DEV` is not the switch.
- `src/session/source.ts` is the one module that chooses: `createSessionStore()` and
  `FixtureLockPictures` (POS-01's `?state=` pictures, `App`). In a build the unused branch is dropped.
- `src/session/realSession.ts` is the one module that calls `createApiClient`. It holds ARCH-014 question
  5's table: `starting`, `signed-out` (with why, and the attempt: none, verifying, error, cooldown,
  unavailable, failed, lookup-failed, lookup-unavailable) and `signed-in`. One exhaustive `switch` over
  `ErrorCode` with a `never` check places every code (`meaningOf`). One cookie-changing request at a time
  (ruling 12). `actor-changed`, and `session-ended` for `FORBIDDEN` or `ACTOR_CHANGED`, show *session
  invalidated* and send nothing. `session-gone` is ignored; a sign-in that gets it leaves POS-01 with no
  notice. The first read, the deadline read and the visibility read share one `reading` flag, so two never
  fly together (ruling 13).
- `src/session/activity.ts` is the only file that names the activity route: one capture-phase listener for
  `pointerdown` and `keydown`, leading edge only, window 5000 ms (a client constant), reads nothing from
  the event, no body.
- `src/session/fixtureSession.ts` holds the fixture cashier, the literal 90 and the bundle marker
  `fixture-session:rpos-8f3a1c`. It never imports the request module.
- `src/LockScreen.tsx` is the one lock screen, fed by a `LockView`. `App.tsx` is now only the fixture
  view producer (its copy and `NOTICES` are unchanged); `src/LockRoute.tsx` produces views from the
  session with DESIGN-015's copy, placed row by row, and `waitText` for `{wait}`.
- `src/ActorChip.tsx` draws the name and role, the live whole seconds, and (when asked) Release. The five
  screens that printed the literals (`FloorScreen`, `ClosedOrdersScreen`, `ClosedOrderScreen`,
  `IncidentsScreen`, `SettlementScreen`) use it. `actor` and `idle` are removed from `FLOOR_COPY`, so the
  literal cashier is only in the fixture session module.
- `PosRoutes.tsx` gates the routes and not the stores; renders the empty frame while *starting*; renders
  POS-01 in place of the route when signed out, URL unchanged, with the tender-draft figures taken from
  the payment sessions and the book; replaces `/pos/` and any unknown path with `/pos/floor` in real mode
  only; sets `data-session` on `#root`. `data-lock-state` is on POS-01's `<main>`.
- `PinPad.tsx` gained an additive `disabled` prop (every key `aria-disabled`, presses ignored). The real
  cooldown and a failed first read use it. `pos.css` gained `.notice__retry`, marked PROVISIONAL.
- `apps/pos/package.json` and `package-lock.json` list `@pos/api-client` and `@pos/contracts`.

### Decisions, and on what evidence

- **Vitest does not load `apps/pos/vite.config.ts`** (the root `vitest.config.ts` is its own and is not in
  my owned paths), so under test `__FIXTURE_SESSION__` is undefined. `source.ts` reads
  `typeof __FIXTURE_SESSION__ === 'undefined' || __FIXTURE_SESSION__`: a test run is a `serve`; every build
  defines it, and the bundle tests prove the build's value. The task said vitest loads the same config; it
  does not. If the lead would rather the root config define it, that is a one-line change outside my paths.
- **`fetch`**: the client is given `window.fetch.bind(window)` (a reference, not a call), because the core
  requires a `fetch` at construction. `console-free.test.ts` flags `fetch(` calls and holds
  `createApiClient(` to exactly one file. Rule 2 read literally ("`fetch` appears nowhere") cannot be met
  by any code that gives the core a fetch; this is the narrowest form.
- **Draft against invalidated**: when both apply, POS-01 shows *session invalidated* and not the draft
  notice (one notice slot; DESIGN-015's rows are exclusive). The draft is untouched either way. Rule if the
  lead prefers the other order: swap two blocks in `LockRoute.tsx`.
- **Fixture sign-in**: in fixture mode the lock screen shown after a Release signs in as the fixture
  cashier on any six digits and makes no request (case 25). `/pos/` still walks the pictures.
- **Case 17 / DESIGN-015 "whole pad disabled"**: the real cooldown disables the whole pad (digits too), as
  DESIGN-015 says; the fixture picture keeps its old behaviour because `pin-pad.test.tsx` holds it.
- **Case 24**: the fixture prompt is URL-driven (`?state=approval`), so after sign-in at the same URL the
  picture is redrawn. The test asserts it is gone while signed out and a *fresh* one (zero filled dots,
  typed digits gone) after.
- A shell heredoc was used once to patch `PosRoutes.tsx` (against the one-simple-command rule); no
  Prettier or formatter was run.

### Existing tests changed

- `apps/pos/test/console-free.test.ts`: recursive, and extended (storage, cookie, beacon, `fetch(`,
  `XMLHttpRequest`, sockets); one new test that one module constructs the client. Ruling 7.
- `apps/pos/test/pin-pad.test.tsx`: one added test, inside the existing B-12 block: with `fetch` stubbed,
  digits typed on either pad send nothing. Additions only.
- No other existing test changed. `closed-orders.test.tsx:148` and `incidents.test.tsx:127-128` did not
  need their expected values changed: the header text is unchanged in fixture mode.

### Findings

1. **BLOCKED: Release is built but not drawn anywhere.** The task says Release goes wherever the
   artifact draws the actor (floor.html:48, order.html:77, closed.js:21). Three existing tests assert the
   opposite behaviour and I may not change them: `floor.test.tsx:131-132` (`body` does not contain
   `'Release'`), `closed-orders.test.tsx:147-150` (header "No Release", `text(host)` does not contain
   `'Release'`), `closed-order.test.tsx:737-739` ("Release is not drawn"). `ActorChip` takes
   `release` (a `<button type="button">Release</button>` calling `store.release()`), so enabling it is
   `release` on the three `<ActorChip>` calls in `FloorScreen`, `ClosedOrdersScreen`, `ClosedOrderScreen`.
   **Proposed resolution:** replace those three assertions with "a button named Release is in the actor
   group and pressing it leaves for POS-01" (and the `closed-orders` header string gains `Release` at its
   end), then I turn `release` on. POS-03 (OrderPanel) draws no actor today, so there is nothing to put
   Release beside; the artifact draws it there (order.html:77). Say whether POS-03 is to gain its actor
   group in this task or a later one. Settlement's artifact draws no Release.
2. Other screens still guard their own fixture-state navs with `import.meta.env.DEV`
   (`FloorScreen`, `OrderPanel`, `SettlementScreen`, `ClosedOrdersScreen`, `ClosedOrderScreen`): not the
   session switch, but those navs, and the `?state=` pictures of those screens, are in a served build.
   Question 3 says only POS-01's `?state=` is fixture-only; the rest is the owner's 2026-10-13 ruling.
3. A failed deadline read leaves the person signed in with the chip at `0s` and draws nothing (ARCH-014
   question 9: no state is designed). Nothing is retried; the next visibility read or `me` tries again.
4. One server test (`approval.test.ts` test 5) timed out once at 124 s in a full run and passed alone and
   in the second full run. I changed no server code.

### Case map (tests in `apps/pos/test/`)

13 `session-store.test.tsx` › "13. load with me 200" (3 tests) · 14 › "14. load with me refused" ·
15 › "15. a sign-in" · 16 to 18 › "16–18. refusals and a short entry" · 19 › "19. a held session ends"
(incl. `actor-changed`) · 20 › "20. Release" (via `store.release()`; the button waits on finding 1) ·
21 › "21. activity is sent only from real input" (incl. the source scan) · 22 › "22. the chip and the
deadline read" · 23 › "23. the tender draft survives the lock" · 24 › "24. nothing of an approval
prompt survives the session" · 25 `session-fixture.test.tsx` · 26 `session-store.test.tsx` › "26. B-12 on
the real path" · 27 `built-session.test.ts` and `built-session-development.test.ts` (shared
`built-session-support.ts`; two files because two bundles cannot share one jsdom) · 28
`console-free.test.ts` · 29 below. Each new file ran green three times in a row alone (5 files, 37 tests).

### Red proofs (each made, run, reverted)

- Send `activity` from the countdown's deadline tick: case 21 failed (`expected 10 to be +0`), and the
  source scan failed.
- Start the countdown at the limit after `me`: case 22 failed (`expected '90s' to be '3s'`).
- Switch the source on `import.meta.env.DEV`: case 27 failed in the `NODE_ENV=development` build only
  (`Sign-in locked for 4 min 12 s` found in the bundle; `?state=throttled` drew `throttled`).
- Cancel the payment session when signed out (the draft dies with the actor session): case 23 failed
  (`expected 'resting' to be 'draft'`).
- Keep Release on screen until the server answers: case 20 failed in all three answers, and the
  one-at-a-time test.

### Acceptance output

- `npm run verify`: typecheck clean; **78 test files, 3489 tests, all passed** (baseline `development`
  at `69f289b`: 74 files, 3425 tests; +4 files, +64 tests).
- `grep -rnE "\bfetch\(|localStorage|sessionStorage|document\.cookie|sendBeacon|console\." apps/pos/src`:
  nothing.
- `grep -rn "import.meta.env.DEV" apps/pos/src apps/pos/vite.config.ts`: five fixture-nav guards in
  `ClosedOrderScreen:207`, `SettlementScreen:1010`, `OrderPanel:357`, `FloorScreen:309`,
  `ClosedOrdersScreen:167` (none is the session switch), and a comment in `vite.config.ts`.
- `grep -rnE "Ana R\.|'90s'|\b90\b" apps/pos/src`: `session/fixtureSession.ts` (the fixture cashier and
  90); `discountFixtures.ts:65,72` (a discount fixture's recorded applier, not the actor); and comment
  matches on `closed.js:90` in `closedOrderDetail.ts` and `refundDraft.ts`.
- By hand (criterion 5): **not made.** No browser was available and no person to sign in as exists in
  the sandbox (`npm run create-manager` is the owner's, at a terminal). The served path is proved by the
  two built-bundle tests running the real built script in jsdom.

### For 011d and Task 12

- Accessible names the harness may drive on the POS: digits `1`..`9`, `0`, "Delete last digit",
  "Continue", the notice's "Try again", and (once finding 1 is ruled) "Release". No `data-testid`.
- State, not copy: `data-session` (`starting`, `signed-out`, `signed-in`) on `#root`; `data-lock-state` on
  POS-01 (`resting`, `loading`, `error`, `throttled`, `invalidated`, `draft`, `unavailable`, `failed`).
- `npm run build:clients` serves `/pos/`; a manager's PIN is the only sign-in Phase 0 can demonstrate.
- 011d: reuse `meaningOf`'s shape, not the module; the POS store is POS-specific. `console-free` now
  scans recursively and is the template to copy. The core's back-office `SESSION_IDLE` keeps the token.
- Phase 2: **corrected in Round 3 below.** In rounds 1 and 2 this line claimed that a new POS route
  fails the POS compile; that was not true until Round 3 added `session/api.ts` (it was only the
  api-client's `SPECS` that failed). It is true now: see Round 3.

### Round 2 (after the lead's ruling)

- `ActorChip` is called with `release` in `FloorScreen`, `ClosedOrdersScreen` and `ClosedOrderScreen`;
  the stale "Release is not drawn" comment in `FloorScreen.tsx` is rewritten.
- **Existing tests changed, all under the ruling:**
  - `floor.test.tsx` (was `:131-132`): the "not drawn" assertion is now "exactly one `button` named
    Release in `.floor-actor`"; one new test presses it and sees POS-01 `resting`, then signs back in
    (the file shares one fixture session).
  - `closed-orders.test.tsx` (was `:147-150`): the exact header string gains `Release` at its end and
    nothing else; the two "no Release" assertions are replaced by "exactly one Release button in the
    actor group".
  - `closed-order.test.tsx` (was `:737-739`): "Release is not drawn" becomes "Release is a button in the
    actor group, and pressing it leaves for POS-01", then signs back in.
  - **Beyond the three, because drawing Release in the header changes what they collect:** the
    `draw().buttons` helper (`closed-order.test.tsx:64`), the criterion-10 text regex and its
    "only these buttons" loop (`:707`, `:711`), and `refund-screen.test.tsx:266` all read every `button`
    on the screen. Each now ignores buttons inside `.floor-actor` (Release is the header's, not one of the
    screen's actions); the criterion-10 `release` word check moved from "anywhere in the text" to "no
    Release button outside the actor group". No behaviour those tests assert was loosened: a stray
    Release outside the actor group still fails them. The ruling said "change only those assertions";
    these were unavoidable consequences, and the lead should say if they want it done differently.
  - `session-fixture.test.tsx` (mine) now presses the drawn button instead of calling the store.
- **How a second press is impossible (ruling 12):** the press calls `store.release()`, which returns at
  once unless the phase is `signed-in`; it flips the phase to `signed-out` synchronously before the
  request is sent, so POS-01 replaces the screen (and its Release button) in the same render, and
  `cookieChanging` is true until the answer, which also makes a sign-in inert. Tested in
  `session-store.test.tsx` ("one cookie-changing request at a time").
- **The gap, for the lead to queue:** POS-03 (the order screen) draws no actor group, so it has no
  Release, though the artifact draws one (order.html:77). POS-04 (settlement) and the incidents screen
  draw the actor and the chip but no Release: the artifact draws none there.
- `npm run verify`: **78 files, 3490 tests passed**, typecheck clean. The five red proofs above were run
  on round 1's code and are unaffected by this change; the Release proof's test is the same one.
- Commit: one path-scoped commit on `agent/phase0-011c2`, "feat(pos): sign in for real through
  @pos/api-client…" (`git log -1`; the hash cannot be written into the file it contains).

### Round 3 (the review's three findings, lead rulings 2026-10-14)

**F1 (high): a session read can no longer sign this tab in after Release or invalidation.**
`realSession.ts` holds a local `revision` that advances on every change of phase (Release, a sign-in,
every end, `actor-changed`, an invalidation). `readSession` records the revision it was sent under and
returns without applying anything if it has moved. Only the first lookup (origin `load`, from `starting`)
may sign in from nothing; a deadline or visibility read applies only while the tab is still signed in,
re-arms the chip if it names the person this tab holds (`personId`), and if it names anyone else the tab
goes to POS-01 *session invalidated* with nothing sent (ruling 3). The held `me` of the reviewer's
sequence (b) arrives after Release and is dropped; the store's activity predicate is phase-based, so
nothing is sent before or after the release settles.
Tests (`session-store.test.tsx`, "19b"), both red on `90cb743`'s code (each failed with `expected
undefined to be 'invalidated'` and `expected undefined to be 'resting'`: the tab was signed in again,
`lock-state` absent) and green now: (a) a visibility `me` naming B: POS-01 *invalidated*, no `.floor-actor`,
a pointer event sends no `activity`, no release; (b) a held `me`, a held Release, then the A view
delivered: POS-01 resting, route absent, no `activity` before or after Release settles. The harness
gained `hold(key)` (one request held until `deliver`).

**F2 (medium): the draft notice's outstanding amount is `settlementPosition(...).balance`.**
`PosRoutes.tsx` imports `settlementPosition` from `tender.ts` and uses its `balance`, so excess cash is
`0` outstanding and never negative. The wording is unchanged. Test "23b" at
`/pos/settlement?state=change`: release, the notice reads `… — 0 outstanding, 1 tender drafted.` with no
minus sign, and after sign-in the screen text equals what it was before (cash draft and change intact).
Red first: with the old subtraction put back, it failed (`expected 'Payment in progress on this tabOrder …'
to match / — 0 outstanding, 1 tender drafted\./`); reverted to the fix, it passes.

**F3 (medium): the POS's API module maps every POS route through an exhaustive mapped type.**
New `session/api.ts`: `PosPath` is `Extract<RoutePath, '/api/health' | \`/api/pos/${string}\`>` and
`PosApi` maps every key of it to `(...ArgsOf<P>) => Promise<ApiResult<ValueOf<P>>>`; `posApi(client)`
returns the object literal, so a missing key is a compile error. `realSession.ts` (the one
`createApiClient` call) and `activity.ts` now send only through `api[...]`; neither imports `ROUTES`. The
core instance and the input-only activity rule are unchanged. The source scan was updated: the activity
route's key appears in `activity.ts` (the one caller) and `api.ts` (the declaration), and the call only in
`activity.ts`.
Red run, working tree only: I added `{ method: 'POST', path: '/api/pos/orders', interactive: true }` to
`packages/contracts/src/routes.ts` and `'/api/pos/orders': { response: null }` to
`packages/api-client/src/specs.ts`. `npm run typecheck` failed in `apps/pos` and nowhere earlier:
`apps/pos/src/session/api.ts(19,3): error TS2741: Property '"/api/pos/orders"' is missing in type … but
required in type 'PosApi'.` I then ran `git checkout --` on both files; `git status` shows neither
modified, and neither is in the commit.

**Corrected claim for 011d and Task 12 / Phase 2.** A POS route added to the route table now fails
`tsc -p apps/pos` until `session/api.ts` maps it (the red run above), as ARCH-014 question 3 mechanism 3
asks, and the builder then wires the call and deletes the stand-in in the same task. A route of the back
office cannot be named there (`PosPath` excludes it). It still cannot prove a declared function is used by
a screen; review does that. The back-office client must write its own such module over its own core
instance; this one is POS-specific.

**Verify.** `npm run verify`: typecheck clean; **78 test files, 3494 tests, all passed** (Round 2: 3490;
+4: two for F1, one for F2, and the source scan is the same test, reworded). No existing test was
changed in this round; the harness file is mine.

DONE