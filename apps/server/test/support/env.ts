import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const DEV_ENV = fileURLToPath(new URL('../../../../db/dev.env', import.meta.url));

function need(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set (db/dev.env or the shell); refusing to run`);
  return value;
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
  return {
    POS_APP_PASSWORD: need(merged, 'POS_APP_PASSWORD'),
    POS_TEST_DB_NAME: testDatabase,
    DATABASE_URL: retarget(need(merged, 'DATABASE_URL'), testDatabase),
    MIGRATION_DATABASE_URL: retarget(need(merged, 'MIGRATION_DATABASE_URL'), testDatabase),
    // The server this run provisions through; the same host as the test URLs
    // but its default database, so provisioning can create the test database.
    PROVISION_DATABASE_URL: need(merged, 'MIGRATION_DATABASE_URL'),
  };
}
