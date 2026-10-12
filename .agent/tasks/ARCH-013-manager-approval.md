# ARCH-013 — Inline manager approval (plan Task 10)

Owner: `architect13`. Written by the lead, 2026-10-12. Read-only consult: you write one report,
`.agent/reviews/ARCH-013-manager-approval.md`, and touch nothing else. It comes before PHASE0-010
(plan Task 10), which is not yet written. Task 10 builds the primitive every later approved action
goes through (discounts, voids, refunds, a lease takeover), and it touches identity, audit and
boundaries B-13 and B-14, so it decides how a manager's PIN authorises one action at one moment and
what evidence each outcome leaves.

## The question

Plan Task 10 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:2730-2980`) gives
`withManagerApproval` and `ApprovalError`, with code and tests verbatim. It predates ARCHITECTURE.md,
ADR-007's built form, ADR-009 and ADR-010, ARCH-006 to ARCH-012, and everything built since: it
deletes from `app_session` and resets `auth_throttle`, neither of which exists. **What must PHASE0-010
say instead?** ARCH-006 §8, ARCH-007 §7, ARCH-008 and ARCH-012 each said Task 10 needs its own
consult.

## What exists (verify it; do not take the lead's word)

- **Domain** (`apps/server/src/domain/`): `pin.ts` (`createStaffUser`, `findUserByPin`), `throttle.ts`
  (`verifyPinThrottled(throttleClass, pin, { clientInstanceId })` returning `ThrottledVerification`:
  `VERIFIED` with the user, `FAILED` with `retryAfterSeconds: number | null`, `THROTTLED` with
  `retryAfterSeconds`; it writes its own security events), `audit.ts` (`AuditOutcome` is `SUCCESS`,
  `APPROVAL_FAILED`, `APPROVAL_CANCELLED`; `writeAudit(client, …)`, `writeAuditOwnTransaction`,
  `writeSecurityEvent`), `session.ts`, `back-office-credential.ts`, `staff.ts`. ARCH-007 §7 rejected a
  callback under the throttle's lock; read why before proposing one.
- **Migrations** `0001` to `0007`. `0004`'s `audit_entry` constrains `outcome` to the three values
  above and requires `approver_id IS NULL` unless `SUCCESS`; read its grants and its immutability.
- **HTTP** (PHASE0-008a to 009b, merged at `development` `cb23a29`): `buildServer`, the `/api`
  context and its hooks, `config.access` declarations (`NONE`, `OPTIONAL`, `ACTIVE` with an audience
  and `interactive`) and the session guard with startup refusals (`http/access.ts`,
  `http/session-guard.ts`: `actorOf`, `csrfTokenOf`, `signIn`, renewal), `http/validate.ts`
  (`parseBody`), `http/verification.ts` (`verifiedUser`), the credential routes, the jar client in
  `test/support/client.ts`. `@pos/contracts` holds the codes, among them `INVALID_CREDENTIALS` and
  `THROTTLED` with `{ retryAfterSeconds }`, `SessionView`, and the zod 4 request schemas.
- **No server-side order, discount, void or refund exists.** Those arrive in Phases 2 and 3; the POS
  client has them against fixtures, including the approval prompt.
- **009b's Handoff, *Carried forward*, "For Task 10"** (in `.agent/tasks/PHASE0-009b-credential-routes.md`):
  an approval route is `ACTIVE`, `POS`, interactive, takes its actor from `actorOf(request)`; the
  approver is a PIN in that request's body, never a session of either audience.

## Questions

1. **Plan Task 10 against what is built and decided.** What is wrong, and what must the task say?
   Name every plan line to drop or change. Use the built names.
2. **The cooldown-refused approval.** The owner ruled on 2026-10-06 that a cashier's approval refused
   by the cooldown writes an **audit entry, not a security event** (DECISIONS.md). Design it: the
   outcome value, the migration that admits it into an append-only table whose `CHECK` and grants
   are already in place, and whether anything else (a retry time, the class) belongs in the entry.
   Say whether PRD AC-18 and FR-J3 ("throttle cooldowns are security telemetry") read consistently
   with the ruling as written; if not, give exact replacement wording for the owner, and do not
   treat it as decided.
3. **Shape of the primitive.** A function that runs the approved work, or a verification that hands
   back an approver for the caller's transaction, or something else. Where the combined `SUCCESS`
   entry is written (in the work's transaction, ADR-007), where a failed one is written (its own
   committed transaction), and what happens when the work itself fails or the database fails after
   a successful verification. How a caller is prevented from using an approval twice, or for an
   action other than the one approved (B-14, FR-A6), in the type system and at runtime.
4. **Who may approve.** A cashier's PIN, the actor's own manager PIN (a manager approving their own
   action), an inactive manager, a PIN that matches nobody: which are failures that count in
   `MANAGER_APPROVAL`, which are refused before the throttle (a malformed PIN, as ARCH-012 §6 ruled
   for sign-in), and which audit outcome each writes. ADR-009 says the class "enforces its role
   rule"; say how.
5. **Cancellation.** FR-J3 audits a cancelled approval. A cancel happens on the client. How does the
   server learn of it, which route and declaration carries it, what stops a client from forging or
   flooding it, and what it records.
6. **Routes in Phase 0.** No approved action exists server-side yet. Does Task 10 ship any route, a
   test-only probe, or only the domain primitive? A route that only verifies a manager PIN and
   answers "yes" is an approval that outlives its moment (B-14); say how the design avoids it. If
   routes ship: declarations, request schemas, codes and statuses (an approval failure must not be
   confused with the cashier's own session failing), `retryAfterSeconds`, and what the POS client
   (Task 11) needs to show the prompt's states.
7. **Telemetry and secrets.** What `verifyPinThrottled` already writes on a `MANAGER_APPROVAL`
   failure and cooldown, and whether an approval failure must also be an audit entry, with no
   double-counting and no PIN in any store or log (B-12, AC-18). AC-19: an approval success must not
   reset `LOGIN`, and a login must not reset `MANAGER_APPROVAL`.
8. **Constants and time.** B-24 and the throttle's constants; PostgreSQL's transaction-start `now()`
   in any SQL you propose (use `clock_timestamp()` where the moment matters).
9. **Proofs and sequencing.** The tests that close the approval parts of AC-18, AC-19 and AC-27, the
   red proofs, and whether Task 10 should be split as Tasks 8 and 9 were.
10. **Anything else** in plan Task 10 that is wrong against B-11 to B-14, B-24, FR-A5, FR-A6, FR-J3 and
    ADR-007. Note, without deciding, ARCH-006's open owner item 6 (whether an approved void the server
    then refuses writes a `REFUSED` entry) and FR-J3's `REFUSED` outcome for refunds, where your design
    must leave room for them.

## Rules already binding (do not reopen)

ADR-007, ADR-009 and ADR-010; the owner's rulings in `.agent/DECISIONS.md`, among them the
2026-10-06 ruling above and that the failure count resets when a cooldown ends; ARCH-007's single
`verifyPinThrottled` with no exported reset or bucket reader; ARCH-012's route declaration, session
guard and codes as built; no credential in a URL; handlers never write an error body. A ruling not in
DECISIONS.md is not decided.

## Read

Plan Task 10 (`:2730-2980`) and the parts of Tasks 11 and 12 that consume it; `docs/ARCHITECTURE.md`
§3, §5, §7, §11 to §13; `docs/decisions/` (ADR-007, ADR-009, ADR-010 above all); `docs/PRD.md` FR-A2c,
FR-A5, FR-A6, FR-J1 to FR-J4, AC-18, AC-19, AC-27; `docs/BOUNDARIES.md`;
`docs/design/SCREEN-INVENTORY.md` and `SITEMAP.md` for the POS approval prompt; ARCH-006 §6 and §8 and
*For the owner*, ARCH-007 §5 and §7, ARCH-012 §4 to §6 and §10, in `.agent/reviews/`; the Handoffs of
PHASE0-005, 006, 009a and 009b in `.agent/tasks/`; the code listed above. For any library fact, ask
the librarian: `.agent/bin/ask.sh librarian "<question>"`.

## Report

Write `.agent/reviews/ARCH-013-manager-approval.md` in full prose: a short summary, an answer to each
question with its authority, and closing sections **For the task file** (rules, interface, migration,
test cases, red proofs, split if you recommend one) for PHASE0-010, **For the lead** for anything the
designer or a later task needs, and **For the owner** for anything only the owner can decide, with
exact wording for any contract change. Do not commit. When done, run exactly one of:

    herdr agent prompt lead "architect13: ARCH-013 done — <one line>"
    herdr agent prompt lead "architect13: BLOCKED — <question>"
