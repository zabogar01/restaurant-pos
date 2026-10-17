# ARCH-015 — The browser harness (plan Task 12)

Owner: `architect15`. Written by the lead, 2026-10-16. Read-only consult: you write one report,
`.agent/reviews/ARCH-015-browser-harness.md`, and touch nothing else. It comes before PHASE0-012
(plan Task 12), which is not yet written and is the last task of Phase 0. Task 12 is the first
automated test that drives a real browser against the real server: both bundles served from the one
HTTPS origin, real sign-in, real cookies, real idle. It touches identity, audit and boundaries, so it
decides how the harness gets people, a database, a server and a clock without weakening any of them.

## The question

Plan Task 12 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:3506-3750`) adds an `e2e`
workspace with Playwright, a seeder in `apps/server/src/db/seedTestUsers.ts`, five tests for AC-19,
AC-27 and AC-28, and folds the browser run into `npm run verify`. It was written before anything it
drives existed, and ARCH-014 (*For the lead* 7) already named faults in it: a seeder that deletes
from `audit_entry` (B-7); a table and a column that do not exist (`app_session`,
`last_activity_at`); a database password on a command line; a PIN typed at the back office; an
AC-27 test expecting `FORBIDDEN` from a sign-in, which never answers it; an AC-28 test asserting a
status where three codes share 401; and `data-testid` selectors the clients do not have. **What
must PHASE0-012 say instead, and should it be split?**

## What exists (verify it; do not take the lead's word)

- **Server** (`apps/server/src/http/`): serves `/pos/` and `/back-office/` from the built bundles
  (011a) with a content security policy exported as `CONTENT_SECURITY_POLICY`; the Host and origin
  guard; `rpos_cid`; the session guard; the error envelope; the POS and back-office auth routes,
  including `reauthenticate`. No production route takes a manager approval (Phase 2). The server's
  tests run serially on `pos_test` as `pos_app`, behind an advisory lock in
  `apps/server/test/support/global-setup.ts`; people are made by `test/support/people.ts`, and
  `test/support/client.ts` is the API-level jar client 009a built for the two harness shapes.
- **POS** (`apps/pos`): POS-01 signs in for real (011c2); POS-02 to POS-07 still run on fixtures and
  the client order store. **Back office** (`apps/back-office`): real sign-in with the provisional
  BO-01 form (011d1), the empty Phase 0 frame, and M-6 over the keyed working area (011d2).
- **The transport core** `@pos/api-client` (011c1). `npm run build:clients` builds both bundles.
- **Selectors:** there is no `data-testid` anywhere, by ruling. The harness drives accessible names
  and reads `#root[data-session]` (`starting`, `signed-out`, `signed-in`, and `idle` at the back
  office) and POS-01's `data-lock-state`. The names are listed in the Handoffs below.
- **The root `package.json`** lists an `e2e` workspace; the directory does not exist.
- **People in development:** `create-manager` reads only from a real terminal, by design. The
  development database `pos` holds one manager, made by the owner.
- **Browser evidence so far:** the owner checked both shells by hand in Chrome and Safari on
  2026-10-13 (no policy violation, `GET /api/health` 200, `rpos_cid` stored `Secure; HttpOnly;
  SameSite=Strict` and resent after the certificate warning was clicked through), and the lead
  checked 011d2's M-6 in Chrome on 2026-10-16, ageing the session in the database (011d2's task
  file, above its Handoff). No automated browser run exists.

## Questions

1. **Plan Task 12 against what is built and decided.** Name every plan line to drop or change, and
   use the built names. Say whether Task 12 should be split and, if so, into which slices in which
   order.
2. **The harness itself.** Which tool and version (ask the librarian; do not recall), which
   browsers (the owner checked Chrome and Safari by hand), where it lives (the listed `e2e`
   workspace or elsewhere), and how it meets the self-signed certificate: `ignoreHTTPSErrors`, or
   trusting the certificate in `~/.config/restaurant-pos/tls/`, and what each means for what the
   test proves about `Secure` cookies. ARCH-010 and 009a ask for `baseURL` on `localhost`, mutating
   calls made by the page so that `Origin` and the CSRF token are the browser's own, and two shapes:
   one context with two pages (a shared jar) and two contexts (two actors).
3. **The server, the database and the people.** A port and a database of its own, so that the run
   neither collides with a development server on 8443 nor trips the installation-wide throttle of
   `pos`. How the database is made and migrated; how the server is started and stopped for the
   run; how `PIN_PEPPER` and any credential reach it with no literal in the tree and nothing on a
   command line (ARCH-010); how a cashier and a manager (with a back-office credential) are made
   through the domain functions with no `DELETE` anywhere (B-7); and how it coexists with the
   server tests' advisory lock and `pos_test`.
