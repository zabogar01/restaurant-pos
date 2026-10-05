import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { query } from '../src/db/pool.js';
import { resetDatabase } from './support/database.js';

describe('the application pool', () => {
  beforeAll(resetDatabase);

  it('connects as the unprivileged pos_app role', async () => {
    const [who] = await query<{
      current_user: string;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      can_create_in_public: boolean;
    }>(
      `SELECT current_user, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolreplication,
              r.rolbypassrls, has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public
         FROM pg_roles r WHERE r.rolname = current_user`
    );
    expect(who).toEqual({
      current_user: 'pos_app',
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
      can_create_in_public: false,
    });
  });

  it('cannot change the schema', async () => {
    await expect(query('CREATE TABLE public.pool_test_must_not_exist (id int)')).rejects.toThrow(
      /permission denied/
    );
  });
});

describe('a missing connection variable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stops the application pool, naming DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', undefined);
    vi.resetModules();
    const fresh = await import('../src/db/pool.js');
    expect(() => fresh.getPool()).toThrow('DATABASE_URL');
    await expect(fresh.query('SELECT 1')).rejects.toThrow('DATABASE_URL');
  });

  it('stops the migration runner, naming MIGRATION_DATABASE_URL', async () => {
    vi.stubEnv('MIGRATION_DATABASE_URL', undefined);
    await expect(runMigrations('db/migrations')).rejects.toThrow('MIGRATION_DATABASE_URL');
  });
});
