import { fileURLToPath } from 'node:url';
import { resetDatabaseFrom } from '../../apps/server/test/support/database.js';

export { ownerClient, ownerQuery } from '../../apps/server/test/support/database.js';

// Anchored to this file: Playwright's working directory is e2e/, not the root.
const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * Replaces the whole schema of the harness's database (`pos_e2e`) and migrates it
 * again. No row is touched, so the next schema starts with an empty audit log.
 */
export async function resetE2eDatabase(): Promise<void> {
  await resetDatabaseFrom(MIGRATIONS);
}
