import { hash, verify } from '@node-rs/argon2';
import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { ARGON2 } from './argon2.js';
import { writeSecurityEvent } from './audit.js';
import type { StaffRole } from './pin.js';
import type { ThrottledVerification } from './throttle.js';

export const PASSWORD_MAX_FAILURES = 5;
export const PASSWORD_COOLDOWN_MINUTES = 5;

export type BackOfficeAccount = { username: string } | { staffUserId: string };

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// B-11, B-12: a PostgreSQL error's `detail` can carry the hash or the username,
// so a database error on this table is replaced, never wrapped, and keeps no
// cause. Every message below is fixed and names no value.
const DATABASE_FAILURE = 'The back-office credential store failed';

/** Trimmed and lower-cased; null when the result does not fit the username rule. */
export function normaliseUsername(typed: string): string | null {
  if (typeof typed !== 'string') return null;
  // ASCII letters only: toLowerCase() alone would map U+212A (Kelvin sign) to "k".
  const lowered = typed.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  return USERNAME.test(lowered) ? lowered : null;
}

function passwordFits(password: unknown): password is string {
  if (typeof password !== 'string') return false;
  const length = [...password].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
}

function constraintOf(err: unknown): { code?: string; constraint?: string } {
  return typeof err === 'object' && err !== null ? (err as { code?: string; constraint?: string }) : {};
}

export async function createBackOfficeCredential(
  input: { staffUserId: string; username: string; password: string },
  client?: Pick<pg.PoolClient, 'query'>
): Promise<{ username: string }> {
  const username = normaliseUsername(input.username);
  if (username === null) {
    throw new Error('Username must be 3 to 32 letters, digits, dots, underscores or hyphens');
  }
  if (!passwordFits(input.password)) throw new Error('Password must be 8 to 128 characters');

  const passwordHash = await hash(input.password, ARGON2);
  const sql = `INSERT INTO back_office_credential (staff_user_id, username, password_hash)
               VALUES ($1, $2, $3)`;
  const params = [input.staffUserId, username, passwordHash];
  try {
    if (client) await client.query(sql, params);
    else await query(sql, params);
  } catch (err) {
    const { code, constraint } = constraintOf(err);
    if (code === '23505' && constraint === 'back_office_credential_username_key') {
      throw new Error('Username is already taken');
    }
    if (code === '23505' && constraint === 'back_office_credential_pkey') {
      throw new Error('Staff user already has a back-office credential');
    }
    if (code === '23503') throw new Error('Staff user does not exist');
    throw new Error(DATABASE_FAILURE);
  }
  return { username };
}

type Attempt =
  | { kind: 'VERIFIED'; user: { id: string; role: StaffRole; credentialVersion: number } }
  | { kind: 'THROTTLED'; retryAfterSeconds: number }
  | { kind: 'FAILED'; retryAfterSeconds: number | null; cooldownStarted: boolean };

const NO_ROW: Attempt = { kind: 'FAILED', retryAfterSeconds: null, cooldownStarted: false };

interface LockedRow {
  staff_user_id: string;
  password_hash: string;
  role: StaffRole;
  is_active: boolean;
  credential_version: number;
}

