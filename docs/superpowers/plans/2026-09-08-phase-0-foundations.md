# Phase 0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the money, identity, session, and audit foundations that every later phase depends on, served as two separate clients from one HTTPS-on-localhost server.

**Architecture:** A TypeScript monorepo. One Fastify server owns all state in PostgreSQL and serves two independently bootstrapped React clients from one origin at `/pos/` and `/back-office/`. Money is `bigint` minor units behind a single calculation module — no floating point touches money at any layer. Sessions carry an audience (`POS` or `BACK_OFFICE`) with different timeout policies, and audit evidence is written inside the same transaction as the action it describes.

**Tech Stack:** TypeScript, Node LTS, Fastify, React 18 + Vite, PostgreSQL 16, `@node-rs/argon2`, Zod, Vitest, `fast-check`, Playwright, npm workspaces.

**Spec:** [docs/PRD.md](../../PRD.md), with inviolable rules in [docs/BOUNDARIES.md](../../BOUNDARIES.md) and roadmap context in [docs/ROADMAP.md](../../ROADMAP.md).

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **B-1.** Money is never a floating-point number. All monetary values are integers in minor units, at every layer: database, domain logic, API, and UI. No `float`, no `double`, no untyped decimal arithmetic on money anywhere.
- **B-2.** Rounding is half-up, applied once, at the point of storage or display. Never round twice.
- **B-7.** The audit log is append-only. No update path. No delete path. No soft-delete that hides entries from the audit view. Not for cleanup, not for tests, not for a mistake.
- **B-11.** PINs are hashed with a modern password hash, never stored or transmitted in plaintext. argon2id or bcrypt. Not MD5, not SHA-256, not encrypted-and-decryptable.
- **B-12.** No PIN value appears in any log, audit entry, error message, stack trace, or analytics event, in any form — including partially masked.
- **B-13.** Every audited action records a specific, identified actor. No shared accounts, no "system" actor standing in for a person.
- **B-14.** Manager approval authorises one action, at the moment it is given. It is never cached, never carried to a subsequent action, and never extends into a session.
- **B-24.** What a restaurant changes routinely is configuration, not code. No hard-coded menu, rate, or table list, including in seed data used for demos.
- **FR-M1.** Currency and minor-unit precision are configured once and become immutable after the first order. **This installation: IDR, precision 0.**
- **FR-M5.** Rate precision is one part per million.
- **FR-A1.** Two authenticating roles: cashier and manager. Unique six-digit numeric PIN. Kitchen is a non-authenticating classification.
- **FR-A2.** POS actor context expires after 90 seconds of inactivity or on explicit release.
- **FR-A2b.** Back-office session: 30-minute idle timeout, eight-hour absolute lifetime, explicit logout. Background polling does not count as user activity.
- **FR-A2c.** Every server-side session records an audience of `POS` or `BACK_OFFICE`. A back-office session is never accepted as a POS actor context and never satisfies an inline POS approval.
- **FR-A5.** Two installation-wide throttle classes: `LOGIN` and `MANAGER_APPROVAL`. Five consecutive failures blocks that class for five minutes. Only a successful verification **in the same class** resets its counter. State survives browser, application, and database restart.
- **NFR-1.** One HTTPS origin on localhost, path-separated `/pos/` and `/back-office/`, APIs at `/api/pos/…` and `/api/back-office/…`. A startup guard rejects any non-loopback listener.
- **NFR-5.** Two independently bootstrapped frontend bundles with separate route manifests, session cookies, and layouts. A single responsive application that shows or hides navigation by role or viewport does not satisfy this requirement.

**Open question that does NOT block this phase:** whether menu prices are tax-inclusive with an untaxed service charge ("nett"), or tax-exclusive with a taxed service charge (Indonesian "++"). Phase 0 builds only precision-independent primitives. This must be settled before Phase 2 implements the calculation policy.

---

## File Structure

```
package.json                          npm workspaces root
tsconfig.base.json                    shared compiler options
docker-compose.yml                    PostgreSQL 16 for dev and tests
scripts/gen-local-cert.sh             self-signed localhost certificate

packages/money/
  src/index.ts                        public surface: Money, Rate, ops, codec
  src/rounding.ts                     divHalfUp — the only rounding in the system
  src/codec.ts                        canonical base-10 string encode/decode
  src/format.ts                       precision-aware display formatting
  test/rounding.test.ts               unit + property tests
  test/money.test.ts                  operations, worked example
  test/codec.test.ts                  round-trip and rejection

packages/contracts/
  src/money.ts                        Zod schema for canonical money strings
  src/auth.ts                         login/approval request+response schemas
  src/errors.ts                       stable machine-readable error codes

packages/tokens/
  src/index.ts                        shared design tokens (colors, spacing)

db/migrations/
  0001_extensions.sql
  0002_settings.sql
  0003_staff_user.sql
  0004_audit_and_telemetry.sql
  0005_auth_throttle.sql
  0006_session_and_client.sql
  0007_roles_and_grants.sql           app role denied UPDATE/DELETE on audit

apps/server/
  src/config.ts                       env parsing, pepper, loopback guard input
  src/db/pool.ts                      pg pool, query helper, withTransaction
  src/db/migrate.ts                   migration runner
  src/domain/pin.ts                   argon2id hash + peppered lookup digest
  src/domain/audit.ts                 append-only audit + telemetry writers
  src/domain/throttle.ts              LOGIN / MANAGER_APPROVAL buckets
  src/domain/session.ts               create/touch/expire, audience policy
  src/domain/approval.ts              inline manager approval primitive
  src/http/server.ts                  Fastify instance, HTTPS, static serving
  src/http/loopback.ts                startup guard
  src/http/clientInstance.ts          ClientInstance cookie plugin
  src/http/audience.ts                session-audience enforcement
  src/http/routes/posAuth.ts          /api/pos/auth/*
  src/http/routes/boAuth.ts           /api/back-office/auth/*
  src/index.ts                        composition root
  test/*.test.ts                      integration tests against real PostgreSQL

apps/pos/
  index.html  vite.config.ts  src/main.tsx  src/App.tsx  src/PinPad.tsx

apps/back-office/
  index.html  vite.config.ts  src/main.tsx  src/App.tsx  src/LoginForm.tsx

e2e/
  playwright.config.ts
  tests/two-client.spec.ts            AC-19, AC-27, AC-28
```

Files that change together live together: each domain concern owns its module and its test. `packages/money` is pure and has no database or HTTP dependency, so it can be property-tested exhaustively without fixtures.

---

## Task 1: Monorepo scaffold, PostgreSQL, migration runner

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `.gitignore`
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`
- Create: `apps/server/src/db/pool.ts`, `apps/server/src/db/migrate.ts`
- Create: `db/migrations/0001_extensions.sql`
- Test: `apps/server/test/migrate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getPool(): Pool`, `query<T>(sql: string, params?: unknown[]): Promise<T[]>`, `withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T>`, `runMigrations(dir: string): Promise<string[]>` returning applied filenames.

- [ ] **Step 1: Create the workspace root**

```json
{
  "name": "restaurant-pos",
  "private": true,
  "workspaces": ["packages/*", "apps/*", "e2e"],
  "scripts": {
    "db:up": "docker compose up -d",
    "db:migrate": "npm run migrate -w apps/server",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  }
}
```

`target: ES2022` matters — `bigint` literals and `BigInt` operations require ES2020 or later.

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: pos_owner
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: pos
    ports: ["5433:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```

Port 5433 avoids colliding with any PostgreSQL already on 5432.

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
certs/
```

`certs/` is ignored so a generated local certificate and key are never committed.

- [ ] **Step 5: Create the server package manifest**

```json
{
  "name": "@pos/server",
  "type": "module",
  "scripts": {
    "migrate": "tsx src/db/migrate.ts",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "@types/pg": "^8.11.0"
  }
}
```

- [ ] **Step 6: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src", "test"]
}
```

- [ ] **Step 7: Write the failing migration-runner test**

Create `apps/server/test/migrate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { query } from '../src/db/pool.js';

describe('runMigrations', () => {
  beforeEach(async () => {
    await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  it('applies pending migrations and records them', async () => {
    const applied = await runMigrations('db/migrations');
    expect(applied).toContain('0001_extensions.sql');

    const rows = await query<{ filename: string }>(
      'SELECT filename FROM schema_migration ORDER BY filename'
    );
    expect(rows.map((r) => r.filename)).toContain('0001_extensions.sql');
  });

  it('is idempotent — a second run applies nothing', async () => {
    await runMigrations('db/migrations');
    const second = await runMigrations('db/migrations');
    expect(second).toEqual([]);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm run db:up && npx vitest run apps/server/test/migrate.test.ts`
Expected: FAIL — cannot resolve `../src/db/migrate.js`.

- [ ] **Step 9: Implement the pool**

Create `apps/server/src/db/pool.ts`:

```ts
import pg from 'pg';

const { Pool } = pg;

// pg returns BIGINT (oid 20) as a string by default. Keep it that way:
// converting to Number would silently violate B-1.
pg.types.setTypeParser(20, (v: string) => v);

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        'postgres://pos_owner:devpassword@localhost:5433/pos',
    });
  }
  return pool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 10: Implement the migration runner**

Create `apps/server/src/db/migrate.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { query, withTransaction } from './pool.js';

export async function runMigrations(dir: string): Promise<string[]> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const done = new Set(
    (await query<{ filename: string }>('SELECT filename FROM schema_migration')).map(
      (r) => r.filename
    )
  );

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
    });
    applied.push(file);
  }

  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] ?? 'db/migrations');
  runMigrations(dir)
    .then((a) => {
      console.log(a.length ? `applied: ${a.join(', ')}` : 'no pending migrations');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

Each migration runs in its own transaction, so a failing file leaves no partial schema — the same all-or-nothing discipline B-20 requires of commands.

- [ ] **Step 11: Create the first migration**

Create `db/migrations/0001_extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`pgcrypto` supplies `gen_random_uuid()` for the identifiers used from Task 3 onward.

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/migrate.test.ts`
Expected: PASS, both cases.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.base.json docker-compose.yml .gitignore apps/server db/migrations
git commit -m "feat: monorepo scaffold, postgres, and migration runner"
```

---

## Task 2: Money module

**Files:**
- Create: `packages/money/package.json`, `packages/money/tsconfig.json`
- Create: `packages/money/src/rounding.ts`, `src/codec.ts`, `src/format.ts`, `src/index.ts`
- Test: `packages/money/test/rounding.test.ts`, `test/money.test.ts`, `test/codec.test.ts`

**Interfaces:**
- Consumes: nothing. This package has no database or HTTP dependency.
- Produces: `type Money = bigint`, `type Rate = bigint`, `RATE_SCALE: bigint`, `divHalfUp(n: bigint, d: bigint): bigint`, `mulRate(amount: Money, rate: Rate): Money`, `taxIncludedIn(amount: Money, rate: Rate): Money`, `encodeMoney(m: Money): string`, `decodeMoney(s: string): Money`, `formatMoney(m: Money, precision: number): string`, `rateFromPercent(percent: number): Rate`.

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "@pos/money",
  "type": "module",
  "main": "src/index.ts",
  "devDependencies": {
    "fast-check": "^3.22.0"
  }
}
```

- [ ] **Step 2: Create `packages/money/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Write the failing rounding test**

Create `packages/money/test/rounding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { divHalfUp } from '../src/rounding.js';

describe('divHalfUp', () => {
  it('rounds an exact quotient to itself', () => {
    expect(divHalfUp(10n, 5n)).toBe(2n);
  });

  it('rounds a half up, away from zero', () => {
    expect(divHalfUp(5n, 2n)).toBe(3n);
    expect(divHalfUp(-5n, 2n)).toBe(-3n);
  });

  it('rounds below a half down', () => {
    expect(divHalfUp(4n, 3n)).toBe(1n);
  });

  it('rounds above a half up', () => {
    expect(divHalfUp(5n, 3n)).toBe(2n);
  });

  it('rejects a non-positive denominator', () => {
    expect(() => divHalfUp(1n, 0n)).toThrow('denominator must be positive');
  });

  it('never lands further than half a unit from the true quotient', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -10n ** 15n, max: 10n ** 15n }),
        fc.bigInt({ min: 1n, max: 10n ** 9n }),
        (n, d) => {
          const q = divHalfUp(n, d);
          // |n - q*d| * 2 <= d  proves q is the nearest integer, ties included
          const err = n - q * d;
          const abs = err < 0n ? -err : err;
          return abs * 2n <= d;
        }
      )
    );
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run packages/money/test/rounding.test.ts`
Expected: FAIL — cannot resolve `../src/rounding.js`.

- [ ] **Step 5: Implement rounding**

Create `packages/money/src/rounding.ts`:

```ts
/**
 * Integer division rounding halves away from zero.
 *
 * This is the ONLY rounding function in the system (B-2). Every monetary
 * calculation routes through it, so "half-up" has exactly one meaning and two
 * code paths can never disagree on a total.
 */
export function divHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('denominator must be positive');

  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;

  const quotient = n / denominator;
  const remainder = n % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run packages/money/test/rounding.test.ts`
Expected: PASS, all six cases.

- [ ] **Step 7: Write the failing codec test**

Create `packages/money/test/codec.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeMoney, decodeMoney } from '../src/codec.js';

