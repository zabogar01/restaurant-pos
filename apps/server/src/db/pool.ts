import pg from 'pg';
import { logLine } from '../http/log.js';

const { Pool } = pg;

// pg returns BIGINT (oid 20) as a string by default. Keep it that way:
// converting to Number would silently violate B-1.
pg.types.setTypeParser(20, (v: string) => v);

/** A connection string from the environment. Unset is an error, never a default. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; refusing to connect without it`);
  }
  return value;
}

let pool: pg.Pool | undefined;

// The application pool connects as the unprivileged pos_app role. The owner
// connection (MIGRATION_DATABASE_URL) is not reachable from here.
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireEnv('DATABASE_URL') });
    // PostgreSQL closing an idle connection is an 'error' event on the pool;
    // unhandled, it ends the process with a raw dump.
    pool.on('error', (err) => logLine('error', 'idle database client failed', err));
  }
  return pool;
}

/** Ends the pool and forgets it, so the next getPool() opens a new one. */
export async function closePool(): Promise<void> {
  const closing = pool;
  pool = undefined;
  await closing?.end();
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
