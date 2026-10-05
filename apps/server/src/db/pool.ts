import pg from 'pg';

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
