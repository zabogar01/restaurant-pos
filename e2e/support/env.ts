import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { databaseEnv } from '../../apps/server/test/support/env.js';

/** The browser harness's own port. The development server keeps 8443. */
export const E2E_PORT = 8543;
/** The origin every page is loaded from. `localhost`, never `127.0.0.1`: the Host check refuses it. */
export const E2E_ORIGIN = `https://localhost:${E2E_PORT}`;

const DEV_ENV = fileURLToPath(new URL('../../db/dev.env', import.meta.url));

/**
 * The environment the browser harness runs in, the twin of `serverTestEnv()`:
 * db/dev.env, overridden by the shell, with both connection URLs retargeted to
 * POS_E2E_DB_NAME. It refuses a name that is not a plain identifier, the
 * development database, `pos_test` and the server tests' database, however named.
 */
export function e2eEnv(): Record<string, string> {
  const env = databaseEnv('POS_E2E_DB_NAME', ['POS_TEST_DB_NAME']);
  const name = env.POS_E2E_DB_NAME!;
  if (name === 'pos' || name === 'pos_test') {
    throw new Error(`POS_E2E_DB_NAME is "${name}", which is not the browser harness's database; refusing to run`);
  }
  return env;
}

function databaseOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/**
 * Puts the harness's environment on `process.env`, once, in the runner. A worker
 * evaluates the configuration again with the runner's values already in place,
 * where recomputing would mistake the harness's database for the development one;
 * it checks them instead, against the file's own development names.
 */
export function applyE2eEnv(): void {
  if (process.env.E2E_ENV_APPLIED !== '1') {
    Object.assign(process.env, e2eEnv());
    process.env.E2E_ENV_APPLIED = '1';
    return;
  }
  const file = parseEnv(readFileSync(DEV_ENV, 'utf8'));
  const name = process.env.POS_E2E_DB_NAME;
  const forbidden = new Set(
    [file.POS_DB_NAME, file.POS_TEST_DB_NAME, databaseOf(file.DATABASE_URL), databaseOf(file.MIGRATION_DATABASE_URL), 'pos', 'pos_test'].filter(
      (n): n is string => !!n
    )
  );
  if (
    !name ||
    !/^[A-Za-z0-9_]+$/.test(name) ||
    forbidden.has(name) ||
    databaseOf(process.env.DATABASE_URL) !== name ||
    databaseOf(process.env.MIGRATION_DATABASE_URL) !== name
  ) {
    throw new Error('the browser harness environment does not name its own database; refusing to run');
  }
}
