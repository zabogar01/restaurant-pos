import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool.js';
import { assertSchemaCurrent } from '../src/db/schema-check.js';
import { StartupError } from '../src/http/errors.js';
import { ownerQuery, resetDatabase } from './support/database.js';

// The start-up check (PHASE1-S0): the set of migrations recorded in the
// database must equal the set of .sql files in db/migrations. The check reads
// as pos_app; the owner connection here only sets the scene.

const BEHIND = 'the database is missing migrations that are in db/migrations; run npm run db:migrate';
const AHEAD =
  'the database has migrations that are not in db/migrations; this checkout is older than the database';

const REAL_DIR = 'db/migrations';
const scratch: string[] = [];

/** A temporary directory holding the real migration files except `without`, plus the named extras. */
async function directory(opts: { without?: string; extra?: string[] } = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'schema-check-'));
  scratch.push(dir);
  for (const file of await readdir(REAL_DIR)) {
    if (file === opts.without) continue;
    await copyFile(join(REAL_DIR, file), join(dir, file));
  }
  for (const extra of opts.extra ?? []) await writeFile(join(dir, extra), '-- not applied\n');
  return dir;
}

/** What the check threw, as the error object. */
async function refusal(dir?: string): Promise<unknown> {
  try {
    await assertSchemaCurrent(dir);
  } catch (err) {
    return err;
  }
  throw new Error('the check passed; it was expected to refuse');
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

afterAll(async () => {
  await getPool().end();
});

describe('assertSchemaCurrent', () => {
  it('passes on a fully migrated database with the real db/migrations', async () => {
    await expect(assertSchemaCurrent()).resolves.toBeUndefined();
  });

  it('passes with an explicit directory equal to the real one', async () => {
    await expect(assertSchemaCurrent(await directory())).resolves.toBeUndefined();
  });

  it('refuses with the behind sentence when a file has no row', async () => {
    const err = await refusal(await directory({ extra: ['9999_not_applied.sql'] }));
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toBe(BEHIND);
  });

  it('refuses with the ahead sentence when a row has no file', async () => {
    const err = await refusal(await directory({ without: '0008_audit_entry_approval_throttled.sql' }));
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toBe(AHEAD);
  });

  it('uses the ahead sentence when both differences hold', async () => {
    const err = await refusal(
      await directory({ without: '0008_audit_entry_approval_throttled.sql', extra: ['9999_not_applied.sql'] })
    );
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toBe(AHEAD);
  });

  it('ignores a file that does not end in .sql', async () => {
    await expect(assertSchemaCurrent(await directory({ extra: ['README.md'] }))).resolves.toBeUndefined();
  });

  it('refuses with the behind sentence when pos_app cannot read schema_migration (42501)', async () => {
    await ownerQuery('REVOKE SELECT ON schema_migration FROM pos_app');
    const err = await refusal();
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toBe(BEHIND);
  });

  it('refuses with the behind sentence when schema_migration does not exist (42P01)', async () => {
    await ownerQuery('DROP TABLE schema_migration');
    const err = await refusal();
    expect(err).toBeInstanceOf(StartupError);
    expect((err as Error).message).toBe(BEHIND);
  });

  it('lets any other database error through unchanged', async () => {
    await ownerQuery('ALTER TABLE schema_migration RENAME COLUMN filename TO name');
    const err = await refusal();
    expect(err).not.toBeInstanceOf(StartupError);
    expect((err as { code?: string }).code).toBe('42703');
  });
});
