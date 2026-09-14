import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { query, withTransaction } from './pool.js';

export async function runMigrations(dir: string): Promise<string[]> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const done = new Set(
    (await query<{ filename: string }>('SELECT filename FROM schema_migration')).map(
      (r) => r.filename
    )
  );

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
    });
    applied.push(file);
  }

  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] ?? 'db/migrations');
  runMigrations(dir)
    .then((a) => {
      console.log(a.length ? `applied: ${a.join(', ')}` : 'no pending migrations');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
