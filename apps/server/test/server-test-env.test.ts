import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverTestEnv } from './support/env.js';

// serverTestEnv() only computes values; none of these cases opens a connection.
describe('serverTestEnv refuses the development database as a test target', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('when POS_TEST_DB_NAME is the development database', () => {
    vi.stubEnv('POS_DB_NAME', 'pos');
    vi.stubEnv('POS_TEST_DB_NAME', 'pos');
    expect(() => serverTestEnv()).toThrow(/POS_TEST_DB_NAME.*"pos".*development database/);
  });

  it('when the development URLs name it, whatever POS_DB_NAME says', () => {
    vi.stubEnv('POS_DB_NAME', 'unrelated');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/devdb');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/ownerdb');
    vi.stubEnv('POS_TEST_DB_NAME', 'devdb');
    expect(() => serverTestEnv()).toThrow(/devdb/);
    vi.stubEnv('POS_TEST_DB_NAME', 'ownerdb');
    expect(() => serverTestEnv()).toThrow(/ownerdb/);
  });

  it('when the name would only resolve to it through URL escapes', () => {
    vi.stubEnv('POS_TEST_DB_NAME', '%70os');
    expect(() => serverTestEnv()).toThrow(/POS_TEST_DB_NAME/);
  });

  it('but not for the default test database', () => {
    // The worker's own variables already name pos_test; put the development URLs back.
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos');
    vi.stubEnv('POS_DB_NAME', 'pos');
    vi.stubEnv('POS_TEST_DB_NAME', 'pos_test');
    expect(serverTestEnv().POS_TEST_DB_NAME).toBe('pos_test');
  });
});
