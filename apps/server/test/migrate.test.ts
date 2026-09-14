import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/db/migrate.js';
import { query } from '../src/db/pool.js';

describe('runMigrations', () => {
  beforeEach(async () => {
    await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });

  it('applies pending migrations and records them', async () => {
    const applied = await runMigrations('db/migrations');
    expect(applied).toContain('0001_extensions.sql');

    const rows = await query<{ filename: string }>(
      'SELECT filename FROM schema_migration ORDER BY filename'
    );
    expect(rows.map((r) => r.filename)).toContain('0001_extensions.sql');
  });

  it('is idempotent — a second run applies nothing', async () => {
    await runMigrations('db/migrations');
    const second = await runMigrations('db/migrations');
    expect(second).toEqual([]);
  });

  describe('when a migration fails', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'pos-migrations-'));
      await writeFile(join(dir, '0001_good.sql'), 'CREATE TABLE good_table (id int);');
      // The first statement succeeds; the second fails. Nothing of this file
      // may survive.
      await writeFile(
        join(dir, '0002_broken.sql'),
        'CREATE TABLE partial_table (id int);\nSELECT * FROM table_that_does_not_exist;'
      );
      await writeFile(join(dir, '0003_after.sql'), 'CREATE TABLE after_table (id int);');
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('names the file that failed', async () => {
      await expect(runMigrations(dir)).rejects.toThrow('0002_broken.sql');
    });

    it('leaves nothing of the failed file behind and stops before later files', async () => {
      await runMigrations(dir).catch(() => undefined);

      const tables = await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' ORDER BY table_name`
      );
      expect(tables.map((t) => t.table_name)).toEqual(['good_table', 'schema_migration']);

      const recorded = await query<{ filename: string }>(
        'SELECT filename FROM schema_migration ORDER BY filename'
      );
      expect(recorded.map((r) => r.filename)).toEqual(['0001_good.sql']);
    });
  });

  it('rolls back a file whose SQL succeeded when recording it fails', async () => {
    // PostgreSQL already runs a multi-statement string as one implicit
    // transaction, so the case above cannot tell whether the runner wraps
    // the file and its schema_migration row together. This one can: the
    // SQL itself succeeds, and only the runner's own INSERT fails.
    const dir = await mkdtemp(join(tmpdir(), 'pos-migrations-'));
    try {
      await runMigrations(dir); // creates schema_migration
      await writeFile(
        join(dir, '0001_unrecordable.sql'),
        `CREATE TABLE partial_table (id int);
         INSERT INTO schema_migration (filename) VALUES ('0001_unrecordable.sql');`
      );

      await expect(runMigrations(dir)).rejects.toThrow('0001_unrecordable.sql');

      const tables = await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      expect(tables.map((t) => t.table_name)).toEqual(['schema_migration']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  describe('npm run db:migrate', () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const run = promisify(execFile);

    it('applies the repository migrations when run from the repository root', async () => {
      const { stdout } = await run('npm', ['run', 'db:migrate'], { cwd: repoRoot });
      expect(stdout).toContain('applied: 0001_extensions.sql');

      const rows = await query<{ filename: string }>('SELECT filename FROM schema_migration');
      expect(rows.map((r) => r.filename)).toContain('0001_extensions.sql');
    });

    it('exits non-zero and names the failing file', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'pos-migrations-'));
      try {
        await writeFile(join(dir, '0001_broken.sql'), 'SELECT * FROM table_that_does_not_exist;');
        const failure = await run('npm', ['run', 'db:migrate', '--', dir], { cwd: repoRoot }).then(
          () => null,
          (err: { code?: number; stderr?: string }) => err
        );
        expect(failure, 'db:migrate exited 0').not.toBeNull();
        expect(failure?.code).not.toBe(0);
        expect(failure?.stderr).toContain('0001_broken.sql');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});
