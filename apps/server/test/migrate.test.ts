import { describe, it, expect, beforeEach } from 'vitest';
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
});