// One attempt is one transaction: the account's credential row is locked, the
// password is checked and the outcome is counted before the lock is released,
// so concurrent guesses queue behind each other (FR-A5b, ADR-009 §4). All time
// is PostgreSQL's. The password goes to Argon2id and nowhere else (B-12).
export async function verifyPasswordThrottled(
  account: BackOfficeAccount,
  password: string,
  options?: { clientInstanceId?: string }
): Promise<ThrottledVerification> {
  let where: { column: 'c.username' | 'c.staff_user_id'; value: string } | null = null;
  if ('username' in account) {
    const username = normaliseUsername(account.username);
    if (username !== null) where = { column: 'c.username', value: username };
  } else if (typeof account.staffUserId === 'string' && UUID.test(account.staffUserId)) {
    where = { column: 'c.staff_user_id', value: account.staffUserId };
  }

  let attempt: Attempt = NO_ROW;
  if (where) {
    const { column, value } = where;
    try {
      attempt = await withTransaction<Attempt>(async (client) => {
        const locked = await client.query<LockedRow>(
          `SELECT c.staff_user_id, c.password_hash, u.role, u.is_active, u.credential_version
             FROM back_office_credential c
             JOIN staff_user u ON u.id = c.staff_user_id
            WHERE ${column} = $1
              FOR UPDATE OF c`,
          [value]
        );
        const row = locked.rows[0];
        if (!row) return NO_ROW;

        // The transaction's start time is stale after a wait for the lock. The
        // decision is read in a statement of its own, after the lock is held,
        // from clock_timestamp().
        const read = await client.query<{ blocked: boolean; retry_after_seconds: number | null }>(
          `SELECT blocked_until IS NOT NULL AND blocked_until > clock_timestamp() AS blocked,
                  ceil(extract(epoch FROM blocked_until - clock_timestamp()))::int AS retry_after_seconds
             FROM back_office_credential
            WHERE staff_user_id = $1`,
          [row.staff_user_id]
        );
        const decision = read.rows[0];
        if (!decision) throw new Error(DATABASE_FAILURE);
        if (decision.blocked) {
          return { kind: 'THROTTLED', retryAfterSeconds: Number(decision.retry_after_seconds) };
        }

        // A password outside 8 to 128 code points matches no stored hash.
        let matches = false;
        if (passwordFits(password)) {
          try {
            matches = await verify(row.password_hash, password);
          } catch {
            matches = false;
          }
        }
        if (matches && row.is_active && row.role === 'MANAGER') {
          await client.query(
            `UPDATE back_office_credential
                SET consecutive_failures = 0, blocked_until = NULL
              WHERE staff_user_id = $1`,
            [row.staff_user_id]
          );
          return {
            kind: 'VERIFIED',
            user: { id: row.staff_user_id, role: row.role, credentialVersion: row.credential_version },
          };
        }

        const failed = await client.query<{
          cooldown_started: boolean;
          retry_after_seconds: number | null;
        }>(
          `UPDATE back_office_credential
              SET consecutive_failures =
                    CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END,
                  blocked_until =
                    CASE WHEN (CASE WHEN blocked_until IS NULL THEN consecutive_failures + 1 ELSE 1 END) >= $2::int
                         THEN clock_timestamp() + make_interval(mins => $3::int) END
            WHERE staff_user_id = $1
        RETURNING blocked_until IS NOT NULL AS cooldown_started,
                  ceil(extract(epoch FROM blocked_until - clock_timestamp()))::int AS retry_after_seconds`,
          [row.staff_user_id, PASSWORD_MAX_FAILURES, PASSWORD_COOLDOWN_MINUTES]
        );
        const counted = failed.rows[0];
        if (!counted) throw new Error(DATABASE_FAILURE);
        return {
          kind: 'FAILED',
          cooldownStarted: counted.cooldown_started,
          retryAfterSeconds: counted.cooldown_started ? Number(counted.retry_after_seconds) : null,
        };
      });
    } catch {
      throw new Error(DATABASE_FAILURE);
    }
  }

  if (attempt.kind === 'VERIFIED') return { outcome: 'VERIFIED', user: attempt.user };
  if (attempt.kind === 'THROTTLED') {
    return { outcome: 'THROTTLED', retryAfterSeconds: attempt.retryAfterSeconds };
  }

  // After the commit, so a failed evidence write cannot undo the count. The
  // event names no username and no staff id (B-13): a mistyped username is
  // often a password typed into the wrong field.
  const throttleClass = 'BACK_OFFICE_LOGIN';
  const clientInstanceId = options?.clientInstanceId;
  await writeSecurityEvent({ eventType: 'PASSWORD_FAILURE', throttleClass, clientInstanceId });
  if (attempt.cooldownStarted) {
    await writeSecurityEvent({ eventType: 'COOLDOWN_STARTED', throttleClass, clientInstanceId });
  }
  return { outcome: 'FAILED', retryAfterSeconds: attempt.retryAfterSeconds };
}
