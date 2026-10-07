# ARCH-008 — Sessions (plan Task 7), and the back-office credential

Owner: `architect8`. Written by the lead, 2026-10-07. Read-only consult: you write one report,
`.agent/reviews/ARCH-008-sessions.md`, and touch nothing else. It is the architect consult
WORKFLOW.md requires before a task that touches identity is dispatched. It serves PHASE0-007
(plan Task 7, sessions with audience policy), not yet written, and whatever task carries the
back-office credential.

## The question

Plan Task 7 (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1722-1974`) gives
`session.ts` and its test verbatim. It predates ARCHITECTURE.md, the ADRs and ARCH-006, which
already found that it invalidates by sweep rather than by credential version (ARCH-006 §4 and §8,
`.agent/reviews/ARCH-006-phase0-core-schema.md:387-470`, `:706-726`). What must PHASE0-007 say
instead?

A second question arrived after the plan: **the owner ruled on 2026-10-06 that the MVP back office
signs in with a username and password, not a PIN** (`.agent/DECISIONS.md`, the 2026-10-06 lines on
DESIGN-011 Q4, and the refinement that M-6 asks the idled manager only for the password but offers
another manager their own username and password; the first manager is injected by hand). The PRD's
FR-A2b says only "managers authenticate into a conventional session"; FR-A1 and FR-A3 to FR-A5 are
about PINs. Nothing in the schema holds a username or password. The plan's Task 9 logs the back
office in by PIN.

## What exists (verify it; do not take the lead's word)

- `db/migrations/0003_client_instance_and_actor_session.sql`: `actor_session` with `token_hash
  bytea` (SHA-256, 32 bytes, unique), `audience` (`POS`, `BACK_OFFICE`), `staff_user_id`,
  `credential_version` (no default), `client_instance_id`, `issued_at`, `last_interactive_at`,
  `absolute_expires_at` (required for `BACK_OFFICE`), `released_at`; `pos_app` has SELECT, INSERT,
  UPDATE and no DELETE. `client_instance` likewise.
- `db/migrations/0002_staff_user.sql`: `credential_version integer >= 1`, `is_active`; no username,
  no password. Migration `0006` (PIN unique among active staff) is being built now by PHASE0-006b.
- `apps/server/src/domain/pin.ts` (`findUserByPin(pin, client?)` returns `{ id, role,
  credentialVersion }`), `throttle.ts` (`verifyPinThrottled`, the `LOGIN` and `MANAGER_APPROVAL`
  buckets), `audit.ts` (`writeAudit`, `writeSecurityEvent`), `pool.ts`, and the test harness
  `apps/server/test/support/database.ts`.
- `.agent/reviews/ARCH-007-throttle.md`, and LESSONS: PostgreSQL's `now()` is the transaction's start
  time, which bit PHASE0-006 after a lock wait.

## Questions

1. **Plan Task 7 against the schema, ARCHITECTURE §7 and ARCH-006 §4.** What is wrong, and what
   must the task say? In particular: invalidation by credential version (FR-B3, PRD `:112`); the
   session token (generation, the SHA-256 stored, what is returned to the caller and when); database
   time everywhere; `last_interactive_at` moved only by interactive requests (FR-A2b, AC-28);
   `absolute_expires_at`; release.
2. **Policy.** POS 90 seconds idle with no absolute limit? Back office 30 minutes idle and eight
   hours absolute (FR-A2, FR-A2b, AC-28)? Where the numbers live (B-24; ARCH-007 treated FR-fixed
   numbers as constants in code).
3. **The interface** PHASE0-007 exports for Tasks 8 to 10 (the plan's `createSession`,
   `resolveSession`, `releaseSession`, `invalidateSessionsForUser`, `POLICY`, `COOKIE_NAME`, or a
   different shape). How resolution checks the credential version (join to `staff_user` in the
   same statement?), `is_active`, audience, idle and absolute expiry; whether an expired session is
   marked or simply refused.
4. **Concurrency.** A resolve that touches `last_interactive_at` racing a release, an expiry or a
   credential-version bump: what must hold, and what locking or single-statement shape gives it?
5. **The back-office credential (owner, 2026-10-06).** What schema it needs (columns on `staff_user`
   or a table of its own; username uniqueness and case; an Argon2id password hash with parameters);
   whether a password change or reset bumps `credential_version`; which throttle protects password
   guesses (FR-A5 names two PIN classes; is a third class, or the `LOGIN` bucket, right, and what
   would that do to AC-19?); how M-6's re-authentication works against a session (same session
   renewed, or a new one; the draft-preservation rule of 2026-10-05); the hand-injected first
   manager. **Does it need an ADR or a contract change?** If the PRD must change (FR-A1, FR-A2b,
   FR-A3, FR-A5, AC-27, AC-28 or others), propose exact replacement wording for the owner.
6. **Sequencing.** Which Phase 0 task carries the back-office credential: PHASE0-007 with sessions,
   plan Task 9 with the routes, or its own task, and in what order relative to Tasks 7 to 10?
7. **Anything else** in plan Task 7 that is wrong against ARCHITECTURE.md, the ADRs, B-11 to B-13,
   B-24, FR-A2 to FR-A2c, FR-A7, FR-B3, AC-27 and AC-28.

## Read

Plan Task 7 (`:1722-1974`) and the parts of Tasks 8 and 9 that call it; `docs/ARCHITECTURE.md` §7
and §14.4; the ADRs in `docs/decisions/`; `docs/PRD.md` FR-A1 to FR-A7, FR-B3, AC-27, AC-28;
`docs/BOUNDARIES.md`; ARCH-006 §4 and §8; ARCH-007; `.agent/DECISIONS.md` (the 2026-10-05 to
2026-10-07 lines); the files listed above.

## Report

Write `.agent/reviews/ARCH-008-sessions.md` in full prose: a short summary, an answer to each
question with its authority, and closing sections **For the task file** (rules, interface, test
cases, red proofs) for PHASE0-007 and, separately, for the task that carries the back-office
credential, plus **For the owner** for anything only the owner can decide (with exact wording for
any contract change). Mind PostgreSQL's transaction-start `now()` in any SQL you illustrate. Do not
commit. When done, run exactly one of:

    herdr agent prompt lead "architect8: ARCH-008 done — <one line>"
    herdr agent prompt lead "architect8: BLOCKED — <question>"
