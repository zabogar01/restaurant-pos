import type { Person } from '../../apps/server/test/support/people.js';
import { ownerQuery } from './database.js';

/**
 * Models `seconds` passing for one person's open session by moving its idle clock
 * back in PostgreSQL, the clock the server judges by. The shift is relative, not
 * "now minus N": if anything in between had moved `last_interactive_at` (a poll
 * that wrongly counted as activity), the shift keeps that move and the test sees
 * it. It moves only the idle clock; the absolute limit is an API-level proof.
 *
 * The browser's clock moves with it by the test's own `page.clock.fastForward`,
 * by the same amount, with no request in flight and `install()` called before the
 * first `goto`.
 */
export async function ageSession(
  audience: 'POS' | 'BACK_OFFICE',
  person: Pick<Person, 'id'>,
  seconds: number
): Promise<void> {
  const rows = await ownerQuery<{ id: string }>(
    `UPDATE actor_session
        SET last_interactive_at = last_interactive_at - make_interval(secs => $3::int)
      WHERE audience = $1 AND staff_user_id = $2 AND released_at IS NULL
      RETURNING id`,
    [audience, person.id, seconds]
  );
  if (rows.length !== 1) {
    throw new Error(`ageSession expected exactly one open ${audience} session and moved ${rows.length}`);
  }
}
