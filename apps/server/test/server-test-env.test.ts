import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyE2eEnv, e2eEnv } from '../../../e2e/support/env.js';
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

  it("and refuses the browser harness's database too", () => {
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_e2e');
    vi.stubEnv('POS_TEST_DB_NAME', 'pos_e2e');
    expect(() => serverTestEnv()).toThrow(/POS_TEST_DB_NAME.*"pos_e2e".*POS_E2E_DB_NAME/);
  });
});

// The browser harness's twin of the same guard. It computes values and opens no connection.
describe('e2eEnv refuses every database but its own', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The worker's variables name pos_test; put the development ones back, as the cases above do.
  function developmentShell(): void {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos');
    vi.stubEnv('POS_DB_NAME', 'pos');
    vi.stubEnv('POS_TEST_DB_NAME', 'pos_test');
  }

  it('when POS_E2E_DB_NAME is the development database', () => {
    developmentShell();
    vi.stubEnv('POS_E2E_DB_NAME', 'pos');
    expect(() => e2eEnv()).toThrow(/POS_E2E_DB_NAME.*"pos".*development database/);
  });

  it('when it is the server tests database', () => {
    developmentShell();
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_test');
    expect(() => e2eEnv()).toThrow(/pos_test/);
  });

  it('when the development URLs name it, whatever POS_DB_NAME says', () => {
    developmentShell();
    vi.stubEnv('POS_DB_NAME', 'unrelated');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/devdb');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/ownerdb');
    vi.stubEnv('POS_E2E_DB_NAME', 'devdb');
    expect(() => e2eEnv()).toThrow(/devdb/);
    vi.stubEnv('POS_E2E_DB_NAME', 'ownerdb');
    expect(() => e2eEnv()).toThrow(/ownerdb/);
  });

  it('when the name would only resolve to it through URL escapes', () => {
    developmentShell();
    vi.stubEnv('POS_E2E_DB_NAME', '%70os');
    expect(() => e2eEnv()).toThrow(/POS_E2E_DB_NAME/);
  });

  it('but points both connection URLs at its own database', () => {
    developmentShell();
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_e2e');
    const env = e2eEnv();
    expect(env.POS_E2E_DB_NAME).toBe('pos_e2e');
    expect(new URL(env.DATABASE_URL!).pathname).toBe('/pos_e2e');
    expect(new URL(env.MIGRATION_DATABASE_URL!).pathname).toBe('/pos_e2e');
  });

  it('and a worker, which inherits the runner environment, checks it rather than trusting it', () => {
    vi.stubEnv('E2E_ENV_APPLIED', '1');
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_e2e');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos_e2e');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos_e2e');
    expect(() => applyE2eEnv()).not.toThrow();
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos');
    expect(() => applyE2eEnv()).toThrow(/does not name its own database/);
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5433/pos_e2e');
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_test');
    expect(() => applyE2eEnv()).toThrow(/does not name its own database/);
  });

  // A shell that forges the runner's marker gets no weaker a check than the runner applies.
  function forgedMarker(shell: Record<string, string>, name: string): void {
    developmentShell();
    vi.stubEnv('E2E_ENV_APPLIED', '1');
    vi.stubEnv('E2E_REFUSED_DATABASES', '');
    for (const [key, value] of Object.entries(shell)) vi.stubEnv(key, value);
    vi.stubEnv('POS_E2E_DB_NAME', name);
    vi.stubEnv('DATABASE_URL', `postgres://u:p@127.0.0.1:5433/${name}`);
    vi.stubEnv('MIGRATION_DATABASE_URL', `postgres://u:p@127.0.0.1:5433/${name}`);
  }

  it('and a worker refuses a development database the shell renamed, marker or not', () => {
    forgedMarker({ POS_DB_NAME: 'custom_development' }, 'custom_development');
    expect(() => applyE2eEnv()).toThrow(/does not name its own database/);
  });

  it('and a worker refuses a server-test database the shell renamed', () => {
    forgedMarker({ POS_TEST_DB_NAME: 'custom_test' }, 'custom_test');
    expect(() => applyE2eEnv()).toThrow(/does not name its own database/);
  });

  it('and a worker accepts what the runner set, after the runner has run', () => {
    developmentShell();
    const written = [
      'E2E_ENV_APPLIED', 'E2E_REFUSED_DATABASES', 'POS_E2E_DB_NAME', 'POS_APP_PASSWORD', 'PIN_PEPPER',
      'DATABASE_URL', 'MIGRATION_DATABASE_URL', 'PROVISION_DATABASE_URL',
    ];
    // Stub each key the runner writes, so that unstubbing restores the worker's own environment.
    for (const key of written) vi.stubEnv(key, process.env[key] ?? '[]');
    vi.stubEnv('E2E_ENV_APPLIED', '');
    vi.stubEnv('POS_E2E_DB_NAME', 'pos_e2e');
    applyE2eEnv(); // the runner's branch: sets the marker and the carried names
    expect(process.env.E2E_ENV_APPLIED).toBe('1');
    expect(() => applyE2eEnv()).not.toThrow(); // a worker's re-evaluation
  });
});
