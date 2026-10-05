import { describe, expect, it } from 'vitest';
import { provision } from '../scripts/provision.js';

describe('the provisioning step', () => {
  it('succeeds twice in a row', async () => {
    const options = {
      ownerUrl: process.env.MIGRATION_DATABASE_URL!,
      appPassword: process.env.POS_APP_PASSWORD!,
      testDatabase: process.env.POS_TEST_DB_NAME!,
    };
    await provision(options);
    await provision(options);
  });
});
