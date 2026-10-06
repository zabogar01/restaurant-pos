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

function retarget(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

/**
 * The environment the server test project runs in: db/dev.env, overridden by
 * anything already set in the shell, with both connection URLs pointed at the
 * test database. Development database `pos` is not reachable through it.
 */
export function serverTestEnv(): Record<string, string> {
  const merged: Record<string, string | undefined> = {
    ...parseEnv(readFileSync(DEV_ENV, 'utf8')),
    ...process.env,
  };
  const testDatabase = need(merged, 'POS_TEST_DB_NAME');
  const developmentUrl = need(merged, 'DATABASE_URL');
  const migrationUrl = need(merged, 'MIGRATION_DATABASE_URL');

  // A plain identifier, so the name that is provisioned is the name the URLs
  // resolve to (no percent-escapes, slashes or query strings).
  if (!/^[A-Za-z0-9_]+$/.test(testDatabase)) {
    throw new Error(`POS_TEST_DB_NAME "${testDatabase}" is not a plain database name; refusing to run`);
  }
  // The development database is never a test target, however it is named.
  const development = new Set(
    [merged.POS_DB_NAME, databaseOf(developmentUrl), databaseOf(migrationUrl)].filter(
      (name): name is string => !!name
    )
  );
  if (development.has(testDatabase)) {
    throw new Error(
      `POS_TEST_DB_NAME is "${testDatabase}", which is the development database; ` +
        'refusing to run tests against it'
    );
  }

  return {
    POS_APP_PASSWORD: need(merged, 'POS_APP_PASSWORD'),
    POS_TEST_DB_NAME: testDatabase,
    PIN_PEPPER: need(merged, 'PIN_PEPPER'),
    DATABASE_URL: retarget(developmentUrl, testDatabase),
    MIGRATION_DATABASE_URL: retarget(migrationUrl, testDatabase),
    // The server this run provisions through; the same host as the test URLs
    // but its default database, so provisioning can create the test database.
    PROVISION_DATABASE_URL: need(merged, 'MIGRATION_DATABASE_URL'),
  };
}
