import { SESSION_POLICY } from '../../apps/server/src/domain/session.js';
import type { Person } from '../../apps/server/test/support/people.js';
import { ownerQuery } from './database.js';

/**
 * Models a back-office session outliving its absolute limit (FR-A2b) by moving its
 * absolute stamp back in PostgreSQL, the clock the server judges by. The shift is the
 * limit from the policy plus one second, applied to the one open row and to its issue
 * time alike, so that the row's own check (expiry after issue) still holds and nothing
 * else about the session changes: its idle clock stays where `ageSession` leaves it.
 *
 * The next request the session's tab sends is then answered `UNAUTHENTICATED`, and the
 * tab reaches BO-01 with the working area held (DESIGN-017, `D`).
 */
export async function ageAbsolute(person: Pick<Person, 'id'>): Promise<void> {
  const limit = SESSION_POLICY.BACK_OFFICE.absoluteSeconds;
  if (limit === null) throw new Error('the back office has an absolute limit by policy');
  const rows = await ownerQuery<{ id: string }>(
    `UPDATE actor_session
        SET issued_at = issued_at - make_interval(secs => $2::int),
            absolute_expires_at = absolute_expires_at - make_interval(secs => $2::int)
      WHERE audience = 'BACK_OFFICE' AND staff_user_id = $1 AND released_at IS NULL
      RETURNING id`,
    [person.id, limit + 1]
  );
  if (rows.length !== 1) {
    throw new Error(`ageAbsolute expected exactly one open BACK_OFFICE session and moved ${rows.length}`);
  }
}
