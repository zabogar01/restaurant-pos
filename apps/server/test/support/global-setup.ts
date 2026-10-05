import pg from 'pg';
import { provision } from '../../scripts/provision.js';
import { serverTestEnv } from './env.js';

// One verify at a time across worktrees: they share one PostgreSQL server and
// one test database.
const LOCK = "hashtext('restaurant-pos:server-tests')";

export default async function setup(): Promise<() => Promise<void>> {
  const env = serverTestEnv();

  // A session-level lock lives as long as this connection, so the connection
  // is held open until teardown.
  const lock = new pg.Client({ connectionString: env.PROVISION_DATABASE_URL! });
  await lock.connect();
  try {
    const got = await lock.query<{ ok: boolean }>(`SELECT pg_try_advisory_lock(${LOCK}) AS ok`);
    if (!got.rows[0]?.ok) {
      console.log('another server test run holds the database; waiting for it to finish');
      await lock.query(`SELECT pg_advisory_lock(${LOCK})`);
    }
    await provision({
      ownerUrl: env.PROVISION_DATABASE_URL!,
      appPassword: env.POS_APP_PASSWORD!,
      testDatabase: env.POS_TEST_DB_NAME!,
    });
  } catch (err) {
    await lock.end();
    throw err;
  }

  return async () => {
    await lock.end();
  };
}
