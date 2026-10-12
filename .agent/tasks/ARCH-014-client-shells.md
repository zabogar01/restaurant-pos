# ARCH-014 — Two client shells (plan Task 11)

Owner: `architect14`. Written by the lead, 2026-10-12. Read-only consult: you write one report,
`.agent/reviews/ARCH-014-client-shells.md`, and touch nothing else. It comes before PHASE0-011
(plan Task 11), which is not yet written. Task 11 is the first task in which a browser client talks
to the server: it serves both bundles from the one HTTPS origin, wires the POS lock screen to the
real session routes, and creates the back-office client with its sign-in. It touches identity and
boundaries, so it decides how each client holds a session, a CSRF token and an idle deadline, and
what each client does with every code the server can answer.

## The question

Plan Task 11 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3018-3504`) creates a
tokens package, a POS app with a PIN pad, a back-office app with a PIN form, and serves both with
`@fastify/static` rooted at `process.cwd()`. Almost none of it matches what exists: the POS client
is built (POS-01 to POS-07 against fixtures and a client order store), `@pos/tokens` exists with
Frost values, the back office signs in with a username and password (ADR-009) and has re-authentication
(M-6), the server has a session guard, CSRF tokens, `rpos_cid` and an error envelope, and ARCH-010
listed what serving a bundle must settle. **What must PHASE0-011 say instead, and should it be split?**

## What exists (verify it; do not take the lead's word)

- **POS client** (`apps/pos/src/`): `App.tsx`, `PosRoutes.tsx` (holds a fixture `session` and the
  order lock), `PinPad.tsx`, `Approval.tsx` with `approvalFixtures.ts`, the order store and the
  screens. It makes no API call today. Vite serves it on `http://127.0.0.1:5173` with no proxy
  (ARCH-010, PHASE0-008b's Handoff).
- **Back office:** no client. Design in Frost exists for slice A (DESIGN-012: shell, alerts, M-6,
  shared patterns), slice C (BO-13) and slice I (BO-12). Slice B (BO-01 sign-in, BO-02) is not
  designed in Frost; it waits on open design questions, and BO-01 and SITEMAP `:248` still name a
  PIN at the back office.
- **Packages:** `@pos/tokens` (Frost), `@pos/contracts` (codes, `SessionView`, the zod 4 request
  schemas, `ManagerPin`), `@pos/money`.
- **Server** (`apps/server/src/http/`): `buildServer`; the Host and origin guard (`loopback.ts`,
  `origin.ts`); `rpos_cid` (`client-instance.ts`); route access declarations and the session guard
  (`access.ts`, `session-guard.ts`); `approval.ts`; the envelope (`errors.ts`). Routes:
  `GET /api/health`; `POST /api/pos/auth/login`, `GET /api/pos/auth/me`, `POST /api/pos/auth/activity`,
  `POST /api/pos/auth/release`; `POST /api/back-office/auth/login`, `GET …/me`, `POST …/activity`,
  `POST …/logout`, `POST …/reauthenticate`. Nothing is served outside `/api`; the not-found handler
  answers plainly there; there is no catch-all route.
- **No production approval route exists.** PHASE0-010b proved the approval adapter through a
  test-only probe; the first gated command arrives in Phase 2.

## Questions

1. **Plan Task 11 against what is built and decided.** What is wrong, and what must the task say?
   Name every plan line to drop or change. Use the built names. Say whether Task 11 should be split
   (as Tasks 8, 9 and 10 were) and, if so, into which slices in which order.
2. **Serving the bundles.** ARCH-010 §*Task 8 serves `/api/health`* lists what this needs: a root
   anchored to a file, not `process.cwd()`; the fallback for client-side paths under `/pos/` and
   `/back-office/`; what each path answers when its bundle has not been built; cache headers; and
   content-security headers. Settle each, plus where the build output lives (the tree, the ignore
   file, `npm run verify`), how the Host and origin guard and `rpos_cid` apply to bundle requests,
   and how the not-found handler stays plain outside `/api`.
3. **Development workflow.** Vite stays fixture-only on `127.0.0.1:5173` with no proxy (ARCH-010).
   Once the POS calls the server, how does a developer run it against the real server, and how do
   the fixture screens keep working where the server has no route yet (orders, closed orders,
   refunds, approvals)? Say what is real in Phase 0, what stays fixture, and how a build cannot
   ship a fixture where a real call is owed.
4. **One request path per client.** ARCHITECTURE §4.3 says shared behavior without a shared client.
   Design the request wrapper each client uses: the `csrfToken` held in memory only and sent as
   `X-RPOS-CSRF` on every non-GET request; on `CSRF_REFUSED`, read `me` once and retry once
   (ARCH-012 *For the lead* 4); switching on `error.code`, never on the status (three codes share
   401); on a 5xx or no response, asking `health`. Where it lives, whether any of it belongs in
   `@pos/contracts`, and how it is tested.
5. **The session in each client.** The POS: sign-in from POS-01, `me` after a reload, release,
   `SESSION_IDLE` back to POS-01, `UNAUTHENTICATED` on a session the client believed it had as
   *session invalidated*, and a fifth failed PIN's `retryAfterSeconds` on `INVALID_CREDENTIALS`. The
   back office: username and password sign-in, `SESSION_IDLE` to M-6 with the cookie kept, M-6
   impossible after a reload (Login releases the idle session, only on success), logout. How the
   built fixture `session` in `PosRoutes.tsx` gives way to the real one without breaking POS-02 to
   POS-07, and what the shared `localhost` cookie jar (ADR-010) means for one browser holding both.
6. **Activity and the idle countdown.** `activity` is called only from real input (a touch, a key),
   debounced, never from a timer or a poll, and a client test must prove it (009a, ARCH-012). The
   visible countdown must be reckoned from the last request the server accepted as interactive,
   not from the last touch. Say how the client learns the deadline (does `SessionView` carry what
   it needs, or must the server add something, and if so whether that is a Task 11 server change),
   and what the screen shows as the deadline nears.
7. **The back-office shell without slice B.** BO-01 is not designed in Frost and still shows a PIN.
   Can Task 11 build the shell and sign-in from DESIGN-012 and the sitemap's behavior, must it wait
   for slice B, or should Task 11 build only a functional sign-in that slice B's frontend task later
   restyles? Say what the builder must not invent.
8. **The M-1 approval prompt.** ARCH-013 *For the lead* 5 lists what the prompt needs (the two
   codes, a failure never ending the cashier's session, the PIN discarded after every response, the
   keypad disabled until `retryAfterSeconds` has passed) and says the fixture stand-ins go only when
   the command they stand in for exists. With no production route in Phase 0, what, if anything,
   does Task 11 change in `Approval.tsx`?
9. **Copy for each code.** 009b's Handoff says the exact copy for each code is the client's to
   write. Say whether that holds or whether it belongs to the designer, which screens already
   carry the wording (POS-01, M-1, M-6), and which codes have no drawn state.
10. **Proofs and acceptance.** The client tests and server tests that Task 11 owes; which PRD
    acceptance criteria close at Task 11 and which only at Task 12's browser harness; what Task 12
    needs from Task 11 (stable selectors, a served bundle, a seeded manager) and does not have.
11. **Anything else** in plan Task 11 that is wrong against the boundaries, ADR-009, ADR-010, NFR-5
    (layout per client) and the design rules the frontend tasks carry (STATE's BO-13 and BO-12
    rules apply only when those screens are built).

## Rules already binding (do not reopen)

ADR-007, ADR-009 and ADR-010; the owner's rulings in `.agent/DECISIONS.md`; ARCH-010's choice that
Vite stays fixture-only with no proxy unless you show why it must change; ARCH-012's route
declarations, session guard and codes as built; ARCH-013's approval codes as built in 010b; no
credential in a URL or in browser storage; handlers never write an error body; the Frost tokens as
the only visual values (the plan's placeholders are superseded). A ruling not in DECISIONS.md is not
decided.

## Read

Plan Task 11 (`:3018-3504`) and Task 12 (`:3506-3751`); `docs/ARCHITECTURE.md` §3, §4, §7.2 and §13;
`docs/decisions/` (ADR-009 and ADR-010 above all); `docs/PRD.md` FR-A1 to FR-A6, NFR-5 and the
acceptance criteria on sign-in, idle and the two clients; `docs/BOUNDARIES.md`; `docs/DESIGN.md`;
`docs/design/SITEMAP.md` and `SCREEN-INVENTORY.md` for POS-01, M-1, M-6 and BO-01; ARCH-010
§*Task 8 serves `/api/health`*, ARCH-012 *For the lead* and ARCH-013 *For the lead* in
`.agent/reviews/`; the Handoffs of PHASE0-008a, 008b, 009a, 009b and 010b in `.agent/tasks/`, each
one's notes *For Task 11*; the code listed above. For any library fact (`@fastify/static`, Vite,
React), ask the librarian: `.agent/bin/ask.sh librarian "<question>"`.

## Report

Write `.agent/reviews/ARCH-014-client-shells.md` in full prose: a short summary, an answer to each
question with its authority, and closing sections **For the task file** (rules, interfaces, files,
test cases, red proofs, the split if you recommend one) for PHASE0-011, **For the lead** for anything
the designer or a later task needs, and **For the owner** for anything only the owner can decide,
with exact wording for any contract change. Do not commit. When done, run exactly one of:

    herdr agent prompt lead "architect14: ARCH-014 done — <one line>"
    herdr agent prompt lead "architect14: BLOCKED — <question>"
