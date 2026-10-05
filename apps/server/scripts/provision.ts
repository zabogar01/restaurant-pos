// Development and test tooling. Never imported by apps/server/src.
//
// Idempotent: creates the unprivileged application role `pos_app` and the test
// database, and on every run puts the role back to exactly the attributes it is
// meant to have, with the password from the environment. It grants the role no
// privilege beyond LOGIN; grants arrive with the tables they cover.
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const APP_ROLE = 'pos_app';

export interface ProvisionOptions {
  /** Owner connection string, to any database on the server. */
  ownerUrl: string;
  appPassword: string;
  testDatabase: string;
}

export async function provision({
  ownerUrl,
  appPassword,
  testDatabase,
}: ProvisionOptions): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const role = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
    if (role.rowCount === 0) {
      await client.query(`CREATE ROLE ${APP_ROLE}`);
    }
    // CREATE/ALTER ROLE ... PASSWORD takes no bind parameter: quote the literal.
    await client.query(
      `ALTER ROLE ${APP_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
         PASSWORD ${pg.escapeLiteral(appPassword)}`
    );

    const db = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabase]);
    if (db.rowCount === 0) {
      await client.query(`CREATE DATABASE ${pg.escapeIdentifier(testDatabase)}`);
    }
  } finally {
    await client.end();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; refusing to provision without it`);
  return value;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  provision({
    ownerUrl: requireEnv('MIGRATION_DATABASE_URL'),
    appPassword: requireEnv('POS_APP_PASSWORD'),
    testDatabase: requireEnv('POS_TEST_DB_NAME'),
  })
    .then(() => {
      console.log(`provisioned ${APP_ROLE} and ${process.env.POS_TEST_DB_NAME}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