4. **Time and state between tests.** How a test ages a session (`actor_session.last_interactive_at`
   over the owner connection of the harness database) without a password on a command line; how a
   test that trips the `LOGIN` throttle (AC-19) leaves the next test a clean installation when
   rows may not be deleted (a fresh database per file, per test, or something else, and what it
   costs); and how the harness waits on the clients' sixty-second activity debounce without real
   waits.
5. **What closes in Task 12.** ARCH-014 §10's table lists what closes only in a browser: NFR-1 in
   one run, NFR-5's "two visibly different applications", AC-1's first clause against the real
   server, AC-19 at the real pad with a cleared `rpos_cid`, AC-27 with one profile holding both
   sessions, AC-28's divergent timeout presentation (the POS at POS-01, the back office at M-6),
   and AC-18's client side as a log scan with a browser driving. Add what later tasks deferred
   here: no `securitypolicyviolation` in either shell (011a); a `POST` with no `Content-Type` and
   no body accepted by Fastify (ARCH-014, *not verified*); M-6's served path (011d2's *For Task
   12's served check*). For each, the test and its red proof, or the reason it stays open and
   until when. Say which criteria stay open past Phase 0 (AC-32's POS half and AC-35's last
   sentence go to Phase 1 per ARCH-014).
6. **`npm run verify` and who can run it.** Whether the browser run joins `verify` (the plan's
   Step 7) or stays a separate script, given that it needs browser binaries, the database and a
   served build, that reviewers' sandboxes cannot reach `127.0.0.1:5433` (`EPERM`), and that
   builders and the lead run `verify` on every task. Say what a reviewer can check without running
   it, and what the lead must run.
7. **The Phase 0 Definition of Done** (plan `:3752-3761`). For each item, whether it is already
   proved and where, whether Task 12 proves it, or what else Phase 0 owes before it can close.
8. **The commissioned browser-clients ADR** (DECISIONS 2026-10-13: one ADR, as Proposed, on the
   browser clients and what is served to them, taking in ARCH-012's sessions-over-HTTP ADR). Does
   Task 12 depend on it, or should the ADR record what Task 12 settles? Recommend an order. Do not
   write the ADR in this consult.
9. **Anything else** in plan Task 12 that is wrong against the boundaries, ADR-009, ADR-010, B-24
   (no seeded production configuration) and the owner's rulings.

## Rules already binding (do not reopen)

ADR-007, ADR-009 and ADR-010; the owner's rulings in `.agent/DECISIONS.md`; ARCH-014's design as
built by 011a to 011d2, including names rather than test ids and the one-cookie-changing-request
rule per tab (DECISIONS 2026-10-14); no credential in a URL, browser storage, the tree or a command
line; no `DELETE` or `UPDATE` against the append-only tables (B-7); handlers never write an error
body. A ruling not in DECISIONS.md is not decided.

## Read

Plan Task 12 (`:3506-3750`) and the Phase 0 Definition of Done (`:3752-3766`);
`docs/ARCHITECTURE.md` §3, §4, §7, §13 and §14 (testing strategy); `docs/decisions/` (ADR-009 and
ADR-010 above all); `docs/PRD.md` FR-A1 to FR-A7, NFR-1, NFR-5, and AC-1, AC-18, AC-19, AC-27,
AC-28, AC-32, AC-35; `docs/BOUNDARIES.md`; `docs/ROADMAP.md` *Phase 0 — Foundations*; in `.agent/reviews/`: ARCH-010 (Task 8
serves, and its notes for Task 12), ARCH-012 *The two-client harness* and *For the lead*, ARCH-014
§10, §11 and *For the lead* 7; in `.agent/tasks/`: the notes *For Task 12* in the Handoffs of
PHASE0-008a, 008b, 009a, 009b, 011a, 011c2 (*For 011d and Task 12*), 011d1 (*For Task 12 (the
harness)*) and 011d2 (*For the next agent*); `apps/server/test/support/`,
`apps/server/src/http/`, `apps/server/scripts/`, `db/`, the root `package.json`, and each client's
`#root` and sign-in components. For any library fact (Playwright, Fastify, Chrome or WebKit
behaviour), ask the librarian: `.agent/bin/ask.sh librarian "<question>"`.

## Report

Write `.agent/reviews/ARCH-015-browser-harness.md` in full prose: a short summary, what you
verified and what you could not, an answer to each question with its authority, and closing
sections **For the task file** (rules, interfaces, files, test cases, red proofs, acceptance beyond
`npm run verify`, the split if you recommend one) for PHASE0-012, **For the lead** for anything the
designer or a later task needs, and **For the owner** for anything only the owner can decide, with
exact wording for any contract change. Do not commit. When done, run exactly one of:

    herdr agent prompt lead "architect15: ARCH-015 done — <one line>"
    herdr agent prompt lead "architect15: BLOCKED — <question>"
