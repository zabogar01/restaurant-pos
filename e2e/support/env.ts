import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { databaseEnv, developmentDatabases } from '../../apps/server/test/support/env.js';

/** The browser harness's own port. The development server keeps 8443. */
export const E2E_PORT = 8543;
/** The origin every page is loaded from. `localhost`, never `127.0.0.1`: the Host check refuses it. */
export const E2E_ORIGIN = `https://localhost:${E2E_PORT}`;

const DEV_ENV = fileURLToPath(new URL('../../db/dev.env', import.meta.url));
// The runner's verdict, carried to the workers: every database name it refused.
const REFUSED = 'E2E_REFUSED_DATABASES';

type Source = Record<string, string | undefined>;

function devEnvFile(): Source {
  return parseEnv(readFileSync(DEV_ENV, 'utf8'));
}

/**
 * Every database name the harness may never use: the development database and the
 * server tests' database as the file names them and as the shell names them,
 * `pos` and `pos_test`, and (in a worker) what the runner refused. The one place
 * that decides it, for the runner and for the workers alike. A worker's shell URLs
 * already name the harness's own database, so only the runner's carried names speak
 * for them.
 */
function refusedDatabases(file: Source, shell: Source, carried: string[] | null): Set<string> {
  const names = new Set<string>(['pos', 'pos_test', ...(carried ?? [])]);
  for (const source of [file, shell]) {
    for (const name of developmentDatabases(source, { urls: source === file || carried === null })) {
      names.add(name);
    }
    if (source.POS_TEST_DB_NAME) names.add(source.POS_TEST_DB_NAME);
  }
  return names;
}

/**
 * The environment the browser harness runs in, the twin of `serverTestEnv()`:
 * db/dev.env, overridden by the shell, with both connection URLs retargeted to
 * POS_E2E_DB_NAME. It refuses a name that is not a plain identifier, the
 * development database, `pos_test` and the server tests' database, however named.
 */
export function e2eEnv(): Record<string, string> {
  const env = databaseEnv('POS_E2E_DB_NAME', ['POS_TEST_DB_NAME']);
  const name = env.POS_E2E_DB_NAME!;
  if (refusedDatabases(devEnvFile(), process.env, null).has(name)) {
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
 * it checks them instead, against everything the runner refused, which the runner
 * carried in `E2E_REFUSED_DATABASES`. A shell that forges the marker gets that same
 * check, with the shell's own names added to it.
 */
export function applyE2eEnv(): void {
  if (process.env.E2E_ENV_APPLIED !== '1') {
    const refused = [...refusedDatabases(devEnvFile(), process.env, null)];
    Object.assign(process.env, e2eEnv());
    process.env[REFUSED] = JSON.stringify(refused);
    process.env.E2E_ENV_APPLIED = '1';
    return;
  }
  let carried: string[] = [];
  try {
    const parsed: unknown = JSON.parse(process.env[REFUSED] ?? '[]');
    if (Array.isArray(parsed)) carried = parsed.filter((n): n is string => typeof n === 'string');
  } catch {
    // an unreadable list adds nothing; the file's and the shell's names still apply
  }
  const refused = refusedDatabases(devEnvFile(), process.env, carried);
  const name = process.env.POS_E2E_DB_NAME;
  if (
    !name ||
    !/^[A-Za-z0-9_]+$/.test(name) ||
    refused.has(name) ||
    databaseOf(process.env.DATABASE_URL) !== name ||
    databaseOf(process.env.MIGRATION_DATABASE_URL) !== name
  ) {
    throw new Error('the browser harness environment does not name its own database; refusing to run');
  }
}
