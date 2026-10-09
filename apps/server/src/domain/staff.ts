import { query } from '../db/pool.js';

/** Who a session belongs to, for the screen that shows it. */
export interface StaffIdentity {
  name: string;
  /** The stored, normalised username; null for a user with no back-office login. */
  username: string | null;
}

// A database error can carry the failing row's values, so it is replaced, never
// wrapped, and keeps no cause (B-12).
const DATABASE_FAILURE = 'The staff user store failed';

/**
 * One SELECT by id and no clock. A missing row returns null: the caller decides
 * what that means, and for a route it is a fault, never a partial body.
 */
export async function readStaffIdentity(staffUserId: string): Promise<StaffIdentity | null> {
  try {
    const rows = await query<{ name: string; username: string | null }>(
      `SELECT u.name, c.username
         FROM staff_user u
         LEFT JOIN back_office_credential c ON c.staff_user_id = u.id
        WHERE u.id = $1`,
      [staffUserId]
    );
    const row = rows[0];
    return row ? { name: row.name, username: row.username } : null;
  } catch {
    throw new Error(DATABASE_FAILURE);
  }
}
