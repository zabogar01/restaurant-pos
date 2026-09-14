import pg from 'pg';

const { Pool } = pg;

// pg returns BIGINT (oid 20) as a string by default. Keep it that way:
// converting to Number would silently violate B-1.
pg.types.setTypeParser(20, (v: string) => v);

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        'postgres://pos_owner:devpassword@localhost:5433/pos',
    });
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
