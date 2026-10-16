---
id: PHASE0-011d2
title: M-6 over the keyed working area, with re-authentication, the other-manager sign-in and the discard confirmation
category: feature
touches: [identity, boundaries]
depends_on: [PHASE0-011d1]
owns: [apps/back-office/**]
status: not-started
cycles: 0
---
# PHASE0-011d2 — M-6, the back-office re-authentication

**Written** 2026-10-15 by the lead. Its sources are the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, by `architect14`, 2026-10-13), the reviewed design DESIGN-015 (sign-in
copy and states, merged as PR #89), DESIGN-012's M-6 (`docs/DESIGN.md`, *Shared back-office patterns*, and the Frost
artifact `shell.html`/`shell.js`), and what PHASE0-011d1 built (merged as PR #95). **Do not copy anything from plan
Task 11.** This is the second half of the consult's slice 011d, split by the lead on 2026-10-15. 011d1 built the
back-office client, its session, BO-01, the Phase 0 frame and the working area keyed by `staffUserId`. This task
puts M-6 over that working area. The consult's binding sections and DESIGN-015's copy table are copied below
**verbatim**, with their headings moved down one level. Where a copied section describes what 011d1 built, that
work is merged and is context for you. Lead ruling 1 says exactly which rules and cases are yours. The task touches
identity and boundaries, so the owner looks at it before merge.

## Objective

Today a back-office session that goes idle shows BO-01 resting. 011d1's lead ruling 3 made that an interim
behaviour, to last until this task. When this task is done, a `SESSION_IDLE` on a session this tab holds opens M-6
over the frame. The root's `data-session` reads `idle`. The working area stays mounted, visible behind the scrim and
inert, and so do the rail and the top bar. M-6 is the native modal dialog DESIGN-012 draws. Escape and a click
outside cannot close it. Focus loops inside it, and the element that was focused and its text selection are
captured before it opens.

From M-6 the idled manager re-authenticates with their password alone. Success resumes the same session, restores
the focus and the selection, and shows the *Resumed* notice. A different manager can choose to sign in instead.
They acknowledge, then use an editable username-and-password form that sends the ordinary sign-in. On success the
working area follows the key, so another manager never sees the draft. Log out goes through the discard
confirmation and sends `logout`. A logout that is not confirmed keeps M-6's confirmation on screen with *Logout
failed*'s notice above its actions.

Every state takes its sentence from DESIGN-015's rows. A cooldown, an incorrect password, an end of the session, a
refusal of access and a general failure are all covered. While M-6 is open this tab sends nothing on its own: no
`activity`, no deadline read and no visibility read. No `me` answer can close M-6 or reach the work behind it. No
server change and no change to `packages/**` is needed.

## Required inputs

- **The consult's sections and DESIGN-015's copy table, copied below.** They are the specification, as the lead
  rulings amend them.
- **011d1 as merged, and its whole Handoff** (`.agent/tasks/PHASE0-011d1-back-office-sign-in.md`; the file is on
  `development`, and your worktree has it). Read its *Lead rulings* 3 to 9 and its Handoff's *For PHASE0-011d2 (M-6)*,
  *Round 2* and the lead check on red proof 6. The code you extend is in
  `apps/back-office/src`. `session/realSession.ts` is the store: `meaningOf`, `applyEnd`, `readSession` with its
  revision guard, `onCoreEvent`, `settled`, the `cookieChanging` flag, `waitEnds` and `accountKey`, and `mayExtend`.
  `session/types.ts` holds `SessionSnapshot`, `Person` and `Wait`. `OfficeApp.tsx` is the frame and the keyed `<div>`
  inside the one `<main>`. `SignIn.tsx` is BO-01, whose cooldown and username-editing behaviour the other-manager
  form reuses. `copy.ts` holds the sentences. `session/api.ts` already declares
  `'/api/back-office/auth/reauthenticate'`, and nothing calls it yet. The tests and their harness are in
  `apps/back-office/test`, with the test-only child in `session-harness.tsx`.
- **`@pos/api-client` as merged** (`packages/api-client/src/client.ts`). At the back office the core **keeps the token,
  the actor and the generation** through `SESSION_IDLE` (`endSession` with `keepToken`), so a re-authentication sent
  during idle is not obsolete and carries the token. A re-authentication that answers 2xx installs the view, with
  `install` true and the same actor, and emits no `actor-changed`. A sign-in that installs a view naming a different
  person emits `actor-changed` **from inside that sign-in's own settlement, before its result returns to you**
  (lead ruling 7). A back-office logout that faults, or is refused with a code that does not end the session, keeps
  the session (`confirmsLogout`). A confirmed one emits `session-ended` `SIGNED_OUT`. That event fires even from idle,
  because the token is still held. A `me` read sent before an idle and delivered after it is **not** obsolete to the
  core: the core adopts its view, and sets a deadline and the token again. Only the store's revision guard keeps the
  screen from following it. That is sequence (c) of 011d1 (lead ruling 6).
- **The server, as merged; read it, do not change it.** `apps/server/src/http/routes/back-office-auth.ts:89-123`
  handles re-authentication. It checks the one cookie and the anti-CSRF token, then the body `{ password }`, then
  the session (idle or active both renew; anything else is `UNAUTHENTICATED`, with nothing verified or counted).
  Then it verifies against the account the session names, throttled per account, and renews the same session under
  a new token. `session-guard.ts:293-314` handles logout, which releases a session in any state, idle included, and
  answers 204. So a logout from M-6 succeeds. The server never answers `SESSION_IDLE` to re-authentication or to
  logout. `ReauthenticateRequest` (`packages/contracts/src/auth.ts:31`) is
  `{ password }`, strict, 1 to 1024 UTF-16 units.
- **The design.** `docs/design/SCREEN-INVENTORY.md` *M-6 — Back-office re-authentication* (`:1077-1121`), *Shared
  general failures* (`:83-100`, in particular the rows at `:99` and `:100`), and BO-01's *Session ended*, *Access
  refused* and *Idle* rows (`:603`, `:604`, `:607`). `docs/DESIGN.md` `:1360-1395` (M-6), `:1404-1411`, and
  `:1445-1452` (dialogs and destructive confirmations). The Frost artifact is
  `docs/design/visual-directions/frost/back-office/shell.html` and `shell.js`, which draw M-6 and the logout
  confirmation, and `office.js:100-116`, which holds `open`, `close` and the Tab loop. `office.css:40-43`
  (destructive buttons) and `:68-80` (dialogs) are the rules to port. The registry is
  `docs/design/tokens/frost.css`.
  The Frost artifact is a fixture, not product code. Its five-failure count, its five-minute timer, its `r.ayu`
  sample, its response selector and its kitchen section are review aids, and none of them is built.
- **Contract:** PRD FR-A2b, FR-A5b, FR-B3, AC-27, AC-28, AC-35; ADR-009 (§4, the per-account throttle; §7,
  recovery); ADR-010; BOUNDARIES B-11, B-12, B-13, B-24. Owner rulings (DECISIONS.md): 2026-10-05, a draft behind
  re-authentication is resumed only by the same manager; 2026-10-06, M-6 fixes the idled username and asks only for
  the password, and offers a different manager their own ordinary sign-in, whose failures count on their own
  account; 2026-10-06, after eight hours an idled session returns to BO-01 and the draft is kept locally and never
  resent; 2026-10-14, a different manager signing in from M-6 destroys the idled manager's draft; 2026-10-14, after
  the eight hours the same manager signing in again in that tab gets the draft back; 2026-10-14, one
  cookie-changing request (sign-in, re-authentication, release, logout) at a time per tab.
- **Library facts:** jsdom 29.1.1, the test environment, implements no `showModal()` and no `close()` on
  `HTMLDialogElement` (its implementation class is empty). Lead ruling 4 says how to test around that. Ask the
  librarian for anything else: `.agent/bin/ask.sh librarian "<question>"`.

## From ARCH-014, question 5: the session at the back office (verbatim; binding, as lead rulings 3, 6, 7 and 10 amend it)

#### The back office

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

## From ARCH-014, question 7: the back-office shell without slice B (verbatim; binding)

### 7. The back-office shell without slice B

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

## From ARCH-014, question 6: the clock and the screen (verbatim; context, built in 011d1; lead ruling 6 adds that idle sends nothing)

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

#### What the screen shows as the deadline nears

The only thing drawn is the idle chip in the POS header: `90s` in the artifact, a plain count of
whole seconds. 011c makes that number live, and adds nothing: no colour change, no warning, no
dialog, no sound. None is designed, and the inventory's "idle countdown / expiry takeover"
(SITEMAP `:104`) is satisfied by the chip and POS-01. If the owner wants a warning before the
lock, that is a design task. The back office draws no countdown at all; M-6 appears when the
server says the session is idle, and DESIGN-012's "timeout captures the actual active element"
is met by the deadline read above.

---

## From ARCH-014, For the task file: PHASE0-011d (verbatim; lead ruling 1 says which parts are this task's)

#### PHASE0-011d: rules

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

#### PHASE0-011d: test cases

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

#### PHASE0-011d: red proofs

- Hold the password in React state with a `value` prop: case 15 fails.
- Key the working area by nothing: case 10 fails.
- Unmount the working area when M-6 opens: case 7 fails.
- Show M-6 on a reload: case 5 fails.
- Import `PinPad` from the POS: case 16 fails.

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

---

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

## From DESIGN-015, the copy table (verbatim; binding for the M-6 rows and the shared rows, lead ruling 2)

At `agent/design-015` `eba71ee` (reviewed clean in round 3; merged as PR #89).

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

These rulings are addressed to the builder. Where a ruling and a copied section disagree, the ruling binds, and each
such case names the passage it changes. 011d1's lead rulings stay in force where this task does not change them.
Rulings 5 (a failed logout stays signed in), 7 (`session-gone`), 8 (the revision guard), 9 (one cookie-changing
request), 11 (exhaustive codes) and 15 (the password field) carry over unchanged.

1. **What is yours.** From *PHASE0-011d: rules*: rule 5's idle row (*idle*: M-6 opens over the work), rule 6's
   "stays mounted and inert under M-6", and rule 7. From *PHASE0-011d: test cases*: **cases 6, 7, 8 and 10, and
   M-6's half of case 9** (M-6 answered `UNAUTHENTICATED`: BO-01; then signing in as the same `staffUserId` shows the
   child's value, and signing in as another does not). Case 5 is 011d1's and stays green. Case 15 extends to M-6
   (ruling 12). From *PHASE0-011d: red proofs*: the third (unmount the working area when M-6 opens: case 7 fails)
   and the fourth (show M-6 on a reload: case 5 fails), plus those of ruling 15. The rest of the consult's rules and
   cases were built in 011d1. Leave them as they are, except as *Tests expected to change* says.
2. **The copy is DESIGN-015's, and these rows are yours:** every row whose Screen column names M-6, including the
   other-manager rows that borrow BO-01's sentences, and *Logout failed*'s M-6 half ("if M-6 was open, keep the
   notice above the confirmation actions and work inert"). SCREEN-INVENTORY's M-6 table (`:1088-1105`) carries the
   same sentences with their focus and enablement rules, and it binds where DESIGN-015's row is shorter. Place each
   sentence exactly, and invent none. `{username}` and `{idled username}` are the idled manager's `username` from the
   session view this tab held, never anything typed. `{wait}` is formatted as DESIGN-015's preamble says, by the
   formatter BO-01 already uses. Where a state you must draw has no row, stop with `BLOCKED:`.
   **Not built:** the Frost states `reauth-kitchen` and `unsaved`, the kitchen section inside M-6, the "Open print
   incidents after sign-in" action, and every alert, because Phase 0 has no incident route and no navigation. The
   fixture's response selector, failure count and timer are not built either. The owner's two questions printed at
   SCREEN-INVENTORY `:1115-1120` were answered on 2026-10-14 (DECISIONS.md). The keyed working area already carries
   both answers. The inventory's paragraph is owed to the designer, and you do not change it. BO-01's deferred
   retained-draft sentence stays unplaced, as DESIGN-015's *Session ended* row says.
3. **The idle phase.** Add `{ phase: 'idle' }` to `SessionSnapshot`, beside `signed-in`. It holds the idled person
   (`staffUserId`, `name`, `username`; the store must stop dropping `person` on this end), M-6's mode and attempt,
   the waits, `busy`, and the logout state of the confirmation. The root carries `data-session="idle"`. The store
   enters idle **only** from `signed-in`, on the core's `session-ended` with reason `SESSION_IDLE`. A request that
   answered `SESSION_IDLE` reaches the store through that event first (the core announces it when it settles), so
   `meaningOf`'s `SESSION_IDLE` for a held session becomes *idle*, not `rest`, and its `applyEnd` path must agree with
   the event. Load stays `rest` (BO-01, case 5), and a sign-in stays the general failure. Entering idle advances the
   revision. It clears any *Logout failed* notice of the signed-in frame, because M-6 offers Log out itself.
4. **What M-6 is, in the DOM.** The frame stays rendered under it: the top bar with "Back office", the idled
   manager's name and its Log out button, the empty rail, and the content pane with the keyed working area, **not
   hidden**, as Frost draws the work behind the scrim. All three carry `inert` while idle, set explicitly, not left
   to the native top layer alone. M-6 is one native `<dialog>`, outside every inert element, opened with
   `showModal()`, with `closedby="none"`, `aria-labelledby` its title and `aria-describedby` its description. A
   `cancel` listener prevents the default. Escape is prevented in a capturing `keydown` listener. A `close` guard
   reopens it while the phase is still idle. Tab from the last focusable control goes to the first, and Shift+Tab from
   the first goes to the last, as `office.js:109-116` does. An overflowing body becomes a focusable region labelled
   by the title, as `office.js:103-105` does, and the Handoff says that jsdom cannot test it. The logout confirmation
   is a second `<dialog>` that takes M-6's place while it is open, as Frost draws it. M-6 closes when it opens and
   reopens when it closes. The guard must not fight this. The confirmation's Escape is "Keep this draft"
   (DESIGN.md `:1449-1451`, `shell.js` `logout` `cancel`).
   **jsdom 29 has no `showModal()` or `close()`.** The source calls the real methods. Do not feature-test, polyfill
   or catch them in `src`. Install a minimal shim in a test-only module under `apps/back-office/test`, used by the
   harness, which toggles the `open` attribute and fires `close`. The tests then prove what the DOM can show: the
   dialog is open, Escape and a dispatched `cancel` leave it open, a click on the dialog element outside its content
   leaves it open, the frame carries `inert`, and focus loops. What only a browser shows (the top layer, the
   backdrop, native inertness, the scrim) is criterion 5, by hand.
5. **The two forms and their modes.** M-6 has four modes, each a row of SCREEN-INVENTORY's table:
   - **`same`**, the default: the read-only Username (the idled username) and Password.
   - **`confirm-other`**, the acknowledgement: title and body only, with "Stay with current manager" and "Continue to
     sign-in".
   - **`other`**: an editable Username, starting empty every time this mode opens from the acknowledgement, and
     Password.
   - **`confirm-logout`**, the discard confirmation.

   Initial focus on opening M-6 goes to Password, or to "Sign in as a different manager" when the idled account's
   wait disables Password (`shell.js` `start`). In `confirm-other` focus goes to "Stay with current manager". Stay
   returns to the form it came from, its wait unchanged, with focus on "Sign in as a different manager". "Continue to
   sign-in" opens `other` with focus on Username. "Back to {idled username}" clears Username and Password and returns
   to `same`, with focus on Password, or on "Sign in as a different manager" while the idled account waits. Log out,
   from `same` or `other`, opens `confirm-logout` with focus on "Keep this draft". Keep returns to the form it came
   from. **The password field is emptied at every change of mode and after every response**, success included.
   While any credential or logout request is in flight, every control that would send a request or change the mode
   is inert (DESIGN-015 *Verifying*: "Disable duplicate requests and switching while pending").
6. **What leaves idle, and nothing else.** While the phase is idle:
   - **Nothing is sent on this tab's own initiative.** The activity listener's `active` is false. No deadline read,
     no visibility read. The core's `deadline` events are ignored. Typing the password sends no `activity`.
   - **No `me` answer is applied.** One sent before the idle is dropped by the revision guard, whatever it names.
     Its core-level effects are still announced as events, and those events are handled by the list below.
   - **The exits:**
     - an `ok` re-authentication from `same`: signed in, same session, *Resumed*;
     - an `ok` sign-in from `other`: signed in as the person the view names, with the working area following the
       key;
     - a confirmed logout from `confirm-logout`: BO-01 resting, with the working area destroyed;
     - the core's `session-ended` `UNAUTHENTICATED` or `ACTOR_CHANGED`, or `actor-changed` (but see ruling 7): BO-01
       *Session ended*, with the working area kept, hidden and inert;
     - `FORBIDDEN`: BO-01 *Access refused*, with the working area destroyed;
     - `SIGNED_OUT`: BO-01 resting, with the working area destroyed;
     - a reload: BO-01, by case 5.

   **A stale `me` must never close M-6 toward signed-in, and must never re-arm a session the screen has locked
   behind the password.** Prove it with 011d1's **sequence (c), rewritten for M-6.** Signed in as A, with the child
   typed into and focused, a visibility `me` is held. A `pointerdown` sends `activity`, answered `SESSION_IDLE`, and
   M-6 opens. Then `me`'s A view is delivered. Expected: M-6 still open, `data-session` still `idle`, the frame still
   inert, the password field empty. Two minutes later an input sends no `activity`, and a `visibilitychange` sends no
   `me`. A re-authentication with the right password then resumes, with the child's value, focus and selection
   intact. Add **sequence (d)**: the same, but the held `me` delivers B's view. Expected: BO-01 *Session ended*, M-6
   closed, the child kept. Signing in as A then shows the child's value, and signing in as B shows a fresh child.
   The F2 rule from 011d1's Round 2 stays for BO-01: only `FORBIDDEN` acts while BO-01 shows. With M-6 in place
   there is no longer a public sequence that reaches BO-01 with a held token, so its BO-01 counterpart test is
   rewritten for M-6 (*Tests expected to change*).
7. **The other-manager sign-in and `actor-changed`.** From `other`, Sign in sends the ordinary back-office login
   with `{ username, password }`, as BO-01 does, through the same local checks (DESIGN-015's *Missing username*,
   *Missing password* and *Oversize input* rows for the other-manager form). When it installs a view that names a
   different person, the core emits `actor-changed` **before** the sign-in's result reaches the store. **While a
   sign-in from `other` is in flight, `actor-changed` is that sign-in's own install: do not act on it.** The result
   decides:
   - `ok` enters signed-in as the returned person. A different `staffUserId` changes the key and React destroys the
     working area (owner, 2026-10-14). The same `staffUserId`, an idled manager who typed their own username, keeps
     it, because the key decides, whatever form was used (ARCH-014 question 5).
   - No success sentence and no *Resumed* notice. Focus goes to the top bar's Log out (`shell.js`
     `separateArea`).
   - `INVALID_CREDENTIALS` without details: *Other-manager error*, with Username kept and Password cleared.
   - A cooldown: *Other-manager throttled*, keyed by the typed username's account key, with BO-01's username-editing
     rule. Back and Log out stay available.
   - The general failure, or unavailable: the shared rows inside M-6.
   - `session-gone`: BO-01 *Session ended*, with the working area kept. In that case something else changed this
     browser's session during the sign-in, and this tab no longer knows whose cookie it holds.

   Failures count on the submitted account, never on the idled one. That is the server's doing, and the client
   counts nothing.
8. **Re-authentication from `same`.** Continue sends `'/api/back-office/auth/reauthenticate'` through `officeApi`
   with `{ password }` and nothing else. The core adds the token. The local checks are DESIGN-015's: an empty
   password gives "Enter your password." and sends nothing. Over 1024 UTF-16 units gives "Incorrect password. Try
   again.", sends nothing, and clears and focuses Password. Give `meaningOf` a fourth context, `reauth`, and place
   every code there. The answers:
   - `ok`: *Resumed* (ruling 9).
   - `INVALID_CREDENTIALS` without details: *Same-manager error*, with Password cleared and focused.
   - `INVALID_CREDENTIALS` with details, or `THROTTLED` with details: *Same-manager throttled*. The wait goes into
     the store's one `waitEnds`, keyed by the idled username's account key, because M-6 and BO-01 share one
     per-account cooldown. It disables Password and Continue, but not the other-manager choice or Log out. Zero
     removes it and enables entry, without submission. `THROTTLED` without details is the general failure.
   - `UNAUTHENTICATED`: the core announces the end; BO-01 *Session ended*, with the working area kept.
   - `FORBIDDEN`: *Access refused*, with the working area destroyed.
   - `SESSION_IDLE`, which the server does not send here and only the core's CSRF recovery could surface, and
     `CSRF_REFUSED` after that recovery: the general failure, with M-6 staying.
   - `failed`, `invalid-request` and the rest of the general group: *Something went wrong*. `unavailable`: *The
     system is unavailable*. Both are shown inside the current M-6 form, with the draft kept.
   - `session-gone`: M-6 as it was, with no notice and the password empty; the core's events say what changed.

   "Try again" on a general failure in M-6 sends nothing. It clears the notice and returns focus to an empty Password
   for fresh entry (SCREEN-INVENTORY `:99`). A credential is never resent automatically.
9. **Focus, selection and *Resumed*.** When the phase becomes idle, capture `document.activeElement` and, for a text
   control, its `selectionStart` and `selectionEnd`. Do it **before** anything is made inert and before
   `showModal()`, because inerting the focused element's ancestor loses it. The element may be outside the working
   area (DESIGN.md `:1391`, "including focus outside the draft"). On an `ok` re-authentication, close M-6, lift the
   inert attributes, move focus back to the captured element if it is still connected, and restore its selection. Do
   not submit, reset or re-render the child. Then show *Resumed*, "Your session has resumed." / "Your changes are
   still here. Nothing has been submitted.", as a neutral `office-notice` with `role="status"`. It comes first in the
   content pane, or second if a *Logout failed* notice is there, and it is not focused. It stays until the next change
   of phase. Case 7 is proved with the test-only child: a typed value, focus in its input and a selection of
   characters 2 to 5 before the idle; the same value, the same focused element and the same selection after the
   resume; and one mount of the child throughout.
10. **Log out from M-6** (DESIGN-015 *Discard confirmation*, *Logout during cooldown*, *Logout failed*).
    - **The confirmation's copy.** "Log out and discard your changes?" / "The unsaved changes to this draft will be
      lost. Anyone signing in next starts a separate session." The actions are "Keep this draft" and "Discard
      changes and log out", the latter a 36px `danger final` button, never a link. When it is opened from `same`
      and the idled account has a wait, append *Logout during cooldown*'s sentence with that wait, counting down.
      From `other`, append nothing, whatever either account's wait.
    - **What Discard does.** It sends `logout` (the core adds the token) and joins the one-cookie-changing-request
      rule.
    - **Confirmed.** The core's `SIGNED_OUT` gives BO-01 resting with the working area destroyed.
    - **Unconfirmed** (a fault, or a refusal that does not end the session): the confirmation stays open over inert
      work. The amber notice, with the applicable shared title and body and "Sign-out has not been confirmed.", sits
      above the confirmation's actions. A "Try again" sends `logout` again with the token. "Keep this draft" stays
      available once nothing is in flight. Keep clears the failure and returns to the form.
    - **While the logout is in flight,** every control of the confirmation is inert.
    - **The manager asked to discard,** so once Discard is pressed, any end the logout's answer brings destroys the
      working area: 204 gives BO-01 resting; `UNAUTHENTICATED` gives BO-01 *Session ended*, without the draft;
      `FORBIDDEN` gives *Access refused*. This narrows 011d1's "the working area stays" for `UNAUTHENTICATED`, for
      this one path only.

    The top bar's Log out, outside M-6, is unchanged: Phase 0 has no draft there, so it asks nothing and sends
    `logout` as 011d1 built.
11. **One cookie-changing request at a time** (owner, 2026-10-14). Re-authentication joins the single
    `cookieChanging` flag beside the sign-in and the logout. While any one is in flight, M-6 sends no second request
    of any of the three, and its switching controls are inert. Publish the flag's clearing into whatever phase the
    screen is in when the request settles, as 011d1's `settled()` does for BO-01 (011d1 Round 2, F1). An idle
    snapshot published by an event while the flag was set must not stay busy. Prove both with tests: a second
    Continue, Sign in or Discard while one is pending sends nothing; and after a re-authentication answered
    `UNAUTHENTICATED` while pending, BO-01 is usable at once.
12. **B-12 for M-6** (case 15 extended). The M-6 password field is an uncontrolled native input of type `password`,
    with `autocomplete="current-password"`. It is read once on submit, emptied after every response and at every
    change of mode, never React state and never a `value` attribute. The other form's Username takes
    `autocomplete="username"`. **The fixed Username is read-only and carries no `value` attribute either:** set its
    value as a property, from a ref. React writes the attribute for `value` and for `defaultValue`, and 011d1's
    `password.test.tsx` asserts that no input has one. After a re-authentication and after an other-manager
    sign-in, the password is in exactly one request body (that request's) and in no attribute, text node, storage,
    console call or URL. Every form is `method="post"` with its submission prevented.
13. **Exhaustive codes and the API module.** `meaningOf` stays one `switch` over `ErrorCode` with a `never` check,
    now with the `reauth` context. M-6 sends only through `officeApi`, and neither it nor the store imports
    `ROUTES`. No route, schema or core change is needed. If one appears to be, stop with `BLOCKED:`.
14. **The stylesheet.** Port only what M-6 draws from `office.css`: `.office-dialog` and its `::backdrop`, `__head`,
    `__body`, `__foot`, the dialog label rule, `.office-error` inside a dialog, the `danger` and `danger final`
    buttons, the neutral `.office-notice`, and the read-only and disabled field states that `patterns.html`
    shows. Every value goes through a `--frost-*` token, and `no-invented-values.test.ts` keeps reading the whole
    stylesheet. The fixture session never enters idle and pictures no M-6 state. It gains whatever methods the store
    interface gains, as no-ops. Nothing of M-6 is drawn in fixture mode, and nothing new reaches a built bundle.
15. **Red proofs beyond the consult's two.** Make each one, run it, show it in the Handoff and revert it:
    - Key the working area by nothing: case 10 fails, because the other manager sees the child's value.
    - Let a `me` 200 that names the idled person resume the session (enter signed-in): sequence (c) fails.
    - Remove the revision guard in `readSession`, and report honestly whether sequence (c) or (d) fails. If neither
      does, say which other check holds the line. The lead found in 011d1 that this guard is the only thing standing
      between a stale read and the screen, and wants to know whether that is still so.
    - Make the activity listener active while idle: the no-`activity` assertion of sequence (c) fails.
    - Remove the `cancel` prevention, or the Escape `keydown` prevention: case 6's Escape assertion fails.
    - Act on `actor-changed` while an other-manager sign-in is in flight: case 10's success path fails.
    - Do not capture focus before inerting: case 7's focus or selection assertion fails.
16. **Names, not test ids** (*What Task 12 needs from Task 11*). There is no `data-testid`. List in the Handoff every
    accessible name the harness will drive:
    - the dialog by its title, "Your session timed out";
    - "Username" and "Password";
    - "Continue" (while pending, "Verifying…");
    - "Sign in as a different manager";
    - "Stay with current manager" and "Continue to sign-in";
    - "Sign in" (while pending, "Signing in…");
    - "Back to {username}";
    - "Log out";
    - "Keep this draft" and "Discard changes and log out";
    - "Try again".

    Also state the `data-session` values.
17. **A served M-6 needs an idle session.** The owner has one manager (made on 2026-10-15). Thirty minutes of
    idleness can be waited out, or the session can be aged in the dev database `pos`:
    `UPDATE actor_session SET last_interactive_at = now() - interval '31 minutes' WHERE audience = 'BACK_OFFICE' AND
    released_at IS NULL;`. The lead runs that at the owner's word, then the manager presses a key or makes the tab
    visible. You cannot run the by-hand check in your sandbox. Say so, and the owner runs criterion 5 from your
    worktree before merge. Your tests use stubbed `fetch`.
18. **If the task proves too large,** do not ship part of it. Stop with `BLOCKED:` and propose a cut. **If a rule
    cannot be met against the built code,** stop and write `BLOCKED:` with what you observed. Do not work around a
    rule, and do not change `packages/**`.

## Constraints

- NFR-5 and FR-A2c as in 011d1: nothing imported across the two applications, and the back office's API module can
  name no POS route.
- B-12: the password is in its own request body and nowhere else. It is never in a URL, storage, the DOM, an
  attribute, the console or any other request. That holds for both M-6 forms.
- B-13: a re-authentication, a sign-in and a logout act only for the person this tab holds or the person who just
  signed in. Nothing is retried for anyone else (the core's rule 5, unchanged).
- B-24 and §14.4: no literal idle limit, absolute limit or cooldown, and no wall clock. Waits come from
  `retryAfterSeconds` on the monotonic clock.
- FR-A2b: `activity` comes from real input only, and **never while idle**. M-6 extends nothing.
- The *must not invent* list of question 7, whole. M-6 adds no PIN field, no "remember me", no password reveal, no
  strength meter and no "forgot password".
- No server change, no change to `packages/**`, no `docs/` change, and nothing in `apps/pos`.

## Tests expected to change

The lead asked the explorer (2026-10-15) and checked each hit against the file. All five are in
`apps/back-office/test/session-lifecycle.test.tsx`. Each pins 011d1's interim "idle shows BO-01", which this task
replaces. Change exactly these, as described, and no other existing test:

1. `:66-95`, the `describe.each` row `SESSION_IDLE (ruling 3, interim)` with its two tests. **Remove that row.** The
   `UNAUTHENTICATED` row stays exactly as it is. What the row tested moves into this task's cases 6, 7 and 10 under
   M-6.
2. `:306`, "the deadline read › reads me at the deadline, extends nothing, and a refused read ends the session on
   screen". It keeps its timing assertions, and now expects `data-session` `idle`, M-6 open, and the child in the
   DOM and inert.
3. `:358`, "round 2. F2 … a FORBIDDEN answered after an interim idle removes the retained work and shows Access
   refused". It now runs with M-6 open after the idle and expects M-6 closed, the child gone, *Access refused*, and
   a fresh child on a later sign-in as A.
4. `:380`, "any other end announced while BO-01 shows changes neither the notice nor the retained work". It is
   rewritten for M-6: the held `me` answered `UNAUTHENTICATED` while M-6 is open closes M-6 to BO-01 *Session ended*
   with the child kept, and a sign-in as A shows the child's value (ruling 6).
5. `:420`, "ruling 8, sequence (c)". It is rewritten as ruling 6 says.

The explorer found that no test asserts the exact set of phases, that `logout()` is ignored outside `signed-in`, or
that no `<dialog>` exists. `sign-in.test.tsx:219` and `:229` answer the *first* `me` with `SESSION_IDLE`, so they
are case 5, and they stay. `packages/api-client/test` changes nothing. If any other existing test needs to change,
stop and raise it.

## Acceptance criteria

1. `npm run verify` is green. The Handoff shows the counts against `development`'s baseline, which the lead records
   below this line at dispatch.
   **Baseline (lead, 2026-10-16): `development` at `ecead3d`, 89 test files, 3652 tests.**
2. Each new or changed test file is green three times in a row on its own. The Handoff maps to test names: cases 6,
   7, 8 and 10, M-6's half of case 9, and case 15 for M-6; the tests of rulings 4, 5, 6 (sequences (c) and (d)),
   7, 8, 9, 10 and 11; and each of the five tests that changed.
3. The consult's two red proofs and the seven of ruling 15, each made, run, shown and reverted in the Handoff.
4. The Handoff shows the output of each of these:
   - `grep -rnE "\bfetch\(|localStorage|sessionStorage|document\.cookie|sendBeacon|console\." apps/back-office/src`
     (nothing);
   - `grep -rnE "showModal|HTMLDialogElement" apps/back-office/src apps/back-office/test` (the source only calls
     the methods, and the shim lives in `test`);
   - `grep -rnE "apps/pos|@pos/pos-client" apps/back-office` (nothing, or each hit explained);
   - `grep -rnE "\b(90|300|1800|28800)\b" apps/back-office/src` (nothing, or each hit explained);
   - `git diff --name-only development` (every path inside `owns:`, plus this task file's Handoff).
5. **By hand, by the owner, before merge,** from this task's worktree (`npm run build:clients`, then `npm run dev -w
   apps/server`), at `https://localhost:8443/back-office/`. The owner signs in. The session is aged (ruling 17).
   Then:
   - A key press opens M-6 over the frame. Escape and a click on the backdrop do not close it, and Tab stays inside.
   - A wrong password shows "Incorrect password. Try again.".
   - The right password resumes, with *Resumed* shown.
   - Age the session again: Log out, then "Keep this draft", then Log out, then "Discard changes and log out", and
     BO-01 shows.

   The Handoff says what the builder could and could not check.
6. The Handoff carries forward what Task 12 (the harness) and Phase 1's first form need from M-6.

## Out of scope

- The kitchen emergency in M-6, the leave-the-draft confirmation for navigation (`unsaved`), and any alert.
- Any warning before the idle lock, and any countdown in the frame.
- A discard confirmation on the top bar's Log out outside M-6.
- Any server change, `packages/**`, `docs/` of any kind, and `apps/pos`. Slice B's BO-01 and BO-02.
- The designer's text owed at SCREEN-INVENTORY `:1115-1120` and `:617`.

## Handoff

**Builder's report, 2026-10-16.** Commits on `agent/phase0-011d2`: `c43f5d5` (M-6, the store phase, the tests) and `02e7f82` (a small fix found while writing this, below). The commit after those carries this Handoff. Nothing was pushed. No formatter was run. Nothing outside `apps/back-office/**` and this file changed: `git diff --name-only development` lists exactly the task file and these paths: `src/OfficeApp.tsx`, `src/Reauth.tsx` (new), `src/SignIn.tsx` (two constants exported), `src/copy.ts`, `src/office.css`, `src/session/{fixtureSession,realSession,types}.ts`, `test/dialog-shim.ts` (new), `test/reauth.test.tsx` (new), `test/session-harness.tsx`, `test/session-lifecycle.test.tsx`.

### What I built

**The store (`session/realSession.ts`, `session/types.ts`).** `SessionSnapshot` has a fourth phase, `idle`, holding the idled `person`, the mode (`same`, `confirm-other`, `other`, `confirm-logout`), `from` (the form a discard confirmation was opened from, which "Keep this draft" returns to), the attempt, the waits, `busy`, and the logout state. The store enters idle only from `signed-in`, only on the core's `session-ended` `SESSION_IDLE` (or `applyEnd` agreeing with it). `meaningOf` gained the `reauth` context and an `idle` meaning; load still gives `rest` (BO-01, case 5), and a sign-in or re-authentication answered `SESSION_IDLE` is the general failure. Entering idle advances the revision, captures the focus (see below), and clears any *Logout failed* notice. The `signed-in` snapshot gained `arrival` (`fresh`, `resumed`, `other-manager`), which is how the frame knows to show *Resumed* and where focus goes. Idle uses the existing `waitEnds` map and the same ticking redraw as BO-01, so a wait set in M-6 is the one BO-01 shows. `settled()` publishes the cleared `busy` flag into an idle snapshot as it does into a signed-out one (ruling 11). `reauthenticate(password)` sends `{ password }` through `officeApi` and nothing else. `signIn` in idle `other` mode sends the ordinary login; `otherSignIn` is true for exactly the span of that request, so the `actor-changed` the core emits for that sign-in's own install is ignored and the result decides (ruling 7). A logout in `confirm-logout` is the same code path as the top bar's, and any end it brings destroys the work. The store also has `chooseOtherManager`, `stayWithCurrentManager`, `continueToOtherSignIn`, `backToCurrentManager`, `askLogout`, `keepDraft` and `takeFocusMemory`. The fixture session gains them as no-ops and never goes idle.

**The screen (`Reauth.tsx`, `OfficeApp.tsx`).** The frame (rail, top bar, content pane) stays rendered and visible under idle, and `.bonav`, `.botop` and `.bocontent` all get `inert` from one layout effect keyed on the phase; none of them unmounts. The working area key now covers idle, so the child stays mounted. M-6 is two native `<dialog>` elements outside every inert element: the form dialog (modes `same`, `confirm-other`, `other`) and the discard confirmation, which takes its place and gives it back. Each is `closedby="none"`, with `aria-labelledby` and `aria-describedby`. A `cancel` listener prevents the default; a capturing `keydown` listener on `document` prevents Escape (and turns Escape into "Keep this draft" on the confirmation) and loops Tab and Shift+Tab; a `close` listener reopens whichever dialog the current mode means while the phase is idle. The guard reads the mode from the store, not from a render, so it does not fight the swap between the two dialogs. The password input is uncontrolled and emptied on read, and `CredentialForm` is keyed by mode so every change of mode gives an empty one. Both Username inputs take their value as a property from a ref and no input has a `value` attribute. The submit button sits in the dialog footer and points at the form with `form="reauth-form"`, as Frost does. Local checks are DESIGN-015's: an empty password "Enter your password.", an oversize one "Incorrect password. Try again." with the field cleared and focused (fixed form) or "Sign-in failed" (other form), empty username "Enter your username.". On an `ok` re-authentication `OfficeApp` takes the focus memory from the store in a layout effect declared after the one that lifts `inert`, focuses the captured element if it is still connected, and restores its selection; *Resumed* is a neutral `office-notice` with `role="status"`, not focused, after any *Logout failed* notice. An other-manager success focuses the top bar's Log out and shows nothing.

**The stylesheet.** `office.css` gained only the rules the task names, copied from Frost's `office.css` with `--frost-*` tokens: `danger` and `danger final`, the read-only field, `.office-dialog` and its `::backdrop`, `__head`, `__body`, `__foot`, the dialog `.office-error` and `label`. `no-invented-values.test.ts` still reads the whole stylesheet and is green. Nothing of M-6 is in fixture mode, and the built-bundle tests are green.

### What I decided, and on what evidence

- **Focus is captured in the store, synchronously, at the moment of the idle,** and consumed once by `OfficeApp`. The element lives in a private variable and not in the snapshot. Evidence: the task requires capture before anything is made inert and before `showModal()`; the store is the one place that runs before any render. The red proof for it (below) fails four tests.
- **The store keeps `person` through idle**, as it does through other phases. This is what makes the revision guard no longer the sole line against a stale `me` (see the red proof).
- **`confirm-other` and any mode change clear the attempt notice.** Waits persist. The task said Stay preserves "draft and wait" and does not mention a refusal notice; Frost redraws it on Stay, but "the password field is emptied at every change of mode" and a notice for a password that no longer exists read as wrong to me. If the lead wants the notice back on Stay, it is a small change.
- **Tab loop filter:** office.js filters on `getClientRects().length`, which is always zero in jsdom. I filter on `disabled` and `hidden` only, and render only what is visible. An `aria-disabled` button stays in the loop, as it does at BO-01.
- **Typed Username survives a visit to the discard confirmation** (`02e7f82`). I first lost it, because the other form unmounts while the confirmation is open. Frost keeps it, and DESIGN-015 says only "starts empty each time the form opens *from this choice*". A ref in `Reauth` holds the typed Username (never the password) and is cleared when the mode becomes `same` or `confirm-other`. One test covers it.
- **The kitchen state, `unsaved`, every alert, the response selector, the failure count and the timer are not built,** as the task says.

### Existing tests I changed (the five, and nothing else)

All in `test/session-lifecycle.test.tsx`.
1. The `SESSION_IDLE (ruling 3, interim)` row of `describe.each` is removed; the `UNAUTHENTICATED` row is untouched. What it tested moved to `reauth.test.tsx`.
2. "reads me at the deadline, extends nothing, and a refused read ends the session on screen": timing assertions unchanged; it now expects `data-session` `idle`, one open dialog, the child in the DOM, the pane visible and inert.
3. "a FORBIDDEN answered after the idle removes the retained work, closes M-6 and shows Access refused" (renamed from "…after an interim idle…"): runs with M-6 open, expects it closed, the child gone, *Access refused*, and a fresh child on a later sign-in as A.
4. The "any other end announced while BO-01 shows…" test is rewritten and renamed "a me answered UNAUTHENTICATED while M-6 is open closes it to BO-01 Session ended, keeps the child, and the same manager gets it back".
5. "ruling 8, sequence (c)" is rewritten as ruling 6 says, as three tests: "(c) me's A view arrives…", "(d) me delivers B's view…", and "(d) the same, then B signs in: B starts with a fresh child".

I also changed the harness `test/session-harness.tsx` (it exports `REAUTH` and installs the dialog shim in `mount`). That is test infrastructure in an owned path, not a changed assertion.

### Tests, by name

All in `test/reauth.test.tsx` unless named. **Case 6:** the describe `case 6. an idle session opens M-6 over the work` (dialog named by its title and described by its body, frame inert; "Escape, a close request and a click on the dialog itself leave it open"; the close guard; the Tab loop; initial focus; "the re-authentication sends the token, and only { password }"; "sends nothing on its own while open"; "the idle clears a Logout failed notice"). **Case 7:** the describe `case 7. the right password resumes the same session` (value, focus and selection 2 to 5, one mount, *Resumed* first and not focused; focus that was outside the working area; renewed token; *Resumed* second under a *Logout failed* notice; idle twice). **Case 8 and ruling 8:** the describe `case 8 and ruling 8. every answer to a re-authentication`. **M-6's half of case 9:** "UNAUTHENTICATED: BO-01 Session ended… (case 9)" and "UNAUTHENTICATED, then another manager signs in: a fresh child (case 9)". **Case 10 and ruling 7:** the describe `ruling 7 and case 10. another manager signs in from M-6`. **Ruling 5:** `ruling 5. the four modes`. **Ruling 6:** the sequence tests above, plus "sends nothing on its own while open". **Ruling 10:** `ruling 10. Log out from M-6`. **Ruling 11:** `ruling 11. one cookie-changing request at a time`. **Case 15 for M-6 and ruling 12:** `case 15 for M-6. the password` (seven body-only tests across re-authentication and the other form, `method="post"`, no PIN or reveal control, no `value` attribute in any mode). Counts: `reauth.test.tsx` 70 tests, `session-lifecycle.test.tsx` 27. Both files together were green three times in a row (97 tests each time).

### Red proofs (each made, run, read, and reverted; the three source files were compared with backups afterwards and are identical)

1. **Unmount the working area when M-6 opens** (the key is null in idle): 28 tests fail across the two files, including case 7's "closes M-6, lifts the inert attributes, restores the value, focus and selection, and shows Resumed".
2. **Key the working area by nothing:** 5 fail, all the "fresh child" tests: case 10's "a different staff user: the working area is a fresh one…", "(d) the same, then B signs in…", "UNAUTHENTICATED, then another manager signs in…", and the two older lifecycle tests.
3. **A `me` 200 naming the idled person enters signed-in** (this also had to let a stale read past the revision guard, or the guard drops it first): 2 fail, "(c) me's A view arrives…" and "a session that something else changed during the sign-in…".
4. **Remove the revision guard in `readSession`:** *neither sequence (c) nor (d) fails.* Only "a session that something else changed during the sign-in is BO-01 Session ended, the work kept" fails (expected `idle`, got `signed-out`). **The guard is no longer the only line**, as the lead asked to know. What holds for (c): only `origin === 'load'` may sign this tab in from nothing, the store now keeps `person` through idle, so a stale `me` naming the same person reaches the `refresh()` branch, and `refresh()` does nothing outside signed-in. What holds for (d): the `actor-changed` event already put the screen on BO-01 *Session ended*, and the stale read's `toSignedOut('ended')` repeats that. What the guard still uniquely does: it stops a stale read naming a third person from ending M-6 while an other-manager sign-in is in flight (the event is deliberately ignored then), and the named test is what proves it.
5. **The activity listener active while idle:** 2 fail, "(c) …" (activity count 2, expected 1) and "sends nothing on its own while open".
6. **Remove the `cancel` prevention:** 2 fail, "Escape, a close request and a click on the dialog itself leave it open" and "on the confirmation, Escape and a close request are 'Keep this draft'". **Remove the Escape `keydown` prevention:** the same two fail (`keydown.defaultPrevented` false).
7. **Act on `actor-changed` while the other sign-in is in flight:** 4 fail, including case 10's success path ("a different staff user…") and "the other manager then goes idle…".
8. **Capture focus late** (in `takeFocusMemory`, after M-6 took focus): 4 fail, case 7's value-and-focus test, "restores focus that was outside the working area", "goes idle again later…", and "(c)".
9. **Show M-6 on a reload** (load `SESSION_IDLE` meaning `idle`): 2 fail in `sign-in.test.tsx`, case 5's "is BO-01 resting, no notice, and a sign-in then succeeds" and "a failed sign-in leaves BO-01 as it was". This mutation leaves the store in `starting`; it proves case 5 depends on the load meaning being `rest`, not that a real reload-M-6 bug would show the dialog.
10. Extra, for ruling 12: writing the fixed Username with `defaultValue` fails 8 tests (every "no value attribute" assertion and the B-12 body-only tests).

### Output of the checks

`npm run verify`: typecheck clean for all six projects; 90 test files, 3726 tests, all passing, against `development`'s baseline of 89 files and 3652 tests at `ecead3d` (plus one file and 74 tests). The three-run check was on `reauth.test.tsx` and `session-lifecycle.test.tsx`.

- `grep -rnE "\bfetch\(|localStorage|sessionStorage|document\.cookie|sendBeacon|console\." apps/back-office/src`: no output.
- `grep -rnE "showModal|HTMLDialogElement" apps/back-office/src apps/back-office/test`: the source calls `.showModal()` twice and `.close()`, with `HTMLDialogElement` only as a type, in `src/Reauth.tsx`; the shim, which defines the methods, is `test/dialog-shim.ts`, and the test files use the type only.
- `grep -rnE "apps/pos|@pos/pos-client" apps/back-office` (excluding `node_modules` and `dist`): four hits, all in `test/boundaries.test.tsx` (the titles of 011d1's boundary tests and its self-test sample); none in source.
- `grep -rnE "\b(90|300|1800|28800)\b" apps/back-office/src`: no output.
- `git diff --name-only development`: the task file (the lead's own commit) and the paths above, all inside `owns:`.

### What jsdom cannot show, and what I could not run

jsdom 29 has no `showModal()` or `close()`, so `test/dialog-shim.ts` toggles `open`, focuses the first control as the platform's focusing steps do, and fires `close`. The tests drive Escape, `cancel`, a click on the dialog and Tab through it. **What only a browser shows, and no test here proves:** the top layer and the scrim, native inertness of the page behind the dialog, that `closedby="none"` ignores a backdrop click, that the capturing Escape listener really suppresses the platform's own close, the overflow region (a body taller than the dialog becomes a focusable region named by the title; jsdom has no layout, so `scrollHeight` is 0 and that branch never runs), and the real focus order. **No browser is available in my sandbox and I did not look for one.** Criterion 5 is the owner's, from this worktree, as the task says.

### What I found and did not fix

- **Ruling 8's `session-gone` answer to a re-authentication ("M-6 as it was, with no notice") has no test.** I could not construct it: every generation change in the core that makes a request obsolete comes with an event the store already acts on first (`actor-changed` or `session-ended`), and the store then drops the result by the revision check. The code path exists (`setIdleAttempt('none')`) and is unreached by any test.
- DESIGN-015's *Same-manager error* and the fixed form's oversize row share one sentence, so one test pins both. The *Other-manager error* and the other form's oversize row share another.
- SCREEN-INVENTORY `:1115-1120` still prints the owner's two questions as open; the task says that paragraph is the designer's.
- The `Resumed` notice is `role="status"`, not focused. A screen reader announces it, but nothing moves focus there, as the task says.

### For the next agent

**Accessible names Task 12 can drive:** the form dialog by its title "Your session timed out"; the discard confirmation by its title "Log out and discard your changes?"; "Sign in as a different manager" (the title of the other form too, and the title of the acknowledgement with a question mark: "Sign in as a different manager?"); fields "Username" and "Password"; buttons "Continue" (pending: "Verifying…"), "Sign in as a different manager", "Stay with current manager", "Continue to sign-in", "Sign in" (pending: "Signing in…"), "Back to {username}", "Log out", "Keep this draft", "Discard changes and log out", "Try again". The top bar also has a "Log out" button; it is inert while M-6 is open, so scope the lookup to the dialog. Elements carry internal ids (`reauth-password`, `reauth-switch`, and so on) that are not a contract; use the names. **`data-session` on `#root`:** `starting`, `signed-out`, `signed-in`, `idle`.

**For Task 12's served check:** the owner has one manager. Idle needs a session aged 31 minutes (ruling 17: `UPDATE actor_session SET last_interactive_at = now() - interval '31 minutes' WHERE audience = 'BACK_OFFICE' AND released_at IS NULL;`), then a key press or the tab becoming visible. After that the harness can assert the dialog, a wrong password, a resume, and the logout path.

**For Phase 1's first form:** mount it inside the keyed working area (`children` of `OfficeApp`) and it inherits M-6 for free: it stays mounted, visible and inert while idle, its focused element and selection are captured at the moment the session goes idle (including focus outside the form) and restored on a same-manager resume, a different manager's sign-in destroys it, and a reload loses it. AC-35's last sentence (that this holds in a real browser, with a real form) closes there, not here.

**One owner question this build does not answer:** after the eight hours, BO-01 *Session ended* keeps the draft hidden and inert for the same manager (the owner's 2026-10-14 ruling). The deferred BO-01 retained-draft sentence is still unplaced, as DESIGN-015's row says.

DONE
