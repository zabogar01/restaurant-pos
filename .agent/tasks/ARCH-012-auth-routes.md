# ARCH-012 — Authentication routes and audience enforcement (plan Task 9)

Owner: `architect12`. Written by the lead, 2026-10-09. Read-only consult: you write one report,
`.agent/reviews/ARCH-012-auth-routes.md`, and touch nothing else. It comes before PHASE0-009 (plan
Task 9), which is not yet written. Task 9 adds the first routes that verify a credential, issue a
session cookie and refuse a request by audience, so it decides how every later route is declared
and how a browser proves who is acting.

## The question

Plan Task 9 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:2316-2729`) gives the
authentication routes and audience enforcement, with code and tests verbatim. It predates
ARCHITECTURE.md, ADR-009 and ADR-010, ARCH-006 to ARCH-011, and everything built since. **What must
PHASE0-009 say instead?** ARCH-008 §6 and ARCH-010 §10 both said Task 9 needs this consult before it
is written.

## What exists (verify it; do not take the lead's word)

- **Domain** (`apps/server/src/domain/`): `pin.ts`, `audit.ts` (`writeSecurityEvent`), `throttle.ts`
  (`verifyPinThrottled`), `session.ts` (PHASE0-007: `createSession`, resolution, idle and absolute
  expiry, `reauthenticateSession`, credential-version invalidation), `back-office-credential.ts`
  (PHASE0-007b: `verifyPasswordThrottled`, per-account throttle), `argon2.ts`. Each takes an
  optional `clientInstanceId`.
- **HTTP** (`apps/server/src/http/`, PHASE0-008a and 008b, merged at `development` `dfc96c3`):
  `buildServer({ origin, logLevel, tls?, logStream?, apiRoutes? })`; one encapsulated `/api` context
  with `no-store`, the origin guard and the `rpos_cid` client-instance hook; a root Host check;
  `AppError` and the error envelope with no message; the logging allow-list; `@fastify/cookie` 11,
  unsigned; health declares `config: { clientInstance: false }`. `@pos/contracts` holds `ErrorCode`
  (seven codes, `ORIGIN_REFUSED` the newest) and the details-by-code typing. Tests reach the server
  through `test/support/request.ts`. No route beyond `GET /api/health`.
- **Migrations** `0001` to `0007`; `actor_session`, `security_event`, `back_office_credential`.
- `apps/pos` is built against fixtures (POS-01 PIN pad and the M-6 approval prompt among them). The
  back office has no client yet.

## Questions

1. **Plan Task 9 against what is built and decided.** What is wrong, and what must the task say?
   Name every plan line to drop or change, including those ARCH-011's Handoff lists for Tasks 9 to 12
   (`.agent/tasks/ARCH-011-http-boundary-adr.md`, Handoff, item 4).
2. **The two session cookies** (ARCHITECTURE §7.2, ADR-010, ARCH-011 Handoff *What the Task 9
   consult must take from ADR-010*): names on the `rpos_` stem; `__Host-` or path scoping to
   `/api/pos` and `/api/back-office`, chosen deliberately; lifetime against the POS 90-second idle
   and the back-office 30-minute idle and 8-hour absolute (FR-A2, A2b); clearing on release, on
   expiry and when no session resolves.
3. **The anti-CSRF token** (§7.2): its shape and binding, where it is issued and checked, and what
   protects the two sign-in routes, which have no session to bind it to. It may not be the client
   instance, and passing the origin guard is evidence of nothing (FR-A2c).
4. **The route declaration:** `audience` (POS, back office, FR-A2c's shared read routes that accept
   either), `interactive` (FR-A2b), the back-office `MANAGER` requirement, and how an undeclared
   route, or an API path registered outside the `/api` context, fails at startup. Health gains its
   declaration here.
5. **The authentication codes and statuses** in the envelope, on both surfaces: a failed
   verification, a cooldown (with `retryAfterSeconds` as a declared details type), no session, an
   idle back-office session (M-6 must tell idle from none), a role refusal, a CSRF refusal. An
   unknown username must be indistinguishable from a wrong password (ADR-009), and no code may tell
   a caller that a token is valid on the other surface. Whether a database failure in a hook or a
   route is 503 `UNAVAILABLE` or 500 `INTERNAL` (PHASE0-008b's Handoff leaves the cookie hook's at
   500 for this consult).
6. **Verification order:** is a malformed PIN (not six digits) refused before the throttle or
   counted by it (PHASE0-006 Handoff)? The same for a malformed username or password (PHASE0-007b).
   Six digits is enforced at the route (PHASE0-004 to 007 carry-forwards).
7. **The M-6 sequence over HTTP** (back-office re-authentication, password only, and "another
   manager"), and releasing a presented session at login: what happens to a session the browser
   already holds when someone signs in.
8. **Role and credential edges:** a manager demoted to cashier keeps a resolving session with role
   `CASHIER` (no version bump on a role change, PHASE0-007 Handoff); the back-office guard must refuse
   it. Say how, and whether it needs anything the domain does not offer. Note, without deciding,
   ADR-009's three Phase 1 questions where a route would depend on them.
9. **Validation:** `zod` (or not), and how a schema failure becomes `VALIDATION_FAILED` without
   echoing input: no field value and no library message in `details`; field names, if any, by the
   schema's own keys, typed in the contracts.
10. **Proofs and sequencing.** The route-level tests that close AC-19, AC-27, AC-28 and AC-35, the
    two-client harness the roadmap asks for in Phase 0, and whether Task 9 should be split as Task 8
    was. Anything else in plan Task 9 that is wrong against B-11 to B-14, B-24, FR-A2 to FR-A7.

## Rules already binding (do not reopen)

ADR-009 (back-office username and password), ADR-010 (the HTTP boundary) and the owner's rulings in
`.agent/DECISIONS.md`, among them: `localhost` is one shared cookie jar, accepted for the MVP with
project-specific names, `HttpOnly`, `Secure`, `SameSite=Strict`; the kit never installs certificate
trust; FR-A7's first contact is the first API request; the same-class PIN reset and per-account
lockout risks are accepted until the pre-production gate. No credential in a URL, ever. Handlers
never write an error body and never read a cookie except through the route's declared session.

## Read

Plan Task 9 (`:2316-2729`) and the parts of Tasks 10 to 12 that consume it; `docs/ARCHITECTURE.md`
§3, §5, §7, §11 to §13; `docs/decisions/` (ADR-001, ADR-009, ADR-010 above all); `docs/PRD.md` §2,
FR-A1 to FR-A7, FR-J, AC-19, AC-27, AC-28, AC-35; `docs/BOUNDARIES.md`;
`docs/design/SCREEN-INVENTORY.md` for POS-01 and M-6; ARCH-007 §7, ARCH-008 §6 and §7, ARCH-010 §7
and §10, ARCH-011's Handoff, in `.agent/reviews/` and `.agent/tasks/`; the Handoffs of PHASE0-004
to PHASE0-008b in `.agent/tasks/`; the code listed above. A ruling not in DECISIONS.md is not
decided.

## Report

Write `.agent/reviews/ARCH-012-auth-routes.md` in full prose: a short summary, an answer to each
question with its authority, and closing sections **For the task file** (rules, interface, test
cases, red proofs, split if you recommend one) for PHASE0-009, and **For the owner** for anything
only the owner can decide, with exact wording for any contract change. Use the built names, not the
plan's. Mind PostgreSQL's transaction-start `now()` in any SQL. Do not commit. When done, run
exactly one of:

    herdr agent prompt lead "architect12: ARCH-012 done — <one line>"
    herdr agent prompt lead "architect12: BLOCKED — <question>"
