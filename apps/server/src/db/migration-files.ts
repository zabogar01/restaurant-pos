import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// What counts as a migration, shared by the runner and the start-up check so
// the two can never disagree: a file name ending in .sql, in name order.
export async function listMigrationFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
}

// Anchored to this source file, never to the working directory.
export function defaultMigrationsDir(): string {
  return fileURLToPath(new URL('../../../../db/migrations', import.meta.url));
}
