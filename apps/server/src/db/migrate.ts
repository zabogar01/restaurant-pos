import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
    try {
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`migration ${file} failed and was rolled back: ${reason}`, {
        cause: err,
      });
    }
    applied.push(file);
  }

  return applied;
}

// Compare as URLs: import.meta.url is percent-encoded, so a checkout whose
// path contains a space never matched a hand-built `file://` string and the
// command exited 0 having done nothing.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  // `npm run db:migrate` runs with the workspace as cwd, so the default is
  // anchored to this file, and an explicit path to where npm was invoked.
  const dir = process.argv[2]
    ? resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2])
    : fileURLToPath(new URL('../../../../db/migrations', import.meta.url));
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
