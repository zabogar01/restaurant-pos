import pg from 'pg';
import { runMigrations } from '../../src/db/migrate.js';

// The test run's owner connection (the test database). The application pool is
// pos_app and cannot drop a schema, so anything that must change the schema
// goes through here.
export async function ownerClient(): Promise<pg.Client> {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL is not set; refusing to connect');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function ownerQuery<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await ownerClient();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

/**
 * Drop and recreate schema public through the owner connection, then run the
 * real db/migrations. Tests reset with this and never with DELETE.
 */
export async function resetDatabase(): Promise<void> {
  const client = await ownerClient();
  try {
    // A fresh `public` created by the owner has none of the grants the template
    // database's `public` carries. Restore the PostgreSQL 16 default (USAGE for
    // everyone, CREATE for the owner only) so the test schema matches `pos`.
    await client.query(
      'DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO PUBLIC;'
    );
  } finally {
    await client.end();
  }
  await runMigrations('db/migrations');
}
