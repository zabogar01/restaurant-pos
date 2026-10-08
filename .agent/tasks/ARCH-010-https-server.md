# ARCH-010 — The HTTPS server, loopback guard and client instance (plan Task 8)

Owner: `architect10`. Written by the lead, 2026-10-08. Read-only consult: you write one report,
`.agent/reviews/ARCH-010-https-server.md`, and touch nothing else. It is the architect consult
that comes before PHASE0-008 (plan Task 8), which is not yet written. Task 8 is the first code that
listens on a socket, sets a cookie and logs a request, so it decides where secrets can leak and
what every later route inherits.

## The question

Plan Task 8 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1975-2315`) gives a local
certificate script, a loopback guard, a client-instance plugin, `buildServer()`, `src/index.ts`
and an `ErrorCode` union in a new `@pos/contracts` package, with code and tests verbatim. It
predates ARCHITECTURE.md, the ADRs, ARCH-006 to ARCH-008 and everything built since. **What must
PHASE0-008 say instead?**

## What exists (verify it; do not take the lead's word)

- `apps/server/src/db/pool.ts` (`query`, `withTransaction`, `getPool`; `DATABASE_URL` required),
  `src/db/migrate.ts`, `src/config.ts` (`pinPepper()`, read per call). No HTTP code, no Fastify
  dependency yet, no `src/index.ts`, no `packages/contracts`.
- `src/domain/`: `pin.ts`, `audit.ts` (`writeSecurityEvent` takes an optional `clientInstanceId`),
  `throttle.ts`, `session.ts` (PHASE0-007; `createSession` takes a `clientInstanceId`),
  `back-office-credential.ts` and `argon2.ts` (PHASE0-007b). `apps/server/scripts/` holds
  `provision.ts` and `create-manager.ts`.
- `db/migrations/0003_client_instance_and_actor_session.sql`: `client_instance` (`pos_app` has
  SELECT, INSERT, UPDATE), referenced by `actor_session.client_instance_id` and
  `security_event.client_instance_id`. A well-formed UUID naming no row makes a security-event
  write fail with a foreign-key error after the throttle has committed its count (PHASE0-006
  case 16, PHASE0-007b case 24): the server must never pass an id it has not checked.
- Carry-forwards already owed to Task 8: the request logger must not log cookie headers
  (PHASE0-007 Handoff), and must redact a body's `pin` and `password` fields (PHASE0-007b
  Handoff). ARCH-006 §8 (`.agent/reviews/ARCH-006-phase0-core-schema.md:706-730`) lists plan
  defects, among them credentials as defaults in `config.ts` and test resets by `DELETE`.
- `apps/pos` runs on Vite at `localhost:5173` in development against fixtures. The back office has
  no client yet.

## Questions

1. **Plan Task 8 against ARCHITECTURE §3.1, §7.2, §11, §12, §13, §14.4, the ADRs and what is
   built.** What is wrong, and what must the task say? Name every plan line to drop or change.
2. **Local HTTPS** (§3.1: Fastify terminates TLS with a local development certificate; no Caddy,
   no internal CA, no trust installation). How the certificate is made, where the key lives (never
   in the repository), what the server does when it is missing, and how a browser and the test
   suite reach it.
3. **The loopback guard** (§3.1). Exactly which bind addresses are accepted (`127.0.0.1`, `::1`,
   `localhost`, other `127/8` addresses), where the value comes from, how resolution is handled so
   that a name cannot resolve to a LAN address, and what refusal looks like at startup.
4. **The client instance** (PRD §2 table, PRD `:113`, ARCHITECTURE §3.1 and §5.1): issuing the
   cookie (name, attributes, path, lifetime), creating and touching the row (`first_seen_at`,
   `last_seen_at`; on every request or only interactive ones), an absent, malformed or unknown
   cookie value, and how the id reaches the domain functions. It is not an authorization boundary;
   say what that rules out.
5. **Logging and errors** (B-12, §11, §12). The logger's redaction (cookie and set-cookie headers,
   `pin` and `password` in bodies, anything else), the error handler (no SQL, stack trace, secret,
   blind index, PIN or password in a response), and whether request bodies are logged at all.
6. **The error contract.** Is `@pos/contracts` with an `ErrorCode` union the right shape now
   (§13), what the response body looks like, and which codes Task 8 introduces versus Task 9.
7. **What of §7.2 belongs to Task 8 and what to Task 9:** the two session cookies'
   names and attributes, origin validation and the anti-CSRF token on mutating routes, the
   `interactive` flag per route. ARCH-008 §6 said Task 9 needs a consult of its own for these;
   say whether Task 8 should lay any of the mechanism (a plugin, a hook) so Task 9 only declares
   per route, or leave all of it to Task 9.
8. **Serving the bundles and development.** §3.1 wants one HTTPS origin serving both bundles and
   both APIs. What Task 8 serves now (the POS bundle is built against fixtures; the back office
   does not exist), and how the Vite dev server coexists with the one-origin rule (a proxy, or
   Vite only for fixtures until Phase 1).
9. **Process shape:** `src/index.ts`, configuration (B-24: no credential or secret as a default),
   startup order (migrations? the pepper check?), a health route that is not interactive,
   graceful shutdown and the pool.
10. **Sequencing and anything else.** Should Task 8 be split? What must the Task 9 consult then
    cover? Anything else in plan Task 8 that is wrong against B-11 to B-14, B-24, FR-A2c, FR-A7,
    AC-19 and AC-27.

## Read

Plan Task 8 (`:1975-2315`) and the parts of Tasks 9 to 12 that consume it;
`docs/ARCHITECTURE.md` §3, §5.1, §7, §11, §12, §13, §14; the ADRs in `docs/decisions/` (ADR-001
and ADR-009 above all); `docs/PRD.md` §2, FR-A1 to FR-A7, AC-19, AC-27, AC-28, AC-35;
`docs/BOUNDARIES.md`; ARCH-006 §8; ARCH-008 §6; the Handoffs of PHASE0-005 to PHASE0-007b in
`.agent/tasks/`; the files listed above. `.agent/DECISIONS.md` holds the owner's rulings; a ruling
not there is not decided.

## Report

Write `.agent/reviews/ARCH-010-https-server.md` in full prose: a short summary, an answer to each
question with its authority, and closing sections **For the task file** (rules, interface, test
cases, red proofs) for PHASE0-008, and **For the owner** for anything only the owner can decide
(with exact wording for any contract change). Where you illustrate code, use the names that are
built, not the plan's. Mind PostgreSQL's transaction-start `now()` in any SQL. Do not commit.
When done, run exactly one of:

    herdr agent prompt lead "architect10: ARCH-010 done — <one line>"
    herdr agent prompt lead "architect10: BLOCKED — <question>"
