import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

// The migration runner is the only module that holds the owner connection
// (MIGRATION_DATABASE_URL). The application pool in pool.ts connects as the
// unprivileged pos_app role and cannot reach it.
export async function runMigrations(dir: string): Promise<string[]> {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    throw new Error('MIGRATION_DATABASE_URL is not set; refusing to migrate without it');
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migration (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const done = new Set(
      (await client.query<{ filename: string }>('SELECT filename FROM schema_migration')).rows.map(
        (r) => r.filename
      )
    );

    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`migration ${file} failed and was rolled back: ${reason}`, {
          cause: err,
        });
      }
      applied.push(file);
    }

    return applied;
  } finally {
    await client.end();
  }
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
      process.stdout.write(`${a.length ? `applied: ${a.join(', ')}` : 'no pending migrations'}\n`);
      process.exit(0);
    })
    .catch((e) => {
      // The command line, not the server: the operator needs the full error.
      process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
      process.exit(1);
    });
}
