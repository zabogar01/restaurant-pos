import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const DEV_ENV = fileURLToPath(new URL('../../../../db/dev.env', import.meta.url));

function need(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set (db/dev.env or the shell); refusing to run`);
  return value;
}

/** The database a connection URL names, after resolving it. */
function databaseOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/**
 * The names that are the development database in `env`: POS_DB_NAME and the
 * databases the two connection URLs name. The single place that decides it. A
 * caller whose URLs have already been retargeted at its own database passes
 * `urls: false`, and carries the names it saw before retargeting.
 */
export function developmentDatabases(
  env: Record<string, string | undefined>,
  { urls = true }: { urls?: boolean } = {}
): Set<string> {
  const names = [env.POS_DB_NAME];
  if (urls) {
    for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
      if (env[key]) names.push(databaseOf(env[key]!));
    }
  }
  return new Set(names.filter((name): name is string => !!name));
}

function retarget(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

/**
 * The one place that decides which database a test run may touch. `variable`
 * names the setting that holds the run's database (POS_TEST_DB_NAME for the
 * server tests, POS_E2E_DB_NAME for the browser harness). It returns db/dev.env,
 * overridden by anything already set in the shell, with both connection URLs
 * pointed at that database, and refuses a name that is not a plain identifier or
 * that is the development database, however the development database is named.
 * `alsoRefuse` lists other settings whose databases this run must not use.
 */
export function databaseEnv(
  variable: string,
  alsoRefuse: string[] = []
): Record<string, string> {
  const merged: Record<string, string | undefined> = {
    ...parseEnv(readFileSync(DEV_ENV, 'utf8')),
    ...process.env,
  };
  const testDatabase = need(merged, variable);
  const developmentUrl = need(merged, 'DATABASE_URL');
  const migrationUrl = need(merged, 'MIGRATION_DATABASE_URL');

  // A plain identifier, so the name that is provisioned is the name the URLs
  // resolve to (no percent-escapes, slashes or query strings).
  if (!/^[A-Za-z0-9_]+$/.test(testDatabase)) {
    throw new Error(`${variable} "${testDatabase}" is not a plain database name; refusing to run`);
  }
  // The development database is never a test target, however it is named.
  if (developmentDatabases(merged).has(testDatabase)) {
    throw new Error(
      `${variable} is "${testDatabase}", which is the development database; ` +
        'refusing to run tests against it'
    );
  }
  // Another run's database is not this run's either: the two share a server, not a schema.
  for (const other of alsoRefuse) {
    if (merged[other] === testDatabase) {
      throw new Error(`${variable} is "${testDatabase}", which ${other} names; refusing to run`);
    }
  }

  return {
    POS_APP_PASSWORD: need(merged, 'POS_APP_PASSWORD'),
    [variable]: testDatabase,
    PIN_PEPPER: need(merged, 'PIN_PEPPER'),
    DATABASE_URL: retarget(developmentUrl, testDatabase),
    MIGRATION_DATABASE_URL: retarget(migrationUrl, testDatabase),
    // The server this run provisions through; the same host as the test URLs
    // but its default database, so provisioning can create the test database.
    PROVISION_DATABASE_URL: need(merged, 'MIGRATION_DATABASE_URL'),
  };
}

/**
 * The environment the server test project runs in: db/dev.env, overridden by
 * anything already set in the shell, with both connection URLs pointed at the
 * test database. Development database `pos` is not reachable through it.
 */
export function serverTestEnv(): Record<string, string> {
  return databaseEnv('POS_TEST_DB_NAME', ['POS_E2E_DB_NAME']);
}
