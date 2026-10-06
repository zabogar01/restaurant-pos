---
id: PHASE0-004
title: PIN hashing, the keyed lookup digest, and finding a staff user by PIN alone
category: feature
touches: [identity]
depends_on: [PHASE0-003c]
owns: [apps/server/src/**, apps/server/test/**, apps/server/package.json, package-lock.json, db/dev.env]
status: not-started
cycles: 0
---
# PHASE0-004 — PIN hashing and lookup

**Written** 2026-10-06 by the lead, from plan Task 4
(`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1054-1305`), the architect consult
ARCH-006 (`.agent/reviews/ARCH-006-phase0-core-schema.md`, sections 4 and 8) and PHASE0-003c's
Handoff. Cut from `development` at `2ee2285`, after PHASE0-003c (the six-table schema) merged as
PR #53. The architect consult for this task is ARCH-006; the owner looks before merge.

## Objective

Give the server the one module that turns a six-digit PIN into a stored credential and back:
an Argon2id hash that verifies it (FR-A3, B-11), a keyed blind index under a secret held outside
PostgreSQL that finds the one row to verify and keeps PINs unique (ARCHITECTURE §7.3, FR-A4), a
function that creates a staff user, and a function that finds an active staff user from a PIN
alone and returns the credential version of the row it verified against (ARCHITECTURE §7.2,
ARCH-006 §4 point 2). When this task is done, `apps/server/src/config.ts` and
`apps/server/src/domain/pin.ts` exist, `apps/server/test/pin.test.ts` proves every rule below
against the real `staff_user` table as `pos_app`, and no PIN, lookup digest or hash can leave
these functions inside an error.

## Required inputs

- **Plan Task 4** (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md:1054-1305`) is the
  starting shape: the six functions, their names, and most of its test cases. **This file
  supersedes the plan wherever they differ**; the differences are listed under *What changes from
  the plan*. Do not copy the plan's `config.ts` or its test setup.
- **The schema you build on** is `db/migrations/0002_staff_user.sql` (on `development`): columns
  `id`, `name`, `role`, `pin_hash`, `pin_lookup`, `is_active`, `credential_version`, `created_at`;
  checks on role (`CASHIER`, `MANAGER`), a non-blank name, `pin_hash LIKE '$argon2id$%'` and
  `credential_version >= 1`; the unique index `staff_user_pin_lookup_key` on `pin_lookup`.
  `pos_app` has `SELECT, INSERT, UPDATE` on `staff_user` and no `DELETE`. Do not change any
  migration.
- **The test harness** from PHASE0-003b: `apps/server/test/support/database.ts` (`resetDatabase`,
  `ownerQuery`, `ownerClient`), `apps/server/test/support/env.ts` (`serverTestEnv`, which decides
  every variable the server test project sees), `vitest.config.ts`, `db/dev.env`. The application
  pool is `query` from `apps/server/src/db/pool.ts` and connects as `pos_app`; its `requireEnv`
  pattern (unset is an error, never a default) is the one to follow.
- **ARCH-006 §4** (`:387-470`), especially point 2 of *A credential version is the right shape*
  (`:400-405`), and **§8, *Found in Tasks 4 to 10*** (`:706-726`), the Task 4 and "Tasks 4 to 10"
  lines.
- `docs/ARCHITECTURE.md` §7.2 (`:475-494`), §7.3 (`:496-509`), the error rule in §12 (`:694`) and the
  risk row at `:847`; `docs/PRD.md` FR-A2, FR-A3, FR-A4; `docs/BOUNDARIES.md` B-11, B-12.
- **Before writing,** put these to the librarian (`.agent/bin/ask.sh librarian "<question>"`) and
  cite the answers in the Handoff: the current `@node-rs/argon2` version, the signatures of its
  `hash` and `verify`, its default `memoryCost`, `timeCost` and `parallelism`, the encoded hash
  format it emits for Argon2id (`$argon2id$v=19$m=…,t=…,p=…$…`), and whether it ships a prebuilt
  binary for darwin-arm64 and linux-x64.

## Lead rulings (2026-10-06; the owner may overturn them)

1. **Argon2id parameters are stated in the code, not left to the library's defaults:**
   `memoryCost: 19456` (KiB), `timeCost: 2`, `parallelism: 1`, OWASP's minimum for Argon2id.
   A library upgrade then cannot weaken them silently, and the test pins them by parsing the
   encoded hash. If the librarian reports that `@node-rs/argon2` cannot take these, stop and
   raise it.
2. **No `zod` in this task.** `config.ts` reads one variable; plan Task 8 adds the server's
   host, port and TLS paths and may bring `zod` with them.
3. **The pepper for development and tests lives in `db/dev.env`** as `PIN_PEPPER`, next to the
   other deliberately public development values and under that file's existing warning. It is
   never a default in source. Production secret handling belongs to the pre-production gate,
   not here.

## What changes from the plan

1. **`config.ts` has no defaults that are secrets or connections.** The plan's
   `DATABASE_URL` default (`postgres://pos_app:apppassword@...`) is a credential in source
   (ARCH-006 §8); the connection stays in `pool.ts`, which already requires `DATABASE_URL`. This
   task's `config.ts` exports a function (for example `pinPepper(): string`) that reads
   `PIN_PEPPER` from the environment **on every call**, with no cache, and throws if it is unset
   or shorter than 32 characters. The message names the variable and never contains its value.
   Importing `config.ts` or `pin.ts` with `PIN_PEPPER` unset does not throw; using `pinLookup`
   does.
2. **`findUserByPin` returns `{ id, role, credentialVersion }`**, all three read from the same
   row as the `pin_hash` it verified against, in the same `SELECT`. It never re-reads the user
   afterwards. `role` is typed `'CASHIER' | 'MANAGER'`. Plan Task 7 will pass `credentialVersion`
   to session creation (ARCH-006 §4 point 2).
3. **Tests reset with `resetDatabase()`**, never `DELETE` (the plan's `beforeEach` deletes from
   `app_session`, which no longer exists, and `pos_app` has no `DELETE` on `staff_user`). Fixture
   changes that stand for another writer (deactivating a user, bumping a credential version,
   planting a mismatched row) go through `ownerQuery`; the functions under test use `query`.
4. **No error carries a PIN, a lookup digest or a hash** (B-12; ARCHITECTURE §12, "errors … do
   not expose … secrets, blind indexes, or PINs"). PostgreSQL puts the whole failing row, with
   `pin_hash` and `pin_lookup`, in the `detail` of a check violation, so `createStaffUser`
   validates the PIN, the name (non-blank after trimming) and the role **before** any SQL, and
   the duplicate path uses `ON CONFLICT (pin_lookup) DO NOTHING` rather than catching a unique
   violation (whose `detail` names the key). Any database error that still escapes these functions
   is rethrown as a fixed message with no `detail`, `where` or cause attached.
5. **`serverTestEnv()` passes `PIN_PEPPER` through** (required, like the others) so the server
   test project sees it. The `migrate`, `provision` and `dev` scripts already load `db/dev.env`.

## Test cases for `apps/server/test/pin.test.ts`

Every case that touches the database starts from `resetDatabase()`.

1. Format: `000000`, `123456`, `999999` accepted; `12345`, `1234567`, `abcdef`, `12 456`, `''`,
   `12345a`, `１２３４５６` (full-width digits) rejected with `PIN must be six digits`.
2. `hashPin` returns an encoded hash starting `$argon2id$v=19$m=19456,t=2,p=1$`, which
   `verifyPin` accepts for the same PIN and refuses for another.
3. `hashPin` never contains the PIN, and the same PIN hashes differently twice (salted).
4. `verifyPin` returns `false`, never throws, for a malformed hash and for a PIN that is not six
   digits.
5. `pinLookup` is deterministic, differs for different PINs, is 64 lowercase hex characters,
   never contains the PIN, and **differs under a different `PIN_PEPPER`** (it is keyed).
6. With `PIN_PEPPER` unset, and with it set to 31 characters, `pinLookup` throws a message that
   names `PIN_PEPPER` and does not contain the value.
7. `createStaffUser` returns an id; the row holds an Argon2id `pin_hash` that verifies the PIN,
   `pin_lookup` equal to `pinLookup(pin)`, `is_active` true, `credential_version` 1.
8. A duplicate PIN is refused with `PIN already in use` and no second row exists.
9. An invalid PIN, a blank or whitespace-only name, and a role outside the two are each refused
   before any row is written.
10. Across cases 8 and 9, and a forced database failure of your choosing, no thrown error's
    message, own properties or stack contains the PIN, its `pinLookup` digest, or `$argon2id$`.
11. `findUserByPin` finds a user by PIN alone and returns `{ id, role, credentialVersion: 1 }`.
12. `findUserByPin` returns `null` for an unknown PIN, for a deactivated user's PIN, and for a
    value that is not six digits (without throwing).
13. A row planted through the owner connection whose `pin_lookup` is `pinLookup('123456')` but
    whose `pin_hash` is the hash of `'654321'`: `findUserByPin('123456')` returns `null`
    (Argon2id, not the digest, is the authority).
14. After the owner sets the user's `credential_version` to 2, `findUserByPin` returns
    `credentialVersion: 2`.

## Tests expected to change

- None. `apps/server/test/server-test-env.test.ts` asserts refusals and one returned value, not
  the returned key set, so adding `PIN_PEPPER` to `serverTestEnv()` should leave it green. If it
  or any other existing test needs a change, stop and raise it.

## Constraints

- **B-11 / FR-A3:** Argon2id only, with the parameters in ruling 1. The lookup digest is
  HMAC-SHA256 under `PIN_PEPPER` and is never treated as a verifier.
- **B-12:** no PIN, digest or hash in any error, log line, or `console` call; no `console` call in
  `pin.ts` at all.
- **ARCHITECTURE §7.3:** the pepper is read from the environment and never stored in, or passed
  to, PostgreSQL.
- **No credential or connection default** in `apps/server/src/`: `grep -rn "apppassword\|devpassword\|postgres://" apps/server/src` finds nothing.
- Names follow ARCH-006's table (`:748-761`): `staff_user`, `actor_session`, never `app_session`.
- Do not change `db/migrations/`, `vitest.config.ts`, `pool.ts`, the client, or any document.
  Do not add a test either way on reusing a deactivated user's PIN: that is an open question for
  the owner (the unique index refuses it today; leave that as it is).
- `createStaffUser` writes no audit entry. It is the Phase 0 creation path for tests and the
  later bootstrap; FR-B3's audited user management is Phase 1's.

## Acceptance criteria

1. `npm run verify` is green; the Handoff shows the counts: `development`'s 46 files and 2758
   tests (lead's verify, 2026-10-06) plus `pin.test.ts`'s cases, with the client's 40 files and
   2719 tests unchanged.
2. `npx vitest run apps/server/test/pin.test.ts` alone is green, and the Handoff maps each case
   number above to its test name.
3. **Red proofs, each made, run, shown in the Handoff and reverted:** dropping the `is_active`
   filter fails case 12; skipping the Argon2id verify in `findUserByPin` fails case 13;
   returning a constant `credentialVersion: 1` fails case 14; adding a default to
   `PIN_PEPPER` fails case 6; letting a check violation's error escape unwrapped (a blank name
   reaching the `INSERT`) fails case 10; changing `timeCost` to 1 fails case 2.
4. The grep in *Constraints* finds nothing, and the Handoff shows it.
5. The librarian's answers are cited in the Handoff.

## Out of scope

- Plan Tasks 5 to 12: the audit and telemetry writers, throttling (`pin_throttle_bucket`),
  sessions and their invalidation, the HTTPS server and the rest of `config.ts`, routes,
  approval, client shells, acceptance tests.
- Changing a PIN, resetting a PIN, deactivating a user, or bumping `credential_version` in
  domain code (FR-B3, Phase 1).
- Rotating `PIN_PEPPER`, and production secret storage (pre-production gate).
- The vitest ESM warning (`vitest.config.ts` loaded as CommonJS).

## Handoff