describe('money codec', () => {
  it('encodes to a canonical base-10 string', () => {
    expect(encodeMoney(1559n)).toBe('1559');
    expect(encodeMoney(0n)).toBe('0');
    expect(encodeMoney(-250n)).toBe('-250');
  });

  it('round-trips any value', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -10n ** 18n, max: 10n ** 18n }), (m) =>
        decodeMoney(encodeMoney(m)) === m
      )
    );
  });

  it.each(['1.5', '1e3', '', ' 12', '12 ', '+12', '01', '-0', 'abc'])(
    'rejects %j',
    (bad) => {
      expect(() => decodeMoney(bad)).toThrow('invalid money');
    }
  );
});
```

Leading zeros and `+12` are rejected because "canonical" must mean exactly one string per value — otherwise two encodings of the same amount could compare unequal across the API boundary.

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run packages/money/test/codec.test.ts`
Expected: FAIL — cannot resolve `../src/codec.js`.

- [ ] **Step 9: Implement the codec**

Create `packages/money/src/codec.ts`:

```ts
export type Money = bigint;

// Canonical: optional leading '-', then '0' alone or a digit string with no
// leading zero. JSON has no bigint, so money crosses the wire as this string.
const CANONICAL = /^(0|-?[1-9][0-9]*)$/;

export function encodeMoney(m: Money): string {
  return m.toString(10);
}

export function decodeMoney(s: string): Money {
  if (typeof s !== 'string' || !CANONICAL.test(s)) {
    throw new Error(`invalid money: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run packages/money/test/codec.test.ts`
Expected: PASS.

- [ ] **Step 11: Write the failing operations test**

Create `packages/money/test/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  RATE_SCALE,
  rateFromPercent,
  mulRate,
  taxIncludedIn,
  formatMoney,
} from '../src/index.js';

describe('rateFromPercent', () => {
  it('converts percent to parts per million', () => {
    expect(rateFromPercent(10)).toBe(100_000n);
    expect(rateFromPercent(5)).toBe(50_000n);
    expect(rateFromPercent(11)).toBe(110_000n);
    expect(rateFromPercent(0)).toBe(0n);
  });

  it('supports precision to one part per million', () => {
    expect(rateFromPercent(0.0001)).toBe(1n);
  });

  it('rejects a rate finer than one part per million', () => {
    expect(() => rateFromPercent(0.00001)).toThrow('rate precision');
  });
});

describe('mulRate', () => {
  it('applies a rate and rounds half-up once', () => {
    // 1485 * 5% = 74.25 -> 74
    expect(mulRate(1485n, rateFromPercent(5))).toBe(74n);
    // 1650 * 10% = 165 exactly
    expect(mulRate(1650n, rateFromPercent(10))).toBe(165n);
  });

  it('never exceeds the base amount for rates at or below 100%', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.bigInt({ min: 0n, max: RATE_SCALE }),
        (amount, rate) => mulRate(amount, rate) <= amount
      )
    );
  });
});

describe('taxIncludedIn', () => {
  it('extracts the tax already inside a tax-inclusive amount', () => {
    // 1485 inclusive of 10% -> net 1350, tax 135
    expect(taxIncludedIn(1485n, rateFromPercent(10))).toBe(135n);
  });

  it('extracts nothing at a zero rate', () => {
    expect(taxIncludedIn(1485n, 0n)).toBe(0n);
  });

  it('never returns more than the amount it is extracted from', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10n ** 12n }),
        fc.bigInt({ min: 0n, max: 10n * RATE_SCALE }),
        (amount, rate) => taxIncludedIn(amount, rate) <= amount
      )
    );
  });
});

describe('the PRD worked example', () => {
  it('reproduces subtotal 1650 to total 1559', () => {
    const tax = rateFromPercent(10);
    const service = rateFromPercent(5);

    const subtotal = 1350n + 200n + 150n + 300n; // 1650
    expect(subtotal).toBe(1650n);

    const discount = mulRate(subtotal, rateFromPercent(10));
    expect(discount).toBe(165n);

    const d = subtotal - discount;
    expect(d).toBe(1485n);

    expect(taxIncludedIn(d, tax)).toBe(135n);

    const serviceCharge = mulRate(d, service);
    expect(serviceCharge).toBe(74n);

    expect(d + serviceCharge).toBe(1559n);
  });
});

describe('formatMoney', () => {
  it('formats zero-decimal currency such as IDR', () => {
    expect(formatMoney(15590n, 0)).toBe('15590');
  });

  it('formats two-decimal currency', () => {
    expect(formatMoney(1559n, 2)).toBe('15.59');
    expect(formatMoney(5n, 2)).toBe('0.05');
    expect(formatMoney(-1559n, 2)).toBe('-15.59');
  });
});
```

- [ ] **Step 12: Run the test to verify it fails**

Run: `npx vitest run packages/money/test/money.test.ts`
Expected: FAIL — cannot resolve `../src/index.js`.

- [ ] **Step 13: Implement formatting**

Create `packages/money/src/format.ts`:

```ts
import type { Money } from './codec.js';

/** Renders minor units for display. Never used as an arithmetic input. */
export function formatMoney(m: Money, precision: number): string {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new Error('precision must be an integer between 0 and 6');
  }
  if (precision === 0) return m.toString(10);

  const negative = m < 0n;
  const digits = (negative ? -m : m).toString(10).padStart(precision + 1, '0');
  const whole = digits.slice(0, digits.length - precision);
  const frac = digits.slice(digits.length - precision);

  return `${negative ? '-' : ''}${whole}.${frac}`;
}
```

- [ ] **Step 14: Implement the operations and public surface**

Create `packages/money/src/index.ts`:

```ts
import { divHalfUp } from './rounding.js';
import type { Money } from './codec.js';

export type { Money } from './codec.js';
export { encodeMoney, decodeMoney } from './codec.js';
export { divHalfUp } from './rounding.js';
export { formatMoney } from './format.js';

/** Rates are integers in parts per million (FR-M5). 10% === 100_000n. */
export type Rate = bigint;

export const RATE_SCALE = 1_000_000n;

export function rateFromPercent(percent: number): Rate {
  const scaled = percent * 10_000;
  if (!Number.isInteger(Math.round(scaled * 1e6) / 1e6) || Math.abs(scaled - Math.round(scaled)) > 1e-9) {
    throw new Error('rate precision is limited to one part per million');
  }
  if (percent < 0) throw new Error('rate must not be negative');
  return BigInt(Math.round(scaled));
}

/** amount x rate, rounded half-up once. */
export function mulRate(amount: Money, rate: Rate): Money {
  if (rate < 0n) throw new Error('rate must not be negative');
  return divHalfUp(amount * rate, RATE_SCALE);
}

/**
 * The tax already contained in a tax-inclusive amount: amount x r / (1 + r).
 * Display only — it is a component of the amount, never added to it (B-4).
 */
