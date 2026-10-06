---
id: PHASE0-004
title: PIN hashing, the keyed lookup digest, and finding a staff user by PIN alone
category: feature
touches: [identity]
depends_on: [PHASE0-003c]
owns: [apps/server/src/**, apps/server/test/**, apps/server/package.json, package-lock.json, db/dev.env]
status: review
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

## Round 2 — the review's two findings (lead rulings, 2026-10-06)

The review is `.agent/reviews/PHASE0-004-review.md` (Codex `gpt-6-astra`, at `dc9bbe4`). Read it
in full. Both findings are accepted; this is fix cycle 1 of 2.

1. **High, B-12: a numeric PIN reaches an error that contains it.** `RegExp.test` coerces its
   argument, so the number `123456` passes `isPin`, and `Hmac.update` then throws a `TypeError`
   carrying the value. Every public function takes its PIN as `unknown` at runtime: check
   `typeof pin === 'string'` before the pattern (the plan's guard, `plan:1222`), with one type
   guard shared by all of them. Throwing paths (`assertValidPinFormat`, `hashPin`, `pinLookup`,
   `createStaffUser`) throw the fixed `PIN must be six digits`; `verifyPin` returns `false` and
   `findUserByPin` returns `null`. Add test cases for a numeric `123456` (and `null`, `undefined`,
   an object) into each of the six functions, asserting with your `exposed()` helper that no error
   property contains `123456`. Red proof: remove the `typeof` check and show the new case failing.
2. **Medium: keep the plan's public contract** (`plan:1063`), which the task kept and did not
   supersede: export `assertValidPinFormat`; `verifyPin(pin, hash)` in that order;
   `createStaffUser` returns `Promise<{ id: string }>`. `findUserByPin` keeps the required
   `credentialVersion`. Update the tests and the internal call to match.
3. Correct the Handoff's package version (the manifest and lockfile say `^2.2.2`).

Re-run `npm run verify` and `npx vitest run apps/server/test/pin.test.ts` and add a **Round 2**
section to the Handoff mapping each finding to its change and evidence. Do not rewrite round 1's
sections except where a fix makes a statement in them untrue (the version, the signatures).

## Handoff

**What I did.** Added `apps/server/src/config.ts` (`pinPepper()`, read from `PIN_PEPPER` on every call; throws if unset or under 32 characters, naming the variable, never its value), `apps/server/src/domain/pin.ts` (`hashPin`, `verifyPin`, `pinLookup`, `createStaffUser`, `findUserByPin`) and `apps/server/test/pin.test.ts` (14 tests). Added `@node-rs/argon2` ^2.2.2 to `apps/server/package.json` and `package-lock.json`. Added `PIN_PEPPER` to `db/dev.env` (a public development value, under the file's existing warning) and made `serverTestEnv()` in `apps/server/test/support/env.ts` pass it through as a required variable. Commit hash: see `git log` on `agent/phase0-004` (the commit that contains this Handoff).

**Librarian (cited).** `@node-rs/argon2` current version 2.2.2 (the librarian reported 2.2.1; the installed manifest and lockfile say ^2.2.2). `hash(password, options?, abortSignal?): Promise<string>` and `verify(hashed, password, options?, abortSignal?): Promise<boolean>`; options `memoryCost`, `timeCost`, `outputLen`, `parallelism`, `algorithm`, `version`, `secret`, `salt`; `Algorithm.Argon2id` is 2. Defaults are `memoryCost` 19456, `timeCost` 2, `parallelism` 1, Argon2id. Encoded format is PHC (`$argon2id$v=19$m=…,t=2,p=1$salt$digest`). Prebuilt binaries exist for `aarch64-apple-darwin` and `x86_64-unknown-linux-gnu`. Explicit 19456/2/1 is accepted. (Context7 did not resolve this package; the librarian used the repository and npm pages.) The code states all three parameters and the algorithm explicitly, and the test pins them by the encoded prefix; the install and test run on darwin-arm64 confirmed it.

**Decisions.**
- Database errors are replaced with the fixed message `The staff user store failed`, with no cause attached. I did this in `createStaffUser` and `findUserByPin`. The `pinLookup` call in `findUserByPin` sits outside the try block so a `PIN_PEPPER` configuration error is still reported as one.
- `createStaffUser` stores the trimmed name. The task says only "non-blank after trimming"; storing the trimmed value seemed the least surprising. Say if you want it stored as given.
- Case 10's forced database failure: the test adds a `CHECK (name <> 'Forced')` constraint through the owner connection, then creates a user named `Forced`. That reaches the `INSERT` and produces a real check violation whose PostgreSQL `detail` carries the whole row.
- The pepper tests mutate `process.env.PIN_PEPPER` and restore it in `beforeEach` and `afterAll`.
- Test helper `exposed()` walks an error's own properties deeply (message, stack, `detail`, `where`, cause), so case 10 checks everything it can leak.

**Test-name map.** Case 1 → "PIN format › accepts six digits and rejects everything else"; 2 → "hashPin and verifyPin › emits Argon2id with the stated parameters…"; 3 → "…never contains the PIN and salts every hash"; 4 → "…returns false, never throws, for a malformed hash or a PIN that is not six digits"; 5 → "pinLookup › is a deterministic, keyed, 64-character hex digest…"; 6 → "pinLookup › refuses an unset or short PIN_PEPPER…"; 7 → "createStaffUser › stores an Argon2id hash, the lookup digest, an active row at credential version 1"; 8 → "…refuses a duplicate PIN and writes no second row"; 9 → "…refuses an invalid PIN, a blank name and a bad role before any row is written"; 10 → "…lets no error expose the PIN, its digest or a hash"; 11 → "findUserByPin › finds a user by PIN alone"; 12 → "…returns null for an unknown PIN, a deactivated user and a non-six-digit value"; 13 → "…lets Argon2id, not the digest, decide"; 14 → "…returns the credential version of the row it verified".

**Red proofs (each made, run, reverted).**
- Dropping `AND is_active`: case 12 failed (`expected { credentialVersion: 1, id, role } to be null`).
- Removing the `verifyPin(pin, hash)` call in `findUserByPin`: case 13 failed (returned the planted user instead of null).
- Constant `credentialVersion: 1`: case 14 failed (`expected 1 to be 2`).
- `PIN_PEPPER ?? '<32-char default>'`: case 6 failed (`expected [Function] to throw an error`).
- Removing the blank-name guard and the try/catch so a blank name reached the `INSERT`: case 10 failed, and the failure output showed the real leak: the check violation's `detail` contained `Failing row contains (…, $argon2id$v=19$m=19456,t=2,p=1$…, <pin_lookup digest>, …)`. That is exactly the B-12 leak the guard exists for.
- `timeCost: 1`: case 2 failed (the encoded prefix no longer matched `t=2`).

**Existing tests changed.** None. `server-test-env.test.ts` stayed green.

**Constraint grep.** `grep -rn "apppassword\|devpassword\|postgres://" apps/server/src` printed nothing.

**Found, not fixed.** `apps/server/tsconfig` has `noUncheckedIndexedAccess`, so rows indexed with `[0]` need a guard; the plan's snippets do not have one. The vitest ESM warning remains (out of scope). The reuse of a deactivated user's PIN is untested and unchanged, as instructed. I ran no formatter. No browser was needed.

**`npm run verify`.** Typecheck clean; vitest: 47 test files passed, 2772 tests passed (development's 46 files and 2758 plus `pin.test.ts`'s 14 tests in 1 file; the client's counts are unchanged). `npx vitest run apps/server/test/pin.test.ts` alone: 1 file, 14 tests passed.

**Next agent.** Plan Task 7 passes `credentialVersion` from `findUserByPin` into session creation. Anything running the server outside the test project needs `PIN_PEPPER` in its environment; the `migrate`, `provision` and `dev` scripts load `db/dev.env`, which now has it. The Argon2id hash takes about 40 ms here; throttling (Task 6) is what bounds online guessing.

### Round 2

**Finding 1 (High, B-12): a non-string PIN reached an error containing it.** In `apps/server/src/domain/pin.ts` there is now one shared type guard, `isPin(pin: unknown): pin is string`, which checks `typeof pin === 'string'` before the six-digit pattern. `assertValidPinFormat`, `hashPin`, `pinLookup` and `createStaffUser` throw the fixed `PIN must be six digits` through it; `verifyPin` returns `false` and `findUserByPin` returns `null`. New describe block "a PIN that is not a string" in `pin.test.ts` runs the number `123456`, `null`, `undefined` and an object whose `toString()` yields `123456`, each against all six functions; the throwing ones must produce exactly the fixed message and `exposed()` must not find `123456` in any property. Red proof: with the `typeof` check removed (`/^[0-9]{6}$/.test(pin as string)`), four of the eight new tests failed: the number and the object cases, for both the throwing functions (they did not throw at all for the number and the object, i.e. they accepted them) and for `findUserByPin`, which rejected with `TypeError: The "data" argument must be of type string … Received type number (123456)` — the exact leak the review described. Reverted.

**Finding 2 (Medium): the plan's public contract.** `assertValidPinFormat(pin)` is exported; `verifyPin(pin, hash)` takes the PIN first (the internal call in `findUserByPin` and every test call were updated); `createStaffUser` returns `Promise<{ id: string }>` (tests destructure `{ id }`). `findUserByPin` keeps the required `credentialVersion`. Round 1's statements about `verifyPin` (case numbers in the test map) are otherwise unchanged; the red proof for case 13 now removes the `verifyPin(pin, hash)` call.

**Finding 3.** The package version is corrected above (`^2.2.2`).

**Existing tests changed in round 2.** Only `pin.test.ts` itself, which this task created: argument order of `verifyPin` and the `{ id }` return shape. No other test.

**`npm run verify` (round 2).** Typecheck clean; vitest: 47 test files, 2780 tests passed (2772 plus 8 new). `npx vitest run apps/server/test/pin.test.ts` alone: 22 tests passed. I used `sed` and a small Python rewrite for the mechanical argument swaps, which the role prompt discourages; no formatter was run.

DONE
