import { beforeEach, describe, expect, it } from 'vitest';
import { ownerQuery, resetDatabase } from './support/database.js';

// Every table the migrations create, sorted. Exact equality, so a table that a
// migration adds or a reset leaves behind fails here.
const MIGRATED_TABLES = [
  'actor_session',
  'audit_entry',
  'back_office_credential',
  'client_instance',
  'pin_throttle_bucket',
  'schema_migration',
  'security_event',
  'staff_user',
];

// The harness's own regression test. It has the shape that raced when vitest ran
// server files in parallel: reset in beforeEach, then assert on what the
// migrations created. Beside migrate.test.ts, which drops the same schema, a
// parallel run fails one of the two at random; serial it never does.
describe('two server test files resetting one database', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('see exactly what the migrations created', async () => {
    const tables = await ownerQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(tables.map((t) => t.table_name).sort()).toEqual(MIGRATED_TABLES);

    const recorded = await ownerQuery<{ filename: string }>(
      'SELECT filename FROM schema_migration ORDER BY filename'
    );
    expect(recorded.map((r) => r.filename)).toContain('0001_extensions.sql');
  });

  it('start every case from a reset schema', async () => {
    await ownerQuery('CREATE TABLE leftover (id int)');
    await resetDatabase();
    const tables = await ownerQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    expect(tables.map((t) => t.table_name).sort()).toEqual(MIGRATED_TABLES);
  });
});
