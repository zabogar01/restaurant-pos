import { StartupError } from '../http/errors.js';
import { defaultMigrationsDir, listMigrationFiles } from './migration-files.js';
import { query } from './pool.js';

const BEHIND = 'the database is missing migrations that are in db/migrations; run npm run db:migrate';
const AHEAD =
  'the database has migrations that are not in db/migrations; this checkout is older than the database';

const PERMISSION_DENIED = '42501';
const UNDEFINED_TABLE = '42P01';

// Refuses, before any socket is opened, when the migrations recorded in the
// database and the files in db/migrations are not the same set. It reads as
// pos_app, which holds SELECT on schema_migration (migration 0009) and nothing
// more. File names are compared, not content: the runner stores no checksum.
export async function assertSchemaCurrent(dir: string = defaultMigrationsDir()): Promise<void> {
  let recorded: Set<string>;
  try {
    recorded = new Set((await query<{ filename: string }>('SELECT filename FROM schema_migration')).map((r) => r.filename));
  } catch (err) {
    // A database that predates 0009, or was never migrated, is behind by definition.
    const code = (err as { code?: string }).code;
    if (code === PERMISSION_DENIED || code === UNDEFINED_TABLE) throw new StartupError(BEHIND);
    throw err;
  }

  const files = new Set(await listMigrationFiles(dir));
  // Ahead wins when both hold: migrating will not fix a checkout older than the database.
  if ([...recorded].some((name) => !files.has(name))) throw new StartupError(AHEAD);
  if ([...files].some((name) => !recorded.has(name))) throw new StartupError(BEHIND);
}