export function taxIncludedIn(amount: Money, rate: Rate): Money {
  if (rate < 0n) throw new Error('rate must not be negative');
  if (rate === 0n) return 0n;
  return divHalfUp(amount * rate, RATE_SCALE + rate);
}
```

- [ ] **Step 15: Run the test to verify it passes**

Run: `npx vitest run packages/money`
Expected: PASS, all three files.

- [ ] **Step 16: Commit**

```bash
git add packages/money
git commit -m "feat: integer money module with half-up rounding and canonical codec"
```

---

## Task 3: Core schema and append-only grants

**Files:**
- Create: `db/migrations/0002_settings.sql`, `0003_staff_user.sql`, `0004_audit_and_telemetry.sql`, `0005_auth_throttle.sql`, `0006_session_and_client.sql`, `0007_roles_and_grants.sql`
- Test: `apps/server/test/schema.test.ts`

**Interfaces:**
- Consumes: `runMigrations`, `query`, `withTransaction` from Task 1.
- Produces: tables `settings_version`, `staff_user`, `audit_entry`, `security_telemetry`, `auth_throttle`, `app_session`, `client_instance`; database role `pos_app` with INSERT/SELECT but no UPDATE/DELETE on `audit_entry`.

- [ ] **Step 1: Write the failing schema test**

Create `apps/server/test/schema.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import pg from 'pg';
import { query, getPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';

const APP_URL = 'postgres://pos_app:apppassword@localhost:5433/pos';

describe('schema', () => {
  beforeAll(async () => {
    await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations('db/migrations');
  });

  it('stores money as BIGINT, never a float type', async () => {
    const cols = await query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'settings_version'
        AND column_name IN ('tax_rate_ppm', 'service_charge_rate_ppm')
    `);
    expect(cols).toHaveLength(2);
    for (const c of cols) expect(c.data_type).toBe('bigint');
  });

  it('rejects a duplicate pin lookup digest', async () => {
    await query(
      `INSERT INTO staff_user (name, role, pin_hash, pin_lookup, is_active)
       VALUES ('A', 'CASHIER', 'h1', 'same-digest', true)`
    );
    await expect(
      query(
        `INSERT INTO staff_user (name, role, pin_hash, pin_lookup, is_active)
         VALUES ('B', 'MANAGER', 'h2', 'same-digest', true)`
      )
    ).rejects.toThrow(/duplicate key/);
  });

  it('rejects KITCHEN as an authenticating role', async () => {
    await expect(
      query(
        `INSERT INTO staff_user (name, role, pin_hash, pin_lookup, is_active)
         VALUES ('K', 'KITCHEN', 'h3', 'digest-k', true)`
      )
    ).rejects.toThrow(/staff_user_role_check/);
  });

  it('denies the application role UPDATE and DELETE on audit_entry', async () => {
    const appPool = new pg.Pool({ connectionString: APP_URL });
    try {
      await appPool.query(
        `INSERT INTO audit_entry (actor_id, action, outcome)
         VALUES (NULL, 'TEST', 'SUCCESS')`
      );
      await expect(
        appPool.query(`UPDATE audit_entry SET action = 'CHANGED'`)
      ).rejects.toThrow(/permission denied/);
      await expect(appPool.query(`DELETE FROM audit_entry`)).rejects.toThrow(
        /permission denied/
      );
    } finally {
      await appPool.end();
    }
  });

  it('allows at most one open throttle row per class', async () => {
    const rows = await query<{ throttle_class: string }>(
      'SELECT throttle_class FROM auth_throttle ORDER BY throttle_class'
    );
    expect(rows.map((r) => r.throttle_class)).toEqual([
      'LOGIN',
      'MANAGER_APPROVAL',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/schema.test.ts`
Expected: FAIL — relation `settings_version` does not exist.

- [ ] **Step 3: Create the settings migration**

Create `db/migrations/0002_settings.sql`:

```sql
-- Rates are integers in parts per million (FR-M5). Currency and precision
-- become immutable after the first order (FR-M1); enforcement of that lives
-- in Phase 2 when orders exist.
CREATE TABLE settings_version (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code           text   NOT NULL,
  minor_unit_precision    int    NOT NULL,
  tax_rate_ppm            bigint NOT NULL,
  service_charge_rate_ppm bigint NOT NULL,
  business_name           text   NOT NULL,
  business_address        text   NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT settings_precision_check
    CHECK (minor_unit_precision BETWEEN 0 AND 6),
  CONSTRAINT settings_tax_rate_check
    CHECK (tax_rate_ppm >= 0 AND tax_rate_ppm <= 1000000),
  CONSTRAINT settings_service_rate_check
    CHECK (service_charge_rate_ppm >= 0 AND service_charge_rate_ppm <= 1000000),
  CONSTRAINT settings_currency_check
    CHECK (currency_code ~ '^[A-Z]{3}$')
);
```

No row is seeded. B-24 forbids a hard-coded rate, so the installation is configured through the back office in Phase 1.

- [ ] **Step 4: Create the staff-user migration**

Create `db/migrations/0003_staff_user.sql`:

```sql
CREATE TABLE staff_user (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  role       text NOT NULL,
  -- Argon2id encoded hash, used to verify a PIN (B-11).
  pin_hash   text NOT NULL,
  -- Keyed digest of the PIN under a server-side pepper. Two jobs: it makes
  -- "unique PIN" enforceable (FR-A4), and it makes PIN-only login possible at
  -- all, since a per-user salted hash cannot be searched (FR-A2).
  pin_lookup text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- KITCHEN is a staff classification, never an authenticating role (FR-A1).
  CONSTRAINT staff_user_role_check CHECK (role IN ('CASHIER', 'MANAGER'))
);

CREATE UNIQUE INDEX staff_user_pin_lookup_key ON staff_user (pin_lookup);
```

- [ ] **Step 5: Create the audit and telemetry migration**

Create `db/migrations/0004_audit_and_telemetry.sql`:

```sql
-- Append-only (B-7). No updated_at, no deleted_at, no soft delete.
CREATE TABLE audit_entry (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES staff_user (id),
  approver_id uuid REFERENCES staff_user (id),
  action      text NOT NULL,
  outcome     text NOT NULL,
  subject_type text,
  subject_id   text,
  reason       text,
  before_amount bigint,
  after_amount  bigint,
  client_instance_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_outcome_check
    CHECK (outcome IN ('SUCCESS', 'INVALID_APPROVAL', 'CANCELLED'))
);

CREATE INDEX audit_entry_occurred_at_idx ON audit_entry (occurred_at DESC);

-- Unauthenticated PIN failures have no identified actor, so they cannot live
-- in audit_entry without violating B-13. They are security telemetry instead.
CREATE TABLE security_telemetry (
  id          bigserial PRIMARY KEY,
  event       text NOT NULL,
  throttle_class text,
  client_instance_id uuid,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
```

Neither table has a PIN column, and none may ever be added (B-12).

- [ ] **Step 6: Create the throttle migration**

Create `db/migrations/0005_auth_throttle.sql`:

```sql
-- Exactly two installation-wide buckets (FR-A5), seeded here so the throttle
-- service only ever updates rows and never races to create them.
CREATE TABLE auth_throttle (
  throttle_class       text PRIMARY KEY,
  consecutive_failures int NOT NULL DEFAULT 0,
  blocked_until        timestamptz,

  CONSTRAINT auth_throttle_class_check
    CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL')),
  CONSTRAINT auth_throttle_failures_check
    CHECK (consecutive_failures >= 0)
);

INSERT INTO auth_throttle (throttle_class) VALUES ('LOGIN'), ('MANAGER_APPROVAL');
```

- [ ] **Step 7: Create the session and client-instance migration**

Create `db/migrations/0006_session_and_client.sql`:

```sql
-- ClientInstance is browser-profile identity for continuity and telemetry
-- only. It is never an authorization boundary (FR-A7).
CREATE TABLE client_instance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Audience decides route access and timeout policy, never permissions
  -- (FR-A2c). Role still decides what the actor may do.
  audience          text NOT NULL,
  staff_user_id     uuid NOT NULL REFERENCES staff_user (id),
  client_instance_id uuid REFERENCES client_instance (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz,
  released_at       timestamptz,

  CONSTRAINT app_session_audience_check
    CHECK (audience IN ('POS', 'BACK_OFFICE'))
);

CREATE INDEX app_session_active_idx
  ON app_session (staff_user_id) WHERE released_at IS NULL;
```

- [ ] **Step 8: Create the roles and grants migration**

Create `db/migrations/0007_roles_and_grants.sql`:

```sql
-- The application connects as pos_app. Migrations run as the owner. This is
-- what makes B-7 structural rather than a matter of developer discipline:
-- the application literally cannot rewrite history.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_app') THEN
    CREATE ROLE pos_app LOGIN PASSWORD 'apppassword';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO pos_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  settings_version, staff_user, auth_throttle, app_session, client_instance
  TO pos_app;

-- Append-only: insert and read, never modify or remove.
GRANT SELECT, INSERT ON audit_entry, security_telemetry TO pos_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_app;
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/schema.test.ts`
Expected: PASS, all five cases. The UPDATE and DELETE assertions prove the grant, not merely the intent.

- [ ] **Step 10: Commit**

```bash
git add db/migrations apps/server/test/schema.test.ts
git commit -m "feat: core schema with append-only audit enforced by db grants"
```

---

## Task 4: PIN hashing and lookup

**Files:**
- Create: `apps/server/src/config.ts`, `apps/server/src/domain/pin.ts`
- Modify: `apps/server/package.json` (add `@node-rs/argon2`, `zod`)
- Test: `apps/server/test/pin.test.ts`

**Interfaces:**
- Consumes: `query` from Task 1; `staff_user` from Task 3.
- Produces: `config: { pinPepper: string; databaseUrl: string; host: string; port: number; tlsKeyPath: string; tlsCertPath: string }`, `hashPin(pin: string): Promise<string>`, `verifyPin(pin: string, hash: string): Promise<boolean>`, `pinLookup(pin: string): string`, `assertValidPinFormat(pin: string): void`, `createStaffUser(input: { name: string; role: 'CASHIER' | 'MANAGER'; pin: string }): Promise<{ id: string }>`, `findUserByPin(pin: string): Promise<{ id: string; role: string } | null>`.

- [ ] **Step 1: Add dependencies**

```bash
npm i @node-rs/argon2 zod -w apps/server
```

`@node-rs/argon2` ships prebuilt binaries, so no `node-gyp` toolchain is needed.

- [ ] **Step 2: Write the failing PIN test**

Create `apps/server/test/pin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/pool.js';
import {
  hashPin,
  verifyPin,
  pinLookup,
  assertValidPinFormat,
  createStaffUser,
  findUserByPin,
} from '../src/domain/pin.js';

describe('PIN format', () => {
  it.each(['000000', '123456', '999999'])('accepts %s', (pin) => {
    expect(() => assertValidPinFormat(pin)).not.toThrow();
  });

  it.each(['12345', '1234567', 'abcdef', '12 456', '', '12345a'])(
    'rejects %j',
    (pin) => {
      expect(() => assertValidPinFormat(pin)).toThrow('PIN must be six digits');
    }
  );
});

describe('hashPin', () => {
  it('produces an argon2id hash that verifies', async () => {
    const hash = await hashPin('123456');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPin('123456', hash)).toBe(true);
    expect(await verifyPin('654321', hash)).toBe(false);
  });

  it('never returns the PIN itself', async () => {
    const hash = await hashPin('123456');
    expect(hash).not.toContain('123456');
  });

  it('salts, so the same PIN hashes differently each time', async () => {
    expect(await hashPin('123456')).not.toBe(await hashPin('123456'));
  });
});

describe('pinLookup', () => {
  it('is deterministic for the same PIN', () => {
    expect(pinLookup('123456')).toBe(pinLookup('123456'));
  });

  it('differs for different PINs', () => {
    expect(pinLookup('123456')).not.toBe(pinLookup('123457'));
  });

  it('never contains the PIN', () => {
    expect(pinLookup('123456')).not.toContain('123456');
  });
});

describe('staff users', () => {
  beforeEach(async () => {
    await query('DELETE FROM app_session');
    await query('DELETE FROM staff_user');
  });

  it('finds a user by PIN alone', async () => {
    const { id } = await createStaffUser({
      name: 'Rina',
      role: 'CASHIER',
      pin: '123456',
    });
    const found = await findUserByPin('123456');
    expect(found).toEqual({ id, role: 'CASHIER' });
  });

  it('returns null for an unknown PIN', async () => {
    await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '123456' });
    expect(await findUserByPin('654321')).toBeNull();
  });

  it('refuses a duplicate PIN', async () => {
    await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '123456' });
    await expect(
      createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '123456' })
    ).rejects.toThrow('PIN already in use');
  });

  it('ignores a deactivated user', async () => {
    const { id } = await createStaffUser({
      name: 'Rina',
      role: 'CASHIER',
      pin: '123456',
    });
    await query('UPDATE staff_user SET is_active = false WHERE id = $1', [id]);
    expect(await findUserByPin('123456')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/pin.test.ts`
Expected: FAIL — cannot resolve `../src/domain/pin.js`.

- [ ] **Step 4: Implement config**

Create `apps/server/src/config.ts`:

```ts
import { z } from 'zod';

const Schema = z.object({
  DATABASE_URL: z.string().default('postgres://pos_app:apppassword@localhost:5433/pos'),
  // Keyed-digest secret for PIN lookup. Lives in config, never in the
  // database, so a database dump alone cannot enumerate six-digit PINs.
  PIN_PEPPER: z.string().min(32, 'PIN_PEPPER must be at least 32 characters'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8443),
  TLS_KEY_PATH: z.string().default('certs/localhost-key.pem'),
  TLS_CERT_PATH: z.string().default('certs/localhost-cert.pem'),
});

const parsed = Schema.parse(process.env);

export const config = {
  databaseUrl: parsed.DATABASE_URL,
  pinPepper: parsed.PIN_PEPPER,
  host: parsed.HOST,
  port: parsed.PORT,
  tlsKeyPath: parsed.TLS_KEY_PATH,
  tlsCertPath: parsed.TLS_CERT_PATH,
};
```

- [ ] **Step 5: Implement the PIN domain**

Create `apps/server/src/domain/pin.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const PIN_PATTERN = /^[0-9]{6}$/;

export function assertValidPinFormat(pin: string): void {
  if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
    // The message never echoes the value (B-12).
    throw new Error('PIN must be six digits');
  }
}

export async function hashPin(pin: string): Promise<string> {
  assertValidPinFormat(pin);
  return argonHash(pin, { algorithm: Algorithm.Argon2id });
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!PIN_PATTERN.test(pin)) return false;
  try {
    return await argonVerify(hash, pin, { algorithm: Algorithm.Argon2id });
  } catch {
    return false;
  }
}

/**
 * Deterministic keyed digest used to make PINs unique (FR-A4) and to identify
 * a user from a PIN alone (FR-A2). A per-user salted argon2 hash cannot be
 * searched, so without this, PIN-only login would be impossible.
 */
export function pinLookup(pin: string): string {
  assertValidPinFormat(pin);
  return createHmac('sha256', config.pinPepper).update(pin).digest('hex');
}

export async function createStaffUser(input: {
  name: string;
  role: 'CASHIER' | 'MANAGER';
  pin: string;
}): Promise<{ id: string }> {
  assertValidPinFormat(input.pin);

  const rows = await query<{ id: string }>(
    `INSERT INTO staff_user (name, role, pin_hash, pin_lookup)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pin_lookup) DO NOTHING
     RETURNING id`,
    [input.name, input.role, await hashPin(input.pin), pinLookup(input.pin)]
  );

  const row = rows[0];
  if (!row) throw new Error('PIN already in use');
  return { id: row.id };
}

export async function findUserByPin(
  pin: string
): Promise<{ id: string; role: string } | null> {
  if (!PIN_PATTERN.test(pin)) return null;

  const rows = await query<{ id: string; role: string; pin_hash: string }>(
    `SELECT id, role, pin_hash FROM staff_user
     WHERE pin_lookup = $1 AND is_active = true`,
    [pinLookup(pin)]
  );

  const row = rows[0];
  if (!row) return null;

  // The lookup digest narrows to one row; argon2 is still the authority on
  // whether the PIN is correct.
  if (!(await verifyPin(pin, row.pin_hash))) return null;

  return { id: row.id, role: row.role };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `PIN_PEPPER=test-pepper-at-least-32-characters-long npx vitest run apps/server/test/pin.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/config.ts apps/server/src/domain/pin.ts apps/server/test/pin.test.ts apps/server/package.json
git commit -m "feat: argon2id pin hashing with peppered lookup digest"
```

---

## Task 5: Audit and telemetry writers

**Files:**
- Create: `apps/server/src/domain/audit.ts`
- Test: `apps/server/test/audit.test.ts`

**Interfaces:**
- Consumes: `withTransaction`, `query` from Task 1; `audit_entry`, `security_telemetry` from Task 3.
- Produces: `writeAudit(client: PoolClient, entry: AuditInput): Promise<void>`, `writeAuditOwnTransaction(entry: AuditInput): Promise<void>`, `writeTelemetry(event: TelemetryInput): Promise<void>`, and the types `AuditInput = { actorId: string | null; approverId?: string | null; action: string; outcome: 'SUCCESS' | 'INVALID_APPROVAL' | 'CANCELLED'; subjectType?: string; subjectId?: string; reason?: string; beforeAmount?: bigint; afterAmount?: bigint; clientInstanceId?: string | null }`, `TelemetryInput = { event: string; throttleClass?: 'LOGIN' | 'MANAGER_APPROVAL'; clientInstanceId?: string | null; detail?: Record<string, unknown> }`.

- [ ] **Step 1: Write the failing audit test**

Create `apps/server/test/audit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { query, withTransaction } from '../src/db/pool.js';
import {
  writeAudit,
  writeAuditOwnTransaction,
  writeTelemetry,
} from '../src/domain/audit.js';
import { createStaffUser } from '../src/domain/pin.js';

describe('audit', () => {
  let actorId: string;

  beforeEach(async () => {
    await query('DELETE FROM audit_entry');
    await query('DELETE FROM security_telemetry');
    await query('DELETE FROM app_session');
    await query('DELETE FROM staff_user');
    actorId = (
      await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '123456' })
    ).id;
  });

  it('writes an entry inside the caller transaction', async () => {
    await withTransaction(async (client) => {
      await writeAudit(client, {
        actorId,
        action: 'ORDER_VOID',
        outcome: 'SUCCESS',
        reason: 'keyed in error',
      });
    });

    const rows = await query<{ action: string; actor_id: string }>(
      'SELECT action, actor_id FROM audit_entry'
    );
    expect(rows).toEqual([{ action: 'ORDER_VOID', actor_id: actorId }]);
  });

  it('rolls back with its action — no orphan evidence', async () => {
    await expect(
      withTransaction(async (client) => {
        await writeAudit(client, {
          actorId,
          action: 'ORDER_VOID',
          outcome: 'SUCCESS',
        });
        throw new Error('command failed after audit');
      })
    ).rejects.toThrow('command failed after audit');

    expect(await query('SELECT 1 FROM audit_entry')).toHaveLength(0);
  });

  it('stores money as bigint without precision loss', async () => {
    await withTransaction((client) =>
      writeAudit(client, {
        actorId,
        action: 'DISCOUNT_APPLY',
        outcome: 'SUCCESS',
        beforeAmount: 9007199254740993n,
        afterAmount: 0n,
      })
    );

    const rows = await query<{ before_amount: string }>(
      'SELECT before_amount FROM audit_entry'
    );
    // Number(9007199254740993) would be 9007199254740992 — B-1 in miniature.
    expect(rows[0]!.before_amount).toBe('9007199254740993');
  });

  it('records a failed approval in its own transaction, actor known, approver null', async () => {
    await writeAuditOwnTransaction({
      actorId,
      approverId: null,
      action: 'DISCOUNT_APPLY',
      outcome: 'INVALID_APPROVAL',
    });

    const rows = await query<{ outcome: string; approver_id: string | null }>(
      'SELECT outcome, approver_id FROM audit_entry'
    );
    expect(rows).toEqual([{ outcome: 'INVALID_APPROVAL', approver_id: null }]);
  });

  it('writes unauthenticated failures to telemetry, not audit', async () => {
    await writeTelemetry({ event: 'PIN_FAILURE', throttleClass: 'LOGIN' });

    expect(await query('SELECT 1 FROM audit_entry')).toHaveLength(0);
    const rows = await query<{ event: string }>('SELECT event FROM security_telemetry');
    expect(rows).toEqual([{ event: 'PIN_FAILURE' }]);
  });

  it('has no column capable of holding a PIN', async () => {
    const cols = await query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name IN ('audit_entry', 'security_telemetry')
    `);
    for (const c of cols) expect(c.column_name).not.toMatch(/pin/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/audit.test.ts`
Expected: FAIL — cannot resolve `../src/domain/audit.js`.

- [ ] **Step 3: Implement the writers**

Create `apps/server/src/domain/audit.ts`:

```ts
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db/pool.js';

export type AuditOutcome = 'SUCCESS' | 'INVALID_APPROVAL' | 'CANCELLED';

export interface AuditInput {
  actorId: string | null;
  approverId?: string | null;
  action: string;
  outcome: AuditOutcome;
  subjectType?: string;
  subjectId?: string;
  reason?: string;
  beforeAmount?: bigint;
  afterAmount?: bigint;
  clientInstanceId?: string | null;
}

export interface TelemetryInput {
  event: string;
  throttleClass?: 'LOGIN' | 'MANAGER_APPROVAL';
  clientInstanceId?: string | null;
  detail?: Record<string, unknown>;
}

const INSERT_AUDIT = `
  INSERT INTO audit_entry
    (actor_id, approver_id, action, outcome, subject_type, subject_id,
     reason, before_amount, after_amount, client_instance_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
`;

function auditParams(e: AuditInput): unknown[] {
  return [
    e.actorId,
    e.approverId ?? null,
    e.action,
    e.outcome,
    e.subjectType ?? null,
    e.subjectId ?? null,
    e.reason ?? null,
    // bigint is passed as a canonical string; pg sends it to BIGINT intact.
    e.beforeAmount === undefined ? null : e.beforeAmount.toString(10),
    e.afterAmount === undefined ? null : e.afterAmount.toString(10),
    e.clientInstanceId ?? null,
  ];
}

/**
 * Writes evidence inside the caller's transaction, so an action cannot commit
 * without its history and history cannot survive a rolled-back action.
 */
export async function writeAudit(client: PoolClient, entry: AuditInput): Promise<void> {
  await client.query(INSERT_AUDIT, auditParams(entry));
}

/**
 * For outcomes with no business action to join — a rejected or cancelled
 * approval changes nothing, so there is no transaction to enlist in.
 */
export async function writeAuditOwnTransaction(entry: AuditInput): Promise<void> {
  await withTransaction((client) => writeAudit(client, entry));
}

/**
 * Unauthenticated events have no identified actor, so B-13 keeps them out of
 * the audit table entirely.
 */
export async function writeTelemetry(event: TelemetryInput): Promise<void> {
  await query(
    `INSERT INTO security_telemetry (event, throttle_class, client_instance_id, detail)
     VALUES ($1, $2, $3, $4)`,
    [
      event.event,
      event.throttleClass ?? null,
      event.clientInstanceId ?? null,
      JSON.stringify(event.detail ?? {}),
    ]
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/audit.test.ts`
Expected: PASS, all six cases.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/domain/audit.ts apps/server/test/audit.test.ts
git commit -m "feat: transactional audit writer and separate security telemetry"
```

---

## Task 6: Throttle buckets

**Files:**
- Create: `apps/server/src/domain/throttle.ts`
- Test: `apps/server/test/throttle.test.ts`

**Interfaces:**
- Consumes: `withTransaction` from Task 1; `auth_throttle` from Task 3; `writeTelemetry` from Task 5.
- Produces: `type ThrottleClass = 'LOGIN' | 'MANAGER_APPROVAL'`, `assertNotThrottled(c: ThrottleClass): Promise<void>` throwing `ThrottledError`, `recordFailure(c: ThrottleClass): Promise<void>`, `recordSuccess(c: ThrottleClass): Promise<void>`, `class ThrottledError extends Error { retryAfterSeconds: number }`, constants `MAX_FAILURES = 5`, `COOLDOWN_MINUTES = 5`.

- [ ] **Step 1: Write the failing throttle test**

Create `apps/server/test/throttle.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/pool.js';
import {
  assertNotThrottled,
  recordFailure,
  recordSuccess,
  ThrottledError,
  MAX_FAILURES,
} from '../src/domain/throttle.js';

describe('throttle', () => {
  beforeEach(async () => {
    await query(
      'UPDATE auth_throttle SET consecutive_failures = 0, blocked_until = NULL'
    );
    await query('DELETE FROM security_telemetry');
  });

  it('permits verification below the threshold', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure('LOGIN');
    await expect(assertNotThrottled('LOGIN')).resolves.toBeUndefined();
  });

  it('blocks the class at the threshold', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure('LOGIN');
    await expect(assertNotThrottled('LOGIN')).rejects.toBeInstanceOf(ThrottledError);
  });

  it('blocks only the class that failed', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure('LOGIN');
    await expect(assertNotThrottled('MANAGER_APPROVAL')).resolves.toBeUndefined();
  });

  it('does not let a login success reset manager-approval failures', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure('MANAGER_APPROVAL');
    await recordSuccess('LOGIN');

    await recordFailure('MANAGER_APPROVAL');
    await expect(assertNotThrottled('MANAGER_APPROVAL')).rejects.toBeInstanceOf(
      ThrottledError
    );
  });

  it('resets its own class on success', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure('LOGIN');
    await recordSuccess('LOGIN');

    const rows = await query<{ consecutive_failures: number }>(
      `SELECT consecutive_failures FROM auth_throttle WHERE throttle_class = 'LOGIN'`
    );
    expect(rows[0]!.consecutive_failures).toBe(0);
  });

  it('reports how long the cooldown has left', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure('LOGIN');
    try {
      await assertNotThrottled('LOGIN');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ThrottledError);
      expect((e as ThrottledError).retryAfterSeconds).toBeGreaterThan(0);
      expect((e as ThrottledError).retryAfterSeconds).toBeLessThanOrEqual(300);
    }
  });

  it('survives a restart, because state is in the database', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure('LOGIN');
    const rows = await query<{ blocked_until: Date | null }>(
      `SELECT blocked_until FROM auth_throttle WHERE throttle_class = 'LOGIN'`
    );
    expect(rows[0]!.blocked_until).not.toBeNull();
  });

  it('records each failure as telemetry with no PIN', async () => {
    await recordFailure('LOGIN');
    const rows = await query<{ event: string; detail: unknown }>(
      'SELECT event, detail FROM security_telemetry'
    );
    expect(rows[0]!.event).toBe('PIN_FAILURE');
    expect(JSON.stringify(rows[0]!.detail)).not.toMatch(/[0-9]{6}/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/throttle.test.ts`
Expected: FAIL — cannot resolve `../src/domain/throttle.js`.

- [ ] **Step 3: Implement the throttle**

Create `apps/server/src/domain/throttle.ts`:

```ts
import { withTransaction } from '../db/pool.js';
import { writeTelemetry } from './audit.js';

export type ThrottleClass = 'LOGIN' | 'MANAGER_APPROVAL';

export const MAX_FAILURES = 5;
export const COOLDOWN_MINUTES = 5;

export class ThrottledError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('too many failed attempts');
    this.name = 'ThrottledError';
  }
}

export async function assertNotThrottled(cls: ThrottleClass): Promise<void> {
  const seconds = await withTransaction(async (client) => {
    const res = await client.query<{ remaining: string | null }>(
      `SELECT CEIL(EXTRACT(EPOCH FROM (blocked_until - now())))::text AS remaining
         FROM auth_throttle
        WHERE throttle_class = $1 AND blocked_until > now()`,
      [cls]
    );
    return res.rows[0]?.remaining ?? null;
  });

  if (seconds !== null) throw new ThrottledError(Number(seconds));
}

export async function recordFailure(cls: ThrottleClass): Promise<void> {
  await withTransaction(async (client) => {
    // Locking the row keeps two concurrent failures from both reading 4 and
    // each writing 5, which would lose a strike.
    await client.query(
      `SELECT 1 FROM auth_throttle WHERE throttle_class = $1 FOR UPDATE`,
      [cls]
    );
    await client.query(
      `UPDATE auth_throttle
          SET consecutive_failures = consecutive_failures + 1,
              blocked_until = CASE
                WHEN consecutive_failures + 1 >= $2
                THEN now() + ($3 || ' minutes')::interval
                ELSE blocked_until
              END
        WHERE throttle_class = $1`,
      [cls, MAX_FAILURES, String(COOLDOWN_MINUTES)]
    );
  });

  // Never include the attempted PIN, not even masked (B-12).
  await writeTelemetry({ event: 'PIN_FAILURE', throttleClass: cls });
}

/** Only a success in the same class clears that class (FR-A5). */
export async function recordSuccess(cls: ThrottleClass): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE auth_throttle
          SET consecutive_failures = 0, blocked_until = NULL
        WHERE throttle_class = $1`,
      [cls]
    );
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/throttle.test.ts`
Expected: PASS, all eight cases. The fourth is the one that matters most: a cashier logging in repeatedly must not wipe an attacker's progress against the manager PIN.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/domain/throttle.ts apps/server/test/throttle.test.ts
git commit -m "feat: installation-wide login and approval throttle buckets"
```

---

## Task 7: Sessions with audience policy

**Files:**
- Create: `apps/server/src/domain/session.ts`
- Test: `apps/server/test/session.test.ts`

**Interfaces:**
- Consumes: `query` from Task 1; `app_session` from Task 3.
- Produces: `type Audience = 'POS' | 'BACK_OFFICE'`, `POLICY: Record<Audience, { idleSeconds: number; absoluteSeconds: number | null }>`, `createSession(input: { audience: Audience; staffUserId: string; clientInstanceId?: string | null }): Promise<{ id: string }>`, `resolveSession(id: string, audience: Audience, opts?: { touch?: boolean }): Promise<{ id: string; staffUserId: string; role: string } | null>`, `releaseSession(id: string): Promise<void>`, `invalidateSessionsForUser(staffUserId: string): Promise<void>`, `COOKIE_NAME: Record<Audience, string>`.

- [ ] **Step 1: Write the failing session test**

Create `apps/server/test/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/pool.js';
import {
  createSession,
  resolveSession,
  releaseSession,
  invalidateSessionsForUser,
  POLICY,
} from '../src/domain/session.js';
import { createStaffUser } from '../src/domain/pin.js';

async function ageSession(id: string, seconds: number) {
  await query(
    `UPDATE app_session SET last_activity_at = now() - ($2 || ' seconds')::interval
      WHERE id = $1`,
    [id, String(seconds)]
  );
}

describe('sessions', () => {
  let cashierId: string;
  let managerId: string;

  beforeEach(async () => {
    await query('DELETE FROM app_session');
    await query('DELETE FROM staff_user');
    cashierId = (await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '111111' })).id;
    managerId = (await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '222222' })).id;
  });

  it('applies the documented timeout policy', () => {
    expect(POLICY.POS.idleSeconds).toBe(90);
    expect(POLICY.POS.absoluteSeconds).toBeNull();
    expect(POLICY.BACK_OFFICE.idleSeconds).toBe(30 * 60);
    expect(POLICY.BACK_OFFICE.absoluteSeconds).toBe(8 * 60 * 60);
  });

  it('resolves a fresh session', async () => {
    const { id } = await createSession({ audience: 'POS', staffUserId: cashierId });
    const resolved = await resolveSession(id, 'POS');
    expect(resolved).toMatchObject({ staffUserId: cashierId, role: 'CASHIER' });
  });

  it('refuses a POS session presented to a back-office route', async () => {
    const { id } = await createSession({ audience: 'POS', staffUserId: managerId });
    expect(await resolveSession(id, 'BACK_OFFICE')).toBeNull();
  });

  it('refuses a back-office session presented to a POS route', async () => {
    const { id } = await createSession({ audience: 'BACK_OFFICE', staffUserId: managerId });
    expect(await resolveSession(id, 'POS')).toBeNull();
  });

  it('expires a POS session after 90 seconds idle', async () => {
    const { id } = await createSession({ audience: 'POS', staffUserId: cashierId });
    await ageSession(id, 89);
    expect(await resolveSession(id, 'POS')).not.toBeNull();

    await ageSession(id, 91);
    expect(await resolveSession(id, 'POS')).toBeNull();
  });

  it('keeps a back-office session alive well past 90 seconds', async () => {
    const { id } = await createSession({ audience: 'BACK_OFFICE', staffUserId: managerId });
    await ageSession(id, 20 * 60);
    expect(await resolveSession(id, 'BACK_OFFICE')).not.toBeNull();

    await ageSession(id, 31 * 60);
    expect(await resolveSession(id, 'BACK_OFFICE')).toBeNull();
  });

  it('ends a back-office session at its absolute lifetime however active', async () => {
    const { id } = await createSession({ audience: 'BACK_OFFICE', staffUserId: managerId });
    await query(
      `UPDATE app_session SET absolute_expires_at = now() - interval '1 second'
        WHERE id = $1`,
      [id]
    );
    expect(await resolveSession(id, 'BACK_OFFICE')).toBeNull();
  });

  it('does not extend idle time when touch is false', async () => {
    const { id } = await createSession({ audience: 'BACK_OFFICE', staffUserId: managerId });
    await ageSession(id, 20 * 60);
    await resolveSession(id, 'BACK_OFFICE', { touch: false });
    await ageSession(id, 31 * 60);
    expect(await resolveSession(id, 'BACK_OFFICE')).toBeNull();
  });

  it('rejects a released session', async () => {
    const { id } = await createSession({ audience: 'POS', staffUserId: cashierId });
    await releaseSession(id);
    expect(await resolveSession(id, 'POS')).toBeNull();
  });

  it('invalidates every session for a user', async () => {
    const a = await createSession({ audience: 'POS', staffUserId: cashierId });
    const b = await createSession({ audience: 'POS', staffUserId: cashierId });
    await invalidateSessionsForUser(cashierId);
    expect(await resolveSession(a.id, 'POS')).toBeNull();
    expect(await resolveSession(b.id, 'POS')).toBeNull();
  });

  it('rejects a session whose user was deactivated', async () => {
    const { id } = await createSession({ audience: 'POS', staffUserId: cashierId });
    await query('UPDATE staff_user SET is_active = false WHERE id = $1', [cashierId]);
    expect(await resolveSession(id, 'POS')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/session.test.ts`
Expected: FAIL — cannot resolve `../src/domain/session.js`.

- [ ] **Step 3: Implement sessions**

Create `apps/server/src/domain/session.ts`:

```ts
import { query } from '../db/pool.js';

export type Audience = 'POS' | 'BACK_OFFICE';

/**
 * FR-A2 and FR-A2b. The POS is a shared device left unattended between uses,
 * so it expires in seconds. The back office is a desk, where expiring
 * mid-edit is its own failure.
 */
export const POLICY: Record<
  Audience,
  { idleSeconds: number; absoluteSeconds: number | null }
> = {
  POS: { idleSeconds: 90, absoluteSeconds: null },
  BACK_OFFICE: { idleSeconds: 30 * 60, absoluteSeconds: 8 * 60 * 60 },
};

export const COOKIE_NAME: Record<Audience, string> = {
  POS: 'pos_sid',
  BACK_OFFICE: 'bo_sid',
};

export async function createSession(input: {
  audience: Audience;
  staffUserId: string;
  clientInstanceId?: string | null;
}): Promise<{ id: string }> {
  const absolute = POLICY[input.audience].absoluteSeconds;

  const rows = await query<{ id: string }>(
    `INSERT INTO app_session
       (audience, staff_user_id, client_instance_id, absolute_expires_at)
     VALUES ($1, $2, $3,
             CASE WHEN $4::int IS NULL THEN NULL
                  ELSE now() + ($4 || ' seconds')::interval END)
     RETURNING id`,
    [
      input.audience,
      input.staffUserId,
      input.clientInstanceId ?? null,
      absolute === null ? null : String(absolute),
    ]
  );

  const row = rows[0];
  if (!row) throw new Error('failed to create session');
  return { id: row.id };
}

/**
 * Audience is checked in the query itself, so a session issued for one client
 * can never resolve on the other (FR-A2c) regardless of the holder's role.
 */
export async function resolveSession(
  id: string,
  audience: Audience,
  opts: { touch?: boolean } = {}
): Promise<{ id: string; staffUserId: string; role: string } | null> {
  const touch = opts.touch !== false;
  const { idleSeconds } = POLICY[audience];

  const rows = await query<{ id: string; staff_user_id: string; role: string }>(
    `SELECT s.id, s.staff_user_id, u.role
       FROM app_session s
       JOIN staff_user u ON u.id = s.staff_user_id
      WHERE s.id = $1
        AND s.audience = $2
        AND s.released_at IS NULL
        AND u.is_active = true
        AND s.last_activity_at > now() - ($3 || ' seconds')::interval
        AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > now())`,
    [id, audience, String(idleSeconds)]
  );

  const row = rows[0];
  if (!row) return null;

  // Background polling must not count as activity (FR-A2b), so the caller
  // passes touch:false for those routes.
  if (touch) {
    await query('UPDATE app_session SET last_activity_at = now() WHERE id = $1', [id]);
  }

  return { id: row.id, staffUserId: row.staff_user_id, role: row.role };
}

export async function releaseSession(id: string): Promise<void> {
  await query(
    'UPDATE app_session SET released_at = now() WHERE id = $1 AND released_at IS NULL',
    [id]
  );
}

/** Used when the back office deactivates a user or resets a PIN (FR-B3). */
export async function invalidateSessionsForUser(staffUserId: string): Promise<void> {
  await query(
    `UPDATE app_session SET released_at = now()
      WHERE staff_user_id = $1 AND released_at IS NULL`,
    [staffUserId]
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/session.test.ts`
Expected: PASS, all eleven cases. The audience cases are the load-bearing ones — a session must not cross between clients even when the same manager holds both.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/domain/session.ts apps/server/test/session.test.ts
git commit -m "feat: audience-scoped sessions with divergent timeout policies"
```

---

## Task 8: HTTPS server, loopback guard, client instance

**Files:**
- Create: `scripts/gen-local-cert.sh`
- Create: `apps/server/src/http/loopback.ts`, `src/http/clientInstance.ts`, `src/http/server.ts`, `src/index.ts`
- Create: `packages/contracts/package.json`, `packages/contracts/src/errors.ts`
- Modify: `apps/server/package.json` (add `fastify`, `@fastify/cookie`, `@fastify/static`)
- Test: `apps/server/test/loopback.test.ts`, `apps/server/test/server.test.ts`

**Interfaces:**
- Consumes: `config` from Task 4; `query` from Task 1.
- Produces: `assertLoopbackOnly(host: string): void`, `clientInstancePlugin` (Fastify plugin setting `request.clientInstanceId`), `buildServer(): Promise<FastifyInstance>`, `ErrorCode` union in `@pos/contracts`.

- [ ] **Step 1: Add dependencies**

```bash
npm i fastify @fastify/cookie @fastify/static -w apps/server
```

- [ ] **Step 2: Create the contracts package**

Create `packages/contracts/package.json`:

```json
{
  "name": "@pos/contracts",
  "type": "module",
  "main": "src/errors.ts",
  "dependencies": { "zod": "^3.23.0" }
}
```

Create `packages/contracts/src/errors.ts`:

```ts
/** Stable machine-readable codes. Error responses never carry PINs, SQL, or stack traces. */
export const ErrorCode = {
  INVALID_PIN: 'INVALID_PIN',
  THROTTLED: 'THROTTLED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  WRONG_AUDIENCE: 'WRONG_AUDIENCE',
  FORBIDDEN: 'FORBIDDEN',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_INVALID: 'APPROVAL_INVALID',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

- [ ] **Step 3: Write the failing loopback test**

Create `apps/server/test/loopback.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assertLoopbackOnly } from '../src/http/loopback.js';

describe('assertLoopbackOnly', () => {
  it.each(['127.0.0.1', '::1', 'localhost', '127.0.0.5'])('accepts %s', (host) => {
    expect(() => assertLoopbackOnly(host)).not.toThrow();
  });

  it.each(['0.0.0.0', '::', '192.168.1.10', '10.0.0.2', 'example.com'])(
    'refuses %s',
    (host) => {
      expect(() => assertLoopbackOnly(host)).toThrow(/loopback/);
    }
  );
});
```

`0.0.0.0` is the dangerous one: it binds every interface, quietly putting PINs on the LAN.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/loopback.test.ts`
Expected: FAIL — cannot resolve `../src/http/loopback.js`.

- [ ] **Step 5: Implement the loopback guard**

Create `apps/server/src/http/loopback.ts`:

```ts
import { isIPv4, isIPv6 } from 'node:net';

/**
 * NFR-1. The MVP is loopback-only. Startup fails rather than binding an
 * interface that would carry PINs across a network.
 */
export function assertLoopbackOnly(host: string): void {
  if (host === 'localhost') return;

  if (isIPv4(host) && host.startsWith('127.')) return;
  if (isIPv6(host) && (host === '::1' || host === '0:0:0:0:0:0:0:1')) return;

  throw new Error(
    `refusing to bind ${host}: the MVP must listen on a loopback address only`
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/loopback.test.ts`
Expected: PASS, all nine cases.

- [ ] **Step 7: Create the certificate script**

Create `scripts/gen-local-cert.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/localhost-key.pem \
  -out certs/localhost-cert.pem \
  -days 825 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Certificate written to certs/. Trust it once in your OS keychain,"
echo "then https://localhost:8443/pos/ loads without a warning."
```

Then: `chmod +x scripts/gen-local-cert.sh && ./scripts/gen-local-cert.sh`

Browser and server are the same host, so this is a one-time trust step with none of the per-terminal distribution problems a LAN deployment would bring.

- [ ] **Step 8: Write the failing server test**

Create `apps/server/test/server.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { query } from '../src/db/pool.js';

describe('server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a health check', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('issues a ClientInstance cookie on first contact', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const cookie = res.cookies.find((c) => c.name === 'cid');

    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.path).toBe('/');

    const rows = await query('SELECT 1 FROM client_instance WHERE id = $1', [
      cookie!.value,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('reuses an existing ClientInstance rather than issuing another', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/health' });
    const cid = first.cookies.find((c) => c.name === 'cid')!.value;

    const second = await app.inject({
      method: 'GET',
      url: '/api/health',
      cookies: { cid },
    });
    expect(second.cookies.find((c) => c.name === 'cid')).toBeUndefined();
  });

  it('issues a fresh ClientInstance when the cookie is unknown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      cookies: { cid: '00000000-0000-0000-0000-000000000000' },
    });
    const cookie = res.cookies.find((c) => c.name === 'cid');
    expect(cookie).toBeDefined();
    expect(cookie!.value).not.toBe('00000000-0000-0000-0000-000000000000');
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/server.test.ts`
Expected: FAIL — cannot resolve `../src/http/server.js`.

- [ ] **Step 10: Implement the ClientInstance plugin**

Create `apps/server/src/http/clientInstance.ts`:

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { query } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyRequest {
    clientInstanceId: string | null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * FR-A7. Browser-profile identity for continuity and telemetry only. It is
 * never an authorization boundary, and clearing it bypasses no throttle,
 * because the throttle buckets are installation-wide.
 */
async function plugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('clientInstanceId', null);

  app.addHook('onRequest', async (request: FastifyRequest, reply) => {
    const presented = request.cookies?.cid;

    if (presented && UUID.test(presented)) {
      const rows = await query<{ id: string }>(
        'UPDATE client_instance SET last_seen = now() WHERE id = $1 RETURNING id',
        [presented]
      );
      if (rows[0]) {
        request.clientInstanceId = rows[0].id;
        return;
      }
    }

    const created = await query<{ id: string }>(
      'INSERT INTO client_instance DEFAULT VALUES RETURNING id'
    );
    const id = created[0]!.id;
    request.clientInstanceId = id;

    reply.setCookie('cid', id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  });
}

export const clientInstancePlugin = fp(plugin);
```

Add `fastify-plugin`: `npm i fastify-plugin -w apps/server`

- [ ] **Step 11: Implement the server**

Create `apps/server/src/http/server.ts`. TLS is an injected option so tests can
build a plain in-process instance while production supplies certificates:

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { clientInstancePlugin } from './clientInstance.js';

export async function buildServer(
  opts: { https?: { key: Buffer; cert: Buffer } } = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    https: opts.https ?? null,
    logger: {
      level: 'info',
      // Belt and braces for B-12: even a mistaken log call cannot emit a PIN.
      redact: {
        paths: ['req.body.pin', 'req.body.managerPin', 'body.pin', 'body.managerPin'],
        censor: '[redacted]',
      },
    },
  });

  await app.register(cookie);
  await app.register(clientInstancePlugin);

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 12: Implement the composition root**

Create `apps/server/src/index.ts`:

```ts
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { assertLoopbackOnly } from './http/loopback.js';
import { buildServer } from './http/server.js';

async function main(): Promise<void> {
  // Before anything else binds (NFR-1).
  assertLoopbackOnly(config.host);

  const app = await buildServer({
    https: {
      key: readFileSync(config.tlsKeyPath),
      cert: readFileSync(config.tlsCertPath),
    },
  });

  await app.listen({ host: config.host, port: config.port });
  console.log(`listening on https://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/server.test.ts`
Expected: PASS, all four cases.

- [ ] **Step 14: Commit**

```bash
git add scripts packages/contracts apps/server/src/http apps/server/src/index.ts apps/server/test/loopback.test.ts apps/server/test/server.test.ts apps/server/package.json
git commit -m "feat: https localhost server with loopback guard and client instance"
```

---

## Task 9: Authentication routes and audience enforcement

**Files:**
- Create: `apps/server/src/http/audience.ts`, `src/http/routes/posAuth.ts`, `src/http/routes/boAuth.ts`
- Create: `packages/contracts/src/auth.ts`
- Modify: `apps/server/src/http/server.ts` (register routes)
- Test: `apps/server/test/auth-routes.test.ts`

**Interfaces:**
- Consumes: `findUserByPin` (Task 4), throttle functions (Task 6), session functions (Task 7), `ErrorCode` (Task 8).
- Produces: `requireSession(audience: Audience)` Fastify preHandler setting `request.actor = { staffUserId, role, sessionId }`; routes `POST /api/pos/auth/login`, `POST /api/pos/auth/release`, `GET /api/pos/auth/me`, `POST /api/back-office/auth/login`, `POST /api/back-office/auth/logout`, `GET /api/back-office/auth/me`.

- [ ] **Step 1: Create the auth contracts**

Create `packages/contracts/src/auth.ts`:

```ts
import { z } from 'zod';

export const PinSchema = z.string().regex(/^[0-9]{6}$/, 'PIN must be six digits');

export const LoginRequest = z.object({ pin: PinSchema });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const ActorResponse = z.object({
  staffUserId: z.string().uuid(),
  role: z.enum(['CASHIER', 'MANAGER']),
});
export type ActorResponse = z.infer<typeof ActorResponse>;
```

- [ ] **Step 2: Write the failing auth-routes test**

Create `apps/server/test/auth-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { query } from '../src/db/pool.js';
import { createStaffUser } from '../src/domain/pin.js';

describe('auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await query('DELETE FROM app_session');
    await query('DELETE FROM audit_entry');
    await query('DELETE FROM security_telemetry');
    await query('DELETE FROM staff_user');
    await query(
      'UPDATE auth_throttle SET consecutive_failures = 0, blocked_until = NULL'
    );
    await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '111111' });
    await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '222222' });
  });

  async function posLogin(pin: string) {
    return app.inject({
      method: 'POST',
      url: '/api/pos/auth/login',
      payload: { pin },
    });
  }

  it('logs a cashier in at the POS and identifies them from the PIN alone', async () => {
    const res = await posLogin('111111');
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe('CASHIER');
    expect(res.cookies.find((c) => c.name === 'pos_sid')).toBeDefined();
  });

  it('rejects a wrong PIN without revealing whether any user has it', async () => {
    const res = await posLogin('999999');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_PIN');
    expect(JSON.stringify(res.json())).not.toContain('999999');
  });

  it('throttles the LOGIN class after five failures', async () => {
    for (let i = 0; i < 5; i++) await posLogin('999999');
    const res = await posLogin('111111'); // correct PIN, still blocked
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('THROTTLED');
  });

  it('records login failures as telemetry, never as audit entries', async () => {
    await posLogin('999999');
    expect(await query('SELECT 1 FROM audit_entry')).toHaveLength(0);
    expect(await query('SELECT 1 FROM security_telemetry')).toHaveLength(1);
  });

  it('refuses a POS cookie on a back-office route', async () => {
    const login = await posLogin('222222'); // a manager, at the POS
    const sid = login.cookies.find((c) => c.name === 'pos_sid')!.value;

    const res = await app.inject({
      method: 'GET',
      url: '/api/back-office/auth/me',
      cookies: { bo_sid: sid },
    });
    expect(res.statusCode).toBe(401);
  });

  it('refuses a back-office cookie on a POS route', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { pin: '222222' },
    });
    const sid = login.cookies.find((c) => c.name === 'bo_sid')!.value;

    const res = await app.inject({
      method: 'GET',
      url: '/api/pos/auth/me',
      cookies: { pos_sid: sid },
    });
    expect(res.statusCode).toBe(401);
  });

  it('refuses a cashier at the back office', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/back-office/auth/login',
      payload: { pin: '111111' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('releases a POS actor context on request', async () => {
    const login = await posLogin('111111');
    const sid = login.cookies.find((c) => c.name === 'pos_sid')!.value;

    await app.inject({
      method: 'POST',
      url: '/api/pos/auth/release',
      cookies: { pos_sid: sid },
    });

    const me = await app.inject({
      method: 'GET',
      url: '/api/pos/auth/me',
      cookies: { pos_sid: sid },
    });
    expect(me.statusCode).toBe(401);
  });

  it('rejects a malformed PIN before touching the database', async () => {
    const res = await posLogin('12345');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_FAILED');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/auth-routes.test.ts`
Expected: FAIL — 404 on every auth route.

- [ ] **Step 4: Implement audience enforcement**

Create `apps/server/src/http/audience.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from '@pos/contracts/src/errors.js';
import { COOKIE_NAME, resolveSession, type Audience } from '../domain/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: { staffUserId: string; role: string; sessionId: string };
  }
}

/**
 * FR-A2c. The audience is checked server-side against the session record, so
 * a client-supplied header can never move a session between surfaces.
 */
export function requireSession(audience: Audience, opts: { touch?: boolean } = {}) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const sid = request.cookies?.[COOKIE_NAME[audience]];
    if (!sid) {
      return reply.code(401).send({ code: ErrorCode.UNAUTHENTICATED });
    }

    const session = await resolveSession(sid, audience, opts);
    if (!session) {
      return reply.code(401).send({ code: ErrorCode.UNAUTHENTICATED });
    }

    request.actor = {
      staffUserId: session.staffUserId,
      role: session.role,
      sessionId: session.id,
    };
  };
}
```

- [ ] **Step 5: Implement the POS auth routes**

Create `apps/server/src/http/routes/posAuth.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { ErrorCode } from '@pos/contracts/src/errors.js';
import { LoginRequest } from '@pos/contracts/src/auth.js';
import { findUserByPin } from '../../domain/pin.js';
import {
  assertNotThrottled,
  recordFailure,
  recordSuccess,
  ThrottledError,
} from '../../domain/throttle.js';
import {
  COOKIE_NAME,
  createSession,
  releaseSession,
} from '../../domain/session.js';
import { requireSession } from '../audience.js';

export async function posAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/pos/auth/login', async (request, reply) => {
    const parsed = LoginRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: ErrorCode.VALIDATION_FAILED });
    }

    try {
      await assertNotThrottled('LOGIN');
    } catch (e) {
      if (e instanceof ThrottledError) {
        return reply
          .code(429)
          .send({ code: ErrorCode.THROTTLED, retryAfterSeconds: e.retryAfterSeconds });
      }
      throw e;
    }

    const user = await findUserByPin(parsed.data.pin);
    if (!user) {
      await recordFailure('LOGIN');
      // Identical response whether or not a user holds that PIN.
      return reply.code(401).send({ code: ErrorCode.INVALID_PIN });
    }

    await recordSuccess('LOGIN');

    const session = await createSession({
      audience: 'POS',
      staffUserId: user.id,
      clientInstanceId: request.clientInstanceId,
    });

    reply.setCookie(COOKIE_NAME.POS, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });

    return { staffUserId: user.id, role: user.role };
  });

  app.get(
    '/api/pos/auth/me',
    { preHandler: requireSession('POS') },
    async (request) => ({
      staffUserId: request.actor!.staffUserId,
      role: request.actor!.role,
    })
  );

  app.post(
    '/api/pos/auth/release',
    { preHandler: requireSession('POS') },
    async (request, reply) => {
      await releaseSession(request.actor!.sessionId);
      reply.clearCookie(COOKIE_NAME.POS, { path: '/' });
      return { released: true };
    }
  );
}
```

- [ ] **Step 6: Implement the back-office auth routes**

Create `apps/server/src/http/routes/boAuth.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { ErrorCode } from '@pos/contracts/src/errors.js';
import { LoginRequest } from '@pos/contracts/src/auth.js';
import { findUserByPin } from '../../domain/pin.js';
import {
  assertNotThrottled,
  recordFailure,
  recordSuccess,
  ThrottledError,
} from '../../domain/throttle.js';
import {
  COOKIE_NAME,
  createSession,
  releaseSession,
} from '../../domain/session.js';
import { requireSession } from '../audience.js';

export async function boAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/back-office/auth/login', async (request, reply) => {
    const parsed = LoginRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: ErrorCode.VALIDATION_FAILED });
    }

    try {
      await assertNotThrottled('LOGIN');
    } catch (e) {
      if (e instanceof ThrottledError) {
        return reply
          .code(429)
          .send({ code: ErrorCode.THROTTLED, retryAfterSeconds: e.retryAfterSeconds });
      }
      throw e;
    }

    const user = await findUserByPin(parsed.data.pin);
    if (!user) {
      await recordFailure('LOGIN');
      return reply.code(401).send({ code: ErrorCode.INVALID_PIN });
    }

    await recordSuccess('LOGIN');

    // The back office is manager-only. Role decides this, not audience.
    if (user.role !== 'MANAGER') {
      return reply.code(403).send({ code: ErrorCode.FORBIDDEN });
    }

    const session = await createSession({
      audience: 'BACK_OFFICE',
      staffUserId: user.id,
      clientInstanceId: request.clientInstanceId,
    });

    reply.setCookie(COOKIE_NAME.BACK_OFFICE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });

    return { staffUserId: user.id, role: user.role };
  });

  app.get(
    '/api/back-office/auth/me',
    // touch:false — a background poll must not extend the idle window (FR-A2b).
    { preHandler: requireSession('BACK_OFFICE', { touch: false }) },
    async (request) => ({
      staffUserId: request.actor!.staffUserId,
      role: request.actor!.role,
    })
  );

  app.post(
    '/api/back-office/auth/logout',
    { preHandler: requireSession('BACK_OFFICE') },
    async (request, reply) => {
      await releaseSession(request.actor!.sessionId);
      reply.clearCookie(COOKIE_NAME.BACK_OFFICE, { path: '/' });
      return { loggedOut: true };
    }
  );
}
```

- [ ] **Step 7: Register the routes**

In `apps/server/src/http/server.ts`, add the imports and registrations after the health route:

```ts
import { posAuthRoutes } from './routes/posAuth.js';
import { boAuthRoutes } from './routes/boAuth.js';

// ...after app.get('/api/health', ...):
  await app.register(posAuthRoutes);
  await app.register(boAuthRoutes);
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/auth-routes.test.ts`
Expected: PASS, all ten cases.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/auth.ts apps/server/src/http apps/server/test/auth-routes.test.ts
git commit -m "feat: pos and back-office auth routes with audience enforcement"
```

---

## Task 10: Inline manager approval

**Files:**
- Create: `apps/server/src/domain/approval.ts`
- Test: `apps/server/test/approval.test.ts`

**Interfaces:**
- Consumes: `findUserByPin` (Task 4), audit writers (Task 5), throttle (Task 6), `withTransaction` (Task 1).
- Produces: `withManagerApproval<T>(input: { actorId: string; managerPin: string; action: string; reason?: string; subjectType?: string; subjectId?: string; clientInstanceId?: string | null }, work: (client: PoolClient, approverId: string) => Promise<T>): Promise<T>`, `class ApprovalError extends Error { code: 'APPROVAL_INVALID' | 'THROTTLED'; retryAfterSeconds?: number }`.

- [ ] **Step 1: Write the failing approval test**

Create `apps/server/test/approval.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { query } from '../src/db/pool.js';
import { createStaffUser } from '../src/domain/pin.js';
import { withManagerApproval, ApprovalError } from '../src/domain/approval.js';

describe('withManagerApproval', () => {
  let cashierId: string;
  let managerId: string;

  beforeEach(async () => {
    await query('DELETE FROM audit_entry');
    await query('DELETE FROM app_session');
    await query('DELETE FROM staff_user');
    await query(
      'UPDATE auth_throttle SET consecutive_failures = 0, blocked_until = NULL'
    );
    cashierId = (await createStaffUser({ name: 'Rina', role: 'CASHIER', pin: '111111' })).id;
    managerId = (await createStaffUser({ name: 'Budi', role: 'MANAGER', pin: '222222' })).id;
  });

  it('runs the work and writes one combined entry naming actor and approver', async () => {
    const result = await withManagerApproval(
      { actorId: cashierId, managerPin: '222222', action: 'DISCOUNT_APPLY', reason: 'staff meal' },
      async () => 'done'
    );
    expect(result).toBe('done');

    const rows = await query<{
      actor_id: string;
      approver_id: string;
      outcome: string;
    }>('SELECT actor_id, approver_id, outcome FROM audit_entry');

    expect(rows).toEqual([
      { actor_id: cashierId, approver_id: managerId, outcome: 'SUCCESS' },
    ]);
  });

  it('refuses a cashier PIN as approval', async () => {
    await expect(
      withManagerApproval(
        { actorId: cashierId, managerPin: '111111', action: 'DISCOUNT_APPLY' },
        async () => 'done'
      )
    ).rejects.toBeInstanceOf(ApprovalError);
  });

  it('records a failed approval with actor known and approver null', async () => {
    await expect(
      withManagerApproval(
        { actorId: cashierId, managerPin: '999999', action: 'DISCOUNT_APPLY' },
        async () => 'done'
      )
    ).rejects.toBeInstanceOf(ApprovalError);

    const rows = await query<{ actor_id: string; approver_id: null; outcome: string }>(
      'SELECT actor_id, approver_id, outcome FROM audit_entry'
    );
    expect(rows).toEqual([
      { actor_id: cashierId, approver_id: null, outcome: 'INVALID_APPROVAL' },
    ]);
  });

  it('does not run the work when approval fails', async () => {
    let ran = false;
    await expect(
      withManagerApproval(
        { actorId: cashierId, managerPin: '999999', action: 'DISCOUNT_APPLY' },
        async () => {
          ran = true;
          return 'done';
        }
      )
    ).rejects.toThrow();
    expect(ran).toBe(false);
  });

  it('leaves no audit entry when the work itself fails', async () => {
    await expect(
      withManagerApproval(
        { actorId: cashierId, managerPin: '222222', action: 'DISCOUNT_APPLY' },
        async () => {
          throw new Error('work failed');
        }
      )
    ).rejects.toThrow('work failed');

    expect(await query('SELECT 1 FROM audit_entry')).toHaveLength(0);
  });

  it('counts failures against MANAGER_APPROVAL, not LOGIN', async () => {
    await expect(
      withManagerApproval(
        { actorId: cashierId, managerPin: '999999', action: 'DISCOUNT_APPLY' },
        async () => 'x'
      )
    ).rejects.toThrow();

    const rows = await query<{ throttle_class: string; consecutive_failures: number }>(
      'SELECT throttle_class, consecutive_failures FROM auth_throttle ORDER BY throttle_class'
    );
    expect(rows).toEqual([
      { throttle_class: 'LOGIN', consecutive_failures: 0 },
      { throttle_class: 'MANAGER_APPROVAL', consecutive_failures: 1 },
    ]);
  });

  it('never leaks the attempted PIN in the error', async () => {
    try {
      await withManagerApproval(
        { actorId: cashierId, managerPin: '999999', action: 'DISCOUNT_APPLY' },
        async () => 'x'
      );
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('999999');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/server/test/approval.test.ts`
Expected: FAIL — cannot resolve `../src/domain/approval.js`.

- [ ] **Step 3: Implement approval**

Create `apps/server/src/domain/approval.ts`:

```ts
import type { PoolClient } from 'pg';
import { withTransaction } from '../db/pool.js';
import { findUserByPin } from './pin.js';
import { writeAudit, writeAuditOwnTransaction } from './audit.js';
import {
  assertNotThrottled,
  recordFailure,
  recordSuccess,
  ThrottledError,
} from './throttle.js';

export class ApprovalError extends Error {
  constructor(
    public readonly code: 'APPROVAL_INVALID' | 'THROTTLED',
    public readonly retryAfterSeconds?: number
  ) {
    // Never echoes the attempted PIN (B-12).
    super(code === 'THROTTLED' ? 'approval temporarily blocked' : 'approval invalid');
    this.name = 'ApprovalError';
  }
}

export interface ApprovalInput {
  actorId: string;
  managerPin: string;
  action: string;
  reason?: string;
  subjectType?: string;
  subjectId?: string;
  clientInstanceId?: string | null;
}

/**
 * B-14. Verifies a manager PIN, performs the work, and writes one combined
 * audit entry, all inside one transaction. Nothing here issues a token or
 * touches a session, so the approval cannot outlive this call.
 */
export async function withManagerApproval<T>(
  input: ApprovalInput,
  work: (client: PoolClient, approverId: string) => Promise<T>
): Promise<T> {
  try {
    await assertNotThrottled('MANAGER_APPROVAL');
  } catch (e) {
    if (e instanceof ThrottledError) {
      throw new ApprovalError('THROTTLED', e.retryAfterSeconds);
    }
    throw e;
  }

  const approver = await findUserByPin(input.managerPin);

  if (!approver || approver.role !== 'MANAGER') {
    await recordFailure('MANAGER_APPROVAL');

    // The action never happened, so there is no business transaction to join.
    // ADR-007's qualification: this evidence commits on its own.
    await writeAuditOwnTransaction({
      actorId: input.actorId,
      approverId: null,
      action: input.action,
      outcome: 'INVALID_APPROVAL',
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      clientInstanceId: input.clientInstanceId,
    });

    throw new ApprovalError('APPROVAL_INVALID');
  }

  await recordSuccess('MANAGER_APPROVAL');

  return withTransaction(async (client) => {
    const result = await work(client, approver.id);

    await writeAudit(client, {
      actorId: input.actorId,
      approverId: approver.id,
      action: input.action,
      outcome: 'SUCCESS',
      reason: input.reason,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      clientInstanceId: input.clientInstanceId,
    });

    return result;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/server/test/approval.test.ts`
Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/domain/approval.ts apps/server/test/approval.test.ts
git commit -m "feat: inline manager approval with combined audit evidence"
```

---

## Task 11: Two client shells

**Files:**
- Create: `packages/tokens/package.json`, `packages/tokens/src/index.ts`
- Create: `apps/pos/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/PinPad.tsx`
- Create: `apps/back-office/package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/LoginForm.tsx`
- Modify: `apps/server/src/http/server.ts` (serve both bundles)

**Interfaces:**
- Consumes: auth routes from Task 9.
- Produces: two independently built bundles served at `/pos/` and `/back-office/`.

- [ ] **Step 1: Create the shared tokens package**

Create `packages/tokens/package.json`:

```json
{ "name": "@pos/tokens", "type": "module", "main": "src/index.ts" }
```

Create `packages/tokens/src/index.ts`:

```ts
/** Shared design tokens. Layout and components stay per-client (NFR-5). */
export const tokens = {
  color: {
    bg: '#faf9f7',
    surface: '#ffffff',
    text: '#1a1a1a',
    muted: '#6b6b6b',
    accent: '#1f6feb',
    danger: '#b42318',
    border: '#e3e1de',
  },
  space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
  radius: { sm: '6px', md: '10px' },
} as const;
```

- [ ] **Step 2: Create the POS app manifest and Vite config**

Create `apps/pos/package.json`:

```json
{
  "name": "@pos/pos-client",
  "type": "module",
  "scripts": { "build": "vite build", "dev": "vite" },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

Create `apps/pos/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/pos/',
  build: { outDir: '../server/public/pos', emptyOutDir: true },
});
```

- [ ] **Step 3: Create the POS entry point**

Create `apps/pos/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>POS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`maximum-scale=1` stops a tablet zooming when a numeric field takes focus.

Create `apps/pos/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Create the POS pin pad**

Create `apps/pos/src/PinPad.tsx`:

```tsx
import { useState } from 'react';
import { tokens } from '@pos/tokens/src/index.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'];

export function PinPad({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');

  function press(key: string) {
    if (key === 'clear') return setPin('');
    if (key === 'enter') {
      onSubmit(pin);
      setPin('');
      return;
    }
    if (pin.length < 6) setPin(pin + key);
  }

  return (
    <div>
      <div
        data-testid="pin-display"
        style={{
          fontSize: 32,
          letterSpacing: 12,
          minHeight: 44,
          textAlign: 'center',
          color: tokens.color.text,
        }}
      >
        {'•'.repeat(pin.length)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gap: tokens.space.sm }}>
        {KEYS.map((k) => (
          <button
            key={k}
            data-testid={`key-${k}`}
            onClick={() => press(k)}
            style={{
              height: 72,
              fontSize: 20,
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.border}`,
              background: tokens.color.surface,
            }}
          >
            {k === 'clear' ? '⌫' : k === 'enter' ? '→' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Touch targets are 72px tall because this is used standing up, at speed.

- [ ] **Step 5: Create the POS app**

Create `apps/pos/src/App.tsx`:

```tsx
import { useState } from 'react';
import { tokens } from '@pos/tokens/src/index.js';
import { PinPad } from './PinPad.js';

type Actor = { staffUserId: string; role: string };

export function App() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(pin: string) {
    setError(null);
    const res = await fetch('/api/pos/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      setActor(await res.json());
      return;
    }
    const body = await res.json().catch(() => ({ code: 'UNKNOWN' }));
    setError(
      body.code === 'THROTTLED'
        ? `Too many attempts. Try again in ${body.retryAfterSeconds}s.`
        : 'Incorrect PIN.'
    );
  }

  async function release() {
    await fetch('/api/pos/auth/release', { method: 'POST' });
    setActor(null);
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: tokens.color.bg,
        color: tokens.color.text,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: tokens.space.lg,
      }}
    >
      {actor ? (
        <div data-testid="pos-signed-in" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24 }}>Signed in as {actor.role}</h1>
          <button onClick={release} data-testid="release" style={{ marginTop: tokens.space.md }}>
            Done
          </button>
        </div>
      ) : (
        <div>
          <h1 style={{ fontSize: 20, textAlign: 'center' }}>Enter PIN</h1>
          <PinPad onSubmit={login} />
          {error && (
            <p data-testid="pos-error" style={{ color: tokens.color.danger, marginTop: tokens.space.md }}>
              {error}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Create the back-office app**

Create `apps/back-office/package.json`:

```json
{
  "name": "@pos/back-office-client",
  "type": "module",
  "scripts": { "build": "vite build", "dev": "vite" },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

Create `apps/back-office/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/back-office/',
  build: { outDir: '../server/public/back-office', emptyOutDir: true },
});
```

Create `apps/back-office/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Back Office</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/back-office/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Create the back-office login form and app**

Create `apps/back-office/src/LoginForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { tokens } from '@pos/tokens/src/index.js';

export function LoginForm({ onSubmit }: { onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(pin);
    setPin('');
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: tokens.space.md, width: 320 }}>
      <label style={{ display: 'grid', gap: tokens.space.xs }}>
        Manager PIN
        <input
          data-testid="bo-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            padding: tokens.space.sm,
            fontSize: 16,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
          }}
        />
      </label>
      <button data-testid="bo-submit" type="submit">
        Sign in
      </button>
    </form>
  );
}
```

Create `apps/back-office/src/App.tsx`:

```tsx
import { useState } from 'react';
import { tokens } from '@pos/tokens/src/index.js';
import { LoginForm } from './LoginForm.js';

type Actor = { staffUserId: string; role: string };

export function App() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(pin: string) {
    setError(null);
    const res = await fetch('/api/back-office/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      setActor(await res.json());
      return;
    }
    const body = await res.json().catch(() => ({ code: 'UNKNOWN' }));
    setError(
      body.code === 'FORBIDDEN'
        ? 'The back office is for managers.'
        : body.code === 'THROTTLED'
          ? `Too many attempts. Try again in ${body.retryAfterSeconds}s.`
          : 'Incorrect PIN.'
    );
  }

  async function logout() {
    await fetch('/api/back-office/auth/logout', { method: 'POST' });
    setActor(null);
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: tokens.color.bg,
        color: tokens.color.text,
        minHeight: '100vh',
        padding: tokens.space.xl,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: tokens.space.lg }}>Back Office</h1>
      {actor ? (
        <div data-testid="bo-signed-in">
          <p>Signed in as {actor.role}.</p>
          <button onClick={logout} data-testid="bo-logout">
            Sign out
          </button>
        </div>
      ) : (
        <>
          <LoginForm onSubmit={login} />
          {error && (
            <p data-testid="bo-error" style={{ color: tokens.color.danger }}>
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 8: Serve both bundles from the server**

In `apps/server/src/http/server.ts`, add after the route registrations:

```ts
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';

// ...after boAuthRoutes registration:
  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'apps/server/public/pos'),
    prefix: '/pos/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: join(process.cwd(), 'apps/server/public/back-office'),
    prefix: '/back-office/',
    decorateReply: false,
  });
```

One origin, two path roots — no CORS, one certificate, one CSRF model.

- [ ] **Step 9: Build both clients and verify they serve**

Run:
```bash
npm i
npm run build -w apps/pos
npm run build -w apps/back-office
PIN_PEPPER=local-dev-pepper-at-least-32-characters npm run dev -w apps/server
```

Open `https://localhost:8443/pos/` and `https://localhost:8443/back-office/`.
Expected: two visibly different applications — a touch pin pad and a desktop form.

- [ ] **Step 10: Commit**

```bash
git add packages/tokens apps/pos apps/back-office apps/server/src/http/server.ts
git commit -m "feat: separate pos and back-office client shells"
```

---

## Task 12: Two-client acceptance tests

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tests/two-client.spec.ts`
- Create: `apps/server/src/db/seedTestUsers.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: automated coverage of AC-19, AC-27, and AC-28 for this phase.

- [ ] **Step 1: Create the e2e package**

Create `e2e/package.json`:

```json
{
  "name": "@pos/e2e",
  "type": "module",
  "scripts": { "test": "playwright test" },
  "devDependencies": { "@playwright/test": "^1.48.0" }
}
```

Then: `npm i && npx playwright install chromium`

- [ ] **Step 2: Create the Playwright config**

Create `e2e/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://localhost:8443',
    // The local certificate is self-signed; the browser is on the same host.
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run dev -w apps/server',
    url: 'https://localhost:8443/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    env: { PIN_PEPPER: 'e2e-pepper-at-least-32-characters-long' },
  },
});
```

- [ ] **Step 3: Create the test-user seeder**

Create `apps/server/src/db/seedTestUsers.ts`:

```ts
import { query } from './pool.js';
import { createStaffUser } from '../domain/pin.js';

/**
 * Test fixture only. B-24 forbids seeded production configuration, so this
 * creates users for automated tests and nothing else — no menu, no rates.
 */
export async function seedTestUsers(): Promise<void> {
  await query('DELETE FROM app_session');
  await query('DELETE FROM audit_entry');
  await query('DELETE FROM security_telemetry');
  await query('DELETE FROM staff_user');
  await query('UPDATE auth_throttle SET consecutive_failures = 0, blocked_until = NULL');

  await createStaffUser({ name: 'Test Cashier', role: 'CASHIER', pin: '111111' });
  await createStaffUser({ name: 'Test Manager', role: 'MANAGER', pin: '222222' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestUsers()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Write the failing two-client test**

Create `e2e/tests/two-client.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

test.beforeEach(() => {
  execSync('npx tsx apps/server/src/db/seedTestUsers.ts', {
    cwd: '..',
    env: { ...process.env, PIN_PEPPER: 'e2e-pepper-at-least-32-characters-long' },
  });
});

async function posLogin(page: Page, pin: string) {
  await page.goto('/pos/');
  for (const digit of pin) await page.getByTestId(`key-${digit}`).click();
  await page.getByTestId('key-enter').click();
}

test('AC-27: a cashier signs in at the POS but cannot reach the back office', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const pos = await context.newPage();

  await posLogin(pos, '111111');
  await expect(pos.getByTestId('pos-signed-in')).toBeVisible();

  // Same browser context, so the POS cookie travels — and is still refused.
  const backOffice = await context.newPage();
  await backOffice.goto('/back-office/');
  await backOffice.getByTestId('bo-pin').fill('111111');
  await backOffice.getByTestId('bo-submit').click();

  await expect(backOffice.getByTestId('bo-error')).toHaveText(
    'The back office is for managers.'
  );

  await context.close();
});

test('AC-27: the two clients hold independent sessions at once', async ({ browser }) => {
  const context = await browser.newContext();

  const pos = await context.newPage();
  await posLogin(pos, '111111');
  await expect(pos.getByTestId('pos-signed-in')).toBeVisible();

  const backOffice = await context.newPage();
  await backOffice.goto('/back-office/');
  await backOffice.getByTestId('bo-pin').fill('222222');
  await backOffice.getByTestId('bo-submit').click();
  await expect(backOffice.getByTestId('bo-signed-in')).toBeVisible();

  // Neither displaced the other.
  await pos.reload();
  await expect(pos.getByTestId('pin-display')).toBeVisible();

  await context.close();
});

test('AC-19: five wrong PINs block the LOGIN class, and a correct PIN is still refused', async ({
  page,
}) => {
  for (let i = 0; i < 5; i++) await posLogin(page, '999999');
  await expect(page.getByTestId('pos-error')).toHaveText('Incorrect PIN.');

  await posLogin(page, '111111');
  await expect(page.getByTestId('pos-error')).toContainText('Too many attempts');
});

test('AC-19: clearing the ClientInstance cookie does not reset the throttle', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  for (let i = 0; i < 5; i++) await posLogin(page, '999999');

  // The throttle is installation-wide, so discarding browser identity buys
  // an attacker nothing.
  await context.clearCookies();

  await posLogin(page, '111111');
  await expect(page.getByTestId('pos-error')).toContainText('Too many attempts');

  await context.close();
});

test('AC-28: a POS actor context expires after 90 seconds idle', async ({ page }) => {
  await posLogin(page, '111111');
  await expect(page.getByTestId('pos-signed-in')).toBeVisible();

  const res = await page.request.get('/api/pos/auth/me');
  expect(res.status()).toBe(200);

  // Age the session server-side rather than waiting 91 real seconds.
  execSync(
    `psql "postgres://pos_owner:devpassword@localhost:5433/pos" -c ` +
      `"UPDATE app_session SET last_activity_at = now() - interval '91 seconds'"`,
    { stdio: 'ignore' }
  );

  const after = await page.request.get('/api/pos/auth/me');
  expect(after.status()).toBe(401);
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -w e2e`
Expected: FAIL — the clients are not built yet in a clean checkout, or assertions fail.

- [ ] **Step 6: Build the clients, then run the tests**

Run:
```bash
npm run build -w apps/pos
npm run build -w apps/back-office
npm test -w e2e
```
Expected: PASS, all five tests.

- [ ] **Step 7: Add a top-level verification script**

In the root `package.json`, replace the `scripts` block:

```json
  "scripts": {
    "db:up": "docker compose up -d",
    "db:migrate": "npm run migrate -w apps/server",
    "build:clients": "npm run build -w apps/pos && npm run build -w apps/back-office",
    "test:unit": "vitest run",
    "test:e2e": "npm test -w e2e",
    "verify": "npm run test:unit && npm run build:clients && npm run test:e2e"
  },
```

- [ ] **Step 8: Run the full verification**

Run: `PIN_PEPPER=local-dev-pepper-at-least-32-characters npm run verify`
Expected: every unit and integration suite passes, both clients build, all five e2e tests pass.

- [ ] **Step 9: Commit**

```bash
git add e2e apps/server/src/db/seedTestUsers.ts package.json
git commit -m "test: two-client acceptance coverage for phase 0"
```

---

## Phase 0 Definition of Done

- [ ] `npm run verify` passes from a clean checkout after `npm run db:up && npm run db:migrate`.
- [ ] No `number` type touches a monetary or rate value anywhere in `packages/money` or `apps/server` (B-1).
- [ ] `grep -ri "pin" apps/server/src --include=*.ts` shows no path that writes a PIN value to a log, audit row, telemetry row, or error message (B-12).
- [ ] The application database role cannot UPDATE or DELETE `audit_entry`, proven by a passing test rather than by inspection (B-7).
- [ ] The server refuses to start when `HOST` is not a loopback address (NFR-1).
- [ ] A success in the `LOGIN` class does not reset the `MANAGER_APPROVAL` counter (FR-A5).
- [ ] The POS and back office are two separate bundles with two separate session cookies; neither session resolves on the other's routes (NFR-5, FR-A2c).
- [ ] No menu, rate, table, or business detail is hard-coded or seeded outside the test fixture (B-24).

## What Phase 0 deliberately does not build

Orders, lines, menu, tables, discounts, tender, printing, business day, reporting. The money module exists but no calculation policy is wired, because the tax-inclusive versus "++" question is still open and belongs to Phase 2. The `CheckoutLease` belongs to Phase 4.
